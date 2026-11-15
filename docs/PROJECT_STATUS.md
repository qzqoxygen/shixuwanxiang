# 时序 AI 项目现状与开发记忆

最后核对：2026-11-15（Asia/Shanghai）。本文件记录实际实现及验证边界，不是功能规划书或代码审查报告。后续重要功能变化应同步更新本文件。

## 1. 核对基线与阅读方法

- 项目：时序万象·AI / 时序 AI（ShiXu AI），传智杯 AI 赛道的节气文化探索与创作作品；当前重点是可运行的文化体验和比赛演示，不要求商业化系统。
- 仓库：`qzqoxygen/shixu-ai`；本地 `D:\projects\shixu-ai`。
- 最新 main 基线为 `f5d561c`（2026-11-15，已 fetch 核对）；PR #15 Agent 补全已合并（`cb00050`），PR #16 节气探访也已合并。当前赛前 AI 升级分支为 `feat/ai-evidence-evaluation-20261115`，基于最新 main 新建，未重做既有六工具。最终提交见 Git 记录。
- PR #7 文化补采已经合并（`5761e34`），不能再使用旧报告的“PR #7 尚未合并”作为当前结论。
- 后续已合并：PR #8 首页更新；PR #9 案例工具查询、地图定位与制卡（`65b4c03`）；PR #10–12 界面/光标/布局调整；PR #13 全 24 节气导读（`a0f5fd7`）；PR #14 首页过渡和造物编辑（`1230e41`）。
- 证据优先顺序：当前代码和运行数据 → 对应提交上实际执行的检查 → 有日期的历史报告 → README 与协议草案。历史文档用于追溯，不能直接当作当前产品功能表。

状态含义：**已完成**表示本地实际入口与实现存在，仍需看验证列；**部分完成**表示只落地其中一部分；**尚未实现**表示当前没有实际产品链路；**存在但尚未验证**表示已有实现/配置，但相应真实运行或部署证据不足。以下状态不自动表示已部署公网。

最初功能盘点与同日 Agent 补全的证据保留在第8、10节；当前赛前升级结果见第11节和 [AI 技术与评测说明](AI_TECHNICAL_EVALUATION_2026-11-15.md)。接口兼容见 [Agent V1 联调](integration/agent-v1.md)。不自动合并或部署，77 条 verified 与 2 条 pending、密钥、模型配置及部署配置保持原样。

## 2. 技术架构与目录

当前 `package.json`：Next.js **16.4.3**、React **19.3.0**、TypeScript `^5`、OpenAI SDK `^7.44.0`、Zod **4.6.7**、Tailwind CSS 4 工具链。具体依赖解析以 `package-lock.json` 为准。测试依赖 Node >=22.15 的模块钩子；项目部署使用 Node 24。

根目录直接放置 `app/`、`components/`、`lib/`，没有 `src/`。App Router 服务端页面与客户端交互组件混合使用；`next.config.ts` 开启 Cache Components、partialPrefetching，CSS 通过现有 Turbopack/Tailwind 加载器处理。页面主要使用独立 CSS，不要按纯 Tailwind 项目重写。

| 目录/文件 | 作用 |
| --- | --- |
| `app/` | 六个用户页面、布局、全局/页面样式和七条 API 路由，含节气探访及个人记忆卡 |
| `app/home/` | 四季窗景、四个近景池塘、共享水波、首页图文栏目 |
| `components/seasons/` | 册页、目录、高清照片、风物导读、插画与手势 |
| `components/cultural-map/` | 服务端 SVG 地图、共享选择状态、案例列表/详情和请求生命周期 |
| `components/ChatPanel.tsx`、`FloatingChat.tsx` | 知时页云朵聊天、案例引用卡和手动地图定位 |
| `lib/` | 节气/省份/照片/手记/导读资料、客户端查询、书册状态机、造物草稿与文字校验 |
| `lib/contracts/cultural-case.ts`、`chat-api.ts` | 客户端与服务端共用 Zod schema、案例/聊天V1、地图白名单与工具事件类型 |
| `lib/server/` | DeepSeek、联网搜索、限流去重、本地案例查询/检索/工具/引用校验 |
| `data/cultural-cases/` | 统一案例实体库及编辑主选台账 |
| `data/maps/` | 保留原始省级 GeoJSON 和来源说明 |
| `public/` | 本地照片、首页图像、字体、宣纸、装饰和贴纸资源/来源记录 |
| `scripts/` | 离线资料提取、审核导入、来源可访问性检查与公网检查工具 |
| `tests/` | Node 自动测试，以及显式执行的真实 HTTP、浏览器和 AI 检查脚本 |
| `docs/`、`deploy/` | 协议草案、资料审核链、历史设计/验收、平台说明与服务器模板 |

没有数据库、独立后端微服务、向量数据库或用户账号服务。已实现的状态主要是 React 内存状态；造物草稿单独保存在当前浏览器 localStorage。

## 3. 页面与功能盘点

### 3.1 首页、导航和关于

