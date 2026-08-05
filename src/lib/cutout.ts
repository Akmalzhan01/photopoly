export type ModelQuality = "fast" | "fine";

export type Progress = { label: string; ratio: number };

/** isnet_quint8 downloads roughly a quarter of what fp16 does, at some edge quality. */
const MODEL_BY_QUALITY = {
  fast: "isnet_quint8",
  fine: "isnet_fp16",
} as const;

function describe(key: string): string {
  if (key.startsWith("fetch")) return "Загрузка модели";
  if (key.startsWith("compute")) return "Удаление фона";
  return "Подготовка";
}

/**
 * Runs the segmentation model in the browser. The library ships its weights from a
 * CDN and caches them, so only the first run pays the download.
 */
export async function removeBackground(
  image: Blob,
  quality: ModelQuality,
  onProgress?: (progress: Progress) => void,
): Promise<Blob> {
  const { removeBackground: run } = await import("@imgly/background-removal");

  return run(image, {
    model: MODEL_BY_QUALITY[quality],
    output: { format: "image/png" },
    progress: (key: string, current: number, total: number) => {
      onProgress?.({
        label: describe(key),
        ratio: total > 0 ? Math.min(1, current / total) : 0,
      });
    },
  });
}
