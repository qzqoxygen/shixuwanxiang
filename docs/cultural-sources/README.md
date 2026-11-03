# 首批文化案例整理与核查

整理日期：2026-11-03（北京时间）。依据用户提供的《二十四节气-节气案例搜集表 (1).xlsx》“节气案例”工作表 A1:I13，共 12 条。原始单元格文字保存在 [intake-2026-11-03.json](intake-2026-11-03.json)，不作为运行数据或公开接口的导入来源。原文件未修改。

原文件 SHA-256：`d82c3874e0a0e89ca4a619056692c47db311db1c951da7650602befe52c5bd8d`。

## 本轮判定范围

核查执行：Codex，按本轮用户授权对照公开来源整理；核查与访问日期均为 2026-11-03。此处如实记录开发资料核对，不冒称素材同学已复审或取得第三方授权。

`verified` 只针对最终保留的地域、习俗与节气关联陈述；未证实的起源、普及程度、功效等不写入公开描述。`pending` 为结构完整但关键事实仍待核实的记录。省份不能确定的条目保留为草稿，不通过填入推测省份来满足 schema。材料中的要求、观点或科学解释均作为待核对资料处理。

| Excel 行 | 稳定案例 ID / 核查记录 | 案例 | 本轮状态 | 原因及边界 |
| --- | --- | --- | --- | --- |
| 2 | [qingming-ancestor-tomb-sweeping](qingming-ancestor-tomb-sweeping.md) | 清明扫墓祭祖 | 草稿，未入库 | 全国通行，缺少可分别核实的省级地域记录 |
| 3 | [shanghai-qingming-qingtuan](shanghai-qingming-qingtuan.md) | 上海清明吃青团 | verified | 只保留来源明确的上海清明食俗，不写起源或全市覆盖 |
| 4 | [tongxiang-heshan-qingming-dinner](tongxiang-heshan-qingming-dinner.md) | 河山镇清明团圆饭 | verified | 地域与清明夜晚餐有明确记述，菜品寓意按民俗呈现 |
| 5 | [beijing-xiazhi-noodles](beijing-xiazhi-noodles.md) | 北京夏至吃面 | verified | 只保留夏至吃面事实，删除健康功效断言 |
| 6 | [shaoxing-zuo-xiazhi](shaoxing-zuo-xiazhi.md) | 绍兴“做夏至” | verified | 保留旧时习俗，不宣称现今普及程度 |
| 7 | [mohe-xiazhi-white-night](mohe-xiazhi-white-night.md) | 漠河北极村白夜极光 | pending，已结构化但不公开 | 极昼/白夜、极光观测时机、活动规模、现行地名待核查 |
| 8 | [qiufen-egg-balancing](qiufen-egg-balancing.md) | 秋分竖蛋 | 草稿，未入库 | 省份缺失，原表力学解释待修正 |
| 9 | [lingnan-qiufen-autumn-soup](lingnan-qiufen-autumn-soup.md) | 岭南秋汤 | 草稿，未入库 | 岭南不等于某一个省，缺少具体地域依据 |
| 10 | [qiufen-nian-que-zi-zui](qiufen-nian-que-zi-zui.md) | 秋分“粘雀子嘴” | 草稿，未入库 | 只写民间，无法确定省份 |
| 11 | [sanmen-jidong](sanmen-jidong.md) | 三门祭冬 | verified | 补充国家级项目页，核实 2014 年第四批扩展项目信息 |
| 12 | [suzhou-dongzhi-winter-wine](suzhou-dongzhi-winter-wine.md) | 姑苏冬酿酒 | verified | 只保留冬至夜饮食习俗，删除驱寒功效断言 |
| 13 | [beijing-dongzhi-nine-nine-chart](beijing-dongzhi-nine-nine-chart.md) | 九九消寒图 | verified | 补充明确指向老北京的来源，限于旧京历史记述 |

运行文件 [cases.json](../../data/cultural-cases/cases.json) 共 8 条：7 条 verified、1 条 pending。公开结果为清明 2 条、夏至 2 条、冬至 3 条；秋分及其余节气目前为 0 条。公开案例涉及北京、上海、江苏、浙江；地图支持的其他地区没有案例时也正常返回空结果。地图覆盖不等于案例覆盖。

## 文字与图片

公开文本为本轮重新撰写的简短事实摘要，附来源链接，不复制来源全文。第三方原文转载授权未取得；后续扩写或正式传播时素材负责人需继续确认使用条件。各条原始说明、存疑措辞保留在整理快照中，便于复核，不混入公开摘要。

12 条原始记录的图片均写有授权待确认；本轮不下载、不引用、不填 `imageUrl`。公开接口支持没有图片的案例。没有获批的外部图片域名，当前图片 schema 仅接受本站 `/images/` 下的路径；将来附图时需在对应案例记录补充权利人、授权范围和凭据，并更新测试。

## 继续追加与修订

1. 沿用本表稳定 ID；排序、修正文案、补充来源和重新核查都不重新编号。草稿 ID 同样保留，不挪给其他案例。跨省资料日后拆分时为各地区新建 ID，记录与原草稿的对应关系。
2. 素材同学先补足地域、节气关联和来源依据；结构完整后才可放入 `data/cultural-cases/cases.json`，未核实先填 `pending`。缺少必填字段继续留在整理资料中。
3. 核对实际来源内容并更新对应 ID 的核查记录，只将保留陈述已核实的记录改为 `verified`；图片审核单独记录，不因案例核实而自动可用。
4. 运行 `npm test`、`npx tsc --noEmit`、`npm run lint` 和 `npm run build`，更新本表与数据测试的批次预期，再按 [联调说明](../integration/cultural-cases.md) 检查真实 HTTP。接口不在运行时访问来源网站，也没有资料写入 API。
