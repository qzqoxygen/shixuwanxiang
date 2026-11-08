import type { SolarTermId } from "./solar-terms";

export interface SolarTermPhoto {
  src: string;
  width: number;
  height: number;
  caption: string;
  credit: string;
  sourceName: string;
  sourceUrl: string;
  license: string;
  licenseUrl: string;
  articleTitle: string;
  articleUrl: string;
}

// All 24 photographs are rendered from HD sources into 1920 x 1440 WebP.
// Per-file authors, licenses and crop provenance: public/images/solar-terms/SOURCES.md.
export const SOLAR_TERM_PHOTOS = {
  "lichun": {
    "src": "/images/solar-terms/lichun-hd.webp",
    "width": 1920,
    "height": 1440,
    "caption": "梅枝初绽",
    "credit": "摄影：Greg Peterson",
    "sourceName": "Wikimedia Commons",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:Japanese_Apricot_Prunus_Mume_%E6%A2%85_Blossoms_(248288253).jpeg",
    "license": "CC BY-SA 3.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0",
    "articleTitle": "春到人间草木知——二十四节气之立春",
    "articleUrl": "https://www.ihchina.cn/Article/Index/detail?id=9706"
  },
  "yushui": {
    "src": "/images/solar-terms/yushui-hd.webp",
    "width": 1920,
    "height": 1440,
    "caption": "新叶含雨",
    "credit": "摄影：Rhett Maxwell",
    "sourceName": "Wikimedia Commons",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:Green_raindrops_(2650764957).jpg",
    "license": "CC BY 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/2.0",
    "articleTitle": "东风解冻散为雨——二十四节气之雨水",
    "articleUrl": "https://www.ihchina.cn/Article/Index/detail?id=9692"
  },
  "jingzhe": {
    "src": "/images/solar-terms/jingzhe-hd.webp",
    "width": 1920,
    "height": 1440,
    "caption": "桃花访蜂",
    "credit": "摄影：Uroš Novina from Semič, Slovenia",
    "sourceName": "Wikimedia Commons",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:Precious_peach_nectar_(25053179993).jpg",
    "license": "CC BY 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/2.0",
    "articleTitle": "最是一年春好处——二十四节气之惊蛰",
    "articleUrl": "https://www.ihchina.cn/Article/Index/detail?id=9676"
  },
  "chunfen": {
    "src": "/images/solar-terms/chunfen-hd.webp",
    "width": 1920,
    "height": 1440,
    "caption": "春日花田",
    "credit": "摄影：Fanghong",
    "sourceName": "Wikimedia Commons",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:Canola_field_in_Luoping.JPG",
    "license": "CC BY-SA 3.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0",
    "articleTitle": "春色正中分——二十四节气之春分",
    "articleUrl": "https://www.ihchina.cn/Article/Index/detail?id=10059"
  },
  "qingming": {
    "src": "/images/solar-terms/qingming-hd.webp",
    "width": 1920,
    "height": 1440,
    "caption": "徽州水乡",
    "credit": "摄影：颐园新居",
    "sourceName": "Wikimedia Commons",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:South_Lake_of_Hongcun_20141110.JPG",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "articleTitle": "梨花落后清明——二十四节气之清明",
    "articleUrl": "https://www.ihchina.cn/Article/Index/detail?id=10041"
  },
  "guyu": {
    "src": "/images/solar-terms/guyu-hd.webp",
    "width": 1920,
    "height": 1440,
    "caption": "茶山新绿",
    "credit": "摄影：Shizhao",
    "sourceName": "Wikimedia Commons",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:Tea_plantation_in_hangzhou.JPG",
    "license": "CC BY 1.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/1.0",
    "articleTitle": "雨生百谷——二十四节气之谷雨",
    "articleUrl": "https://www.ihchina.cn/Article/Index/detail?id=10019"
  },
  "lixia": {
    "src": "/images/solar-terms/lixia-hd.webp",
    "width": 1920,
    "height": 1440,
    "caption": "绿荫小桥",
    "credit": "摄影：Jrwooley6 from Seoul, South Korea",
    "sourceName": "Wikimedia Commons",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:Bridge_Over_Green_Water,_Summer_Palace,_Beijing_(3861302154).jpg",
    "license": "CC BY-SA 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0",
    "articleTitle": "绿荫冉冉遍天涯——二十四节气之立夏",
    "articleUrl": "https://www.ihchina.cn/Article/Index/detail?id=9999"
  },
  "xiaoman": {
    "src": "/images/solar-terms/xiaoman-hd.webp",
    "width": 1920,
    "height": 1440,
    "caption": "田间麦穗",
    "credit": "摄影：User:Bluemoose",
    "sourceName": "Wikimedia Commons",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:Wheat_close-up.JPG",
    "license": "CC BY-SA 3.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0/",
    "articleTitle": "南风原头吹百草——二十四节气之小满",
    "articleUrl": "https://www.ihchina.cn/Article/Index/detail?id=9977"
  },
  "mangzhong": {
    "src": "/images/solar-terms/mangzhong-hd.webp",
    "width": 1920,
    "height": 1440,
    "caption": "水田插秧",
    "credit": "摄影：Judgefloro",
    "sourceName": "Wikimedia Commons",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:9971Tanauan,_Bustos,_Bulacan_26.jpg",
    "license": "CC0",
    "licenseUrl": "https://creativecommons.org/publicdomain/zero/1.0/deed.en",
    "articleTitle": "东风染尽三千顷——二十四节气之芒种",
    "articleUrl": "https://www.ihchina.cn/Article/Index/detail?id=9960"
  },
  "xiazhi": {
    "src": "/images/solar-terms/xiazhi-hd.webp",
    "width": 1920,
    "height": 1440,
    "caption": "一盘杨梅",
    "credit": "摄影：Dinkun Chen",
    "sourceName": "Wikimedia Commons",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:Myrica_rubra_in_China.jpg",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "articleTitle": "冰雪在心——二十四节气之夏至",
    "articleUrl": "https://www.ihchina.cn/Article/Index/detail?id=9925"
  },
  "xiaoshu": {
    "src": "/images/solar-terms/xiaoshu-hd.webp",
    "width": 1920,
    "height": 1440,
    "caption": "荷塘花信",
    "credit": "摄影：Daftation",
    "sourceName": "Wikimedia Commons",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:Sacred_Lotus_in_a_Pond_3.jpg",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "articleTitle": "雨声荷叶香——二十四节气之小暑",
    "articleUrl": "https://www.ihchina.cn/Article/Index/detail?id=9909"
  },
  "dashu": {
    "src": "/images/solar-terms/dashu-hd.webp",
    "width": 1920,
    "height": 1440,
    "caption": "盛夏蜻蜓",
    "credit": "摄影：Greg Peterson",
    "sourceName": "Wikimedia Commons",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:20170713t130244_V1_(219737223).jpeg",
    "license": "CC BY-SA 3.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0",
    "articleTitle": "忽若秋气生——二十四节气之大暑",
    "articleUrl": "https://www.ihchina.cn/Article/Index/detail?id=9896"
  },
  "liqiu": {
    "src": "/images/solar-terms/liqiu-hd.webp",
    "width": 1920,
    "height": 1440,
    "caption": "梯田秋色",
    "credit": "摄影：King of Hearts",
    "sourceName": "Wikimedia Commons",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:Longsheng_Rice_Terraces_November_2017_014.jpg",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "articleTitle": "木叶动秋声——二十四节气之立秋",
    "articleUrl": "https://www.ihchina.cn/Article/Index/detail?id=9885"
  },
  "chushu": {
    "src": "/images/solar-terms/chushu-hd.webp",
    "width": 1920,
    "height": 1440,
    "caption": "云影湖光",
    "credit": "摄影：Ximonic (Simo Räsänen)",
    "sourceName": "Wikimedia Commons",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:Afternoon_at_Tennfjorden,_Raftsundet,_Hinn%C3%B8ya,_Norway,_2015_September_(02).jpg",
    "license": "CC BY-SA 3.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0",
    "articleTitle": "最好新秋时——二十四节气之处暑",
    "articleUrl": "https://www.ihchina.cn/Article/Index/detail?id=9867"
  },
  "bailu": {
    "src": "/images/solar-terms/bailu-hd.webp",
    "width": 1920,
    "height": 1440,
    "caption": "晨露结珠",
    "credit": "摄影：Luc Viatour",
    "sourceName": "Wikimedia Commons",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:Spider_web_Luc_Viatour.jpg",
    "license": "CC BY-SA 3.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0/",
    "articleTitle": "蒹葭苍苍 白露为霜——二十四节气之白露",
    "articleUrl": "https://www.ihchina.cn/Article/Index/detail?id=9852"
  },
  "qiufen": {
    "src": "/images/solar-terms/qiufen-hd.webp",
    "width": 1920,
    "height": 1440,
    "caption": "秋收田野",
    "credit": "摄影：Chris DeLacy",
    "sourceName": "Wikimedia Commons",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:Rice_harvest_in_Xizhou.JPG",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "articleTitle": "桂子飘香远——二十四节气之秋分",
    "articleUrl": "https://www.ihchina.cn/Article/Index/detail?id=9827"
  },
  "hanlu": {
    "src": "/images/solar-terms/hanlu-hd.webp",
    "width": 1920,
    "height": 1440,
    "caption": "银杏染秋",
    "credit": "摄影：JULIANISME",
    "sourceName": "Wikimedia Commons",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:Ginkgo_Avenue_of_BJTU_in_Autumn_20171029_01.jpg",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "articleTitle": "气收天地广——二十四节气之寒露",
    "articleUrl": "https://www.ihchina.cn/Article/Index/detail?id=9809"
  },
  "shuangjiang": {
    "src": "/images/solar-terms/shuangjiang-hd.webp",
    "width": 1920,
    "height": 1440,
    "caption": "红叶凝霜",
    "credit": "摄影：Gerda Arendt",
    "sourceName": "Wikimedia Commons",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:Red_leaves_wih_frost,_Ehrenbach.jpg",
    "license": "CC0",
    "licenseUrl": "https://creativecommons.org/publicdomain/zero/1.0/deed.en",
    "articleTitle": "万类霜天竞自由——二十四节气之霜降",
    "articleUrl": "https://www.ihchina.cn/Article/Index/detail?id=9790"
  },
  "lidong": {
    "src": "/images/solar-terms/lidong-hd.webp",
    "width": 1920,
    "height": 1440,
    "caption": "雪映远山",
    "credit": "摄影：CEphoto, Uwe Aranas",
    "sourceName": "Wikimedia Commons",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:Lijiang_Yunnan_China_Jade-Dragon-Snow-Mountain-01.jpg",
    "license": "CC BY-SA 3.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0",
    "articleTitle": "秋冬气始交——二十四节气之立冬",
    "articleUrl": "https://www.ihchina.cn/Article/Index/detail?id=9782"
  },
  "xiaoxue": {
    "src": "/images/solar-terms/xiaoxue-hd.webp",
    "width": 1920,
    "height": 1440,
    "caption": "河谷雪景",
    "credit": "摄影：UnpetitproleX",
    "sourceName": "Wikimedia Commons",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:Orchards_in_snow,_Sangla,_Himachal_Pradesh,_India.jpg",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "articleTitle": "清寒小雪前——二十四节气之小雪",
    "articleUrl": "https://www.ihchina.cn/Article/Index/detail?id=9768"
  },
  "daxue": {
    "src": "/images/solar-terms/daxue-hd.webp",
    "width": 1920,
    "height": 1440,
    "caption": "群山覆雪",
    "credit": "摄影：kallerna",
    "sourceName": "Wikimedia Commons",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:Ko%C5%9Bcielec_view_2.jpg",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "articleTitle": "千里冰封 万里雪飘——二十四节气之大雪",
    "articleUrl": "https://www.ihchina.cn/Article/Index/detail?id=9752"
  },
  "dongzhi": {
    "src": "/images/solar-terms/dongzhi-hd.webp",
    "width": 1920,
    "height": 1440,
    "caption": "一碗汤圆",
    "credit": "摄影：Sebastian Mary",
    "sourceName": "Wikimedia Commons",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:%E5%9C%93%E4%BB%94.jpg",
    "license": "CC BY-SA 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0",
    "articleTitle": "冬至阳生春又来——二十四节气之冬至",
    "articleUrl": "https://www.ihchina.cn/Article/Index/detail?id=9743"
  },
  "xiaohan": {
    "src": "/images/solar-terms/xiaohan-hd.webp",
    "width": 1920,
    "height": 1440,
    "caption": "蜡梅迎寒",
    "credit": "摄影：Laitche",
    "sourceName": "Wikimedia Commons",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:Chimonanthus_praecox_f._concolor,_Nagai_Botanical_Garden,_January_2026_-1841.jpg",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "articleTitle": "雪里已知春信至——二十四节气之小寒",
    "articleUrl": "https://www.ihchina.cn/Article/Index/detail?id=9736"
  },
  "dahan": {
    "src": "/images/solar-terms/dahan-hd.webp",
    "width": 1920,
    "height": 1440,
    "caption": "雾凇林间",
    "credit": "摄影：Naganojmmmm",
    "sourceName": "Wikimedia Commons",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:Hard_rime_covered_trees_at_Kitayoko_Hyutte.jpg",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "articleTitle": "岁有大寒知——二十四节气之大寒",
    "articleUrl": "https://www.ihchina.cn/Article/Index/detail?id=9721"
  }
} satisfies Record<SolarTermId, SolarTermPhoto>;
