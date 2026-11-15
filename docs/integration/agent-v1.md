# Agent V1 实际接口与联调

日期：2026-11-15。修改基线：最新 `main` 的 `8206664`；开发分支 `feat/agent-map-v1-20261115`。本轮只补全现有工具/协议/可视联动；不改77条verified与2条pending，不换DeepSeek，不合并或部署。

更新：以上是已合并PR #15的历史基线；当前赛前增强基于 `f5d561c`（含PR #16探访）开发，保留以下协议，增加可选依据模式。最新测试与边界见[AI技术与评测](../AI_TECHNICAL_EVALUATION_2026-11-15.md)。

## 聊天协议与兼容

继续 `POST /api/chat`，Content-Type为application/json。无version的客户端保留原有 `{messages}` 与 `{answer,truncated}` 及已有案例查询/引用可选字段。存在version但不是字符串 `"1.0"` 时返回400 UNSUPPORTED_VERSION。

```json
{
  "version": "1.0",
  "messages": [{"role":"user","content":"比较江苏和浙江的冬至习俗，在地图中高亮两省并打开三门祭冬。"}],
  "context": {"solarTermId":null,"provinceCode":null,"caseId":null}
}
```

V1根对象、消息和context严格校验；caseId必须verified，且与term、省份（含明确关联省）匹配。context只提供事实快照，不允许注入系统角色或工具定义。所有ID都来自现有白名单。

成功必有 `version`、`reply`、`answer`、`truncated`、`mapActions`、`toolEvents`、`references`。本轮V1特意保留 `answer=reply` 兼容别名；这与历史草案“不含answer”的目标不同。可选 `answerText/caseReferences/caseLookup/noLocalCaseMatch` 继续支持已有案例卡。错误含 `{version:"1.0",answer:null,truncated:false,error:{code,message}}`，旧读取方式仍可识别。

`toolEvents`只记录实际执行的toolCallId、名称、成功/脱敏错误；不返回原始参数、思考链或凭据。`references`来自本请求实际成功查询/open/compare返回的verified来源，按caseId+URL去重，最多20条；`caseReferences`仅对应正文合法引用的案例卡。

### 可选回答依据模式（向后兼容扩展）

新界面发送 `includeEvidence:true`（仅V1，可省略），服务端才额外返回：

- `evidence`：`method:"local_knowledge_retrieval"`，四类kinds、本地canonical实体与原始来源、本轮真实web来源、searchStatus、引用关联checks及固定limitation。`statementTruth:false`明确不认证逐句解释。已检索但未引用的案例保留 `cited:false`。
- `retrievalDiagnostics`：最多8条实际search/compare记录，含策略、筛选维度、别名、匹配总数/选中ID、分数与命中字段。匹配数可以大于本轮最多6个取用实体，不表示页面返回所有案例。
- `toolEvents[].reused:true`：只读工具的相同参数已经在本请求成功执行时复用其结果；UI显示“复用结果”。失败不缓存、地图操作不缓存。不是再次执行，也不跨访客复用。

未声明includeEvidence的旧V1和无version旧客户端继续原字段结构，不附这些扩展。请求仍严格拒绝未知键或非法类型。示例（原有全部成功字段仍保留）：

```json
{"version":"1.0","includeEvidence":true,"messages":[{"role":"user","content":"介绍沪上清明青团及来源"}],"context":{"solarTermId":null,"provinceCode":null,"caseId":null}}
```

来源/实体不一致进入原有最多一次受限修复预算，修复仍不能核实则真实错误；不简单删除错误引用让回答假装通过。检索是本地轻量规则增强，非向量RAG。具体schema见 `lib/contracts/ai-evidence.ts`、`retrieval.ts` 和 `chat-api.ts`。

## 六个工具

| 工具 | 参数 | 真实行为 |
| --- | --- | --- |
| search_cultural_cases | 可选query、solarTermId、provinceCode、category、keyword、offset、limit | 保留中文query，增加结构化联合筛选和分页；返回实际匹配数、稳定引用cases、截断提示；每轮最多6个可引用实体 |
| show_cultural_map | solarTermId | 验证节气，准备SET_SOLAR_TERM，清临时地区/案例/高亮 |
| highlight_regions | provinceCodes数组 | 要求已有节气，逐省验证有对应verified；准备替换高亮，空数组清空 |
| open_cultural_case | caseId | 要求真实verified并属于当前term，准备打开详情及所属省份；pending与不存在同样拒绝 |
| get_solar_term_info | solarTermId | 读取24节气基础说明、季节、黄经与小识；不提供实时天文计算 |
| compare_cultural_cases | solarTermId、2至6个provinceCodes，可选category/keyword | 实际逐省过滤，公平分配至多6条引用、每省至多2条；返回各省总匹配数/案例/来源，未覆盖地区为空 |

