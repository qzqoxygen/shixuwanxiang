import "./register-ts.mjs";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { test } from "node:test";
const { SOLAR_TERMS } = await import("../lib/solar-terms.ts");
const { SUPPORTED_PROVINCES } = await import("../lib/provinces.ts");
const { readCulturalCases } = await import("../lib/server/cultural-cases.ts");
const { queryCulturalCases, findVerifiedCulturalCase } = await import("../lib/server/cultural-case-query.ts");

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
const archive = read("../docs/cultural-sources/2026-11-12/intake.json");
const review = read("../docs/cultural-sources/2026-11-12/review.json");
const manifest = read("../docs/cultural-sources/2026-11-12/manifest.json");
const regionalCases = read("../docs/cultural-sources/2026-11-15/reviewed-cases.json");
const legacy = read("../docs/cultural-sources/2026-11-06/review.json").rows;
const cases = readCulturalCases();
const published = cases.filter((item) => item.verificationStatus === "verified");
const byId = new Map(cases.map((item) => [item.id, item]));
const numbered = (name) => archive.sheets[name].filter((row) => /^\d+$/u.test(String(row[0])));
const supplements = numbered("补采案例");

test("all five workbook sheets are archived and both detail tables reconcile instead of trusting the title", () => {
  assert.deepEqual(Object.keys(archive.sheets), ["案例明细表", "24节气覆盖表", "说明与交付备注", "补采案例", "补采汇总"]);
  assert.equal(createHash("sha256").update(JSON.stringify(archive)).digest("hex"), review.intakeDigest);
  const main = numbered("案例明细表");
  assert.equal(main.length, 77);
  assert.equal(supplements.length, 33);
  const mainTitles = new Set(main.map((row) => row[1]));
  const missing = supplements.filter((row) => !mainTitles.has(row[2])).map((row) => row[2]);
  assert.deepEqual(missing, ["鲁北“碌碡顶了门，光喝红黏粥”", "南京大雪吃大萝卜·萝卜圆子", "北京地坛夏至祭地"]);
  assert.equal(new Set([...main.map((row) => row[2] + row[1]), ...supplements.map((row) => row[1] + row[2])]).size, 80);
  assert.equal(manifest.duplicatedAcrossSheets, 30);
  assert.equal(manifest.rows.length, 80);
  for (const row of main) assert.equal(manifest.rows.filter((item) => item.mainSerial === Number(row[0])).length, 1);
  for (const row of supplements) assert.equal(manifest.rows.filter((item) => item.supplementSerial === Number(row[0])).length, 1);
});

test("the publication retains the workbook coverage and adds twenty regional cases", () => {
  assert.equal(published.length, 97);
  assert.equal(cases.length, 99);
  assert.equal(new Set(cases.map((item) => item.id)).size, cases.length);
  assert.equal(new Set(published.map((item) => item.title)).size, published.length);
  for (const term of SOLAR_TERMS) {
    const count = published.filter((item) => item.solarTermIds.includes(term.id)).length;
    const workbookCount = numbered("补采汇总").find((row) => row[1] === term.name)[4];
    const addedCount = regionalCases.filter((item) => item.solarTermIds.includes(term.id)).length;
    assert.equal(count, workbookCount + addedCount, term.name);
  }
  assert.deepEqual(manifest.termCounts.filter((row) => row.workbookCandidateCount !== row.actualCandidateCount).map((row) => row.solarTermId), ["jingzhe", "lidong"]);
});

