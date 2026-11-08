export type BookSwipe = {
  pointerId: number;
  x: number;
  y: number;
  width: number;
  started: number;
  axis: "pending" | "horizontal" | "vertical";
};

export function moveBookSwipe(swipe: BookSwipe, x: number, y: number): BookSwipe {
  if (swipe.axis !== "pending") return swipe;
  const horizontal = Math.abs(x - swipe.x);
  const vertical = Math.abs(y - swipe.y);
  if (Math.max(horizontal, vertical) < 10) return swipe;
  // Lock ambiguous diagonal movement to reading/scrolling, never to turning.
  return { ...swipe, axis: horizontal > vertical * 1.35 ? "horizontal" : "vertical" };
}

export function finishBookSwipe(swipe: BookSwipe, x: number, y: number, now: number) {
  const final = moveBookSwipe(swipe, x, y);
  const dx = x - swipe.x;
  const dy = y - swipe.y;
  const suppressClick = Math.max(Math.abs(dx), Math.abs(dy)) >= 10;
  const threshold = Math.min(100, Math.max(48, swipe.width * .18));
  const elapsed = now - swipe.started;
  const accepted = final.axis === "horizontal" && Math.abs(dx) >= threshold && Math.abs(dx) > Math.abs(dy) * 1.35 && elapsed >= 0 && elapsed <= 1200;
  return { delta: accepted ? (dx < 0 ? 1 : -1) : 0, suppressClick };
}
