// Offline publication of the reviewed November batch. Only cases.json is read by the API.
import "../tests/register-ts.mjs";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
const { CulturalCaseCollectionSchema, CulturalCaseIdSchema } = await import("../lib/contracts/cultural-case.ts");
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
const outputs = new Map([
  [batch + "report.md", report.join("\n")],
  [runtime + "primary.json", format(primary)],
  [runtime + "cases.json", format(cases)],
]);
console.log(summary);
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
