type Box = { x: number; y: number; width: number; height: number };
type Paint = (context: CanvasRenderingContext2D) => void;

const paperSource = "/images/xuan-paper.webp";

function boxIn(rect: DOMRect, origin: DOMRect): Box {
  return { x: rect.left - origin.left, y: rect.top - origin.top, width: rect.width, height: rect.height };
}

function cssLength(value: string, reference: number) {
  const amount = parseFloat(value) || 0;
  return value.endsWith("%") ? amount * reference / 100 : amount;
}

function captureBorders(style: CSSStyleDeclaration, box: Box): Paint {
  const edges = (["Top", "Right", "Bottom", "Left"] as const).map((edge) => ({
    width: parseFloat(style[`border${edge}Width`]) || 0,
    color: style[`border${edge}Color`],
    double: style[`border${edge}Style`] === "double",
  }));
  return (context) => {
    edges.forEach(({ width, color, double }, index) => {
      if (!width) return;
      const horizontal = index % 2 === 0;
      const reverse = index === 1 || index === 2;
      const thickness = double ? Math.floor(width / 3) : width;
      context.fillStyle = color;
      for (const inset of double ? [0, width - thickness] : [0]) {
        const x = box.x + (horizontal ? inset : reverse ? box.width - inset - thickness : inset);
        const y = box.y + (horizontal ? reverse ? box.height - inset - thickness : inset : inset);
        context.fillRect(x, y, horizontal ? box.width - inset * 2 : thickness, horizontal ? thickness : box.height - inset * 2);
      }
    });
  };
}

function captureFrame(poster: HTMLElement, origin: DOMRect): Paint {
  const frame = getComputedStyle(poster, "::before");
  const ring = getComputedStyle(poster, "::after");
  const paint: Paint[] = [];
  if (frame.content !== "none") {
    const x = cssLength(frame.left, origin.width);
    const y = cssLength(frame.top, origin.height);
    paint.push(captureBorders(frame, {
      x, y,
      width: origin.width - x - cssLength(frame.right, origin.width),
      height: origin.height - y - cssLength(frame.bottom, origin.height),
    }));
  }
  if (ring.content !== "none") {
    const width = cssLength(ring.width, origin.width);
    const border = cssLength(ring.borderTopWidth, width);
    const x = cssLength(ring.left, origin.width);
    const y = cssLength(ring.top, origin.height) + width / 2;
    const fill = ring.backgroundColor;
    const stroke = ring.borderTopColor;
    paint.push((context) => {
      context.beginPath();
      context.arc(x, y, (width - border) / 2, 0, 2 * Math.PI);
      context.fillStyle = fill;
      context.fill();
      context.strokeStyle = stroke;
      context.lineWidth = border;
      context.stroke();
    });
  }
  return (context) => paint.forEach((draw) => draw(context));
}

