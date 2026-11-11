// Run once per acceptance window. This makes three billable visitor requests.
import assert from "node:assert/strict";
import { request as httpsRequest } from "node:https";
import { request as httpRequest } from "node:http";
import { randomUUID } from "node:crypto";

const origin = new URL(process.argv[2] ?? "https://qsxshixu-ai.vercel.app");
const local = origin.protocol === "http:" && ["127.0.0.1", "localhost", "[::1]"].includes(origin.hostname);
if ((!local && origin.protocol !== "https:") || origin.username || origin.password ||
    origin.pathname !== "/" || origin.search || origin.hash) {
  throw new Error("请指定 HTTPS 站点首页，或本机演练用的回环地址。");
}
const report = { origin: origin.origin, utc: new Date().toISOString(), tests: [] };
const ask = (content) => ({ messages: [{ role: "user", content }] });

async function check(name, path, body, validate) {
  const start = Date.now();
  let status;
  try {
    // A fresh native connection bypasses the system and environment HTTP proxy.
    const text = await new Promise((resolve, reject) => {
      const req = (local ? httpRequest : httpsRequest)(new URL(path, origin), {
        method: "POST", agent: false, rejectUnauthorized: true, signal: AbortSignal.timeout(65_000),
        headers: { Origin: origin.origin, "Content-Type": "application/json", "Idempotency-Key": randomUUID() },
      }, (res) => {
        status = res.statusCode;
        res.setEncoding("utf8");
        let result = "";
        res.on("data", (chunk) => {
          result += chunk;
          if (result.length > 100_000) req.destroy(new Error("response too large"));
        });
        res.on("error", reject);
        res.on("end", () => resolve(result));
      });
      req.on("error", reject);
      req.end(body ? JSON.stringify(body) : undefined);
    });
    const data = JSON.parse(text);
    if (status !== 200) {
      const code = data.error?.code ?? data.code;
      throw new Error(typeof code === "string" && /^[A-Z_]{1,60}$/.test(code) ? code : "HTTP failure");
    }
    const detail = validate(data);
    report.tests.push({ name, status, ms: Date.now() - start, ok: true, ...detail });
  } catch (error) {
    report.tests.push({ name, status: status ?? null, ms: Date.now() - start, ok: false,
      reason: error.code ?? (error instanceof SyntaxError ? "INVALID_JSON" : error.message.slice(0, 80)) });
    process.exitCode = 1;
  }
}

await Promise.all([
  check("普通问答", "/api/chat", ask("冬至为什么不一定最冷？用一句话回答。"), (data) => {
    assert.equal(typeof data.answer, "string");
    assert.ok(data.answer.trim().length > 8 && !data.answer.includes("参考来源（检索于"));
    return { answer: data.answer.slice(0, 100) };
  }),
  check("造物灵感", "/api/studio/inspiration?term=qingming&format=bookmark", null, (data) => {
    assert.ok(Array.isArray(data.suggestions) && data.suggestions.length > 0);
    assert.ok(data.suggestions.every((s) => typeof s.title === "string" && s.title.trim() && typeof s.line === "string" && s.line.trim()));
    return { count: data.suggestions.length, title: data.suggestions[0].title };
  }),
]);
await check("实时搜索与来源", "/api/chat", ask("请联网查香港天文台在哪里公布二十四节气时刻？一句话回答并给出来源。"), (data) => {
  assert.equal(typeof data.answer, "string");
  const [answer, refs] = data.answer.split("参考来源（检索于");
  assert.ok(refs && /\[\d+\]/u.test(answer));
  const urls = refs.split("\n").filter((s) => /^https?:\/\//iu.test(s));
  assert.ok(urls.length && urls.every((s) => /(^|\.)hko\.gov\.hk$/i.test(new URL(s).hostname)));
  return { answer: answer.trim().slice(0, 100), sources: urls };
});
console.log(JSON.stringify(report, null, 2));
