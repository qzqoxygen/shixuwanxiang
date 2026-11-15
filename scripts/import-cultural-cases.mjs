// Offline publication of the reviewed batches. Only cases.json is read by the API.
import "../tests/register-ts.mjs";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
const { CulturalCaseCollectionSchema, CulturalCaseIdSchema, VerifiedCulturalCaseSchema } = await import("../lib/contracts/cultural-case.ts");
const { SUPPORTED_PROVINCES } = await import("../lib/provinces.ts");
const { SOLAR_TERMS } = await import("../lib/solar-terms.ts");

const root = new URL("../", import.meta.url);
const batch = "docs/cultural-sources/2026-11-06/";
const runtime = "data/cultural-cases/";
const read = (path) => JSON.parse(readFileSync(new URL(path, root), "utf8"));
const format = (value) => JSON.stringify(value, null, 2) + "\n";
const args = process.argv.slice(2);
assert(args.length <= 1 && (!args.length || ["--write", "--check"].includes(args[0])), "Expected --check or --write; no argument previews the import.");

const archive = read(batch + "intake.json");
const review = read(batch + "review.json");
const previous = read("docs/cultural-sources/intake-2026-11-03.json");
assert.equal(createHash("sha256").update(JSON.stringify(archive)).digest("hex"), review.intakeDigest,
  "The reviewed archive changed. Reconcile the workbook and review each affected row first.");

function readSheet(name) {
  const [, headers, ...rows] = archive.sheets[name];
  return rows.map((values, i) => ({
    ...Object.fromEntries(headers.map((key, col) => [key, values[col]])), excelRow: i + 3,
  }));
}

const rows = readSheet("案例明细表");
const coverage = readSheet("24节气覆盖表");
const bySerial = new Map(review.rows.map((entry) => [entry.serial, entry]));
assert.equal(bySerial.size, review.rows.length, "Duplicate review serial");
assert.equal(new Set(rows.map((r) => r.序号)).size, rows.length, "Duplicate intake serial");
assert.equal(rows.length, bySerial.size, "Every intake row needs exactly one editorial decision");

const categories = {
  饮食: "food", 民俗: "folk_custom", 礼制民俗: "folk_custom", 民俗技艺: "folk_custom",
  农事: "agriculture", 农事技艺: "agriculture", 农事民俗: "agriculture",
  技艺: "craft", 其他: "other",
};
const oldRows = new Map(previous.rows.map((entry) => [entry.caseId, entry.row]));
const byTerm = new Map(SOLAR_TERMS.map((term) => [term.name, term.id]));
const entities = new Map();
const ledger = [];
for (const row of rows) {
  const entry = bySerial.get(row.序号);
  assert(entry, `Missing review of Excel row ${row.excelRow}`);
  const { id, status, reason } = entry;
  CulturalCaseIdSchema.parse(id);
  assert(["verified", "pending", "draft"].includes(status) && reason?.trim(), `Incomplete review for ${id}`);
  assert.equal(oldRows.get(id), entry.previousRow, `Incorrect previous batch identity: ${id}`);
  if (row.整理状态 === "待核验") assert.notEqual(status, "verified", `Unresolved editorial hold: ${id}`);
  const term = byTerm.get(row.对应节气);
  assert(term, `Unknown solar term at row ${row.excelRow}`);
  const links = [...new Set(row.原文链接?.split(/[；;]\s*(?=https?:\/\/|$)/u).map((url) => url.trim()).filter(Boolean))];
  for (const link of links) assert.match(link, /^https?:\/\/[^\s；]+$/u, `Invalid URL cell at row ${row.excelRow}`);
  const outcome = status === "draft" ? "草稿" : status === "pending" ? "待核验"
    : entry.mergeInto ? "合并" : entry.previousRow ? "更新" : "新增";
  ledger.push({ row, entry, term, links, outcome });
  if (status === "draft") continue;
  const name = entry.provinceName ?? row.省份;
  const province = SUPPORTED_PROVINCES.find((item) => item.name === name || item.name.replace(/[省市]$/u, "") === name);
  assert(province, `Review the province at row ${row.excelRow}; keep unlocated records in drafts`);
  const item = {
    id, title: entry.title ?? row.案例名称, solarTermIds: [term], provinceCode: province.code,
    provinceName: province.name, regionName: entry.regionName ?? row.具体地区, category: categories[row.类别],
    description: entry.description, relationNote: entry.relationNote,
    sources: [...entry.sources], verificationStatus: status,
  };
  if (!entry.mergeInto) {
    assert(!entities.has(id), `Duplicate entity ${id} requires an explicit merge`);
    entities.set(id, item);
  }
}

