# 2026-11-15 AI 集中升级验收证据

本目录分别保存确定性程序评测、真实 DeepSeek / Search API 调用和真实浏览器操作的结果。失败记录保留，后续复测另建文件，不覆盖原始结果。当前记录针对本地开发分支和本地生产服务，不代表已合并、部署或通过大陆公网、真机验收。

## 当前最终结果

开始于main `f5d561c`，本轮期间main新增20条verified与团队文案，已合入最新 `88e07cf`（合并提交 `e7f1022`），当前数据97 verified/2 pending；原79实体逐项未改。之前77条阶段的所有文件仍保留，不能把它们当作新97条数据的验收。

| 最终证据 | 实际结果与边界 |
| --- | --- |
| `npm test` / lint / `tsc --noEmit` / build | 最后地图表述检查后173/173测试，0失败/跳过，其他三项退出0；六页七动态API保留 |
| [deterministic-main97-final.json](deterministic-main97-final.json) | 271/271；112检索目标hit@1/全部期望hit@6=100%，7/7空结果、98/98引用关联、12非法证据拒绝、30总边界正确、29/29执行检查样本。中位2.07ms/P95 5.08ms，仅程序分支 |
| [real-model-targeted-final.json](real-model-targeted-final.json) | 2/2 HTTP200，普通原题不联网4242.19ms，饮食追问4181.18ms；2/2引用关联、1成功比较工具。但人工发现追问误称旧地图已设置，继续修复而非隐藏 |
| [real-model-map-guard-recheck.json](real-model-map-guard-recheck.json) | 最后重建后同一真实追问200、8601.62ms，1比较工具、2/2引用关联、mapActions为空，正文没有虚假操作入口/已设置声明 |
| [browser-release/browser.json](browser-release/browser.json) | 最新main整合构建，真实3请求（chat2+Studio1）全部成功；比较5真实工具→双省高亮→三门详情→手机视口生成3组建议；过期操作拒绝；六页200、97/2边界、书册/依据/来源通过；JS/资源失败0 |
| [browser-final-readonly.json](browser-final-readonly.json) | 最后一处无地图声明校验后，六页×两视口12导航、97/2边界全部通过，无模型调用；不冒充再次真实全链路 |
| [security-data-final.json](security-data-final.json) | 394版本库候选文件、27客户端构建文件未发现5个受检本机密钥/令牌值；数据与main一致，原79实体未变，密钥文件忽略且不改 |

`browser-release/`早于最后仅针对“本轮没有地图操作却称已设置”的校验收紧；之后重新执行173测试/Lint/类型/构建、上述1次追问真实复测，以及无计费网页导航，未再次计费跑已通过的制卡链路。桌面依据与手机造物截图人工查看。所有来源关联比例不代表逐句语义事实正确。

本轮共15个用户级真实API请求（首轮6+首轮网页3+定向2+新网页3+最后追问1），不是15个上游计费completion：工具轮和受限修复会增加completion。初次失败保留，不汇总成“15/15首次通过”。新增截图：[桌面依据](browser-release/desktop-evidence.png)、[双省地图](browser-release/desktop-map.png)、[手机案例](browser-release/mobile-evidence.png)、[手机造物](browser-release/mobile-studio.png)、[过期保护](browser-release/mobile-stale.png)。

## 确定性评测

入口为 `npm run eval:ai`（默认不请求模型）和 `tests/ai-quality.test.mjs`，固定样本在 `tests/fixtures/ai-quality-cases.json`。评测实际调用本地检索、六工具和程序化证据校验；取消、超时、模型异常等故障分支使用明确隔离的测试响应，不将其算作真实模型表现。

| 记录 | 结果 | 含义 |
| --- | --- | --- |
| [deterministic-initial.json](deterministic-initial.json) | 228 / 231 | 初轮发现“漠河北极村”中“河北”省份子串误判、饮食追问筛选未继承、同一完整标题的引用地区误判，共 3 项失败。 |
| [deterministic-recheck.json](deterministic-recheck.json) | 231 / 231 | 修正地区解析、追问和完整标题引用后复测通过。 |
| [deterministic-final.json](deterministic-final.json) | 231 / 231 | 将工具统计明确为程序检查样本，引用分母排除无引用的普通回答。 |
| [deterministic-final-corrected.json](deterministic-final-corrected.json) | 231 / 231 | 将样本中的“黑米饭”更正为有数据依据的“乌饭”，增加可复现元数据；后续最终代码仍需另存最终复测记录。 |

“黑米饭”不能直接视为案例中南烛叶染糯米制作的“乌米饭”，因此纠正的是评测语义假设；没有修改正式案例事实、稳定 ID、77 条 verified 或 2 条 pending。

修正记录的 231 个样本覆盖：24 节气工具、77 个案例完整标题、22 个手工检索问题、77 个合法案例引用，以及无效引用、无匹配、六工具组合、地图到造物入口、非法参数、幂等、取消、超时和异常边界。关键指标：

- 正向检索 92 个样本，hit@1 和所有期望 ID 命中前 6 项均为 92 / 92；另有 7 / 7 应为空的问题正确为空。
- 有效引用提及 78 / 78（77 个本地案例和 1 个程序提供的网页来源），非法引用 / 不足来源拒绝 12 / 12。
- 综合应拒绝或返回空结果的边界样本 30 / 30。
- 六工具覆盖 36 个检查样本；其中 29 个成功执行样本、6 个预期参数拒绝样本及组合检查。29 / 29 是程序执行样本的成功率，不能解释为模型自主调用质量或 29 次模型请求。
- 本轮该次程序评测各样本耗时合计 193.84 ms，中位数 0.71 ms，P95 1.83 ms；不包含真实模型网络时间。

