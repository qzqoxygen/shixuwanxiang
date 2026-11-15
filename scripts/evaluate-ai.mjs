// Default: deterministic program checks only. --live explicitly spends server-side model/search quota.
import "../tests/register-ts.mjs";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { performance } from "node:perf_hooks";

const { SOLAR_TERMS } = await import("../lib/solar-terms.ts");
const { readCulturalCases } = await import("../lib/server/cultural-cases.ts");
const { retrieveChatCases, culturalAnswerSources } = await import("../lib/server/cultural-case-context.ts");
const { createCultureAgentTools } = await import("../lib/server/chat-case-tool.ts");
const { parseChatRequest } = await import("../lib/server/chat-protocol.ts");
const { applyValidatedMapActions } = await import("../lib/map-actions.ts");
const { studioCaseHref } = await import("../lib/studio-inspiration.ts");
const { runChatAgent } = await import("../lib/ai-agent.ts");
const { beginAiRequest } = await import("../lib/server/ai-access.ts");
const fixtures = JSON.parse(readFileSync(new URL("../tests/fixtures/ai-quality-cases.json", import.meta.url), "utf8"));
const emptyContext = { solarTermId: null, provinceCode: null, caseId: null };
const emptyMap = { selectedSolarTermId: null, selectedProvinceCode: null, selectedCaseId: null, highlightedProvinceCodes: [] };
const user = content => ({ role: "user", content });
const completion = (content, calls) => ({ choices: [{ finish_reason: calls ? "tool_calls" : "stop", message: { content, ...(calls ? { tool_calls: calls } : {}) } }] });
const toolCall = (name, args, id = "eval-call") => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });

function historyFor(sample) {
  return (sample.history ?? [sample.question]).flatMap((content, index, all) => index === all.length - 1 ? [user(content)] : [user(content), { role: "assistant", content: "历史回答仅作上下文，不作为资料来源。" }]);
}
function ratio(numerator, denominator) { return denominator ? Number((numerator / denominator).toFixed(4)) : null; }
function percentile(values, p) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length ? Number(sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * p) - 1)].toFixed(2)) : null;
}
function summarize(report) {
  const retrieval = report.samples.filter(sample => sample.kind === "retrieval" && sample.expectedIds?.length);
  const empty = report.samples.filter(sample => sample.kind === "retrieval" && sample.mustBeEmpty);
  const citations = report.samples.filter(sample => sample.kind === "citation");
  const rejections = report.samples.filter(sample => sample.expectedRejection);
  const tools = report.samples.filter(sample => sample.kind === "tool");
  const accepted = citations.filter(sample => sample.expectedCitationCount > 0);
  const citationDenominator = accepted.reduce((sum, sample) => sum + sample.expectedCitationCount, 0);
  const validMentions = accepted.reduce((sum, sample) => sum + (sample.passed ? sample.validCitationCount ?? 0 : 0), 0);
  const executions = tools.filter(sample => sample.tool && !sample.expectedRejection);
  report.summary = {
    sampleCount: report.samples.length, passed: report.samples.filter(sample => sample.passed).length,
    failed: report.samples.filter(sample => !sample.passed).length,
    retrieval: { samples: retrieval.length, hitAt1: ratio(retrieval.filter(sample => sample.actualIds?.[0] && sample.expectedIds.includes(sample.actualIds[0])).length, retrieval.length), allExpectedHitAt6: ratio(retrieval.filter(sample => sample.expectedIds.every(id => sample.actualIds?.slice(0, 6).includes(id))).length, retrieval.length), emptySamples: empty.length, emptyCorrect: empty.filter(sample => sample.passed).length },
    citations: { scope: "Entity, identifier and source/citation association checks only; not semantic factual accuracy. General answers with no citations are excluded from the denominator.", acceptedSamples: accepted.length, expectedCitationMentions: citationDenominator, validCitationMentions: validMentions, associationValidityRate: ratio(validMentions, citationDenominator), rejectedInvalidSamples: citations.filter(sample => sample.expectedRejection && sample.passed).length },
    rejection: { samples: rejections.length, correctlyRejected: rejections.filter(sample => sample.passed).length },
    tools: { scope: "Deterministic local-tool check samples, not model tool-selection quality", checkSamples: tools.length, checkPassed: tools.filter(sample => sample.passed).length, uniqueTools: [...new Set(executions.map(sample => sample.tool))], executionSamples: executions.length, successfulExecutionSamples: executions.filter(sample => sample.passed).length, sampleSuccessRate: ratio(executions.filter(sample => sample.passed).length, executions.length), expectedRejections: tools.filter(sample => sample.expectedRejection && sample.passed).length },
    latencyMs: { median: percentile(report.samples.map(sample => sample.ms), .5), p95: percentile(report.samples.map(sample => sample.ms), .95), total: Number(report.samples.reduce((sum, sample) => sum + sample.ms, 0).toFixed(2)) },
    failures: report.samples.filter(sample => !sample.passed).map(({ id, group, error }) => ({ id, group, error })),
  };
  report.passed = report.summary.failed === 0;
  return report;
}
function baseReport(mode) {
  const sourcePaths = ["app/api/chat/route.ts", "app/api/studio/inspiration/route.ts", "lib/ai-agent.ts", "lib/chat.ts", "lib/chat-map-client.ts", "lib/map-actions.ts", "lib/studio-inspiration.ts", "lib/cultural-aliases.ts", "lib/server/chat-case-tool.ts", "lib/server/chat-protocol.ts", "lib/server/cultural-case-context.ts", "lib/server/cultural-retrieval.ts", "lib/server/answer-evidence.ts", "lib/server/deepseek.ts", "lib/server/web-search.ts", "lib/server/ai-access.ts", "lib/contracts/chat-api.ts", "lib/contracts/ai-evidence.ts", "lib/contracts/retrieval.ts", "components/AnswerEvidence.tsx", "components/ChatPanel.tsx", "components/ChatPanel.css"];
  const files = Object.fromEntries(sourcePaths.map(path => [path, createHash("sha256").update(readFileSync(resolve(path))).digest("hex")]));
  const buildPath = resolve(".next/BUILD_ID");
  return { version: "1.0", mode, testedAt: new Date().toISOString(), commit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(), workingTreeDirty: Boolean(execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim()), fixtureSha256: createHash("sha256").update(JSON.stringify(fixtures)).digest("hex"), sourceFingerprint: { sha256: createHash("sha256").update(JSON.stringify(files)).digest("hex"), files }, localBuildId: existsSync(buildPath) ? readFileSync(buildPath, "utf8").trim() : null, buildIdMeaning: "Local .next build only; not proof of a deployed revision", method: mode === "deterministic" ? "Real local retrieval/tools and program validation; isolated runner responses only for cancellation/timeout/error branches; no actual model request" : "Real HTTP requests to the running app; no mocked model/search or automatic retries", samples: [] };
}
async function check(report, details, fn) {
  const start = performance.now();
  const sample = { ...details };
  report.samples.push(sample);
  try { const result = await fn(); Object.assign(sample, result ?? {}, { passed: true }); }
  catch (error) { sample.passed = false; sample.error = String(error?.message ?? error).slice(0, 700); }
  sample.ms = Number((performance.now() - start).toFixed(2));
}