for (const { row, entry, term } of ledger.filter(({ entry }) => entry.mergeInto)) {
  const target = bySerial.get(entry.mergeInto);
  const item = entities.get(entry.id);
  assert(target && !target.mergeInto && target.id === entry.id && item && target.status === entry.status,
    `Invalid merge at Excel row ${row.excelRow}`);
  assert.equal(row.省份, rows.find((r) => r.序号 === target.serial).省份, "Reconcile the merge region first");
  if (!item.solarTermIds.includes(term)) item.solarTermIds.push(term);
  for (const source of entry.sources) {
    if (!item.sources.some((s) => s.url === source.url)) item.sources.push(source);
  }
}
const sorted = [...entities.values()].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
const cases = CulturalCaseCollectionSchema.parse(sorted);
const visible = cases.filter((item) => item.verificationStatus === "verified");
const selections = ledger.filter(({ row }) => row.整理状态 === "主选");
assert.equal(selections.length, SOLAR_TERMS.length);
assert.deepEqual(coverage.map((r) => r.节气), SOLAR_TERMS.map((term) => term.name));
const primary = coverage.map((record) => {
  const matches = selections.filter(({ row }) => row.对应节气 === record.节气 && row.案例名称 === record.主选案例);
  assert.equal(matches.length, 1, `Cannot identify primary for ${record.节气}`);
  const [{ row, term, entry }] = matches;
  const publishable = visible.some((item) => item.id === entry.id && item.solarTermIds.includes(term));
  return { solarTermId: term, caseId: publishable ? entry.id : null, serial: row.序号, excelRow: row.excelRow,
    ...(publishable ? {} : { proposedCaseId: entry.id, blocker: entry.reason }) };
});

function tally(values) {
  return [...new Set(values)].map((value) => `${value} ${values.filter((v) => v === value).length}`).join("、");
}
const provinces = SUPPORTED_PROVINCES.filter((p) => visible.some((item) => item.provinceCode === p.code));
const summary = `明细 ${rows.length} 条（${tally(rows.map((r) => r.整理状态))}）。` +
  `处理结果按原始行计：${tally(ledger.map((r) => r.outcome))}。按实体计：公开 ${visible.length}，待核验 ${cases.length - visible.length}。`;
