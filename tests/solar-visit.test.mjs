import "./register-ts.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";

const { POST: visit } = await import("../app/api/visit/route.ts");
const { POST: memory } = await import("../app/api/visit/memory/route.ts");
const { POST: inspiration } = await import("../app/api/studio/inspiration/route.ts");
const { VisitResultSchema } = await import("../lib/solar-visit.ts");
const { visitWebEvidence } = await import("../lib/server/solar-visit.ts");

function request(body) {
  return new Request("http://localhost/api/visit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function withKey(t) {
  const original = process.env.DEEPSEEK_API_KEY;
  process.env.DEEPSEEK_API_KEY = "test-key";
  t.after(() => {
    if (original === undefined) delete process.env.DEEPSEEK_API_KEY;
    else process.env.DEEPSEEK_API_KEY = original;
  });
}

function modelReply(content) {
  return Response.json({ choices: [{ finish_reason: "stop", message: { content } }] });
}

test("local evidence is returned with provenance and skips web search", async t => {
  withKey(t);
  const fetch = t.mock.method(globalThis, "fetch", async url => {
    assert.match(String(url), /\/chat\/completions$/u);
    return modelReply("浙江三门的相关做法见[案例1]。");
  });
  const response = await visit(request({ provinceCode: "330000", solarTermId: "dongzhi", area: "三门县" }));
  const result = VisitResultSchema.parse(await response.json());
  assert.equal(result.kind, "local");
  assert.match(result.answer, /\[案例1\]/u);
  assert.equal(result.cases[0].title, "三门祭冬");
  assert.ok(result.cases[0].sources.length);
  assert.equal(fetch.mock.callCount(), 1);
});

test("local miss uses one web query with the original province, county and term", async t => {
  withKey(t);
  const query = { provinceCode: "620000", solarTermId: "dongzhi", area: "敦煌市" };
  const quote = "甘肃敦煌的冬至习俗记录了合家包饺子的传统。";
  const source = { title: "甘肃敦煌节气记录", url: "https://example.gov.cn/dunhuang", snippet: quote };
  const lead = { title: "敦煌冬日风物", url: "https://example.gov.cn/winter", snippet: "甘肃敦煌有冬季喝热汤的饮食习惯。" };
  const fetch = t.mock.method(globalThis, "fetch", async (url, init) => {
    if (String(url).endsWith("/tools/search")) {
      assert.match(JSON.parse(init.body).query, /甘肃.*敦煌.*冬至/u);
      return Response.json({ results: [lead, source] });
    }
    return modelReply(JSON.stringify({ candidates: [
      { source: 1, quote: "这条候选引文并未出现在搜索结果里面。", relation: "direct" },
      { source: 1, quote: lead.snippet, relation: "lead" },
      { source: 2, quote, relation: "direct" },
    ] }));
  });
  const response = await visit(request(query));
  const result = VisitResultSchema.parse(await response.json());
  assert.equal(result.kind, "web");
  assert.equal(result.evidence.quote, quote);
  assert.equal(result.evidence.url, source.url);
  assert.match(result.evidence.proof, /^[0-9a-f]{64}$/u);
  assert.equal(fetch.mock.calls.filter(call => String(call.arguments[0]).endsWith("/tools/search")).length, 1);
  assert.equal(fetch.mock.callCount(), 2);

  const studioRequest = evidence => new Request("http://localhost/api/studio/inspiration?term=dongzhi&format=field-notes&source=web", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query, evidence }),
  });
  assert.equal((await inspiration(studioRequest({ ...result.evidence, quote: "用户改写过的摘要" }))).status, 400);
  assert.equal(fetch.mock.callCount(), 2);
  fetch.mock.mockImplementation(async (_url, init) => {
    const messages = JSON.parse(init.body).messages;
    assert.ok(messages[1].content.includes(quote));
    assert.doesNotMatch(messages[1].content, /本地已核验文化案例/u);
    return modelReply(JSON.stringify({ suggestions: [{ title: "敦煌冬日", line: "一家人围坐包饺子。" }] }));
  });
  const studio = await inspiration(studioRequest(result.evidence));
  assert.equal(studio.status, 200);
  assert.deepEqual((await studio.json()).references, []);
  assert.equal(fetch.mock.callCount(), 3);
});

test("seasonal evidence is a lead and an invented excerpt or wrong place is rejected", () => {
  const query = { provinceCode: "620000", solarTermId: "dongzhi", area: "敦煌" };
  const quote = "甘肃敦煌的冬季饮食有在家里做热汤的记载。";
  const source = { title: "甘肃冬日风物", url: "https://example.gov.cn/winter", content: quote };
  const evidence = { source: 1, quote, relation: "direct" };
  assert.equal(visitWebEvidence(query, [source], evidence).kind, "lead");
  assert.equal(visitWebEvidence(query, [source], { ...evidence, quote: quote.replace("冬季", "冬至") }), undefined);
  assert.equal(visitWebEvidence({ ...query, area: "兰州" }, [source], evidence), undefined);
});

test("empty search is distinguished from unavailable search and keeps same-province cases", async t => {
  withKey(t);
  const query = { provinceCode: "330000", solarTermId: "dongzhi", area: "余姚" };
  const fetch = t.mock.method(globalThis, "fetch", async () => Response.json({ results: [] }));
  const empty = VisitResultSchema.parse(await (await visit(request(query))).json());
  assert.equal(empty.kind, "none");
  assert.equal(empty.search, "empty");
  assert.ok(empty.nearby.some(item => item.title === "三门祭冬"));
  fetch.mock.mockImplementation(async () => new Response("", { status: 429 }));
  const unavailable = VisitResultSchema.parse(await (await visit(request(query))).json());
  assert.equal(unavailable.search, "unavailable");
});

test("memory card reuses studio text validation and passes only personal material to the model", async t => {
  withKey(t);
  const draft = { title: "灶边的冬至", line: "我记得外婆把热汤端上桌，窗玻璃就起了雾。" };
  const fetch = t.mock.method(globalThis, "fetch", async (_url, init) => {
    const messages = JSON.parse(init.body).messages;
    assert.match(messages[0].content, /个人经历/u);
    assert.deepEqual(JSON.parse(messages[1].content), { term: "冬至", personalMemory: "外婆端热汤，窗户起雾" });
    return modelReply(JSON.stringify({ suggestions: [draft] }));
  });
  assert.equal((await memory(request({ solarTermId: "dongzhi", memory: "短" }))).status, 400);
  const response = await memory(request({ solarTermId: "dongzhi", memory: "外婆端热汤，窗户起雾" }));
  assert.deepEqual(await response.json(), { solarTermId: "dongzhi", ...draft });
  assert.equal(fetch.mock.callCount(), 1);
});
