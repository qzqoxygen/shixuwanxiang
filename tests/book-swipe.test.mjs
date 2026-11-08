import "./register-ts.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";
const { moveBookSwipe, finishBookSwipe } = await import("../lib/book-swipe.ts");
const { startBookSlide, BOOK_SLIDE_DURATION } = await import("../lib/book-turn-animation.ts");
const start = (width = 328) => ({ pointerId: 7, x: 200, y: 100, width, started: 1000, axis: "pending" });

test("horizontal swipes turn in both directions only after the width-aware threshold", () => {
  assert.equal(finishBookSwipe(start(), 130, 104, 1300).delta, 1);
  assert.equal(finishBookSwipe(start(), 270, 96, 1300).delta, -1);
  assert.equal(finishBookSwipe(start(), 150, 100, 1300).delta, 0);
  assert.equal(finishBookSwipe(start(1000), 105, 100, 1300).delta, 0);
  assert.equal(finishBookSwipe(start(1000), 95, 100, 1300).delta, 1);
});

test("vertical scroll and diagonal movement never become a turn after the axis is locked", () => {
  const scrolling = moveBookSwipe(start(), 203, 125);
  assert.equal(scrolling.axis, "vertical");
  assert.equal(finishBookSwipe(scrolling, 70, 130, 1500).delta, 0);
  assert.equal(finishBookSwipe(start(), 100, 190, 1500).delta, 0);
  const horizontal = moveBookSwipe(start(), 180, 102);
  assert.equal(horizontal.axis, "horizontal");
  assert.equal(finishBookSwipe(horizontal, 120, 190, 1500).delta, 0);
});

test("taps keep photo links, drags suppress their click, and long holds do not turn", () => {
  assert.deepEqual(finishBookSwipe(start(), 201, 103, 1100), { delta: 0, suppressClick: false });
  assert.deepEqual(finishBookSwipe(start(), 175, 103, 1200), { delta: 0, suppressClick: true });
  assert.equal(finishBookSwipe(start(), 80, 100, 2400).delta, 0);
  assert.equal(finishBookSwipe(start(), 80, 100, 900).delta, 0);
});

test("mobile slide uses the same serial-safe animation lifecycle and a horizontal track", async () => {
  for (const direction of [1, -1]) {
    let frames, options, resolve, cancelled = 0, completed = 0, recovered = 0;
    const finished = new Promise(done => { resolve = done; });
    const dispose = startBookSlide({ animate: (f, o) => { frames = f; options = o; return { finished, cancel: () => { cancelled++; } }; } }, direction, { complete: () => completed++, recover: () => recovered++ });
    assert.equal(frames[1].transform, `translateX(${-direction * 100}%)`);
    assert.equal(options.duration, BOOK_SLIDE_DURATION);
    resolve();
    await new Promise(done => queueMicrotask(done));
    assert.equal(completed, 1);
    assert.equal(recovered, 0);
    dispose();
    assert.equal(cancelled, 1);
  }
});

test("leaving the mobile layout settles the last request and discards a late slide result", async () => {
  const { INITIAL_BOOK, bookReducer } = await import("../lib/book-navigation.ts");
  let state = bookReducer(INITIAL_BOOK, { type: "step", delta: 1, animate: true });
  const serial = state.turn.serial;
  let resolve;
  const finished = new Promise(done => { resolve = done; });
  const dispose = startBookSlide({ animate: () => ({ finished, cancel() {} }) }, 1, {
    complete: () => { state = bookReducer(state, { type: "complete", serial }); },
    recover: () => { state = bookReducer(state, { type: "recover", serial }); },
  });
  state = bookReducer(state, { type: "go", index: 18, animate: true });
  state = bookReducer(state, { type: "settle" });
  dispose();
  const settled = state;
  resolve();
  await new Promise(done => queueMicrotask(done));
  assert.equal(state, settled);
  assert.equal(state.index, 18);
  assert.equal(state.turn, null);
});
