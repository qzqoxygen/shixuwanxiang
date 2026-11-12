import type { CaseListQuery, CaseListResponse, CulturalCase, VerifiedCulturalCase } from "../contracts/cultural-case";

function isVerified(item: CulturalCase): item is VerifiedCulturalCase {
  return item.verificationStatus === "verified";
}

export function queryCulturalCases(cases: readonly CulturalCase[], query: CaseListQuery): CaseListResponse {
  const keyword = query.keyword?.toLowerCase();
  const matches = cases.filter(isVerified).filter((item) =>
    (!query.solarTermId || item.solarTermIds.includes(query.solarTermId)) &&
    (!query.provinceCode || item.provinceCode === query.provinceCode || item.relatedProvinceCodes?.includes(query.provinceCode)) &&
    (!query.category || item.category === query.category) &&
    (!keyword || [item.title, item.regionName, item.description, item.relationNote].some((value) => value.toLowerCase().includes(keyword))),
  ).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  return { version: "1.0", items: matches.slice(query.offset, query.offset + query.limit), total: matches.length, offset: query.offset, limit: query.limit };
}

export function findVerifiedCulturalCase(cases: readonly CulturalCase[], caseId: string): VerifiedCulturalCase | undefined {
  return cases.filter(isVerified).find((item) => item.id === caseId);
}
