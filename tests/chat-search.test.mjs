import "./register-ts.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";

const { needsWebSearch, buildSearchQuery, searchWeb, SearchError, attachSearchSources } = await import("../lib/server/web-search.ts");
const { POST } = await import("../app/api/chat/route.ts");
const user = (content) => ({ role: "user", content });
const signal = () => new AbortController().signal;

test("live questions trigger retrieval while ordinary solar-term knowledge does not", () => {
  for (const question of [
    "明日北京会下雨吗？", "后天北京会下雨吗？", "本年度冬至是几月几号？",
    "今天有什么节气资讯？", "今年冬至的准确时间是什么？", "2026年清明上海有哪些民俗活动？",
    "下周北京天气怎么样？", "现在月亮离地球多远？", "冬至活动的门票多少钱？", "今年夏至太阳直射的准确时刻是几点？",
  ]) assert.equal(needsWebSearch([user(question)]), true, question);
  for (const question of [
    "什么是冬至？", "清明有哪些传统习俗？", "夏至为什么不一定最热？", "二十四节气是怎么划分的？",
  ]) assert.equal(needsWebSearch([user(question)]), false, question);
});

test("a live follow-up retains the retrieval need and an explicit static topic starts fresh", () => {
  const history = [user("今年北京清明有哪些活动？"), { role: "assistant", content: "请参考最新主办方公告。" }];
  assert.equal(needsWebSearch([...history, user("那上海呢？")]), true);
  assert.equal(needsWebSearch([...history, user("它几点开始？")]), true);
  assert.equal(needsWebSearch([...history, user("什么是冬至？")]), false);
  const changed = [...history, user("什么是冬至？"), { role: "assistant", content: "冬至是二十四节气之一。" }];
  assert.equal(needsWebSearch([...changed, user("它和夏至有什么区别？")]), false);
});

test("successive follow-up searches retain the actual activity and all newly chosen locations", () => {
  const history = [
    user("今年北京清明有哪些民俗活动？"), { role: "assistant", content: "请参考主办方公告。" },
    user("那上海呢？"), { role: "assistant", content: "上海的安排需要单独查询。" },
    user("它几点开始？"),
  ];
  assert.equal(needsWebSearch(history), true);
  const query = buildSearchQuery(history, new Date("2026-11-10T01:00:00Z"));
  assert.match(query, /2026-11-10/);
  assert.match(query, /清明.*民俗活动/);
  assert.match(query, /上海/);
  assert.match(query, /几点开始/);
});

test("long conversations fit the official Unicode query limit and retain the current question", () => {
  const prior = user("今天节气民俗活动" + "🌕".repeat(160));
  const query = buildSearchQuery([prior, user("那上海呢？")]);
  assert.equal([...query].length, 128);
  assert.ok(query.isWellFormed());
  assert.ok(query.includes("那上海呢？"));
  assert.ok(query.includes("今天节气民俗活动"));
  assert.equal(needsWebSearch([user("请联网查证这段节气传说。")]), true);
});

const searchUrl = "https://api.deepseek.com/v1/tools/search";
const chatUrl = "https://api.deepseek.com/chat/completions";
const records = [
  { title: "普通报道", url: "https://example.com/news", summary: "", snippet: "民俗活动报道摘要。", content: "" },
  { title: "香港天文台", url: "https://www.hko.gov.hk/tc/gts/time/24solarterms.htm", summary: "节气时刻资料。", snippet: "节气摘要。", content: "" },
  { title: "中国气象局", url: "https://www.cma.gov.cn/news/2026.html", summary: "最新节气资讯。", snippet: "", content: "" },
];

test("a named official source resolves to its own domain even if the provider returns other websites", async (t) => {
  setSearchKey(t);
  const query = buildSearchQuery([user("请联网查香港天文台公布的节气时刻。")]);
  assert.match(query, /^site:hko\.gov\.hk /);
  t.mock.method(globalThis, "fetch", async () => Response.json({ results: records }));
  const sources = await searchWeb(query, signal());
  assert.deepEqual(sources.map(({url}) => url), [records[1].url]);
});

