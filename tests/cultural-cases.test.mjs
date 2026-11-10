import "./register-ts.mjs";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
const {
  SolarTermIdSchema, ProvinceCodeSchema, CulturalCaseIdSchema, CulturalCategorySchema,
  CulturalCaseSchema, CulturalCaseCollectionSchema, VerifiedCulturalCaseSchema,
  CaseListQuerySchema, parseCaseListQuery, CaseListResponseSchema, CaseDetailResponseSchema, ApiFailureSchema,
} = await import("../lib/contracts/cultural-case.ts");
const { SOLAR_TERMS } = await import("../lib/solar-terms.ts");
const { SUPPORTED_PROVINCES } = await import("../lib/provinces.ts");
const { queryCulturalCases, findVerifiedCulturalCase } = await import("../lib/server/cultural-case-query.ts");
const { readCulturalCases } = await import("../lib/server/cultural-cases.ts");
const { GET: listGET } = await import("../app/api/cultural-cases/route.ts");
const { GET: detailGET } = await import("../app/api/cultural-cases/[caseId]/route.ts");

// All artificial cases are test-only; production imports only cases.json.
const fixture = (overrides = {}) => CulturalCaseSchema.parse({
  id: "test-z", title: "测试 Title", solarTermIds: ["qingming"], provinceCode: "330000", provinceName: "浙江省",
  regionName: "测试地域", category: "food", description: "测试 description [literal]", relationNote: "测试 relation",
  sources: [{ title: "测试出处", url: "https://example.test/source" }], verificationStatus: "verified", ...overrides,
});
const fixtures = [
  fixture(),
  fixture({ id: "test-2", title: "第二项", solarTermIds: ["qingming", "xiazhi"], category: "craft" }),
  fixture({ id: "test-10", title: "第一项", provinceCode: "310000", provinceName: "上海市", regionName: "Region Alpha" }),
  fixture({ id: "test-0-pending", verificationStatus: "pending" }),
  fixture({ id: "test-a", solarTermIds: ["dongzhi"], relationNote: "独有依据", imageUrl: "/images/test-only.png" }),
];
const query = (input = {}) => CaseListQuerySchema.parse(input);
const request = (suffix = "") => new Request(`http://localhost:3000/api/cultural-cases${suffix}`);
const detail = (id) => detailGET(request(`/${encodeURIComponent(id)}`), { params: Promise.resolve({ caseId: id }) });

async function checkResponse(response, status, schema) {
  assert.equal(response.status, status);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.match(response.headers.get("content-type"), /^application\/json/);
  const body = await response.json();
  schema.parse(body);
  return body;
}

test("shared solar-term and province whitelists exactly match current data and map features", () => {
  assert.deepEqual(SolarTermIdSchema.options, SOLAR_TERMS.map((term) => term.id));
  const map = JSON.parse(readFileSync(new URL("../data/maps/china-provinces.geo.json", import.meta.url), "utf8"));
  const mapping = map.features.filter((f) => /^\d{6}$/.test(String(f.properties.adcode))).map((f) => ({
    code: String(f.properties.adcode), name: f.properties.name, featureId: String(f.properties.adcode),
  }));
  assert.deepEqual(SUPPORTED_PROVINCES, mapping);
  assert.equal(ProvinceCodeSchema.options.length, 34);
  for (const value of ["100000_JD", "100000", "999999", "3300", 330000, " 330000"]) assert.equal(ProvinceCodeSchema.safeParse(value).success, false);
  for (const value of ["清明", "Qingming", "xia-zhi", "", null]) assert.equal(SolarTermIdSchema.safeParse(value).success, false);
  assert.deepEqual(CulturalCategorySchema.options, ["folk_custom", "agriculture", "craft", "food", "other"]);
});

