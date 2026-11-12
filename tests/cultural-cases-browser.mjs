// Exercise the production site through its real UI and APIs; never mock case data.
// PLAYWRIGHT_MODULE_PATH can point to an already installed playwright-core package.
import "./register-ts.mjs";
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const { chromium, devices } = require(process.env.PLAYWRIGHT_MODULE_PATH ?? "playwright-core");
const { SOLAR_TERMS } = await import("../lib/solar-terms.ts");
const cases = JSON.parse(readFileSync(new URL("../data/cultural-cases/cases.json", import.meta.url), "utf8"))
  .filter(item => item.verificationStatus === "verified").sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
const origin = process.argv[2] ?? "http://127.0.0.1:3112";
const output = resolve(process.argv[3] ?? "docs/cultural-sources/2026-11-12/verification");
assert(["http:", "https:"].includes(new URL(origin).protocol));
mkdirSync(output, { recursive: true });
const summary = { testedAt: new Date().toISOString(), origin, cases: cases.length, method: "Real browser, real cultural-case APIs, no API mocking; mobile is Pixel 7 emulation, not a physical phone", profiles: [] };
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  headless: true,
  args: ["--no-proxy-server"],
});
const sorted = values => [...values].sort();
const provincesFor = item => [item.provinceCode, ...(item.relatedProvinceCodes ?? [])];

async function checkContent(container, item) {
  assert.equal(await container.locator(".case-detail-description").textContent(), item.description, `${item.id}: complete description`);
  assert.equal(await container.locator(".case-detail-relation").textContent(), item.relationNote, `${item.id}: relation`);
  const meta = await container.locator(".case-detail-meta").textContent();
  assert(meta.includes(item.regionName) && meta.includes(item.provinceName), `${item.id}: region`);
  assert.deepEqual(sorted(await container.locator(".case-sources a").evaluateAll(links => links.map(link => link.getAttribute("href")))), sorted(item.sources.map(source => source.url)), `${item.id}: all original sources`);
  for (const source of item.sources) {
    if (source.accessNote) assert((await container.locator(".case-sources").textContent()).includes(source.accessNote), `${item.id}: source access note`);
  }
  assert.equal(await container.locator(".case-detail-image").count(), Number(Boolean(item.imageUrl)), `${item.id}: optional image`);
}

async function noHorizontalOverflow(page, label) {
  const widths = await page.evaluate(() => ({ content: document.documentElement.scrollWidth, viewport: document.documentElement.clientWidth }));
  assert(widths.content <= widths.viewport + 1, `${label}: horizontal overflow ${JSON.stringify(widths)}`);
}

async function listIds(page, selector, expected, attribute = "id") {
  await page.waitForFunction(({ selector, expected, attribute }) => {
    const actual = [...document.querySelectorAll(selector)].map(element => element.getAttribute(attribute)).sort();
    return JSON.stringify(actual) === JSON.stringify([...expected].sort());
  }, { selector, expected, attribute });
}

