import "./register-ts.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";
const { SOLAR_TERMS } = await import("../lib/solar-terms.ts");
const names = "立春 雨水 惊蛰 春分 清明 谷雨 立夏 小满 芒种 夏至 小暑 大暑 立秋 处暑 白露 秋分 寒露 霜降 立冬 小雪 大雪 冬至 小寒 大寒".split(" ");
test("24 terms in traditional order, with unique stable IDs and names", () => {
  assert.equal(SOLAR_TERMS.length, 24);
  assert.deepEqual(SOLAR_TERMS.map(t => t.name), names);
  assert.equal(new Set(SOLAR_TERMS.map(t => t.id)).size, 24);
  for (const term of SOLAR_TERMS) assert.match(term.id, /^[a-z]+$/);
});
test("seasons each contain exactly six terms in correct order", () => {
  for (const [index, season] of ["spring", "summer", "autumn", "winter"].entries()) {
    assert.deepEqual(SOLAR_TERMS.filter(t => t.season === season).map(t => t.name), names.slice(index * 6, index * 6 + 6));
  }
});
test("longitudes start at 315 degrees, advance by 15 and wrap correctly", () => {
  SOLAR_TERMS.forEach((term, index) => {
    assert.equal(term.solarLongitude, (315 + index * 15) % 360);
    assert.ok(term.solarLongitude >= 0 && term.solarLongitude < 360);
  });
});
test("only Qingming, Xiazhi, Qiufen and Dongzhi are featured", () => {
  assert.deepEqual(SOLAR_TERMS.filter(t => t.isFeatured).map(t => t.name), ["清明", "夏至", "秋分", "冬至"]);
  assert.equal(SOLAR_TERMS.filter(t => !t.isFeatured).length, 20);
  for (const term of SOLAR_TERMS) assert.ok(term.description?.trim());
});