test("case IDs are stable, case-sensitive ASCII identifiers without automatic correction", () => {
  for (const id of ["0", "case-001", "x".repeat(64)]) assert.equal(CulturalCaseIdSchema.parse(id), id);
  for (const id of ["", "-case", "Case-1", "a_b", "../case", "a/b", "%63ase", " a", "a ", "a\n", "a\r", "a\u2028", "案", "x".repeat(65), null]) {
    assert.equal(CulturalCaseIdSchema.safeParse(id).success, false, String(id));
  }
});

test("case text fields trim whitespace and enforce protocol UTF-16 bounds", () => {
  const base = fixture();
  for (const [field, max] of Object.entries({ title: 100, provinceName: 100, regionName: 100, description: 2000, relationNote: 1000 })) {
    for (const value of ["", " \n ", "x".repeat(max + 1), "😀".repeat(max / 2 + 1), null, undefined]) {
      assert.equal(CulturalCaseSchema.safeParse({ ...base, [field]: value }).success, false, field);
    }
    const value = field === "provinceName" ? "浙江省" : "😀".repeat(max / 2);
    assert.equal(CulturalCaseSchema.parse({ ...base, [field]: ` ${value} ` })[field], value);
  }
  assert.equal(CulturalCaseSchema.safeParse({ ...base, provinceName: "上海市" }).success, false);
  assert.equal(CulturalCaseSchema.safeParse({ ...base, extra: true }).success, false);
  assert.equal(CulturalCaseSchema.safeParse({ ...base, verificationStatus: "approved" }).success, false);
});

test("term arrays require unique valid IDs and a complete record", () => {
  const base = fixture();
  for (const solarTermIds of [[], ["qingming", "qingming"], ["unknown"], Array(25).fill("qingming"), null]) {
    assert.equal(CulturalCaseSchema.safeParse({ ...base, solarTermIds }).success, false);
  }
  assert.equal(CulturalCaseSchema.parse({ ...base, solarTermIds: SOLAR_TERMS.map((t) => t.id) }).solarTermIds.length, 24);
  for (const key of Object.keys(base)) {
    const incomplete = { ...base };
    delete incomplete[key];
    assert.equal(CulturalCaseSchema.safeParse(incomplete).success, false, key);
  }
  assert.equal(VerifiedCulturalCaseSchema.safeParse(fixture({ verificationStatus: "pending" })).success, false);
  assert.equal(CulturalCaseCollectionSchema.safeParse([base, base]).success, false);
});

test("sources require HTTP(S), bounded text and deduplicate the same URL", () => {
  const base = fixture();
  const source = { title: " 来源 ", url: " https://example.test/a ", publisher: " 发布方 " };
  assert.deepEqual(CulturalCaseSchema.parse({ ...base, sources: [source, source] }).sources, [{ title: "来源", url: "https://example.test/a", publisher: "发布方" }]);
  for (const sources of [[], Array(6).fill(source), [{ ...source, title: " " }], [{ ...source, title: "x".repeat(201) }], [{ ...source, publisher: "x".repeat(101) }]]) {
    assert.equal(CulturalCaseSchema.safeParse({ ...base, sources }).success, false);
  }
  for (const url of ["/relative", "https:relative", "javascript:alert(1)", "file:///private", "ftp://example.test/a", "https://", "https://example.test/" + "x".repeat(2048)]) {
    assert.equal(CulturalCaseSchema.safeParse({ ...base, sources: [{ ...source, url }] }).success, false, url.slice(0, 50));
  }
  assert.equal(CulturalCaseSchema.parse({ ...base, sources: [{ ...source, url: "http://example.test/a" }] }).sources.length, 1);
});

test("images may be absent; local images are accepted and unapproved or escaping paths rejected", () => {
  assert.equal(Object.hasOwn(fixture(), "imageUrl"), false);
  assert.equal(fixture({ imageUrl: "/images/test-only.png" }).imageUrl, "/images/test-only.png");
  for (const imageUrl of [null, "", "/images/", "/other/a.png", "//example.test/a.png", "http://example.test/a.png", "https://example.test/a.png", "/images/../private", "/images/%2e%2e/private", "/images/%5c..%5cprivate", "/images/%ZZ", "/images/" + "x".repeat(2048)]) {
    assert.equal(CulturalCaseSchema.safeParse({ ...fixture(), imageUrl }).success, false, String(imageUrl).slice(0, 50));
  }
});

