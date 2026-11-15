import "./register-ts.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";

const { validateAnswerEvidence, buildAnswerEvidence, assertTrustedCaseRecords } = await import("../lib/server/answer-evidence.ts");
const { AnswerEvidenceSchema } = await import("../lib/contracts/ai-evidence.ts");
const { readCulturalCases } = await import("../lib/server/cultural-cases.ts");
const catalog = readCulturalCases();
const byId = id => structuredClone(catalog.find(item => item.id === id));
const sanmen = () => byId("sanmen-jidong");
const wine = () => byId("suzhou-dongzhi-winter-wine");
const live = { query: "官方资料", retrievedAt: "2026-11-15（北京时间）", sources: [
  { title: "香港天文台二十四节气", url: "https://www.hko.gov.hk/tc/gts/astronomy/Solar_Term.htm", content: "测试只验证引用关联，不验证文章内容或模型语义。" },
] };
const rejected = action => assert.throws(action, { code: "EVIDENCE_MISMATCH" });

test("canonical entities, actual sources and citation counts form an explicitly limited evidence packet", () => {
  const answer = "浙江三门祭冬在冬至祭祖。[案例1] 江苏有冬酿酒。[案例2] 引用同一案例仍对应同一实体。[案例1] 本轮另查到天文台资料。[1]";
  const checks = validateAnswerEvidence(answer, [sanmen(), wine()], live);
  assert.deepEqual(checks, { localCitations: [1, 2], webCitations: [1], localCitationCount: 3, webCitationCount: 1, validCitationCount: 4 });
  const packet = AnswerEvidenceSchema.parse(buildAnswerEvidence(answer, [sanmen(), wine()], live));
  assert.deepEqual(packet.kinds, ["local_verified", "live_search", "general_knowledge"]);
  assert.equal(packet.searchStatus, "available");
  assert.equal(packet.localCases[0].caseId, "sanmen-jidong");
  assert.equal(packet.localCases[0].title, sanmen().title);
  assert.deepEqual(packet.localCases[0].sources, sanmen().sources);
  assert(packet.localCases.every(item => item.cited));
  assert.equal(packet.webSources[0].url, live.sources[0].url);
  assert.equal(packet.checks.statementTruth, false);
  assert.match(packet.limitation, /未经逐句事实核验/);
  assert(!JSON.stringify(packet).includes(live.query));
  assert(!JSON.stringify(packet).includes(live.sources[0].content));
});

test("pending and fabricated IDs cannot enter evidence even when a caller labels them verified", () => {
  rejected(() => validateAnswerEvidence("地方习俗。[案例1]", [byId("huangling-flower-buns")]));
  rejected(() => validateAnswerEvidence("地方习俗。[案例1]", [{ ...byId("huangling-flower-buns"), verificationStatus: "verified" }]));
  rejected(() => validateAnswerEvidence("地方习俗。[案例1]", [{ ...sanmen(), id: "invented-sanmen-festival" }]));
  rejected(() => assertTrustedCaseRecords([sanmen(), sanmen()]));
});

test("case metadata and sources must equal server-owned entities instead of merely passing the schema", () => {
  for (const mutate of [
    item => item.title = "虚构三门文化盛典",
    item => item.solarTermIds = ["qingming"],
    item => { item.provinceCode = "110000"; item.provinceName = "北京市"; },
    item => item.relatedProvinceCodes = ["110000"],
    item => item.regionName = "任意新县市",
    item => item.category = "food",
    item => item.description = "这段看起来合法但不是原始案例内容。",
    item => item.relationNote = "这是伪造的节气关联。",
    item => item.sources[0].url = "https://invented.example/history",
    item => item.sources[0].title = "假的原文标题",
    item => item.sources[0].publisher = "假的官方机构",
    item => item.sources = item.sources.slice(0, 1),
    item => item.sources.push({ ...item.sources[0], publisher: "重复URL但伪造机构" }),
  ]) {
    const item = sanmen();
    mutate(item);
    rejected(() => validateAnswerEvidence("地方习俗。[案例1]", [item]));
  }
});

