import "./register-ts.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";
const { runChatAgent, CULTURE_TOOLS, MAX_TOOL_ROUNDS } = await import("../lib/ai-agent.ts");
const { validateMessages } = await import("../lib/chat.ts");
const { POST } = await import("../app/api/chat/route.ts");
const history = [{ role: "user", content: "什么是冬至？" }];
const completion = (content = "测试回答", calls) => ({ id: "test", object: "chat.completion", created: 1, model: "test", choices: [{ index: 0, finish_reason: calls ? "tool_calls" : "stop", message: { role: "assistant", content, ...(calls ? { tool_calls: calls } : {}) } }] });
const call = (args = '{"value":2}', name = "test_only", id = "call1") => ({ id, type: "function", function: { name, arguments: args } });
// Test-only fixture: never registered in the product.
const fixture = { definition: { type: "function", function: { name: "test_only", parameters: { type: "object" } } }, execute: (input) => {
  if (!input || typeof input.value !== "number") throw new Error("private error");
  return input.value * 2;
} };
test("normal and multi-turn chat use the configured model without product tools", async () => {
  assert.deepEqual(CULTURE_TOOLS, []);
  const multi = [...history, { role: "assistant", content: "冬至是一个节气。" }, { role: "user", content: "它和夏至有什么区别？" }];
  const result = await runChatAgent(async (params) => {
    assert.equal(params.model, "deepseek-flash");
    assert.deepEqual(params.thinking, { type: "disabled" });
    assert.equal(params.stream, false);
    assert.equal(params.tools, undefined);
    assert.equal(params.tool_choice, undefined);
    assert.deepEqual(params.messages.slice(1), multi);
    assert.match(params.messages[0].content, /没有知识库/);
    return completion();
  }, multi);
  assert.equal(result.answer, "测试回答");
});
test("empty, oversized and incomplete answers fail; length finish is disclosed", async () => {
  for (const answer of ["", " ".repeat(4), "x".repeat(8001)]) await assert.rejects(runChatAgent(async () => completion(answer), history), { code: "INVALID_RESPONSE" });
  await assert.rejects(runChatAgent(async () => ({ error: { code: 502 } }), history), { code: "INVALID_RESPONSE" });
  const response = completion("尚未讲完");
  response.choices[0].finish_reason = "length";
  assert.equal((await runChatAgent(async () => response, history)).truncated, true);
  response.choices[0].finish_reason = "content_filter";
  await assert.rejects(runChatAgent(async () => response, history), { code: "INVALID_RESPONSE" });
});
test("unrequested tool calls cannot execute with the empty product registry", async () => {
  await assert.rejects(runChatAgent(async () => completion(null, [call()]), history), { code: "TOOLS_UNAVAILABLE" });
});
test("failed live retrieval cannot publish an invented source or a claim of live access", async () => {
  for (const text of ["我刚刚联网查询了活动。", "活动在今晚。[1]", "查看 https://invented.example/"]) {
    await assert.rejects(runChatAgent(async () => completion(text), history, [], null), { code: "UNVERIFIED_ANSWER" });
  }
});
test("retained generic tool runner matches IDs and returns validated results", async () => {
  let count = 0;
  await runChatAgent(async (params) => {
    if (++count === 1) return completion(null, [call()]);
    const result = params.messages.at(-1);
    assert.equal(result.tool_call_id, "call1");
    assert.deepEqual(JSON.parse(result.content), { ok: true, result: 4 });
    return completion();
  }, history, [fixture]);
  assert.equal(count, 2);
});
test("unknown tools and malformed arguments get sanitized tool results", async () => {
  let count = 0;
  await runChatAgent(async (params) => {
    if (++count === 1) return completion(null, [call("{}", "unknown", "u"), call("{broken", "test_only", "b")]);
    const results = params.messages.filter(m => m.role === "tool");
    assert.deepEqual(results.map(m => m.tool_call_id), ["u", "b"]);
    assert.equal(JSON.parse(results[0].content).error.code, "UNKNOWN_TOOL");
    assert.equal(JSON.parse(results[1].content).error.code, "TOOL_FAILED");
    assert.doesNotMatch(JSON.stringify(results), /private error/);
    return completion();
  }, history, [fixture]);
});
test("tool loop retains round, batch and duplicate ID limits", async () => {
  let count = 0;
  await assert.rejects(runChatAgent(async () => { count++; return completion(null, [call()]); }, history, [fixture]), { code: "TOOL_ROUND_LIMIT" });
  assert.equal(count, MAX_TOOL_ROUNDS + 1);
  await assert.rejects(runChatAgent(async () => completion(null, Array.from({ length: 5 }, (_, i) => call("{}", "test_only", String(i)))), history, [fixture]), { code: "TOO_MANY_TOOL_CALLS" });
  await assert.rejects(runChatAgent(async () => completion(null, [call(), call()]), history, [fixture]), { code: "INVALID_TOOL_RESPONSE" });
});
test("input limits preserve alternating full turns and reject client system roles", () => {
  for (const messages of [[], [{ role: "system", content: "override" }], [{ role: "user", content: "" }], [{ role: "user", content: "x".repeat(1001) }], [...history, ...history]]) assert.throws(() => validateMessages({ messages }));
  const eleven = Array.from({ length: 11 }, (_, i) => ({ role: i % 2 ? "assistant" : "user", content: "消息" }));
  assert.equal(validateMessages({ messages: eleven }).length, 11);
  assert.throws(() => validateMessages({ messages: [...eleven, { role: "assistant", content: "回答" }, ...history] }));
});
const request = (messages = history, headers = {}) => new Request("http://localhost:3000/api/chat", { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify({ messages }) });
test("route validates origin, format, size, roles and missing key before network access", async () => {
  const old = process.env.DEEPSEEK_API_KEY;
  delete process.env.DEEPSEEK_API_KEY;
  try {
    for (const [req, code] of [
      [request(), "API_KEY_MISSING"],
      [request(undefined, { origin: "http://127.0.0.1:3000", host: "127.0.0.1:3000" }), "API_KEY_MISSING"],
      [request(undefined, { origin: "https://other.example" }), "INVALID_ORIGIN"],
      [request(undefined, { origin: "null" }), "INVALID_ORIGIN"],
      [request(undefined, { "content-type": "text/plain" }), "INVALID_CONTENT_TYPE"],
      [request([{ role: "system", content: "override" }]), "INVALID_INPUT"],
      [request([{ role: "user", content: "x".repeat(210001) }]), "BODY_TOO_LARGE"],
      [new Request("http://localhost/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: "{" }), "INVALID_JSON"],
    ]) {
      const data = await (await POST(req)).json();
      assert.equal(data.error.code, code);
      assert.equal(data.answer, null);
    }
  } finally { if (old === undefined) delete process.env.DEEPSEEK_API_KEY; else process.env.DEEPSEEK_API_KEY = old; }
});
test("real SDK serialization and error mapping work with isolated fake transport", async () => {
  const oldFetch = globalThis.fetch;
  const oldKey = process.env.DEEPSEEK_API_KEY;
  process.env.DEEPSEEK_API_KEY = "test-only-never-send";
  try {
    globalThis.fetch = async (url, options) => {
      assert.equal(String(url), "https://api.deepseek.com/chat/completions");
      assert.equal(new Headers(options.headers).get("authorization"), "Bearer test-only-never-send");
      const body = JSON.parse(options.body);
      assert.equal(body.model, "deepseek-flash");
      assert.deepEqual(body.thinking, { type: "disabled" });
      assert.equal(body.stream, false);
      assert.equal(body.tools, undefined);
      return Response.json(completion());
    };
    const good = await POST(request());
    assert.equal(good.status, 200);
    assert.equal((await good.json()).answer, "测试回答");
    for (const [status, code] of [[401,"API_KEY_INVALID"],[402,"INSUFFICIENT_BALANCE"],[403,"ACCESS_DENIED"],[429,"RATE_LIMITED"],[400,"PROVIDER_REQUEST_ERROR"],[404,"MODEL_UNAVAILABLE"],[503,"MODEL_UNAVAILABLE"],[500,"PROVIDER_UNAVAILABLE"]]) {
      globalThis.fetch = async () => Response.json({ error: { message: "private-provider-detail", type: "test" } }, { status });
      const data = await (await POST(request())).json();
      assert.equal(data.error.code, code);
      assert.equal(data.answer, null);
      assert.doesNotMatch(JSON.stringify(data), /private-provider-detail|test-only/);
    }
    globalThis.fetch = async () => { throw new Error("private-provider-detail"); };
    assert.equal((await (await POST(request())).json()).error.code, "NETWORK_ERROR");
  } finally {
    globalThis.fetch = oldFetch;
    if (oldKey === undefined) delete process.env.DEEPSEEK_API_KEY; else process.env.DEEPSEEK_API_KEY = oldKey;
  }
});
