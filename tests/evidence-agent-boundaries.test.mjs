import "./register-ts.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";

const { runChatAgent, AgentToolError } = await import("../lib/ai-agent.ts");
const { POST } = await import("../app/api/chat/route.ts");
const { ChatSuccessV1Schema } = await import("../lib/contracts/chat-api.ts");
const history = [{ role: "user", content: "介绍三门祭冬并展示地图。" }];
const completion = (content, calls) => ({ choices: [{ finish_reason: calls ? "tool_calls" : "stop", message: { content, ...(calls ? { tool_calls: calls } : {}) } }] });
const call = (name, input, id) => ({ id, type: "function", function: { name, arguments: JSON.stringify(input) } });
const fixture = (name, execute) => ({ definition: { type: "function", function: { name } }, execute });
const context = { solarTermId: null, provinceCode: null, caseId: null };
const request = extra => new Request("http://localhost:3000/api/chat", { method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ version: "1.0", messages: history, context, ...extra }) });
function key(t) {
  const value = process.env.DEEPSEEK_API_KEY;
  process.env.DEEPSEEK_API_KEY = "test-only-evidence-agent-boundary";
  t.after(() => { if (value === undefined) delete process.env.DEEPSEEK_API_KEY; else process.env.DEEPSEEK_API_KEY = value; });
}

test("read-only reuse marks the second actual call and never suppresses map action tools", async () => {
  let reads = 0;
  let maps = 0;
  let model = 0;
  const result = await runChatAgent(async params => {
    if (++model === 1) return completion(null, [
      call("search_cultural_cases", { query: "三门", limit: 2 }, "read-1"),
      call("search_cultural_cases", { limit: 2, query: "三门" }, "read-2"),
      call("show_cultural_map", { solarTermId: "dongzhi" }, "map-1"),
      call("show_cultural_map", { solarTermId: "dongzhi" }, "map-2"),
    ]);
    const tools = params.messages.filter(message => message.role === "tool").map(message => JSON.parse(message.content));
    assert.equal(tools[1].reused, true);
    assert.deepEqual(tools[1].result, tools[0].result);
    return completion("已准备地图。");
  }, history, [fixture("search_cultural_cases", () => ({ read: ++reads })), fixture("show_cultural_map", () => ({ map: ++maps }))], undefined, [], { reuseReadTools: true });
  assert.equal(reads, 1);
  assert.equal(maps, 2);
  assert.deepEqual(result.toolEvents.map(event => event.reused ?? false), [false, true, false, false]);
});

test("failed read tools are not cached and a later successful call is recorded as real execution", async () => {
  let reads = 0;
  let model = 0;
  const result = await runChatAgent(async () => ++model === 1 ? completion(null, [
    call("search_cultural_cases", { query: "三门" }, "first"), call("search_cultural_cases", { query: "三门" }, "second"),
  ]) : completion("第二次查询已取得资料。"), history, [fixture("search_cultural_cases", () => {
    if (++reads === 1) throw new AgentToolError("TOOL_TIMEOUT", "工具查询超时。");
    return { actual: true };
  })], undefined, [], { reuseReadTools: true });
  assert.equal(reads, 2);
  assert.equal(result.toolEvents[0].status, "error");
  assert.equal(result.toolEvents[0].error.code, "TOOL_TIMEOUT");
  assert.equal(result.toolEvents[1].status, "success");
  assert.equal(result.toolEvents[1].reused, undefined);
});

test("older V1 callers get neither reuse markers nor evidence extensions", async t => {
  key(t);
  let step = 0;
  t.mock.method(globalThis, "fetch", async () => Response.json(++step % 2 ? completion(null, [
    call("search_cultural_cases", { query: "三门祭冬" }, `first-${step}`),
    call("search_cultural_cases", { query: "三门祭冬" }, `second-${step}`),
  ]) : completion("浙江三门祭冬属于冬至文化。[案例1]")));
  for (const extra of [{}, { includeEvidence: false }]) {
    const response = await POST(request(extra));
    assert.equal(response.status, 200);
    const data = ChatSuccessV1Schema.parse(await response.json());
    assert.equal(data.evidence, undefined);
    assert.equal(data.retrievalDiagnostics, undefined);
    assert.equal(data.toolEvents.length, 2);
    assert(data.toolEvents.every(event => !Object.hasOwn(event, "reused")));
  }
});

test("one bounded repair removes explicit metadata contradictions while retaining true tools and evidence", async t => {
  key(t);
  let step = 0;
  t.mock.method(globalThis, "fetch", async () => {
    if (++step === 1) return Response.json(completion(null, [
      call("show_cultural_map", { solarTermId: "dongzhi" }, "map"),
      call("search_cultural_cases", { query: "三门祭冬" }, "cases"),
    ]));
    return Response.json(completion(step === 2 ? "北京三门祭冬属于清明习俗。[案例1]" : "浙江三门祭冬属于冬至文化。[案例1]"));
  });
  const response = await POST(request({ includeEvidence: true }));
  assert.equal(response.status, 200);
  const data = ChatSuccessV1Schema.parse(await response.json());
  assert.equal(step, 3);
  assert.deepEqual(data.toolEvents.map(event => [event.toolCallId, event.status]), [["map", "success"], ["cases", "success"]]);
  assert.deepEqual(data.mapActions, [{ type: "SET_SOLAR_TERM", payload: { solarTermId: "dongzhi" } }]);
  assert.equal(data.evidence.localCases[0].caseId, "sanmen-jidong");
  assert.equal(data.evidence.localCases[0].provinceCode, "330000");
  assert.deepEqual(data.evidence.localCases[0].solarTermIds, ["dongzhi"]);
  assert.equal(data.evidence.localCases[0].cited, true);
  assert.equal(data.evidence.checks.statementTruth, false);
  assert(!data.answer.includes("北京三门"));
});