function setSearchKey(t, key = "test-search-secret") {
  const previous = process.env.DEEPSEEK_API_KEY;
  if (key) process.env.DEEPSEEK_API_KEY = key;
  else delete process.env.DEEPSEEK_API_KEY;
  t.after(() => {
    if (previous === undefined) delete process.env.DEEPSEEK_API_KEY;
    else process.env.DEEPSEEK_API_KEY = previous;
  });
}

test("DeepSeek search sends server authorization, selects summaries and filters unsafe sources", async (t) => {
  setSearchKey(t);
  const fetch = t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(String(url), searchUrl);
    assert.equal(options.method, "POST");
    assert.equal(options.cache, "no-store");
    const headers = new Headers(options.headers);
    assert.equal(headers.get("authorization"), "Bearer test-search-secret");
    assert.equal(headers.get("content-type"), "application/json");
    assert.deepEqual(JSON.parse(options.body), { query: "2026年冬至时刻", count: 8, need_content: false });
    assert.equal(options.signal.aborted, false);
    return Response.json({ results: [
      ...records, records[1],
      ...["javascript:alert(1)", "https://user:password@example.com/", "http://localhost/", "http://127.0.0.1/",
        "http://[::1]/", "http://demo.localhost./", "https://example.com/path\n[2]"].map((url) => ({ ...records[1], url })),
      { title: "Empty", url: "https://www.cma.gov.cn/empty", summary: " ", snippet: "", content: "" },
    ] });
  });
  const found = await searchWeb("2026年冬至时刻", signal());
  assert.deepEqual(found.map(({ url }) => url), [records[1].url, records[2].url, records[0].url]);
  assert.deepEqual(found.map(({ content }) => content), [records[1].summary, records[2].summary, records[0].snippet]);
  assert.equal(fetch.mock.callCount(), 1);
});

test("search without a server key makes no provider request", async (t) => {
  setSearchKey(t, "");
  const fetch = t.mock.method(globalThis, "fetch", () => assert.fail("unexpected network call"));
  await assert.rejects(searchWeb("今年冬至", signal()), { code: "SEARCH_KEY_MISSING" });
  assert.equal(fetch.mock.callCount(), 0);
});

test("provider failures preserve diagnostic status without exposing provider details or retrying", async (t) => {
  setSearchKey(t);
  const fetch = t.mock.method(globalThis, "fetch");
  for (const [status, code] of [
    [401, "SEARCH_AUTH_FAILED"], [402, "SEARCH_INSUFFICIENT_BALANCE"], [429, "SEARCH_RATE_LIMITED"],
    [500, "SEARCH_FAILED"], [504, "SEARCH_TIMEOUT"],
  ]) {
    fetch.mock.mockImplementation(() => Response.json({ error: "private-provider-detail test-search-secret" }, { status }));
    await assert.rejects(searchWeb("今年冬至", signal()), (error) => {
      assert.ok(error instanceof SearchError);
      assert.equal(error.code, code);
      assert.equal(error.status, status);
      assert.doesNotMatch(error.message, /private-provider-detail|test-search-secret/);
      return true;
    });
  }
  assert.equal(fetch.mock.callCount(), 5);
});

test("empty, malformed and failed search responses never become fabricated retrieval context", async (t) => {
  setSearchKey(t);
  const fetch = t.mock.method(globalThis, "fetch");
  for (const body of [{ results: [] }, { results: [{ title: "No article", url: "https://example.com" }] }]) {
    fetch.mock.mockImplementation(() => Response.json(body));
    await assert.rejects(searchWeb("最新节气资讯", signal()), { code: "SEARCH_EMPTY" });
  }
  for (const response of [() => Response.json({}), () => new Response("not json")]) {
    fetch.mock.mockImplementation(response);
    await assert.rejects(searchWeb("最新节气资讯", signal()), { code: "SEARCH_INVALID_RESPONSE" });
  }
  fetch.mock.mockImplementation(() => { throw new Error("private network detail"); });
  await assert.rejects(searchWeb("最新节气资讯", signal()), (error) => {
    assert.equal(error.code, "SEARCH_FAILED");
    assert.doesNotMatch(error.message, /private network detail/);
    return true;
  });
});

