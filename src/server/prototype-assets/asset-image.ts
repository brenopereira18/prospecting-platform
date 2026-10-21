import { createHash } from "node:crypto";
import sharp from "sharp";
import { AssetError } from "./asset-error";

export const MAX_ASSET_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_IMAGE_PIXELS = 20_000_000;
const formats = {
  "image/jpeg": { format: "jpeg", extension: "jpg", name: /\.jpe?g$/i },
  "image/png": { format: "png", extension: "png", name: /\.png$/i },
  "image/webp": { format: "webp", extension: "webp", name: /\.webp$/i },
} as const;

export async function validateAssetImage(file: File): Promise<{
  bytes: Buffer;
  mimeType: string;
  extension: string;
  originalName: string;
  width: number;
  height: number;
  sha256: string;
}> {
  if (file.size > MAX_ASSET_IMAGE_BYTES)
    throw new AssetError("TOO_LARGE", "A imagem deve ter no máximo 5 MB.", 413);
  const invalid = () =>
    new AssetError(
      "INVALID_IMAGE",
      "Selecione uma imagem JPG/JPEG, PNG ou WebP válida, sem animação.",
      422,
    );
  const type = file.type as keyof typeof formats;
  if (
    !Object.hasOwn(formats, type) ||
    !formats[type].name.test(file.name) ||
    !file.size
  )
    throw invalid();
  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.length > MAX_ASSET_IMAGE_BYTES)
    throw new AssetError("TOO_LARGE", "A imagem deve ter no máximo 5 MB.", 413);
  if (bytes.length !== file.size) throw invalid();
  const expected = formats[type];
  try {
    const image = sharp(bytes, {
      limitInputPixels: MAX_IMAGE_PIXELS,
      failOn: "warning",
    }).timeout({ seconds: 10 });
    const metadata = await image.metadata();
    if (
      metadata.format !== expected.format ||
      !metadata.width ||
      !metadata.height ||
      (metadata.pages ?? 1) !== 1
    )
      throw invalid();
    // Metadata/signatures alone accept truncated files; stats forces actual decoding.
    await image.stats();
    const rotated = (metadata.orientation ?? 1) >= 5;
    return {
      bytes,
      mimeType: type,
      extension: expected.extension,
      originalName: file.name
        .split(/[\\/]/)
        .pop()!
        .replace(/[\u0000-\u001f\u007f]/g, "")
        .slice(0, 255),
      width: rotated ? metadata.height : metadata.width,
      height: rotated ? metadata.width : metadata.height,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    };
  } catch (cause) {
    if (cause instanceof AssetError) throw cause;
    throw invalid();
  }
}
