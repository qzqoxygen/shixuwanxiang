import "./register-ts.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
const { exploreSelectionReducer: reduce, INITIAL_EXPLORE_SELECTION: initial } = await import("../lib/explore-selection.ts");
const { caseListUrl, fetchCaseList, fetchCaseDetail, fetchProvinceCaseCounts } = await import("../lib/cultural-case-client.ts");

const item = { id: "test-only", title: "测试案例", solarTermIds: ["qingming"], provinceCode: "310000", provinceName: "上海市", regionName: "测试地区", category: "food", description: "仅限自动测试", relationNote: "测试依据", sources: [{ title: "测试来源", url: "https://example.test/source" }], verificationStatus: "verified" };
const query = { solarTermId: "qingming", provinceCode: "310000", offset: 0, limit: 6 };
const list = { version: "1.0", items: [item], total: 1, offset: 0, limit: 6 };
const signal = () => new AbortController().signal;
const responds = (data, status = 200) => async () => Response.json(data, { status });

test("changing a term resets province, page and detail; province changes reset page and detail only", () => {
  const selected = { solarTermId: "dongzhi", provinceCode: "330000", caseId: "case-a", offset: 6 };
  assert.deepEqual(reduce(selected, { type: "term", value: "qingming" }), { ...initial, solarTermId: "qingming" });
  assert.deepEqual(reduce(selected, { type: "term", value: "dongzhi" }), { ...initial, solarTermId: "dongzhi" });
  assert.deepEqual(reduce(selected, { type: "province", value: "310000" }), { ...selected, provinceCode: "310000", caseId: null, offset: 0 });
  assert.equal(reduce(selected, { type: "province", value: "330000" }), selected);
  assert.deepEqual(reduce(selected, { type: "province", value: null }), { ...selected, provinceCode: null, caseId: null, offset: 0 });
});

test("opening a case selects its province; paging and close cannot leave an old detail active", () => {
  const open = reduce({ ...initial, solarTermId: "qingming", offset: 6 }, { type: "open", caseId: "case-a", provinceCode: "310000" });
  assert.deepEqual(open, { solarTermId: "qingming", provinceCode: "310000", caseId: "case-a", offset: 0 });
  assert.deepEqual(reduce(open, { type: "close" }), { ...open, caseId: null });
  assert.deepEqual(reduce(open, { type: "page", value: 6 }), { ...open, caseId: null, offset: 6 });
  assert.deepEqual(reduce(open, { type: "reset" }), initial);
});

test("list requests forward cancellation and no-store, serialize only selected filters, and validate real responses", async () => {
  const abortSignal = signal();
  const result = await fetchCaseList(query, abortSignal, async (url, options) => {
    assert.equal(url, "/api/cultural-cases?solarTermId=qingming&provinceCode=310000&offset=0&limit=6");
    assert.equal(options.signal, abortSignal);
    assert.equal(options.cache, "no-store");
    return Response.json(list);
  });
  assert.deepEqual(result, list);
  assert.equal(caseListUrl({ offset: 0, limit: 6 }), "/api/cultural-cases?offset=0&limit=6");
  assert.equal((await fetchCaseList(query, signal(), responds({ ...list, items: [], total: 0 }))).total, 0);
});

test("malformed, pending, wrong-filter and wrong-page list responses never become displayed cases", async () => {
  for (const data of [
    { ...list, version: "2.0" }, { ...list, offset: 6 }, { ...list, limit: 10 }, { ...list, total: 0 },
    { ...list, items: [item, item], total: 2 },
    { ...list, items: [{ ...item, verificationStatus: "pending" }] },
    { ...list, items: [{ ...item, solarTermIds: ["dongzhi"] }] },
    { ...list, items: [{ ...item, provinceCode: "330000", provinceName: "浙江省" }] },
  ]) await assert.rejects(fetchCaseList(query, signal(), responds(data)));
});

