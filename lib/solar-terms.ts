export type Season = "spring" | "summer" | "autumn" | "winter";
export interface SolarTerm {
  id: string;
  name: string;
  season: Season;
  solarLongitude: number;
  isFeatured: boolean;
  description?: string;
  // Stable IDs can link to future, independently sourced culture-case records.
  culturalCaseIds?: readonly string[];
}
export const SEASONS: ReadonlyArray<{ id: Season; name: string; subtitle: string }> = [
  { id: "spring", name: "春", subtitle: "春序六节" },
  { id: "summer", name: "夏", subtitle: "夏序六节" },
  { id: "autumn", name: "秋", subtitle: "秋序六节" },
  { id: "winter", name: "冬", subtitle: "冬序六节" },
];

// Order and longitudes: https://www.hko.gov.hk/tc/gts/time/24solarterms.htm
// Seasonal names follow the traditional calendar, not local weather forecasts.
export const SOLAR_TERMS = [
  { id: "lichun", name: "立春", season: "spring", solarLongitude: 315, isFeatured: false, description: "二十四节气之首，传统历法中春季的开始，不代表各地同时进入气象学意义上的春天。" },
  { id: "yushui", name: "雨水", season: "spring", solarLongitude: 330, isFeatured: false, description: "春季第二个节气，位于立春之后、惊蛰之前。节气名称与降水有关，各地降水情况不同。" },
  { id: "jingzhe", name: "惊蛰", season: "spring", solarLongitude: 345, isFeatured: false, description: "春季第三个节气，位于雨水与春分之间。名称承载传统的物候观察，不是各地同步发生的天气预报。" },
  { id: "chunfen", name: "春分", season: "spring", solarLongitude: 0, isFeatured: false, description: "太阳黄经到达0°的时刻，太阳直射赤道附近，是北半球春季的分点。" },
  { id: "qingming", name: "清明", season: "spring", solarLongitude: 15, isFeatured: true, description: "春季第五个节气，位于春分与谷雨之间。清明既是节气名称，也与清明节的文化实践相联系。" },
  { id: "guyu", name: "谷雨", season: "spring", solarLongitude: 30, isFeatured: false, description: "春季最后一个节气，之后是立夏。名称体现传统农业对雨水与谷物生长关系的关注。" },
  { id: "lixia", name: "立夏", season: "summer", solarLongitude: 45, isFeatured: false, description: "传统历法中夏季的开始。节气划分与各地实际气温变化并不完全同步。" },
  { id: "xiaoman", name: "小满", season: "summer", solarLongitude: 60, isFeatured: false, description: "夏季第二个节气，位于立夏与芒种之间。其名称源于传统农业观察，具体农事因地区而异。" },
  { id: "mangzhong", name: "芒种", season: "summer", solarLongitude: 75, isFeatured: false, description: "夏季第三个节气，位于小满与夏至之间。名称与有芒作物的传统农事相联系。" },
  { id: "xiazhi", name: "夏至", season: "summer", solarLongitude: 90, isFeatured: true, description: "太阳直射北回归线附近，北半球迎来一年中白昼最长的时段；南半球相反。夏至不一定是最热的一天。" },
  { id: "xiaoshu", name: "小暑", season: "summer", solarLongitude: 105, isFeatured: false, description: "夏季第五个节气，位于夏至与大暑之间。暑意体现在名称中，实际温度取决于地区与当年天气。" },
  { id: "dashu", name: "大暑", season: "summer", solarLongitude: 120, isFeatured: false, description: "夏季最后一个节气，之后是立秋。名称并不意味着每个地区当天都达到全年最高气温。" },
  { id: "liqiu", name: "立秋", season: "autumn", solarLongitude: 135, isFeatured: false, description: "传统历法中秋季的开始，不代表各地暑热立即结束。" },
  { id: "chushu", name: "处暑", season: "autumn", solarLongitude: 150, isFeatured: false, description: "秋季第二个节气，位于立秋与白露之间。名称表达暑气渐退的传统认识，具体气候有地域差异。" },
  { id: "bailu", name: "白露", season: "autumn", solarLongitude: 165, isFeatured: false, description: "秋季第三个节气，位于处暑与秋分之间。名称关联传统的露水观察，露水形成还受当地天气影响。" },
  { id: "qiufen", name: "秋分", season: "autumn", solarLongitude: 180, isFeatured: true, description: "太阳直射赤道附近，是北半球秋季的分点。实际日出日落间隔还受大气折射等因素影响，不能一概视为恰好12小时。" },
  { id: "hanlu", name: "寒露", season: "autumn", solarLongitude: 195, isFeatured: false, description: "秋季第五个节气，位于秋分与霜降之间。名称反映传统季节观察，并非对所有地区的天气判断。" },
  { id: "shuangjiang", name: "霜降", season: "autumn", solarLongitude: 210, isFeatured: false, description: "秋季最后一个节气，之后是立冬。名称不意味着当天各地一定出现霜。" },
  { id: "lidong", name: "立冬", season: "winter", solarLongitude: 225, isFeatured: false, description: "传统历法中冬季的开始，各地进入气象学冬季的时间可能不同。" },
  { id: "xiaoxue", name: "小雪", season: "winter", solarLongitude: 240, isFeatured: false, description: "冬季第二个节气，位于立冬与大雪之间。节气名与天气预报中的降雪量等级含义不同。" },
  { id: "daxue", name: "大雪", season: "winter", solarLongitude: 255, isFeatured: false, description: "冬季第三个节气，位于小雪与冬至之间。名称不能用来判断当地是否下雪或降雪量大小。" },
  { id: "dongzhi", name: "冬至", season: "winter", solarLongitude: 270, isFeatured: true, description: "太阳直射南回归线附近，北半球迎来一年中白昼最短的时段；南半球相反。冬至不一定是最冷的一天。" },
  { id: "xiaohan", name: "小寒", season: "winter", solarLongitude: 285, isFeatured: false, description: "冬季第五个节气，位于冬至与大寒之间。名称中的寒意不代表固定的气温值。" },
  { id: "dahan", name: "大寒", season: "winter", solarLongitude: 300, isFeatured: false, description: "二十四节气中的最后一个，之后回到立春。小寒与大寒哪个更冷，要看地区和具体年份。" },
] as const satisfies readonly SolarTerm[];

export type SolarTermId = (typeof SOLAR_TERMS)[number]["id"];
