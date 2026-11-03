import { parseCaseListQuery } from "@/lib/contracts/cultural-case";
import { readCulturalCases } from "@/lib/server/cultural-cases";
import { queryCulturalCases } from "@/lib/server/cultural-case-query";
import { culturalCaseFailure } from "@/lib/server/cultural-case-response";

export async function GET(request: Request) {
  let query;
  try { query = parseCaseListQuery(new URL(request.url).searchParams); }
  catch { return culturalCaseFailure("INVALID_INPUT"); }

  try {
    return Response.json(queryCulturalCases(readCulturalCases(), query), { headers: { "Cache-Control": "no-store" } });
  } catch { return culturalCaseFailure("INTERNAL_ERROR"); }
}