function canvasFont(style: CSSStyleDeclaration) {
  return `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
}

function captureText(element: HTMLElement, origin: DOMRect): Paint {
  const style = getComputedStyle(element);
  const font = canvasFont(style);
  const color = style.color;
  const vertical = style.writingMode === "vertical-rl";
  const text = element.firstChild;
  const runs: { text: string; box: Box }[] = [];
  if (text?.nodeType === Node.TEXT_NODE) {
    const range = document.createRange();
    const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" });
    for (const { segment, index } of graphemes.segment(text.textContent ?? "")) {
      range.setStart(text, index);
      range.setEnd(text, index + segment.length);
      const rect = range.getBoundingClientRect();
      if (!rect.width || !rect.height) continue;
      const box = boxIn(rect, origin);
      const previous = runs.at(-1);
      if (!vertical && previous && Math.abs(previous.box.y - box.y) < 0.5) {
        previous.text += segment;
        previous.box.x = Math.min(previous.box.x, box.x);
      } else {
        runs.push({ text: segment, box });
      }
    }
  }
  return (context) => {
    context.font = font;
    context.fillStyle = color;
    context.textAlign = vertical ? "center" : "left";
    const metrics = context.measureText("国");
    const baseline = (metrics.fontBoundingBoxAscent - metrics.fontBoundingBoxDescent) / 2;
    for (const run of runs) {
      const { x, y, width, height } = run.box;
      const content = vertical ? run.text : run.text.replace(/[ \t\r\n\f]+/g, " ").trim();
      context.fillText(content, x + (vertical ? width / 2 : 0), y + height / 2 + baseline);
    }
  };
}

function captureCenteredText(element: HTMLElement, origin: DOMRect, withBackground = false): Paint {
  const style = getComputedStyle(element);
  const { x, y, width, height } = boxIn(element.getBoundingClientRect(), origin);
  const font = canvasFont(style);
  const fill = style.backgroundColor;
  const ink = style.color;
  const angle = (parseFloat(style.rotate) || 0) * Math.PI / 180;
  const text = element.textContent?.trim() ?? "";
  return (context) => {
    if (withBackground) {
      context.fillStyle = fill;
      context.fillRect(x, y, width, height);
    }
    context.save();
    context.translate(x + width / 2, y + height / 2);
    context.rotate(angle);
    context.font = font;
    context.fillStyle = ink;
    context.textAlign = "center";
    const metrics = context.measureText(text);
    context.fillText(text, 0, (metrics.fontBoundingBoxAscent - metrics.fontBoundingBoxDescent) / 2);
    context.restore();
  };
}

async function loadImage(source: string) {
  const image = new Image();
  image.src = source;
  await image.decode();
  return image;
}

function drawPaper(context: CanvasRenderingContext2D, image: HTMLImageElement, width: number, height: number) {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const imageWidth = image.naturalWidth * scale;
  const imageHeight = image.naturalHeight * scale;
  context.drawImage(image, (width - imageWidth) / 2, (height - imageHeight) / 2, imageWidth, imageHeight);
}

export async function renderPosterPng(poster: HTMLElement): Promise<Blob> {
  await document.fonts.ready;
  const origin = poster.getBoundingClientRect();
  const { width, height } = origin;
  if (!width || !height) throw new Error("The card is not visible");
  const style = getComputedStyle(poster);
  const background = style.backgroundColor;
  const hasPaper = style.backgroundImage !== "none";
  const paperOpacity = parseFloat(style.getPropertyValue("--paper-wash-opacity")) / 100;
  const paintFrame = captureFrame(poster, origin);
  const stickers = Array.from(poster.querySelectorAll<HTMLButtonElement>(".studio-placed-sticker"), (element) => {
    const image = element.querySelector("img")!;
    const size = parseFloat(getComputedStyle(element).width);
    return {
      source: image.currentSrc || image.src,
      size,
      x: cssLength(element.style.left, width),
      y: cssLength(element.style.top, height),
      angle: (parseFloat(element.style.rotate) || 0) * Math.PI / 180,
      mirrored: element.dataset.mirrored === "true",
    };
  });
  const title = poster.querySelector<HTMLElement>(".studio-poster-title")!;
  const line = poster.querySelector<HTMLElement>(".studio-poster-line")!;
  const paintText = [
    captureBorders(getComputedStyle(title), boxIn(title.getBoundingClientRect(), origin)),
    captureText(title.firstElementChild as HTMLElement, origin),
    captureCenteredText(title.lastElementChild as HTMLElement, origin, true),
    captureBorders(getComputedStyle(line), boxIn(line.getBoundingClientRect(), origin)),
    captureText(line, origin),
    captureCenteredText(poster.querySelector<HTMLElement>(".studio-poster-date")!, origin),
  ];

  const sources = new Set(stickers.map(({ source }) => source));
  if (hasPaper) sources.add(paperSource);
  const images = new Map(await Promise.all(Array.from(sources, async (source) => [source, await loadImage(source)] as const)));
  const canvas = document.createElement("canvas");
  const scale = 1800 / Math.max(width, height);
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Image rendering is unavailable");
  context.scale(canvas.width / width, canvas.height / height);
  context.imageSmoothingQuality = "high";
  context.fillStyle = background;
  context.fillRect(0, 0, width, height);
  const paper = images.get(paperSource);
  if (paper) {
    drawPaper(context, paper, width, height);
    context.globalAlpha = paperOpacity;
    context.fillRect(0, 0, width, height);
    context.globalAlpha = 1;
  }
  paintFrame(context);
  for (const sticker of stickers) {
    context.save();
    context.translate(sticker.x, sticker.y);
    context.rotate(sticker.angle);
    context.scale(sticker.mirrored ? -1 : 1, 1);
    context.drawImage(images.get(sticker.source)!, -sticker.size / 2, -sticker.size / 2, sticker.size, sticker.size);
    context.restore();
  }
  paintText.forEach((draw) => draw(context));
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("PNG encoding failed")), "image/png");
  });
}
