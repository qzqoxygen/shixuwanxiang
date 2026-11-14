// Opt-in browser acceptance. Uses the real site and three billable UI actions; never mocks APIs.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH ?? "playwright-core");
const origin = new URL(process.argv[2] ?? "http://127.0.0.1:3115").origin;
const output = resolve(process.argv[3] ?? `docs/verification/agent-v1-2026-11-15/browser-${Date.now()}`);
mkdirSync(output, { recursive: true });
const report = { testedAt: new Date().toISOString(), origin, method: "Real Chrome, real website APIs and DeepSeek; mobile viewport is not a physical phone; no mocks or automatic retries", pages: [], pageErrors: [], failedResources: [], passed: false };
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", headless: true, args: ["--no-proxy-server"] });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
const page = await context.newPage();
page.setDefaultTimeout(20000);
page.on("pageerror", error => report.pageErrors.push(error.message));
page.on("requestfailed", request => {
  if (request.failure()?.errorText !== "net::ERR_ABORTED") report.failedResources.push({ path: new URL(request.url()).pathname, error: request.failure()?.errorText });
});

async function noOverflow(label) {
  const values = await page.evaluate(() => ({ content: document.documentElement.scrollWidth, viewport: document.documentElement.clientWidth }));
  assert(values.content <= values.viewport + 1, `${label}: overflow ${JSON.stringify(values)}`);
}
async function ask(question, during) {
  const responseReady = page.waitForResponse(response => response.url() === `${origin}/api/chat` && response.request().method() === "POST", { timeout: 65000 });
  await page.getByLabel("提问", { exact: true }).fill(question);
  await page.getByRole("button", { name: "发送", exact: true }).click();
  if (during) await during();
  const response = await responseReady;
  assert.equal(response.status(), 200, "real chat status");
  const body = await response.json();
  assert.equal(body.version, "1.0");
  await page.waitForFunction(() => !document.querySelector(".chat-loading"));
  return body;
}

