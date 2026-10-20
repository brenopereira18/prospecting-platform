"use client";

import { Component, useEffect, useRef, useState, type MouseEvent, type ReactNode, type ErrorInfo } from "react";
import { createPortal } from "react-dom";
import { HamburgueriaRenderer } from "../../templates/hamburgueria/hamburgueria-renderer";
import type { HamburgueriaPrototypeDocument } from "../../templates/hamburgueria/schema/hamburgueria.schema";
import { connectPreviewFrame } from "./preview-frame";
import { getPreviewSectionId, selectPreviewSection, type EditorPanelSection } from "./editor-navigation";
import type { ResolvedUploadImages } from "../../templates/hamburgueria/lib/images";

export type EditorViewport = "desktop" | "mobile";

const frameHtml = '<!doctype html><html lang="pt-BR"><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>html,body{margin:0;min-height:100%}</style></head><body></body></html>';
const styleSelector = 'link[rel="stylesheet"], style';

function syncFrameStyles(target: Document) {
  target.head.querySelectorAll("[data-prospecta-preview-style]").forEach(node => node.remove());
  window.document.querySelectorAll(styleSelector).forEach(node => {
    const clone = node.cloneNode(true) as HTMLElement;
    clone.setAttribute("data-prospecta-preview-style", "");
    if (node.tagName === "LINK") {
      (clone as HTMLLinkElement).href = (node as HTMLLinkElement).href;
    }
    target.head.appendChild(clone);
  });
}

function PreviewFailure({ error, onRetry }: { error: Error; onRetry: () => void }) {
  return (
    <div role="alert" className="grid h-full min-h-60 place-content-center gap-3 bg-background p-6 text-center text-foreground">
      <p className="font-semibold">Não foi possível exibir a prévia.</p>
      <p className="text-sm text-secundary">{error.message}</p>
      <button type="button" onClick={onRetry} className="rounded-lg bg-primary px-4 py-2 text-sm text-background">Tentar novamente</button>
    </div>
  );
}

class PreviewErrorBoundary extends Component<{ children: ReactNode; onRetry: () => void }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Erro ao renderizar a prévia da hamburgueria:", error, info);
  }

  render() {
    return this.state.error
      ? <PreviewFailure error={this.state.error} onRetry={this.props.onRetry} />
      : this.props.children;
  }
}

export function HamburgueriaEditorPreview({ document: prototypeDocument, viewport, selectedSection, uploads = {} }: {
  document: HamburgueriaPrototypeDocument;
  viewport: EditorViewport;
  selectedSection: EditorPanelSection;
  uploads?: ResolvedUploadImages;
}) {
  const [frameBody, setFrameBody] = useState<HTMLElement | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [attempt, setAttempt] = useState(0);
  const frame = useRef<HTMLIFrameElement>(null);
  const selectedId = getPreviewSectionId(selectedSection, prototypeDocument.sections);

  useEffect(() => {
    if (!frameBody || error) return;
    return selectPreviewSection(frameBody.ownerDocument, selectedId);
  }, [frameBody, selectedId, error]);

  useEffect(() => {
    if (!frame.current) return;
    return connectPreviewFrame(frame.current, frameDocument => {
      syncFrameStyles(frameDocument);
      setFrameBody(frameDocument.body);
    }, cause => {
      console.error("Erro ao inicializar a prévia da hamburgueria:", cause);
      setError(cause);
    });
  }, [attempt]);

  function retry() {
    setFrameBody(null);
    setError(null);
    setAttempt(value => value + 1);
  }

  useEffect(() => {
    if (!frameBody) return;
    const observer = new MutationObserver(() => {
      try {
        syncFrameStyles(frameBody.ownerDocument);
      } catch (cause) {
        const error = cause instanceof Error ? cause : new Error(String(cause));
        console.error("Erro ao atualizar os estilos da prévia:", error);
        setError(error);
      }
    });
    observer.observe(window.document.head, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["href", "media"],
    });
    return () => observer.disconnect();
  }, [frameBody]);

  function handleAnchorClick(event: MouseEvent<HTMLDivElement>) {
    if (event.defaultPrevented) return;
    // Elements belong to the iframe's realm, so avoid parent-window instanceof checks.
    const anchor = (event.target as Element).closest?.('a[href^="#"]');
    const href = anchor?.getAttribute("href");
    if (!href || !frameBody) return;
    event.preventDefault();
    // srcDoc inherits the parent's base URL. Keep section anchors inside the preview.
    const target = frameBody.ownerDocument.getElementById(href.slice(1));
    target?.scrollIntoView({ block: "start" });
    if (href === "#conteudo" && target) {
      target.tabIndex = -1;
      target.focus({ preventScroll: true });
    }
  }

  return (
    <section className="flex min-h-0 min-w-0 flex-col bg-background" aria-label="Prévia da landing page">
      <div className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-sidebar-hover px-5 text-xs">
        <span className="flex items-center gap-2 text-secundary"><span className="h-1.5 w-1.5 rounded-full bg-primary" />Prévia em tempo real</span>
        <span className="text-secundary">{viewport === "mobile" ? "390 px" : "Largura disponível"}</span>
      </div>
      <div className="custom-scrollbar min-h-0 flex-1 overflow-auto p-4 lg:p-6">
        <PreviewErrorBoundary key={attempt} onRetry={retry}>
        <div className="relative mx-auto h-full min-h-60 overflow-hidden rounded-lg bg-white shadow-xl ring-1 ring-sidebar-hover"
          style={{ width: viewport === "mobile" ? 390 : "100%", minWidth: viewport === "mobile" ? 390 : undefined }}>
          {error && <div className="absolute inset-0 z-10"><PreviewFailure error={error} onRetry={retry} /></div>}
          {!frameBody && !error && <p className="absolute inset-0 grid place-items-center text-sm text-gray-600" role="status">Carregando prévia…</p>}
          <iframe ref={frame} key={attempt} title={`Prévia de ${prototypeDocument.business.name || "hamburgueria"}`} srcDoc={frameHtml}
            className="block h-full w-full border-0" />
          {frameBody && !error && createPortal(
        <div onClick={handleAnchorClick}>
          <HamburgueriaRenderer document={prototypeDocument} resolveUpload={assetId => uploads[assetId]} />
        </div>,
        frameBody,
          )}
        </div>
        </PreviewErrorBoundary>
      </div>
    </section>
  );
}
