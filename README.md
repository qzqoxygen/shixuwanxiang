# 时序万象·AI

二十四节气非遗文化探索平台的 V2 基础工程。当前开放节气资料、DeepSeek 官方模型文化问答、造物工坊、中国省级基础地图，以及按节气和省份查询文化案例与来源的手动探索流程。

## 团队协作协议

[前后端技术约束与接口协议 V1.0](docs/contracts/v1.0.md) 是基于现有代码整理的下一阶段开发草案，待团队共同确认。文档包含旧聊天接口兼容规则、文化案例只读 API、四个业务工具、地图操作与状态同步规则、职责和验收清单。

知时问答已接通六个真实工具：案例查询、地图展示、省份高亮、案例打开、节气信息与跨地区比较。V1聊天携带地图上下文，回答显示实际工具记录和分省案例来源；用户点击“在地图中查看”后才校验并原子应用操作，过期批次不会覆盖新选择。原案例卡、原文和造物入口保留。见[Agent V1 联调](docs/integration/agent-v1.md)与[当前项目进度](docs/PROJECT_STATUS.md)。

### 全站文化案例（11 月 12 日补采批次）

补采表五张工作表已交叉核对：原有 44 条公开案例保留，新增 33 条，共 77 条。24 个节气各有至少 3 条，谷雨、夏至、小雪、冬至、小寒各 4 条；2 条待核验记录继续隐藏，绍兴重复记录保留合并关系。跨省区域案例按一个实体计数，省份筛选包含明确的关联地区，不虚构县市。所有案例以文字和来源展示，不新增图片。

四时页可展开当前节气的全部案例，知时地图按节气与省份查询同一数据源；知时问答和造物灵感也读取这些已核实案例，并区分本地资料与实时搜索来源。见[逐条差异与入库清单](docs/cultural-sources/2026-11-12/report.md)、[全站覆盖与验收](docs/integration/cultural-case-site-coverage-2026-11-12.md)及[接口联调说明](docs/integration/cultural-cases.md)。旧批次记录保留作为开发历史，不代表当前覆盖数量。

### 2026-11-03 文化案例后端交付

- 已实现：共享类型与 Zod 运行时校验、本地案例读取、`GET /api/cultural-cases` 组合筛选/分页及 `GET /api/cultural-cases/[caseId]` 详情与来源。接口独立于 DeepSeek，只返回 verified，空条件覆盖返回真实空结果。
- 首批资料：12 条整理为 7 条 verified、1 条 pending 和 4 条地域缺失草稿；全部省略未授权图片。原始资料快照、逐条依据和未入库原因见 [资料清单](docs/cultural-sources/README.md)。
- 前端可先接入 [共享类型与接口示例](docs/integration/cultural-cases.md)；本轮未改页面、样式、基础聊天、四个业务工具或聊天 V1 协议。

### 2026-11-03 手动文化探索接入

- 知时页已连接案例只读接口：四个重点节气快捷筛选、全部 24 节气下拉选择、省份点击/键盘/列表筛选、案例分页、详情与来源链接。
- 切换节气清空省份、页码和详情；变更省份清空页码和详情；打开案例会选中其所属省份。状态只保留在当前页面，地图悬浮预览不触发查询。
- 列表和详情分别校验 V1 响应；筛选变更会卸载旧结果视图并取消请求，过期返回不会覆盖新选择。提供加载、超时、失败重试和无匹配案例提示，不生成演示案例。
- 手动探索初次接入时使用首批 7 条公开案例。现行数据以本页的最终表批次为准。
- 验收示例：清明＋上海查看青团详情与来源；冬至＋浙江查看三门祭冬；秋分显示当前暂未收录；全部节气可切换分页。

### 2026-11-04 云朵聊天与全宽探索布局

- 地图与案例区使用全部主内容宽度；二十四节气全部展开，桌面以四季双列紧凑排列，窄屏自动换行。
- AI 默认收起为右下角青绿祥云入口，含轻缓浮动、呼吸微光和淡金流云线。展开后采用羽化纸面与四周流动薄雾，不再使用顶部云头或硬边框；系统减少动态效果设置会关闭装饰动画。
- 入口和展开窗均可用鼠标或触屏拖动，窗口拖动区域为标题栏；拖动有移动阈值，避免误触展开。方向键微调、Shift 加速、Home 复位；支持恢复位置和 Esc 收起。移动位置限制在屏幕内，缩放和切换设备尺寸后自动校正。
- 收起不卸载聊天组件，当前对话、输入草稿和进行中的请求均保留；重新展开聚焦输入框，收起后焦点返回入口。刷新仍清空对话。
- 仅调整前端布局与样式，沿用现有聊天请求和案例只读接口，没有接入 AI 控制地图，也没有新增依赖。
- 知时页增加青绿飘带舒展、描金流光、标题入场、区域滚动渐显及少量金尘；保留减少动态效果和无脚本回退。工具调研与实现说明见 [动效方向](docs/design/motion-direction.md)。

