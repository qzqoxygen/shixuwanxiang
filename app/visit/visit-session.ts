import { z } from "zod";
import { VisitMemoryCardSchema, VisitResultSchema, type VisitQuery } from "@/lib/solar-visit";
import { visitHref } from "@/lib/visit-links";

const entry = z.object({
  result: VisitResultSchema.optional(),
  memory: z.string().max(240).optional(),
  card: VisitMemoryCardSchema.optional(),
});
type Entry = z.infer<typeof entry>;
const KEY = "shixu.visit.session";

export function readVisitSnapshot() {
  try { return sessionStorage.getItem(KEY); } catch { return null; }
}

function entries(snapshot: string | null) {
  try { return z.record(z.string(), entry).parse(JSON.parse(snapshot ?? "{}")); }
  catch { return {}; }
}

export function readVisitEntry(snapshot: string | null, query: VisitQuery): Entry | undefined {
  return entries(snapshot)[visitHref(query)];
}

export function saveVisitEntry(query: VisitQuery, update: Entry) {
  const key = visitHref(query);
  const cache = entries(readVisitSnapshot());
  const value = { ...cache[key], ...update };
  delete cache[key];
  try { sessionStorage.setItem(KEY, JSON.stringify(Object.fromEntries([...Object.entries(cache).slice(-5), [key, value]]))); }
  catch { /* The current page still works if storage is unavailable. */ }
}
