import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("the checked-in AI quality fixture covers aliases, follow-ups, contradictions and unknown cases without live calls", () => {
  const fixtures = JSON.parse(readFileSync(new URL("./fixtures/ai-quality-cases.json", import.meta.url), "utf8"));
  assert.equal(fixtures.version, "1.0");
  assert.equal(new Set(fixtures.retrieval.map(sample => sample.id)).size, fixtures.retrieval.length);
  for (const group of ["alias", "cross_region", "joint_filters", "follow_up", "empty", "fabricated", "contradiction", "pending"]) assert(fixtures.retrieval.some(sample => sample.group === group), group);
  assert.equal(fixtures.live.length, 6);
  assert(fixtures.live.some(sample => sample.liveSearch));
  assert(fixtures.live.some(sample => sample.historyFrom));
});

test("deterministic evaluation reports actual retrieval and program checks separately from model quality", async () => {
  const { evaluateDeterministic } = await import("../scripts/evaluate-ai.mjs");
  const report = await evaluateDeterministic();
  assert.equal(report.mode, "deterministic");
  assert(report.summary.sampleCount >= 210);
  assert.equal(report.samples.filter(sample => sample.group === "24_term_catalog").length, 24);
  assert.equal(report.samples.filter(sample => sample.group === "77_exact_case_titles").length, 77);
  assert.equal(report.samples.filter(sample => sample.group === "valid_catalog_citations").length, 77);
  assert.equal(report.passed, true, JSON.stringify(report.summary.failures));
  assert.equal(report.summary.citations.associationValidityRate, 1);
});
