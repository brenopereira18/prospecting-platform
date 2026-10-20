"use client";

import { useMemo, useRef, useState } from "react";
import { savePrototypeDraftAction, createPrototypeVersionAction } from "@/src/app/actions/prototypes";
import type { PrototypeDTO } from "@/src/server/prototypes/prototype.dto";
import type { HamburgueriaPrototypeDocument } from "../../templates/hamburgueria/schema/hamburgueria.schema";
import { persistablePrototypeDocumentSchema, containsTemporaryOrDataUrl } from "../../schemas/persistable-document.schema";
import { hasEditorChanges, type EditorErrors } from "./editor-document";
import { editorPersistenceErrors, hasImagesBlockingSave, hasUnsavedPrototypeChanges, serializeEditorDraft } from "./editor-save-state";

type SaveStatus = { kind: "idle" | "saving" | "versioning" | "saved" | "version-created" | "error" | "conflict"; message: string; versionId?: string };

export function usePrototypePersistence(document: HamburgueriaPrototypeDocument, initial: PrototypeDTO | undefined, onErrors: (errors: EditorErrors) => void) {
  const [name, setName] = useState(initial?.name ?? "");
  const [revision, setRevision] = useState(initial?.draftRevision ?? 0);
  const [snapshot, setSnapshot] = useState(() => initial ? serializeEditorDraft(initial.draftDocument, initial.name) : "");
  const [status, setStatus] = useState<SaveStatus>({ kind: "idle", message: "" });
  const inFlight = useRef(false);
  const blockedByImages = hasImagesBlockingSave(document);
  const dirty = useMemo(() => initial ? hasUnsavedPrototypeChanges(document, name, snapshot) : hasEditorChanges(document), [document, name, snapshot, initial]);
  const busy = status.kind === "saving" || status.kind === "versioning";

  async function perform(version: boolean) {
    if (!initial || inFlight.current) return;
    if (blockedByImages) { setStatus({ kind: "error", message: "Imagens temporárias impedem o salvamento. Substitua-as por imagens do template." }); return; }
    if (version && dirty) { setStatus({ kind: "error", message: "Salve o rascunho antes de criar uma versão." }); return; }
    if (!name.trim() || name.trim().length > 120) { setStatus({ kind: "error", message: "Use um nome interno de 1 a 120 caracteres." }); return; }
    if (containsTemporaryOrDataUrl(name)) { setStatus({ kind: "error", message: "Use um nome interno, sem URLs temporárias ou dados de imagem." }); return; }
    const validation = persistablePrototypeDocumentSchema.safeParse(document);
    if (!validation.success) {
      onErrors(Object.fromEntries(validation.error.issues.map(issue => [issue.path.join("."), issue.message])));
      setStatus({ kind: "error", message: "Revise os campos inválidos antes de salvar." }); return;
    }
    // This snapshot belongs to the request, not to subsequent keystrokes while awaiting it.
    const submitted = structuredClone(document);
    const submittedSnapshot = serializeEditorDraft(submitted, name);
    inFlight.current = true;
    setStatus({ kind: version ? "versioning" : "saving", message: version ? "Criando versão…" : "Salvando…" });
    try {
      if (version) {
        const result = await createPrototypeVersionAction({ id: initial.id, expectedRevision: revision });
        if (!result.success) { if (result.fieldErrors) onErrors(editorPersistenceErrors(result.fieldErrors)); setStatus({ kind: result.code === "CONFLICT" ? "conflict" : "error", message: result.error }); return; }
        setStatus({ kind: "version-created", message: `Versão ${result.data.number} criada.`, versionId: result.data.id });
      } else {
        const result = await savePrototypeDraftAction({ id: initial.id, expectedRevision: revision, name, document: submitted });
        if (!result.success) { if (result.fieldErrors) onErrors(editorPersistenceErrors(result.fieldErrors)); setStatus({ kind: result.code === "CONFLICT" ? "conflict" : "error", message: result.error }); return; }
        setRevision(result.data.draftRevision);
        setSnapshot(submittedSnapshot);
        setStatus({ kind: "saved", message: "Rascunho salvo com sucesso." });
      }
    } catch {
      setStatus({ kind: "error", message: "Falha na conexão ao salvar. Suas alterações locais foram mantidas. Tente novamente." });
    } finally { inFlight.current = false; }
  }

  return { name, setName, revision, status, busy, dirty, blockedByImages, save: () => perform(false), createVersion: () => perform(true) };
}