export async function evaluateDeterministic() {
  const report = baseReport("deterministic");
  const catalog = readCulturalCases();
  const verified = catalog.filter(item => item.verificationStatus === "verified");
  report.data = { verified: verified.length, pending: catalog.length - verified.length, normalizedSha256: createHash("sha256").update(JSON.stringify(catalog)).digest("hex"), expectedCatalog: fixtures.catalog };
  assert.equal(verified.length, fixtures.catalog.verified); assert.equal(catalog.length - verified.length, fixtures.catalog.pending);
  for (const term of SOLAR_TERMS) await check(report, { id: `term:${term.id}`, group: "24_term_catalog", kind: "tool" }, () => {
    const registry = createCultureAgentTools([user(`什么是${term.name}`)], emptyContext);
    const result = registry.tools.find(tool => tool.definition.function.name === "get_solar_term_info").execute({ solarTermId: term.id });
    assert.equal(result.name, term.name); assert.equal(result.solarLongitude, term.solarLongitude); assert(result.description);
    return { actualTermId: result.solarTermId, tool: "get_solar_term_info" };
  });
  for (const item of verified) await check(report, { id: `exact:${item.id}`, group: "exact_case_titles", kind: "retrieval", expectedIds: [item.id] }, () => {
    const result = retrieveChatCases([user(`介绍${item.title}`)], catalog);
    const actualIds = result.cases.map(item => item.id);
    assert(actualIds.includes(item.id), `Expected ${item.id}; got ${actualIds.join(",")}`);
    assert(result.cases.every(item => item.verificationStatus === "verified"));
    return { actualIds, diagnostics: result.diagnostics };
  });
  for (const sample of fixtures.retrieval) await check(report, { ...sample, kind: "retrieval", expectedRejection: Boolean(sample.mustBeEmpty) }, () => {
    const result = retrieveChatCases(historyFor(sample), catalog);
    const actualIds = result.cases.map(item => item.id);
    if (sample.mustBeEmpty) assert.deepEqual(actualIds, [], `Expected no match; got ${actualIds.join(",")}`);
    else assert(sample.expectedIds.every(id => actualIds.includes(id)), `Expected ${sample.expectedIds.join(",")}; got ${actualIds.join(",")}`);
    if (sample.category) assert(result.cases.every(item => item.category === sample.category));
    return { actualIds, diagnostics: result.diagnostics };
  });
  const evidence = await import("../lib/server/answer-evidence.ts");
  for (const item of verified) await check(report, { id: `cite:${item.id}`, kind: "citation", group: "valid_catalog_citations", expectedCitationCount: 1 }, () => {
    const answer = `${item.title}。[案例1]`;
    const result = evidence.validateAnswerEvidence(answer, [item]);
    const legacy = culturalAnswerSources(answer, [item]);
    assert.equal(result.localCitations[0], 1); assert.equal(legacy.references[0].caseId, item.id);
    return { validCitationCount: result.validCitationCount };
  });
  const target = verified.find(item => item.id === "sanmen-jidong");
  const other = verified.find(item => item.id === "beijing-xiazhi-noodles");
  const badCitationCases = [
    { id: "out-of-range", answer: "三门祭冬。[案例9]", cases: [target] },
    { id: "malformed-citation", answer: "三门祭冬。[案例一]", cases: [target] },
    { id: "unretrieved-live-source", answer: "最新活动。[1]", cases: [] },
    { id: "invented-url", answer: "三门祭冬。[案例1] https://invented.example/fake", cases: [target] },
    { id: "wrong-case-title-citation", answer: "三门祭冬。[案例1]", cases: [other] },
    { id: "forged-case-name", answer: "案例。[案例1]", cases: [{ ...target, title: "伪造三门祭龙王" }] },
    { id: "forged-term", answer: "案例。[案例1]", cases: [{ ...target, solarTermIds: ["qingming"] }] },
    { id: "forged-province", answer: "案例。[案例1]", cases: [{ ...target, provinceCode: "310000", provinceName: "上海市" }] },
    { id: "forged-source", answer: "案例。[案例1]", cases: [{ ...target, sources: [{ title: "虚构", url: "https://invented.example/" }] }] },
    ...catalog.filter(item => item.verificationStatus === "pending").map(item => ({ id: `pending-evidence:${item.id}`, answer: "案例。[案例1]", cases: [item] })),
  ];
  for (const sample of badCitationCases) await check(report, { id: sample.id, kind: "citation", group: "invalid_evidence_rejection", expectedRejection: true }, () => {
    assert.throws(() => evidence.validateAnswerEvidence(sample.answer, sample.cases));
    return { correctlyRejected: true };
  });
  await check(report, { id: "ordinary-without-citation", kind: "citation", group: "general_knowledge" }, () => {
    const result = evidence.validateAnswerEvidence("冬至不一定是当地最冷的一天。", []);
    assert.equal(result.validCitationCount, 0);
  });
  const liveContext = { query: "二十四节气", retrievedAt: "test-only-fixed-time", sources: [{ title: "香港天文台二十四节气", url: "https://www.hko.gov.hk/tc/gts/astronomy/Solar_Term.htm", content: "这里公布节气资料。" }] };
  await check(report, { id: "actual-search-record-association", kind: "citation", group: "web_citation_association", expectedCitationCount: 1 }, () => {
    const result = evidence.validateAnswerEvidence("可从天文台查看。[1]", [], liveContext);
    assert.equal(result.webCitationCount, 1);
    return { validCitationCount: result.validCitationCount };
  });
  await check(report, { id: "search-failed-cannot-cite", kind: "citation", group: "web_citation_association", expectedRejection: true }, () => {
    assert.throws(() => evidence.validateAnswerEvidence("最新资料。[1]", [], null));
  });
  const registry = createCultureAgentTools([user("比较江苏浙江冬至习俗")], emptyContext);
  const invoke = (name, args) => registry.tools.find(tool => tool.definition.function.name === name).execute(args);
  for (const [name, args] of [
    ["search_cultural_cases", { solarTermId: "dongzhi", provinceCode: "320000", category: "food" }],
    ["compare_cultural_cases", { solarTermId: "dongzhi", provinceCodes: ["320000", "330000"] }],
    ["show_cultural_map", { solarTermId: "dongzhi" }],
    ["highlight_regions", { provinceCodes: ["320000", "330000"] }],
    ["open_cultural_case", { caseId: "sanmen-jidong" }],
  ]) await check(report, { id: `six-tool:${name}`, kind: "tool", group: "six_tool_real_execution" }, () => { invoke(name, args); return { tool: name }; });
  await check(report, { id: "map-to-studio-continuity", kind: "tool", group: "map_studio_continuity" }, () => {
    const state = applyValidatedMapActions(emptyMap, registry.mapActions, catalog);
    assert.equal(state.selectedCaseId, "sanmen-jidong"); assert.equal(state.selectedProvinceCode, "330000");
    assert.deepEqual(state.highlightedProvinceCodes, ["320000", "330000"]);
    assert(studioCaseHref({ caseId: state.selectedCaseId, solarTermId: state.selectedSolarTermId }).includes("caseId=sanmen-jidong"));
  });
  for (const id of ["not-a-case", "../private", ...catalog.filter(item => item.verificationStatus === "pending").map(item => item.id)]) await check(report, { id: `open-reject:${id}`, kind: "tool", group: "invalid_case_rejection", expectedRejection: true }, () => {
    assert.throws(() => invoke("open_cultural_case", { caseId: id }));
  });
  await check(report, { id: "uncovered-map-region", kind: "tool", group: "invalid_map_rejection", expectedRejection: true }, () => {
    assert.throws(() => invoke("highlight_regions", { provinceCodes: ["540000"] }), { code: "REGION_HAS_NO_CASES" });
  });
  await check(report, { id: "unknown-map-action", kind: "tool", group: "invalid_map_rejection", expectedRejection: true }, () => {
    assert.throws(() => applyValidatedMapActions(emptyMap, [{ type: "RUN_SCRIPT", payload: { code: "alert(1)" } }], catalog));
  });
  await check(report, { id: "strict-context-pending", group: "request_validation", expectedRejection: true }, () => {
    assert.throws(() => parseChatRequest({ version: "1.0", messages: [user("打开")], context: { solarTermId: "dongzhi", provinceCode: "610000", caseId: "huangling-flower-buns" } }), { code: "INVALID_CONTEXT" });
  });
  await check(report, { id: "duplicate-request", group: "request_deduplication", expectedRejection: true }, () => {
    const request = new Request("http://localhost/api/chat", { headers: { "Idempotency-Key": randomUUID() } });
    const first = beginAiRequest(request, "chat", "evaluation-only"); assert("finish" in first);
    const duplicate = beginAiRequest(request, "chat", "evaluation-only"); assert.equal(duplicate.status, 409); first.finish();
  });
  await check(report, { id: "caller-timeout", group: "isolated_runner_failures", expectedRejection: true }, async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new DOMException("evaluation deadline", "TimeoutError")), 8);
    try {
      const signal = controller.signal;
      await assert.rejects(runChatAgent(() => new Promise((_, reject) => signal.addEventListener("abort", () => reject(signal.reason), { once: true })), [user("超时分支")], [], undefined, [], { signal }), { name: "TimeoutError" });
    } finally { clearTimeout(timer); }
  });
  await check(report, { id: "cancel-final-response", group: "isolated_runner_failures", expectedRejection: true }, async () => {
    const controller = new AbortController();
    await assert.rejects(runChatAgent(async () => { controller.abort(new Error("eval-cancelled")); return completion("不应返回"); }, [user("取消分支")], [], undefined, [], { signal: controller.signal }), /eval-cancelled/);
  });
  await check(report, { id: "tool-failure-event", group: "isolated_runner_failures", expectedRejection: true }, async () => {
    let step = 0;
    const tool = { definition: { type: "function", function: { name: "evaluation_failure_fixture" } }, execute: () => { throw new Error("private detail must never escape"); } };
    const result = await runChatAgent(async () => ++step === 1 ? completion(null, [toolCall("evaluation_failure_fixture", {})]) : completion("工具未完成。"), [user("异常分支")], [tool]);
    assert.equal(result.toolEvents[0].status, "error"); assert(!JSON.stringify(result).includes("private detail"));
  });
  return summarize(report);
}

