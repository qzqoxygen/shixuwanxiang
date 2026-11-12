# 全站文化案例覆盖检查表

检查日期：2026-11-12。修改基线：最新 `main` 的 `482ac19`。范围由 `app`、`components`、`lib` 全目录搜索确认，关键词包括 `cultural`、`Cultural`、`案例`、`cases.json`、`primary.json`、`SOLAR_TERMS`、`solarTerm` 和 `isFeatured`。

所有正式案例以 `data/cultural-cases/cases.json` 为唯一运行数据源，由 `readCulturalCases()` 校验。公开查询及 AI 参考均排除 `pending`。`primary.json` 是素材主选台账，不是另一份展示用案例集合。Excel 原始行、整理状态、取舍理由和表间差异见[本批导入记录](../cultural-sources/2026-11-12/)。

## 页面、组件与数据来源

| 页面或入口 | 实际组件 / 模块 | 数据来源 | 本轮结果 | 验证方式 / 结果 |
| --- | --- | --- | --- | --- |
| 首页 `/` | `app/page.tsx` | 服务端 `readCulturalCases()` 的 verified 集合 | 删除仅四个重点节气的过时介绍；案例总数与覆盖节气数实时从同一运行集合推导，未写死 77；更新知时入口说明 | 定向 ESLint、TypeScript 检查通过；浏览器检查真实数量及手机溢出，结果见下方 |
| 四时 `/seasons` 节气书册 | `SolarTermsExplorer`、`BookPages`、`BookDirectory` | `SOLAR_TERMS`、`SOLAR_TERM_NOTES`、既有授权照片目录 | 保留全部 24 节气、原图、翻页、目录、动效和科普手记；“去知时”带入当前节气 | 浏览器按传统顺序切换全部 24 节气，并实际点击书页到地图链接 |
| 四时 `/seasons` 案例展开区 | 新增 `SeasonalCases` | `fetchSolarTermCases()` → 文化案例列表 API，读取全部分页 | 当前书页对应的全部 verified 案例可展开阅读；显示地区、完整介绍、关联依据、全部来源及来源访问备注，省份链接可进入地图 | 浏览器逐条对照运行数据的 ID、标题、完整介绍、地区和全部来源，桌面与手机模拟各一遍 |
| 知时 `/explore` 初始选择 | `app/explore/page.tsx`、`ChinaProvinceMap`、`ProvinceInteraction` | 校验后的 URL 节气 / 省份参数；其余维持原选择状态 | 来自书页的节气 / 省份正确带入；非法参数回到默认全部；使用 Suspense 兼容现有 Cache Components | 浏览器检查书页实际链接、有效组合参数与非法参数 |
| 中国省级地图与地区列表 | `ChinaProvinceMap`、`ProvinceLayers`、`ProvinceControls` | 原 GeoJSON + `useProvinceCases()` → 全分页 API 聚合 | 保留真实省级几何，不新增经纬度；跨省案例通过 `relatedProvinceCodes` 同时关联各省，不重复建立案例实体 | 浏览器对 24 节气逐项比对全部匹配省份、无障碍案例计数；跨省关联省份逐一打开详情 |
| 地图工具与地区反馈 | `MapViewport`、`useProvinceCases`、`ExploreMotion` | 同一选择状态及案例省份聚合 | 继续显示实际有案例地区数量；既有地图缩放、装饰动效和失败重试保留 | 浏览器检查匹配状态、资源与页面错误；既有交互单元测试由整体测试运行验证 |
| 文化案例列表 / 分页 | `CulturalCaseExplorer` / `CaseResults` | `GET /api/cultural-cases` | 无独立硬编码案例列表；新数据自动参与节气 / 省份筛选和分页；从关联省打开跨省案例时保持当前省份 | 真实 HTTP 测试覆盖分页；浏览器按全部 24 节气逐条打开案例 |
| 文化案例详情与来源 | `CaseDetail`、新增共享 `CulturalCaseContent` | `GET /api/cultural-cases/[caseId]` 或同一列表 API 完整记录 | 地图与书页复用同一详情内容渲染；保留 regionName，显示全部来源；缺省 imageUrl 时不创建图片请求；显示来源访问备注 | 浏览器逐条对比完整内容、全部来源链接、访问备注与图片是否存在 |
| 造物 `/studio` 节气与画布 | `StudioWorkbench`、`studio-draft`、`export-poster` | `SOLAR_TERMS` + 既有模板 / 合法贴纸目录 / 用户草稿 | 保留 24 节气、现有贴纸、模板、编辑、导出和草稿；这些是创作意象，并非另一套文化案例库 | 浏览器打开页面、检查 24 个节气选项与手机布局；既有造物测试由整体测试运行验证 |
| 造物 AI 灵感 | `StudioInspiration`、`/api/studio/inspiration` | 后端根据所选节气读取同一 verified 案例集合 | 新增案例参与模型参考；保持旧 suggestions 响应，增加兼容 references；前端展示所提供的参考案例、全部来源及访问备注 | 参考资料安全解析与后端注入测试；真实 DeepSeek 请求另由整体联调记录，不在浏览器回归中重复计费 |
| 知时 AI 问答 | `FloatingChat`、`ChatPanel`、`/api/chat`、`cultural-case-context` | 本地 verified 案例检索 + 现有 DeepSeek 官方实时检索 | 本地案例可按问题中的节气、地区、名称参与回答；归档资料与实时联网明确区分；未核验案例不进入提示词 | AI 单元测试和真实请求记录由整体联调提供；聊天 UI 保持原样 |
| 关于 `/about` | `app/about/page.tsx` | 同一 verified 集合 + 既有天文 / UNESCO 资料链接 | 动态案例与节气统计；删除“未接入知识库或联网”“地域案例建设中”等过时描述；说明来源与核实边界 | 定向 ESLint、TypeScript 检查通过；浏览器对照数据计数 |
| 导航、布局、页脚 | `SiteHeader`、`app/layout.tsx` | 现有页面路由、通用项目描述 | 无案例副本或旧数量；更新搜索摘要以包含文化案例 / 地图 / 创作，保留导航与设计 | 浏览器通过实际页面加载检查 |
| 公共节气数据 | `lib/solar-terms.ts` | 统一稳定节气 ID、名称、顺序与黄经 | 无新复制列表；原 `isFeatured` 四项与未使用 `culturalCaseIds` 预留属性不影响当前 24 节气展示，按范围不删除 | 原节气完整性与顺序测试保留 |
| 节气小识 / 照片 / 装饰 | `solar-term-notes`、`solar-term-photos`、`SeasonVignette`、`InkLandscape`、`PaperLandscape` | 既有独立科普来源、授权图像、装饰图形 | 不属于文化案例运行集合，未用补采案例覆盖科学说明、照片说明或装饰；不新增第三方图片 | 代码审计确认无案例 ID / 旧数量，浏览器资源检查 |
| 案例关键词和类别查询 | 文化案例列表 API、`cultural-case-query`、`cultural-case-client` | 同一 verified 集合 | 新案例直接参与关键词 / 类别组合筛选；当前产品没有另一个搜索结果页或独立案例搜索框，不新增无关界面 | 真实 HTTP 及查询测试覆盖新增案例、空结果、组合筛选 |
| 主选与素材审核 | `data/cultural-cases/primary.json`、`docs/cultural-sources`、导入脚本 | 本批完整 Excel 归档及审核结果 | 主选 / 候选用于整理，不限制正式案例展示为每节气一条；不计入与待核验记录留在台账 | 原表差异、稳定 ID、去重、24 节气数量由导入和数据专项测试验证 |