test("query parsing provides defaults, ignores blank keywords and accepts decimal integers", () => {
  assert.deepEqual(parseCaseListQuery(new URLSearchParams()), { offset: 0, limit: 10 });
  const parsed = parseCaseListQuery(new URLSearchParams("solarTermId=qingming&provinceCode=330000&category=food&keyword=%20Title%20&offset=00&limit=20"));
  assert.deepEqual(parsed, { solarTermId: "qingming", provinceCode: "330000", category: "food", keyword: "Title", offset: 0, limit: 20 });
  assert.equal(parseCaseListQuery(new URLSearchParams("keyword=%20%20")).keyword, undefined);
  assert.equal(parseCaseListQuery(new URLSearchParams("offset=9007199254740991")).offset, Number.MAX_SAFE_INTEGER);
});

test("unknown, repeated, case-sensitive and illegal query parameters are rejected", () => {
  const invalid = [
    "unknown=1", "__proto__=1", "constructor=x", "toString=x", "limit=1&limit=1", "keyword=&keyword=", "ProvinceCode=330000",
    "solarTermId=Qingming", "solarTermId=", "provinceCode=100000_JD", "provinceCode=999999", "category=民俗", "category=FOOD", "category=", "keyword=" + "x".repeat(101), "keyword=" + "😀".repeat(51),
    ...["", "-1", "1.5", "1e2", "0x10", "+1", " 1", "1\n", "1\r", "1\u2028", "Infinity", "NaN", "9007199254740992"].map((value) => `offset=${encodeURIComponent(value)}`),
    ...["", "0", "21", "-1", "1.0", "1e1", "0x10", "+1", " 1", "1\n"].map((value) => `limit=${encodeURIComponent(value)}`),
  ];
  for (const input of invalid) assert.throws(() => parseCaseListQuery(new URLSearchParams(input)), undefined, input);
  for (const input of [{ offset: null }, { offset: "1" }, { offset: 1.1 }, { limit: false }, { keyword: null }, { unexpected: true }]) assert.equal(CaseListQuerySchema.safeParse(input).success, false);
});

test("combined filters intersect with multi-term membership before ASCII sorting and pagination", () => {
  const originalOrder = fixtures.map((item) => item.id);
  const result = queryCulturalCases(fixtures, query({ solarTermId: "qingming", provinceCode: "330000", category: "food", keyword: "TITLE" }));
  assert.deepEqual(result.items.map((item) => item.id), ["test-z"]);
  assert.equal(result.total, 1);
  assert.deepEqual(queryCulturalCases(fixtures, query({ solarTermId: "xiazhi" })).items.map((item) => item.id), ["test-2"]);
  const page = queryCulturalCases(fixtures, query({ offset: 1, limit: 2 }));
  assert.deepEqual(page.items.map((item) => item.id), ["test-2", "test-a"]);
  assert.equal(page.total, 4);
  assert.equal(page.offset, 1);
  assert.equal(page.limit, 2);
  assert.deepEqual(fixtures.map((item) => item.id), originalOrder);
  assert.equal(CaseListResponseSchema.safeParse(page).success, true);
});

test("keyword uses literal case-insensitive substrings in exactly the four contracted fields", () => {
  for (const [keyword, ids] of [
    ["title", ["test-a", "test-z"]], ["REGION ALPHA", ["test-10"]], ["[literal]", ["test-10", "test-2", "test-a", "test-z"]],
    ["独有依据", ["test-a"]], [".*", []], ["example.test", []], ["浙江省", []], ["test-z", []],
  ]) assert.deepEqual(queryCulturalCases(fixtures, query({ keyword })).items.map((item) => item.id), ids, keyword);
});

