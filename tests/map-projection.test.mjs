import "./register-ts.mjs";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
const { createMapProjection, geometryToPath } = await import("../lib/map-projection.ts");
const data = JSON.parse(readFileSync(new URL("../data/maps/china-provinces.geo.json", import.meta.url), "utf8"));

test("map data retains 34 unique province IDs, Taiwan, Hong Kong, Macao and maritime geometry", () => {
  const provinces = data.features.filter(f => /^\d{6}$/.test(String(f.properties.adcode)));
  const ids = provinces.map(f => String(f.properties.adcode));
  assert.equal(provinces.length, 34);
  assert.equal(new Set(ids).size, 34);
  for (const id of ["710000", "810000", "820000", "460000"]) assert.ok(ids.includes(id));
  assert.ok(data.features.find(f => f.properties.adcode === "100000_JD"));
});

test("projection preserves east-west and north-south ordering and fits bounds", () => {
  const project = createMapProjection([73, 17, 136, 54], [24, 28, 792, 478]);
  const northwest = project([73, 54]), southeast = project([136, 17]);
  assert.ok(northwest[0] >= 24 && northwest[1] >= 28);
  assert.ok(southeast[0] <= 816.001 && southeast[1] <= 506.001);
  assert.ok(project([120, 35])[0] > project([100, 35])[0]);
  assert.ok(project([110, 40])[1] < project([110, 30])[1]);
  assert.throws(() => createMapProjection([73, 17, 136, 90], [0, 0, 10, 10]));
});

test("all source geometries produce finite closed paths in both views, including polygon holes", () => {
  const views = [createMapProjection([73, 17, 136, 54], [24, 28, 792, 478]), createMapProjection([105, 2, 125, 25], [700, 376, 110, 150])];
  for (const project of views) for (const feature of data.features) {
    const path = geometryToPath(feature.geometry, project);
    assert.match(path, /^M/);
    assert.match(path, /Z$/);
    assert.doesNotMatch(path, /NaN|Infinity/);
  }
  const path = geometryToPath({ type: "Polygon", coordinates: [[[0,0],[4,0],[4,4],[0,0]], [[1,1],[2,1],[1,2],[1,1]]] }, p => p);
  assert.equal((path.match(/M/g) ?? []).length, 2);
  assert.equal((path.match(/Z/g) ?? []).length, 2);
});