| 功能 | 状态 | 实际实现与文件 | 验证边界 |
| --- | --- | --- | --- |
| 六页导航、当前页高亮、跳至正文、页脚和中文元信息 | 已完成 | `app/layout.tsx`、`components/SiteHeader.tsx`；`/`、`/seasons`、`/explore`、`/studio`、`/visit`、`/about` | 本轮六页HTTP及视口回归通过；不代表所有装饰细节/无障碍专项已验收 |
| 四季窗景切换 | 已完成 | `app/page.tsx` → `app/home/SpringScene.tsx`；`garden-seasons.ts` 定义四季，图片 decode 后再切换，序号防止旧加载覆盖新选择 | 代码已核对；旧浏览器记录只适用于各自提交 |
| 走近/退回窗前、鼠标/笔视差、放大镜光标、Escape 返回 | 已完成 | `SpringScene.tsx` 和 `spring-home.css`，近景状态与键盘按钮；光标 SVG 是本地资源 | 有 11-14 历史视口/键盘记录；当前 HEAD 未重新浏览器实测 |
| 四季池塘装饰 | 已完成 | `SpringPond` 花瓣/燕子，`SummerPond` 荷花/蜻蜓，`AutumnPond` 落叶，`WinterPond` 雪/花瓣；`use-pond-water.ts` Canvas 行扰动与水域蒙版，离屏/隐藏/减少动效时停止水波 | 是本地装饰，不是实时天气、3D 场景或模型生成；本轮未量测帧率 |
| 节气科普、四季图文和三个主要模块入口 | 已完成 | `HomeEditorial.tsx`、`HomeEditorialMotion.tsx`、`editorial-photos.ts`；静态精选内容和带节气/省份参数的链接，IntersectionObserver 滚动呈现 | 当前首页不是动态列出 77 条案例或实时总数的页面；不能套用旧首页选择器 |
| 关于、案例覆盖统计、资料与影像鸣谢 | 已完成 | `app/about/page.tsx` 从 verified 数据计算总数/覆盖节气；展示 UNESCO、天文台及首页图像出处 | 数据统计已重算；外部网页/授权现况未在本轮重新核验 |

### 3.2 二十四节气与四时探索

| 功能 | 状态 | 实际实现与文件 | 验证边界 |
| --- | --- | --- | --- |
| 24 个稳定节气 ID、四季各六节气、黄经与基础说明 | 已完成 | `lib/solar-terms.ts`；顺序从立春到大寒，黄经每 15° 推进；`solar-term-notes.ts` 提供逐节气手记 | 现有数据测试通过；没有按实时天文计算自动求交节时刻 |
| 桌面对开书、窄屏纵向阅读与横滑切换 | 已完成 | `SolarTermsExplorer.tsx`、`BookPages.tsx`、`useBookSwipe.ts`、`book-swipe.ts` 及 `app/seasons/*.css` | 手势、翻书状态机测试本次通过；真机手势未在本轮复验 |
| 目录跳转、前后页、方向键、Home/End、连续输入与异常恢复 | 已完成 | `BookDirectory.tsx`；`book-navigation.ts` 保持单张活动纸和最新待到目标；`book-turn-animation.ts` 管理序号、Web Animations、超时恢复及卸载 | 自动测试覆盖全部 24×24 目录目标；历史浏览器记录见第 8 节 |
| 动效暂停、减少动态、页面隐藏/尺寸改变恢复 | 已完成 | `SolarTermsExplorer.tsx`、`SeasonVignette.tsx`、书页样式；桌面翻转与手机横移分别处理 | 有自动恢复测试；未声称所有设备性能一致 |
| 24 张高清实拍、图注、许可与原文 | 已完成 | `solar-term-photos.ts`、`public/images/solar-terms/`、`SOURCES.md`；每张 1920×1440 WebP、4:3、可打开大图；加载/失败提示 | 素材与映射存在；照片是意象，不是对应节气当天实况 |
| 逐节气预置风物导读，两种讲法 | 已完成 | `lib/season-guides.ts` 的 24 组 `brief`/`children`，每种两段；每节气绑定一则 verified 案例。`app/seasons/page.tsx` 提供原文链接 | 全 24 组和关联来源测试通过。首次显示的是静态预置文本，不是每次实时调用 AI |
| “AI 再讲一点”、查看补充、返回开头、换个话题 | 已完成 | `PhotoGuide.tsx` → `POST /api/seasons/guide`；保留已有导读，按所选讲法/主题生成并滚动到补充段落 | 模拟服务测试和构建通过；当前版本的真实 DeepSeek 导读调用本轮未执行，属存在但尚未验证的运行环节 |
| 四时到地图、非遗专题与照片源跳转 | 已完成 | `BookPages.tsx` 将当前 term 带到 `/explore`；照片来源和文化专题各自独立 | 路由代码存在；旧报告链接/选择器未必适合最新 UI |
| 四时直接展开该节气全部案例 | 部分完成（当前未启用） | `SeasonalCases.tsx`/`.css` 仍在仓库，但当前 `SolarTermsExplorer.tsx` **不再导入或挂载它** | 不是当前开放的页面功能；所有案例在知时地图查询。没有恢复或删除该组件 |

### 3.3 中国文化地图与手动案例探索

