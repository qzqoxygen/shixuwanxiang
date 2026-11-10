import "./register-ts.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";

const { createDeepSeekClient, completeDeepSeek, classifyDeepSeekError } = await import("../lib/server/deepseek.ts");
const params = { model: "deepseek-flash", stream: false, thinking: { type: "disabled" }, messages: [{ role: "user", content: "示例" }] };
const limited = (seconds) => Response.json({ error: { message: "private provider message" } }, {
  status: 429, headers: { "retry-after": seconds },
});

test("a short explicit 429 can recover once, or returns the second rejection", async (t) => {
  const transport = t.mock.method(globalThis, "fetch", async () => limited("0"));
  transport.mock.mockImplementationOnce(async () => Response.json({ choices: [] }), 1);
  const client = createDeepSeekClient("fake");
  assert.deepEqual((await completeDeepSeek(client, params, new AbortController().signal)).choices, []);
  assert.equal(transport.mock.callCount(), 2);
  await assert.rejects(completeDeepSeek(client, params, new AbortController().signal), { status: 429 });
  assert.equal(transport.mock.callCount(), 4);
});

test("does not replay a long Retry-After, a server error, or a lost connection", async (t) => {
  const transport = t.mock.method(globalThis, "fetch", async () => limited("60"));
  const client = createDeepSeekClient("fake");
  const complete = () => completeDeepSeek(client, params, new AbortController().signal);
  await assert.rejects(complete, { status: 429 });
  transport.mock.mockImplementation(async () => Response.json({}, { status: 500 }));
  await assert.rejects(complete, { status: 500 });
  transport.mock.mockImplementation(async () => { throw new TypeError("private socket details"); });
  await assert.rejects(complete, (error) => classifyDeepSeekError(error).code === "NETWORK_ERROR");
  assert.equal(transport.mock.callCount(), 3);
});

test("route deadline during a 429 wait prevents a second dispatch", async (t) => {
  const transport = t.mock.method(globalThis, "fetch", async () => limited("1"));
  const signal = AbortSignal.timeout(30);
  await assert.rejects(completeDeepSeek(createDeepSeekClient("fake"), params, signal), (error) => {
    assert.equal(classifyDeepSeekError(error, signal).code, "TIMEOUT");
    return true;
  });
  assert.equal(transport.mock.callCount(), 1);
});

test("a cancelled in-flight completion aborts its fetch and never replays it", async (t) => {
  const controller = new AbortController();
  const transport = t.mock.method(globalThis, "fetch", async (_url, options) => {
    return new Promise((_resolve, reject) => {
      options.signal.addEventListener("abort", () => reject(options.signal.reason), { once: true });
      controller.abort();
    });
  });
  const signal = controller.signal;
  await assert.rejects(completeDeepSeek(createDeepSeekClient("fake"), params, signal), (error) => {
    assert.equal(classifyDeepSeekError(error, signal).code, "CANCELLED");
    return true;
  });
  assert.equal(transport.mock.callCount(), 1);
});

test("client never forwards ambient OpenAI headers to DeepSeek", async (t) => {
  const previous = process.env.OPENAI_CUSTOM_HEADERS;
  t.after(() => {
    if (previous === undefined) delete process.env.OPENAI_CUSTOM_HEADERS;
    else process.env.OPENAI_CUSTOM_HEADERS = previous;
  });
  process.env.OPENAI_CUSTOM_HEADERS = "X-Other-Token: unrelated\nAuthorization: Bearer wrong";
  t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(String(url), "https://api.deepseek.com/chat/completions");
    assert.deepEqual(Object.fromEntries(new Headers(options.headers)), {
      authorization: "Bearer fake", "content-type": "application/json",
    });
    assert.equal(options.redirect, "error");
    return Response.json({ choices: [] });
  });
  await completeDeepSeek(createDeepSeekClient("fake"), params, new AbortController().signal);
});
