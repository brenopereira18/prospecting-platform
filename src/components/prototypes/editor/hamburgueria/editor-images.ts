import type { ImageReference } from "../../schemas/prototype-base.schema";
import { prototypeIdSchema } from "../../schemas/prototype-base.schema";
import { brasaBurgerDefaultDocument } from "../../templates/hamburgueria/data/default-document";
import { hamburgueriaImageOptions, type HamburgueriaImageKey } from "../../templates/hamburgueria/lib/image-catalog";
import type { HamburgueriaPrototypeDocument as Document } from "../../templates/hamburgueria/schema/hamburgueria.schema";

export type EditorImageTarget =
  | { kind: "hero" | "story" | "location" | "social" }
  | { kind: "product"; productId: string };

export type EditorImageAction =
  | { type: "image/select"; target: EditorImageTarget; key: HamburgueriaImageKey }
  | { type: "image/upload"; target: EditorImageTarget; assetId: string }
  | { type: "image/reset" | "image/remove"; target: EditorImageTarget }
  | { type: "image/alt"; target: EditorImageTarget; value: string };

export function getEditorImage(document: Document, target: EditorImageTarget): ImageReference | undefined {
  switch (target.kind) {
    case "hero": return document.content.hero.image;
    case "story": return document.content.story.featured.image;
    case "location": return document.content.location.image;
    case "social": return document.seo.socialImage;
    case "product": return document.content.menu.products.find(product => product.id === target.productId)?.image;
  }
}

export function getDefaultEditorImage(target: EditorImageTarget) {
  return getEditorImage(brasaBurgerDefaultDocument, target);
}

export function getEditorImagePath(document: Document, target: EditorImageTarget): string {
  switch (target.kind) {
    case "hero": return "content.hero.image";
    case "story": return "content.story.featured.image";
    case "location": return "content.location.image";
    case "social": return "seo.socialImage";
    case "product": return `content.menu.products.${document.content.menu.products.findIndex(product => product.id === target.productId)}.image`;
  }
}

export function canRemoveEditorImage(document: Document, target: EditorImageTarget): boolean {
  return target.kind === "social" || (target.kind === "product" && Boolean(document.content.menu.products.find(product => product.id === target.productId)?.icon));
}

function replaceImage(document: Document, target: EditorImageTarget, image: ImageReference | undefined): Document {
  if (!image && !canRemoveEditorImage(document, target)) return document;
  switch (target.kind) {
    case "social": return { ...document, seo: { ...document.seo, socialImage: image } };
    case "product": {
      if (!document.content.menu.products.some(product => product.id === target.productId)) return document;
      return { ...document, content: { ...document.content, menu: { ...document.content.menu,
        products: document.content.menu.products.map(product => product.id === target.productId ? { ...product, image } : product),
      } } };
    }
    case "hero": return image ? { ...document, content: { ...document.content, hero: { ...document.content.hero, image } } } : document;
    case "story": return image ? { ...document, content: { ...document.content, story: { ...document.content.story, featured: { ...document.content.story.featured, image } } } } : document;
    case "location": return image ? { ...document, content: { ...document.content, location: { ...document.content.location, image } } } : document;
  }
}

export function reduceEditorImages(document: Document, action: EditorImageAction): Document {
  const current = getEditorImage(document, action.target);
  switch (action.type) {
    case "image/upload": {
      if (!prototypeIdSchema.safeParse(action.assetId).success) return document;
      const target = action.target;
      const product = target.kind === "product" ? document.content.menu.products.find(product => product.id === target.productId) : undefined;
      return replaceImage(document, target, {
        source: "upload", assetId: action.assetId,
        alt: current?.alt ?? product?.name ?? "Imagem de compartilhamento",
        ...(current?.focalPoint ? { focalPoint: { ...current.focalPoint } } : {}),
      });
    }
    case "image/remove": return replaceImage(document, action.target, undefined);
    case "image/reset": {
      const original = getDefaultEditorImage(action.target);
      return replaceImage(document, action.target, original ? structuredClone(original) : undefined);
    }
    case "image/alt": return current ? replaceImage(document, action.target, { ...current, alt: action.value }) : document;
    case "image/select": {
      const option = hamburgueriaImageOptions.find(option => option.key === action.key);
      if (!option) return document;
      const target = action.target;
      const product = target.kind === "product"
        ? document.content.menu.products.find(product => product.id === target.productId) : undefined;
      const image: ImageReference = {
        source: "template", key: option.key,
        alt: current?.alt ?? product?.name ?? option.alt,
        ...(current?.focalPoint ? { focalPoint: { ...current.focalPoint } } : {}),
      };
      return replaceImage(document, action.target, image);
    }
  }
}