引用指标只校验编号、verified 实体字段和来源关联，**不表示模型全文语义事实准确率**。无引用的普通答案不纳入引用分母。初轮 JSON 保留当时的旧统计字段和旧分母，其百分比不能与修正后的口径直接比较。

## 首轮真实 DeepSeek 与联网检索

[real-model-initial.json](real-model-initial.json) 保存 6 个受控问题的真实 HTTP 请求结果。无请求拦截、无模拟模型或搜索、无评测器自动重试。服务为本地生产服务 `http://127.0.0.1:3116`，调用现有官方 DeepSeek 后端和真实搜索接口。

| 样本 | HTTP / 验收结果 | 说明 |
| --- | --- | --- |
| ordinary | 200，通过当时断言 | “冬至为何不一定最冷”题尾包含“检索”，意外触发真实搜索；不能据此声称普通不搜索路径已通过。 |
| alias | 200，通过 | “沪上清明青团”匹配已核验上海案例，返回真实查询、地图与案例工具事件及来源。 |
| complex | 200，通过 | 江苏 / 浙江冬至比较，自主调用比较、节气信息、地图、高亮、打开案例 5 个工具，返回两省真实案例和白名单操作。 |
| follow-up | 502，失败 | “只看饮食类”追问返回 `UNVERIFIED_ANSWER`，原始错误保留，尚需定向修复后复测。该错误不能伪称为成功或无资料。 |
| unmatched | 200，通过 | 虚构“量子祭龙王”未作为已收录案例回答；模型先发出 1 次参数不合法的比较调用，收到真实失败后通过查询工具恢复。 |
| live-search | 200，通过 | 香港天文台二十四节气时刻资料发生真实联网检索，并返回本轮搜索来源与引用。 |

首轮为 **5 / 6 通过**。可见成功响应中的 27 次引用提及，27 次通过实体 / 来源关联检查；中位响应耗时 3709.98 ms，P95 5106.63 ms。响应返回的工具事件可观测执行 10 次，其中 9 次成功、1 次参数失败、0 次结果复用；502 响应不附带工具事件，不能据此断言其服务器内部执行了零次工具。

首轮 complex 回答曾在开头使用“已切换 / 已打开”措辞，结尾才说明待用户点击地图入口。工具实际生成的是经过校验的待确认操作，浏览器未在回答生成时自动应用；该措辞风险属于模型解释限制，不能当作浏览器已执行的证据。

后续普通问题保留首轮原句（包括“不要引用未经检索的来源”），增加 `evidence.searchStatus === "not_requested"` 断言，验证否定检索措辞下仍可走普通问答。已完成的定向ordinary/follow-up、最终地图声明及网页结果见上方最终表；未重跑已经通过的搜索/俗称API样本来虚增通过率。

## 首轮真实浏览器链路

[browser-initial/browser.json](browser-initial/browser.json) 来自本地 Chrome 的真实网页、2 次真实聊天和 1 次真实造物 API 请求，共 3 次受控真实功能请求；不是保存响应重放。该浏览器对应的构建早于最终“黑米饭 / 乌饭”别名纠正，不能单独证明最终构建产物已经跑过同一真实链路。

该轮通过：

- 现有 6 个页面（含后续新增“节气探访”）均返回 200，无横向溢出；案例总数 77，两条 pending 的详情均返回 404。
- 节气书册切至冬至并使用原有高清照片。
- 桌面问答显示真实四工具状态、江苏 / 浙江分组案例和原文链接、可展开的回答依据与检索说明。
- 点击“在地图中查看”后，冬至 / 浙江 / 三门祭冬详情与江浙两省高亮同时生效。
- 手机视口中案例卡“做节气卡”进入造物，原案例 ID 保留；真实造物生成 3 条建议，来源仅对应三门祭冬。
- 另一次真实问答在等待期间手动切换清明，旧响应地图入口被禁用，保留新的用户选择。
- 无浏览器 JS 错误或非取消资源请求失败。桌面与手机视口截图已经人工查看。

截图：[桌面依据](browser-initial/desktop-evidence.png)、[桌面地图](browser-initial/desktop-map.png)、[手机视口案例卡](browser-initial/mobile-evidence.png)、[手机视口造物](browser-initial/mobile-studio.png)、[过期地图保护](browser-initial/mobile-stale.png)。手机视口测试不等于真实手机、其他电脑或大陆无 VPN 网络测试。

## 复现与证据边界

所有生成命令显式指定新文件名，写入使用不覆盖模式。完整默认命令：

```powershell
npm run eval:ai
node --test tests/ai-quality.test.mjs
```

真实 API 评测默认不执行，必须显式 `--live`，沿用项目服务端密钥，参数中不传密钥。最终服务准备好后，只复测两个目标问题、沿用已保存的真实复杂对话：

```powershell
node scripts/evaluate-ai.mjs --live --origin http://127.0.0.1:3116 --cases ordinary,follow-up --history docs/verification/ai-final-2026-11-15/real-model-initial.json --output docs/verification/ai-final-2026-11-15/real-model-targeted-final.json
```

早期记录的 `commit=f5d561c...` 表示开发分支基线，**不表示被测业务代码就是干净的 main**；开发在未提交工作树进行。较新记录增加 `workingTreeDirty`、固定样本 SHA256、AI 相关源文件 SHA256 指纹、`localBuildId`。构建 ID 只代表本地 `.next` 产物，不代表已上线提交。真实浏览器新记录也保存 runner 指纹和本地构建 ID。

最终全量测试、Lint、TypeScript、生产构建以及定向真实复测结果见上方追加的最终表。本目录不包含 Netlify 发布或大陆三网 / 真机验收；四时导读、探访/个人记忆真实生成与PNG成品本轮也未复测。未自动合并或部署。
