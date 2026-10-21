import type { HamburgueriaPrototypeDocument } from "../schema/hamburgueria.schema";
import type { ImageReference } from "../../../schemas/prototype-base.schema";

/** Includes hidden sections and SEO: all referenced resources belong to the document. */
export function getHamburgueriaImageReferences(document: HamburgueriaPrototypeDocument): { path: (string | number)[]; image: ImageReference | undefined }[] {
  return [
    { path: ["seo", "socialImage"], image: document.seo.socialImage },
    { path: ["content", "hero", "image"], image: document.content.hero.image },
    { path: ["content", "story", "featured", "image"], image: document.content.story.featured.image },
    { path: ["content", "location", "image"], image: document.content.location.image },
    ...document.content.menu.products.map((product, index) => ({ path: ["content", "menu", "products", index, "image"], image: product.image })),
  ];
}

/** Changes only matching IDs; keeps alt/focal point and concurrent edits intact. */
export function replaceUploadReferences(document: HamburgueriaPrototypeDocument, replacements: Readonly<Record<string, string>>) {
  const copy = structuredClone(document);
  for (const { image } of getHamburgueriaImageReferences(copy)) {
    if (image?.source === "upload" && Object.hasOwn(replacements, image.assetId)) image.assetId = replacements[image.assetId];
  }
  return copy;
}
