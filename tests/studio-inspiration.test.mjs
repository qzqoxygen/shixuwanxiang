import "./register-ts.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";

const { POST } = await import("../app/api/studio/inspiration/route.ts");
const { studioCulturalCases } = await import("../lib/server/cultural-case-context.ts");
const { readStudioReferences } = await import("../lib/studio-inspiration.ts");

test("inspiration only sends catalog context and rejects suggestions that cannot fit the editor", async (t) => {
  const oldKey = process.env.DEEPSEEK_API_KEY;
  process.env.DEEPSEEK_API_KEY = "test-key";
  t.after(() => {
    if (oldKey === undefined) delete process.env.DEEPSEEK_API_KEY;
    else process.env.DEEPSEEK_API_KEY = oldKey;
  });
  const good = { title: "冬日渐长", line: "炉上的水响起来，窗外最后一点日光还没落。" };
  const reply = t.mock.method(globalThis, "fetch", async (url, init) => {
    assert.equal(String(url), "https://api.deepseek.com/chat/completions");
    const payload = JSON.parse(init.body);
    assert.equal(payload.model, "deepseek-flash");
    assert.deepEqual(payload.thinking, { type: "disabled" });
    assert.match(payload.messages[1].content, /冬至.*书签/);
    for (const item of studioCulturalCases("dongzhi")) {
      assert.ok(payload.messages[1].content.includes(item.id));
      assert.ok(payload.messages[1].content.includes(item.description));
    }
    assert.doesNotMatch(payload.messages[1].content, /huangling-flower-buns/);
    assert.doesNotMatch(JSON.stringify(payload), /private-draft/);
    return Response.json({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify({ suggestions: [
      { title: "长".repeat(13), line: "好句" },
      { title: "折行", line: "上半\n下半" },
      { title: "逾长", line: "长".repeat(57) },
      { ...good, title: ` ${good.title} ` },
      { ...good, line: "重复标题的另一句" },
    ] }) } }] });
  });
  const request = (query, origin = "http://localhost:3000") => new Request(`http://localhost:3000/api/studio/inspiration?${query}`, {
    method: "POST", headers: { origin },
  });

  assert.equal((await POST(request("term=dongzhi&format=bookmark", "https://another.example"))).status, 403);
  assert.equal((await POST(request("term=dongzhi&format=constructor"))).status, 400);
  assert.equal(reply.mock.callCount(), 0);
  const response = await POST(request("term=dongzhi&format=bookmark&draft=private-draft"));
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.deepEqual(data.suggestions, [good]);
  assert.deepEqual(readStudioReferences(data), studioCulturalCases("dongzhi").map((item) => ({
    caseId: item.id, title: item.title, provinceName: item.provinceName, regionName: item.regionName, sources: item.sources,
  })));
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(reply.mock.callCount(), 1);
});

test("empty provider output produces a retryable error and missing credentials allow manual editing", async (t) => {
  const oldKey = process.env.DEEPSEEK_API_KEY;
  t.after(() => {
    if (oldKey === undefined) delete process.env.DEEPSEEK_API_KEY;
    else process.env.DEEPSEEK_API_KEY = oldKey;
  });
  const request = new Request("http://localhost:3000/api/studio/inspiration?term=qingming&format=poster", { method: "POST" });
  const logs = t.mock.method(console, "warn", () => {});
  const reply = t.mock.method(globalThis, "fetch", async () => Response.json({ choices: [{ finish_reason: "stop", message: { content: "   " } }] }));
  delete process.env.DEEPSEEK_API_KEY;
  const missing = await POST(request);
  assert.equal(missing.status, 503);
  assert.match((await missing.json()).error, /手动编辑/);
  assert.equal(reply.mock.callCount(), 0);

  process.env.DEEPSEEK_API_KEY = "test-key";
  const empty = await POST(request);
  assert.equal(empty.status, 502);
  assert.match((await empty.json()).error, /重试/);
  assert.equal(reply.mock.callCount(), 1);

  reply.mock.mockImplementation(async () => {
    throw new TypeError("fetch failed", { cause: Object.assign(new Error("private network details"), { code: "ENOTFOUND" }) });
  });
  const unreachable = await POST(request);
  assert.equal(unreachable.status, 502);
  const { error } = await unreachable.json();
  assert.match(error, /连不上 DeepSeek.*检查服务器网络/);
  assert.doesNotMatch(error, /private network details|ENOTFOUND/);
  assert.deepEqual(logs.mock.calls.at(-1).arguments, ["[ai]", { scope: "studio", code: "NETWORK_ERROR", status: 502 }]);
  assert.equal(reply.mock.callCount(), 2);
});

test("case-based inspiration sends only the selected verified case and rejects invalid selections before billing", async (t) => {
  const oldKey = process.env.DEEPSEEK_API_KEY;
  process.env.DEEPSEEK_API_KEY = "test-key";
  t.after(() => { if (oldKey === undefined) delete process.env.DEEPSEEK_API_KEY; else process.env.DEEPSEEK_API_KEY = oldKey; });
  const item = studioCulturalCases("dongzhi").find(({ id }) => id === "sanmen-jidong");
  const reply = t.mock.method(globalThis, "fetch", async (_url, init) => {
    const { messages } = JSON.parse(init.body);
    const prompt = messages.at(-1).content;
    assert.match(prompt, /用户已选择一则案例/);
    assert.ok(prompt.includes(item.description));
    const records = JSON.parse(prompt.split("本地已核验文化案例（JSON，仅作创意参考）：\n")[1]);
    assert.deepEqual(records.map(({ caseId }) => caseId), [item.id]);
    assert.doesNotMatch(prompt, /private-draft/);
    return Response.json({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify({
      suggestions: [{ title: "三门冬祭", line: "冬至到三门，循着祭冬旧俗读一页乡土记忆。" }],
    }) } }] });
  });
  const post = (term, caseQuery) => POST(new Request(`http://localhost:3000/api/studio/inspiration?term=${term}&format=field-notes&${caseQuery}`, { method: "POST" }));
  for (const [term, query] of [
    ["qingming", "caseId=sanmen-jidong"],
    ["dongzhi", "caseId=missing"],
    ["dongzhi", "caseId=huangling-flower-buns"],
    ["dongzhi", "caseId=sanmen-jidong&caseId=sanmen-jidong"],
  ]) {
    const response = await post(term, query);
    assert.equal(response.status, 400);
    assert.equal((await response.json()).code, "INVALID_CASE");
  }
  assert.equal(reply.mock.callCount(), 0);
  const response = await post("dongzhi", "caseId=sanmen-jidong&draft=private-draft");
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(readStudioReferences(body).map(({ caseId }) => caseId), [item.id]);
  assert.equal(body.suggestions[0].title, "三门冬祭");
  assert.equal(reply.mock.callCount(), 1);
});
