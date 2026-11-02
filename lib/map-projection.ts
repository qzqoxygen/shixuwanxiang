export type MapPoint = readonly [number, number];
export type MapGeometry =
  | { type: "Polygon"; coordinates: readonly (readonly MapPoint[])[] }
  | { type: "MultiPolygon"; coordinates: readonly (readonly (readonly MapPoint[])[])[] };

export interface ProvinceFeature {
  properties: {
    adcode: number | string;
    name?: string;
    center?: MapPoint;
    centroid?: MapPoint;
  };
  geometry: MapGeometry;
}

// A small, dependency-free Mercator projection. Bounds and viewport are explicit
// so the main map and South China Sea inset use the same untouched coordinates.
export function createMapProjection(
  bounds: readonly [west: number, south: number, east: number, north: number],
  viewport: readonly [x: number, y: number, width: number, height: number],
) {
  const [west, south, east, north] = bounds;
  const [x, y, width, height] = viewport;
  if (![...bounds, ...viewport].every(Number.isFinite) || west >= east || south >= north || south <= -85 || north >= 85 || width <= 0 || height <= 0) {
    throw new Error("Invalid map projection bounds or viewport");
  }
  const radians = Math.PI / 180;
  const mercatorY = (latitude: number) => Math.log(Math.tan(Math.PI / 4 + latitude * radians / 2));
  const left = west * radians;
  const top = mercatorY(north);
  const spanX = (east - west) * radians;
  const spanY = top - mercatorY(south);
  const scale = Math.min(width / spanX, height / spanY);
  const offsetX = x + (width - spanX * scale) / 2;
  const offsetY = y + (height - spanY * scale) / 2;
  return ([longitude, latitude]: MapPoint): MapPoint => [
    offsetX + (longitude * radians - left) * scale,
    offsetY + (top - mercatorY(latitude)) * scale,
  ];
}

export function geometryToPath(geometry: MapGeometry, project: (point: MapPoint) => MapPoint): string {
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  return polygons.map((polygon) => polygon.map((ring) => ring.map((point, index) => {
    const [x, y] = project(point);
    return `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
  }).join("") + "Z").join("")).join("");
}