| 功能 | 状态 | 实际实现与文件 | 验证边界 |
| --- | --- | --- | --- |
| 34 省级真实边界及南海诸岛附图 | 已完成 | `ChinaProvinceMap.tsx` 服务端读取 `china-provinces.geo.json`，`map-projection.ts` 投影及路径转换；原始坐标不变，拥挤标签用引线调整 | 几何/编码/闭合路径测试通过。不是地图 SDK 在线服务 |
| 悬浮/焦点浮起、点击与键盘选择、全国列表、地图放大 | 已完成 | `ProvinceInteraction.tsx`、`MapViewport.tsx`；固定命中区与视觉层分离；Enter/空格选择、Escape 取消；放大后滚动浏览 | 放大不是通用连续缩放/拖拽 GIS；本轮未新做真实浏览器检查 |
| 24 节气筛选、分省查询、每省案例数量与匹配浮起 | 已完成 | `SolarTermFilter`、`useProvinceCases.ts`；全分页抓取所选节气案例再聚合计数，包含关联省份 | 查询、聚合、切换/取消请求测试通过；悬浮不发起案例查询 |
| 案例列表、每页 6 条、详情、全部来源与缺省图片 | 已完成 | `CulturalCaseExplorer.tsx`、`CulturalCaseContent.tsx`、`useCaseRequest.ts`；15 秒超时、取消、重试、骨架和空结果；跨省筛选保持当前关联省 | 公共数据/接口测试通过，未生成占位案例或图片 |
| URL 初始节气/省份与选择联动 | 已完成 | `app/explore/page.tsx` 验证参数；`explore-selection.ts` reducer：节气切换清地区/页码/详情，地区切换清页码/详情；Suspense 支持动态参数 | URL 只负责初始条件，后续选择不是跨页永久存储 |
| AI 回答案例卡定位地图并打开详情 | 已完成 | `ChatPanel` → `FloatingChat.showOnMap` → 同一 `ProvinceInteraction` 的 `locate` action；设置 term/province/case，收起聊天并转移焦点 | 是用户点击后的真实联动；不等于模型直接执行任意地图指令 |
| 从详情/聊天案例卡进入造物 | 已完成 | `studioCaseHref()` 生成 `/studio?caseId=...&solarTermId=...`，服务端再次校验案例状态及节气匹配 | 参数和限定案例生成测试通过；有 11-14 历史真实链路记录 |
| 省内纸雕、单独水墨地图装饰组件 | 部分完成 | `PaperLandscape.tsx` 有条件渲染，但当前 `provinceViews` 未提供 `scenery`；`components/cultural-map/InkLandscape.tsx` 未见现行入口引用 | 作为保留组件记录，不当作已启用省内景观或 WebGL 地图功能 |

### 3.4 云间问四时 / 知时问答

| 功能 | 状态 | 实际实现与文件 | 验证边界 |
| --- | --- | --- | --- |
| DeepSeek 节气知识问答与多轮历史 | 已完成 | `POST /api/chat`、`lib/ai-agent.ts`、`lib/chat.ts`；服务端提示词区分天文、地域和民俗，当前非流式完整 JSON；最近 5 轮历史加新问题 | 本轮真实模型、失败及复测结果见第11节；不保证所有未来回答选同一工具组合 |
| 输入限制、推荐问题、取消、超时、错误与清空 | 已完成 | `ChatPanel.tsx`；问题最多 1000 UTF-16 单元，回答最多 8000，Enter/Shift+Enter 与中文输入处理；失败保留问题，回答长度截断有提示 | 只保留内存会话，刷新/离开导致卸载会清空；没有云端会话存储 |
| 可开关、拖动、复位、键盘移动的云朵助手 | 已完成 | `FloatingChat.tsx`/`.css`；鼠标/触屏、移动阈值、屏幕边界、焦点返回、Esc 收起；仅在知时地图页挂载 | 收起用 hidden 而非卸载，保留当前草稿/对话/请求；位置不是持久化账户设置 |
| 模型自主查询本地已核验案例 | 已完成 | `chat-case-tool.ts` 保留旧查询工具，V1 注册六个工具；search 兼容 query 并支持节气/省份/类别/关键词/分页；累计去重、稳定引用编号、最多6则 | 模型自主选择，服务端真实执行；规则检索不是向量 RAG |
| 多地区对比、追问、无匹配与引用卡 | 已完成 | `cultural-retrieval.ts`、`cultural-aliases.ts` 实现中文分词/别名/联合约束/加权排序/多省公平取用；兼容 `retrieveChatCases`；`ChatPanel` 展示实际案例卡 | 92个人工标注正样本及7空结果通过；不把助手先前说法当证据，不称向量RAG或保证任意语义检索 |
| 本地与联网引用校验及恢复 | 已完成 | `culturalAnswerSources()` 验证 `[案例N]` 并附真实本地 URL；`attachSearchSources()` 验证 `[N]` 并附本轮搜索 URL；无效本地引用可在同一总时限内重新生成一次 | 引用格式/编号校验不是逐句事实证明；错误与来源不足仍需人工判断 |
| 实时信息自动搜索与失败降级 | 已完成 | `web-search.ts` 规则判断时间敏感/显式检索/追问，后端先搜索再调用模型；搜索失败标记未核实时讯，允许稳定背景问答 | 有隔离测试及历史真实搜索证据；不表示服务在所有网络持续可用 |
| 聊天 V1 核心及地图工具 | 已完成 | `chat-api.ts`、`chat-protocol.ts`、chat route：version/context/mapActions/toolEvents/references；show/highlight/open工具生成可验证操作，增加节气信息和多地区比较工具 | 与旧草案存在有意兼容扩展：V1也保留answer别名，旧模式继续既有案例查询；保留非流式响应 |
| 工具事件、地区对照与地图批次入口 | 已完成 | `ChatPanel.tsx` 展示实际成功/失败事件、按省份分组的案例及来源；`chat-map-client.ts`、`map-actions.ts`核验完整批次，再通过共享地图一次更新 | 请求中仅显示通用处理状态；响应后显示实际事件，不伪造中途调用进度 |
| 高亮、详情与过期操作保护 | 已完成 | 白名单SET_SOLAR_TERM/HIGHLIGHT_PROVINCES/OPEN_CULTURAL_CASE，provider维护revision；客户端抓取真实案例验证后再原子应用，手动变更/清空会话使旧批次失效 | 任一工具失败不返回地图批次；用户通过明显按钮确认应用，仍保留单案例卡和制卡入口 |
| 回答依据、引用关联与检索诊断 | 已完成 | `answer-evidence.ts` 校验canonical字段/真实来源/编号与有限明确矛盾；`AnswerEvidence.tsx` 区分本地、实时、模型解释及不足；V1 `includeEvidence:true` 可选返回 | 不是逐句历史事实证明；`statementTruth:false`；旧客户端不新增字段。非法内容最多受限修复一次 |
| 只读工具复用 | 已完成 | `ai-agent.ts` 同请求按工具名+规范化参数复用成功的search/compare/term结果，事件标记reused | 失败不缓存、地图不缓存、不同请求不共享；UI不将复用标为再次执行成功 |