test("detail responses must match the requested ID and be verified", async () => {
  assert.deepEqual(await fetchCaseDetail(item.id, signal(), responds({ version: "1.0", item })), item);
  await assert.rejects(fetchCaseDetail("different-id", signal(), responds({ version: "1.0", item })));
  await assert.rejects(fetchCaseDetail(item.id, signal(), responds({ version: "1.0", item: { ...item, verificationStatus: "pending" } })));
});

test("service failures, invalid JSON, network errors and cancellation do not return substitute cases", async () => {
  const failure = { version: "1.0", answer: null, truncated: false, error: { code: "CASE_NOT_FOUND", message: "未找到可公开的文化案例。" } };
  await assert.rejects(fetchCaseDetail(item.id, signal(), responds(failure, 404)), /未找到可公开/);
  await assert.rejects(fetchCaseList(query, signal(), async () => new Response("invalid", { status: 200 })), /无法读取/);
  await assert.rejects(fetchCaseList(query, signal(), async () => { throw new TypeError("network"); }), /network/);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(fetchCaseList(query, controller.signal, async (_url, options) => { options.signal.throwIfAborted(); }), { name: "AbortError" });
});

test("province matching reads every nationwide page and counts cases in provinces found only on later pages", async () => {
  const records = Array.from({ length: 22 }, (_, index) => ({ ...item, id: `page-case-${index}`, ...(index === 20 ? { provinceCode: "130000", provinceName: "河北省" } : index === 21 ? { provinceCode: "330000", provinceName: "浙江省" } : {}) }));
  const requestedOffsets = [];
  const abortSignal = signal();
  const counts = await fetchProvinceCaseCounts("qingming", abortSignal, async (url, options) => {
    const params = new URL(url, "http://localhost").searchParams;
    assert.equal(params.get("solarTermId"), "qingming");
    assert.equal(params.has("provinceCode"), false);
    assert.equal(params.get("limit"), "20");
    assert.equal(options.signal, abortSignal);
    const offset = Number(params.get("offset")); requestedOffsets.push(offset);
    return Response.json({ version: "1.0", items: records.slice(offset, offset + 20), total: records.length, offset, limit: 20 });
  });
  assert.deepEqual(requestedOffsets, [0, 20]);
  assert.deepEqual([...counts.entries()], [["310000", 20], ["130000", 1], ["330000", 1]]);
});

test("province matching returns an empty set for a real empty result, and rejects incomplete or changing pagination", async () => {
  const empty = { version: "1.0", items: [], total: 0, offset: 0, limit: 20 };
  assert.equal((await fetchProvinceCaseCounts("qingming", signal(), responds(empty))).size, 0);
  await assert.rejects(fetchProvinceCaseCounts("qingming", signal(), responds({ ...empty, total: 1 })), /完整确定/);
  for (const secondPage of [
    { ...empty, total: 3, offset: 1, items: [{ ...item, id: "different" }] },
    { ...empty, total: 2, offset: 1, items: [item] },
    { ...empty, total: 2, offset: 1 },
  ]) {
    let calls = 0;
    await assert.rejects(fetchProvinceCaseCounts("qingming", signal(), async () => Response.json(calls++ === 0 ? { ...empty, total: 2, items: [item] } : secondPage)));
  }
});

test("province matching never publishes partial data after a later-page failure or cancellation", async () => {
  const firstPage = { version: "1.0", items: [item], total: 2, offset: 0, limit: 20 };
  let calls = 0;
  await assert.rejects(fetchProvinceCaseCounts("qingming", signal(), async () => {
    if (calls++ === 0) return Response.json(firstPage);
    throw new TypeError("offline");
  }), /offline/);
  const controller = new AbortController(); calls = 0;
  await assert.rejects(fetchProvinceCaseCounts("qingming", controller.signal, async () => {
    calls++; controller.abort(); return Response.json(firstPage);
  }), { name: "AbortError" });
  assert.equal(calls, 1);
  await assert.rejects(fetchProvinceCaseCounts("qingming", signal(), responds({ ...firstPage, items: [{ ...item, verificationStatus: "pending" }] })));
});
