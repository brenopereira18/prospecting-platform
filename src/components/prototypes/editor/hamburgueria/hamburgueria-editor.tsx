"use client";

import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { Monitor, RotateCcw, Smartphone } from "lucide-react";
import {
  createEditorDocument,
  editorDocumentReducer,
  getPreviewDocument,
  validateEditorDocument,
  type EditorErrors,
} from "./editor-document";
import { HamburgueriaEditorPanel } from "./editor-panel";
import type { EditorPanelSection } from "./editor-navigation";
import { HamburgueriaEditorPreview, type EditorViewport } from "./editor-preview";
import { useTemporaryImages } from "./use-temporary-images";
import type { PrototypeDTO } from "@/src/server/prototypes/prototype.dto";
import { usePrototypePersistence } from "./use-prototype-persistence";
import { EditorPersistenceControls } from "./editor-persistence-controls";
import Link from "next/link";

export function HamburgueriaEditor({ initialPrototype }: { initialPrototype?: PrototypeDTO } = {}) {
  const [document, dispatch] = useReducer(editorDocumentReducer, initialPrototype, initial => initial ? structuredClone(initial.draftDocument) : createEditorDocument());
  const temporaryImages = useTemporaryImages(document);
  const [viewport, setViewport] = useState<EditorViewport>("desktop");
  const [errors, setErrors] = useState<EditorErrors>({});
  const [selectedSection, setSelectedSection] = useState<EditorPanelSection>("appearance");
  const confirmation = useRef<HTMLDialogElement>(null);
  const persistence = usePrototypePersistence(document, initialPrototype, setErrors);
  const { dirty } = persistence;
  const previewDocument = useMemo(() => getPreviewDocument(document), [document]);

  useEffect(() => {
    const timeout = window.setTimeout(() => setErrors(validateEditorDocument(document)), 400);
    return () => window.clearTimeout(timeout);
  }, [document]);

  return (
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-background text-foreground">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-4 border-b border-sidebar-hover bg-card px-5 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <span aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/15 text-lg font-semibold text-primary">P</span>
          <div className="min-w-0">
            <p className="text-xs text-secundary">Prospecta · Editor de protótipo</p>
            <h1 className="mt-0.5 max-w-72 truncate text-sm font-semibold">{document.business.name || "Protótipo sem nome"}</h1>
          </div>
          <span className="ml-2 hidden rounded-full border border-sidebar-hover px-2.5 py-1 text-[11px] text-secundary xl:block">{initialPrototype ? "Protótipo privado" : "Desenvolvimento"}</span>
        </div>
        <div className="flex flex-wrap items-center gap-3 sm:gap-5">
          <div className="flex rounded-lg border border-sidebar-hover bg-background p-1" role="group" aria-label="Visualização da prévia">
            {([ ["desktop", "Desktop", Monitor], ["mobile", "Mobile", Smartphone] ] as const).map(([mode, label, Icon]) => (
              <button type="button" key={mode} aria-pressed={viewport === mode} onClick={() => setViewport(mode)}
                className={`flex min-h-8 items-center gap-2 rounded-md px-3 text-xs font-medium focus-visible:outline-2 focus-visible:outline-primary ${viewport === mode ? "bg-sidebar-hover text-foreground" : "text-secundary hover:text-foreground"}`}>
                <Icon size={15} aria-hidden="true" />{label}
              </button>
            ))}
          </div>
          <span className={`flex items-center gap-2 text-xs ${dirty ? "text-amber-300" : "text-secundary"}`} role="status">
            <span className={`h-1.5 w-1.5 rounded-full ${dirty ? "bg-amber-300" : "bg-secundary"}`} />
            {persistence.busy ? persistence.status.message : dirty ? "Alterações não salvas" : initialPrototype ? "Salvo" : "Documento padrão"}
          </span>
          <button type="button" onClick={() => confirmation.current?.showModal()}
            className="flex min-h-9 items-center gap-2 rounded-lg border border-sidebar-hover px-3 text-xs font-medium hover:bg-sidebar-hover focus-visible:outline-2 focus-visible:outline-primary">
            <RotateCcw size={14} aria-hidden="true" />Restaurar padrão
          </button>
        </div>
      </header>
      {initialPrototype ? <EditorPersistenceControls id={initialPrototype.id} persistence={persistence} /> : <div className="shrink-0 border-b border-sidebar-hover px-5 py-2 text-xs text-secundary">Playground local · <Link href="/prototipos" className="underline">Abrir meus protótipos e criar um rascunho persistido</Link></div>}
      {initialPrototype && document.demo.enabled && <p className="shrink-0 border-b border-sidebar-hover px-5 py-2 text-xs text-secundary">Conteúdo demonstrativo: revise produtos, preços, depoimentos, imagens e dados do estabelecimento antes da publicação.</p>}
      <div className="grid min-h-0 flex-1 grid-cols-[340px_minmax(0,1fr)] max-lg:grid-cols-[300px_minmax(0,1fr)] max-md:grid-cols-1 max-md:grid-rows-[minmax(0,40%)_minmax(0,1fr)]">
        <HamburgueriaEditorPanel selectedSection={selectedSection} onSelectSection={setSelectedSection} document={document} dispatch={dispatch} errors={errors} temporaryImages={temporaryImages} onValidate={() => setErrors(validateEditorDocument(document))} />
        <HamburgueriaEditorPreview selectedSection={selectedSection} document={previewDocument} viewport={viewport} uploads={temporaryImages.uploads} />
      </div>
      <dialog ref={confirmation} aria-labelledby="restore-title"
        className="m-auto w-[calc(100%_-_32px)] max-w-md rounded-2xl border border-sidebar-hover bg-card p-6 text-foreground backdrop:bg-black/60">
        <h2 id="restore-title" className="text-lg font-semibold">Restaurar documento padrão?</h2>
        <p className="mt-3 text-sm leading-relaxed text-secundary">As alterações locais serão descartadas e a Brasa Burger voltará aos valores originais.</p>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={() => confirmation.current?.close()} className="min-h-10 rounded-lg border border-sidebar-hover px-4 text-sm hover:bg-sidebar-hover focus-visible:outline-2 focus-visible:outline-primary">Cancelar</button>
          <button type="button" onClick={() => {
            dispatch({ type: "reset" });
            setErrors({});
            confirmation.current?.close();
          }} className="min-h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-background hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">Restaurar padrão</button>
        </div>
      </dialog>
    </div>
  );
}
