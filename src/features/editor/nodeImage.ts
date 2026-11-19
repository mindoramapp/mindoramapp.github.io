// Turns a picture the person picked, pasted or dropped into a small WebP kept inside the map, so
// it saves, undoes, exports and works offline like the rest of the map, with no upload service.
import { isSafeNodeImage, NODE_IMAGE_MAX_CHARS } from "@/lib/security";

const MAX_SOURCE_BYTES = 15 * 1024 * 1024;
const ATTEMPTS = [
  { side: 480, quality: 0.82 },
  { side: 400, quality: 0.7 },
  { side: 320, quality: 0.6 },
];

export class NodeImageError extends Error {}

export async function fileToNodeImage(file: Blob): Promise<string> {
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml") {
    throw new NodeImageError("Use uma imagem PNG, JPG, WebP ou GIF.");
  }
  if (file.size > MAX_SOURCE_BYTES) {
    throw new NodeImageError("Imagem grande demais (máximo de 15 MB).");
  }
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new NodeImageError("Não foi possível ler essa imagem.");
  }
  try {
    for (const { side, quality } of ATTEMPTS) {
      const scale = Math.min(1, side / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      let url = canvas.toDataURL("image/webp", quality);
      // Browsers without WebP encoding hand back PNG; JPEG keeps those small.
      if (!url.startsWith("data:image/webp")) url = canvas.toDataURL("image/jpeg", quality);
      if (url.length <= NODE_IMAGE_MAX_CHARS && isSafeNodeImage(url)) return url;
    }
  } finally {
    bitmap.close();
  }
  throw new NodeImageError("Não foi possível reduzir essa imagem o bastante.");
}

/** First picture file in a paste or drop, if any. */
export function imageFromTransfer(transfer: DataTransfer | null): File | null {
  if (!transfer) return null;
  for (const file of Array.from(transfer.files)) if (file.type.startsWith("image/")) return file;
  for (const item of Array.from(transfer.items ?? [])) {
    if (item.kind === "file" && item.type.startsWith("image/")) return item.getAsFile();
  }
  return null;
}