### 3.5 造物工坊与 AI 灵感

| 功能 | 状态 | 实际实现与文件 | 验证边界 |
| --- | --- | --- | --- |
| 24 节气、4 模板、3 配色、5 边框/纹理选项 | 已完成 | `StudioWorkbench.tsx`、`studio-draft.ts`、`studio.css`；风物笺/留白笺 4:5，书签 1:3，画报 3:4；编辑分节气版式、文字、样式、贴纸四个页签 | 代码与构建确认；最新页签 UI 本轮未视觉复测 |
| 标题/短句编辑、实时预览 | 已完成 | 标题最多 12、短句最多 56 UTF-16 单元；标题长度分档；React 状态驱动画布 | 样例文案是编辑默认值，不用于替代 AI 失败响应 |
| 30 张本地贴纸、分类、位置/大小/旋转/镜像/复制/删除 | 已完成 | `public/images/studio-stickers/manifest.json`，四季及亭桥园居/山水/飞鸟游鱼七类；Pointer Events、边界约束、四角手柄、方向键与删除键 | 贴纸是预制素材；无运行时 AI 生图、用户图片上传或自由绘画工具 |
| 可移动、缩放、旋转的农历日期 | 已完成 | `studio-lunar-dates.ts`、`StudioWorkbench.tsx` 日期层；**固定 2026 年**节气对应农历日期 | 非通用万年历，未实现跨年自动计算 |
| 本地草稿自动保存/恢复 | 已完成 | `use-studio-draft.ts`、`parseStudioDraft()`；localStorage `shixu.studio.draft.v1`，240ms 延迟保存，离页/隐藏 flush，异常数据回退 | 草稿序列化/坏数据测试通过；单浏览器单草稿，不是云端作品库/撤销重做系统 |
| PNG 导出 | 已完成 | `export-poster.ts` 等字体/素材就绪，捕获可见文字与变换，在 Canvas 重绘纸纹、边框、贴纸和日期；长边 1800px，浏览器下载 | 实现存在并构建通过；本次未在真实浏览器重新生成及检查导出文件 |
| DeepSeek 生成并选用标题/短句 | 已完成 | `StudioInspiration.tsx` → `/api/studio/inspiration`，JSON 模式，校验后最多 3 组，点击分别应用；来源可展开 | 本次隔离测试通过，历史有真实 UI/API 成功；失败仍允许手动创作 |
| 结合所选节气的真实案例生成 | 已完成 | 无 caseId 时从统一 verified 库读取该节气案例；响应附 `references`、地域、所有来源及访问备注 | 不把原创短句当作历史引文 |
| 从知时带入指定案例并保护原草稿 | 已完成 | `app/studio/page.tsx` 校验 seed；案例与旧草稿节气不同则让用户选择切换/继续，不抹去文字贴纸；有选定案例时服务端只取该案例 | 同节气匹配、pending/错误 caseId 拒绝及提示词范围有测试；seed 不是永久持久化的作品来源库 |

### 3.6 设计、响应式与可访问性

整体已完成当前中国风视觉实现：宣纸、青绿/石青、淡金/茶褐、本地毛笔字子集、册页与园林窗景。`DESIGN.md`、`app/globals.css`、各页面 CSS 及组件 CSS 提供实际规则，手机与桌面分别排版。`InkLandscape.tsx` 为雾层装饰；不要把历史设计文档中的 WebGL/水墨实验写成当前运行架构。

代码已实现导航和控件焦点、skip-link、ARIA 状态、地图键盘选择、书页/造物键盘控制、触屏分支、减少动态偏好和局部动画暂停。本轮仅添加紧凑可展开依据面板，已检查桌面/手机视口；全站无障碍专项、实体手机和所有系统组合性能仍**存在但尚未验证**。

### 3.7 节气探访（main已合并成果，本轮保留）

`app/visit/page.tsx`、`VisitDesk.tsx`、`visit-session.ts` 提供省份/市县/节气选择、示例、查询结果与当前浏览器session恢复。`/api/visit` 优先查询verified；无本地资料时执行官方Search，逐字摘要与地区/节气校验后区分地方记录、线索或无结果，不把线索升级为已核验案例。真实联网创作种子有服务端proof验证；本地案例、地图、造物及返回探访链接相连。`/api/visit/memory` 将用户个人经历生成一组记忆卡，提示词不把个人记忆当地方通行传统。状态为**已完成的本地实现**，原有测试随本轮全量回归；本轮只检查页面可打开/无溢出，未另发真实探访与记忆生成请求。

## 4. 数据、API 与运行链路

### 4.1 数据真实数量与维护方式

当前 JSON 有 **99 个实体（97 条已核验、2 条待核验）**，覆盖全部 24 个节气和 34 个省级地区（含明确关联省份）。全国数量按唯一 case ID 统计。

| 春季节气 | 数量 | 夏季节气 | 数量 | 秋季节气 | 数量 | 冬季节气 | 数量 |
| --- | ---: | --- | ---: | --- | ---: | --- | ---: |
| 立春 | 5 | 立夏 | 3 | 立秋 | 3 | 立冬 | 3 |
| 雨水 | 3 | 小满 | 3 | 处暑 | 3 | 小雪 | 4 |
| 惊蛰 | 3 | 芒种 | 4 | 白露 | 4 | 大雪 | 3 |
| 春分 | 4 | 夏至 | 5 | 秋分 | 8 | 冬至 | 9 |
| 清明 | 5 | 小暑 | 3 | 寒露 | 3 | 小寒 | 4 |
| 谷雨 | 6 | 大暑 | 3 | 霜降 | 3 | 大寒 | 3 |

