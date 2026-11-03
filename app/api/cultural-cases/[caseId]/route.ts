import { CulturalCaseIdSchema, type CaseDetailResponse } from "@/lib/contracts/cultural-case";
import { readCulturalCases } from "@/lib/server/cultural-cases";
import { findVerifiedCulturalCase } from "@/lib/server/cultural-case-query";
import { culturalCaseFailure } from "@/lib/server/cultural-case-response";

export async function GET(_request: Request, { params }: { params: Promise<{ caseId: string }> }) {
  try {
    // Next.js decodes dynamic params once; do not decode again or use IDs as paths.
    const result = CulturalCaseIdSchema.safeParse((await params).caseId);
    if (!result.success) return culturalCaseFailure("INVALID_INPUT");
    const item = findVerifiedCulturalCase(readCulturalCases(), result.data);
    if (!item) return culturalCaseFailure("CASE_NOT_FOUND");
    const body: CaseDetailResponse = { version: "1.0", item };
    return Response.json(body, { headers: { "Cache-Control": "no-store" } });
  } catch { return culturalCaseFailure("INTERNAL_ERROR"); }
}