### 2026-11-02 前端阶段交接

- 已完成：34 个省级行政区地图及南海诸岛附图、省份浮起与选择、放大浏览、响应式排版、聊天界面和本地视觉素材。
- 尚未完成：知时页节气筛选、案例列表与详情、案例数据及只读 API、V1 聊天协议、四个文化业务工具与 AI 地图联动。
- 后端下一批交付：按协议实现案例共享类型、数据校验、`GET /api/cultural-cases` 与 `GET /api/cultural-cases/[caseId]`。先让手动探索可用，再注册业务工具；复用当前聊天服务和工具执行流程。
- 前端接续：将当前地图内部的省份选择状态提升到探索页的共享客户端组件，接入节气筛选、案例列表与详情，再迁移聊天 V1 协议。当前 ChatPanel 仍发送 `{ messages }`，读取 `{ answer, truncated }`，后端需保留兼容。
- 数据约定：节气 ID 复用 `lib/solar-terms.ts`，省份采用六位编码字符串；`100000_JD` 只用于海上界线，不能作为案例省份。正式数据只公开已核实记录，素材整理表尚未作为运行数据导入。

## 本地运行

四时页（`/seasons`）沿用宣纸青绿风格。桌面左侧为节气目录，右侧为左文右图的对开书，支持翻页按钮、方向键和目录跳转。窄屏采用纵向阅读与横向滑动切换节气。24 个节气各有独立的「节气小识」和 **1920×1440、4:3、WebP** 实拍照片，照片逐张标注作者、来源和许可。桌面左页配有四季淡彩水墨插画，动效可暂停并遵循系统减少动态效果。详见 [四时页设计说明](docs/design/seasons-direction.md) 与 [照片来源](public/images/solar-terms/SOURCES.md)。

知时问答（云间问四时）、造物灵感与联网检索共用一个服务端变量 `DEEPSEEK_API_KEY`。本地将密钥放在项目根目录的 `.env.local`，配置变更后重启服务。Netlify 为当前优先部署目标，Vercel 保留备用，两个平台独立配置同名环境变量。变量模板见 [.env.example](.env.example)，发布与验收说明见 [Netlify 部署](deploy/netlify.md)。
首次恢复或获取源码时使用 npm ci；已有依赖无需重复安装。

```powershell
npm.cmd run dev
```

打开终端给出的本地地址。五个页面：/、/seasons、/explore、/studio、/about。
在 /seasons 切换节气；在 /explore 输入“什么是冬至？”，再追问“它和夏至有什么区别？”。
真实聊天需要有效密钥、余额和网络。失败显示真实错误，不返回演示答案。

## 检查

```powershell
npx.cmd tsc --noEmit
npm.cmd run lint
npm.cmd test
npm.cmd run build
```