- `cases.json` 是运行数据；`primary.json` 是 24 条主选编辑映射，不限制展示为每节气一条，也不等于当前导读必选同一案例。
- `huangling-flower-buns`（黄陵面花）与 `xinzheng-jujube-harvest`（新郑大枣）仍 pending，原因是节气关联依据不足；不进公开 API、聊天或创意上下文。
- 当前案例全部省略 `imageUrl`。24 张节气照片与 30 张创作贴纸是独立资源，不代表已取得文化案例图片授权。
- 每条实体保留标题、节气、六位省码、省名、地区、类别、简介、节气关联、来源及审核状态。跨省区域用 `relatedProvinceCodes`，不新增虚构市县/坐标；7 条案例带 `sources[].accessNote`，保留网站访问限制。
- `docs/cultural-sources/` 含 11-03、11-06 和 11-12 批次原始档案、完整 Excel 单元格快照、review 决策、manifest 和逐行报告。补采从 44 增至 77，三条遗漏补回、绍兴同俗合并、两条待核验隐藏；旧 ID 保持稳定。
- 11-15 省级覆盖补采以提交 `1fc438c` 为基线。[本批核对记录](cultural-sources/2026-11-15/reviewed-cases.json) 收录 20 条案例。其中 15 条补齐此前未覆盖的地区，5 条补充春分竖蛋、清明放板鹞、夏至锅边糊、白露茶和天坛冬至祭天。案例沿用列表、详情、AI 工具和造物的共享数据。知时案例详情可带同一地区和节气跳转至节气探访。
- 首批四地补采的本地验收通过 143 项测试、Lint、生产构建与导入复现检查。Edge 桌面和 393 px 视口验证了四条案例的筛选、出处、探访、地图与造物往返；真实 DeepSeek 查询验证云南与山东谷雨对比、地图高亮及开秧门案例打开，造物生成短句并导出 PNG。
- 后续五地补采复验通过 143 项测试、Lint、生产构建与导入复现检查。浏览器核对五条案例的出处与往返路径，包括知时直接进入造物后再去探访时预选案例地区和节气。真实 DeepSeek 验证辽宁与青海的秋分对比、地图高亮、打开盘锦丰收节案例、生成制卡短句及 PNG 导出。关于页与案例 API 均显示 86 条。
- 全省级覆盖验收通过 143 项测试、Lint、生产构建和导入复现检查。桌面与 393 px 视口逐条核对 20 条补采案例的地图筛选、来源入口、造物引用和探访预选。真实 DeepSeek 比较北京与福建夏至饮食，给出案例引用、高亮两地并打开福州锅边糊案例。
- `extract-case-workbook.py` 使用 openpyxl 离线读取（不是运行依赖）；`import-cultural-cases.mjs` 依据工作簿审核记录与省级补采合成并校验，支持预览、`--check`、`--write`，写入采用临时文件替换。`check-case-sources.py` 检查来源访问情况，不会自动将 HTTP 200 变成事实核实。
- 佛山大寒糯米饭来源维护页、资兴原站防护及其他受限旧链接的边界见批次 README/source-checks；本轮未重新访问全部外链，不能说所有来源均已恢复或全部事实重新复核。

### 4.2 全部 API 清单

当前七条 API 路由均服务端执行；本次生产构建标记为 `ƒ` 动态函数。默认 Node.js 运行时，未设置为 Edge，也没有浏览器直连 DeepSeek。

| 方法与路径 | 状态 | 参数与返回 | 主要文件 |
| --- | --- | --- | --- |
| `GET /api/cultural-cases` | 已完成 | `solarTermId`、`provinceCode`、`category`、`keyword` 取交集；按 ID ASCII 升序；offset 默认 0、limit 默认 10/最大20；返回 `{version:"1.0",items,total,offset,limit}` | 列表 route、schema、`cultural-case-query.ts` |
| `GET /api/cultural-cases/[caseId]` | 已完成 | 合法 ID 对应 verified 才返回 `{version:"1.0",item}`；不存在/pending 404，非法输入400，内部错误500 | 详情 route、`cultural-case-response.ts` |
| `POST /api/chat` | 已完成 | 旧模式不变；V1严格校验version/messages/context，可选includeEvidence；返回原有字段，显式依据模式再返回evidence/retrievalDiagnostics及可选reused事件 | chat route、`chat-protocol.ts`、`chat-api.ts`、六工具及搜索 |
| `POST /api/studio/inspiration` | 已完成 | URL `term`、`format`、可选 `caseId`；返回 `{suggestions,references}`；错误 `{code,error}` | studio route、`studio-inspiration.ts` |
| `POST /api/seasons/guide` | 已完成 | URL `term`、`mode=brief/children`、可选 `previous` 主题；返回 `{guide,topic}`；错误 `{error}` | guide route、`season-guides.ts` |
| `POST /api/visit` | 已完成 | 校验省份/节气/可选area；返回local/web/lead/none，严格区分归档案例与本轮线索，失败降级 | visit route、`solar-visit.ts` |
| `POST /api/visit/memory` | 已完成 | 校验节气及用户记忆；生成一组标题/短句，不将个人记忆认证为公共民俗 | visit memory route、`solar-visit.ts` |

案例 API 严格拒绝未知/重复/非法参数；keyword 对标题、地区、简介和关联依据做字面大小写不敏感匹配。无结果正常返回空数组。数据通过共享 Zod schema 校验，客户端也校验响应和当前筛选，过期请求不能覆盖新选择。所有 API 响应配置 no-store；案例 API 完全独立于模型和密钥。地图 UI 尚无独立的关键词/类别搜索框，不能因 API 支持就写成界面已开放。