const report = [
  "# 最终表导入清单", "", summary, "",
  `核查日期：${review.reviewDate}。原表 SHA-256：\`${archive.sha256}\`。三个工作表的原始单元格、日期与备注见 [intake.json](intake.json)；逐条证据与展示用来源见 [review.json](review.json)。`, "",
  `公开案例涉及 ${provinces.length} 个省级地区：${provinces.map((p) => p.name).join("、")}。`, "",
  "## 节气覆盖", "", "| 节气 | 已公开 | 主选 ID | 明细候选行 | 覆盖表原候选数 |", "| --- | ---: | --- | ---: | ---: |",
  ...primary.map((p, i) => {
    const count = visible.filter((item) => item.solarTermIds.includes(p.solarTermId)).length;
    const candidates = ledger.filter(({ row, term }) => term === p.solarTermId && row.整理状态 === "候选").length;
    return `| ${coverage[i].节气} | ${count} | ${p.caseId ?? p.blocker} | ${candidates} | ${coverage[i]["候选案例（数量）"]} |`;
  }), "",
  "覆盖表汇总为 22 个候选。惊蛰备注中的「天津惊蛰吃梨」没有对应明细，序号 17 缺号；实际候选为 21。", "",
  "## 原始行处理映射", "", "| Excel 行 | 序号 | 原标题 | 身份 | 案例 ID | 处置 | 核查依据及待办 |",
  "| ---: | ---: | --- | --- | --- | --- | --- |",
  ...ledger.map(({ row, entry, outcome }) => `| ${row.excelRow} | ${row.序号} | ${row.案例名称} | ${row.整理状态} | ${entry.id} | ${outcome} | ${entry.reason} |`), "",
  "## 来源补录清单", "",
  "以下按原文链接单元格分拆并去重。仅协议不同的同址链接视作已配对。保留在原始表的链接或附加标题，可以在素材组补齐题名、作者机构和可用正文后再复核。", "",
];
const address = (url) => url.replace(/^https?:\/\//iu, "");
for (const { row, entry, links } of ledger) {
  const unused = links.filter((url) => !entry.sources.some((s) => address(s.url) === address(url)));
  if (unused.length) report.push(`- 序号 ${row.序号}，原表链接仅归档：${unused.map((url) => `<${url}>`).join("、")}。`);
  if (row.来源标题.split(/\s*[+＋]\s*/u).length > links.length) {
    report.push(`- 序号 ${row.序号}，原表列有多个来源题名，所给链接不足以逐项对应。请补提供缺少的原文链接。`);
  }
}
report.push("");

// Reconcile the supplement against the reviewed baseline instead of replacing stable IDs.
const supplementBatch = "docs/cultural-sources/2026-11-12/";
const supplementArchive = read(supplementBatch + "intake.json");
const supplementReview = read(supplementBatch + "review.json");
assert.deepEqual(Object.keys(supplementArchive.sheets), ["案例明细表", "24节气覆盖表", "说明与交付备注", "补采案例", "补采汇总"]);
assert.equal(createHash("sha256").update(JSON.stringify(supplementArchive)).digest("hex"), supplementReview.intakeDigest,
  "The supplement changed. Review all five sheets before publishing.");
const numberedRows = (name) => supplementArchive.sheets[name].flatMap((values, index) =>
  /^\d+$/u.test(String(values[0])) ? [{ values, excelRow: index + 1, serial: Number(values[0]) }] : []);
const masterRows = numberedRows("案例明细表");
const supplementalRows = numberedRows("补采案例");
const supplementDecisions = new Map(supplementReview.rows.map((entry) => [entry.serial, entry]));
assert.equal(supplementDecisions.size, supplementalRows.length);
assert.equal(supplementReview.rows.length, supplementalRows.length);
const canonical = (values, supplementary = false) => supplementary
  ? [values[0], values[2], values[1], values[3], values[4] ?? "", values[5], values[6], values[7], values[8], values[9], values[11], values[10], values[12], values[13]]
  : values.slice(0, 14).map((value, index) => index === 4 ? value ?? "" : value);
const sameCase = (row) => `${row[2]}\u0000${row[1]}`;
const masterByIdentity = new Map(masterRows.map((row) => [sameCase(row.values), row]));
assert.equal(masterByIdentity.size, masterRows.length, "Duplicate main-sheet case identity");
const reconciled = [];
for (const { row, entry, outcome } of ledger) {
  const master = masterByIdentity.get(`${row.对应节气}\u0000${row.案例名称}`);
  assert(master && master.serial === row.序号, `Baseline case was lost or renumbered: ${entry.id}`);
  const original = archive.sheets["案例明细表"][row.excelRow - 1];
  for (let column = 0; column < 14; column++) {
    if (column !== 12) assert.deepEqual(master.values[column], original[column], `Baseline cell changed: ${entry.id}, column ${column + 1}`);
  }
  assert.equal(master.values[12], row.序号 === 40 ? "同俗合并·不计入" : entry.status === "pending" ? "待核验·不计入" : row.整理状态);
  reconciled.push({ id: entry.id, title: row.案例名称, solarTermId: byTerm.get(row.对应节气),
    mainSerial: master.serial, mainExcelRow: master.excelRow, editorialStatus: master.values[12],
    verificationStatus: entry.status, outcome: entry.mergeInto ? "合并·不重复计数" : entry.status === "pending" ? "待核验·不公开" : "已有·字段未变",
    changedFields: [], reason: entry.reason, ...(outcome === "合并" ? { mergeInto: entry.id } : {}) });
}
const additionalCategories = { 节庆民俗: "folk_custom", 游赏民俗: "folk_custom", 饮食民俗: "food", 饮食技艺: "food", 技艺饮食: "craft" };
const allCases = [...cases];
for (const note of supplementReview.existingSourceNotes ?? []) {
  const item = allCases.find((candidate) => candidate.id === note.id);
  const source = item?.sources.find((candidate) => candidate.url === note.url);
  assert(source && note.accessNote?.trim(), `Unknown existing source annotation: ${note.id}`);
  source.accessNote = note.accessNote;
  for (const row of reconciled.filter((candidate) => candidate.id === note.id)) {
    row.outcome = "已有·来源访问说明补充";
    row.changedFields = ["sources.accessNote"];
    row.reason += ` ${note.accessNote}`;
  }
}
for (const source of supplementalRows) {
  const entry = supplementDecisions.get(source.serial);
  assert(entry && ["verified", "pending", "draft"].includes(entry.status) && entry.reason?.trim());
  CulturalCaseIdSchema.parse(entry.id);
  assert(!allCases.some((item) => item.id === entry.id), `Supplement reuses an existing ID: ${entry.id}`);
  const values = canonical(source.values, true);
  const master = masterByIdentity.get(sameCase(values));
  if (master) assert.deepEqual(canonical(master.values).slice(1), values.slice(1), `Sheet disagreement: ${values[1]}`);
  assert.equal(values[12], "补采·可上线");
  const provinceName = entry.provinceName ?? values[3];
  const province = SUPPORTED_PROVINCES.find((item) => item.name === provinceName || item.name.replace(/[省市]$/u, "") === provinceName);
  assert(province, `Review the supplement province: ${values[1]}`);
  const term = byTerm.get(values[2]);
  assert(term, `Unknown supplement term: ${values[2]}`);
  let description = entry.descriptionOverride ?? values[6];
  for (const [from, to] of entry.replacements ?? []) {
    assert(description.includes(from), `Editorial replacement no longer matches: ${entry.id}`);
    description = description.replace(from, to);
  }
  const item = {
    id: entry.id, title: values[1], solarTermIds: [term], provinceCode: province.code, provinceName: province.name,
    ...(entry.relatedProvinceCodes ? { relatedProvinceCodes: entry.relatedProvinceCodes } : {}),
    regionName: entry.regionName ?? values[4], category: categories[values[5]] ?? additionalCategories[values[5]],
    description, relationNote: (entry.relationOverride ?? values[7]) + (entry.relationSuffix ? `\n${entry.relationSuffix}` : ""),
    sources: [{ title: values[8], publisher: values[9], url: values[10], ...(entry.accessNote ? { accessNote: entry.accessNote } : {}) }, ...(entry.extraSources ?? [])],
    verificationStatus: entry.status,
  };
  if (entry.status !== "draft") allCases.push(item);
  reconciled.push({ id: entry.id, title: values[1], solarTermId: term,
    ...(master ? { mainSerial: master.serial, mainExcelRow: master.excelRow } : {}),
    supplementSerial: source.serial, supplementExcelRow: source.excelRow,
    editorialStatus: values[12], verificationStatus: entry.status,
    outcome: entry.status === "verified" ? master ? "新增" : "新增·补回主表漏项" : "待核验·不公开",
    originalCategory: values[5], originalProvince: values[3], originalRegion: values[4],
    sourcePublishedAt: values[11], originalNote: values[13], reason: entry.reason,
    ...(entry.replacements ? { editorialReplacements: entry.replacements } : {}),
    ...(entry.descriptionOverride ? { descriptionOverride: entry.descriptionOverride } : {}),
    ...(entry.relationOverride ? { relationOverride: entry.relationOverride } : {}),
    ...(entry.relationSuffix ? { relationSuffix: entry.relationSuffix } : {}),
    ...(entry.accessNote ? { accessNote: entry.accessNote } : {}),
    ...(entry.extraSources ? { extraSources: entry.extraSources } : {}),
  });
}
assert.equal(reconciled.filter((item) => item.mainExcelRow).length, masterRows.length, "Every nonblank main row must be reconciled");
const publication = CulturalCaseCollectionSchema.parse(allCases.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
const published = publication.filter((item) => item.verificationStatus === "verified");
const supplementalSummary = numberedRows("补采汇总");
const supplementalCoverage = numberedRows("24节气覆盖表");
assert.deepEqual(supplementalSummary.map((row) => row.values[1]), SOLAR_TERMS.map((term) => term.name));
assert.deepEqual(supplementalCoverage.map((row) => row.values[1]), SOLAR_TERMS.map((term) => term.name));
const termCounts = SOLAR_TERMS.map((term, index) => {
  const summaryRow = supplementalSummary[index];
  const count = published.filter((item) => item.solarTermIds.includes(term.id)).length;
  const selected = primary.find((item) => item.solarTermId === term.id);
  const mainTitle = masterRows.find((row) => row.serial === selected.serial).values[1];
  assert.equal(mainTitle, supplementalCoverage[index].values[2]);
  assert.equal(summaryRow.values[2], visible.filter((item) => item.solarTermIds.includes(term.id)).length);
  assert.equal(summaryRow.values[3], supplementalRows.filter((row) => row.values[1] === term.name).length);
  return { solarTermId: term.id, name: term.name, verified: count, workbookTarget: summaryRow.values[4],
    primaryCaseId: selected.caseId, workbookCandidateCount: supplementalCoverage[index].values[8], actualCandidateCount: count - 1 };
});
const missingFromMaster = reconciled.filter((item) => item.supplementSerial && !item.mainExcelRow);
const manifest = {
  workbookSha256: supplementArchive.sha256, intakeDigest: supplementReview.intakeDigest, baselineCommit: "482ac19b71a8edcd4f837475b99fe739ab1f3c76",
  sheetsChecked: Object.keys(supplementArchive.sheets), mainRows: masterRows.length, supplementalRows: supplementalRows.length,
  duplicatedAcrossSheets: supplementalRows.length - missingFromMaster.length, uniqueOriginalRows: reconciled.length,
  before: { verified: visible.length, pending: cases.length - visible.length },
  changes: { added: published.length - visible.length, oldFieldsUpdated: new Set((supplementReview.existingSourceNotes ?? []).map((entry) => entry.id)).size, merged: reconciled.filter((item) => item.mergeInto).length,
    withheld: publication.filter((item) => item.verificationStatus === "pending").length, missingFromMaster: missingFromMaster.map((item) => item.id) },
  after: { verified: published.length, pending: publication.length - published.length }, termCounts, rows: reconciled,
};
const supplementReport = [
  "# 补采表入库与逐条差异清单", "",
  `基线：\`${manifest.baselineCommit}\`。五张工作表均已读取；原始单元格及所有整理备注见 [intake.json](intake.json)。原表 SHA-256：\`${manifest.workbookSha256}\`。`, "",
  `原站公开 ${visible.length} 条、待核验 ${cases.length - visible.length} 条。本轮新增公开 ${manifest.changes.added} 条；${manifest.changes.oldFieldsUpdated} 条旧案例补充来源访问提示，旧正文、来源题名、机构、URL及ID均未覆盖（旧47行内容完全一致，仅3个状态标签改写）。最终公开 ${published.length} 条、待核验 ${publication.length - published.length} 条。`, "",
  `主明细实际 ${masterRows.length} 行，补采表 ${supplementalRows.length} 行，其中 ${manifest.duplicatedAcrossSheets} 行同时存在于主表。去掉跨表重复后共有 ${reconciled.length} 条整理记录：绍兴黄酒开酿仪式与原冬酿实体合并1条；新郑大枣、黄陵面花2条仍为pending，不进入接口和AI知识源。`, "",
  `主表缺失的3条已从补采表恢复：${missingFromMaster.map((item) => item.title).join("、")}。主表标题所称“80行”不是实际明细行数；两表合并后才达到80行。`, "",
  "## 24节气覆盖", "", "| 节气 | 公开 | 补采汇总目标 | 覆盖表候选数 | 实际候选数 |", "| --- | ---: | ---: | ---: | ---: |",
  ...termCounts.map((term) => `| ${term.name} | ${term.verified} | ${term.workbookTarget} | ${term.workbookCandidateCount} | ${term.actualCandidateCount} |`), "",
  "覆盖表的惊蛰与立冬候选数各多记1条：真实分别为主选1+候选2。以补采汇总与逐条实体核算为准，不复制错误统计。", "",
  "## 地域、介绍及来源处理", "",
  "- 占稻色与送花神为跨省区域性资料。主省仅为旧接口兼容锚点，其余省通过relatedProvinceCodes关联；详情保留区域范围，不编造县市或坐标。",
  "- 天津、北京的市级案例直接以表内明确的城市作为regionName；北京立冬饺子的丰台区来自该行简介。",
  "- 新案例保留完整原始简介，仅将疗效、占卜与实时花情等内容作有依据的限定。徐州伏羊原表含非逐字摘录和该来源未证实细节，展示收紧为原文支持的小暑江苏吃暑羊及2021年徐州伏羊非遗。全部替换前文字保留在intake.json，具体展示取舍、原始来源日期和备注可在review.json与manifest.json逐一追溯。",
  "- 原有有效案例与校正来源保持原样；旧表中未能对应或存在访问问题的原始链接仍完整保留在两批intake，不以错误标题覆盖既有核查结果。新增33条均保留原链接与来源机构，无图片授权即不生成imageUrl。",
  "- 佛山大寒糯米饭原链本次进入升级页，仍依素材表既有核实记录收录，本次未独立读到正文；资兴政府原链412，已补入读取正文的农大文化整理稿；梅花山本机403而网页检索可读。三条原链接都保留accessNote供详情展示，未宣称全部33条原链在本轮均可打开。",
  "- 链接可用性复核与尚未完成的来源核验见同目录source-checks.json和最终全站检查报告；网页暂时不可达不等同内容不存在，不能把HTTP状态当作正文核验。", "",
  "## 逐条处理台账", "", "| ID | 案例 | 主表行 | 补采行 | 原整理状态 | 处置 | 核查及限定 |", "| --- | --- | ---: | ---: | --- | --- | --- |",
  ...reconciled.map((item) => `| ${item.id} | ${item.title} | ${item.mainExcelRow ?? "—"} | ${item.supplementExcelRow ?? "—"} | ${item.editorialStatus} | ${item.outcome} | ${item.reason} |`), "",
].join("\n");
const regionalCases = VerifiedCulturalCaseSchema.array().parse(read("docs/cultural-sources/2026-11-15/reviewed-cases.json"));
const currentPublication = CulturalCaseCollectionSchema.parse([...publication, ...regionalCases]
  .sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
const outputs = new Map([
  [batch + "report.md", report.join("\n")],
  [runtime + "primary.json", format(primary)],
  [supplementBatch + "manifest.json", format(manifest)],
  [supplementBatch + "report.md", supplementReport],
  [runtime + "cases.json", format(currentPublication)],
]);
console.log(summary);
console.log(`补采表新增公开 ${manifest.changes.added} 条，省级覆盖新增 ${regionalCases.length} 条，最终公开 ${published.length + regionalCases.length} 条。`);
for (const [path, content] of outputs) {
  const destination = fileURLToPath(new URL(path, root));
  let current;
  try { current = readFileSync(destination, "utf8").replaceAll("\r\n", "\n"); }
  catch (error) { if (error.code !== "ENOENT") throw error; }
  if (current === content) continue;
  if (args[0] === "--check") throw new Error(`Generated file is stale: ${path}`);
  console.log(`${args[0] === "--write" ? "Writing" : "Would write"} ${path}`);
  if (args[0] === "--write") {
    // Validate the whole batch above; replace the public file last and atomically.
    const temporary = destination + "." + randomUUID() + ".tmp";
    try { writeFileSync(temporary, content, { flag: "wx" }); renameSync(temporary, destination); }
    finally { rmSync(temporary, { force: true }); }
  }
}
