"use client";

import { useEffect, useState } from "react";

type Resource<T> = { status: "loading" } | { status: "success"; data: T } | { status: "error"; message: string };

// Key each result view by its selection so an older request cannot replace it.
export function useCaseRequest<T>(load: (signal: AbortSignal) => Promise<T>) {
  const [resource, setResource] = useState<Resource<T>>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const timeout = setTimeout(() => controller.abort(), 15_000);
    load(controller.signal).then(data => {
      if (active) setResource({ status: "success", data });
    }).catch(error => {
      if (!active) return;
      const message = controller.signal.aborted ? "案例请求超时，请重试。" : error instanceof TypeError ? "网络连接异常，请检查网络后重试。" : error instanceof Error ? error.message : "案例暂时无法读取，请重试。";
      setResource({ status: "error", message });
    }).finally(() => clearTimeout(timeout));
    return () => { active = false; clearTimeout(timeout); controller.abort(); };
  }, [load, attempt]);
  return { resource, retry: () => { setResource({ status: "loading" }); setAttempt(value => value + 1); } };
}