### 4.3 跨模块数据流

```text
素材 Excel → 离线 intake + review → import 校验 → cases.json
                                            ├→ 只读案例 API → 地图/列表/详情
                                            ├→ 服务端案例检索工具 → DeepSeek → 聊天案例卡
                                            │                              ├→ 用户点地图定位
                                            │                              └→ 用户点做节气卡
                                            ├→ Studio 按节气/指定案例生成 → 文案与参考来源
                                            └→ 四时预置导读的案例原文/关于页动态数量

实时问题 → 服务端 Search → 过滤/排序的本轮摘要 → DeepSeek → 校验编号 → 来源链接
普通问题 → DeepSeek；需要地方文化时由模型调用本地案例工具
搜索失败 → 明确未核实时讯 → 允许稳定背景问答

造物状态 → localStorage 草稿；可见作品 → 浏览器 Canvas → PNG 下载
```

## 5. AI 实现细节与安全边界

- 问答、造物、四时补充导读和节气探访/个人记忆共用 `lib/server/deepseek.ts`，配置 **`deepseek-flash`**、Base URL **`https://api.deepseek.com`**，实际聊天端点 `/chat/completions`。本轮真实问答/造物/官方Search均有运行证据；不自动延伸为导读/探访也完成真实联调。
- 使用服务端 `process.env.DEEPSEEK_API_KEY`，关闭思考模式、`stream:false`；造物与导读使用 JSON 输出模式。当前没有 SSE/逐字流式显示，也没有 OpenRouter/NVIDIA/Tavily 运行调用。
- 联网是 `web-search.ts` 后端真实请求 **`POST https://api.deepseek.com/v1/tools/search`**，同一密钥；最多请求8条、过滤去重并优先权威来源后保留5条摘要，不是让模型自行假装联网。指定天文台/气象局时约束域名；搜索 query 保留当前问题及相关追问，最多128个 Unicode 字符。
- 没有独立 Fetch 全文抓取或向量检索。搜索摘要、本地文化档案、静态科普、模型原创回答与预制素材应分别描述；“基于多模态智能体”的产品介绍不等于已接通多模态模型、AI 生图或语音。
- 工具循环最多2轮执行、每轮最多4次工具调用，末轮要求结束；最多8个真实事件，跨轮重复ID拒绝。每工具最多5秒、输出最多100000 UTF-8字节，服从整链路取消；未知工具/错误参数有具体脱敏错误。引用编号稳定，仅使用实际返回的案例/搜索来源；修复仍无引用时拒绝成功，修复成功保留原事件与地图批次。修复可能额外调用一次生成，不应承诺每问题仅计费一次。
- 共用52秒整链路 AbortSignal；SDK 单次40秒、禁止 SDK 自动重试；仅明确429且等待不长于2秒可额外重试一次，网络断开或超时不自动重发。AI 路由 `maxDuration=60`。导读对重复/非法输出最多换主题再生成一次，沿用同一总时限。
- `ai-access.ts` 对访客每分钟最多12次 AI 受理，三个 scope 使用同一实例计数；Idempotency-Key 防重两分钟，无标识兼容旧客户端时用内容哈希防并发重发。是热实例内存保护，不是分布式全局限流或绝对防计费保证。
- Netlify 仅在 `SHIXU_TRUST_NETLIFY=1` 时使用平台 `x-nf-client-connection-ip`；Vercel 或显式可信反代使用转发头。自建服务默认不能任意信任客户端 IP 头。缓存和限流不持久化用户对话。
- 区分密钥401、余额402、429、超时504、取消408、网络/上游故障等错误；日志仅 scope/code/status。客户端负责单请求锁、取消、等待上限和真实错误反馈。
- `.env.local`、云平台本地缓存/账号文件受 Git 忽略；`.env.example` 只有空的密钥占位。不要在记忆、日志、文档、截图或提交里记录真实密钥。模板注释仍有旧 Vercel 文字，不代表当前优先部署路线被改回。

## 6. 部署与公网状态

| 能力 | 状态 | 当前证据/限制 |
| --- | --- | --- |
| Netlify 动态部署适配 | 已完成 | `netlify.toml` 指定 `npm run build`、`.next`、Node24；官方 OpenNext 适配器处理 SSR/API。不是静态导出 |
| Netlify 既有站点 | 部分完成 | `deploy/netlify.md` 记录 `https://qsxshixu-ai.netlify.app` 和站点 `51b22dd9-7d6d-4f65-afda-7bacfaa9ae72`；11-11有真实部署/AI/浏览器证据，但大陆稳定性仅部分通过 |
| 当前 HEAD 已部署公网 | 存在但尚未验证 | 本轮没有访问云端管理 API、重新发布或核对部署提交。11-14界面报告还提到 `https://shixu-ai-qzqoxygen.netlify.app/`，但明确不证明该分支已部署；实际使用域名/站点映射待发布时核实 |
| Vercel 备用 | 存在但尚未验证 | `https://qsxshixu-ai.vercel.app` 保留历史备用记录；本轮未确认当前可用性及发布版本，不删除云项目 |
| Docker/自建服务器切换 | 存在但尚未验证 | `Dockerfile`、`compose.yaml`、`deploy/Caddyfile`：Node24 standalone、多阶段非root运行、静态资源复制、健康检查、Caddy HTTPS/反代；当前版本未重新容器实测或部署 |
| 三运营商/真机无 VPN 稳定演示 | 部分完成 | 有11-11历史探针与浏览器记录，仍有连接重置；最新版本、真实手机/其他电脑与比赛现场网络未全面验收 |

