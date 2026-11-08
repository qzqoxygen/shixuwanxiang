import "./register-ts.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";
const { INITIAL_BOOK, bookReducer } = await import("../lib/book-navigation.ts");
const { startBookTurn } = await import("../lib/book-turn-animation.ts");

const step = (state, delta, animate = true) => bookReducer(state, { type: "step", delta, animate });

test("a spread is committed only after its matching turn completes", () => {
  const turning = step(INITIAL_BOOK, 1);
  assert.equal(turning.index, 0);
  assert.equal(turning.turn.from, 0);
  assert.equal(turning.turn.to, 1);
  const done = bookReducer(turning, { type: "complete", serial: turning.turn.serial });
  assert.equal(done.index, 1);
  assert.equal(done.turn, null);
  const backward = step(done, -1);
  assert.equal(backward.turn.direction, -1);
  assert.equal(bookReducer(backward, { type: "complete", serial: backward.turn.serial }).index, 0);
});

test("a pending request cannot replace the active paper or create an unlimited queue", () => {
  const first = step(INITIAL_BOOK, 1);
  let pending = first;
  for (let i = 0; i < 12; i++) pending = step(pending, 1);
  assert.equal(pending.turn, first.turn);
  assert.equal(pending.requested, 13);
  const following = bookReducer(pending, { type: "complete", serial: first.turn.serial });
  assert.equal(following.index, 1);
  assert.equal(following.turn.to, 13);
  assert.equal(bookReducer(following, { type: "complete", serial: following.turn.serial }).turn, null);
});

test("late completion and cancellation cannot settle a newer active turn", () => {
  const old = step(INITIAL_BOOK, 1);
  const settled = bookReducer(old, { type: "settle" });
  const newer = step(settled, 1);
  for (const type of ["complete", "recover"]) {
    assert.equal(bookReducer(newer, { type, serial: old.turn.serial }), newer);
  }
});

test("recovery commits the latest destination; no-motion and boundaries remain usable", () => {
  const active = step(INITIAL_BOOK, 1);
  const pending = step(active, 1);
  const recovered = bookReducer(pending, { type: "recover", serial: active.turn.serial });
  assert.equal(recovered.index, 2);
  assert.equal(recovered.turn, null);
  assert.equal(step(INITIAL_BOOK, -1).turn, null);
  assert.equal(bookReducer(recovered, { type: "go", index: 99, animate: false }).index, 23);
  const instant = step(pending, -1, false);
  assert.equal(instant.index, 1);
  assert.equal(instant.turn, null);
});

test("cross-season jumps and reversed input retain one paper and settle at the last selected term", () => {
  const first = bookReducer(INITIAL_BOOK, { type: "go", index: 23, animate: true });
  let state = step(first, -1);
  state = bookReducer(state, { type: "go", index: 6, animate: true });
  state = step(state, 1);
  state = bookReducer(state, { type: "go", index: 12, animate: true });
  assert.equal(state.turn, first.turn);
  assert.equal(state.requested, 12);
  state = bookReducer(state, { type: "complete", serial: first.turn.serial });
  assert.equal(state.index, 23);
  assert.equal(state.turn.to, 12);
  assert.equal(state.turn.direction, -1);
  assert.equal(bookReducer(state, { type: "recover", serial: first.turn.serial }), state);
  state = bookReducer(state, { type: "complete", serial: state.turn.serial });
  assert.equal(state.index, 12);
  assert.equal(state.requested, 12);
  assert.equal(state.turn, null);
});

test("selecting the original term while turning returns to it without leaving an active paper", () => {
  const first = step(INITIAL_BOOK, 1);
  const requested = bookReducer(first, { type: "go", index: 0, animate: true });
  const returning = bookReducer(requested, { type: "complete", serial: first.turn.serial });
  assert.equal(returning.turn.from, 1);
  assert.equal(returning.turn.to, 0);
  assert.equal(returning.turn.direction, -1);
  const finished = bookReducer(returning, { type: "complete", serial: returning.turn.serial });
  assert.equal(finished.index, 0);
  assert.equal(finished.turn, null);
});

test("all 24 by 24 directory destinations finish on the exact requested term", () => {
  for (let from = 0; from < 24; from++) {
    const base = bookReducer(INITIAL_BOOK, { type: "go", index: from, animate: false });
    for (let to = 0; to < 24; to++) {
      let state = bookReducer(base, { type: "go", index: to, animate: true });
      if (state.turn) state = bookReducer(state, { type: "complete", serial: state.turn.serial });
      assert.equal(state.index, to);
      assert.equal(state.requested, to);
      assert.equal(state.turn, null);
    }
  }
});

function fakeAnimation() {
  let resolve, reject, cancelled = 0;
  const finished = new Promise((ok, fail) => { resolve = ok; reject = fail; });
  return { finished, resolve, reject, cancel: () => { cancelled++; reject(new Error("cancelled")); }, get cancelled() { return cancelled; } };
}
const flush = () => new Promise(resolve => queueMicrotask(resolve));

test("successful animation preserves its final pose until disposal, then cancels once", async () => {
  const animation = fakeAnimation();
  const events = [];
  let frames;
  const dispose = startBookTurn({ animate: keyframes => { frames = keyframes; return animation; } }, -1, {
    complete: () => events.push("complete"), recover: () => events.push("recover"),
  });
  assert.equal(frames[1].transform, "rotateY(180deg)");
  animation.resolve();
  await flush();
  assert.deepEqual(events, ["complete"]);
  assert.equal(animation.cancelled, 0);
  dispose();
  await flush();
  assert.equal(animation.cancelled, 1);
  assert.deepEqual(events, ["complete"]);
});

test("cancelled, throwing and unsupported animations recover without uncaught errors", async () => {
  const animation = fakeAnimation();
  const leaves = [null, { animate: () => { throw new Error("unsupported"); } }, { animate: () => animation }];
  for (const leaf of leaves) {
    const events = [];
    const dispose = startBookTurn(leaf, 1, { complete: () => events.push("complete"), recover: () => events.push("recover") });
    if (leaf === leaves[2]) animation.reject(new Error("interrupted"));
    await flush();
    assert.deepEqual(events, ["recover"]);
    dispose();
  }
});

test("unmount cancels the animation and suppresses every late callback", async () => {
  const animation = fakeAnimation();
  const events = [];
  const dispose = startBookTurn({ animate: () => animation }, 1, { complete: () => events.push("complete"), recover: () => events.push("recover") });
  dispose();
  await flush();
  animation.resolve();
  await flush();
  assert.deepEqual(events, []);
  assert.equal(animation.cancelled, 1);
});

test("watchdog releases a never-finishing animation and ignores its eventual result", async () => {
  const animation = fakeAnimation();
  const events = [];
  let recovered;
  const recoveredPromise = new Promise(resolve => { recovered = resolve; });
  const dispose = startBookTurn({ animate: () => animation }, 1, {
    complete: () => events.push("complete"), recover: () => { events.push("recover"); recovered(); },
  }, 0);
  await recoveredPromise;
  animation.resolve();
  await flush();
  assert.deepEqual(events, ["recover"]);
  dispose();
});
