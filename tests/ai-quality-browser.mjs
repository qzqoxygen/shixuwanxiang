// Opt-in: real website, real DeepSeek, no mocked APIs. Two chat calls + one Studio generation.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH ?? "playwright-core");
const origin = new URL(process.argv[2] ?? "http://127.0.0.1:3115").origin;
const output = resolve(process.argv[3] ?? `docs/verification/ai-final-2026-11-15/browser-${Date.now()}`);
mkdirSync(output, { recursive: true });
const buildPath = resolve(".next/BUILD_ID");
const report = { testedAt: new Date().toISOString(), origin, commit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(), workingTreeDirty: Boolean(execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim()), runnerSha256: createHash("sha256").update(readFileSync(new URL(import.meta.url))).digest("hex"), localBuildId: existsSync(buildPath) ? readFileSync(buildPath, "utf8").trim() : null, buildIdMeaning: "Local .next build only; not proof of a deployed revision", method: "Real Chrome and real website/DeepSeek APIs, no request interception or automatic retries; mobile viewport is not a physical device", pages: [], pageErrors: [], failedResources: [], passed: false };
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", headless: true, args: ["--no-proxy-server"] });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
const page = await context.newPage();
page.setDefaultTimeout(20000);
page.on("pageerror", error => report.pageErrors.push(error.message));
page.on("requestfailed", request => { if (request.failure()?.errorText !== "net::ERR_ABORTED") report.failedResources.push({ path: new URL(request.url()).pathname, error: request.failure()?.errorText }); });
async function noOverflow(label) {
  const sizes = await page.evaluate(() => ({ content: document.documentElement.scrollWidth, viewport: document.documentElement.clientWidth }));
  assert(sizes.content <= sizes.viewport + 1, `${label}: overflow ${JSON.stringify(sizes)}`);
}
async function ask(question, during) {
  const pending = page.waitForResponse(response => response.url() === `${origin}/api/chat` && response.request().method() === "POST", { timeout: 65000 });
  await page.getByLabel("提问", { exact: true }).fill(question);
  await page.getByRole("button", { name: "发送", exact: true }).click();
  if (during) await during();
  const response = await pending;
  const body = await response.json();
  assert.equal(response.status(), 200, body.error?.code ?? "chat HTTP status");
  assert.equal(body.version, "1.0"); assert(body.evidence);
  await page.waitForFunction(() => !document.querySelector(".chat-loading"));
  return body;
}