test("uncovered conditions, zero records and offsets beyond the last page return normal empty lists", () => {
  for (const input of [{ solarTermId: "qiufen" }, { provinceCode: "710000" }, { solarTermId: "dongzhi", category: "craft" }, { offset: 4 }, { offset: Number.MAX_SAFE_INTEGER }]) {
    const response = queryCulturalCases(fixtures, query(input));
    assert.deepEqual(response.items, []);
    assert.equal(response.total, input.offset === undefined ? 0 : 4);
  }
  assert.deepEqual(queryCulturalCases([], query()), { version: "1.0", items: [], total: 0, offset: 0, limit: 10 });
});

test("pending cases are hidden from lists, totals, keyword matches and detail lookup", () => {
  const onlyPending = [fixture({ id: "test-pending-only", title: "独有待核查", verificationStatus: "pending" })];
  assert.equal(queryCulturalCases(fixtures, query()).total, 4);
  assert.equal(queryCulturalCases(onlyPending, query({ keyword: "独有待核查" })).total, 0);
  assert.equal(findVerifiedCulturalCase(fixtures, "test-0-pending"), undefined);
  assert.equal(findVerifiedCulturalCase(fixtures, "test-missing"), undefined);
  assert.equal(findVerifiedCulturalCase(fixtures, "test-2").verificationStatus, "verified");
});

test("the text-only collection validates and the two unresolved workbook cases remain pending", () => {
  const cases = readCulturalCases();
  for (const id of ["xinzheng-jujube-harvest", "huangling-flower-buns"]) {
    assert.equal(cases.find((item) => item.id === id)?.verificationStatus, "pending", id);
  }
  for (const item of cases) {
    assert.equal(Object.hasOwn(item, "imageUrl"), false);
    assert.equal(item.id.startsWith("test-"), false);
    assert.ok(item.sources.every((source) => !source.url.includes("example.test")));
  }
  // Parsing returns fresh objects; caller changes cannot contaminate later requests.
  cases[0].title = "修改测试副本";
  assert.notEqual(readCulturalCases()[0].title, "修改测试副本");
});

test("the original intake remains traceable and all eight existing runtime IDs retain their entity", () => {
  const intake = JSON.parse(readFileSync(new URL("../docs/cultural-sources/intake-2026-11-03.json", import.meta.url), "utf8"));
  assert.equal(intake.rows.length, 12);
  assert.equal(new Set(intake.rows.map((row) => row.caseId)).size, 12);
  assert.deepEqual(intake.rows.map((row) => row.row), Array.from({ length: 12 }, (_, index) => index + 2));
  const cases = new Map(readCulturalCases().map((item) => [item.id, item]));
  for (const [id, term, province, text] of [
    ["shanghai-qingming-qingtuan", "qingming", "310000", "青团"],
    ["tongxiang-heshan-qingming-dinner", "qingming", "330000", "河山"],
    ["beijing-xiazhi-noodles", "xiazhi", "110000", "面"],
    ["shaoxing-zuo-xiazhi", "xiazhi", "330000", "做夏至"],
    ["mohe-xiazhi-white-night", "xiazhi", "230000", "白夜"],
    ["sanmen-jidong", "dongzhi", "330000", "祭冬"],
    ["suzhou-dongzhi-winter-wine", "dongzhi", "320000", "冬酿酒"],
    ["beijing-dongzhi-nine-nine-chart", "dongzhi", "110000", "消寒图"],
  ]) {
    assert.ok(intake.rows.some((row) => row.caseId === id), id);
    const item = cases.get(id);
    assert.equal(item?.provinceCode, province, id);
    assert.ok(item.solarTermIds.includes(term), id);
    assert.ok([item.title, item.regionName, item.description].join(" ").includes(text), id);
  }
});

