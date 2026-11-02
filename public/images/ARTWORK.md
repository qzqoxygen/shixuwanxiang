# 知时：古画风格装饰素材

## 当前使用（2026-11-01）

- `xuan-paper.webp`：内置 imagegen 生成的纯宣纸底纹，1536 × 1024，约 166 KiB，仅转为 WebP。用于页面和地图，不含山水、文字、印章或地形图案；通过 CSS 透明色层控制对比度。
- `azure-cloud-ribbon.svg`：原创代码绘制的青绿云带与断续金线，用于标题、聊天区与地图外围；仅参考用户提供图片的线条与配色方向，不包含参考图中的角色或原始图像。
- `azure-landscape.svg`：原创代码绘制的青绿层叠山形、茶褐细线与浅金水纹，仅用于页面左下角；不代表真实地形。
- `ruyi-cloud.svg`：旧版代码绘制的如意云纹，保留为历史素材。
- 字体来源及授权见 [字体说明](../fonts/README.md)。
- 地图仍使用原始 GeoJSON；只扩大显示区域、调整投影视口，不更改省界坐标。

## 左下角淡山水与纸雕装饰

- `antique-landscape.webp`：2026-10-29 通过内置 imagegen 生成的原创山水装饰，1536 × 1024，约 269 KiB。仅转换为 WebP 压缩格式，未裁改画面。
- 原用于整页左下角淡山水，现由 `azure-landscape.svg` 替代，原文件保留。地图底衬和省域填充继续使用纯宣纸。
- `components/cultural-map/PaperLandscape.tsx`：保留的代码纸雕组件，目前没有省份启用该装饰。
- 视觉方向参考：[书格《四时山水图册》](https://www.shuge.org/view/si_shi_shan_shui_tu_ce/)、[中华珍宝馆朱端《山水图》](https://g2.ltfc.net/view/SUHA/691d93fbc325855c9421f3a2)、[中国国家博物馆古代书画展](https://www.chnmuseum.cn/zl/ztcl/202609/t20260904_282499.shtml) 的纸绢底色、浅绛设色、留白与册页呈现。本项目没有复制或热链这些网站的藏品图片。
- `map-paper.svg`：旧版代码绘制的轻微纸面噪点，当前知时页已换为纯宣纸素材。

## 生成提示词（内置工具）

```text
Use case: stylized-concept
Asset type: original landscape painting background for a Chinese cultural atlas web interface, NOT a UI mockup.
Primary request: a refined antique Chinese shanshui album painting on warm aged silk, meticulous dry-brush rock texture, diluted mineral malachite and azurite pigments, pale ochre washes, subtle silk weave and very fine age patina. Evoke classical Song/Yuan landscape albums without copying any specific artwork.
Composition: landscape 3:2. Pale tea-colored silk ground throughout. Mountains and pine-covered rocks richly detailed along the bottom left quarter, small distant layered mountains along the far right edge and bottom. The upper two thirds and center must remain mostly open, pale, luminous, misty silk with extremely faint landscape washes, suitable for overlaying a real labeled geographic map. Paintings flow into open silk without visible rectangular edges. Delicate river brush strokes and a tiny empty pavilion near bottom left. Rich craftsmanship, natural irregular ink edges and weathered mineral pigments, restrained and contemplative, flat museum scan, no photographic lighting.
Palette: warm flax ivory, pale ochre, smoky umber ink, muted blue-green mineral accents. Medium contrast foreground in bottom left, very low contrast center.
Constraints: no map outline, no geographic boundaries, no lettering, no seals, no text, no frame, no interface, no logos, no watermark, no modern objects, no vector art, no cartoon, no bright green, no white background. All decorative landscape is fictional.
```

## 纯宣纸生成提示词（2026-10-30，内置 imagegen）

```text
Create a flat scanned texture of blank traditional Chinese xuan paper for a cultural atlas website. Landscape 3:2, 1536x1024. Ivory warm rice cream, pale flax fibers, delicate uneven handmade cellulose surface, subtle naturally mottled light tea staining, very fine soft visible fiber grain. Elegant antique painting paper that has been carefully conserved. Even diffuse illumination, low contrast, center and corners similar brightness, no strong vignette. ONLY blank paper material all the way to image edges. No painting, mountains, plants, rivers, landscape, ink, brush strokes, lettering, calligraphy, seals, border, folds, tears, holes, objects, or watermarks. Not grungy, not orange, not brown parchment. Designed to have dark readable map lines and labels overlaid in code.
```
