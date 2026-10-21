import type { HamburgueriaPrototypeDocument } from "../../templates/hamburgueria/schema/hamburgueria.schema";
import { getDocumentUploadIds } from "./temporary-images";

export function serializeEditorDraft(document: HamburgueriaPrototypeDocument, name: string) {
  return JSON.stringify({ name, document });
}
export function hasUnsavedPrototypeChanges(document: HamburgueriaPrototypeDocument, name: string, savedSnapshot: string) {
  return serializeEditorDraft(document, name) !== savedSnapshot;
}
export function hasTemporaryImages(document: HamburgueriaPrototypeDocument) {
  return [...getDocumentUploadIds(document)].some(id => !z.uuid().safeParse(id).success);
}
export function editorPersistenceErrors(fields: Record<string, string> = {}) {
  return Object.fromEntries(Object.entries(fields).filter(([path]) => path.startsWith("document.")).map(([path, error]) => [path.slice("document.".length), error]));
}
import { z } from "zod";
