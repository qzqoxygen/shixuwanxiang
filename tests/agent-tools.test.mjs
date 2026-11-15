import "./register-ts.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";

const { createCultureAgentTools } = await import("../lib/server/chat-case-tool.ts");
const { readCulturalCases } = await import("../lib/server/cultural-cases.ts");
const { retrieveChatCases } = await import("../lib/server/cultural-case-context.ts");
const { applyValidatedMapActions } = await import("../lib/map-actions.ts");
const catalog = readCulturalCases();
const empty = { solarTermId: null, provinceCode: null, caseId: null };
const initial = { selectedSolarTermId: null, selectedProvinceCode: null, selectedCaseId: null, highlightedProvinceCodes: [] };
const user = content => ({ role: "user", content });
const toolsFor = context => {
  const registry = createCultureAgentTools([user("比较江苏和浙江冬至文化并在地图中查看")], context ?? empty);
  return { registry, call: (name, args) => registry.tools.find(tool => tool.definition.function.name === name).execute(args) };
};

test("all six real tools query validated data and prepare sequential map operations", () => {
  const { registry, call } = toolsFor();
  assert.deepEqual(registry.tools.map(tool => tool.definition.function.name), ["search_cultural_cases", "show_cultural_map", "highlight_regions", "open_cultural_case", "get_solar_term_info", "compare_cultural_cases"]);
  const comparison = call("compare_cultural_cases", { solarTermId: "dongzhi", provinceCodes: ["320000", "330000"] });
  assert.equal(comparison.regions.length, 2);
  assert.ok(comparison.regions.every(region => region.total > 0 && region.cases.length > 0));
  assert.ok(comparison.cases.every(item => item.sources.length && !item.caseId.includes("test")));
  assert.equal(registry.searched, true);
  call("show_cultural_map", { solarTermId: "dongzhi" });
  call("highlight_regions", { provinceCodes: ["320000", "330000"] });
  const result = call("open_cultural_case", { caseId: "sanmen-jidong" });
  assert.equal(result.item.title, catalog.find(item => item.id === "sanmen-jidong").title);
  assert.deepEqual(result.item.sources, catalog.find(item => item.id === "sanmen-jidong").sources);
  assert.equal(registry.state.selectedCaseId, "sanmen-jidong");
  assert.equal(registry.state.selectedProvinceCode, "330000");
  assert.deepEqual(registry.mapActions.map(item => item.type), ["SET_SOLAR_TERM", "HIGHLIGHT_PROVINCES", "OPEN_CULTURAL_CASE"]);
  assert.deepEqual(applyValidatedMapActions(initial, registry.mapActions, catalog), registry.state);
  const term = call("get_solar_term_info", { solarTermId: "dongzhi" });
  assert.equal(term.name, "冬至");
  assert.equal(term.solarLongitude, 270);
  assert.ok(term.description && term.note && term.source.url.includes("hko.gov.hk"));
});

test("structured case search combines term, region, category and keyword without exposing pending", () => {
  const { call } = toolsFor();
  const found = call("search_cultural_cases", { solarTermId: "dongzhi", provinceCode: "320000", category: "food", keyword: "冬酿" });
  assert.deepEqual(found.cases.map(item => item.caseId), ["suzhou-dongzhi-winter-wine"]);
  assert.equal(found.total, 1);
  const emptyResult = call("search_cultural_cases", { solarTermId: "dongzhi", provinceCode: "540000" });
  assert.deepEqual(emptyResult.cases, []);
  assert.equal(emptyResult.total, 0);
  for (const keyword of ["黄陵面花", "新郑大枣"]) {
    assert.equal(call("search_cultural_cases", { keyword }).total, 0);
  }
  assert.throws(() => call("search_cultural_cases", { category: "invented" }), { code: "INVALID_TOOL_ARGUMENTS" });
  assert.throws(() => call("search_cultural_cases", { provinceCode: "100000_JD" }), { code: "INVALID_TOOL_ARGUMENTS" });
  assert.throws(() => call("get_solar_term_info", { solarTermId: "冬至" }), { code: "INVALID_TOOL_ARGUMENTS" });
});

