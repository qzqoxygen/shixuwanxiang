import { SOLAR_TERM_PHOTOS, type SolarTermPhoto } from "@/lib/solar-term-photos";

type EditorialPhoto = Pick<SolarTermPhoto, "src" | "caption" | "credit"> & (
  Pick<SolarTermPhoto, "sourceUrl" | "license" | "licenseUrl"> |
  { sourceUrl?: never; license?: never; licenseUrl?: never }
);

export const editorialPhotos = {
  canola: SOLAR_TERM_PHOTOS.chunfen,
  lotus: {
    src: "/images/home/editorial-white-lotus.webp",
    caption: "圆明园里一朵盛开的白荷",
    credit: "摄影：RebexArt",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:White_lotus.jpg",
    license: "CC BY-SA 3.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0/",
  },
  harvest: {
    src: "/images/home/editorial-liaoning-field.webp",
    caption: "辽宁的金黄田野、树木与远山",
    credit: "用户提供，原图标注小红书号 948433430",
  },
  snow: {
    src: "/images/home/editorial-forbidden-city-snow.webp",
    caption: "雪中的故宫午门和红墙",
    credit: "摄影：shizhao",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Forbidden_City_in_snow.jpg",
    license: "CC BY-SA 2.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/2.0/",
  },
  plum: SOLAR_TERM_PHOTOS.lichun,
  ritan: {
    src: "/images/home/editorial-ritan-gate.webp",
    caption: "北京日坛公园西天门，松枝掩映着红墙拱门",
    credit: "摄影：Dirrival",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:West_Holy_Gate_(Temple_of_the_Sun).JPG",
    license: "CC BY-SA 3.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0/",
  },
} satisfies Record<string, EditorialPhoto>;

export const editorialPhotoCredits: EditorialPhoto[] = Object.values(editorialPhotos);
