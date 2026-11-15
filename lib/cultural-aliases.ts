// Query vocabulary only. Aliases never change published names, locations or verification states.
export const CULTURAL_QUERY_SYNONYMS = [
  ["江浙两省", "江苏 浙江"], ["江浙", "江苏 浙江"],
  ["老北京", "北京"], ["京城", "北京"], ["沪上", "上海"], ["津门", "天津"],
  ["羊城", "广州"], ["姑苏", "苏州"], ["冬节", "冬至"],
  ["萝卜丸子", "萝卜圆子"], ["数九图", "九九消寒图"], ["画九", "九九消寒图"],
  ["桂花冬酿酒", "冬酿酒"], ["红薯稀饭", "红薯粥"],
] as const;

export const CULTURAL_CASE_ALIASES: Readonly<Record<string, readonly string[]>> = {
  "beijing-dongzhi-nine-nine-chart": ["九九图", "数九图", "画九", "消寒图", "冬至数九"],
  "nanjing-daxue-radish-balls": ["萝卜丸子", "萝卜圆子"],
  "lubei-daxue-sweet-potato-porridge": ["红薯粥", "红薯稀饭", "红黏粥"],
  "suzhou-dongzhi-winter-wine": ["姑苏冬酿酒", "苏州冬酿酒", "桂花冬酿酒"],
  "yinchuan-dongzhi-lamb-soup": ["羊肉粉汤", "银川头脑"],
  "hangzhou-dark-glutinous-rice": ["杭州乌饭", "立夏乌饭"],
  "western-sichuan-rainwater-family-visits": ["川西认干亲", "雨水认干亲", "回娘家"],
  "guanghan-baobao-festival": ["广汉认干亲", "广汉拉保保"],
};

export function normalizeCulturalQuery(text: string) {
  let normalized = text.normalize("NFKC").replace(/[節氣團飯餅鄉縣臺廣東蘇閩魯]/gu, character => ({
    節: "节", 氣: "气", 團: "团", 飯: "饭", 餅: "饼", 鄉: "乡", 縣: "县", 臺: "台", 廣: "广", 東: "东", 蘇: "苏", 閩: "闽", 魯: "鲁",
  })[character] ?? character);
  const aliases: string[] = [];
  for (const [alias, canonical] of CULTURAL_QUERY_SYNONYMS) {
    if (normalized.includes(alias)) { aliases.push(alias); normalized = normalized.replaceAll(alias, canonical); }
  }
  return { text: normalized, aliases };
}
