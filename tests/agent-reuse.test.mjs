import "./register-ts.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";

const { runChatAgent } = await import("../lib/ai-agent.ts");
const completion = calls => ({ choices: [{ finish_reason: calls ? "tool_calls" : "stop", message: { content: calls ? null : "工具结果已核对。", ...(calls ? { tool_calls: calls } : {}) } }] });
const call = (id, name, args) => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });
const history = [{ role: "user", content: "查询节气知识。" }];

test("repeated read-only queries reuse a real previous result and disclose reuse without re-execution", async () => {
  let executions = 0;
  const tool = { definition: { type: "function", function: { name: "search_cultural_cases" } }, execute: () => ({ total: ++executions }) };
  let requests = 0;
  const result = await runChatAgent(async params => {
    if (++requests === 1) return completion([call("one", "search_cultural_cases", { query: "冬至", category: "food" }), call("two", "search_cultural_cases", { category: "food", query: "冬至" })]);
    const outputs = params.messages.filter(item => item.role === "tool").map(item => JSON.parse(item.content));
    assert.equal(outputs[0].result.total, 1);
    assert.equal(outputs[1].result.total, 1);
    assert.equal(outputs[1].reused, true);
    return completion();
  }, history, [tool], undefined, [], { reuseReadTools: true });
  assert.equal(executions, 1);
  assert.equal(result.toolEvents[0].reused, undefined);
  assert.equal(result.toolEvents[1].reused, true);
});

test("stateful map tools are never cached and old callers do not get new reuse fields", async () => {
  for (const [name, reuseReadTools] of [["show_cultural_map", true], ["search_cultural_cases", false]]) {
    let executions = 0, requests = 0;
    const tool = { definition: { type: "function", function: { name } }, execute: () => ++executions };
    const result = await runChatAgent(async () => ++requests === 1 ? completion([call("one", name, {}), call("two", name, {})]) : completion(), history, [tool], undefined, [], { reuseReadTools });
    assert.equal(executions, 2);
    assert(result.toolEvents.every(event => !("reused" in event)));
  }
});

test("a failed query is not cached so a corrected attempt can recover with an actual execution", async () => {
  let executions = 0, requests = 0;
  const tool = { definition: { type: "function", function: { name: "get_solar_term_info" } }, execute: () => { if (++executions === 1) throw new Error("private failure"); return { name: "冬至" }; } };
  const result = await runChatAgent(async () => ++requests === 1 ? completion([call("one", "get_solar_term_info", {}), call("two", "get_solar_term_info", {})]) : completion(), history, [tool], undefined, [], { reuseReadTools: true });
  assert.equal(executions, 2);
  assert.deepEqual(result.toolEvents.map(event => event.status), ["error", "success"]);
  assert(!JSON.stringify(result).includes("private failure"));
});

test("a real asynchronous tool deadline is recorded as TOOL_TIMEOUT", async () => {
  let requests = 0;
  const tool = { definition: { type: "function", function: { name: "search_cultural_cases" } }, execute: () => new Promise(() => {}) };
  const result = await runChatAgent(async () => ++requests === 1 ? completion([call("slow", "search_cultural_cases", {})]) : completion(), history, [tool]);
  assert.equal(result.toolEvents[0].status, "error");
  assert.equal(result.toolEvents[0].error.code, "TOOL_TIMEOUT");
});
