import "./register-ts.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
const { CulturalCaseSchema, CaseListQuerySchema } = await import("../lib/contracts/cultural-case.ts");
const { queryCulturalCases } = await import("../lib/server/cultural-case-query.ts");
const { fetchCaseList, fetchSolarTermCases, fetchProvinceCaseCounts } = await import("../lib/cultural-case-client.ts");

const regional = {
  id: "test-regional", title: "区域案例", solarTermIds: ["mangzhong"], provinceCode: "320000",
  provinceName: "江苏省", relatedProvinceCodes: ["330000"], regionName: "江南地区",
  category: "folk_custom", description: "仅用于测试", relationNote: "以区域为范围，不指派县市",
  sources: [{ title: "测试", url: "https://example.test/regional" }], verificationStatus: "verified",
};

test("regional cases match either supported province without duplicating the national entity", async () => {
  const cases = [CulturalCaseSchema.parse(regional)];
  for (const provinceCode of [undefined, "320000", "330000"]) {
    const query = CaseListQuerySchema.parse({ solarTermId: "mangzhong", provinceCode });
    const result = queryCulturalCases(cases, query);
    assert.equal(result.total, 1);
    assert.deepEqual(result.items.map(x => x.id), [regional.id]);
    assert.deepEqual(await fetchCaseList(query, new AbortController().signal, async () => Response.json(result)), result);
  }
  assert.equal(queryCulturalCases(cases, CaseListQuerySchema.parse({ provinceCode: "310000" })).total, 0);
  assert.equal(queryCulturalCases([{ ...regional, verificationStatus: "pending" }], CaseListQuerySchema.parse({ provinceCode: "330000" })).total, 0);
});

test("map counts associate a regional case with each named province but term pages keep one card", async () => {
  const fetcher = async () => Response.json({ version: "1.0", items: [regional], total: 1, offset: 0, limit: 20 });
  const signal = new AbortController().signal;
  assert.deepEqual(await fetchProvinceCaseCounts("mangzhong", signal, fetcher), new Map([["320000", 1], ["330000", 1]]));
  assert.equal((await fetchSolarTermCases("mangzhong", signal, fetcher)).length, 1);
});

test("related provinces reject unknown codes, duplicates and repetition of the primary province", () => {
  for (const relatedProvinceCodes of [[], ["330000", "330000"], ["320000"], ["999999"], [330000]]) {
    assert.equal(CulturalCaseSchema.safeParse({ ...regional, relatedProvinceCodes }).success, false);
  }
  const legacy = { ...regional };
  delete legacy.relatedProvinceCodes;
  assert.equal(CulturalCaseSchema.safeParse(legacy).success, true);
});