try {
  for (const path of ["/", "/seasons", "/explore", "/studio", "/about", "/visit"]) {
    const response = await page.goto(origin + path, { waitUntil: "networkidle" });
    assert.equal(response.status(), 200, path);
    await noOverflow(path);
    report.pages.push({ path, status: response.status(), horizontalOverflow: false });
  }
  const list = await page.request.get(`${origin}/api/cultural-cases?limit=20`);
  assert.equal((await list.json()).total, 97);
  for (const id of ["huangling-flower-buns", "xinzheng-jujube-harvest"]) assert.equal((await page.request.get(`${origin}/api/cultural-cases/${id}`)).status(), 404);
  report.dataBoundary = { verified: 97, pendingHidden: 2 };
  await page.goto(`${origin}/seasons`, { waitUntil: "networkidle" });
  await page.locator('.book-directory button[data-term-id="dongzhi"]').click();
  await page.waitForFunction(() => document.querySelector(".seasons-book")?.getAttribute("data-term-id") === "dongzhi");
  await page.waitForFunction(() => /dongzhi-(720|1120)\.webp$/.test(document.querySelector(".seasons-book-base .seasons-photo-open img")?.currentSrc ?? ""));
  assert.equal(await page.locator(".seasons-book-base .seasons-photo-open").getAttribute("href"), "/images/solar-terms/dongzhi-hd.webp");
  report.seasonsNavigation = true;

  await page.goto(`${origin}/explore`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "打开问四时 AI 助手", exact: true }).click();
  report.complexResponse = await ask("请比较江苏和浙江冬至已核验案例的文化特点和原文来源，展示冬至地图，高亮江苏浙江，并打开三门祭冬以便制卡。请实际调用相应工具。");
  const tools = report.complexResponse.toolEvents.filter(event => event.status === "success").map(event => event.toolName);
  for (const name of ["compare_cultural_cases", "show_cultural_map", "highlight_regions", "open_cultural_case"]) assert(tools.includes(name), `actual ${name}`);
  for (const province of ["江苏省", "浙江省"]) assert(await page.locator(`.chat-region-group[aria-label="${province}文化案例"] a[href^="http"]`).count() > 0);
  await page.locator('.chat-answer-evidence summary').click();
  const evidenceText = await page.locator('.chat-answer-evidence').innerText();
  assert(evidenceText.includes("本地已核验案例"));
  assert(evidenceText.includes("三门祭冬") && evidenceText.includes("姑苏冬至喝冬酿酒"));
  assert(evidenceText.includes("仅校验实体、归属与引用关联"));
  assert(report.complexResponse.retrievalDiagnostics?.length > 0);
  assert(await page.locator('.chat-answer-evidence a[href^="http"]').count() > 0);
  report.evidenceExplanationVisible = true;
  await noOverflow("desktop evidence");
  await page.screenshot({ path: resolve(output, "desktop-evidence.png"), fullPage: false });
  await page.getByRole("button", { name: "在地图中查看", exact: true }).click();
  await page.waitForFunction(() => document.querySelector("#case-detail-title")?.textContent === "三门祭冬");
  assert.equal(await page.getByLabel("地区", { exact: true }).inputValue(), "330000");
  assert.equal(await page.locator('.case-term-options button[aria-pressed="true"]').textContent(), "冬至");
  for (const code of ["320000", "330000"]) assert.equal(await page.locator(`[data-visual-province="${code}"]`).getAttribute("data-ai-highlighted"), "true");
  report.atomicMapApplied = true;
  await page.screenshot({ path: resolve(output, "desktop-map.png"), fullPage: false });

  await page.setViewportSize({ width: 393, height: 851 });
  await page.getByRole("button", { name: "打开问四时 AI 助手", exact: true }).click();
  await noOverflow("mobile evidence");
  await page.screenshot({ path: resolve(output, "mobile-evidence.png"), fullPage: false });
  const creator = page.locator('.chat-case-card').filter({ hasText: "三门祭冬" }).getByRole("link", { name: /做节气卡/ });
  assert((await creator.getAttribute("href")).includes("caseId=sanmen-jidong"));
  await creator.click();
  await page.waitForURL("**/studio?**");
  await page.locator('.studio-inspiration-case').waitFor();
  assert((await page.locator('.studio-inspiration-case').innerText()).includes("三门祭冬"));
  const studioPending = page.waitForResponse(response => response.url().includes("/api/studio/inspiration?") && response.request().method() === "POST", { timeout: 65000 });
  await page.locator('.studio-inspiration-heading button').click();
  const studio = await studioPending;
  report.studioResponse = await studio.json();
  assert.equal(studio.status(), 200);
  assert(report.studioResponse.references.every(item => item.caseId === "sanmen-jidong"));
  assert(await page.locator('.studio-inspiration-list > li').count() > 0);
  await noOverflow("mobile studio");
  report.caseToStudioGenerated = true;
  await page.screenshot({ path: resolve(output, "mobile-studio.png"), fullPage: false });

  await page.goto(`${origin}/explore?solarTermId=dongzhi`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "打开问四时 AI 助手", exact: true }).click();
  report.staleResponse = await ask("比较江苏浙江冬至习俗，高亮两省并打开三门祭冬。", async () => {
    await page.getByRole("button", { name: "收起 AI 助手", exact: true }).click();
    await page.getByRole("button", { name: "清明", exact: true }).click();
    await page.getByRole("button", { name: "打开问四时 AI 助手", exact: true }).click();
  });
  assert(report.staleResponse.mapActions.length > 0);
  assert.equal(await page.locator('.case-term-options button[aria-pressed="true"]').textContent(), "清明");
  assert(await page.getByRole("button", { name: "在地图中查看", exact: true }).isDisabled());
  assert((await page.locator('.chat-panel').innerText()).includes("之前的地图选择"));
  report.staleActionsRejected = true;
  await noOverflow("mobile stale state");
  await page.screenshot({ path: resolve(output, "mobile-stale.png"), fullPage: false });
  assert.deepEqual(report.pageErrors, []); assert.deepEqual(report.failedResources, []);
  report.passed = true;
} catch (error) {
  report.failure = String(error.stack ?? error);
  await page.screenshot({ path: resolve(output, "failure.png"), fullPage: false }).catch(() => {});
  process.exitCode = 1;
} finally {
  await browser.close();
  writeFileSync(resolve(output, "browser.json"), JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
}
console.log(JSON.stringify({ passed: report.passed, output, failure: report.failure }));