export async function evaluateLive(origin, selected = fixtures.live.map(sample => sample.id), previousReport) {
  const report = baseReport("real-model");
  report.origin = new URL(origin).origin;
  const catalog = readCulturalCases().filter(item => item.verificationStatus === "verified");
  const canonical = new Map(catalog.map(item => [item.id, item]));
  const completed = new Map((previousReport?.samples ?? []).filter(sample => sample.response?.version === "1.0").map(sample => [sample.id, sample]));
  report.liveSelection = selected;
  for (const fixture of fixtures.live.filter(sample => selected.includes(sample.id))) await check(report, { id: fixture.id, group: fixture.liveSearch ? "real_live_search" : "real_model", kind: "real_model" }, async () => {
    const prior = fixture.historyFrom ? completed.get(fixture.historyFrom) : undefined;
    if (fixture.historyFrom && !prior) throw new Error("Missing successful real history; run complex first or pass --history with a prior real report");
    const messages = prior ? [user(prior.question), { role: "assistant", content: prior.response.reply }, user(fixture.question)] : [user(fixture.question)];
    const response = await fetch(`${report.origin}/api/chat`, { method: "POST", headers: { Origin: report.origin, "Content-Type": "application/json", "Idempotency-Key": randomUUID() },
      body: JSON.stringify({ version: "1.0", includeEvidence: true, context: emptyContext, messages }), signal: AbortSignal.timeout(65000) });
    const data = await response.json();
    const sample = report.samples.at(-1); Object.assign(sample, { question: fixture.question, status: response.status, response: data });
    if (data.version === "1.0" && typeof data.reply === "string") completed.set(fixture.id, sample);
    assert.equal(response.status, 200, data.error?.code ?? "HTTP_FAILURE");
    assert.equal(data.version, "1.0"); assert(data.reply?.trim()); assert(data.evidence, "explicit evidence response");
    if (fixture.searchStatus) assert.equal(data.evidence.searchStatus, fixture.searchStatus, "expected search route");
    const references = data.caseReferences ?? [];
    for (const reference of references) {
      const item = canonical.get(reference.caseId); assert(item, "verified case ID"); assert.equal(reference.title, item.title);
      assert(item.solarTermIds.includes(reference.solarTermId)); assert.equal(reference.provinceCode, item.provinceCode);
      assert(reference.sources.every(source => item.sources.some(actual => actual.url === source.url)));
    }
    if (fixture.expectedIds) assert(fixture.expectedIds.every(id => references.some(reference => reference.caseId === id)), `Missing expected case ${fixture.expectedIds.join(",")}`);
    if (fixture.category) assert(references.every(reference => canonical.get(reference.caseId).category === fixture.category));
    if (fixture.mustBeEmpty) { assert.equal(references.length, 0); assert(/未|没有|无法|不能|不确定/.test(data.reply)); }
    if (fixture.tools) for (const name of fixture.tools) assert(data.toolEvents.some(event => event.toolName === name && event.status === "success"), `Missing successful ${name}`);
    if (fixture.id === "complex") {
      assert(data.mapActions.some(action => action.type === "HIGHLIGHT_PROVINCES" && ["320000", "330000"].every(code => action.payload.provinceCodes.includes(code))));
      assert(data.mapActions.some(action => action.type === "OPEN_CULTURAL_CASE" && action.payload.caseId === "sanmen-jidong"));
    }
    if (fixture.liveSearch) { assert(/参考来源（检索于/.test(data.reply)); assert(data.evidence.webSources?.length, "actual web source records"); }
    return { retrievedIds: references.map(reference => reference.caseId), successfulTools: data.toolEvents.filter(event => event.status === "success" && !event.reused).map(event => event.toolName), reusedTools: data.toolEvents.filter(event => event.status === "success" && event.reused).map(event => event.toolName) };
  });
  report.passed = report.samples.every(sample => sample.passed);
  report.summary = { sampleCount: report.samples.length, passed: report.samples.filter(sample => sample.passed).length, failed: report.samples.filter(sample => !sample.passed).length,
    retrieval: { expectedSamples: report.samples.filter(sample => fixtures.live.find(f => f.id === sample.id)?.expectedIds).length, matchingSamples: report.samples.filter(sample => sample.passed && fixtures.live.find(f => f.id === sample.id)?.expectedIds).length },
    citations: { scope: "Programmatic source/entity consistency; model explanations are not semantically certified. No-citation answers excluded.", ...liveCitationMetrics(report.samples, canonical) },
    tools: { executed: report.samples.reduce((sum, sample) => sum + (sample.response?.toolEvents?.filter(event => !event.reused).length ?? 0), 0), successfulExecutions: report.samples.reduce((sum, sample) => sum + (sample.response?.toolEvents?.filter(event => event.status === "success" && !event.reused).length ?? 0), 0), reusedResults: report.samples.reduce((sum, sample) => sum + (sample.response?.toolEvents?.filter(event => event.status === "success" && event.reused).length ?? 0), 0) },
    latencyMs: { median: percentile(report.samples.map(sample => sample.ms), .5), p95: percentile(report.samples.map(sample => sample.ms), .95) }, failures: report.samples.filter(sample => !sample.passed).map(({ id, status, error }) => ({ id, status, error })) };
  return report;
}

