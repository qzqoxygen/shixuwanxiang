import { readFile, writeFile } from "node:fs/promises";
import { geometryToPath, projectMainMap, projectMapInset } from "../lib/map-projection.ts";

const input = new URL("../data/maps/china-provinces.geo.json", import.meta.url);
const geometryFile = new URL("../public/images/china-province-geometry.svg", import.meta.url);
const labelsFile = new URL("../data/maps/province-labels.json", import.meta.url);
const { features } = JSON.parse(await readFile(input, "utf8"));

// Move crowded labels and keep their original geographic anchors.
const labelOffsets = {
  "110000": [-10, -19],
  "120000": [30, -4],
  "310000": [30, 2],
  "130000": [8, -4],
  "140000": [-4, 0],
  "320000": [9, 0],
  "340000": [-4, 0],
  "460000": [-12, 8],
  "810000": [25, 22],
  "820000": [7, 46],
};

function path(geometry, project, id) {
  return `<path${id ? ` id="${id}"` : ""} fill-rule="evenodd" vector-effect="non-scaling-stroke" d="${geometryToPath(geometry, project)}"/>`;
}

function overlapsInset(geometry) {
  const rings = geometry.type === "Polygon" ? geometry.coordinates : geometry.coordinates.flat();
  return rings.some(ring => {
    let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity;
    for (const point of ring) {
      const [x, y] = projectMapInset(point);
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
    // Keep the entire geometry when it can touch the inset, including the stroke.
    return left <= 811 && right >= 699 && top <= 527 && bottom >= 375;
  });
}

const provinces = features.filter(({ properties }) => /^\d{6}$/.test(String(properties.adcode)));
const maritime = features.filter(({ properties }) => !properties.name);
const main = provinces.map(({ properties, geometry }) => path(geometry, projectMainMap, `shape-${properties.adcode}`));
const inset = features.filter(({ geometry }) => overlapsInset(geometry));
const insetGroup = (id, find) => `<g id="${id}">${inset.filter(find).map(({ geometry }) => path(geometry, projectMapInset)).join("")}</g>`;
const svg = [
  '<svg xmlns="http://www.w3.org/2000/svg">',
  "<defs>",
  ...main,
  `<g id="main-maritime">${maritime.map(({ geometry }) => path(geometry, projectMainMap)).join("")}</g>`,
  insetGroup("inset-provinces", ({ properties }) => !!properties.name),
  insetGroup("inset-maritime", ({ properties }) => !properties.name),
  "</defs>",
  "</svg>",
  "",
].join("\n");

const labels = provinces.map(({ properties }) => {
  const id = String(properties.adcode);
  const name = properties.name;
  const shortName = name.replace(/维吾尔自治区|壮族自治区|回族自治区|特别行政区|自治区|省|市/g, "");
  const anchor = projectMainMap(properties.centroid ?? properties.center);
  const [dx, dy] = labelOffsets[id] ?? [0, 0];
  return { id, name, shortName, anchor, label: [anchor[0] + dx, anchor[1] + dy] };
});

for (const [file, content] of [[geometryFile, svg], [labelsFile, `[\n${labels.map(label => `  ${JSON.stringify(label)}`).join(",\n")}\n]\n`]]) {
  if (process.argv.includes("--check")) {
    if ((await readFile(file, "utf8")).replaceAll("\r\n", "\n") !== content) {
      throw new Error(`Map asset is out of date: ${file.pathname}`);
    }
  } else {
    await writeFile(file, content);
  }
}
