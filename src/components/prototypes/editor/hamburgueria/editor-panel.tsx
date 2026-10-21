"use client";

import {
  HAMBURGUERIA_FONT_KEYS,
  type HamburgueriaSectionId,
} from "../../templates/hamburgueria/schema/hamburgueria.schema";
import {
  getColorPickerValue,
  type FontKey,
} from "./editor-document";

import { Field, TextField, fieldId, inputClass, type PanelProps } from "./editor-fields";
import { EditorMenuPanel } from "./editor-menu-panel";
import { ReviewsFields, FaqFields, QualitiesFields } from "./editor-social-sections";
import { StoryFields, ServiceFields, LocationFields } from "./editor-business-sections";
import { FooterFields, HeroDetailsFields, FinalCallToActionFields } from "./editor-commercial-sections";
import { BrandFields } from "./editor-shared-fields";
import { NumberField } from "./editor-number-fields";
import { sectionField } from "./editor-section-document";
import { editorSections, isContentSection, type EditorPanelSection } from "./editor-navigation";
import { getWhatsAppUrl } from "../../templates/hamburgueria/lib/format";
import { EditorImagePicker } from "./editor-image-picker";
import { TEMPORARY_IMAGE_NOTICE } from "./temporary-images";

const fontNames: Record<FontKey, string> = {
  barlow: "Barlow",
  "barlow-condensed": "Barlow Condensed",
  caveat: "Caveat",
};
const sectionNames = {
  hero: "Início / Hero",
  qualities: "Diferenciais",
  menu: "Cardápio",
  story: "Nossa História",
  howToOrder: "Como Pedir",
  reviews: "Avaliações",
  location: "Localização",
  faq: "Perguntas Frequentes",
  finalCallToAction: "Chamada Final",
} satisfies Record<HamburgueriaSectionId, string>;