function liveCitationMetrics(samples, canonical) {
  let actualMentions = 0, validMentions = 0;
  for (const sample of samples) {
    const data = sample.response;
    if (!data || sample.status !== 200) continue;
    const answer = (data.answerText ?? data.reply ?? "").split(/\n\n(?:文化案例来源（|参考来源（检索于)/u)[0];
    const local = [...answer.matchAll(/\[案例(\d+)\]/gu)].map(match => Number(match[1]));
    const web = [...answer.matchAll(/\[(\d+)\]/gu)].map(match => Number(match[1]));
    actualMentions += local.length + web.length;
    for (const citation of local) {
      const item = data.evidence?.localCases?.find(item => item.citation === citation);
      const actual = item && canonical.get(item.caseId);
      if (actual && actual.title === item.title && actual.provinceCode === item.provinceCode &&
        JSON.stringify(actual.solarTermIds) === JSON.stringify(item.solarTermIds) && item.sources.every(source => actual.sources.some(entry => entry.url === source.url))) validMentions++;
    }
    for (const citation of web) if (data.evidence?.searchStatus === "available" && data.evidence.webSources?.some(source => source.citation === citation && /^https?:\/\//.test(source.url))) validMentions++;
  }
  return { actualMentions, validMentions, associationValidityRate: ratio(validMentions, actualMentions) };
}

async function main() {
  const args = process.argv.slice(2);
  const live = args.includes("--live");
  const value = name => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : undefined; };
  const origin = value("--origin") ?? "http://127.0.0.1:3115";
  const selected = value("--cases")?.split(",");
  if (selected && !selected.every(id => fixtures.live.some(sample => sample.id === id))) throw new Error("Unknown live case selection");
  const previous = value("--history") ? JSON.parse(readFileSync(resolve(value("--history")), "utf8")) : undefined;
  const report = live ? await evaluateLive(origin, selected, previous) : await evaluateDeterministic();
  const output = resolve(value("--output") ?? `docs/verification/ai-final-2026-11-15/${live ? "real-model" : "deterministic"}-${Date.now()}.json`);
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
  console.log(JSON.stringify({ mode: report.mode, allPassed: report.passed, output, ...report.summary }, null, 2));
  if (!report.passed) process.exitCode = 1;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
