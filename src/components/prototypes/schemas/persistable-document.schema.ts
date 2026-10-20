import { hamburgueriaPrototypeDocumentSchema } from "../templates/hamburgueria/schema/hamburgueria.schema";
import { getHamburgueriaImageReferences } from "../templates/hamburgueria/lib/image-references";

export function containsTemporaryOrDataUrl(value: string) {
  return /\bblob:\S+|\bdata:(?:[a-z][a-z0-9!#$&^_.+-]*\/[a-z0-9!#$&^_.+-]+)?(?:;[^,\s]*)?,/i.test(value);
}

export const persistablePrototypeDocumentSchema = hamburgueriaPrototypeDocumentSchema.superRefine((document, ctx) => {
  for (const { image, path } of getHamburgueriaImageReferences(document)) if (image?.source === "upload") {
    ctx.addIssue({ code: "custom", path, message: "Imagens temporárias impedem o salvamento. Substitua-as por imagens do template até o armazenamento permanente estar disponível.", params: { reason: "TEMPORARY_IMAGES" } });
  }
  // Also reject temporary/data URLs pasted into otherwise valid URL or text fields.
  function visit(value: unknown, path: (string | number)[]) {
    if (typeof value === "string" && containsTemporaryOrDataUrl(value)) {
      ctx.addIssue({ code: "custom", path, message: "URLs temporárias e dados codificados não podem ser persistidos." });
    } else if (Array.isArray(value)) value.forEach((item, index) => visit(item, [...path, index]));
    else if (value && typeof value === "object") Object.entries(value).forEach(([key, item]) => visit(item, [...path, key]));
  }
  visit(document, []);
});
