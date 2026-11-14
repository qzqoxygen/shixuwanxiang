import "./register-ts.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";

const { POST } = await import("../app/api/seasons/guide/route.ts");
const { getSeasonGuide, GUIDE_MODES, GUIDE_TOPICS } = await import("../lib/season-guides.ts");
const { SOLAR_TERMS } = await import("../lib/solar-terms.ts");
const { studioCaseForTerm } = await import("../lib/server/cultural-case-context.ts");
const url = "http://localhost:3000/api/seasons/guide";
const request = (query, origin = "http://localhost:3000") => new Request(`${url}?${query}`, { method: "POST", headers: { origin } });

test("all 24 solar terms have two reading modes and a verified source for their own case", () => {
  for (const { id, name } of SOLAR_TERMS) {
    const guide = getSeasonGuide(id);
    assert.ok(studioCaseForTerm(guide.caseId, id)?.sources.length, name);
    for (const mode of Object.keys(GUIDE_MODES)) {
      assert.equal(guide[mode].intro.length, 2, `${name} / ${mode}`);
      assert.ok(guide[mode].intro.every(paragraph => paragraph.trim().length > 30), `${name} / ${mode}`);
    }
    assert.notDeepEqual(guide.brief.intro, guide.children.intro, name);
  }
});

test("the live guide rotates topics and validates the response against the selected page", async t => {
  const previousKey = process.env.DEEPSEEK_API_KEY;
  process.env.DEEPSEEK_API_KEY = "test-season-guide";
  t.after(() => {
    if (previousKey === undefined) delete process.env.DEEPSEEK_API_KEY;
    else process.env.DEEPSEEK_API_KEY = previousKey;
  });
  const prompts = [];
  let selectedTerm = { id: "dongzhi", name: "冬至" };
  let guide = "晴天可以站在同一个位置观察影子。记下影尖的位置，再隔一段时间来比一比，就能看到影子的方向慢慢变了。";
  let invalidOnce = false;
  const fetch = t.mock.method(globalThis, "fetch", async (address, options) => {
    assert.equal(String(address), "https://api.deepseek.com/chat/completions");
    const { messages, response_format } = JSON.parse(options.body);
    assert.deepEqual(response_format, { type: "json_object" });
    const context = JSON.parse(messages.at(-1).content);
    assert.equal(context.term, selectedTerm.name);
    assert.equal(Object.hasOwn(context, "followUpCase"), false);
    assert.deepEqual(context.baseGuide, getSeasonGuide(selectedTerm.id).children.intro);
    assert.match(context.style, /小朋友/u);
    prompts.push(context.topic);
    const content = JSON.stringify({ guide: invalidOnce ? "从冬至开始数九，每天给消寒图涂一瓣。" : guide });
    invalidOnce = false;
    return Response.json({ choices: [{ finish_reason: "stop", message: { content } }] });
  });
  assert.equal((await POST(request("term=dongzhi&mode=children", "https://outside.example"))).status, 403);
  assert.equal((await POST(request("term=unknown&mode=children"))).status, 400);
  assert.equal((await POST(request("term=dongzhi&mode=other"))).status, 400);
  assert.equal((await POST(request("term=dongzhi&mode=children&previous=unknown"))).status, 400);
  assert.equal(fetch.mock.callCount(), 0);
  const response = await POST(request("term=dongzhi&mode=children"));
  assert.equal(response.status, 200);
  const first = await response.json();
  assert.equal(first.guide, guide);
  assert.equal(GUIDE_TOPICS[first.topic], prompts[0]);

  guide = "看看冬天的树枝。有些树已经落光了叶子，松树却还绿着。松针又细又窄，表面有一层像蜡一样的保护层，可以帮助它少丢掉一些水分。";
  invalidOnce = true;
  const next = await POST(request(`term=dongzhi&mode=children&previous=${first.topic}`));
  assert.equal(next.status, 200);
  const second = await next.json();
  assert.equal(second.guide, guide);
  assert.notEqual(second.topic, first.topic);
  assert.equal(GUIDE_TOPICS[second.topic], prompts[2]);
  assert.notEqual(prompts[1], prompts[0]);
  assert.notEqual(prompts[1], prompts[2]);
  for (const invalid of [
    "九九消寒图像一本画着梅花的日历，从冬至起每天染一瓣。",
    "从冬至开始数九，每天给梅花涂一瓣。浙江三门也有祭冬的习俗。",
    "你可以连续几天在吃晚饭前看看窗外，过些日子再比一比，看看天黑的时间有没有变化。再试着观察树枝上的霜。",
    "浙江三门的杨家村有祭冬习俗：https://outside.example/unverified",
  ]) {
    guide = invalid;
    assert.equal((await POST(request("term=dongzhi&mode=children"))).status, 502);
  }
  selectedTerm = { id: "lichun", name: "立春" };
  guide = "春天可以在窗边观察影子。把纸立在固定的地方，留意早上和下午影子朝哪边。换一个晴天，还能再试一遍。";
  const spring = await POST(request("term=lichun&mode=children"));
  assert.equal(spring.status, 200);
  assert.equal((await spring.json()).guide, guide);
});