function AppearanceFields({ document, dispatch, errors, onValidate, temporaryImages }: PanelProps) {
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
      <details className="space-y-4 border-t border-sidebar-hover pt-5">
        <summary className="cursor-pointer text-sm font-semibold">Imagem de compartilhamento</summary>
        <p className="text-xs text-secundary">Imagem opcional do SEO para compartilhamento em redes sociais. Não aparece no conteúdo da página.</p>
        <EditorImagePicker document={document} dispatch={dispatch} errors={errors} onValidate={onValidate} temporaryImages={temporaryImages} target={{ kind: "social" }} label="Imagem de compartilhamento" />
      </details>
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

function HeroFields({ document, dispatch, errors, onValidate, temporaryImages }: PanelProps) {
  const common = { errors, onValidate };
  const { content } = document;
  return (
    <div className="space-y-7">

      <fieldset className="space-y-4 border-t border-sidebar-hover pt-5">
        <legend className="text-sm font-semibold">Abertura</legend>
        <TextField {...common} path="content.hero.eyebrow" label="Texto de abertura" value={content.hero.eyebrow} onChange={value => dispatch({ type: "hero", field: "eyebrow", value })} />
        {([0, 1] as const).map(index => <TextField {...common} key={`headline-${index}`} path={`content.hero.headline.${index}`} label={`Título · linha ${index + 1}`} value={content.hero.headline[index]} onChange={value => dispatch({ type: "heroHeadline", index, value })} />)}
        {([0, 1] as const).map(index => <TextField {...common} key={`description-${index}`} multiline path={`content.hero.description.${index}`} label={`Descrição · linha ${index + 1}`} value={content.hero.description[index]} onChange={value => dispatch({ type: "heroDescription", index, value })} />)}
      </fieldset>
      <fieldset className="space-y-4 border-t border-sidebar-hover pt-5">
        <legend className="text-sm font-semibold">Botões principais</legend>
        <TextField {...common} path="content.hero.primaryCtaLabel" label="Botão principal da abertura" value={content.hero.primaryCtaLabel} onChange={value => dispatch({ type: "hero", field: "primaryCtaLabel", value })} />
        <TextField {...common} path="content.hero.secondaryCtaLabel" label="Botão secundário da abertura" value={content.hero.secondaryCtaLabel} onChange={value => dispatch({ type: "hero", field: "secondaryCtaLabel", value })} />
      </fieldset>
      <HeroDetailsFields {...{ document, dispatch, errors, onValidate }} />
      <EditorImagePicker {...{ document, dispatch, errors, onValidate, temporaryImages }} target={{ kind: "hero" }} label="Imagem principal" />
    </div>
  );
}

function HeaderFields(props: PanelProps) {
  return <div className="space-y-6">
    <h2 className="text-sm font-semibold">Cabeçalho</h2>
    <BrandFields {...props} />
    <NumberField {...props} path="business.foundedYear" label="Ano exibido em Desde (opcional)" value={props.document.business.foundedYear} min={1800} max={2200} integer onChange={value => props.dispatch(sectionField("business.foundedYear", value))} />
    {props.document.business.foundedYear !== undefined && <button type="button" className="text-xs text-secundary underline" onClick={() => props.dispatch(sectionField("business.foundedYear", undefined))}>Ocultar ano de fundação não confirmado</button>}
    <TextField {...props} path="content.header.menuButtonLabel" label="Botão do cabeçalho" value={props.document.content.header.menuButtonLabel} onChange={value => props.dispatch({ type: "headerButton", value })} />
    <p className="text-xs text-secundary">Os links da navegação acompanham as seções habilitadas em Visibilidade.</p>
  </div>;
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

export function HamburgueriaEditorPanel({ selectedSection, onSelectSection, ...props }: PanelProps & {
  selectedSection: EditorPanelSection;
  onSelectSection: (section: EditorPanelSection) => void;
}) {
  const errorCount = Object.keys(props.errors).length;
  const contentSection = isContentSection(selectedSection) ? selectedSection : null;
  return (
    <aside className="flex min-h-0 flex-col border-r border-sidebar-hover bg-card max-md:border-r-0 max-md:border-b" aria-label="Configurações do protótipo">
      <div className="border-b border-sidebar-hover px-4 pt-5">
        <h2 className="text-sm font-semibold">Personalizar página</h2>
        {props.temporaryImages && <p className="mt-2 text-xs leading-relaxed text-amber-300">{TEMPORARY_IMAGE_NOTICE}</p>}
        <label htmlFor="editor-panel-section" className="mt-4 block text-xs text-secundary">Seção da página</label>
        <select id="editor-panel-section" value={selectedSection} onChange={event => onSelectSection(event.target.value as EditorPanelSection)} className={`${inputClass} my-3`}>
          {editorSections.map(([key, label]) => <option key={key} value={key}>{label}{isContentSection(key) && !props.document.sections[key] ? " (oculta)" : ""}</option>)}
        </select>
        {!getWhatsAppUrl(props.document.contact.whatsapp ?? "", "") && <p role="status" className="mb-4 text-xs leading-relaxed text-amber-300">
          WhatsApp não configurado ou inválido. Os pedidos estão desativados. Informe o número com DDI e DDD em Como Pedir → Canal de pedidos.
        </p>}
      </div>
      <div key={selectedSection} className="custom-scrollbar min-h-0 flex-1 overflow-y-auto p-5">
        {contentSection && <div className="mb-5 space-y-2 border-b border-sidebar-hover pb-4">
          <label className="flex items-center justify-between gap-3 text-sm">
            Exibir esta seção
            <input type="checkbox" checked={props.document.sections[contentSection]} onChange={event => props.dispatch({ type: "section", field: contentSection, value: event.target.checked })} className="h-4 w-4 accent-primary" />
          </label>
          {!props.document.sections[contentSection] && <p className="text-xs text-secundary">Seção oculta na prévia. Você pode editar o conteúdo e reativá-la aqui.</p>}
        </div>}
        {selectedSection === "appearance" && <AppearanceFields {...props} />}
        {selectedSection === "header" && <HeaderFields {...props} />}
        {selectedSection === "hero" && <HeroFields {...props} />}
        {selectedSection === "menu" && <EditorMenuPanel {...props} />}
        {selectedSection === "qualities" && <QualitiesFields {...props} />}
        {selectedSection === "story" && <StoryFields {...props} />}
        {selectedSection === "howToOrder" && <ServiceFields {...props} />}
        {selectedSection === "reviews" && <ReviewsFields {...props} />}
        {selectedSection === "location" && <LocationFields {...props} />}
        {selectedSection === "faq" && <FaqFields {...props} />}
        {selectedSection === "finalCallToAction" && <FinalCallToActionFields {...props} />}
        {selectedSection === "footer" && <FooterFields {...props} />}
        {selectedSection === "visibility" && <SectionFields {...props} />}
      </div>
      <div className="border-t border-sidebar-hover px-5 py-3 text-xs text-secundary" aria-live="polite">
        {errorCount ? <span className="text-red-300">{errorCount} {errorCount === 1 ? "campo para revisar" : "campos para revisar"}</span> : "Alterações apenas nesta sessão."}
      </div>
    </aside>
  );
}