test("search times out after its own budget and preserves a caller cancellation", async (t) => {
  setSearchKey(t);
  const deadline = new AbortController();
  t.mock.method(AbortSignal, "timeout", (ms) => {
    assert.equal(ms, 8_000);
    return deadline.signal;
  });
  const fetch = t.mock.method(globalThis, "fetch", async (_url, { signal }) => {
    deadline.abort();
    signal.throwIfAborted();
  });
  await assert.rejects(searchWeb("最新节气资讯", signal()), { code: "SEARCH_TIMEOUT" });
  const cancelled = AbortSignal.abort();
  await assert.rejects(searchWeb("最新节气资讯", cancelled), (error) => error === cancelled.reason);
  assert.equal(fetch.mock.callCount(), 1);
});

const request = (question) => new Request("http://localhost:3000/api/chat", {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ messages: [user(question)] }),
});
const completed = (content) => ({
  id: "test", object: "chat.completion", created: 1, model: "test",
  choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content } }],
});

test("the live route retrieves before generation and returns only retrieved source URLs", async (t) => {
  setSearchKey(t);
  const calls = [];
  t.mock.method(globalThis, "fetch", async (url, options) => {
    calls.push(String(url));
    if (String(url) === searchUrl) return Response.json({ results: [records[1]] });
    assert.equal(String(url), chatUrl);
    const body = JSON.parse(options.body);
    assert.match(body.messages[0].content, /外部不可信数据/);
    assert.ok(body.messages.some((message) => message.content.includes(records[1].summary)));
    assert.ok(body.messages.some((message) => message.content.includes(records[1].url)));
    return Response.json(completed("香港天文台提供本年度节气时刻，请按其公布时区核对。[1]"));
  });
  const response = await POST(request("今年冬至准确到几点？"));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const data = await response.json();
  assert.match(data.answer, /参考来源/);
  assert.ok(data.answer.includes(records[1].url));
  assert.doesNotMatch(data.answer, /test-search-secret/);
  assert.deepEqual(calls, [searchUrl, chatUrl]);
});

test("failed search falls back to a qualified answer while static questions skip search", async (t) => {
  setSearchKey(t);
  const calls = [];
  const fetch = t.mock.method(globalThis, "fetch", async (url, options) => {
    calls.push(String(url));
    if (String(url) === searchUrl) return Response.json({ error: "upstream secret" }, { status: 429 });
    assert.equal(String(url), chatUrl);
    const messages = JSON.parse(options.body).messages;
    assert.match(messages[0].content, /本轮实时检索失败/u);
    assert.ok(!messages.some((message) => message.content.includes("本轮服务器检索资料（JSON")));
    assert.doesNotMatch(JSON.stringify(messages), /upstream secret|test-search-secret/);
    return Response.json(completed("民俗活动的时间和场地可向当地文化馆核实。"));
  });
  const fallback = await POST(request("今天北京有哪些民俗活动？"));
  assert.equal(fallback.status, 200);
  const { answer } = await fallback.json();
  assert.match(answer, /^本次未能核实实时信息/u);
  assert.doesNotMatch(answer, /https?:\/\/|参考来源|upstream secret|test-search-secret/u);
  assert.deepEqual(calls, [searchUrl, chatUrl]);
  fetch.mock.mockImplementation(async (url) => {
    calls.push(String(url));
    assert.equal(String(url), chatUrl);
    return Response.json(completed("冬至是二十四节气之一。"));
  });
  const direct = await POST(request("什么是冬至？"));
  assert.equal(direct.status, 200);
  assert.equal((await direct.json()).answer, "冬至是二十四节气之一。");
  assert.deepEqual(calls, [searchUrl, chatUrl, chatUrl]);
});

test("generated citations must reference retrieved records and cannot introduce model-created URLs", () => {
  const context = { query: "今年冬至", retrievedAt: "2026-11-10", sources: [records[1]] };
  for (const answer of ["没有引用的实时回答", "错误来源[2]", "伪造链接 https://evil.example/test [1]"]) {
    assert.throws(() => attachSearchSources(answer, context), { code: "SEARCH_ANSWER_UNSUPPORTED" });
  }
  const answer = attachSearchSources("参考天文台的发布。[1]", context);
  assert.ok(answer.includes(records[1].url));
  assert.match(answer, /2026-11-10/);
});