## 前端执行记录

- 本轮 UI 修改后的定向 ESLint 已通过。
- `npx.cmd tsc --noEmit` 已通过。最终生产构建由总验收单独运行。
- 已在本地生产服务 `http://127.0.0.1:3112` 执行 `tests/cultural-cases-browser.mjs`，不拦截或模拟案例接口，不调用付费模型。[browser.json](../cultural-sources/2026-11-12/verification/browser.json) 记录 `passed: true`。
- 桌面 1365×900 与 Pixel 7 浏览器模拟各通过全部 24 节气：每种视口展开 77 条书页案例，并读取 80 次地图详情（跨省案例在各关联省分别读取）。总计 154 次书页案例检查、160 次地图详情检查。逐条比较完整介绍、节气依据、地区、全部原始来源、来源访问备注与缺省图片。
- 两种视口的首页、关于、造物页面，以及书页到地图导航、省份参数链接、非法参数恢复均通过。页面错误 0，失败资源 0，所测页面及全部详情横向溢出 0。
- 已查看[桌面案例展开截图](../cultural-sources/2026-11-12/verification/desktop-seasonal-cases.png)与[手机模拟案例展开截图](../cultural-sources/2026-11-12/verification/mobile-emulation-seasonal-cases.png)，文字与来源正常可读。上述浏览器结果对应本次新增案例展示；未把静态截图当作 AI 实际生成结果。
- 手机使用 Pixel 7 浏览器模拟，不能当作真实手机、其他电脑或公网网络验收。来源外链的可访问性由独立来源核验记录负责，浏览器回归只验证原链接与异常备注准确呈现。

在已运行生产服务的项目目录执行：

```powershell
# PLAYWRIGHT_MODULE_PATH 指向本机已有 playwright-core 包目录，无需修改项目依赖。
$env:PLAYWRIGHT_MODULE_PATH = '<本机已有的 playwright-core 绝对目录>'
node tests/cultural-cases-browser.mjs http://127.0.0.1:3112
```

## 保留范围

未更改 DeepSeek 提供商、API 密钥、Netlify / Vercel 配置、地图几何、原有中国风主视觉、节气照片、画布编辑或导出逻辑。新增样式仅用于案例展开区和 AI 参考来源，与现有宣纸、青绿、金褐色样式一致。

