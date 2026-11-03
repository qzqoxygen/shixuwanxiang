// Opt-in smoke check against a running Next.js server; excluded from npm test.
// Usage: node tests/cultural-cases-http.mjs http://127.0.0.1:3107
import "./register-ts.mjs";
import assert from "node:assert/strict";
const { CaseListResponseSchema, CaseDetailResponseSchema, ApiFailureSchema } = await import("../lib/contracts/cultural-case.ts");
const base = process.argv[2] ?? "http://127.0.0.1:3000";
let checks = 0;

async function get(suffix, status, schema) {
  const response = await fetch(new URL(`/api/cultural-cases${suffix}`, base), { signal: AbortSignal.timeout(15000) });
  assert.equal(response.status, status, suffix);
  assert.equal(response.headers.get("cache-control"), "no-store", suffix);
  assert.match(response.headers.get("content-type"), /^application\/json/, suffix);
  const body = await response.json();
  schema.parse(body);
  checks++;
  return body;
}

const all = await get("", 200, CaseListResponseSchema);
assert.equal(all.total, 7);
assert.deepEqual(all.items.map((item) => item.id), all.items.map((item) => item.id).sort());
assert.ok(all.items.find((item) => item.id === "suzhou-dongzhi-winter-wine").sources.some((source) => source.url === "https://news.cau.edu.cn/zhxwnew/601643.htm"));
for (const item of all.items) {
  assert.equal(Object.hasOwn(item, "imageUrl"), false);
  assert.equal(item.verificationStatus, "verified");
  assert.deepEqual((await get(`/${item.id}`, 200, CaseDetailResponseSchema)).item, item);
}
const combined = await get("?solarTermId=qingming&provinceCode=310000&category=food&keyword=%E9%9D%92%E5%9B%A2&limit=1", 200, CaseListResponseSchema);
assert.equal(combined.total, 1);
assert.equal(combined.items[0].id, "shanghai-qingming-qingtuan");
assert.equal(combined.items[0].sources[0].url, "https://www.ihchina.cn/Article/Index/detail?id=10041");
const page = await get("?offset=1&limit=2", 200, CaseListResponseSchema);
assert.equal(page.total, 7);
assert.deepEqual(page.items, all.items.slice(1, 3));
for (const suffix of ["?solarTermId=qiufen", "?provinceCode=230000", "?keyword=%E6%BC%A0%E6%B2%B3", "?solarTermId=lichun&provinceCode=710000"]) {
  const body = await get(suffix, 200, CaseListResponseSchema);
  assert.deepEqual(body.items, []);
  assert.equal(body.total, 0);
}
const beyond = await get("?offset=9007199254740991", 200, CaseListResponseSchema);
assert.equal(beyond.total, 7);
assert.deepEqual(beyond.items, []);
for (const suffix of ["?limit=0", "?limit=21", "?offset=-1", "?offset=1e2", "?offset=9007199254740992", "?limit=1&limit=2", "?provinceCode=100000_JD", "?provinceCode=999999", "?solarTermId=Qingming", "?extra=x", "?keyword=" + "x".repeat(101)]) {
  assert.equal((await get(suffix, 400, ApiFailureSchema)).error.code, "INVALID_INPUT");
}
const missing = await get("/missing-case", 404, ApiFailureSchema);
assert.deepEqual(await get("/mohe-xiazhi-white-night", 404, ApiFailureSchema), missing);
assert.deepEqual(await get("/lingnan-qiufen-autumn-soup", 404, ApiFailureSchema), missing);
for (const path of ["/Uppercase", "/a%2Fb", "/%2573anmen-jidong", "/" + "x".repeat(65)]) {
  assert.equal((await get(path, 400, ApiFailureSchema)).error.code, "INVALID_INPUT");
}
assert.equal((await get("/%73anmen-jidong", 200, CaseDetailResponseSchema)).item.id, "sanmen-jidong");
console.log(`PASS: ${checks} real HTTP checks at ${base}; verified-only results, sources, optional images, pagination, empty results, JSON errors and decoded IDs.`);