test("tool errors leave the map untouched and reject missing, pending or wrong-term cases", () => {
  const { registry, call } = toolsFor();
  assert.throws(() => call("highlight_regions", { provinceCodes: [] }), { code: "MAP_CONTEXT_REQUIRED" });
  assert.throws(() => call("open_cultural_case", { caseId: "sanmen-jidong" }), { code: "MAP_CONTEXT_REQUIRED" });
  assert.deepEqual(registry.mapActions, []);
  call("show_cultural_map", { solarTermId: "dongzhi" });
  const before = structuredClone(registry.state);
  assert.throws(() => call("highlight_regions", { provinceCodes: ["320000", "540000"] }), { code: "REGION_HAS_NO_CASES" });
  for (const caseId of ["huangling-flower-buns", "xinzheng-jujube-harvest", "not-a-case"]) {
    assert.throws(() => call("open_cultural_case", { caseId }), { code: "CASE_NOT_FOUND" });
  }
  assert.throws(() => call("open_cultural_case", { caseId: "beijing-xiazhi-noodles" }), { code: "CASE_CONTEXT_MISMATCH" });
  assert.deepEqual(registry.state, before);
  assert.equal(registry.mapActions.length, 1);
});

test("client-safe map validation is atomic, bounded and has no arbitrary-code action", () => {
  const valid = [
    { type: "SET_SOLAR_TERM", payload: { solarTermId: "dongzhi" } },
    { type: "HIGHLIGHT_PROVINCES", payload: { provinceCodes: ["320000"] } },
  ];
  const before = structuredClone(initial);
  for (const invalid of [
    [...valid, { type: "OPEN_CULTURAL_CASE", payload: { caseId: "huangling-flower-buns" } }],
    [{ type: "RUN_SCRIPT", payload: { code: "alert(1)" } }],
    [{ type: "SET_SOLAR_TERM", payload: { solarTermId: "dongzhi", script: "alert(1)" } }],
    Array.from({ length: 9 }, () => valid[0]),
  ]) assert.throws(() => applyValidatedMapActions(initial, invalid, catalog));
  assert.deepEqual(initial, before);
  const selected = applyValidatedMapActions(initial, [...valid, { type: "OPEN_CULTURAL_CASE", payload: { caseId: "sanmen-jidong" } }], catalog);
  assert.deepEqual(selected.highlightedProvinceCodes, ["320000", "330000"]);
  const reset = applyValidatedMapActions(selected, [valid[0]], catalog);
  assert.deepEqual(reset, { ...initial, selectedSolarTermId: "dongzhi" });
});

test("multi-region retrieval reserves slots fairly and inherits category on explicit follow-ups", () => {
  const base = catalog.find(item => item.id === "suzhou-dongzhi-winter-wine");
  const fixtures = [
    ...Array.from({ length: 7 }, (_, index) => ({ ...base, id: `a-${index}`, title: `冬至江苏酒${index}` })),
    { ...base, id: "z-zhejiang", title: "冬至浙江团圆饭", provinceCode: "330000", provinceName: "浙江省", regionName: "杭州市" },
    { ...base, id: "ritual-only", category: "folk_custom", title: "冬至浙江祭祖", provinceCode: "330000", provinceName: "浙江省", regionName: "杭州市" },
  ];
  const found = retrieveChatCases([user("比较江苏浙江冬至饮食习俗")], fixtures).cases;
  assert.equal(found.length, 6);
  assert.ok(found.some(item => item.id === "z-zhejiang"));
  assert.ok(found.every(item => item.category === "food"));
  const follow = retrieveChatCases([user("江苏冬至饮食"), { role: "assistant", content: "模型文字不作为来源。" }, user("那浙江呢？")], fixtures).cases;
  assert.deepEqual(follow.map(item => item.id), ["z-zhejiang"]);
});

test("comparison keeps uncovered regions empty and rejects invalid province sets", () => {
  const { call } = toolsFor();
  const result = call("compare_cultural_cases", { solarTermId: "dongzhi", provinceCodes: ["320000", "540000"], category: "food" });
  assert.ok(result.regions[0].cases.length);
  assert.deepEqual(result.regions[1].cases, []);
  assert.equal(result.regions[1].total, 0);
  assert.throws(() => call("compare_cultural_cases", { solarTermId: "dongzhi", provinceCodes: ["320000", "320000"] }), { code: "INVALID_TOOL_ARGUMENTS" });
  assert.throws(() => call("compare_cultural_cases", { solarTermId: "dongzhi", provinceCodes: ["320000"] }), { code: "INVALID_TOOL_ARGUMENTS" });
});

test("a broad folk-culture question does not exclude food customs", () => {
  const result = retrieveChatCases([user("比较江苏浙江冬至民俗特点")]).cases;
  assert.ok(result.some(item => item.id === "suzhou-dongzhi-winter-wine"));
  assert.ok(result.some(item => item.id === "sanmen-jidong"));
  const comparison = retrieveChatCases([user("比较江苏和浙江冬至有什么不同")]).cases;
  assert.ok(comparison.some(item => item.id === "suzhou-dongzhi-winter-wine"));
  assert.ok(comparison.some(item => item.id === "sanmen-jidong"));
});
