import "./register-ts.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";

const { runChatAgent } = await import("../lib/ai-agent.ts");
const { POST } = await import("../app/api/chat/route.ts");
const completion = content => ({ choices: [{ finish_reason: "stop", message: { content } }] });

test("cancelling while the final completion resolves never publishes a successful answer", async () => {
  const controller = new AbortController();
  await assert.rejects(runChatAgent(async () => {
    controller.abort(new Error("cancelled-at-completion"));
    return completion("冬至是二十四节气之一。");
  }, [{ role: "user", content: "什么是冬至？" }], [], undefined, [], { signal: controller.signal }), /cancelled-at-completion/);
});

test("a citation repair that still omits local sources is rejected instead of silently hiding the case cards", async t => {
  const oldKey = process.env.DEEPSEEK_API_KEY;
  process.env.DEEPSEEK_API_KEY = "test-only-source-boundary";
  t.after(() => {
    if (oldKey === undefined) delete process.env.DEEPSEEK_API_KEY;
    else process.env.DEEPSEEK_API_KEY = oldKey;
  });
  let step = 0;
  t.mock.method(globalThis, "fetch", async () => {
    if (++step === 1) return Response.json({ choices: [{ finish_reason: "tool_calls", message: {
      content: null, tool_calls: [{ id: "lookup", type: "function", function: {
        name: "search_cultural_cases", arguments: JSON.stringify({ query: "北京 夏至 吃面" }),
      } }],
    } }] });
    return Response.json(completion("北京有夏至吃面的习俗。"));
  });
  const response = await POST(new Request("http://localhost:3000/api/chat", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ version: "1.0", context: { solarTermId: null, provinceCode: null, caseId: null },
      messages: [{ role: "user", content: "介绍北京夏至吃面的习俗并给出来源。" }] }),
  }));
  assert.equal(response.status, 502);
  const body = await response.json();
  assert.equal(body.error.code, "CASE_ANSWER_UNSUPPORTED");
  assert.equal(body.answer, null);
  assert.equal(body.mapActions, undefined);
  assert.equal(step, 3);
});

test("successful citation repair retains the original real tool events and prepared map actions", async t => {
  const oldKey = process.env.DEEPSEEK_API_KEY;
  process.env.DEEPSEEK_API_KEY = "test-only-source-repair-events";
  t.after(() => {
    if (oldKey === undefined) delete process.env.DEEPSEEK_API_KEY;
    else process.env.DEEPSEEK_API_KEY = oldKey;
  });
  let step = 0;
  t.mock.method(globalThis, "fetch", async () => {
    if (++step === 1) return Response.json({ choices: [{ finish_reason: "tool_calls", message: {
      content: null, tool_calls: [
        { id: "show", type: "function", function: { name: "show_cultural_map", arguments: '{"solarTermId":"xiazhi"}' } },
        { id: "lookup", type: "function", function: { name: "search_cultural_cases", arguments: '{"query":"北京 夏至 吃面"}' } },
      ],
    } }] });
    return Response.json(completion(step === 2 ? "北京有夏至吃面的习俗。[案例99]" : "北京有夏至吃面的习俗。[案例1]"));
  });
  const response = await POST(new Request("http://localhost:3000/api/chat", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ version: "1.0", context: { solarTermId: null, provinceCode: null, caseId: null },
      messages: [{ role: "user", content: "介绍北京夏至吃面并显示地图。" }] }),
  }));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body.toolEvents.map(event => [event.toolCallId, event.status]), [["show", "success"], ["lookup", "success"]]);
  assert.deepEqual(body.mapActions, [{ type: "SET_SOLAR_TERM", payload: { solarTermId: "xiazhi" } }]);
  assert.equal(body.caseReferences[0].caseId, "beijing-xiazhi-noodles");
  assert.ok(body.references.every(source => source.caseId === "beijing-xiazhi-noodles"));
  assert.equal(step, 3);
});
