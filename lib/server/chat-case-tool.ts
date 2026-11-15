import "server-only";
import { z } from "zod";
import { AgentToolError, type AgentTool } from "../ai-agent";
import type { ChatMessage } from "../chat";
import { CulturalCaseIdSchema, CulturalCategorySchema, MAX_CHAT_CASE_REFERENCES, ProvinceCodeSchema, SolarTermIdSchema, type CulturalCase, type VerifiedCulturalCase } from "../contracts/cultural-case";
import type { ChatContext, CulturalMapState, MapAction } from "../contracts/chat-api";
import type { RetrievalDiagnostic } from "../contracts/retrieval";
import { CULTURAL_CASE_ALIASES, normalizeCulturalQuery } from "../cultural-aliases";
import { applyValidatedMapActions, MapActionError } from "../map-actions";
import { SUPPORTED_PROVINCES } from "../provinces";
import { SOLAR_TERMS } from "../solar-terms";
import { SOLAR_TERM_NOTES } from "../solar-term-notes";
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

const queryProperties = {
  query: { type: "string", description: "中文查询词，保留所有地区、节气和习俗名称。" },
  solarTermId: { type: "string", enum: SOLAR_TERMS.map(item => item.id) },
  provinceCode: { type: "string", enum: SUPPORTED_PROVINCES.map(item => item.code) },
  category: { type: "string", enum: CulturalCategorySchema.options },
  keyword: { type: "string", description: "案例标题、地区、简介或关联依据中的字面关键词。" },
  offset: { type: "integer", minimum: 0 },
  limit: { type: "integer", minimum: 1, maximum: 20 },
} as const;
const StructuredSearch = z.strictObject({
  query: z.string().trim().min(1).max(180).optional(),
  solarTermId: SolarTermIdSchema.optional(), provinceCode: ProvinceCodeSchema.optional(),
  category: CulturalCategorySchema.optional(), keyword: z.string().trim().max(100).optional(),
  offset: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).default(0),
  limit: z.number().int().min(1).max(20).default(6),
});
const uniqueProvinces = z.array(ProvinceCodeSchema).max(34).refine(ids => new Set(ids).size === ids.length);
const ShowInput = z.strictObject({ solarTermId: SolarTermIdSchema });
const HighlightInput = z.strictObject({ provinceCodes: uniqueProvinces });
const OpenInput = z.strictObject({ caseId: CulturalCaseIdSchema });
const CompareInput = z.strictObject({
  solarTermId: SolarTermIdSchema, provinceCodes: uniqueProvinces.min(2).max(6),
  category: CulturalCategorySchema.optional(), keyword: z.string().trim().max(100).optional(),
});

function parseTool<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) throw new AgentToolError("INVALID_TOOL_ARGUMENTS", "工具参数无效，请使用合法节气、地区和筛选条件。");
  return result.data;
}

function tool(name: string, description: string, properties: Record<string, unknown>, required: string[], execute: AgentTool["execute"]): AgentTool {
  return { definition: { type: "function", function: { name, description,
    parameters: { type: "object", properties, required, additionalProperties: false } } }, execute };
}

function matchesKeyword(item: CulturalCase, keyword: string | undefined) {
  if (!keyword) return true;
  const value = normalizeCulturalQuery(keyword).text.toLowerCase();
  return [item.title, item.regionName, item.description, item.relationNote, ...(CULTURAL_CASE_ALIASES[item.id] ?? [])]
    .some(text => normalizeCulturalQuery(text).text.toLowerCase().includes(value));
}

