// Opt-in acceptance against a running server: real DeepSeek calls, no mocks or automatic retries.
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const origin = new URL(process.argv[2] ?? "http://127.0.0.1:3115").origin;
const output = resolve(process.argv[3] ?? `docs/verification/agent-v1-2026-11-15/ai-live-${Date.now()}.json`);
const selected = process.argv[4]?.split(",").map(Number) ?? [1, 2, 3];
assert(selected.every(value => [1, 2, 3].includes(value)));
const cases = JSON.parse(readFileSync(new URL("../data/cultural-cases/cases.json", import.meta.url), "utf8"));
const verified = cases.filter(item => item.verificationStatus === "verified");
const ids = new Set(verified.map(item => item.id));
const baselineCases = JSON.parse(execFileSync("git", ["show", "HEAD:data/cultural-cases/cases.json"], { encoding: "utf8" }));
assert.deepEqual(cases, baselineCases, "the runtime case collection is unchanged from the checked-out Git baseline");
const emptyContext = { solarTermId: null, provinceCode: null, caseId: null };
const comparison = "先查询冬至的节气信息，再比较江苏和浙江冬至的已核验民俗特点和资料来源。请展示冬至文化地图，突出江苏、浙江，打开三门祭冬案例，方便我继续做节气卡。请实际使用相应工具完成。";
const report = { testedAt: new Date().toISOString(), origin, method: "Real server POST requests, real DeepSeek, no mocked transport, no automatic retry", dataBoundary: { verified: verified.length, pending: cases.length - verified.length, unchangedFromGitBaseline: true, normalizedSha256: createHash("sha256").update(JSON.stringify(cases)).digest("hex") }, checks: [], passed: false };
let comparisonAnswer;
if (process.argv[5]) {
  const previous = JSON.parse(readFileSync(resolve(process.argv[5]), "utf8"));
  const actual = previous.checks?.find(check => check.index === 2 && check.status === 200)?.response;
  assert.equal(actual?.version, "1.0");
  assert.equal(typeof actual?.reply, "string");
  comparisonAnswer = actual.reply;
  report.historyEvidence = process.argv[5];
}

function validateEnvelope(data) {
  assert.equal(data.version, "1.0");
  assert.equal(typeof data.reply, "string");
  assert(data.reply.trim());
  for (const key of ["mapActions", "toolEvents", "references"]) assert(Array.isArray(data[key]), key);
  assert(data.mapActions.length <= 8 && data.toolEvents.length <= 8);
  for (const reference of data.caseReferences ?? []) assert(ids.has(reference.caseId), "only verified case references");
  assert(!JSON.stringify(data).includes("huangling-flower-buns"));
  assert(!JSON.stringify(data).includes("xinzheng-jujube-harvest"));
}

for (const index of selected) {
  const check = { index };
  report.checks.push(check);
  const context = index === 3 ? { solarTermId: "dongzhi", provinceCode: "330000", caseId: "sanmen-jidong" } : emptyContext;
  const question = index === 1 ? "冬至为什么不一定最冷？请用一句话解释。" : index === 2 ? comparison : "那只看饮食类，继续比较这两个地区，并提供已核实来源。";
  check.question = question;
  const messages = index === 3 && comparisonAnswer
    ? [{ role: "user", content: comparison }, { role: "assistant", content: comparisonAnswer }, { role: "user", content: question }]
    : [{ role: "user", content: question }];
  if (index === 3 && !comparisonAnswer) {
    check.passed = false;
    check.error = "SKIPPED_FOLLOWUP_WITHOUT_SUCCESSFUL_COMPARISON";
    process.exitCode = 1;
    continue;
  }
  const start = Date.now();
  try {
    const response = await fetch(`${origin}/api/chat`, {
      method: "POST", headers: { Origin: origin, "Content-Type": "application/json", "Idempotency-Key": randomUUID() },
      body: JSON.stringify({ version: "1.0", context, messages }), signal: AbortSignal.timeout(65_000),
    });
    check.status = response.status;
    const data = await response.json();
    check.response = data;
    if (!response.ok) throw new Error(data.error?.code ?? "HTTP_FAILURE");
    validateEnvelope(data);
    if (index === 1) assert.equal(data.mapActions.length, 0, "ordinary knowledge does not alter the map");
    if (index === 2) {
      // A real successful answer may still fail map acceptance; retain its actual text for the independent follow-up check.
      comparisonAnswer = data.reply;
      const successes = new Set(data.toolEvents.filter(event => event.status === "success").map(event => event.toolName));
      for (const tool of ["compare_cultural_cases", "show_cultural_map", "highlight_regions", "open_cultural_case"]) assert(successes.has(tool), `actual tool ${tool}`);
      assert(data.mapActions.some(action => action.type === "SET_SOLAR_TERM" && action.payload.solarTermId === "dongzhi"));
      assert(data.mapActions.some(action => action.type === "HIGHLIGHT_PROVINCES" && ["320000", "330000"].every(code => action.payload.provinceCodes.includes(code))));
      assert(data.mapActions.some(action => action.type === "OPEN_CULTURAL_CASE" && action.payload.caseId === "sanmen-jidong"));
      const provinces = new Set((data.caseReferences ?? []).map(reference => reference.provinceCode));
      assert(provinces.has("320000") && provinces.has("330000"), "both regional sources are represented");
    }
    if (index === 3) {
      assert(data.toolEvents.some(event => event.status === "success"), "follow-up executes a real tool");
      assert(data.caseReferences?.length > 0, "the matching Jiangsu food case is referenced");
      assert((data.caseReferences ?? []).every(reference => {
        const item = verified.find(item => item.id === reference.caseId);
        return item?.solarTermIds.includes("dongzhi") && ["320000", "330000"].includes(item.provinceCode) && item.category === "food";
      }), "follow-up keeps term/regions and intersects food category");
    }
    check.passed = true;
  } catch (error) {
    check.passed = false;
    check.error = error instanceof assert.AssertionError ? error.message : `${error.name}: ${error.message}`.slice(0, 240);
    process.exitCode = 1;
  }
  check.ms = Date.now() - start;
  console.log(JSON.stringify({ index, status: check.status, passed: check.passed, ms: check.ms, error: check.error }));
}
report.passed = report.checks.every(check => check.passed);
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
console.log(`Evidence: ${output}`);
