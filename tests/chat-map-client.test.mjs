import "./register-ts.mjs";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const { prepareChatMapActions, selectionMapState } = await import("../lib/chat-map-client.ts");
const { exploreSelectionReducer } = await import("../lib/explore-selection.ts");
const catalog = JSON.parse(readFileSync(new URL("../data/cultural-cases/cases.json", import.meta.url), "utf8"));
const empty = { selectedSolarTermId: null, selectedProvinceCode: null, selectedCaseId: null, highlightedProvinceCodes: [] };
const actions = [
  { type: "SET_SOLAR_TERM", payload: { solarTermId: "dongzhi" } },
  { type: "HIGHLIGHT_PROVINCES", payload: { provinceCodes: ["320000", "330000"] } },
  { type: "OPEN_CULTURAL_CASE", payload: { caseId: "sanmen-jidong" } },
];

function source(requests) {
  return async (address, options) => {
    const query = new URL(address, "http://localhost").searchParams;
    requests.push({ term: query.get("solarTermId"), offset: Number(query.get("offset")) });
    assert.equal(options.cache, "no-store");
    const term = query.get("solarTermId");
    const offset = Number(query.get("offset"));
    const limit = Number(query.get("limit"));
    const matches = catalog.filter(item => item.verificationStatus === "verified" && item.solarTermIds.includes(term));
    return Response.json({ version: "1.0", items: matches.slice(offset, offset + limit), total: matches.length, offset, limit });
  };
}

test("a chat map batch verifies real API cases before atomically selecting and highlighting regions", async () => {
  const requests = [];
  const state = structuredClone(empty);
  const result = await prepareChatMapActions(state, actions, new AbortController().signal, source(requests));
  assert.deepEqual(requests, [{ term: "dongzhi", offset: 0 }]);
  assert.deepEqual(state, empty);
  assert.equal(result.selectedSolarTermId, "dongzhi");
  assert.equal(result.selectedProvinceCode, "330000");
  assert.equal(result.selectedCaseId, "sanmen-jidong");
  assert.deepEqual(result.highlightedProvinceCodes, ["320000", "330000"]);
  assert.deepEqual(exploreSelectionReducer({ solarTermId: null, provinceCode: null, caseId: null, offset: 6 }, { type: "applyMap", value: result }), {
    solarTermId: "dongzhi", provinceCode: "330000", caseId: "sanmen-jidong", offset: 0,
  });
});

test("unknown or malformed map actions are rejected before a network request", async () => {
  for (const value of [[{ type: "RUN_SCRIPT", payload: { code: "alert(1)" } }], [{ ...actions[0], extra: true }], [...actions, ...actions, ...actions]]) {
    let calls = 0;
    await assert.rejects(prepareChatMapActions(empty, value, new AbortController().signal, async () => { calls++; throw new Error("must not fetch"); }));
    assert.equal(calls, 0);
  }
});

test("failed or unmatched map validation cannot leave an applied prefix", async () => {
  for (const final of [
    { type: "OPEN_CULTURAL_CASE", payload: { caseId: "huangling-flower-buns" } },
    { type: "HIGHLIGHT_PROVINCES", payload: { provinceCodes: ["540000"] } },
  ]) {
    const original = structuredClone(empty);
    await assert.rejects(prepareChatMapActions(original, [actions[0], final], new AbortController().signal, source([])));
    assert.deepEqual(original, empty);
  }
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(prepareChatMapActions(empty, actions, controller.signal, source([])), { name: "AbortError" });
});

test("context snapshots retain the independent validated highlight state", () => {
  const selection = { solarTermId: "dongzhi", provinceCode: "330000", caseId: "sanmen-jidong", offset: 6 };
  assert.deepEqual(selectionMapState(selection, ["320000", "330000"]), {
    selectedSolarTermId: "dongzhi", selectedProvinceCode: "330000", selectedCaseId: "sanmen-jidong", highlightedProvinceCodes: ["320000", "330000"],
  });
});
