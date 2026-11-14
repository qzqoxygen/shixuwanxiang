export const chapters = {
  spring: { label: "春", term: "清明", landscape: "spring-garden-boat", plant: "spring-branch" },
  summer: { label: "夏", term: "夏至", landscape: "summer-pond", plant: null },
  autumn: { label: "秋", term: "白露", landscape: "autumn-garden", plant: "autumn-maple" },
  winter: { label: "冬", term: "小寒", landscape: "winter-garden", plant: "winter-plum" },
} as const;

export type GardenSeason = keyof typeof chapters;
export const gardenSeasons = Object.keys(chapters) as GardenSeason[];