测试使用 Node >=22.15（当前本机为 Node 24）和已安装的 TypeScript，无额外依赖。
测试网络为隔离模拟，仅用于校验 SDK 请求序列化和错误分支；两个 AI 接口在正常运行时调用 DeepSeek 官方服务。
案例自动测试也不访问网络；对运行中服务的可选真实 HTTP 检查见 [联调说明](docs/integration/cultural-cases.md#检查与复现)。

## 结构与扩展

- app/：五个页面、公共布局、api/chat 和 api/cultural-cases 路由。没有 src/。
- components/SiteHeader.tsx：公共导航及当前页面状态。
- components/SolarTermsExplorer.tsx：24节气选择与基础信息。
- lib/solar-terms.ts：独立、稳定的节气 ID，预留 culturalCaseIds 关联字段；没有虚构文化案例。
- lib/contracts/cultural-case.ts、lib/provinces.ts：客户端可复用的案例 schema、请求/响应类型和 34 省级编码映射。
- lib/server/cultural-cases.ts、cultural-case-query.ts：本地集合校验及 verified 查询；运行数据单独位于 data/cultural-cases/cases.json，草稿不参与读取。
- components/ChatPanel.tsx：多轮聊天、加载、取消及错误提示。
- lib/ai-agent.ts：执行有限轮次的真实工具调用，保留取消、输出上限及脱敏事件；知时V1注册案例查询、地图、高亮、打开、节气信息和地区比较六工具。
- app/explore/page.tsx：全宽中国省级地图与案例探索，以及独立的云朵聊天入口。
- components/FloatingChat.tsx、FloatingChat.css：保留原 ChatPanel 的可开关云朵悬浮窗，含拖动、键盘移动、屏幕边界和手机底部布局。
- components/cultural-map/：省界、地名、南海诸岛附图、缩放与省份浮起/选定；ProvinceInteraction.tsx 管理鼠标、触屏、键盘及已校验AI地图批次，revision防止旧回答覆盖新选择。PaperLandscape.tsx 为保留的装饰组件，目前未在省份中启用。
- components/cultural-map/CulturalCaseExplorer.tsx：节气筛选、案例列表、分页、详情与来源，复用 ProvinceInteraction 的共享选择状态。
- lib/explore-selection.ts、lib/cultural-case-client.ts：手动选择状态转换、案例 HTTP 请求及返回校验；客户端不导入案例运行数据或凭据。
- app/explore/explore.css：知时页面的全宽布局、浅宣纸、青绿云带与金褐线条样式。地图内部保持浅宣纸；素材及生成说明见 [ARTWORK.md](public/images/ARTWORK.md)，字体许可见 [字体说明](public/fonts/README.md)。
- data/maps/：本地底图及来源说明，参见 [地图数据说明](data/maps/README.md)；仅用于学习交流原型。
- lib/map-projection.ts：无额外依赖的 SVG 投影与路径转换。
- tests/：案例校验/查询/API、节气数据、聊天、通用执行流程、错误处理，以及地图省级编码、投影和路径测试。

### AI 问答、检索与造物灵感

两个 AI 路由均使用 Next.js 默认的 Node.js 运行时。服务端通过 `POST https://api.deepseek.com/chat/completions` 调用 `deepseek-flash`，关闭思考模式，按一次完整 JSON 响应返回，以兼容现有问答面板和造物工坊。造物灵感使用模型的 JSON 输出模式，返回经校验的标题和短句。

普通问题直接问答。涉及当前资讯、具体日期、活动等的问题，会先向 DeepSeek 官方 `POST /v1/tools/search` 查询，再把本轮检索摘要交给模型。页面中的来源链接由服务端按引用编号附加。搜索中断、限流或没有可用结果时，界面会标明实时信息未核实，并允许模型回答相关的通用知识。[DeepSeek 搜索文档](https://api-docs.deepseek.com/guides/search/)

地方习俗、地域对比和非遗案例可以由 DeepSeek 自主发起本地查询。服务端只返回已核验资料，为本轮案例保留稳定的引用编号，页面按实际查询结果显示「已查询案例库」。回答里的案例卡提供地图定位和原文入口。可在「云间问四时」提问「江苏和浙江的冬至习俗有什么不同？」验证两省案例。[DeepSeek 工具调用文档](https://api-docs.deepseek.com/guides/tool_calls/)

每个函数实例按访客 IP 每分钟最多受理 12 次 AI 请求，前端限制同时提交，服务端拦截相同请求标识的重发两分钟。实例间不共享计数。搜索最多等待 8 秒，模型单次最多 40 秒，服务端整条链路限时 52 秒，Vercel 函数上限 60 秒。上游明确返回 429 且退避时间合适时会重试一次。案例引用校验失败时，可在同一时限内用已核验资料重新生成一次。网络中断和超时后不会自动重发可能已计费的请求。服务端错误日志只记录功能、错误类别和状态码。

现场复测可在 `/explore` 提问“什么是冬至？”，再追问“它与夏至有什么区别？”。要验证真实检索，可问“请联网查香港天文台在哪里公布二十四节气时刻，并给出来源”，打开回答下方的原文链接核对。在 `/studio` 选择节气和版式后点击“生成灵感”，可从返回结果选用标题或短句。

当前只传最近5轮历史与新问题，单次问题最多1000个UTF-16字符单元。聊天内容不写入数据库。

## 安全保存

改造前没有 Git 仓库。2026-10-28 已将30个源码、配置、测试与资源文件备份到：
D:\projects\backups\shixu-demo-pre-v2-20261028\shixu-demo-pre-v2.zip

备份已解压并逐文件核对SHA256，不含.env文件、node_modules或构建缓存。
恢复应先解压到新文件夹，安装锁定依赖，并自行沿用安全保存的环境配置。
项目已建立 Git 基线，并托管于 [qzqoxygen/shixu-ai](https://github.com/qzqoxygen/shixu-ai)。现有 .gitignore 已排除 .env*；后续修改应通过版本记录追踪，备份文件仍独立保留。

## 资料来源

- [UNESCO 二十四节气介绍](https://ich.unesco.org/en/RL/00647)
- [香港天文台：二十四节气](https://www.hko.gov.hk/tc/gts/time/24solarterms.htm)

文化案例后续应独立记录地区、出处、链接、整理日期和授权信息；基础知识、模型回答与授权素材应明确区分。
