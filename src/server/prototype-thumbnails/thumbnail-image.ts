import sharp from "sharp";

export const THUMBNAIL_WIDTH = 960;
export const THUMBNAIL_HEIGHT = 540;
export const MAX_THUMBNAIL_BYTES = 1024 * 1024;

export async function validateThumbnail(bytes: Buffer) {
  if (!bytes.length || bytes.length > MAX_THUMBNAIL_BYTES)
    throw new Error("Invalid thumbnail size");
  const info = await sharp(bytes, { limitInputPixels: 1440 * 960 }).metadata();
  if (
    info.format !== "webp" ||
    info.width !== THUMBNAIL_WIDTH ||
    info.height !== THUMBNAIL_HEIGHT
  )
    throw new Error("Invalid thumbnail format");
}

export async function encodeThumbnail(bytes: Buffer) {
  const result = await sharp(bytes, { limitInputPixels: 1440 * 960 })
    .resize(THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT, {
      fit: "cover",
      position: "top",
    })
    .webp({ quality: 78, effort: 4 })
    .toBuffer();
  await validateThumbnail(result);
  return result;
}