test("every supported province has coverage and new cases resolve with their original sources", () => {
  const expectedCases = [
    ["210000", "qiufen", "panjin-qiufen-harvest-festival"],
    ["220000", "dongzhi", "chagan-dongzhi-winter-fishing"],
    ["410000", "lichun", "neixiang-lichun-spring-ox"],
    ["420000", "guyu", "hefeng-guyu-wuli-tea-harvest"],
    ["460000", "lichun", "haikou-lichun-museum-night"],
    ["500000", "dongzhi", "rongchang-dongzhi-lamb-soup-festival"],
    ["530000", "guyu", "honghe-guyu-kaiyangmen"],
    ["630000", "qiufen", "hualong-qiufen-highland-barley"],
    ["650000", "dongzhi", "urumqi-dongzhi-dawan-dumplings"],
    ["130000", "mangzhong", "weixian-mangzhong-wheat-harvest"],
    ["140000", "qingming", "jiexiu-qingming-hanshi"],
    ["150000", "qiufen", "ulanhada-qiufen-harvest-opening"],
    ["540000", "qiufen", "lhasa-najin-qiufen-barley-celebration"],
    ["620000", "qiufen", "tianshui-maiji-qiufen-huaniu-apples"],
    ["820000", "dongzhi", "macao-dongzhi-family-reunion"],
    ["430000", "chunfen", "hongjiang-chunfen-egg-standing"],
    ["320000", "qingming", "nantong-qingming-banyao-kites"],
    ["350000", "xiazhi", "fuzhou-xiazhi-guobianhu"],
    ["320000", "bailu", "nanjing-bailu-autumn-tea"],
    ["110000", "dongzhi", "beijing-dongzhi-temple-of-heaven"],
  ];
  const covered = new Set(published.flatMap(({ provinceCode, relatedProvinceCodes = [] }) => [provinceCode, ...relatedProvinceCodes]));
  assert.deepEqual(covered, new Set(SUPPORTED_PROVINCES.map(({ code }) => code)));
  for (const [provinceCode, solarTermId, caseId] of expectedCases) {
    const sourceRecord = regionalCases.find((item) => item.id === caseId);
    const detail = findVerifiedCulturalCase(cases, caseId);
    assert.deepEqual(detail, sourceRecord, caseId);
    const result = queryCulturalCases(cases, { provinceCode, solarTermId, offset: 0, limit: 20 });
    assert.deepEqual(result.items.find((item) => item.id === caseId), detail, caseId);
  }
});

test("old verified/pending identities, corrected descriptions and all reviewed sources survive the supplement", () => {
  for (const decision of legacy) {
    const item = byId.get(decision.id);
    assert.ok(item, decision.id);
    assert.equal(item.verificationStatus, decision.status, decision.id);
    if (!decision.mergeInto) {
      assert.equal(item.description, decision.description, decision.id);
      assert.equal(item.relationNote, decision.relationNote, decision.id);
    }
    for (const source of decision.sources) {
      const candidate = item.sources.find((entry) => entry.url === source.url);
      assert.ok(candidate, source.url);
      const originalFields = { ...candidate };
      delete originalFields.accessNote;
      assert.deepEqual(originalFields, source);
    }
  }
  assert.deepEqual(manifest.before, { verified: 44, pending: 2 });
  assert.deepEqual(manifest.after, { verified: 77, pending: 2 });
  assert.equal(manifest.changes.oldFieldsUpdated, 4);
  assert.equal(review.existingSourceNotes.length, 4);
  for (const note of review.existingSourceNotes) {
    assert.equal(byId.get(note.id).sources.find((source) => source.url === note.url)?.accessNote, note.accessNote);
    assert.match(note.accessNote, /2026-11-12/);
  }
  assert.equal(manifest.changes.added, 33);
  assert.equal(manifest.changes.merged, 1);
  assert.equal(manifest.changes.withheld, 2);
});

test("every supplement retains its full introduction, precise sources and traceable editorial qualifications", () => {
  assert.equal(review.rows.length, 33);
  for (const decision of review.rows) {
    const row = supplements.find((row) => row[0] === decision.serial);
    const item = byId.get(decision.id);
    let fullDescription = decision.descriptionOverride ?? row[6];
    for (const [from, to] of decision.replacements ?? []) {
      assert.ok(fullDescription.includes(from), decision.id);
      fullDescription = fullDescription.replace(from, to);
    }
    assert.equal(item.title, row[2]);
    assert.deepEqual(item.solarTermIds, [SOLAR_TERMS.find((term) => term.name === row[1]).id]);
    assert.equal(item.description, fullDescription);
    assert.equal(item.relationNote, (decision.relationOverride ?? row[7]) + (decision.relationSuffix ? `\n${decision.relationSuffix}` : ""));
    assert.deepEqual(item.sources, [{ title: row[8], publisher: row[9], url: row[11], ...(decision.accessNote ? { accessNote: decision.accessNote } : {}) }, ...(decision.extraSources ?? [])]);
    assert.equal(Object.hasOwn(item, "imageUrl"), false);
    const trace = manifest.rows.find((entry) => entry.supplementSerial === decision.serial);
    assert.equal(trace.editorialStatus, row[12]);
    assert.equal(trace.originalNote, row[13]);
    assert.equal(trace.sourcePublishedAt, row[10]);
    assert.equal(trace.accessNote, decision.accessNote);
    assert.equal(trace.descriptionOverride, decision.descriptionOverride);
    assert.equal(trace.relationOverride, decision.relationOverride);
    assert.deepEqual(trace.extraSources, decision.extraSources);
  }
});

