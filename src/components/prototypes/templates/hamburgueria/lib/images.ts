import type { StaticImageData } from "next/image";
import type { ImageReference } from "../../../schemas/prototype-base.schema";
import type { HamburgueriaPrototypeDocument } from "../schema/hamburgueria.schema";
import type { HamburgueriaImageKey } from "./image-catalog";
import { getHamburgueriaImageReferences } from "./image-references";
import bacon from "../assets/bacon.webp";
import classic from "../assets/classic.webp";
import hero from "../assets/hero.webp";
import interior from "../assets/interior.webp";
import veggie from "../assets/veggie.webp";

const templateAssets: Record<HamburgueriaImageKey, StaticImageData> = {
  bacon,
  classic,
  hero,
  interior,
  veggie,
};

export interface ResolvedUploadImage {
  src: string;
  width: number;
  height: number;
  /** Editor-only resource metadata; never part of the prototype JSON. */
  temporary?: true;
}
export type UploadImageResolver = (
  assetId: string,
) => ResolvedUploadImage | undefined;
export type ResolvedUploadImages = Record<string, ResolvedUploadImage>;

function isSafeUpload(image: ResolvedUploadImage): boolean {
  if (
    !image ||
    typeof image.src !== "string" ||
    image.src.length > 2048 ||
    /[\u0000-\u0020]/.test(image.src)
  )
    return false;
  if (
    !Number.isInteger(image.width) ||
    image.width <= 0 ||
    !Number.isInteger(image.height) ||
    image.height <= 0
  )
    return false;
  if (
    image.src.startsWith("/") &&
    !image.src.startsWith("//") &&
    !image.src.includes("\\")
  )
    return true;
  try {
    const url = new URL(image.src);
    if (image.temporary === true) return url.protocol === "blob:" && /^https?:$/.test(new URL(url.origin).protocol);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}

export function resolveHamburgueriaImage(
  image: ImageReference,
  uploads: ResolvedUploadImages = {},
): StaticImageData | null {
  if (image.source === "template")
    return Object.hasOwn(templateAssets, image.key)
      ? templateAssets[image.key as HamburgueriaImageKey]
      : null;
  const upload = Object.hasOwn(uploads, image.assetId)
    ? uploads[image.assetId]
    : undefined;
  return upload && isSafeUpload(upload) ? upload : null;
}

// Called on the server. Only the resolved, serializable map crosses the client boundary.
export function prepareUploadImages(
  document: HamburgueriaPrototypeDocument,
  resolver?: UploadImageResolver,
  report: (message: string) => void = console.warn,
): ResolvedUploadImages {
  const uploads: ResolvedUploadImages = {};
  const seen = new Set<string>();
  for (const { image } of getHamburgueriaImageReferences(document)) {
    if (!image) continue;
    if (image.source === "template") {
      if (!resolveHamburgueriaImage(image))
        report(`Asset de hamburgueria não encontrado: ${image.key}`);
      continue;
    }
    if (seen.has(image.assetId)) continue;
    seen.add(image.assetId);
    let resolved: ResolvedUploadImage | undefined;
    try {
      resolved = resolver?.(image.assetId);
    } catch {
      /* Report and use the same safe fallback. */
    }
    if (resolved && isSafeUpload(resolved)) uploads[image.assetId] = resolved;
    else
      report(
        `Imagem de upload não resolvida: ${image.assetId}. Será exibido o fallback do template.`,
      );
  }
  return uploads;
}
