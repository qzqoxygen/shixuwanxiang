// Opt-in: five real, billable requests to the running server. No client API key.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const origin = process.argv[2] ?? "http://127.0.0.1:3112";
const output = process.argv[3] ?? "docs/cultural-sources/2026-11-12/verification/ai-live.json";
const report = { testedAt: new Date().toISOString(), origin, method: "Real server requests; no mocked transport, no browser API key, no automatic retry", checks: [] };
const message = content => ({ messages: [{ role: "user", content }] });
const checks = [
  ["普通节气知识", "/api/chat", message("冬至为什么不一定最冷？用一句话回答。"), data => {
    assert.equal(typeof data.answer, "string");
    assert(data.answer.length > 8);
    assert(!data.answer.includes("参考来源（检索于"));
    assert(!data.answer.includes("文化案例来源"));
  }],
  ["新增地坛案例问答与原文", "/api/chat", message("请介绍北京地坛夏至祭地，说明它是历史礼制还是今天每年夏至仍举行的活动，并给出案例来源。"), data => {
    assert.match(data.answer, /文化案例来源（本地已核验资料/);
    assert.match(data.answer, /历史|明清/);
    assert(data.answer.includes("http://culture.people.com.cn/n/2015/0108/c172318-26351122.html"));
  }],
  ["大雪创意与补采参考", "/api/studio/inspiration?term=daxue&format=bookmark", undefined, data => {
    assert.equal(data.suggestions.length, 3);
    assert(data.suggestions.every(item => item.title?.trim() && item.line?.trim()));
    assert.equal(data.references.length, 3);
    for (const caseId of ["nanjing-daxue-radish-balls", "lubei-daxue-sweet-potato-porridge"]) {
      assert(data.references.some(item => item.caseId === caseId && item.sources.length));
    }
  }],
  ["待核验习俗不当作定论", "/api/chat", message("陕西黄陵面花是冬至习俗吗？请按已核实资料回答，不确定就说明。"), data => {
    assert.match(data.answer, /尚未|无法|不能|未能|没有|未核实|不确定/);
    assert(!data.answer.includes("huangling-flower-buns"));
    assert(!data.answer.includes("文化案例来源"));
  }],
  ["实时联网与独立来源", "/api/chat", message("请联网查香港天文台在哪里公布二十四节气时刻？一句话回答并给出来源。"), data => {
    const [answer, references] = data.answer.split("参考来源（检索于");
    assert(references && /\[\d+\]/u.test(answer));
    const links = references.split("\n").filter(line => /^https?:\/\//iu.test(line));
    assert(links.length && links.every(link => /(^|\.)hko\.gov\.hk$/iu.test(new URL(link).hostname)));
  }],
];

const selected = process.argv[4]?.split(",").map(Number);
if (selected) assert(selected.every(index => Number.isInteger(index) && index >= 1 && index <= checks.length));
for (const [index, [name, path, body, validate]] of checks.entries()) {
  if (selected && !selected.includes(index + 1)) continue;
  const start = Date.now();
  const result = { name };
  try {
    const response = await fetch(new URL(path, origin), {
      method: "POST", headers: { Origin: origin, "Content-Type": "application/json", "Idempotency-Key": randomUUID() },
      body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(65_000),
    });
    result.status = response.status;
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.code ?? data.code ?? "HTTP_FAILURE");
    result.response = data;
    validate(data);
    result.passed = true;
  } catch (error) {
    result.passed = false;
    result.error = error instanceof assert.AssertionError ? "RESPONSE_CHECK_FAILED" : error.name + ": " + error.message.slice(0, 120);
    process.exitCode = 1;
  }
  result.ms = Date.now() - start;
  report.checks.push(result);
  console.log(`${result.passed ? "PASS" : "FAIL"}: ${name} HTTP ${result.status ?? "none"}, ${result.ms}ms`);
}
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
