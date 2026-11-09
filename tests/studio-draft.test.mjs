import "./register-ts.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";

const { parseStudioDraft } = await import("../lib/studio-draft.ts");
const snapshot = {
  version: 1, termId: "dongzhi", templateId: "bookmark", paletteId: "ochre", decoration: "double",
  title: "", line: "窗前一枝梅。", date: { x: 63, y: 18, size: 132, angle: 345 },
  stickers: [{ id: 4, assetId: "peach-blossom", mirrored: true, x: 46.1, y: 70.2, size: 35, angle: 42 }],
};

test("draft round trip preserves intentional blanks, layer transforms and an empty sticker list", () => {
  assert.deepEqual(parseStudioDraft(JSON.stringify(snapshot)), snapshot);
  assert.deepEqual(parseStudioDraft(JSON.stringify({ ...snapshot, stickers: [] })).stickers, []);
});

test("bad data cannot break the editor or replace valid layers in a draft", () => {
  assert.equal(parseStudioDraft("{ interrupted"), null);
  assert.equal(parseStudioDraft(JSON.stringify({ ...snapshot, version: 2 })), null);
  assert.equal(parseStudioDraft(JSON.stringify({ ...snapshot, templateId: "constructor" })), null);
  const [valid] = snapshot.stickers;
  const mixed = { ...snapshot, date: { ...snapshot.date, x: -1 }, stickers: [
    { ...valid, id: 7, size: 1e30 }, valid, { ...valid, x: 5 },
  ] };
  const restored = parseStudioDraft(JSON.stringify(mixed));
  assert.equal(restored.date, null);
  assert.deepEqual(restored.stickers, [valid]);
});
