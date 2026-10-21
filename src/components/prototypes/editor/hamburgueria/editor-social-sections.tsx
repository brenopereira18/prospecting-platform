"use client";

import { HAMBURGUERIA_ICON_KEYS } from "../../templates/hamburgueria/schema/hamburgueria.schema";
import { TextField, type PanelProps } from "./editor-fields";
import { ItemCollection } from "./editor-collections";
import { NumberField } from "./editor-number-fields";
import {
  EditorCheck,
  EditorSelect,
  SectionTextFields,
} from "./editor-section-fields";
import type { SectionItem } from "./editor-section-document";
import { ReviewSummaryFields } from "./editor-shared-fields";

export function ReviewsFields(props: PanelProps) {
  const { document, dispatch } = props;
  const reviews = document.content.reviews;
  return (
    <div className="space-y-6">
      <h2 className="text-sm font-semibold">Avaliações</h2>
      <p className="text-xs leading-relaxed text-secundary">
        Os relatos de exemplo ficam guardados aqui. Somente depoimentos marcados
        como reais são exibidos; sem eles, a página mostra um convite à
        participação.
      </p>
      <details className="space-y-4">
        <summary className="cursor-pointer text-sm">
          Títulos e resumo das avaliações
        </summary>
        <SectionTextFields
          {...props}
          fields={[
            ["content.reviews.eyebrow", "Texto de abertura"],
            ["content.reviews.title", "Título"],
            [
              "content.reviews.starsLabel",
              "Descrição das estrelas · aceita {rating}",
            ],
            [
              "content.reviews.countLabel",
              "Texto da contagem · aceita {count}",
            ],
          ]}
        />
        <ReviewSummaryFields {...props} />
      </details>
      <details>
        <summary className="cursor-pointer text-xs text-secundary">
          Nota interna de revisão
        </summary>
        <SectionTextFields
          {...props}
          fields={[
            [
              "content.demoCopy.reviewDisclaimer",
              "Nota interna sobre avaliações (não aparece na página)",
              true,
            ],
          ]}
        />
      </details>
      <ItemCollection
        {...props}
        list="reviews"
        renderItem={(item, index) => {
          const path = `content.reviews.entries.${index}`;
          const edit = (changes: Partial<Omit<SectionItem<"reviews">, "id">>) =>
            dispatch({
              type: "sectionItem/edit",
              list: "reviews",
              id: item.id,
              changes,
            });
          return (
            <>
              <TextField
                {...props}
                path={`${path}.name`}
                label="Nome do cliente"
                value={item.name}
                onChange={(name) => edit({ name })}
              />
              <TextField
                {...props}
                path={`${path}.initials`}
                label="Iniciais do avatar"
                value={item.initials}
                onChange={(initials) => edit({ initials })}
              />
              <TextField
                {...props}
                path={`${path}.role`}
                label="Descrição do cliente"
                value={item.role}
                onChange={(role) => edit({ role })}
              />
              <TextField
                {...props}
                path={`${path}.quote`}
                label="Depoimento"
                multiline
                value={item.quote}
                onChange={(quote) => edit({ quote })}
              />
              <EditorCheck
                label="Relato real confirmado para exibição"
                value={item.demonstrative === false}
                onChange={(confirmed) => edit({ demonstrative: !confirmed })}
              />
              <p className="text-xs text-secundary">
                Confirme somente após substituir o exemplo por um relato real
                autorizado.
              </p>
              <EditorCheck
                label="Definir nota individual"
                value={item.rating !== undefined}
                onChange={(enabled) =>
                  edit({ rating: enabled ? reviews.rating : undefined })
                }
              />
              {item.rating !== undefined && (
                <NumberField
                  {...props}
                  path={`${path}.rating`}
                  label="Nota individual"
                  value={item.rating}
                  min={0}
                  max={5}
                  onChange={(rating) => edit({ rating })}
                />
              )}
              <TextField
                {...props}
                path={`${path}.sourceUrl`}
                label="Link da avaliação (opcional)"
                inputMode="url"
                value={item.sourceUrl ?? ""}
                onChange={(sourceUrl) => edit({ sourceUrl })}
              />
            </>
          );
        }}
      />
    </div>
  );
}

export function FaqFields(props: PanelProps) {
  return (
    <div className="space-y-6">
      <h2 className="text-sm font-semibold">Perguntas frequentes</h2>
      <details className="space-y-4">
        <summary className="cursor-pointer text-sm">
          Títulos e introdução
        </summary>
        <SectionTextFields
          {...props}
          fields={[
            ["content.faq.eyebrow", "Texto de abertura"],
            ["content.faq.headline.0", "Título · linha 1"],
            ["content.faq.headline.1", "Título · linha 2"],
            ["content.faq.intro.0", "Introdução · linha 1"],
            ["content.faq.intro.1", "Introdução · linha 2"],
          ]}
        />
      </details>
      <ItemCollection
        {...props}
        list="faq"
        renderItem={(item, index) => {
          const path = `content.faq.items.${index}`;
          return (
            <>
              <TextField
                {...props}
                path={`${path}.question`}
                label="Pergunta"
                value={item.question}
                onChange={(question) =>
                  props.dispatch({
                    type: "sectionItem/edit",
                    list: "faq",
                    id: item.id,
                    changes: { question },
                  })
                }
              />
              <TextField
                {...props}
                path={`${path}.answer`}
                label="Resposta"
                multiline
                value={item.answer}
                onChange={(answer) =>
                  props.dispatch({
                    type: "sectionItem/edit",
                    list: "faq",
                    id: item.id,
                    changes: { answer },
                  })
                }
              />
              <EditorCheck
                label="Nota interna (somente no editor)"
                value={item.demoOnly ?? false}
                onChange={(demoOnly) =>
                  props.dispatch({
                    type: "sectionItem/edit",
                    list: "faq",
                    id: item.id,
                    changes: { demoOnly },
                  })
                }
              />
            </>
          );
        }}
      />
    </div>
  );
}

export function QualitiesFields(props: PanelProps) {
  return (
    <div className="space-y-6">
      <h2 className="text-sm font-semibold">Qualidades e diferenciais</h2>
      <SectionTextFields
        {...props}
        fields={[
          ["content.qualities.accessibleLabel", "Descrição acessível da seção"],
        ]}
      />
      <ItemCollection
        {...props}
        list="qualities"
        renderItem={(item, index) => {
          const path = `content.qualities.items.${index}`;
          const edit = (
            changes: Partial<Omit<SectionItem<"qualities">, "id">>,
          ) =>
            props.dispatch({
              type: "sectionItem/edit",
              list: "qualities",
              id: item.id,
              changes,
            });
          return (
            <>
              <TextField
                {...props}
                path={`${path}.title`}
                label="Título"
                value={item.title}
                onChange={(title) => edit({ title })}
              />
              <TextField
                {...props}
                path={`${path}.description`}
                label="Descrição"
                multiline
                value={item.description}
                onChange={(description) => edit({ description })}
              />
              <EditorSelect
                {...props}
                path={`${path}.icon`}
                label="Ícone"
                value={item.icon}
                options={HAMBURGUERIA_ICON_KEYS.map(
                  (key) => [key, key] as const,
                )}
                onChange={(icon) =>
                  edit({ icon: icon as SectionItem<"qualities">["icon"] })
                }
              />
            </>
          );
        }}
      />
    </div>
  );
}