try {
  for (const path of ["/", "/seasons", "/explore", "/studio", "/about"]) {
    const response = await page.goto(origin + path, { waitUntil: "networkidle" });
    assert.equal(response.status(), 200, path);
    await noOverflow(path);
    report.pages.push({ path, status: response.status(), horizontalOverflow: false });
  }
  const caseResponse = await page.request.get(`${origin}/api/cultural-cases?limit=20`);
  assert.equal((await caseResponse.json()).total, 77);
  for (const id of ["huangling-flower-buns", "xinzheng-jujube-harvest"]) assert.equal((await page.request.get(`${origin}/api/cultural-cases/${id}`)).status(), 404);
  report.dataBoundary = { verified: 77, pendingHidden: 2 };
  await page.goto(`${origin}/seasons`, { waitUntil: "networkidle" });
  await page.locator('.book-directory button[data-term-id="dongzhi"]').click();
  await page.waitForFunction(() => document.querySelector(".seasons-book")?.getAttribute("data-term-id") === "dongzhi");
  const photoSource = await page.locator('.seasons-book-base .seasons-photo-open img').getAttribute("src");
  assert.equal(new URL(photoSource, origin).pathname, "/images/solar-terms/dongzhi-hd.webp");
  report.seasonsNavigation = true;

  await page.goto(`${origin}/explore`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "打开问四时 AI 助手", exact: true }).click();
  const complexQuestion = "请比较江苏和浙江冬至的已核验民俗特点和资料来源，展示冬至文化地图，突出江苏、浙江，并打开三门祭冬案例，方便我继续做节气卡。请实际使用相应工具完成。";
  const answer = await ask(complexQuestion);
  report.complexResponse = answer;
  const tools = answer.toolEvents.filter(event => event.status === "success").map(event => event.toolName);
  for (const name of ["compare_cultural_cases", "show_cultural_map", "highlight_regions", "open_cultural_case"]) assert(tools.includes(name), name);
  assert(await page.locator('.chat-case-card').count() >= 2);
  for (const name of ["江苏省", "浙江省"]) {
    const group = page.locator(`.chat-region-group[aria-label="${name}文化案例"]`);
    assert(await group.count() > 0, `${name} comparison group`);
    assert(await group.locator('a[href^="http"]').count() > 0, `${name} real source links`);
  }
  for (const tool of tools) assert(await page.locator(`.chat-tool-events li[data-tool="${tool}"][data-status="success"]`).count() > 0, `visible ${tool} event`);
  await noOverflow("desktop chat");
  await page.screenshot({ path: resolve(output, "desktop-tools.png"), fullPage: false });
  await page.getByRole("button", { name: "在地图中查看", exact: true }).click();
  await page.waitForFunction(() => document.querySelector("#case-detail-title")?.textContent === "三门祭冬");
  assert.equal(await page.getByLabel("地区", { exact: true }).inputValue(), "330000");
  assert.equal(await page.locator('.case-term-options button[aria-pressed="true"]').textContent(), "冬至");
  for (const code of ["320000", "330000"]) assert.equal(await page.locator(`[data-visual-province="${code}"]`).getAttribute("data-ai-highlighted"), "true");
  report.atomicMapApplied = { term: "dongzhi", province: "330000", caseId: "sanmen-jidong", highlighted: ["320000", "330000"] };
  await page.screenshot({ path: resolve(output, "desktop-map.png"), fullPage: false });

  // Keep the real conversation while switching the viewport; no copied or mocked answer data.
  await page.setViewportSize({ width: 393, height: 851 });
  await page.getByRole("button", { name: "打开问四时 AI 助手", exact: true }).click();
  await noOverflow("mobile chat");
  await page.screenshot({ path: resolve(output, "mobile-tools.png"), fullPage: false });
  const creator = page.locator('.chat-case-card').filter({ hasText: "三门祭冬" }).getByRole("link", { name: /做节气卡/ });
  assert((await creator.getAttribute("href")).includes("caseId=sanmen-jidong"));
  await creator.click();
  await page.waitForURL("**/studio?**");
  await page.locator('.studio-inspiration-case').waitFor();
  assert((await page.locator('.studio-inspiration-case').innerText()).includes("三门祭冬"));
  await noOverflow("mobile seeded studio");
  report.caseToStudio = true;
  const studioResponseReady = page.waitForResponse(response => response.url().includes("/api/studio/inspiration?") && response.request().method() === "POST", { timeout: 65000 });
  await page.locator('.studio-inspiration-heading button').click();
  const studioResponse = await studioResponseReady;
  assert.equal(studioResponse.status(), 200);
  report.studioResponse = await studioResponse.json();
  assert(report.studioResponse.references.every(item => item.caseId === "sanmen-jidong"));
  assert(await page.locator('.studio-inspiration-list > li').count() > 0);
  await page.screenshot({ path: resolve(output, "mobile-studio.png"), fullPage: false });

  // A second real request intentionally becomes stale after a manual map change.
  await page.goto(`${origin}/explore?solarTermId=dongzhi`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "打开问四时 AI 助手", exact: true }).click();
  const staleAnswer = await ask("请比较江苏和浙江冬至习俗，在地图中突出这两个地区，并打开三门祭冬。", async () => {
    await page.getByRole("button", { name: "收起 AI 助手", exact: true }).click();
    await page.getByRole("button", { name: "清明", exact: true }).click();
    await page.getByRole("button", { name: "打开问四时 AI 助手", exact: true }).click();
  });
  assert(staleAnswer.mapActions.length > 0, "stale test received actual pending map operations");
  assert.equal(await page.locator('.case-term-options button[aria-pressed="true"]').textContent(), "清明");
  assert((await page.locator('.chat-panel').innerText()).includes("之前的地图选择"));
  assert(await page.getByRole("button", { name: "在地图中查看", exact: true }).isDisabled());
  report.staleActionsRejected = true;
  await noOverflow("mobile stale response");
  await page.screenshot({ path: resolve(output, "mobile-stale.png"), fullPage: false });
  assert.deepEqual(report.pageErrors, []);
  assert.deepEqual(report.failedResources, []);
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