模型自主 `tool_choice:auto`；服务端不通过字符串猜测或伪造调用。最多2轮工具、每轮4次、最多8个事件；末轮tool_choice:none。一次工具5秒/100000字节，整链路仍52秒，单模型40秒；所有阶段支持取消。只保留短429一次重试，不改变现有提供商或费用重发策略。

## 地图与可视交互

唯一允许的操作是 SET_SOLAR_TERM、HIGHLIGHT_PROVINCES、OPEN_CULTURAL_CASE，最多8条。工具真实执行形成临时状态与操作；不从模型正文/HTML/任意JSON提取操作。任一工具失败则最终mapActions为空；最终模型/引用失败不返回成功地图批次。

`lib/map-actions.ts`两端共用顺序与数据验证：省份必须有当节气案例，打开案例必须verified且节气匹配。客户端先从真实案例API获取涉及节气的完整集合，再验证整批，最终一次状态更新；任何一步失败都不应用前缀。

ChatPanel请求中只显示通用“正在分析问题，按需查询资料”；响应后根据实际toolEvents显示查询/比较/地图准备等结果。保持非流式JSON，没有伪造“正在调用某工具”的服务器事件。不同省份的案例卡与原文分组显示，AI正文解释文化差异，保留制卡入口。

回答中的“在地图中查看”是显式应用按钮，点击后节气/两省金色高亮/案例详情正确联动。工具成功仅代表已准备，不代表浏览器已经应用。provider同步维护revision，手动筛选/应用批次/清空会话均使旧批次失效；回答可保留，但旧按钮禁用。异步核验结束还要再次检查revision与取消信号。

## 验收记录

初轮真实API记录保留在 `../verification/agent-v1-2026-11-15/ai-live.json`：普通问答200；复杂问答真实完成6次调用但遗漏highlight，严格验收失败。修改提示词减少重复search、明确两轮安排，并禁止未联网时悬空数字引用后进行定向复测。不能把首轮失败删除或写成一次通过。

最终结果：

| 检查 | 实际结果 |
| --- | --- |
| 全部自动测试 | 137通过、0失败、0跳过；包含V1/旧兼容、六工具、原子地图、取消/引用修复/历史编号边界和原117项功能 |
| Lint、生产构建 | 均退出0；构建含TypeScript，五条API仍是动态服务端路由 |
| 普通知识真实问答 | 首轮HTTP200，约3.2秒，不生成地图操作 |
| 多工具复杂问题 | `ai-live-recheck.json` HTTP200，约7.3秒，真实节气信息/比较/show/highlight/open；三种地图操作和两省来源齐全 |
| 饮食类多轮追问 | 最初引用保护返回502，收紧历史引用后 `followup-recheck.json` HTTP200，约5.9秒；仅引用江苏冬酿酒，明确浙江该类别暂无收录 |
| 真实桌面网页 | 五页200、书册切冬至、工具状态、分省来源、点击批次地图后双省高亮及三门详情全部通过 |
| 手机视口与造物 | 393×851保留真实会话，进入三门祭冬制卡，实际DeepSeek生成3组文案且仅引用该案例 |
| 过期保护 | 新的真实请求等待期间手动切清明，回答回来仍保留清明，旧操作按钮禁用 |
| 页面错误/资源失败 | 浏览器验收均0；所测视口无页面横向溢出 |
| 数据与密钥边界 | 当前案例JSON与main实体逐项一致，77/2不变；项目与客户端构建产物未发现本机实际密钥明文；密钥文件未改动 |

证据在 [验收总览](../verification/agent-v1-2026-11-15/README.md)，含首轮和后续分别保存的JSON、桌面/手机截图。浏览器最初的URL断言错误在任何AI调用之前发生，仅修正测试读取绝对本站URL的假设，也保留失败文件。浏览器全链路在最后历史编号收紧前通过；最后修改后重新运行全部测试/Lint/构建，并只复测此前失败的真实追问，没有反复计费重跑相同网页。

当前构建及测试不等于公网上线；本轮不部署Netlify/Vercel，也不把手机浏览器模拟当作实体手机验收。真实搜索代码保留并由原自动测试回归，本轮未另发实时联网付费问题；四时实时导读及实体手机也未重新实测。不保证所有未来模型回答都一定选中相同工具组合，空结果/错误会按实际执行反馈。

## 复现

```powershell
npm.cmd test
npm.cmd run lint
npm.cmd run build
npm.cmd run start -- --hostname 127.0.0.1 --port 3115
```

显式真实验收（会调用服务端模型并消耗额度，不自动重试；输出须使用新路径）：

```powershell
node tests/agent-live.mjs http://127.0.0.1:3115 docs/verification/agent-v1-2026-11-15/new-ai-check.json
$env:PLAYWRIGHT_MODULE_PATH = '<本机已有playwright-core绝对目录>'
node tests/agent-browser.mjs http://127.0.0.1:3115 docs/verification/agent-v1-2026-11-15/new-browser-check
```