Netlify 生产环境须独立配置 `DEEPSEEK_API_KEY`，Functions 范围可读，并设置可信 IP 开关；本地文件存在不证明生产已经正确配置。以前 CLI 部署曾出现 `--no-build` 遗漏静态资源，后续应按 `deploy/netlify.md` 使用一次完整 `deploy --prod --build --context production`。执行前核对实际站点和用户授权；本轮不执行发布。

11-11 报告针对业务提交 `449a5dc`、生产部署 `6af3b7826e30458aeab3107e`，当时是44条案例：真实公网两路 AI/联网成功、103次案例HTTP检查通过；三线首页移动20/20、联通20/20、电信19/20。Windows多资源直连220/240成功，只有8/20轮全部资源成功。旧结论不能证明77条案例、最新工具/导读和新首页都已公网上线，也不能当作大陆稳定性全面通过。

11-12曾确认站点未关联 Git 自动部署；这也是历史状态。本轮未重查云端关联，不能假定当前“推送/合并即自动部署”，也不能假定关联永远没有变化。

## 7. 未完成、保留但未启用与后续事项

| 项目 | 状态 | 后续开发应知道的边界 |
| --- | --- | --- |
| 完整协议后续扩展 | 部分完成 | V1核心/六工具及可选回答依据已落地；与历史草案的实际差异见第10、11节和联调文档。没有SSE实时工具流、任意脚本执行或服务端持久会话 |
| pending 两条、所有省份覆盖、案例配图 | 部分完成 | 缺少依据/授权需素材核查，不能用模型补齐；当前24节气已全覆盖，不需要再为覆盖任务造数据 |
| 所有来源长期可访问及逐条事实复核 | 部分完成 | 保留7条访问提示，部分维护页/防护未解决；核查访问状态和核查事实不是同一件事 |
| 最新真实问答/搜索/造物/导读与异常恢复联调 | 部分完成 | 本轮真实问答/比较/地图/造物/联网见第11节，失败与复测分别保留；导读、探访/记忆、公网Functions及真机仍未逐项真实复测 |
| 最新完整浏览器回归、导出成品、真机/弱网/无障碍专项 | 部分完成 | 本轮新的桌面/手机视口AI链路与六页检查见第11节；PNG成品、实体手机/弱网/无障碍专项未重验。旧 `cultural-cases-browser.mjs` 的历史选择器不能算作最新UI回归 |
| 静态首页与专题精选自动同步所有案例 | 尚未实现 | 首页是人工精选；关于和公开查询从统一集合派生。两者设计不同，不要把静态精选误认成另一个案例数据库 |
| AI 图片/语音/视觉理解、传统技艺模拟、完整多 Agent/MCP | 尚未实现 | 仓库有预制图像和艺术装饰，不代表产品实时拥有这些 AI 能力；不是本次建议新增的范围 |
| 数据库、管理后台、登录会员/支付、云端作品/聊天同步 | 尚未实现 | 当前不依赖这些能力；比赛展示阶段无须为了补“完整性”引入商业系统 |
| 连续 GIS 缩放/任意地图指令、向量 RAG、通用跨年历算、流式聊天 | 尚未实现 | 已有地图放大、规则检索、2026固定农历和非流式响应应准确保留 |
| 竞赛 PDF、5–8分钟视频、最终评审公网/访问权限验收 | 存在但尚未验证 | 本仓库本次未找到完整的最终提交物与验收证据；不把比赛背景文字当成交付完成 |

上述是状态记录，不授权修复、上线或扩大任务。本轮没有对这些差异进行修复。

## 8. 测试与证据账本

### 盘点阶段实际执行（2026-11-15，`8206664`，Agent补全前）

| 检查 | 结果 | 能证明什么 |
| --- | --- | --- |
| Git 状态、近期提交及 fetch origin main | 通过；当前 main 与 origin/main 一致，盘点前干净 | 当前本地代码基线，不能证明公网发布 |
| 当前 JSON 重算和代码核对 | 77 verified、2 pending、24节气、19省、0案例图、24照片、30贴纸 | 运行数据与实际代码入口存在 |
| `npm.cmd test` | **117通过、0失败、0跳过** | 既有自动测试覆盖的数据/状态/接口/隔离模拟逻辑 |
| `npm.cmd run lint` | **退出0** | 当前 ESLint 检查通过，不等于运行或视觉验收 |
| `npm.cmd run build` | **退出0，含TypeScript检查** | Next生产编译成功；5个API动态，explore/studio为部分预渲染，其余用户页静态预渲染 |
| 真实模型/搜索、浏览器/真机、云端发布与大陆网络 | **本轮未执行** | 保留为单独待验证项，没有用构建替代 |

`npm test` 使用 `tests/register-ts.mjs` 和项目 TypeScript 转译注册，不额外引入测试框架。测试中的假网络只用于隔离验证，生产路由没有模拟答案回退。

| 测试文件组 | 实际覆盖 |
| --- | --- |
| `solar-terms.test.mjs`、`map-projection.test.mjs` | 节气顺序/四季/黄经、34省编码和几何投影 |
| `book-turn.test.mjs`、`book-swipe.test.mjs` | 翻书队列/序号/恢复/取消、24×24目录、手势轴与阈值/点击保护 |
| `cultural-cases.test.mjs`、`cultural-case-import.test.mjs`、`cultural-case-supplement.test.mjs`、`cultural-case-regions.test.mjs` | schema、筛选排序分页、pending、来源/缺省图片、77条与稳定ID/导入可复现/跨省 |
| `explore-client.test.mjs` | 选择转换、请求/响应验证、全分页省份聚合、取消/失败不返回替代数据 |
| `chat-agent.test.mjs`、`deepseek.test.mjs`、`ai-access.test.mjs` | 消息校验、工具循环、SDK序列化/错误、重试/截止/取消、身份头、限流/防重 |
| `chat-search.test.mjs`、`cultural-case-context.test.mjs` | 自动实时检索与追问、来源筛选/引用/降级、本地标题/地域/多轮检索、真实工具执行及案例引用恢复 |
| `studio-draft.test.mjs`、`studio-inspiration.test.mjs` | 草稿往返/坏数据、JSON灵感校验、选定案例及未核验拒绝 |
| `season-guide.test.mjs` | 24节气两种讲法及来源、导读话题切换、参数/Origin、重复/无效输出拒绝 |