## 最终执行结果与限制

本批新增 33 条、旧案例补充来源访问提示 4 条，最终公开 77 条、pending 2 条。原有 44 条正文和全部旧 ID 保留。跨表重复 30 行合并为相同整理记录；另有绍兴黄酒同一习俗合并 1 条。地坛祭地、南京萝卜圆子、鲁北红黏粥三条表间遗漏已补回。24 节气逐项数量及 80 条整理记录的处理决定见[逐条台账](../cultural-sources/2026-11-12/report.md)。

| 检查 | 实际执行结果 | 证据 |
| --- | --- | --- |
| 原始五表与离线导入 | 原文件与 intake 单元格/摘要一致；导入结果可复现 | intake.json、review.json、manifest.json；`npm.cmd run cases:import -- --check` |
| 自动测试 | 最后一次修改后 111 项全部通过 | [unit-tests.txt](../cultural-sources/2026-11-12/verification/unit-tests.txt) |
| 真实文化案例 API | 本地生产服务 139 次请求通过，覆盖 77 条详情、24 节气、组合筛选、分页、非法参数、空结果和 pending 404 | `node tests/cultural-cases-http.mjs http://127.0.0.1:3112`；未模拟数据 |
| 桌面与手机模拟 | 上述全 24 节气浏览器回归通过；最终新增的 4 条旧来源提示另行定向复查通过 | [browser.json](../cultural-sources/2026-11-12/verification/browser.json)、[source-notes-browser.json](../cultural-sources/2026-11-12/verification/source-notes-browser.json) |
| 知时真实 DeepSeek | 普通知识、地坛补采案例回答成功；待核验案例未当作已收录事实；实时节气资料查询返回香港天文台链接 | [ai-live.json](../cultural-sources/2026-11-12/verification/ai-live.json)、[ai-live-recheck.json](../cultural-sources/2026-11-12/verification/ai-live-recheck.json) |
| 造物真实 DeepSeek | 大雪返回 3 组创意和 3 条案例参考；最终构建后又通过真实浏览器点击生成，三组文案、原始来源及访问提示均展示 | [studio-browser.json](../cultural-sources/2026-11-12/verification/studio-browser.json) |
| 静态检查与生产构建 | `npm.cmd run lint`、TypeScript 及最终 `npm.cmd run build` 通过，API 仍是动态服务端路由 | [build.txt](../cultural-sources/2026-11-12/verification/build.txt) |
| 密钥与范围检查 | 以本机密钥值核对 293 个项目文件和构建客户端资源，未发现明文泄露；本轮未改 `.env.local`、模型服务商或部署配置 | 检查只输出数量和命中状态，不存储真实密钥 |

真实 AI 首次执行中，普通问题和地坛问题成功，造物出现客户端超时（实际观察约 196 秒），另外两项返回 NETWORK_ERROR。之后仅复测失败的三项，均在约 1.9–2.3 秒成功；最终浏览器生成也成功。保留首轮失败原始记录，不把复测成功表述为连续稳定性保证，也不据此声称所有网络下的超时上限均已验证。模型、超时和重试实现沿用当前有效基线，本轮未改动。

模型仍为 DeepSeek 官方 `deepseek-flash`，聊天请求使用 `https://api.deepseek.com/chat/completions`，实时检索沿用官方 `/v1/tools/search`；仅服务端读取 `DEEPSEEK_API_KEY`。本地案例引用与实时搜索来源分开标识，不把归档资料说成已联网。模型输出是原创文案，不能作为原始文化史料。

来源访问限制仍存在：佛山原文进入维护页，未在本轮重新读取；资兴原站防护阻断，补入已读的第二来源；其他受限原链接已保留并显示备注。详见[来源核查说明](../cultural-sources/2026-11-12/README.md)。不能声称全部原链接已经恢复。

## Git 交付与生产发布状态

本批基于最新 `main` 的 `482ac19`，在 `feat/cultural-cases-supplement-20261112` 分支交付 PR，不直接合并 main。已确认 Netlify 站点 `qsxshixu-ai` 当前没有连接 Git 仓库，因此推送分支不会自动更新公网。**本批尚未部署到 Netlify 或 Vercel，公网仍为此前版本。** 两个平台的配置均未修改。

审核并合并后，在包含本批修改的版本上部署：

```powershell
npm.cmd ci
npm.cmd run build
npx.cmd netlify-cli deploy --prod --build --context production
```

部署前确认 CLI 仍绑定原 `qsxshixu-ai` 站点；生产密钥继续使用平台原配置，不复制进代码或命令参数。发布后再检查公网全部 24 节气、问答与造物，并以真实手机/电脑分别在中国移动、联通、电信无 VPN 网络验收。本轮仅完成本地生产服务和手机浏览器模拟，未将其替代公网或真实设备验收。
