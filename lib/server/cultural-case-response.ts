import type { ApiFailure } from "../contracts/cultural-case";

export function culturalCaseFailure(code: "INVALID_INPUT" | "CASE_NOT_FOUND" | "INTERNAL_ERROR") {
  const failures = {
    INVALID_INPUT: { status: 400, message: "案例查询参数无效，请检查后重试。" },
    CASE_NOT_FOUND: { status: 404, message: "未找到可公开的文化案例。" },
    INTERNAL_ERROR: { status: 500, message: "文化案例暂时无法读取，请稍后重试。" },
  };
  const { status, message } = failures[code];
  const body: ApiFailure = { version: "1.0", answer: null, truncated: false, error: { code, message } };
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