test("unavailable original links remain marked and unsupported Xuzhou details do not become verified display facts", () => {
  for (const serial of [18, 27, 33]) {
    const decision = review.rows.find((row) => row.serial === serial);
    const item = byId.get(decision.id);
    const original = supplements.find((row) => row[0] === serial);
    assert.equal(item.sources[0].url, original[11]);
    assert.match(item.sources[0].accessNote, /2026-11-12/);
  }
  assert.ok(byId.get("zixing-bailu-rice-wine").sources.some((source) => source.url === "https://news.cau.edu.cn/zhxwnew/584965.htm"));
  const lamb = byId.get("xuzhou-xiaoshu-lamb-custom");
  assert.doesNotMatch(lamb.description + lamb.relationNote, /最核心|持续一个月|小山羊|大锅清水/);
  assert.match(lamb.description, /江苏/);
  assert.match(lamb.description, /2021年/);
  assert.match(supplements.find((row) => row[0] === 24)[6], /持续一个月/);
});

test("all supplement titles are searchable and excluded or merged rows never create public duplicates", () => {
  for (const decision of review.rows) {
    const item = byId.get(decision.id);
    const response = queryCulturalCases(cases, { keyword: item.title, solarTermId: item.solarTermIds[0], offset: 0, limit: 20 });
    assert.ok(response.items.some((entry) => entry.id === item.id), item.id);
    assert.equal(findVerifiedCulturalCase(cases, item.id)?.id, item.id);
  }
  for (const id of ["xinzheng-jujube-harvest", "huangling-flower-buns"]) {
    assert.equal(findVerifiedCulturalCase(cases, id), undefined);
    assert.equal(queryCulturalCases(cases, { keyword: byId.get(id).title, offset: 0, limit: 20 }).total, 0);
  }
  const wineDecisions = legacy.filter((row) => [39, 40].includes(row.serial));
  assert.equal(wineDecisions[0].id, wineDecisions[1].id);
  assert.equal(published.filter((item) => item.id === wineDecisions[0].id).length, 1);
});

test("new locations join supported map codes without fabricated county or point coordinates", () => {
  const codes = new Set(SUPPORTED_PROVINCES.map((item) => item.code));
  for (const decision of review.rows) {
    const item = byId.get(decision.id);
    assert.ok(codes.has(item.provinceCode), item.id);
    for (const code of item.relatedProvinceCodes ?? []) assert.ok(codes.has(code));
    assert.equal(Object.hasOwn(item, "latitude") || Object.hasOwn(item, "longitude"), false);
  }
  const rice = byId.get("south-china-yushui-rice-divination");
  assert.equal(rice.provinceCode, "440000");
  assert.deepEqual(rice.relatedProvinceCodes, ["350000", "450000"]);
  assert.match(rice.regionName, /未落实县市/);
  const flower = byId.get("jiangnan-mangzhong-flower-farewell");
  assert.equal(flower.provinceCode, "320000");
  assert.deepEqual(flower.relatedProvinceCodes, ["330000"]);
  assert.match(flower.regionName, /未落实县市/);
  for (const item of [rice, flower]) for (const provinceCode of [item.provinceCode, ...item.relatedProvinceCodes]) {
    assert.ok(queryCulturalCases(cases, { provinceCode, keyword: item.title, offset: 0, limit: 20 }).items.some((match) => match.id === item.id));
  }
});

test("the importer remains reproducible and cannot silently restore the superseded 44-case publication", () => {
  const result = execFileSync(process.execPath, ["scripts/import-cultural-cases.mjs", "--check"], { cwd: new URL("../", import.meta.url), encoding: "utf8" });
  assert.match(result, /最终公开 97 条/);
});