### 既有历史证据（不自动延伸到当前提交）

- 11-07：`docs/design/seasons-final-regression-2026-11-07.md`；24节气桌面来回翻页、目录/暂停/尺寸变化/照片失败，以及手机视口检查；不是实体手机。
- 11-11：`deploy/verification/netlify-summary-20261111.md` 及同目录 JSON；Netlify实际发布、AI、浏览器和三线探针，限制见第6节。
- 11-12：`docs/cultural-sources/2026-11-12/verification/` 与 `docs/integration/cultural-case-site-coverage-2026-11-12.md`；111测试、139真实案例HTTP请求、154次书页案例/160次地图详情、真实模型/搜索/造物。保留首轮超时/NETWORK_ERROR和后续复测成功；不表示当前版本从未失败。
- 11-14：`docs/design/ui-polish-2026-11-14.md`、`cursor-and-buttons-2026-11-14.md` 记录各自115测试及浏览器边界；后者包含真实“三门祭冬”回答→地图→造物与375px视口；本轮仅阅读报告并对照链路代码。

可选真实脚本：`tests/cultural-cases-http.mjs`（需运行服务）、`tests/cultural-cases-browser.mjs`（需现有Playwright，且选择器需对应页面版本）、`tests/cultural-cases-ai-live.mjs`、`scripts/check-public-ai.mjs`（会产生真实模型费用）、`scripts/check-public-access.py`（只读多轮网络）。真实脚本默认输出可能指向历史证据目录，后续执行须指定新的日期/输出，避免覆盖既有失败与验收记录。

## 9. 后续开发维护约定

1. 先读根 `AGENTS.md` 与本文件，确认用户本轮范围；核对当前分支/未提交变更/HEAD，再查具体实现。不要仅凭某个旧报告的“开发中”重复造功能。
2. 重要功能新增、修改、删除或不再挂载时，同步本文件的日期/核对提交、功能状态、文件入口、数据流与测试边界。文档应描述结果，不将规划目标标成已完成。
3. 保留六页（含探访）、中国风视觉、真实地图边界和34省、节气ID、文化案例稳定ID/来源/pending边界、模型自主查询与用户点击地图/制卡闭环、造物草稿与PNG导出。
4. 统一服务端 DeepSeek；密钥只记录变量名。保留搜索失败降级、输入校验、限流、防重复、有限重试及脱敏日志。不得因部署网络问题擅自更换服务商或伪造回答。
5. 数据变更维护 intake/review/manifest/运行集合，不绕过审核直接批量标 verified；无资料地区正常空结果。来源失效时记录访问限制并补证，不编造来源或擅自删除原始依据。
6. 保留同一 GitHub 仓库归属、Netlify、Vercel备用和通用服务器切换能力，不擅自删除云项目或改写 Git 历史；本地测试/合并/上传成功/公网服务可访问/大陆真机稳定分别记录。修改部署或发布前核实用户授权及实际站点。
7. 验证按改动风险选择既有测试；记录执行命令、日期、提交和结果。付费真实AI、浏览器、设备和网络专项分别说明，不写成 unit test 全覆盖。没有新改动或新问题无需反复跑相同检查。
8. 文档盘点任务只改必要文档，不自动提交、推送、建PR或部署；实施任务的提交/审核/发布流程以用户当次授权为准。

本文件是项目内共享记忆入口，不能保证任意新会话自动继承聊天历史；通过根 `AGENTS.md` 的阅读指引和持续更新来保持可维护性。

## 10. 同日 Agent 补全历史实施与验收（PR #15，已合并）

六个真实工具：`search_cultural_cases`、`show_cultural_map`、`highlight_regions`、`open_cultural_case`、`get_solar_term_info`、`compare_cultural_cases`。检索增加类别交集、简介/关联依据相关性、多地区轮流分配及显式追问继承；comparison返回真实分组和原始来源，空地区保留为空。

新文件入口：`lib/contracts/chat-api.ts`、`lib/server/chat-protocol.ts`、`lib/map-actions.ts`、`lib/chat-map-client.ts`；复用并增强现有agent、chat route、检索、ChatPanel和地图provider，未重建系统。`deepseek.ts`仅补充两个脱敏日志类别，模型/URL/超时/重试均未更换。

本轮最终 **137项测试全部通过，Lint与生产构建（含TypeScript）通过**。真实普通问答、多工具比较/地图/高亮/打开、饮食类别多轮追问和指定案例造物成功；桌面与393px手机视口实际操作通过，五页/书册/77案例与2pending保留，浏览器错误及资源失败均0。证据记录在 [Agent V1 联调](integration/agent-v1.md) 及 `docs/verification/agent-v1-2026-11-15/`。

最初真实复杂问题漏高亮，修正后通过；随后饮食追问因引用保护502，去除模型历史中的旧来源清单/编号并显式约束本轮引用后，定向复测200。首轮失败不覆盖。完整浏览器链路在最后引用收紧前通过，最后变更之后执行了全量测试/Lint/构建和失败追问定向实测。未重新实测实时联网、四时导读、实体手机及运营商线路。当前功能分支不是公网上线版本，未部署。
