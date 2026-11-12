import "./register-ts.mjs";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
const { SOLAR_TERMS } = await import("../lib/solar-terms.ts");

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
const { sheets } = read("../docs/cultural-sources/2026-11-06/intake.json");
const raw = sheets["案例明细表"].slice(2);
const { rows } = read("../docs/cultural-sources/2026-11-06/review.json");
const reviewed = new Map(rows.map((row) => [row.serial, row]));
const primary = read("../data/cultural-cases/primary.json");
const cases = read("../data/cultural-cases/cases.json");
const byId = new Map(cases.map((item) => [item.id, item]));

test("every one of the 47 original rows has a decision; Tianjin pear only appears after its collected supplement", () => {
  assert.deepEqual(raw.map((row) => row[0]).sort((a, b) => a - b), rows.map((row) => row.serial).sort((a, b) => a - b));
  assert.equal(reviewed.size, 47);
  assert.equal(reviewed.has(17), false);
  assert.deepEqual(["主选", "候选", "待核验"].map((tag) => raw.filter((row) => row[12] === tag).length), [24, 21, 2]);
  assert.equal(rows.some((row) => row.id === "tianjin-jingzhe-pears"), false);
  const supplement = read("../docs/cultural-sources/2026-11-12/intake.json").sheets["补采案例"];
  const pear = byId.get("tianjin-jingzhe-pears");
  const collectedPear = supplement.find((row) => row[2] === "天津惊蛰吃梨");
  assert.ok(collectedPear, "A coverage-sheet title alone must not synthesize a case");
  assert.equal(pear?.provinceCode, "120000");
  assert.deepEqual(pear?.solarTermIds, ["jingzhe"]);
  assert.equal(pear?.sources[0].url, collectedPear[11]);
  for (const row of rows) {
    const item = byId.get(row.id);
    if (row.status === "draft") assert.equal(item, undefined, row.id);
    else assert.equal(item?.verificationStatus, row.status, row.id);
  }
});

test("primary references join each term to the workbook selection and a public case", () => {
  assert.deepEqual(primary.map((entry) => entry.solarTermId).sort(), SOLAR_TERMS.map((term) => term.id).sort());
  const coverage = sheets["24节气覆盖表"].slice(2);
  for (const entry of primary) {
    const sourceRow = sheets["案例明细表"][entry.excelRow - 1];
    const term = SOLAR_TERMS.find((term) => term.id === entry.solarTermId);
    assert.equal(sourceRow[0], entry.serial);
    assert.equal(sourceRow[2], term.name);
    assert.equal(sourceRow[12], "主选");
    assert.equal(sourceRow[1], coverage.find((row) => row[1] === term.name)[2]);
    assert.equal(reviewed.get(entry.serial).id, entry.caseId);
    const item = byId.get(entry.caseId);
    assert.equal(item?.verificationStatus, "verified", term.name);
    assert.ok(item.solarTermIds.includes(entry.solarTermId), term.name);
  }
});

test("the revised autumn soup keeps its legacy ID and the lake and Yizheng cases use their supported locations", () => {
  const soup = byId.get(reviewed.get(7).id);
  assert.equal(soup.id, "lingnan-qiufen-autumn-soup");
  assert.equal(soup.provinceCode, "440000");
  assert.match(soup.regionName, /开平/);
  assert.ok(soup.solarTermIds.includes("qiufen"));
  const lake = byId.get(reviewed.get(36).id);
  assert.equal(lake.provinceCode, "320000");
  assert.match(lake.regionName, /苏州/);
  assert.match(lake.regionName, /太湖/);
  const yizheng = byId.get(reviewed.get(41).id);
  assert.equal(yizheng.provinceCode, "320000");
  assert.match(yizheng.regionName, /仪征/);
});

test("merged Shaoxing sources and the entire four-parameter Nanjing source survive conversion", () => {
  assert.equal(reviewed.get(40).mergeInto, 39);
  assert.equal(reviewed.get(40).id, reviewed.get(39).id);
  const wine = byId.get(reviewed.get(39).id);
  for (const serial of [39, 40]) {
    const original = new URL(raw.find((row) => row[0] === serial)[10]);
    assert.ok(wine.sources.some((source) => {
      const url = new URL(source.url);
      return url.host === original.host && url.pathname === original.pathname;
    }), String(serial));
  }
  const originalUrl = raw.find((row) => row[0] === 44)[10];
  assert.equal(new URL(originalUrl).searchParams.size, 4);
  assert.ok(byId.get(reviewed.get(44).id).sources.some((source) => source.url === originalUrl));
});

test("source titles stay associated with the right article when workbook metadata is incomplete", () => {
  const altar = byId.get(reviewed.get(6).id);
  const travel = altar.sources.find((source) => source.url === "https://www.visitbeijing.com.cn/article/47Qou8Zh4k4");
  assert.match(travel?.title ?? "", /明清时皇家月坛祭的是哪一位神/);
  const rawHongKong = raw.find((row) => row[0] === 16);
  assert.match(rawHongKong[8], /春雷响，万物长/);
  const hongKong = byId.get(reviewed.get(16).id);
  assert.ok(hongKong.sources.every((source) => !source.title.includes("春雷响，万物长")));
});
