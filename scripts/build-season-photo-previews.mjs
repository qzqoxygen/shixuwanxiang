import { readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { SEASON_PHOTO_PREVIEW_WIDTHS } from "../lib/season-photo-preview.ts";

const directory = new URL("../public/images/solar-terms/", import.meta.url);
const originals = (await readdir(directory)).filter(name => name.endsWith("-hd.webp"));

for (const name of originals) {
  const source = fileURLToPath(new URL(name, directory));
  for (const width of SEASON_PHOTO_PREVIEW_WIDTHS) {
    const preview = fileURLToPath(new URL(name.replace("-hd.webp", `-${width}.webp`), directory));
    await sharp(source).resize({ width }).webp({ quality: 79, effort: 5 }).toFile(preview);
  }
}