try {
  for (const [name, settings] of [["desktop", { viewport: { width: 1365, height: 900 } }], ["mobile-emulation", devices["Pixel 7"]]]) {
    const context = await browser.newContext({ ...settings, reducedMotion: "reduce" });
    const page = await context.newPage();
    page.setDefaultTimeout(20_000);
    const result = { profile: name, viewport: settings.viewport, pages: [], seasons: [], map: [], pageErrors: [], failedResources: [], ignoredNavigationAborts: 0 };
    summary.profiles.push(result);
    page.on("pageerror", error => result.pageErrors.push(error.message));
    page.on("requestfailed", request => {
      if (request.failure()?.errorText === "net::ERR_ABORTED") result.ignoredNavigationAborts++;
      else result.failedResources.push({ path: new URL(request.url()).pathname, error: request.failure()?.errorText });
    });
    page.on("response", response => {
      if (new URL(response.url()).origin === new URL(origin).origin && response.status() >= 400) result.failedResources.push({ path: new URL(response.url()).pathname, status: response.status() });
    });

    for (const path of ["/", "/about", "/studio"]) {
      const response = await page.goto(new URL(path, origin).href, { waitUntil: "networkidle" });
      assert.equal(response.status(), 200, `${name} ${path}`);
      if (path === "/") assert((await page.locator(".page-note").textContent()).includes(`${cases.length} 则`));
      if (path === "/about") assert((await page.locator(".about-grid").textContent()).includes(`${cases.length} 则`));
      if (path === "/studio") {
        await page.locator("#studio-panel-content select").waitFor();
        assert.equal(await page.locator("#studio-panel-content select option").count(), 24);
      }
      await noHorizontalOverflow(page, `${name} ${path}`);
      result.pages.push({ path, status: response.status(), horizontalOverflow: false });
    }

    assert.equal((await page.goto(new URL("/seasons", origin).href, { waitUntil: "networkidle" })).status(), 200);
    for (const term of SOLAR_TERMS) {
      const expected = cases.filter(item => item.solarTermIds.includes(term.id));
      await page.locator(`.book-directory button[data-term-id="${term.id}"]`).click();
      const panel = page.locator(`.seasons-cases[data-term-id="${term.id}"]`);
      await listIds(page, `.seasons-cases[data-term-id="${term.id}"] details[data-case-id]`, expected.map(item => item.id), "data-case-id");
      assert((await panel.locator(".case-result-count").textContent()).includes(`共 ${expected.length} 则`));
      for (const item of expected) {
        const detail = panel.locator(`details[data-case-id="${item.id}"]`);
        assert((await detail.locator("summary h4").textContent()).includes(item.title));
        await detail.locator("summary").click();
        await checkContent(detail, item);
        await noHorizontalOverflow(page, `${name} seasons ${item.id}`);
        await detail.locator("summary").click();
      }
      assert.equal(await panel.locator(".case-explorer-heading a").getAttribute("href"), `/explore?solarTermId=${term.id}`);
      result.seasons.push({ term: term.id, count: expected.length, allDetailsAndSources: true, horizontalOverflow: false });
    }
    await page.locator(".seasons-cases details").first().locator("summary").click();
    await page.locator(".seasons-cases").screenshot({ path: resolve(output, `${name}-seasonal-cases.png`) });

    assert.equal((await page.goto(new URL("/explore", origin).href, { waitUntil: "networkidle" })).status(), 200);
    for (const term of SOLAR_TERMS) {
      const expected = cases.filter(item => item.solarTermIds.includes(term.id));
      await page.locator(".case-term-options").getByRole("button", { name: term.name, exact: true }).click();
      await page.locator('.province-layers[data-match-status="success"]').waitFor();
      const countByProvince = new Map();
      for (const item of expected) for (const code of provincesFor(item)) countByProvince.set(code, (countByProvince.get(code) ?? 0) + 1);
      await listIds(page, '.province-art [data-visual-province][data-matched="true"]', [...countByProvince.keys()], "data-visual-province");
      for (const [code, count] of countByProvince) {
        assert((await page.locator(`.province-target[data-province-code="${code}"]`).getAttribute("aria-label")).includes(`已收录${count}则案例`), `${term.id} province ${code} count`);
      }
      // Current terms fit one page; assert this instead of silently skipping later cases.
      await listIds(page, ".case-list-panel:not([hidden]) .case-card", expected.map(item => `case-card-${item.id}`));
      assert((await page.locator(".case-list-panel:not([hidden]) .case-result-count").textContent()).includes(`共 ${expected.length} 则`));
      let detailReads = 0;
      for (const item of expected) {
        for (const code of provincesFor(item)) {
          await page.getByLabel("地区", { exact: true }).selectOption(code);
          const provinceCases = expected.filter(candidate => provincesFor(candidate).includes(code));
          await listIds(page, ".case-list-panel:not([hidden]) .case-card", provinceCases.map(candidate => `case-card-${candidate.id}`));
          await page.locator(`#case-card-${item.id}`).click();
          const detail = page.locator("#culture-case-detail:not([hidden])");
          await page.waitForFunction(title => document.querySelector("#case-detail-title")?.textContent === title, item.title);
          await checkContent(detail, item);
          assert.equal(await page.getByLabel("地区", { exact: true }).inputValue(), code, `${item.id}: keep associated province`);
          await noHorizontalOverflow(page, `${name} map ${item.id}`);
          await detail.getByRole("button", { name: "返回列表", exact: true }).click();
          detailReads++;
        }
      }
      result.map.push({ term: term.id, count: expected.length, provinceCounts: Object.fromEntries(countByProvince), detailReads, horizontalOverflow: false });
      console.log(`${name}: ${term.name} ${expected.length} cases, ${detailReads} map details passed`);
    }
    // Follow the actual book link to verify the term survives navigation.
    await page.goto(new URL("/seasons", origin).href, { waitUntil: "networkidle" });
    await page.locator('.book-directory button[data-term-id="daxue"]').click();
    const selectedPanel = page.locator('.seasons-cases[data-term-id="daxue"]');
    await selectedPanel.locator(".case-explorer-heading a").click();
    await page.waitForURL("**/explore?solarTermId=daxue");
    assert.equal(await page.locator(".case-term-options").getByRole("button", { name: "大雪", exact: true }).getAttribute("aria-pressed"), "true");
    await page.locator('.province-layers[data-match-status="success"]').waitFor();
    result.bookToMapNavigation = true;
    const linked = cases.find(item => item.solarTermIds.includes("daxue"));
    await page.goto(new URL(`/explore?solarTermId=daxue&provinceCode=${linked.provinceCode}`, origin).href, { waitUntil: "networkidle" });
    assert.equal(await page.getByLabel("地区", { exact: true }).inputValue(), linked.provinceCode);
    result.provinceLinkNavigation = true;
    await page.goto(new URL("/explore?solarTermId=invalid&provinceCode=100000_JD", origin).href, { waitUntil: "networkidle" });
    assert.equal(await page.getByLabel("地区", { exact: true }).inputValue(), "");
    assert.equal(await page.getByRole("button", { name: "全部节气", exact: true }).getAttribute("aria-pressed"), "true");
    result.invalidLinkFallsBackToAll = true;
    assert.deepEqual(result.pageErrors, [], `${name}: browser errors`);
    assert.deepEqual(result.failedResources, [], `${name}: failed resources`);
    await context.close();
  }
  summary.passed = true;
} catch (error) {
  summary.passed = false;
  summary.failure = String(error?.stack ?? error);
  process.exitCode = 1;
} finally {
  await browser.close();
  writeFileSync(resolve(output, "browser.json"), JSON.stringify(summary, null, 2) + "\n");
}
console.log(JSON.stringify({ passed: summary.passed, cases: cases.length, profiles: summary.profiles.map(profile => ({ profile: profile.profile, terms: profile.seasons.length, mapTerms: profile.map.length })), ...(summary.failure ? { failure: summary.failure } : {}) }, null, 2));
