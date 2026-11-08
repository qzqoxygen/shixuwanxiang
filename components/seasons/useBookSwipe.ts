"use client";

import { useEffect, useRef, type PointerEvent, type MouseEvent } from "react";
import { finishBookSwipe, moveBookSwipe, type BookSwipe } from "@/lib/book-swipe";

export function useBookSwipe(onTurn: (delta: number) => void) {
  const gesture = useRef<BookSwipe | null>(null);
  const blockedClickUntil = useRef(0);

  useEffect(() => {
    const cancel = () => { gesture.current = null; };
    window.addEventListener("resize", cancel);
    window.addEventListener("blur", cancel);
    document.addEventListener("visibilitychange", cancel);
    return () => {
      window.removeEventListener("resize", cancel);
      window.removeEventListener("blur", cancel);
      document.removeEventListener("visibilitychange", cancel);
      gesture.current = null;
    };
  }, []);

  return {
    onPointerDown(event: PointerEvent<HTMLDivElement>) {
      blockedClickUntil.current = 0;
      if (!event.isPrimary) { gesture.current = null; return; }
      const target = event.target as HTMLElement;
      if (event.button !== 0 || target.closest("button,input,textarea,select,[contenteditable],a:not(.seasons-photo-open)")) return;
      // Mouse drags belong to the photo, leaving prose selectable. Touch/pen can
      // swipe anywhere on the sheet, with native vertical scrolling retained.
      if (event.pointerType === "mouse" && !target.closest(".seasons-photo-open")) return;
      gesture.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, width: event.currentTarget.clientWidth, started: Date.now(), axis: "pending" };
    },
    onPointerMove(event: PointerEvent<HTMLDivElement>) {
      const active = gesture.current;
      if (!active || active.pointerId !== event.pointerId) return;
      gesture.current = moveBookSwipe(active, event.clientX, event.clientY);
      if (gesture.current.axis === "horizontal") {
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.setPointerCapture(event.pointerId);
        if (event.cancelable) event.preventDefault();
      }
    },
    onPointerUp(event: PointerEvent<HTMLDivElement>) {
      const active = gesture.current;
      gesture.current = null;
      if (!active || active.pointerId !== event.pointerId) return;
      const result = finishBookSwipe(active, event.clientX, event.clientY, Date.now());
      if (result.suppressClick) blockedClickUntil.current = Date.now() + 500;
      if (result.delta) onTurn(result.delta);
    },
    onPointerCancel() { gesture.current = null; },
    onLostPointerCapture() { gesture.current = null; },
    onPointerLeave(event: PointerEvent<HTMLDivElement>) {
      if (event.pointerType === "mouse" && !event.currentTarget.hasPointerCapture(event.pointerId)) gesture.current = null;
    },
    onClickCapture(event: MouseEvent<HTMLDivElement>) {
      if (event.detail > 0 && Date.now() < blockedClickUntil.current) {
        blockedClickUntil.current = 0;
        event.preventDefault();
        event.stopPropagation();
      }
    },
  };
}
