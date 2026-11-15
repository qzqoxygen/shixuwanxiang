export const SEASON_PHOTO_PREVIEW_WIDTHS = [720, 1120] as const;
export const SEASON_PHOTO_SIZES = "(max-width: 560px) calc(100vw - 80px), (max-width: 1000px) 460px, (max-width: 1279px) 40vw, 520px";

export function seasonPhotoPreview(original: string) {
  const stem = original.replace(/-hd\.webp$/, "");
  const candidates = SEASON_PHOTO_PREVIEW_WIDTHS.map(width => ({
    width,
    src: `${stem}-${width}.webp`,
  }));
  return {
    src: candidates[0].src,
    srcSet: candidates.map(({ src, width }) => `${src} ${width}w`).join(", "),
    sizes: SEASON_PHOTO_SIZES,
  };
}
