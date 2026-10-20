import { hexColorSchema } from "../../schemas/prototype-base.schema";
import { reduceEditorMenu, type EditorMenuAction } from "./editor-menu-document";
import { reduceEditorSections, type EditorSectionAction } from "./editor-section-document";
import { brasaBurgerDefaultDocument } from "../../templates/hamburgueria/data/default-document";
import {
  hamburgueriaPrototypeDocumentSchema,
  type HamburgueriaPrototypeDocument,
  type HamburgueriaSectionId,
} from "../../templates/hamburgueria/schema/hamburgueria.schema";

export type ColorField = keyof HamburgueriaPrototypeDocument["appearance"]["colors"];
export type FontField = keyof HamburgueriaPrototypeDocument["appearance"]["fonts"];
export type FontKey = HamburgueriaPrototypeDocument["appearance"]["fonts"][FontField];
export type ContactField = keyof HamburgueriaPrototypeDocument["contact"];
export type HeroTextField = "eyebrow" | "primaryCtaLabel" | "secondaryCtaLabel";
export type EditorErrors = Record<string, string>;

export type EditorDocumentAction =
  | EditorMenuAction
  | EditorSectionAction
  | { type: "color"; field: ColorField; value: string }
  | { type: "font"; field: FontField; value: FontKey }
  | { type: "business"; field: "name" | "tagline"; value: string }
  | { type: "brandLine"; index: 0 | 1; value: string }
  | { type: "hero"; field: HeroTextField; value: string }
  | { type: "heroHeadline" | "heroDescription"; index: 0 | 1; value: string }
  | { type: "headerButton" | "finalButton"; value: string }
  | { type: "contact"; field: ContactField; value: string }
  | { type: "section"; field: HamburgueriaSectionId; value: boolean }
  | { type: "reset" };

export function createEditorDocument(): HamburgueriaPrototypeDocument {
  return structuredClone(brasaBurgerDefaultDocument);
}

export function editorDocumentReducer(
  document: HamburgueriaPrototypeDocument,
  action: EditorDocumentAction,
): HamburgueriaPrototypeDocument {
  switch (action.type) {
    case "color":
      return { ...document, appearance: { ...document.appearance, colors: { ...document.appearance.colors, [action.field]: action.value } } };
    case "font":
      return { ...document, appearance: { ...document.appearance, fonts: { ...document.appearance.fonts, [action.field]: action.value } } };
    case "business":
      return { ...document, business: { ...document.business, [action.field]: action.value } };
    case "brandLine": {
      const lines: [string, string] = [...document.business.brandLines];
      lines[action.index] = action.value;
      return { ...document, business: { ...document.business, brandLines: lines } };
    }
    case "hero":
      return { ...document, content: { ...document.content, hero: { ...document.content.hero, [action.field]: action.value } } };
    case "heroHeadline":
    case "heroDescription": {
      const field = action.type === "heroHeadline" ? "headline" : "description";
      const lines: [string, string] = [...document.content.hero[field]];
      lines[action.index] = action.value;
      return { ...document, content: { ...document.content, hero: { ...document.content.hero, [field]: lines } } };
    }
    case "headerButton":
      return { ...document, content: { ...document.content, header: { ...document.content.header, menuButtonLabel: action.value } } };
    case "finalButton":
      return { ...document, content: { ...document.content, finalCallToAction: { ...document.content.finalCallToAction, buttonLabel: action.value } } };
    case "contact":
      return { ...document, contact: { ...document.contact, [action.field]: action.value } };
    case "section":
      return { ...document, sections: { ...document.sections, [action.field]: action.value } };
    case "reset":
      return createEditorDocument();
    default:
      return action.type.startsWith("menu/")
        ? reduceEditorMenu(document, action as EditorMenuAction)
        : reduceEditorSections(document, action as EditorSectionAction);
  }
}

const defaultSerialized = JSON.stringify(brasaBurgerDefaultDocument);

export function hasEditorChanges(document: HamburgueriaPrototypeDocument) {
  return JSON.stringify(document) !== defaultSerialized;
}

export function validateEditorDocument(document: HamburgueriaPrototypeDocument): EditorErrors {
  const result = hamburgueriaPrototypeDocumentSchema.safeParse(document);
  if (result.success) return {};
  const errors: EditorErrors = {};
  for (const issue of result.error.issues) {
    const path = issue.path.join(".");
    if (errors[path]) continue;
    errors[path] = path.startsWith("appearance.colors.")
      ? "Use uma cor hexadecimal, como #FFF ou #FFFFFF."
      : path === "contact.instagramUrl" || path === "contact.mapsUrl"
        ? "Informe um link completo e válido ou deixe o campo vazio."
        : issue.code === "too_small"
          ? issue.origin === "number" ? `Use um valor maior ou igual a ${issue.minimum}.`
            : issue.origin === "array" ? `Mantenha pelo menos ${issue.minimum} itens.` : "Preencha este campo."
          : issue.code === "too_big"
            ? issue.origin === "number" ? `Use um valor menor ou igual a ${issue.maximum}.`
              : issue.origin === "array" ? `Use até ${issue.maximum} itens.` : `Use até ${issue.maximum} caracteres.`
            : issue.code === "invalid_format" && issue.format === "url"
              ? "Informe um link completo e válido ou deixe o campo vazio."
            : issue.message;
  }
  return errors;
}

/** A temporary invalid color stays in the draft; only its display falls back. */
export function getPreviewDocument(document: HamburgueriaPrototypeDocument): HamburgueriaPrototypeDocument {
  const colors = { ...document.appearance.colors };
  for (const field of Object.keys(colors) as ColorField[]) {
    if (!hexColorSchema.safeParse(colors[field]).success) {
      colors[field] = brasaBurgerDefaultDocument.appearance.colors[field];
    }
  }
  return { ...document, appearance: { ...document.appearance, colors } };
}

export function getColorPickerValue(value: string, field: ColorField) {
  if (!hexColorSchema.safeParse(value).success) {
    return brasaBurgerDefaultDocument.appearance.colors[field];
  }
  return value.length === 4
    ? `#${value.slice(1).split("").map(character => character.repeat(2)).join("")}`
    : value;
}
