# 时序万象·AI

二十四节气非遗文化探索平台的 V2 基础工程。当前开放节气资料、DeepSeek 文化问答、中国省级基础地图浏览和文化案例只读 API；案例前端联动、技艺交互和创意工坊尚未开发。

## 团队协作协议

[前后端技术约束与接口协议 V1.0](docs/contracts/v1.0.md) 是基于现有代码整理的下一阶段开发草案，待团队共同确认。文档包含旧聊天接口兼容规则、文化案例只读 API、四个业务工具、地图操作与状态同步规则、职责和验收清单。

协议中的 AI 地图操作联动和业务工具仍为待实现目标；当前通用工具注册表为空。地图已支持基础底图、窄屏地图优先显示、放大浏览、省份悬浮预览、点击/键盘/列表选定与取消选择，地图占桌面主体约四分之三。当前使用浅宣纸、青绿云带、少量金褐线条和本地毛笔标题字体；聊天区采用纸笺布局。左下角为淡青绿山水装饰，省份内不展示纸雕。选择状态仅在当前页面内存中，不调用 AI 或检索文化案例。协议中的基线状态保留其核对时点，当前进展以此处为准。

### 2026-11-03 文化案例后端交付

- 已实现：共享类型与 Zod 运行时校验、本地案例读取、`GET /api/cultural-cases` 组合筛选/分页及 `GET /api/cultural-cases/[caseId]` 详情与来源。接口独立于 DeepSeek，只返回 verified，空条件覆盖返回真实空结果。
- 首批资料：12 条整理为 7 条 verified、1 条 pending 和 4 条地域缺失草稿；全部省略未授权图片。原始资料快照、逐条依据和未入库原因见 [资料清单](docs/cultural-sources/README.md)。
- 前端可先接入 [共享类型与接口示例](docs/integration/cultural-cases.md)；本轮未改页面、样式、基础聊天、四个业务工具或聊天 V1 协议。

### 2026-11-02 前端阶段交接

- 已完成：34 个省级行政区地图及南海诸岛附图、省份浮起与选择、放大浏览、响应式排版、聊天界面和本地视觉素材。
- 尚未完成：知时页节气筛选、案例列表与详情、案例数据及只读 API、V1 聊天协议、四个文化业务工具与 AI 地图联动。
- 后端下一批交付：按协议实现案例共享类型、数据校验、`GET /api/cultural-cases` 与 `GET /api/cultural-cases/[caseId]`。先让手动探索可用，再注册业务工具；复用当前聊天服务和工具执行流程。
- 前端接续：将当前地图内部的省份选择状态提升到探索页的共享客户端组件，接入节气筛选、案例列表与详情，再迁移聊天 V1 协议。当前 ChatPanel 仍发送 `{ messages }`，读取 `{ answer, truncated }`，后端需保留兼容。
- 数据约定：节气 ID 复用 `lib/solar-terms.ts`，省份采用六位编码字符串；`100000_JD` 只用于海上界线，不能作为案例省份。正式数据只公开已核实记录，素材整理表尚未作为运行数据导入。

## 本地运行

保留本地 .env.local 中的 DEEPSEEK_API_KEY，密钥仅供服务端读取，不应提交到版本库。
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
测试网络为隔离模拟，仅用于校验 SDK 请求序列化和错误分支；产品代码调用真实 DeepSeek。
案例自动测试也不访问网络；对运行中服务的可选真实 HTTP 检查见 [联调说明](docs/integration/cultural-cases.md#检查与复现)。

## 结构与扩展

- app/：五个页面、公共布局、api/chat 和 api/cultural-cases 路由。没有 src/。
- components/SiteHeader.tsx：公共导航及当前页面状态。
- components/SolarTermsExplorer.tsx：24节气选择与基础信息。
- lib/solar-terms.ts：独立、稳定的节气 ID，预留 culturalCaseIds 关联字段；没有虚构文化案例。
- lib/contracts/cultural-case.ts、lib/provinces.ts：客户端可复用的案例 schema、请求/响应类型和 34 省级编码映射。
- lib/server/cultural-cases.ts、cultural-case-query.ts：本地集合校验及 verified 查询；运行数据单独位于 data/cultural-cases/cases.json，草稿不参与读取。
- components/ChatPanel.tsx：多轮聊天、加载、取消及错误提示。
- lib/ai-agent.ts：保留通用工具注册接口与有限轮次执行流程；当前注册表为空，API不发送tools。后续增加工具需要单独开发、校验和验收。
- app/explore/page.tsx：左侧聊天、右侧中国省级基础地图；手机端地图在上，聊天在下。
- components/cultural-map/：省界、地名、南海诸岛附图、缩放与省份浮起/选定；ProvinceInteraction.tsx 管理鼠标、触屏和键盘交互。PaperLandscape.tsx 为保留的装饰组件，目前未在省份中启用。尚无 AI 地图操作。
- app/explore/explore.css：知时页面的浅宣纸、青绿云带与金褐线条样式，桌面地图占主体约四分之三。地图内部保持浅宣纸；素材及生成说明见 [ARTWORK.md](public/images/ARTWORK.md)，字体许可见 [字体说明](public/fonts/README.md)。
- data/maps/：本地底图及来源说明，参见 [地图数据说明](data/maps/README.md)；仅用于学习交流原型。
- lib/map-projection.ts：无额外依赖的 SVG 投影与路径转换。
- tests/：案例校验/查询/API、节气数据、聊天、通用执行流程、错误处理，以及地图省级编码、投影和路径测试。

DeepSeek 配置保持 https://api.deepseek.com、deepseek-flash、thinking.type=disabled。
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
