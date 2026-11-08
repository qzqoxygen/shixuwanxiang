export const BOOK_TURN_DURATION = 820;
export const BOOK_SLIDE_DURATION = 380;

type Callbacks = { complete: () => void; recover: () => void };

// One animation owns its completion and watchdog. Disposal never commits state.
function startBookAnimation(
  leaf: Pick<HTMLElement, "animate"> | null,
  frames: Keyframe[],
  callbacks: Callbacks,
  duration: number,
) {
  let disposed = false;
  let settled = false;
  let animation: Animation | undefined;
  const finish = (success: boolean) => {
    if (disposed || settled) return;
    settled = true;
    clearTimeout(watchdog);
    if (success) callbacks.complete();
    else callbacks.recover();
  };
  const watchdog = setTimeout(() => finish(false), duration + 300);
  try {
    if (!leaf?.animate) queueMicrotask(() => finish(false));
    else {
      animation = leaf.animate(
        frames,
        { duration, easing: "cubic-bezier(.45,.02,.25,1)", fill: "forwards" },
      );
      animation.finished.then(() => finish(true), () => finish(false));
    }
  } catch {
    queueMicrotask(() => finish(false));
  }
  return () => {
    disposed = true;
    clearTimeout(watchdog);
    // Keep the final pose until React commits the new base and removes the leaf.
    try { animation?.cancel(); } catch { /* A detached animation may already be gone. */ }
  };
}

export function startBookTurn(leaf: Pick<HTMLElement, "animate"> | null, direction: 1 | -1, callbacks: Callbacks, duration = BOOK_TURN_DURATION) {
  return startBookAnimation(leaf, [{ transform: "rotateY(0deg)" }, { transform: `rotateY(${-direction * 180}deg)` }], callbacks, duration);
}

export function startBookSlide(track: Pick<HTMLElement, "animate"> | null, direction: 1 | -1, callbacks: Callbacks, duration = BOOK_SLIDE_DURATION) {
  return startBookAnimation(track, [{ transform: "translateX(0%)" }, { transform: `translateX(${-direction * 100}%)` }], callbacks, duration);
}
