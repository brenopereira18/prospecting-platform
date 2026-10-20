import type { HamburgueriaPrototypeDocument } from "../../templates/hamburgueria/schema/hamburgueria.schema";
import { getDocumentUploadIds } from "./temporary-images";

export function serializeEditorDraft(document: HamburgueriaPrototypeDocument, name: string) {
  return JSON.stringify({ name, document });
}
export function hasUnsavedPrototypeChanges(document: HamburgueriaPrototypeDocument, name: string, savedSnapshot: string) {
  return serializeEditorDraft(document, name) !== savedSnapshot;
}
export function hasImagesBlockingSave(document: HamburgueriaPrototypeDocument) {
  return getDocumentUploadIds(document).size > 0;
}
export function editorPersistenceErrors(fields: Record<string, string> = {}) {
  return Object.fromEntries(Object.entries(fields).filter(([path]) => path.startsWith("document.")).map(([path, error]) => [path.slice("document.".length), error]));
}
