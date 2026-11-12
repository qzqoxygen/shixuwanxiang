# 2026-11-12 补采批次

本批基于 GitHub `main` 的 `482ac19`，使用《二十四节气-案例总表-最终版（补采版）.xlsx》。原文件不改写，五张工作表的单元格与文件摘要保存在 [intake.json](intake.json)。表内编辑建议作为资料审阅，不作为程序指令执行。

## 数据结果与复现

原有 44 条公开案例全部保留，新增 33 条，最终 77 条。4 条旧案例仅补充来源访问提示，原正文、来源题名、机构、URL 和 ID 不变。2 条 pending 保留隐藏，绍兴立冬开酿重复记录仍指向原有同一 ID。全部旧 ID 与主选映射不变。逐行差异、表间遗漏、重复与统计矛盾见 [report.md](report.md)，机器可读结果见 [manifest.json](manifest.json)。审核限定与来源补录见 [review.json](review.json)。

```powershell
# 检查原 Excel 与已审阅五表存档完全一致（需要 openpyxl，仅用于读取）
python scripts/extract-case-workbook.py "C:\Users\Administrator\Downloads\二十四节气-案例总表-最终版（补采版）.xlsx" --check docs/cultural-sources/2026-11-12/intake.json

# 检查生成结果，或在修订审核记录后重新生成
npm.cmd run cases:import -- --check
npm.cmd run cases:import -- --write
```

导入先重建旧批已核实结果，再按本批明确的稳定 ID 增补。不得用旧脚本单独覆盖 `cases.json`。后续追加须审阅新表并更新对应批次决策，不能只改总数或强行将 pending 提升为 verified。

## 地域与公开状态

“占稻色”保留华南稻作区范围，“送花神”保留江南范围。主省为表内首省的兼容锚点，其他明确省份通过可选 `relatedProvinceCodes` 关联。一条跨省案例在全国只计一次；省份统计可以重叠，不能累加当作全国总数。不编造县市或经纬度。

`verified` 表示已通过本批资料与既有编辑核查，并不保证第三方网页永远可访问。本轮以用户提供的已核实补采资料为基础，交叉复查外链；本次未能复验正文的情况明确保留，不能写成每个原文均由程序重新核实。

新郑大枣的砑枣技艺缺少秋分直接关联，黄陵面花缺少冬至直接来源，仍为 pending，公开详情均 404。未擅自改到其他节气，也不会进入本地 AI 案例上下文。

## 来源复查与保留问题

[source-checks.json](source-checks.json) 记录 89 个原链接的直接 HTTP 检查以及后续浏览器/原文复核，另补 1 个真实次来源，总计 90 个不同来源链接。HTTP 200 只说明取到了响应，不能等同于正文或事实核验。

- 直接读取 82 个链接获得正文文本；7 个遇到安全防护、网络失败或动态页面。动态页面中另有两个虽然返回 200，但初始 HTML 不含文章，已通过真实浏览器复核。
- 广州处暑凉茶和徐州伏羊通过浏览器取得正文。徐州原表部分“摘录”不是原文逐字引文，且具体羊种、活动时长等不在该来源中；展示稿已按实际原文收紧，原始简介完整保留。
- 南京梅花山本机直连 403，但网页检索可读原文；保留核查日期和访问差异说明，花情限定在报道日期。
- 资兴政府原链返回 412 安全防护。保留原链并标记限制，同时补充已实际读取的中国农业大学白露文化整理稿作为第二来源，不把整理稿说成独立田野调查。
- 佛山大寒糯米饭原链转到网站维护页，本次未能重新复核正文。保留素材组补采表所记的已核实结论与原始链接，详情显示本次复查限制，待素材组补存原文或复查恢复情况。
- 旧案例中的篁岭、南京地方志小暑、学习强国南京大雪、江苏广电太湖白露的原链接，本机复查分别遇到连接异常、403、动态页面或连接异常。它们的既有审核记录及其他来源保持不变；新增访问提示已在详情和 AI 参考资料中贯通，并经最终构建后的浏览器定向复查。本次不声称这些链接全部恢复。

本轮不下载第三方图片，不新增 `imageUrl`。表内疗效、占卜与传说保留为民俗观念，不作为科学或医学保证。原始表格内容与编辑修改均可追溯。

## 联调与交付

```text
GET /api/cultural-cases?solarTermId=daxue&offset=0&limit=20
GET /api/cultural-cases/beijing-xiazhi-earth-rites
GET /api/cultural-cases?solarTermId=mangzhong&provinceCode=330000
GET /api/cultural-cases?solarTermId=qingming&provinceCode=540000
GET /api/cultural-cases/huangling-flower-buns
```

依次可验证大雪 3 条、补回地坛详情、浙江关联江南送花神、真实空结果、pending 404。排序、分页和 V1 错误格式不变。完整页面检查与执行结果见 [全站文化案例覆盖检查表](../../integration/cultural-case-site-coverage-2026-11-12.md)。

本批按功能分支与 PR 交付，不强制推送或直接合并 `main`。代码测试通过与生产部署生效是两件事；生产发布状态见最终交付记录。
