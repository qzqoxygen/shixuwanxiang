import "server-only";
import { z } from "zod";
import type { AgentTool } from "../ai-agent";
import type { ChatMessage } from "../chat";
import { MAX_CHAT_CASE_REFERENCES, type VerifiedCulturalCase } from "../contracts/cultural-case";
import type { SolarTermId } from "../solar-terms";
import { culturalCaseContext, retrieveChatCases } from "./cultural-case-context";
import { readCulturalCases } from "./cultural-cases";

const SearchInput = z.strictObject({ query: z.string().trim().min(1).max(180) });

export function createChatCaseTool(history: readonly ChatMessage[]) {
  const catalog = readCulturalCases();
  const fallback = retrieveChatCases(history, catalog);
  const cases: VerifiedCulturalCase[] = [];
  const terms = new Set<SolarTermId>(fallback.terms);
  let searched = false;

  const tool: AgentTool = {
    definition: {
      type: "function",
      function: {
        name: "search_cultural_cases",
        description: "查询本站已核验的二十四节气文化案例，返回案例编号、记载和资料来源。适用于地方习俗、非遗案例和跨地区对比。",
        parameters: {
          type: "object",
          properties: { query: { type: "string", description: "中文查询词。保留所有要比较的地区和节气，例如：江苏 浙江 冬至 习俗。" } },
          required: ["query"],
          additionalProperties: false,
        },
      },
    },
    execute(input) {
      const { query } = SearchInput.parse(input);
      const matched = retrieveChatCases([...history, { role: "user", content: `${query} 习俗` }], catalog);
      // Keep citation numbers stable when the model queries multiple regions in separate calls.
      for (const term of matched.terms) terms.add(term);
      for (const item of matched.cases) {
        if (cases.length < MAX_CHAT_CASE_REFERENCES && !cases.some(({ id }) => id === item.id)) cases.push(item);
      }
      searched = true;
      const ids = new Set(matched.cases.map(({ id }) => id));
      return { cases: culturalCaseContext(cases).filter(({ caseId }) => ids.has(caseId)) };
    },
  };
  return { tool, cases, terms, fallback, get searched() { return searched; } };
}
