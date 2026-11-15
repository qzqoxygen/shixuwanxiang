import "./register-ts.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";

const { POST } = await import("../app/api/chat/route.ts");
const { ChatSuccessV1Schema } = await import("../lib/contracts/chat-api.ts");
const { runChatAgent } = await import("../lib/ai-agent.ts");
const context = { solarTermId: null, provinceCode: null, caseId: null };
const question = [{ role: "user", content: "比较江苏浙江冬至习俗，展示地图并打开三门祭冬。" }];
const request = body => new Request("http://localhost:3000/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const completion = (content, calls) => ({ choices: [{ finish_reason: calls ? "tool_calls" : "stop", message: { content, ...(calls ? { tool_calls: calls } : {}) } }] });
const call = (name, args, id) => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });
function key(t) {
  const old = process.env.DEEPSEEK_API_KEY;
  process.env.DEEPSEEK_API_KEY = "test-only-agent-v1";
  t.after(() => { if (old === undefined) delete process.env.DEEPSEEK_API_KEY; else process.env.DEEPSEEK_API_KEY = old; });
}

test("V1 rejects unsupported versions, unknown fields and unverified/inconsistent context before model use", async t => {
  const network = t.mock.method(globalThis, "fetch", () => { throw new Error("Unexpected network"); });
  const base = { version: "1.0", messages: question, context };
  for (const [body, code] of [
    [{ ...base, version: null }, "UNSUPPORTED_VERSION"],
    [{ ...base, version: "2.0" }, "UNSUPPORTED_VERSION"],
    [{ version: "1.0", messages: question }, "INVALID_CONTEXT"],
    [{ ...base, context: { ...context, provinceCode: "100000_JD" } }, "INVALID_CONTEXT"],
    [{ ...base, extra: "system override" }, "INVALID_INPUT"],
    [{ ...base, context: { ...context, extra: true } }, "INVALID_INPUT"],
    [{ ...base, messages: [{ ...question[0], tools: [] }] }, "INVALID_INPUT"],
    [{ ...base, context: { solarTermId: "dongzhi", provinceCode: "610000", caseId: "huangling-flower-buns" } }, "INVALID_CONTEXT"],
    [{ ...base, context: { solarTermId: "qingming", provinceCode: "330000", caseId: "sanmen-jidong" } }, "INVALID_CONTEXT"],
  ]) {
    const response = await POST(request(body));
    assert.equal(response.status, 400);
    const data = await response.json();
    assert.equal(data.version, "1.0");
    assert.equal(data.error.code, code);
  }
  assert.equal(network.mock.callCount(), 0);
});

