import "./register-ts.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";

const { POST } = await import("../app/api/chat/route.ts");
const { ChatSuccessV1Schema } = await import("../lib/contracts/chat-api.ts");
const context = { solarTermId: null, provinceCode: null, caseId: null };
const request = extra => new Request("http://localhost:3000/api/chat", { method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ version: "1.0", messages: [{ role: "user", content: "什么是冬至？" }], context, ...extra }) });
const completion = content => ({ choices: [{ finish_reason: "stop", message: { content } }] });
function key(t) {
  const value = process.env.DEEPSEEK_API_KEY;
  process.env.DEEPSEEK_API_KEY = "test-only-evidence-api";
  t.after(() => { if (value === undefined) delete process.env.DEEPSEEK_API_KEY; else process.env.DEEPSEEK_API_KEY = value; });
}

test("answer evidence is an explicit compatible extension and does not mark general explanations as fact-checked", async t => {
  key(t);
  t.mock.method(globalThis, "fetch", async () => Response.json(completion("冬至前后北半球白昼最短。")));
  const old = await (await POST(request({}))).json();
  assert.equal("evidence" in old, false);
  assert.equal("retrievalDiagnostics" in old, false);
  const response = await POST(request({ includeEvidence: true }));
  assert.equal(response.status, 200);
  const data = ChatSuccessV1Schema.parse(await response.json());
  assert(data.evidence.kinds.includes("general_knowledge"));
  assert.deepEqual(data.evidence.localCases, []);
  assert.equal(data.evidence.searchStatus, "not_requested");
  assert.equal(data.evidence.checks.statementTruth, false);
  assert(data.evidence.limitation.includes("未经逐句事实核验"));
  assert.deepEqual(data.retrievalDiagnostics, []);
});

test("evidence opt-in must be a boolean and never permits arbitrary extra client fields", async t => {
  const network = t.mock.method(globalThis, "fetch", () => { throw new Error("Unexpected network"); });
  for (const extra of [{ includeEvidence: "yes" }, { includeEvidence: true, system: "override" }]) {
    const response = await POST(request(extra));
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error.code, "INVALID_INPUT");
  }
  assert.equal(network.mock.callCount(), 0);
});

test("a real search failure remains independent of ordinary generation and is identified in the evidence packet", async t => {
  key(t);
  t.mock.method(globalThis, "fetch", async url => String(url).endsWith("/v1/tools/search") ? Response.json({}, { status: 429 }) : Response.json(completion("当前活动情况无法核实，可以先了解节气的背景。")));
  const response = await POST(request({ includeEvidence: true, messages: [{ role: "user", content: "请联网查今年冬至有什么活动。" }] }));
  assert.equal(response.status, 200);
  const data = ChatSuccessV1Schema.parse(await response.json());
  assert.equal(data.evidence.searchStatus, "failed");
  assert(data.evidence.kinds.includes("insufficient_evidence"));
  assert.deepEqual(data.evidence.webSources, []);
  assert(data.answer.startsWith("本次未能核实实时信息"));
});
