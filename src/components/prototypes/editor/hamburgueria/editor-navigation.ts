import { sectionAnchors, structuralSectionIds } from "../../templates/hamburgueria/lib/navigation";
import type { HamburgueriaPrototypeDocument, HamburgueriaSectionId } from "../../templates/hamburgueria/schema/hamburgueria.schema";

export type EditorPanelSection = "appearance" | "header" | HamburgueriaSectionId | "footer" | "visibility";
export const editorSections = [
  ["appearance", "Aparência global"], ["header", "Cabeçalho"], ["hero", "Início / Hero"],
  ["qualities", "Diferenciais"], ["menu", "Cardápio"], ["story", "Nossa História"],
  ["howToOrder", "Como Pedir"], ["reviews", "Avaliações"], ["location", "Localização"],
  ["faq", "Perguntas Frequentes"], ["finalCallToAction", "Chamada Final"], ["footer", "Rodapé"],
  ["visibility", "Visibilidade das seções"],
] as const satisfies readonly (readonly [EditorPanelSection, string])[];

export function isContentSection(section: EditorPanelSection): section is HamburgueriaSectionId {
  return Object.hasOwn(sectionAnchors, section);
}

export function getPreviewSectionId(section: EditorPanelSection, visibility: HamburgueriaPrototypeDocument["sections"]): string | null {
  if (section === "header" || section === "footer") return structuralSectionIds[section];
  return isContentSection(section) && visibility[section] ? sectionAnchors[section].slice(1) : null;
}

/** Only called for the editor's iframe; never changes a published template. */
export function selectPreviewSection(document: Document, id: string | null): () => void {
  const target = id ? document.getElementById(id) : null;
  if (!target) return () => {};
  const style = document.createElement("style");
  style.setAttribute("data-prospecta-editor-selection", "");
  style.textContent = '[data-prospecta-selected-section]{outline:2px solid var(--primary,#4fbc99);outline-offset:-2px}';
  document.head.appendChild(style);
  target.setAttribute("data-prospecta-selected-section", "");
  const window = document.defaultView;
  if (window) {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: Math.max(0, target.getBoundingClientRect().top + window.scrollY), behavior: reduced ? "instant" : "smooth" });
  }
  return () => { target.removeAttribute("data-prospecta-selected-section"); style.remove(); };
}
