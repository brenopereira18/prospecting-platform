"use client";

import { useState, type Dispatch, type ReactNode } from "react";
import {
  HAMBURGUERIA_FONT_KEYS,
  type HamburgueriaPrototypeDocument,
  type HamburgueriaSectionId,
} from "../../templates/hamburgueria/schema/hamburgueria.schema";
import {
  getColorPickerValue,
  type EditorDocumentAction,
  type EditorErrors,
  type FontKey,
} from "./editor-document";

interface PanelProps {
  document: HamburgueriaPrototypeDocument;
  dispatch: Dispatch<EditorDocumentAction>;
  errors: EditorErrors;
  onValidate: () => void;
}

const inputClass = "min-h-10 w-full min-w-0 rounded-lg border border-sidebar-hover bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-secundary/60 focus:border-primary focus:ring-2 focus:ring-primary/15 aria-invalid:border-red-400";
const fontNames: Record<FontKey, string> = {
  barlow: "Barlow",
  "barlow-condensed": "Barlow Condensed",
  caveat: "Caveat",
};
const sectionNames = {
  hero: "Abertura (Hero)",
  qualities: "Qualidades",
  menu: "Cardápio",
  story: "História e destaque",
  howToOrder: "Como pedir",
  reviews: "Avaliações",
  location: "Localização",
  faq: "Dúvidas frequentes",
  finalCallToAction: "Chamada final",
} satisfies Record<HamburgueriaSectionId, string>;

function fieldId(path: string) {
  return `editor-${path.replaceAll(".", "-")}`;
}

function Field({ path, label, error, children }: {
  path: string; label: string; error?: string; children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={fieldId(path)} className="block text-xs font-medium text-foreground">{label}</label>
      {children}
      {error && <p id={`${fieldId(path)}-error`} className="text-xs leading-relaxed text-red-300">{error}</p>}
    </div>
  );
}

function TextField({ path, label, value, onChange, multiline, inputMode, errors, onValidate }: {
  path: string; label: string; value: string; onChange: (value: string) => void;
  multiline?: boolean; inputMode?: "tel" | "url";
  errors: EditorErrors; onValidate: () => void;
}) {
  const props = {
    id: fieldId(path),
    value,
    className: inputClass,
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(event.target.value),
    onBlur: onValidate,
    "aria-invalid": Boolean(errors[path]),
    "aria-describedby": errors[path] ? `${fieldId(path)}-error` : undefined,
  };
  return (
    <Field path={path} label={label} error={errors[path]}>
      {multiline ? <textarea {...props} rows={2} /> : <input {...props} type="text" inputMode={inputMode} />}
    </Field>
  );
}

function AppearanceFields({ document, dispatch, errors, onValidate }: PanelProps) {
  return (
    <div className="space-y-7">
      <fieldset className="space-y-4">
        <legend className="mb-4 text-sm font-semibold">Cores da marca</legend>
        {([ ["primary", "Cor primária"], ["secondary", "Cor secundária"], ["tertiary", "Cor terciária"] ] as const).map(([field, label]) => {
          const path = `appearance.colors.${field}`;
          const value = document.appearance.colors[field];
          return (
            <Field key={field} path={path} label={label} error={errors[path]}>
              <div className="flex gap-2">
                <input type="color" aria-label={`Selecionar ${label.toLowerCase()}`} value={getColorPickerValue(value, field)}
                  onChange={event => dispatch({ type: "color", field, value: event.target.value })} onBlur={onValidate}
                  className="h-10 w-11 shrink-0 cursor-pointer rounded-lg border border-sidebar-hover bg-background p-1" />
                <input id={fieldId(path)} type="text" spellCheck={false} value={value} placeholder="#FFFFFF"
                  aria-invalid={Boolean(errors[path])} aria-describedby={errors[path] ? `${fieldId(path)}-error` : undefined}
                  onChange={event => dispatch({ type: "color", field, value: event.target.value })} onBlur={onValidate}
                  className={`${inputClass} font-mono`} />
              </div>
            </Field>
          );
        })}
      </fieldset>
      <fieldset className="space-y-4 border-t border-sidebar-hover pt-5">
        <legend className="text-sm font-semibold">Tipografia</legend>
        {([ ["display", "Fonte dos títulos"], ["body", "Fonte dos textos"], ["hand", "Fonte decorativa"] ] as const).map(([field, label]) => {
          const path = `appearance.fonts.${field}`;
          return (
            <Field key={field} path={path} label={label} error={errors[path]}>
              <select id={fieldId(path)} value={document.appearance.fonts[field]} className={inputClass}
                onChange={event => dispatch({ type: "font", field, value: event.target.value as FontKey })} onBlur={onValidate}>
                {HAMBURGUERIA_FONT_KEYS.map(key => <option key={key} value={key}>{fontNames[key]}</option>)}
              </select>
            </Field>
          );
        })}
      </fieldset>
    </div>
  );
}

