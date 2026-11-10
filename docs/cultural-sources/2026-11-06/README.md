# 知时页最终表批次

47 条素材均有去向。公开的 44 个案例覆盖 24 节气和 15 个省级地区。新郑砑枣仍缺秋分直接依据，黄陵面花仍缺冬至直接依据，这两个案例在列表、详情和地图计数中隐藏。逐行处置、原链接补录事项与节气数量见[导入清单](report.md)。

## 编辑资料

- [intake.json](intake.json) 按 Excel 顺序保存三个工作表的原始单元格。数组下标从 0 开始，Excel 行号从 1 开始。来源题名、机构、完整链接、原始发布日期及备注都保留在这里。
- [review.json](review.json) 记录每个素材序号的稳定 ID、核查依据、原文链接与公开用摘要。序号用于找回素材，后续修题名或增补来源仍沿用案例 ID。`previousRow` 指向[首批资料](../intake-2026-11-03.json)的 Excel 行号。`mergeInto` 指向本批主记录的素材序号。
- [主选配置](../../../data/cultural-cases/primary.json) 由覆盖表的节气和主选题名定位到审定记录，保留 Excel 行、序号及稳定 ID。列表仍按 ID 的 ASCII 顺序分页。

八个既有案例全部沿用 ID。漠河修订稿限定为白夜与夏至活动。旧草稿「岭南秋汤」补实广东开平苍城镇的记载，已用原 ID 转正。旧批的清明扫墓祭祖、秋分竖蛋和粘雀子嘴仍在历史草稿中。绍兴黄酒的第 39、40 号共享一个案例 ID，并列两篇来源。所有案例省略 `imageUrl`。

## 离线导入、检查与回滚

在项目根目录使用 Node 22.15 及以上版本和项目锁定的 npm 依赖。日常重建使用已归档的原始单元格和人工核查记录。

```powershell
npm.cmd run cases:import
npm.cmd run cases:import -- --write
npm.cmd run cases:import -- --check
```

第一步预览变更。第二步在整批校验通过后生成清单、主选配置与运行数据，最后以一次文件替换发布 `cases.json`。同样的输入与审定结果会跳过内容相同的文件。第三步检查版本库中的三个产物能否逐字复现，适用于交付前检查。线上查询只读运行 JSON。

从原始 Excel 再次核对归档时，使用 Python 3 和 `openpyxl` 3.1。此步骤不需要联网。路径可指向下载的同一份文件。

```powershell
python scripts/extract-case-workbook.py "二十四节气-案例总表-最终版 (1).xlsx" --check docs/cultural-sources/2026-11-06/intake.json
```

接收下一版时，使用同一脚本的 `--output <新批次归档.json>` 保存新文件。核对增删行、历史实体和实际原文，完成该批的核查记录后再更新导入输入。导入器会检查归档内容指纹，避免沿用旧表结论发布已修改的材料。图片可在后续批次按稳定 ID 匹配。

本批改动以独立提交交付。需要整批回滚时，在集成分支撤销该提交（squash 合并用对应 squash 提交），然后重新构建。若只需紧急恢复数据，可在此次批次上执行下列命令，检查差异、提交并重新构建。旧版运行文件和当时的主选配置状态均取自基线，命令只作用于案例数据目录。

```powershell
git restore --source=c5cec01 --staged --worktree -- data/cultural-cases
git diff --cached -- data/cultural-cases
```

## 联调

| 接口查询条件 | 已核实结果 |
| --- | --- |
| `solarTermId=lichun&provinceCode=330000` | 浙江九华立春祭 |
| `solarTermId=jingzhe&provinceCode=810000` | 香港鹅颈桥惊蛰打小人 |
| `solarTermId=qingming&provinceCode=310000` | 上海清明吃青团 |
| `solarTermId=qiufen&provinceCode=110000` | 北京月坛秋分祭月 |
| `solarTermId=dongzhi&provinceCode=330000` | 三门祭冬 |
| `solarTermId=qingming&provinceCode=540000` | HTTP 200，`total: 0`、`items: []` |

以上条件拼接到 `GET /api/cultural-cases?`。例如，取秋分北京列表项的 ID 请求 `GET /api/cultural-cases/beijing-yuetan-moon-rites`，可在 `item.sources` 读取三篇来源。待核验的 `huangling-flower-buns` 与 `xinzheng-jujube-harvest` 均返回 HTTP 404 和 `CASE_NOT_FOUND`。[完整响应示例](../../integration/cultural-cases.md)

## 交付检查

在 Windows、Node 24.21.0、Next.js 16.4.3 的本地生产构建上检查。

| 检查 | 结果 |
| --- | --- |
| Excel 归档与幂等 | 附件 SHA-256 和三个工作表的单元格均与归档相符。连续两次执行 `--write`，第二次无文件写入。`--check` 通过 |
| `npm.cmd test` | 69 项通过。含 47 行处置、旧 ID、24 个主选、多来源、待核验隐藏及 22 条同节气样例的跨页省份统计 |
| `npx.cmd tsc --noEmit`、`npm.cmd run lint`、`npm.cmd run build` | 均通过 |
| `node tests/cultural-cases-http.mjs http://127.0.0.1:3176` | 103 次真实请求通过。无密钥的生产服务逐页返回 44 个不同 ID，所有详情与列表一致，24 节气地图计数与公开数据一致 |
| Chrome 复验 `/explore` | 初始列表每页 6 条，翻到第二页无重复。选秋分后通过地图选北京，打开月坛详情，点击首条来源进入西城区政府网页；清明与西藏返回 0 条 |
| 无图详情 | 1320 和 390 像素宽度均无案例图片元素，正文与来源随屏宽换行。390 像素截图中原有浮动聊天入口与详情底部提示局部重叠 |
