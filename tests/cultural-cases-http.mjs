// Opt-in smoke check against a running Next.js server; excluded from npm test.
// Usage: node tests/cultural-cases-http.mjs http://127.0.0.1:3107
import "./register-ts.mjs";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const { CaseListResponseSchema, CaseDetailResponseSchema, ApiFailureSchema } = await import("../lib/contracts/cultural-case.ts");
const { fetchProvinceCaseCounts } = await import("../lib/cultural-case-client.ts");
const { SOLAR_TERMS } = await import("../lib/solar-terms.ts");
const base = process.argv[2] ?? "http://127.0.0.1:3000";
let checks = 0;

async function request(path, options) {
  const response = await fetch(new URL(path, base), options);
  assert.equal(response.headers.get("cache-control"), "no-store", path);
  assert.match(response.headers.get("content-type"), /^application\/json/, path);
  checks++;
  return response;
}

async function get(suffix, status, schema) {
  const response = await request(`/api/cultural-cases${suffix}`, { signal: AbortSignal.timeout(15000) });
  assert.equal(response.status, status, suffix);
  const body = await response.json();
  schema.parse(body);
  return body;
}

const local = JSON.parse(readFileSync(new URL("../data/cultural-cases/cases.json", import.meta.url), "utf8"));
const published = local.filter((item) => item.verificationStatus === "verified");
const expectedIds = published.map((item) => item.id).sort();
const all = [];
const first = await get("", 200, CaseListResponseSchema);
assert.equal(first.limit, 10);
assert.equal(first.offset, 0);
assert.equal(first.total, expectedIds.length);
for (let offset = 0; offset < expectedIds.length; offset += first.limit) {
  const page = offset === 0 ? first : await get(`?offset=${offset}`, 200, CaseListResponseSchema);
  assert.equal(page.total, expectedIds.length);
  assert.equal(page.offset, offset);
  assert.equal(page.limit, first.limit);
  assert.deepEqual(page.items.map((item) => item.id), expectedIds.slice(offset, offset + first.limit));
  all.push(...page.items);
}
assert.deepEqual(all.map((item) => item.id), expectedIds);
assert.equal(new Set(expectedIds).size, all.length);
for (const item of all) {
  assert.equal(Object.hasOwn(item, "imageUrl"), false);
  assert.equal(item.verificationStatus, "verified");
  assert.deepEqual((await get(`/${item.id}`, 200, CaseDetailResponseSchema)).item, item);
}
for (const [term, province, titlePart] of [
  ["lichun", "330000", "九华"], ["jingzhe", "810000", "打小人"], ["qingming", "310000", "青团"],
  ["qiufen", "110000", "祭月"], ["dongzhi", "330000", "祭冬"],
]) {
  const body = await get(`?solarTermId=${term}&provinceCode=${province}`, 200, CaseListResponseSchema);
  const matches = published.filter((item) => item.solarTermIds.includes(term) && (item.provinceCode === province || item.relatedProvinceCodes?.includes(province)));
  assert.equal(body.total, matches.length);
  assert.deepEqual(body.items.map((item) => item.id), matches.map((item) => item.id).sort().slice(0, body.limit));
  assert.ok(body.items.some((item) => item.title.includes(titlePart)), `${term}/${province}: ${titlePart}`);
}
// Use the map's actual client and check its per-province totals against the release file.
for (const term of SOLAR_TERMS) {
  const expected = new Map();
  for (const item of published.filter((item) => item.solarTermIds.includes(term.id))) {
    for (const code of [item.provinceCode, ...(item.relatedProvinceCodes ?? [])]) {
      expected.set(code, (expected.get(code) ?? 0) + 1);
    }
  }
  const actual = await fetchProvinceCaseCounts(term.id, AbortSignal.timeout(15000), request);
  assert.deepEqual(actual, expected, term.id);
}
const combined = await get("?solarTermId=qingming&provinceCode=310000&category=food&keyword=%E9%9D%92%E5%9B%A2&limit=1", 200, CaseListResponseSchema);
assert.equal(combined.total, 1);
assert.equal(combined.items[0].id, "shanghai-qingming-qingtuan");
const page = await get("?offset=1&limit=2", 200, CaseListResponseSchema);
assert.equal(page.total, published.length);
assert.deepEqual(page.items, all.slice(1, 3));
for (const suffix of ["?solarTermId=qingming&provinceCode=540000", "?solarTermId=qiufen&provinceCode=410000&keyword=砑枣", "?solarTermId=dongzhi&provinceCode=610000&keyword=面花"]) {
  const body = await get(suffix, 200, CaseListResponseSchema);
  assert.deepEqual(body.items, []);
  assert.equal(body.total, 0);
}
const beyond = await get("?offset=9007199254740991", 200, CaseListResponseSchema);
assert.equal(beyond.total, published.length);
assert.deepEqual(beyond.items, []);
for (const suffix of ["?limit=0", "?limit=21", "?offset=-1", "?offset=1e2", "?offset=9007199254740992", "?limit=1&limit=2", "?provinceCode=100000_JD", "?provinceCode=999999", "?solarTermId=Qingming", "?extra=x", "?keyword=" + "x".repeat(101)]) {
  assert.equal((await get(suffix, 400, ApiFailureSchema)).error.code, "INVALID_INPUT");
}
const missing = await get("/missing-case", 404, ApiFailureSchema);
assert.equal(missing.error.code, "CASE_NOT_FOUND");
for (const item of local.filter((item) => item.verificationStatus === "pending")) {
  assert.deepEqual(await get(`/${item.id}`, 404, ApiFailureSchema), missing);
}
for (const path of ["/Uppercase", "/a%2Fb", "/%2573anmen-jidong", "/" + "x".repeat(65)]) {
  assert.equal((await get(path, 400, ApiFailureSchema)).error.code, "INVALID_INPUT");
}
assert.equal((await get("/%73anmen-jidong", 200, CaseDetailResponseSchema)).item.id, "sanmen-jidong");
console.log(`PASS: ${checks} real HTTP requests at ${base}; ${published.length} verified cases and details, nationwide pagination, 5 term/province selections, all 24 map counts, no images, hidden pending, empty results and JSON errors.`);