// A request owns its catalog, citation order and temporary map. No model output is executable code.
export function createCultureAgentTools(history: readonly ChatMessage[], context: ChatContext) {
  const catalog = readCulturalCases();
  const cases: VerifiedCulturalCase[] = [];
  const fallback = retrieveChatCases(history, catalog);
  const terms = new Set<SolarTermId>(fallback.terms);
  if (!terms.size && context.solarTermId) terms.add(context.solarTermId);
  let state: CulturalMapState = {
    selectedSolarTermId: context.solarTermId, selectedProvinceCode: context.provinceCode,
    selectedCaseId: context.caseId, highlightedProvinceCodes: [],
  };
  const mapActions: MapAction[] = [];
  const retrievalDiagnostics: RetrievalDiagnostic[] = [];
  let searched = false;

  function remember(items: readonly VerifiedCulturalCase[]) {
    for (const item of items) if (!cases.some(value => value.id === item.id) && cases.length < MAX_CHAT_CASE_REFERENCES) cases.push(item);
    const ids = new Set(items.map(item => item.id));
    return culturalCaseContext(cases).filter(item => ids.has(item.caseId));
  }
  function prepare(action: MapAction) {
    if (mapActions.length >= 8) throw new AgentToolError("TOOL_RESULT_TOO_LARGE", "本轮地图操作已达到上限。");
    try { return applyValidatedMapActions(state, [action], catalog); }
    catch (error) {
      if (error instanceof MapActionError) throw new AgentToolError(error.code, error.message);
      throw error;
    }
  }
  function commit(action: MapAction, next: CulturalMapState) {
    state = next;
    mapActions.push(action);
    if (state.selectedSolarTermId) terms.add(state.selectedSolarTermId);
  }
  const tools: AgentTool[] = [
    tool("search_cultural_cases", "真实查询本站已核验节气案例。支持中文query或结构化节气、地区、类别和关键词联合筛选，结果中citation是本轮稳定引用编号。", queryProperties, [], input => {
      const query = parseTool(StructuredSearch, input);
      const filtered = catalog.filter((item): item is VerifiedCulturalCase => item.verificationStatus === "verified" &&
        (!query.solarTermId || item.solarTermIds.includes(query.solarTermId)) &&
        (!query.provinceCode || item.provinceCode === query.provinceCode || item.relatedProvinceCodes?.includes(query.provinceCode) === true) &&
        (!query.category || item.category === query.category) &&
        matchesKeyword(item, query.keyword));
      const matched = query.query ? retrieveChatCases([...history, { role: "user", content: `${query.query} 习俗` }], filtered, filtered.length)
        : { cases: filtered.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0), terms: query.solarTermId ? [query.solarTermId] : [] };
      for (const term of matched.terms) terms.add(term);
      searched = true;
      const selected = remember(matched.cases.slice(query.offset, query.offset + query.limit));
      const diagnostic: RetrievalDiagnostic = query.query ? (matched as ReturnType<typeof retrieveChatCases>).diagnostics : {
        strategy: "filters_only", solarTermIds: query.solarTermId ? [query.solarTermId] : [], provinceCodes: query.provinceCode ? [query.provinceCode] : [], regions: [],
        ...(query.category ? { category: query.category } : {}), normalizedTerms: query.keyword ? [normalizeCulturalQuery(query.keyword).text] : [], matchedAliases: [],
        candidateCount: filtered.length, matchedCount: matched.cases.length, matchedIds: [], scores: [],
        ...(!matched.cases.length ? { noMatchReason: "no_public_match" as const } : {}),
      };
      if (retrievalDiagnostics.length < 8) retrievalDiagnostics.push({ ...diagnostic,
        matchedIds: selected.map(item => item.caseId), scores: selected.map(item => diagnostic.scores.find(score => score.caseId === item.caseId) ?? { caseId: item.caseId, score: 0, matchedFields: ["filters"] }),
      });
      return { cases: selected, total: matched.cases.length, offset: query.offset, limit: query.limit,
        selectedCount: selected.length, truncated: selected.length < Math.min(query.limit, Math.max(0, matched.cases.length - query.offset)) };
    }),
    tool("show_cultural_map", "准备指定节气的文化地图，生成SET_SOLAR_TERM；高亮或打开案例之前必须先有节气。", { solarTermId: queryProperties.solarTermId }, ["solarTermId"], input => {
      const { solarTermId } = parseTool(ShowInput, input);
      const action: MapAction = { type: "SET_SOLAR_TERM", payload: { solarTermId } };
      commit(action, prepare(action));
      return { solarTermId, mapActions: [action] };
    }),
    tool("highlight_regions", "突出当前节气有真实已核验案例的省份；需要先选节气，替换已有高亮，空数组清空。", {
      provinceCodes: { type: "array", items: queryProperties.provinceCode, maxItems: 34, uniqueItems: true },
    }, ["provinceCodes"], input => {
      const { provinceCodes } = parseTool(HighlightInput, input);
      const action: MapAction = { type: "HIGHLIGHT_PROVINCES", payload: { provinceCodes } };
      commit(action, prepare(action));
      return { provinceCodes, mapActions: [action] };
    }),
    tool("open_cultural_case", "打开查询结果中的真实案例ID并生成OPEN_CULTURAL_CASE；案例必须已核验且属于当前地图节气，不能猜测ID。", {
      caseId: { type: "string", description: "从本轮案例查询结果取得的caseId。" },
    }, ["caseId"], input => {
      const { caseId } = parseTool(OpenInput, input);
      const action: MapAction = { type: "OPEN_CULTURAL_CASE", payload: { caseId } };
      const next = prepare(action);
      const item = catalog.find((item): item is VerifiedCulturalCase => item.id === caseId && item.verificationStatus === "verified")!;
      if (!cases.some(item => item.id === caseId) && cases.length >= MAX_CHAT_CASE_REFERENCES) {
        throw new AgentToolError("TOOL_RESULT_TOO_LARGE", "本轮可引用案例已达上限，请另起一个问题打开该案例。");
      }
      const [record] = remember([item]);
      commit(action, next);
      return { item: record, mapActions: [action] };
    }),
    tool("get_solar_term_info", "查询一个节气的已整理基础资料：名称、季节、太阳黄经、科普说明与节气小识，不提供实时日期天气。", {
      solarTermId: queryProperties.solarTermId,
    }, ["solarTermId"], input => {
      const { solarTermId } = parseTool(ShowInput, input);
      const term = SOLAR_TERMS.find(item => item.id === solarTermId)!;
      return { solarTermId, name: term.name, season: term.season, solarLongitude: term.solarLongitude,
        description: term.description, note: SOLAR_TERM_NOTES[solarTermId],
        source: { title: "香港天文台：二十四节气", url: "https://www.hko.gov.hk/tc/gts/time/24solarterms.htm" } };
    }),
    tool("compare_cultural_cases", "比较同一节气多个地区的真实案例，按省份分组展示地方文化和原文来源；每省最多两则，总共最多六则，未收录地区正常为空。", {
      solarTermId: queryProperties.solarTermId,
      provinceCodes: { type: "array", items: queryProperties.provinceCode, minItems: 2, maxItems: 6, uniqueItems: true },
      category: queryProperties.category, keyword: queryProperties.keyword,
    }, ["solarTermId", "provinceCodes"], input => {
      const query = parseTool(CompareInput, input);
      const groups = query.provinceCodes.map(provinceCode => ({ provinceCode,
        provinceName: SUPPORTED_PROVINCES.find(item => item.code === provinceCode)!.name,
        matches: catalog.filter((item): item is VerifiedCulturalCase => item.verificationStatus === "verified" && item.solarTermIds.includes(query.solarTermId) &&
          (item.provinceCode === provinceCode || item.relatedProvinceCodes?.includes(provinceCode) === true) &&
          (!query.category || item.category === query.category) &&
          matchesKeyword(item, query.keyword))
          .sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
      }));
      const selected: VerifiedCulturalCase[] = [];
      for (let index = 0; index < 2; index++) for (const group of groups) {
        const item = group.matches[index];
        if (item && !selected.some(value => value.id === item.id)) selected.push(item);
      }
      const records = remember(selected);
      searched = true;
      terms.add(query.solarTermId);
      if (retrievalDiagnostics.length < 8) retrievalDiagnostics.push({
        strategy: "comparison", solarTermIds: [query.solarTermId], provinceCodes: query.provinceCodes, regions: [],
        ...(query.category ? { category: query.category } : {}), normalizedTerms: query.keyword ? [normalizeCulturalQuery(query.keyword).text] : [], matchedAliases: [],
        candidateCount: new Set(groups.flatMap(group => group.matches.map(item => item.id))).size,
        matchedCount: new Set(groups.flatMap(group => group.matches.map(item => item.id))).size,
        matchedIds: records.map(item => item.caseId), scores: records.map(item => ({ caseId: item.caseId, score: 0, matchedFields: ["filters"] })),
        ...(!records.length ? { noMatchReason: "no_public_match" as const } : {}),
      });
      return { solarTermId: query.solarTermId, regions: groups.map(group => ({
        provinceCode: group.provinceCode, provinceName: group.provinceName, total: group.matches.length,
        cases: records.filter(item => group.matches.some(match => match.id === item.caseId)),
      })), cases: records, comparisonNote: "仅比较本次已核验案例，空结果不表示当地不存在相关文化。" };
    }),
  ];
  return { tools, cases, terms, fallback, mapActions, retrievalDiagnostics, get searched() { return searched; }, get state() { return state; } };
}