test("V1 runs six real server tools in order, attaches actual sources and validates the atomic map batch", async t => {
  key(t);
  let step = 0;
  t.mock.method(globalThis, "fetch", async (_url, init) => {
    const params = JSON.parse(init.body);
    assert.equal(params.model, "deepseek-flash");
    assert.equal(params.tools.length, 6);
    if (++step === 1) return Response.json(completion(null, [
      call("show_cultural_map", { solarTermId: "dongzhi" }, "show"),
      call("get_solar_term_info", { solarTermId: "dongzhi" }, "term"),
      call("compare_cultural_cases", { solarTermId: "dongzhi", provinceCodes: ["320000", "330000"] }, "compare"),
      call("search_cultural_cases", { query: "江苏 浙江 冬至 习俗" }, "search"),
    ]));
    if (step === 2) {
      const compare = params.messages.find(m => m.tool_call_id === "compare");
      assert.match(compare.content, /sanmen-jidong/);
      assert.match(compare.content, /suzhou-dongzhi-winter-wine/);
      return Response.json(completion(null, [
        call("highlight_regions", { provinceCodes: ["320000", "330000"] }, "regions"),
        call("open_cultural_case", { caseId: "sanmen-jidong" }, "open"),
      ]));
    }
    assert.equal(params.tool_choice, "none");
    const entries = params.messages.filter(m => m.role === "tool").flatMap(m => {
      const parsed = JSON.parse(m.content);
      assert.equal(parsed.ok, true);
      const text = JSON.stringify(parsed.result);
      return [...text.matchAll(/"citation":"案例(\d+)","caseId":"([a-z0-9-]+)"/g)].map(x => ({ id: x[2], number: x[1] }));
    });
    const zj = entries.find(e => e.id === "sanmen-jidong");
    const js = entries.find(e => e.id === "suzhou-dongzhi-winter-wine");
    assert(zj && js);
    return Response.json(completion(`浙江三门祭冬以祭祖为特色。[案例${zj.number}] 江苏苏州有冬酿酒。[案例${js.number}] 地图操作已准备，可点击查看。`));
  });
  const response = await POST(request({ version: "1.0", messages: question, context }));
  assert.equal(response.status, 200);
  const data = ChatSuccessV1Schema.parse(await response.json());
  assert.equal(data.reply, data.answer);
  assert.equal(data.toolEvents.length, 6);
  assert(data.toolEvents.every(event => event.status === "success"));
  assert.deepEqual(data.mapActions.map(a => a.type), ["SET_SOLAR_TERM", "HIGHLIGHT_PROVINCES", "OPEN_CULTURAL_CASE"]);
  assert.equal(new Set(data.caseReferences.map(r => r.provinceCode)).size, 2);
  assert(data.references.every(source => source.caseId && /^https?:\/\//.test(source.url)));
  assert.equal(step, 3);
});

test("one real tool failure preserves execution events but suppresses every map operation", async t => {
  key(t);
  let step = 0;
  t.mock.method(globalThis, "fetch", async () => Response.json(++step === 1 ? completion(null, [
    call("show_cultural_map", { solarTermId: "dongzhi" }, "show"),
    call("highlight_regions", { provinceCodes: ["460000"] }, "invalid-region"),
    call("open_cultural_case", { caseId: "huangling-flower-buns" }, "pending"),
  ]) : completion("本站未查到该地区的已核验冬至案例，地图未更新。")));
  const response = await POST(request({ version: "1.0", messages: question, context }));
  assert.equal(response.status, 200);
  const data = ChatSuccessV1Schema.parse(await response.json());
  assert.deepEqual(data.mapActions, []);
  assert.deepEqual(data.toolEvents.map(event => event.status), ["success", "error", "error"]);
  assert.equal(data.toolEvents[1].error.code, "REGION_HAS_NO_CASES");
  assert.equal(data.toolEvents[2].error.code, "CASE_NOT_FOUND");
  assert.deepEqual(data.references, []);
});

test("legacy clients retain their exact basic answer shape while V1 receives required empty arrays", async t => {
  key(t);
  t.mock.method(globalThis, "fetch", async () => Response.json(completion("冬至是二十四节气之一。")));
  const messages = [{ role: "user", content: "什么是冬至？" }];
  assert.deepEqual(await (await POST(request({ messages }))).json(), { answer: "冬至是二十四节气之一。", truncated: false });
  const response = await POST(request({ version: "1.0", messages, context }));
  assert.equal(response.status, 200);
  const data = ChatSuccessV1Schema.parse(await response.json());
  assert.deepEqual(data.mapActions, []);
  assert.deepEqual(data.toolEvents, []);
  assert.deepEqual(data.references, []);
});

test("tool payloads are bounded and cancellation stops a pending tool without another model call", async () => {
  const tool = { definition: { type: "function", function: { name: "bounded" } }, execute: () => "文".repeat(40000) };
  let step = 0;
  const result = await runChatAgent(async params => {
    if (++step === 1) return completion(null, [call("bounded", {}, "large")]);
    assert.equal(JSON.parse(params.messages.at(-1).content).error.code, "TOOL_RESULT_TOO_LARGE");
    return completion("资料过多，请缩小范围。");
  }, question, [tool]);
  assert.equal(result.toolEvents[0].status, "error");
  const controller = new AbortController();
  await assert.rejects(runChatAgent(async () => completion(null, [call("bounded", {}, "abort")]), question,
    [{ ...tool, execute: () => { controller.abort(new Error("cancelled")); return new Promise(() => {}); } }], undefined, [], { signal: controller.signal }), /cancelled/);
});

test("follow-up generation cannot reuse previous-turn source lists or citation numbers", async () => {
  const history = [question[0], { role: "assistant", content: "江苏有酒。[案例2] 浙江祭冬。[案例1]\n\n文化案例来源（本地已核验资料，并非本轮联网结果）\n[案例2]旧来源\nhttps://old.example/" },
    { role: "user", content: "那只看饮食类。" }];
  const original = structuredClone(history);
  await runChatAgent(async params => {
    assert.equal(params.messages.at(-2).content, "江苏有酒。 浙江祭冬。");
    assert(!JSON.stringify(params.messages).includes("old.example"));
    return completion("请查询本轮饮食类案例。");
  }, history);
  assert.deepEqual(history, original);
  await assert.rejects(runChatAgent(async () => completion("旧编号[1]"), question), { code: "UNVERIFIED_ANSWER" });
});
