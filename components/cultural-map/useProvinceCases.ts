"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchProvinceCaseCounts } from "@/lib/cultural-case-client";
import type { ProvinceCode, SolarTermId } from "@/lib/contracts/cultural-case";

export type ProvinceCases =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; counts: ReadonlyMap<ProvinceCode, number> }
  | { status: "error"; message: string };

export function useProvinceCases(solarTermId: SolarTermId | null) {
  const [attempt, setAttempt] = useState(0);
  // Identity distinguishes A → B → A as well as retries. Old results disappear
  // in the switching render, rather than waiting for a later effect to clear them.
  const request = useMemo(() => ({ solarTermId, attempt }), [solarTermId, attempt]);
  const [snapshot, setSnapshot] = useState<{ request: typeof request; resource: ProvinceCases } | null>(null);

  useEffect(() => {
    if (!request.solarTermId) return;
    const controller = new AbortController();
    let active = true;
    const timeout = setTimeout(() => controller.abort(), 15_000);
    fetchProvinceCaseCounts(request.solarTermId, controller.signal).then(counts => {
      if (active) setSnapshot({ request, resource: { status: "success", counts } });
    }).catch(error => {
      if (!active) return;
      const message = controller.signal.aborted ? "匹配地区查询超时，请重试。" : error instanceof TypeError ? "暂时无法查询匹配地区，请检查网络后重试。" : error instanceof Error ? error.message : "匹配地区查询失败，请重试。";
      setSnapshot({ request, resource: { status: "error", message } });
    }).finally(() => clearTimeout(timeout));
    return () => { active = false; clearTimeout(timeout); controller.abort(); };
  }, [request]);

  const resource: ProvinceCases = !solarTermId ? { status: "idle" } : snapshot?.request === request ? snapshot.resource : { status: "loading" };
  return { resource, retry: () => setAttempt(value => value + 1) };
}
