import "./register-ts.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";
const { beginAiRequest } = await import("../lib/server/ai-access.ts");
const { POST } = await import("../app/api/chat/route.ts");

test("a replay during and after a completed chat is rejected before billing", async (t) => {
  const previousKey = process.env.DEEPSEEK_API_KEY;
  process.env.DEEPSEEK_API_KEY = "test-only";
  t.after(() => {
    if (previousKey === undefined) delete process.env.DEEPSEEK_API_KEY;
    else process.env.DEEPSEEK_API_KEY = previousKey;
  });
  const started = Promise.withResolvers();
  const model = Promise.withResolvers();
  const fetch = t.mock.method(globalThis, "fetch", () => {
    started.resolve();
    return model.promise;
  });
  const send = () => POST(new Request("http://localhost/api/chat", {
    method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": "same-send" },
    body: JSON.stringify({ messages: [{ role: "user", content: "什么是冬至？" }] }),
  }));
  const first = send();
  await started.promise;
  assert.equal((await send()).status, 409);
  model.resolve(Response.json({ choices: [{ finish_reason: "stop", message: { content: "冬至是二十四节气之一。" } }] }));
  assert.equal((await first).status, 200);
  assert.equal((await send()).status, 409);
  assert.equal(fetch.mock.callCount(), 1);
});

test("the access limit allows a fresh window and legacy clients can intentionally regenerate", (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: Date.now() + 180_000 });
  const request = new Request("http://localhost/api/studio/inspiration");
  for (let i = 0; i < 12; i++) {
    const first = beginAiRequest(request, "studio", "qingming-card");
    assert.equal(beginAiRequest(request, "studio", "qingming-card").status, 409);
    first.finish();
  }
  assert.equal(beginAiRequest(request, "studio", "qingming-card").status, 429);
  t.mock.timers.tick(60_000);
  beginAiRequest(request, "studio", "qingming-card").finish();
});
