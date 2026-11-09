import { useCallback, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { STUDIO_DRAFT_KEY, type StudioDraft } from "@/lib/studio-draft";

const subscribe = () => () => {};
const serverSnapshot = () => undefined;
function readSnapshot() {
  try { return window.localStorage.getItem(STUDIO_DRAFT_KEY); } catch { return null; }
}

export function useInitialStudioDraft() {
  // Wait until the stored draft has been read before making the editor interactive.
  return useSyncExternalStore(subscribe, readSnapshot, serverSnapshot);
}

type Status = "idle" | "saved" | "error";

export function useStudioDraft(draft: StudioDraft, restored: boolean) {
  const snapshot = JSON.stringify(draft);
  const latest = useRef(snapshot);
  const changed = useRef(false);
  const persisted = useRef({ snapshot, status: restored ? "saved" as const : "idle" as const });
  const [result, setResult] = useState<{ snapshot: string; status: Status }>({ snapshot, status: restored ? "saved" : "idle" });

  const flush = useCallback((): Status => {
    if (latest.current === persisted.current.snapshot) return persisted.current.status;
    try {
      window.localStorage.setItem(STUDIO_DRAFT_KEY, latest.current);
      persisted.current = { snapshot: latest.current, status: "saved" };
      return "saved";
    } catch { return "error"; }
  }, []);

  useLayoutEffect(() => {
    if (latest.current !== snapshot) changed.current = true;
    latest.current = snapshot;
    if (!changed.current) return;
    const timer = window.setTimeout(() => setResult({ snapshot, status: flush() }), 240);
    return () => window.clearTimeout(timer);
  }, [flush, snapshot]);

  useLayoutEffect(() => {
    function onHide() {
      if (document.visibilityState === "hidden") flush();
    }
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onHide);
      flush();
    };
  }, [flush]);

  return result.snapshot === snapshot ? result.status : "saving";
}
