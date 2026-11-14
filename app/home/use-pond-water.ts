import { useEffect, type RefObject } from "react";

export function usePondWater(
  active: boolean,
  imageRef: RefObject<HTMLImageElement | null>,
  waterRef: RefObject<HTMLCanvasElement | null>,
  waterline: readonly (readonly [number, number])[],
) {
  useEffect(() => {
    const image = imageRef.current;
    const water = waterRef.current;
    const ctx = water?.getContext("2d");
    if (!active || !image || !water || !ctx) return;

    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const { width, height } = water;
    let frame = 0;
    let previous = 0;
    let start = 0;
    let inView = true;
    let disposed = false;
    const mask = document.createElement("canvas");
    mask.width = width;
    mask.height = height;
    const maskContext = mask.getContext("2d");
    if (!maskContext) return;

    const depth = maskContext.createLinearGradient(0, height * .47, 0, height);
    depth.addColorStop(0, "transparent");
    depth.addColorStop(.20, "#000");
    depth.addColorStop(1, "#000");
    // Mask the bank and solid objects so only the water is distorted.
    maskContext.beginPath();
    for (const [x, y] of waterline) maskContext.lineTo(width * x, height * y);
    maskContext.closePath();
    maskContext.filter = "blur(12px)";
    maskContext.fillStyle = depth;
    maskContext.fill();

    function animate(now: number) {
      frame = requestAnimationFrame(animate);
      if (now - previous < 32 || !image || !ctx || !image.naturalWidth) return;
      previous = now;
      if (!start) start = now;
      const time = (now - start) * .001;
      ctx.clearRect(0, 0, width, height);
      const sy = image.naturalHeight / height;
      for (let y = Math.floor(height * .45); y < height; y += 3) {
        const distance = (y / height - .45) * 1.82;
        const wave = Math.sin(y * .105 - time * 2.1) + .58 * Math.sin(y * .051 + time * 1.25);
        const shift = wave * (1.4 + distance * 4.6);
        const vertical = Math.sin(y * .12 - time * 2.6) * distance * 1.65;
        const rowHeight = Math.min(3, height - y);
        const sourceY = Math.max(0, Math.min(height - rowHeight, y + vertical));
        ctx.drawImage(image, 0, sourceY * sy, image.naturalWidth, rowHeight * sy, shift - 8, y, width + 16, rowHeight);
      }

      // Small traveling highlights follow the same water perspective as the distortion.
      for (let i = 0; i < 16; i++) {
        const phase = (time * (.08 + i % 3 * .013) + i * .237) % 1;
        const x = width * (.09 + (i * .193 % .59) + phase * .09);
        const y = height * (.56 + i * .031 % .34) + Math.sin(time + i) * 2;
        const length = (14 + i % 4 * 10) * (1 + phase);
        const light = ctx.createLinearGradient(x - length, y, x + length, y);
        light.addColorStop(0, "transparent");
        light.addColorStop(.52, `rgba(248, 244, 218, ${Math.sin(phase * Math.PI) * .28})`);
        light.addColorStop(1, "transparent");
        ctx.fillStyle = light;
        ctx.fillRect(x - length, y, length * 2, 1);
      }

      ctx.globalCompositeOperation = "destination-in";
      ctx.drawImage(mask, 0, 0);
      ctx.globalCompositeOperation = "source-over";
    }

    function syncAnimation() {
      cancelAnimationFrame(frame);
      if (disposed) return;
      if (motion.matches || document.hidden || !inView) {
        ctx?.clearRect(0, 0, width, height);
        return;
      }
      frame = requestAnimationFrame(animate);
    }

    const observer = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      syncAnimation();
    });
    observer.observe(water);
    motion.addEventListener("change", syncAnimation);
    document.addEventListener("visibilitychange", syncAnimation);
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      ctx.clearRect(0, 0, width, height);
      observer.disconnect();
      motion.removeEventListener("change", syncAnimation);
      document.removeEventListener("visibilitychange", syncAnimation);
    };
  }, [active, imageRef, waterRef, waterline]);
}