test("malformed, out-of-range, stale and unsourced citations fail closed", () => {
  for (const answer of ["民俗[案例0]", "民俗[案例99]", "民俗[案例一]", "民俗[案例1", "来源[0]", "来源[01]", "来源[1", "来源[2]"]) {
    rejected(() => validateAnswerEvidence(answer, [sanmen()], live));
  }
  rejected(() => validateAnswerEvidence("旧来源[1]", [], undefined));
  rejected(() => validateAnswerEvidence("旧来源[1]", [], null));
  rejected(() => validateAnswerEvidence("无记录[案例1]", []));
});

test("only original case URLs and actual current web URLs are accepted", () => {
  validateAnswerEvidence(`可读原文：${sanmen().sources[0].url}`, [sanmen()]);
  validateAnswerEvidence(`本轮结果：${live.sources[0].url}`, [], live);
  rejected(() => validateAnswerEvidence("伪造链接：https://made-up.example/path", [sanmen()], live));
  rejected(() => validateAnswerEvidence(`${sanmen().sources[0].url}?forged=1`, [sanmen()]));
  rejected(() => validateAnswerEvidence("本轮结果。[1]", [], { ...live, sources: [{ ...live.sources[0], url: "https://secret@example.com/" }] }));
  rejected(() => validateAnswerEvidence("本轮结果。[1]", [], { ...live, sources: [live.sources[0], live.sources[0]] }));
});

test("known title, term and province contradictions are rejected without pretending to understand every sentence", () => {
  rejected(() => validateAnswerEvidence("三门祭冬。[案例1]", [wine(), sanmen()]));
  rejected(() => validateAnswerEvidence("三门祭冬是清明习俗。[案例1]", [sanmen()]));
  rejected(() => validateAnswerEvidence("北京三门祭冬是当地习俗。[案例1]", [sanmen()]));
  validateAnswerEvidence("浙江三门祭冬属于冬至文化。[案例1]", [sanmen()]);
  validateAnswerEvidence("三门祭冬不是清明活动。[案例1]", [sanmen()]);
  validateAnswerEvidence("三门祭冬和姑苏冬至喝冬酿酒有不同侧重。[案例1][案例2]", [sanmen(), wine()]);
  // General prose is not automatically certified by a valid citation.
  const packet = buildAnswerEvidence("这个历史解释需要结合原文判断。[案例1]", [sanmen()]);
  assert.equal(packet.checks.statementTruth, false);
});

test("ordinary knowledge, failed search and retrieved-but-uncited cases stay distinguishable", () => {
  const ordinary = buildAnswerEvidence("冬至不一定是当地最冷的一天。", []);
  assert.deepEqual(ordinary.kinds, ["general_knowledge"]);
  assert.equal(ordinary.searchStatus, "not_requested");
  const failed = buildAnswerEvidence("实时搜索失败，当前活动无法核实。", [], null);
  assert.deepEqual(failed.kinds, ["general_knowledge", "insufficient_evidence"]);
  assert.equal(failed.searchStatus, "failed");
  const uncited = buildAnswerEvidence("本轮未找到足以回答的资料。", [sanmen()]);
  assert.equal(uncited.localCases[0].cited, false);
  assert(uncited.kinds.includes("insufficient_evidence"));
  const web = buildAnswerEvidence("检索到资料，但无法确定是否适用于所问活动。", [], live);
  assert.equal(web.webSources[0].cited, false);
  assert.equal(web.checks.statementTruth, false);
});

test("every published case retains its full source metadata and explicit related provinces", () => {
  for (const item of catalog.filter(item => item.verificationStatus === "verified")) {
    validateAnswerEvidence(`${item.title}。[案例1]`, [item]);
    const result = buildAnswerEvidence("本地已核验案例资料。[案例1]", [item]);
    assert.equal(result.localCases[0].caseId, item.id);
    assert.deepEqual(result.localCases[0].solarTermIds, item.solarTermIds);
    assert.deepEqual(result.localCases[0].relatedProvinceCodes, item.relatedProvinceCodes);
    assert.deepEqual(result.localCases[0].sources, item.sources);
  }
});