test("list route returns real verified records and sources, with no model key or network access", async () => {
  const oldFetch = globalThis.fetch;
  const oldKey = process.env.DEEPSEEK_API_KEY;
  globalThis.fetch = async () => { throw new Error("API must not access the network"); };
  delete process.env.DEEPSEEK_API_KEY;
  try {
    const body = await checkResponse(await listGET(request("?solarTermId=qingming&provinceCode=310000&category=food&keyword=青团&limit=1")), 200, CaseListResponseSchema);
    assert.equal(body.total, 1);
    assert.equal(body.items[0].id, "shanghai-qingming-qingtuan");
    assert.equal(Object.hasOwn(body.items[0], "imageUrl"), false);
    assert.ok(body.items[0].sources.some((source) => source.title && source.url.startsWith("http")));
    const detailBody = await checkResponse(await detail(body.items[0].id), 200, CaseDetailResponseSchema);
    assert.deepEqual(detailBody.item, body.items[0]);
  } finally {
    globalThis.fetch = oldFetch;
    if (oldKey === undefined) delete process.env.DEEPSEEK_API_KEY; else process.env.DEEPSEEK_API_KEY = oldKey;
  }
});

test("list route paginates the published batch and hides the two unresolved cases even by keyword", async () => {
  const all = await checkResponse(await listGET(request()), 200, CaseListResponseSchema);
  const published = readCulturalCases().filter((item) => item.verificationStatus === "verified");
  assert.equal(all.total, published.length);
  assert.ok(all.items.every((item) => item.verificationStatus === "verified"));
  assert.deepEqual(all.items.map((item) => item.id), all.items.map((item) => item.id).sort());
  const page = await checkResponse(await listGET(request("?offset=1&limit=2")), 200, CaseListResponseSchema);
  assert.equal(page.total, published.length);
  assert.deepEqual(page.items, all.items.slice(1, 3));
  for (const suffix of ["?solarTermId=qiufen&provinceCode=410000&keyword=砑枣", "?solarTermId=dongzhi&provinceCode=610000&keyword=面花", "?solarTermId=lichun&provinceCode=710000"]) {
    const body = await checkResponse(await listGET(request(suffix)), 200, CaseListResponseSchema);
    assert.deepEqual(body.items, []);
    assert.equal(body.total, 0);
  }
  const beyond = await checkResponse(await listGET(request(`?offset=${published.length}`)), 200, CaseListResponseSchema);
  assert.equal(beyond.total, published.length);
  assert.deepEqual(beyond.items, []);
});

test("list route uses the shared JSON error envelope for invalid queries", async () => {
  for (const suffix of ["?limit=0", "?offset=9007199254740992", "?limit=1&limit=2", "?provinceCode=100000_JD", "?solarTermId=Qingming", "?extra=value", "?keyword=" + "x".repeat(101)]) {
    const body = await checkResponse(await listGET(request(suffix)), 400, ApiFailureSchema);
    assert.equal(body.error.code, "INVALID_INPUT");
    assert.equal(body.answer, null);
    assert.equal(body.truncated, false);
  }
});

test("detail rejects malformed decoded IDs and treats pending and absent cases identically", async () => {
  for (const id of ["Uppercase", "../private", "a/b", "%73anmen-jidong", "x".repeat(65)]) {
    const body = await checkResponse(await detail(id), 400, ApiFailureSchema);
    assert.equal(body.error.code, "INVALID_INPUT");
  }
  const missing = await checkResponse(await detail("missing-case"), 404, ApiFailureSchema);
  for (const id of ["xinzheng-jujube-harvest", "huangling-flower-buns"]) {
    assert.deepEqual(await checkResponse(await detail(id), 404, ApiFailureSchema), missing);
  }
  assert.equal(missing.error.code, "CASE_NOT_FOUND");
});

test("unexpected detail errors do not expose internal messages", async () => {
  const body = await checkResponse(await detailGET(request("/sanmen-jidong"), { params: Promise.reject(new Error("private-path-and-secret")) }), 500, ApiFailureSchema);
  assert.equal(body.error.code, "INTERNAL_ERROR");
  assert.doesNotMatch(JSON.stringify(body), /private-path-and-secret/);
});
