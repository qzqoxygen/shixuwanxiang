import type { SolarTermId } from "./solar-terms";

export const STUDIO_CALENDAR_YEAR = 2026;
// Lunar month and day of each solar term in the 2026 Gregorian year (UTC+8).
// Source: https://www.hko.gov.hk/tc/gts/time/calendar/text/files/T2026c.txt
export const STUDIO_LUNAR_DATES = {
  lichun: "腊月十七",
  yushui: "正月初二",
  jingzhe: "正月十七",
  chunfen: "二月初二",
  qingming: "二月十八",
  guyu: "三月初四",
  lixia: "三月十九",
  xiaoman: "四月初五",
  mangzhong: "四月二十",
  xiazhi: "五月初七",
  xiaoshu: "五月廿三",
  dashu: "六月初十",
  liqiu: "六月廿五",
  chushu: "七月十一",
  bailu: "七月廿六",
  qiufen: "八月十三",
  hanlu: "八月廿八",
  shuangjiang: "九月十四",
  lidong: "九月廿九",
  xiaoxue: "十月十四",
  daxue: "十月廿九",
  dongzhi: "冬月十四",
  xiaohan: "冬月十七",
  dahan: "腊月初二",
} satisfies Record<SolarTermId, string>;
