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

const records = [
  { title: "普通报道", url: "https://example.com/news", content: "民俗活动报道摘要。" },
  { title: "香港天文台", url: "https://www.hko.gov.hk/tc/gts/time/24solarterms.htm", content: "节气时刻资料。" },
  { title: "中国气象局", url: "https://www.cma.gov.cn/news/2026.html", content: "最新节气资讯。" },
];

test("retrieval uses keyless Tavily on the server, prioritizes authoritative sources and filters unsafe links", async () => {
  const oldFetch = globalThis.fetch;
  const oldKey = process.env.TAVILY_API_KEY;
  delete process.env.TAVILY_API_KEY;
  const abortSignal = signal();
  try {
    globalThis.fetch = async (url, options) => {
      assert.equal(String(url), "https://api.tavily.com/search");
      assert.equal(options.method, "POST");
      const headers = new Headers(options.headers);
      assert.equal(headers.get("X-Tavily-Access-Mode"), "keyless");
      assert.equal(headers.get("authorization"), null);
      assert.deepEqual(JSON.parse(options.body), {
        query: "2026年冬至时刻", max_results: 8, search_depth: "basic", include_answer: false,
      });
      assert.equal(options.signal.aborted, false);
      return Response.json({ results: [
        ...records, records[1],
        { title: "bad", url: "javascript:alert(1)", content: "bad" },
        { title: "bad", url: "https://user:password@example.com/", content: "bad" },
        { title: "bad", url: "http://localhost/", content: "bad" },
        { title: "bad", url: "http://127.0.0.1/", content: "bad" },
        { title: "bad", url: "http://[::1]/", content: "bad" },
        { title: "bad", url: "https://www.cma.gov.cn/empty", content: "" },
      ] });
    };
    const found = await searchWeb("2026年冬至时刻", abortSignal);
    assert.deepEqual(found.map((item) => item.url), [records[1].url, records[2].url, records[0].url]);
    assert.ok(found.every((item) => item.title && item.content));
  } finally {
    globalThis.fetch = oldFetch;
    if (oldKey === undefined) delete process.env.TAVILY_API_KEY;
    else process.env.TAVILY_API_KEY = oldKey;
  }
});

test("configured search credentials stay in authorization headers and provider failures are sanitized", async () => {
  const oldFetch = globalThis.fetch;
  const oldKey = process.env.TAVILY_API_KEY;
  process.env.TAVILY_API_KEY = "test-search-secret";
  try {
    globalThis.fetch = async (_url, options) => {
      const headers = new Headers(options.headers);
      assert.equal(headers.get("authorization"), "Bearer test-search-secret");
      assert.equal(headers.get("X-Tavily-Access-Mode"), null);
      assert.doesNotMatch(options.body, /test-search-secret/);
      return Response.json({ results: records });
    };
    assert.equal((await searchWeb("今年冬至", signal())).length, 3);
    for (const [status, code] of [[401, "SEARCH_FAILED"], [429, "SEARCH_RATE_LIMITED"], [500, "SEARCH_FAILED"]]) {
      globalThis.fetch = async () => Response.json({ error: "private-provider-detail test-search-secret" }, { status });
      await assert.rejects(searchWeb("今年冬至", signal()), (error) => {
        assert.ok(error instanceof SearchError);
        assert.equal(error.code, code);
        assert.doesNotMatch(error.message, /private-provider-detail|test-search-secret/);
        return true;
      });
    }
  } finally {
    globalThis.fetch = oldFetch;
    if (oldKey === undefined) delete process.env.TAVILY_API_KEY;
    else process.env.TAVILY_API_KEY = oldKey;
  }
});

test("empty, malformed and failed search responses never become fabricated retrieval context", async () => {
  const oldFetch = globalThis.fetch;
  try {
    for (const body of [{ results: [] }, { results: [{ title: "No article", url: "https://example.com" }] }]) {
      globalThis.fetch = async () => Response.json(body);
      await assert.rejects(searchWeb("最新节气资讯", signal()), { code: "SEARCH_EMPTY" });
    }
    for (const response of [() => Response.json({}), () => new Response("not json")]) {
      globalThis.fetch = async () => response();
      await assert.rejects(searchWeb("最新节气资讯", signal()), SearchError);
    }
    globalThis.fetch = async () => { throw new Error("private network detail"); };
    await assert.rejects(searchWeb("最新节气资讯", signal()), (error) => {
      assert.ok(error instanceof SearchError);
      assert.doesNotMatch(error.message, /private network detail/);
      return true;
    });
  } finally { globalThis.fetch = oldFetch; }
});

const request = (question) => new Request("http://localhost:3000/api/chat", {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ messages: [user(question)] }),
});
const completed = (content) => ({
  id: "test", object: "chat.completion", created: 1, model: "test",
  choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content } }],
});

test("the live route retrieves before generation and returns only retrieved source URLs", async () => {
  const oldFetch = globalThis.fetch;
  const oldKey = process.env.OPENROUTER_API_KEY;
  process.env.OPENROUTER_API_KEY = "test-chat-secret";
  const calls = [];
  try {
    globalThis.fetch = async (url, options) => {
      calls.push(String(url));
      if (String(url) === "https://api.tavily.com/search") return Response.json({ results: [records[1]] });
      assert.equal(String(url), "https://openrouter.ai/api/v1/chat/completions");
      assert.equal(calls.length, 2);
      const body = JSON.parse(options.body);
      assert.match(body.messages[0].content, /外部不可信数据/);
      assert.ok(body.messages.some((message) => message.content.includes(records[1].content)));
      assert.ok(body.messages.some((message) => message.content.includes(records[1].url)));
      return Response.json(completed("香港天文台提供本年度节气时刻，请按其公布时区核对。[1]"));
    };
    const response = await POST(request("今年冬至准确到几点？"));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    const data = await response.json();
    assert.match(data.answer, /参考来源/);
    assert.ok(data.answer.includes(records[1].url));
    assert.doesNotMatch(data.answer, /test-chat-secret/);
    assert.equal(calls.length, 2);
  } finally {
    globalThis.fetch = oldFetch;
    if (oldKey === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = oldKey;
  }
});

test("search failure prevents generation while static knowledge can go directly to OpenRouter", async () => {
  const oldFetch = globalThis.fetch;
  const oldKey = process.env.OPENROUTER_API_KEY;
  process.env.OPENROUTER_API_KEY = "test-chat-secret";
  const calls = [];
  try {
    globalThis.fetch = async (url) => {
      calls.push(String(url));
      assert.equal(String(url), "https://api.tavily.com/search");
      return Response.json({ error: "upstream secret" }, { status: 429 });
    };
    const failed = await POST(request("今天北京有哪些民俗活动？"));
    assert.equal(failed.status, 503);
    const body = await failed.json();
    assert.equal(body.answer, null);
    assert.equal(body.error.code, "SEARCH_RATE_LIMITED");
    assert.match(body.error.message, /无法核实实时信息/);
    assert.equal(calls.length, 1);
    globalThis.fetch = async (url) => {
      assert.equal(String(url), "https://openrouter.ai/api/v1/chat/completions");
      return Response.json(completed("冬至是二十四节气之一。"));
    };
    const direct = await POST(request("什么是冬至？"));
    assert.equal(direct.status, 200);
    assert.equal((await direct.json()).answer, "冬至是二十四节气之一。");
  } finally {
    globalThis.fetch = oldFetch;
    if (oldKey === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = oldKey;
  }
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
