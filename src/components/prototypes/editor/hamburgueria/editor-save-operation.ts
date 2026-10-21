import type {
  PrototypeActionResult,
  PrototypeDTO,
  PrototypeVersionDTO,
} from "@/src/server/prototypes/prototype.dto";
import type { HamburgueriaPrototypeDocument as Document } from "../../templates/hamburgueria/schema/hamburgueria.schema";
import type { EditorImageUploads } from "./editor-upload";

export async function persistEditorOperation(options: {
  id: string;
  revision: number;
  name: string;
  document: Document;
  version: boolean;
  dirty: boolean;
  uploads: EditorImageUploads;
  getFile: (id: string) => File | undefined;
  onProgress: (done: number, total: number) => void;
  saveDraft: (input: {
    id: string;
    expectedRevision: number;
    name: string;
    document: Document;
  }) => Promise<PrototypeActionResult<PrototypeDTO>>;
  createVersion: (input: {
    id: string;
    expectedRevision: number;
  }) => Promise<PrototypeActionResult<PrototypeVersionDTO>>;
  onSaved: (
    saved: PrototypeDTO,
    submitted: Document,
    replacements: Record<string, string>,
  ) => void;
}) {
  const prepared = await options.uploads.prepare(
    options.document,
    options.getFile,
    options.onProgress,
  );
  options.onProgress(0, 0);
  let revision = options.revision;
  if (!options.version || options.dirty) {
    const result = await options.saveDraft({
      id: options.id,
      expectedRevision: revision,
      name: options.name,
      document: prepared.document,
    });
    if (!result.success) return result;
    revision = result.data.draftRevision;
    options.onSaved(result.data, prepared.document, prepared.replacements);
  }
  if (options.version) {
    const result = await options.createVersion({
      id: options.id,
      expectedRevision: revision,
    });
    if (!result.success) return result;
    return {
      success: true as const,
      kind: "version-created" as const,
      version: result.data,
    };
  }
  return { success: true as const, kind: "saved" as const };
}
