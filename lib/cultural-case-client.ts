import { ApiFailureSchema, CaseDetailResponseSchema, CaseListResponseSchema, type CaseListQuery, type ProvinceCode, type SolarTermId } from "./contracts/cultural-case";

export function caseListUrl(query: CaseListQuery) {
  const params = new URLSearchParams();
  for (const [name, value] of Object.entries(query)) if (value !== undefined) params.set(name, String(value));
  return `/api/cultural-cases?${params}`;
}

async function readJson(url: string, signal: AbortSignal, fetcher: typeof fetch) {
  const response = await fetcher(url, { signal, cache: "no-store" });
  let body: unknown;
  try { body = await response.json(); }
  catch { throw new Error("案例服务返回了无法读取的数据，请稍后重试。"); }
  if (!response.ok) {
    const failure = ApiFailureSchema.safeParse(body);
    throw new Error(failure.success ? failure.data.error.message : "案例请求失败，请稍后重试。");
  }
  return body;
}

export async function fetchCaseList(query: CaseListQuery, signal: AbortSignal, fetcher: typeof fetch = fetch) {
  const parsed = CaseListResponseSchema.safeParse(await readJson(caseListUrl(query), signal, fetcher));
  if (!parsed.success) throw new Error("案例列表格式不符合约定，请稍后重试。");
  const data = parsed.data;
  if (data.offset !== query.offset || data.limit !== query.limit || data.items.length > query.limit || data.total < data.items.length ||
    new Set(data.items.map(item => item.id)).size !== data.items.length ||
    data.items.some(item => (query.solarTermId && !item.solarTermIds.includes(query.solarTermId)) || (query.provinceCode && item.provinceCode !== query.provinceCode))) {
    throw new Error("案例列表与当前筛选不一致，请重试。");
  }
  return data;
}

export async function fetchCaseDetail(caseId: string, signal: AbortSignal, fetcher: typeof fetch = fetch) {
  const parsed = CaseDetailResponseSchema.safeParse(await readJson(`/api/cultural-cases/${encodeURIComponent(caseId)}`, signal, fetcher));
  if (!parsed.success || parsed.data.item.id !== caseId) throw new Error("案例详情与所选内容不一致，请重试。");
  return parsed.data.item;
}

// Province availability is nationwide for the chosen term, independent of the
// province/list-page currently selected. The existing API allows at most 20 rows.
export async function fetchProvinceCaseCounts(solarTermId: SolarTermId, signal: AbortSignal, fetcher: typeof fetch = fetch) {
  const counts = new Map<ProvinceCode, number>();
  const seen = new Set<string>();
  let offset = 0;
  let total: number | undefined;
  do {
    signal.throwIfAborted();
    const page = await fetchCaseList({ solarTermId, offset, limit: 20 }, signal, fetcher);
    if ((total !== undefined && page.total !== total) || offset + page.items.length > page.total || (page.items.length === 0 && offset < page.total)) {
      throw new Error("案例数据正在更新，无法完整确定对应地区，请重新查找。");
    }
    total = page.total;
    for (const item of page.items) {
      if (seen.has(item.id)) throw new Error("案例分页数据重复，请重新查找对应地区。");
      seen.add(item.id);
      counts.set(item.provinceCode, (counts.get(item.provinceCode) ?? 0) + 1);
    }
    offset += page.items.length;
  } while (offset < total);
  // Publish only a complete, validated aggregation, never a partial first page.
  return counts;
}
