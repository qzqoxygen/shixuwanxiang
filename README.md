# 时序万象

时序万象是一个面向公众的二十四节气文化探索与创作平台。你可以翻阅四时风物册，按节气和地区查找有出处的地方记录，通过 DeepSeek 问答比较各地习俗，再把案例或个人记忆做成一张节气卡。

[体验正式站](https://shixu-ai-qzqoxygen.netlify.app/) · [浏览节气探访](https://shixu-ai-qzqoxygen.netlify.app/visit) · [查看 AI 工具联调](docs/integration/agent-v1.md)

## 参赛项目简介

> 《时序万象》围绕二十四节气，帮助用户读懂节气知识、查找家乡风物、制作自己的节气作品。平台收录覆盖 24 个节气的 77 条已核验文化案例，提供图文书册、分省地图和原文出处。DeepSeek 支持风物导读补充、地方习俗探访、跨地区问答和制卡灵感。用户可以从一个问题出发，查看资料、定位地图，再把案例带入造物工坊，编辑并导出节气卡。

## 参赛团队

| 项目 | 信息 |
| --- | --- |
| 竞赛 | 2026 第九届传智杯全国大学生数智创新与 AI 应用大赛 |
| 赛道 | AI WEB 网页开发挑战赛（团队赛，B 组） |
| 团队 | QSX |
| 院校 | 曲阜师范大学 |
| 队员 | 邱紫琦、许展硕、商艺蕊 |

## 可以体验什么

| 页面 | 主要体验 |
| --- | --- |
| [首页](https://shixu-ai-qzqoxygen.netlify.app/) | 在四季窗景中切换季节和远近景，认识二十四节气，进入各体验模块。 |
| [四时](https://shixu-ai-qzqoxygen.netlify.app/seasons) | 翻阅 24 个节气的图文书册，切换通用讲法与儿童讲法。每个节气有预置导读，点击「AI 再讲一点」可生成补充内容。 |
| [知时](https://shixu-ai-qzqoxygen.netlify.app/explore) | 按节气和地区浏览文化地图，查看案例和出处，也可请「云间问四时」比较不同地区的习俗并定位案例。 |
| [节气探访](https://shixu-ai-qzqoxygen.netlify.app/visit) | 选择省份、节气，可填写市县。优先查询本站资料，资料不足时尝试联网补查。案例可跳转到知时地图或造物。 |
| [造物](https://shixu-ai-qzqoxygen.netlify.app/studio) | 选用案例、个人节气记忆或自己的文字，结合 AI 生成的标题与短句编辑卡面，调整版式和贴纸，导出 PNG。 |
| [关于](https://shixu-ai-qzqoxygen.netlify.app/about) | 查看项目定位、案例覆盖和资料鸣谢。 |

## 演示路线

1. 打开「节气探访」，选择浙江、冬至，市县填「三门县」。找到「三门祭冬」后展开资料出处。
2. 点击「在知时看地图」，查看同一案例的位置与详情。在「云间问四时」提问「江苏和浙江的冬至习俗有什么不同？请比较已核验案例，并在地图中标出这两个地区。」查看工具记录、分省资料和地图操作。
3. 打开案例的制卡入口，生成灵感并选用一句短句，编辑后导出 PNG。也可返回节气探访继续原来的查询。
4. 单独演示导读时，打开「四时」的冬至书页，切到儿童讲法，再点「AI 再讲一点」。

## AI 技术与创新点

- **模型接入。** Next.js 服务端调用 DeepSeek 官方 API，当前配置为 `deepseek-flash`。四时补充、案例探访、地图问答和造物灵感各有自己的上下文和输出规则。造物用结构化输出生成标题和短句，校验后提供给用户选用。
- **检索与来源。** 本地案例库收录 77 条已核验记录，覆盖全部 24 个节气。案例链接保留原文入口。节气探访在匹配资料不足时尝试补查，区分本站案例、联网记录、相关线索和暂无可核实资料。个人记忆可以用于创作，保留个人叙述的属性。
- **工具调用与地图联动。** 知时问答可调用六项业务工具，包括节气信息、案例查询、跨地区比较、地图展示、省份高亮和打开案例。回答显示工具执行记录。用户点击「在地图中查看」后，前端校验操作并成批应用，过期结果会被拒绝。
- **从资料到作品。** 节气探访、知时和造物通过节气、地区及案例参数联动。用户可以在同一个案例上查看出处、比较地区、继续制作和修改节气卡。

## 本地运行与检查

部署使用 Node.js 24。安装锁定依赖，将 `.env.example` 复制为 `.env.local`，在本地文件中填写 `DEEPSEEK_API_KEY`。线上密钥在 Netlify 的服务端环境变量中配置。

```sh
npm ci
npm run dev
```

打开终端提示的本地地址。基础书册、地图和手动编辑可以直接体验，实时 AI 功能需要可用的 DeepSeek 密钥与网络。

```sh
npx tsc --noEmit
npm run lint
npm test
npm run build
```

正式站由 Netlify 关联 GitHub 的 `main` 自动构建。构建参数见 [netlify.toml](netlify.toml)。

## 工程与资料

- `app/` 是 Next.js App Router 页面及服务端 API。核心交互组件在 `components/`，模型接入、工具执行和案例查询在 `lib/`。案例运行数据见 [案例库](data/cultural-cases/cases.json)。
- [Agent V1 联调](docs/integration/agent-v1.md) · [前后端接口协议](docs/contracts/v1.0.md) · [案例接口联调](docs/integration/cultural-cases.md)
- [案例入库与核验记录](docs/cultural-sources/2026-11-12/report.md) · [书册照片来源](public/images/solar-terms/SOURCES.md) · [地图数据说明](data/maps/README.md) · [字体许可](public/fonts/README.md)
- [UNESCO 二十四节气介绍](https://ich.unesco.org/en/RL/00647) · [香港天文台二十四节气](https://www.hko.gov.hk/tc/gts/time/24solarterms.htm)
- [历次项目盘点](docs/PROJECT_STATUS.md) · [早期交接记录](https://github.com/qzqoxygen/shixu-ai/blob/f5d561cb7d7a810f76042ad7ff5422e6ecc9a522/README.md)
