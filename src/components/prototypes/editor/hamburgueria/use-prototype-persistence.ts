"use client";

import { useMemo, useRef, useState } from "react";
import { z } from "zod";
import {
  savePrototypeDraftAction,
  createPrototypeVersionAction,
} from "@/src/app/actions/prototypes";
import type { PrototypeDTO } from "@/src/server/prototypes/prototype.dto";
import {
  hamburgueriaPrototypeDocumentSchema,
  type HamburgueriaPrototypeDocument,
} from "../../templates/hamburgueria/schema/hamburgueria.schema";
import { containsTemporaryOrDataUrl } from "../../schemas/persistable-document.schema";
import {
  hasEditorChanges,
  type EditorDocumentAction,
  type EditorErrors,
} from "./editor-document";
import {
  editorPersistenceErrors,
  hasTemporaryImages,
  hasUnsavedPrototypeChanges,
  serializeEditorDraft,
} from "./editor-save-state";
import { EditorImageUploads } from "./editor-upload";
import { persistEditorOperation } from "./editor-save-operation";
import type { TemporaryImagesController } from "./use-temporary-images";

type SaveStatus = {
  kind:
    | "idle"
    | "saving"
    | "versioning"
    | "saved"
    | "version-created"
    | "error"
    | "conflict";
  message: string;
  versionId?: string;
};

export function usePrototypePersistence(
  document: HamburgueriaPrototypeDocument,
  initial: PrototypeDTO | undefined,
  onErrors: (errors: EditorErrors) => void,
  temporaryImages: TemporaryImagesController,
  dispatch: (action: EditorDocumentAction) => void,
) {
  const [name, setName] = useState(initial?.name ?? "");
  const [revision, setRevision] = useState(initial?.draftRevision ?? 0);
  const [snapshot, setSnapshot] = useState(() =>
    initial ? serializeEditorDraft(initial.draftDocument, initial.name) : "",
  );
  const [status, setStatus] = useState<SaveStatus>({
    kind: "idle",
    message: "",
  });
  const [uploads] = useState(() => new EditorImageUploads(initial?.id ?? ""));
  const inFlight = useRef(false);
  const dirty = useMemo(
    () =>
      initial
        ? hasUnsavedPrototypeChanges(document, name, snapshot)
        : hasEditorChanges(document),
    [document, name, snapshot, initial],
  );
  const busy = status.kind === "saving" || status.kind === "versioning";

  async function perform(version: boolean) {
    if (!initial || inFlight.current) return;
    if (
      !name.trim() ||
      name.trim().length > 120 ||
      containsTemporaryOrDataUrl(name)
    ) {
      setStatus({
        kind: "error",
        message:
          "Use um nome interno de 1 a 120 caracteres, sem URLs temporárias ou dados de imagem.",
      });
      return;
    }
    const validation = hamburgueriaPrototypeDocumentSchema.safeParse(document);
    if (!validation.success) {
      onErrors(
        Object.fromEntries(
          validation.error.issues.map((issue) => [
            issue.path.join("."),
            issue.message,
          ]),
        ),
      );
      setStatus({
        kind: "error",
        message: "Revise os campos inválidos antes de salvar.",
      });
      return;
    }
    onErrors({});
    const submitted = structuredClone(document);
    const submittedName = name;
    inFlight.current = true;
    setStatus({
      kind: version ? "versioning" : "saving",
      message: version ? "Preparando versão…" : "Salvando…",
    });
    try {
      const result = await persistEditorOperation({
        id: initial.id,
        revision,
        name: submittedName,
        document: submitted,
        version,
        dirty,
        uploads,
        getFile: temporaryImages.getFile,
        saveDraft: savePrototypeDraftAction,
        createVersion: createPrototypeVersionAction,
        onProgress: (done, total) =>
          setStatus({
            kind: version ? "versioning" : "saving",
            message: total
              ? `Enviando imagens (${done + 1}/${total})…`
              : version
                ? "Salvando e criando versão…"
                : "Salvando rascunho…",
          }),
        onSaved: (saved, resolved, replacements) => {
          // Only replace IDs still present in the current document; preserve edits typed while waiting.
          dispatch({ type: "images/persisted", replacements });
          setRevision(saved.draftRevision);
          setSnapshot(serializeEditorDraft(resolved, submittedName));
        },
      });
      if (!result.success) {
        if (result.fieldErrors)
          onErrors(editorPersistenceErrors(result.fieldErrors));
        setStatus({
          kind: result.code === "CONFLICT" ? "conflict" : "error",
          message: result.error,
        });
        return;
      }
      setStatus(
        result.kind === "version-created"
          ? {
              kind: "version-created",
              message: `Versão ${result.version.number} criada.`,
              versionId: result.version.id,
            }
          : { kind: "saved", message: "Rascunho salvo com sucesso." },
      );
    } catch (cause) {
      if (cause instanceof z.ZodError)
        onErrors(
          Object.fromEntries(
            cause.issues.map((issue) => [issue.path.join("."), issue.message]),
          ),
        );
      setStatus({
        kind: "error",
        message:
          cause instanceof z.ZodError
            ? "Revise os campos inválidos antes de salvar."
            : `${cause instanceof Error ? cause.message : "Falha na conexão ao salvar."} Suas alterações locais foram mantidas. Tente novamente.`,
      });
    } finally {
      inFlight.current = false;
    }
  }

  return {
    name,
    setName,
    revision,
    status,
    busy,
    dirty,
    hasTemporaryImages: hasTemporaryImages(document),
    uploads: uploads.getResolvedUploads(),
    save: () => perform(false),
    createVersion: () => perform(true),
  };
}
