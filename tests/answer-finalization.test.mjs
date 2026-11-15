import "./register-ts.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";

const { validateAgentAnswer, runChatAgent } = await import("../lib/ai-agent.ts");
const { POST } = await import("../app/api/chat/route.ts");
const completion = (content, calls) => ({ choices: [{ finish_reason: calls ? "tool_calls" : "stop", message: { content, ...(calls ? { tool_calls: calls } : {}) } }] });
const call = (name, input, id) => ({ id, type: "function", function: { name, arguments: JSON.stringify(input) } });
const context = { solarTermId: null, provinceCode: null, caseId: null };
const request = () => new Request("http://localhost:3000/api/chat", { method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ version: "1.0", includeEvidence: true, context, messages: [{ role: "user", content: "介绍三门祭冬，展示冬至地图。" }] }) });
function key(t) {
  const previous = process.env.DEEPSEEK_API_KEY;
  process.env.DEEPSEEK_API_KEY = "test-only-answer-finalization";
  t.after(() => { if (previous === undefined) delete process.env.DEEPSEEK_API_KEY; else process.env.DEEPSEEK_API_KEY = previous; });
}

test("final answer guards reject ungrounded web labels and unapplied map claims, but allow prepared actions", async () => {
  assert.throws(() => validateAgentAnswer("饮食习俗[1]"), { code: "UNVERIFIED_ANSWER" });
  for (const answer of ["江苏浙江两省已高亮。", "冬至地图已切换到冬至。", "三门祭冬案例已经打开。", "并打开了三门祭冬案例。"])
    assert.throws(() => validateAgentAnswer(answer, undefined, true), { code: "UNAPPLIED_MAP_CLAIM" });
  validateAgentAnswer("已准备地图操作，请点击「在地图中查看」后高亮两省并打开案例。", undefined, true);
  assert.throws(() => validateAgentAnswer("江苏、浙江的冬至地图与三门祭冬案例已在上一轮设置。", undefined, true), { code: "UNAPPLIED_MAP_CLAIM" });
  assert.throws(() => validateAgentAnswer("已准备地图操作，请点击「在地图中查看」后应用。", undefined, true, false), { code: "UNAPPLIED_MAP_CLAIM" });
  await assert.rejects(() => runChatAgent(async () => completion("无来源说明[1]"), [{ role: "user", content: "什么是冬至？" }]), { code: "UNVERIFIED_ANSWER" });
});

test("an ungrounded numeric citation uses the existing one repair without replaying tools", async t => {
  key(t);
  let step = 0;
  t.mock.method(globalThis, "fetch", async () => {
    if (++step === 1) return Response.json(completion(null, [call("show_cultural_map", { solarTermId: "dongzhi" }, "map"), call("search_cultural_cases", { query: "三门祭冬" }, "case")]));
    return Response.json(completion(step === 2 ? "三门祭冬是冬至习俗。[1]" : "三门祭冬是浙江冬至习俗。[案例1] 已准备地图操作，请点击「在地图中查看」后应用。"));
  });
  const response = await POST(request());
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(step, 3);
  assert.deepEqual(data.toolEvents.map(event => event.toolCallId), ["map", "case"]);
  assert.equal(data.mapActions[0].type, "SET_SOLAR_TERM");
  assert.equal(data.evidence.localCases[0].caseId, "sanmen-jidong");
  assert.equal(data.evidence.searchStatus, "not_requested");
  assert(!data.answer.includes("[1]"));
});

test("unapplied map claims can be repaired, while a second invalid answer is refused without another generation", async t => {
  key(t);
  for (const stillInvalid of [false, true]) {
    let step = 0;
    const mock = t.mock.method(globalThis, "fetch", async () => {
      if (++step === 1) return Response.json(completion(null, [call("show_cultural_map", { solarTermId: "dongzhi" }, "map"), call("search_cultural_cases", { query: "三门祭冬" }, "case")]));
      return Response.json(completion(step === 2 || stillInvalid ? "三门祭冬属于冬至。[案例1] 地图已切换到冬至。" : "浙江三门祭冬属于冬至。[案例1] 已准备地图操作，请点击后应用。"));
    });
    const response = await POST(request());
    assert.equal(step, 3);
    const data = await response.json();
    if (stillInvalid) { assert.equal(response.status, 502); assert.equal(data.error.code, "UNAPPLIED_MAP_CLAIM"); assert.equal(data.mapActions, undefined); }
    else { assert.equal(response.status, 200); assert.equal(data.toolEvents.length, 2); assert.equal(data.mapActions.length, 1); }
    mock.mock.restore();
  }
});

test("a follow-up cannot claim a map entry exists when only comparison ran", async t => {
  key(t);
  let step = 0;
  t.mock.method(globalThis, "fetch", async () => {
    if (++step === 1) return Response.json(completion(null, [call("compare_cultural_cases", { solarTermId: "dongzhi", provinceCodes: ["320000", "330000"], category: "food" }, "compare")]));
    return Response.json(completion(step === 2 ? "姑苏冬至喝冬酿酒属于饮食。[案例1] 已准备地图操作，请点击「在地图中查看」后应用。" : "姑苏冬至喝冬酿酒属于江苏冬至饮食。[案例1] 浙江未查到匹配的饮食案例。"));
  });
  const response = await POST(request());
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(step, 3);
  assert.deepEqual(data.mapActions, []);
  assert.deepEqual(data.toolEvents.map(event => event.toolName), ["compare_cultural_cases"]);
  assert(!data.answer.includes("在地图中查看"));
});