function ContentFields({ document, dispatch, errors, onValidate }: PanelProps) {
  const common = { errors, onValidate };
  const { business, content, contact } = document;
  return (
    <div className="space-y-7">
      <fieldset className="space-y-4">
        <legend className="mb-4 text-sm font-semibold">Estabelecimento</legend>
        <TextField {...common} path="business.name" label="Nome do estabelecimento" value={business.name} onChange={value => dispatch({ type: "business", field: "name", value })} />
        <TextField {...common} path="business.tagline" label="Slogan" value={business.tagline} onChange={value => dispatch({ type: "business", field: "tagline", value })} />
        {([0, 1] as const).map(index => <TextField {...common} key={index} path={`business.brandLines.${index}`} label={`Marca · linha ${index + 1}`} value={business.brandLines[index]} onChange={value => dispatch({ type: "brandLine", index, value })} />)}
      </fieldset>
      <fieldset className="space-y-4 border-t border-sidebar-hover pt-5">
        <legend className="text-sm font-semibold">Abertura</legend>
        <TextField {...common} path="content.hero.eyebrow" label="Texto de abertura" value={content.hero.eyebrow} onChange={value => dispatch({ type: "hero", field: "eyebrow", value })} />
        {([0, 1] as const).map(index => <TextField {...common} key={`headline-${index}`} path={`content.hero.headline.${index}`} label={`Título · linha ${index + 1}`} value={content.hero.headline[index]} onChange={value => dispatch({ type: "heroHeadline", index, value })} />)}
        {([0, 1] as const).map(index => <TextField {...common} key={`description-${index}`} multiline path={`content.hero.description.${index}`} label={`Descrição · linha ${index + 1}`} value={content.hero.description[index]} onChange={value => dispatch({ type: "heroDescription", index, value })} />)}
      </fieldset>
      <fieldset className="space-y-4 border-t border-sidebar-hover pt-5">
        <legend className="text-sm font-semibold">Botões principais</legend>
        <TextField {...common} path="content.header.menuButtonLabel" label="Botão do cabeçalho" value={content.header.menuButtonLabel} onChange={value => dispatch({ type: "headerButton", value })} />
        <TextField {...common} path="content.hero.primaryCtaLabel" label="Botão principal da abertura" value={content.hero.primaryCtaLabel} onChange={value => dispatch({ type: "hero", field: "primaryCtaLabel", value })} />
        <TextField {...common} path="content.hero.secondaryCtaLabel" label="Botão secundário da abertura" value={content.hero.secondaryCtaLabel} onChange={value => dispatch({ type: "hero", field: "secondaryCtaLabel", value })} />
        <TextField {...common} path="content.finalCallToAction.buttonLabel" label="Botão da chamada final" value={content.finalCallToAction.buttonLabel} onChange={value => dispatch({ type: "finalButton", value })} />
      </fieldset>
      <fieldset className="space-y-4 border-t border-sidebar-hover pt-5">
        <legend className="text-sm font-semibold">Contato</legend>
        <TextField {...common} path="contact.whatsapp" label="WhatsApp com DDI e DDD" inputMode="tel" value={contact.whatsapp ?? ""} onChange={value => dispatch({ type: "contact", field: "whatsapp", value })} />
        <TextField {...common} path="contact.instagramUrl" label="Link do Instagram" inputMode="url" value={contact.instagramUrl ?? ""} onChange={value => dispatch({ type: "contact", field: "instagramUrl", value })} />
        <TextField {...common} path="contact.instagramLabel" label="Nome exibido no Instagram" value={contact.instagramLabel ?? ""} onChange={value => dispatch({ type: "contact", field: "instagramLabel", value })} />
        <TextField {...common} path="contact.mapsUrl" label="Link do mapa" inputMode="url" value={contact.mapsUrl ?? ""} onChange={value => dispatch({ type: "contact", field: "mapsUrl", value })} />
      </fieldset>
    </div>
  );
}

function SectionFields({ document, dispatch }: PanelProps) {
  return (
    <div>
      <h2 className="text-sm font-semibold">Seções da página</h2>
      <p className="mt-2 text-xs leading-relaxed text-secundary">Escolha o que aparece na prévia. Cabeçalho e rodapé permanecem visíveis.</p>
      <div className="mt-5 divide-y divide-sidebar-hover">
        {(Object.keys(sectionNames) as HamburgueriaSectionId[]).map(field => (
          <label key={field} className="flex cursor-pointer items-center justify-between gap-4 py-4 text-sm">
            <span>{sectionNames[field]}</span>
            <input type="checkbox" checked={document.sections[field]} aria-label={`Exibir ${sectionNames[field]}`}
              onChange={event => dispatch({ type: "section", field, value: event.target.checked })}
              className="h-4 w-4 shrink-0 cursor-pointer accent-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary" />
          </label>
        ))}
      </div>
    </div>
  );
}

export function HamburgueriaEditorPanel(props: PanelProps) {
  const [tab, setTab] = useState<"appearance" | "content" | "sections">("appearance");
  const errorCount = Object.keys(props.errors).length;
  return (
    <aside className="flex min-h-0 flex-col border-r border-sidebar-hover bg-card max-md:border-r-0 max-md:border-b" aria-label="Configurações do protótipo">
      <div className="border-b border-sidebar-hover px-4 pt-5">
        <h2 className="text-sm font-semibold">Personalizar página</h2>
        <div className="mt-4 flex gap-4" role="group" aria-label="Painel de edição">
          {([ ["appearance", "Aparência"], ["content", "Conteúdo"], ["sections", "Seções"] ] as const).map(([key, label]) => (
            <button type="button" key={key} aria-pressed={tab === key} onClick={() => setTab(key)}
              className={`min-h-10 border-b-2 pb-2 text-xs font-medium focus-visible:outline-2 focus-visible:outline-primary ${tab === key ? "border-primary text-primary" : "border-transparent text-secundary hover:text-foreground"}`}>{label}</button>
          ))}
        </div>
      </div>
      <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto p-5">
        {tab === "appearance" && <AppearanceFields {...props} />}
        {tab === "content" && <ContentFields {...props} />}
        {tab === "sections" && <SectionFields {...props} />}
      </div>
      <div className="border-t border-sidebar-hover px-5 py-3 text-xs text-secundary" aria-live="polite">
        {errorCount ? <span className="text-red-300">{errorCount} {errorCount === 1 ? "campo para revisar" : "campos para revisar"}</span> : "Alterações apenas nesta sessão."}
      </div>
    </aside>
  );
}
