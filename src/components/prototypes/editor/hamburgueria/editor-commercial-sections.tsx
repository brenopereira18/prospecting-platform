"use client";

import type { HamburgueriaSectionId } from "../../templates/hamburgueria/schema/hamburgueria.schema";
import { TextField, type PanelProps } from "./editor-fields";
import { NumberField } from "./editor-number-fields";
import { EditorSelect, SectionTextFields } from "./editor-section-fields";
import { sectionField } from "./editor-section-document";
import { BrandFields, ReviewSummaryFields } from "./editor-shared-fields";

export function HeroDetailsFields(props: PanelProps) {
  return (
    <details className="space-y-4 border-t border-sidebar-hover pt-5">
      <summary className="cursor-pointer text-sm font-semibold">
        Selos e informações da abertura
      </summary>
      <SectionTextFields
        {...props}
        fields={[
          ["content.hero.badgeText", "Texto do selo"],
          ["content.hero.badgeLines.0", "Selo · linha 1"],
          ["content.hero.badgeLines.1", "Selo · linha 2"],
          ["content.hero.bottomNote", "Frase abaixo da abertura"],
          [
            "content.hero.reviewStarsLabel",
            "Descrição das estrelas · aceita {rating}",
          ],
          [
            "content.hero.reviewCountLabel",
            "Descrição da contagem · aceita {count}",
          ],
          ["content.hero.hoursSummary", "Resumo de horários exibido no Hero"],
          [
            "content.hero.serviceSummary",
            "Resumo de atendimento exibido no Hero",
          ],
        ]}
      />
      <ReviewSummaryFields {...props} />
    </details>
  );
}

export function FooterFields(props: PanelProps) {
  const { footer } = props.document.content;
  const targets = Object.keys(
    props.document.sections,
  ) as HamburgueriaSectionId[];
  const names: Record<HamburgueriaSectionId, string> = {
    hero: "Abertura",
    qualities: "Qualidades",
    menu: "Cardápio",
    story: "História",
    howToOrder: "Como pedir",
    reviews: "Avaliações",
    location: "Localização",
    faq: "Perguntas frequentes",
    finalCallToAction: "Chamada final",
  };
  return (
    <div className="space-y-6">
      <h2 className="text-sm font-semibold">Rodapé</h2>
      <BrandFields {...props} />
      <TextField
        {...props}
        path="business.tagline"
        label="Slogan exibido no rodapé"
        value={props.document.business.tagline}
        onChange={(value) =>
          props.dispatch({ type: "business", field: "tagline", value })
        }
      />
      <details className="space-y-4">
        <summary className="cursor-pointer text-sm">Textos do rodapé</summary>
        <SectionTextFields
          {...props}
          fields={[
            ["content.footer.navigationHeading", "Título da navegação"],
            ["content.footer.serviceHeading", "Título do atendimento"],
            ["content.footer.faqLinkLabel", "Texto do link para dúvidas"],
            ["content.footer.serviceLines.0", "Atendimento · linha 1"],
            ["content.footer.serviceLines.1", "Atendimento · linha 2"],
            ["content.footer.signature.0", "Assinatura · linha 1"],
            ["content.footer.signature.1", "Assinatura · linha 2"],
            ["content.footer.buttonLabel", "Botão do rodapé"],
          ]}
        />
        <NumberField
          {...props}
          path="content.footer.copyrightYear"
          label="Ano dos direitos autorais"
          value={footer.copyrightYear}
          min={2000}
          max={2200}
          integer
          onChange={(value) =>
            props.dispatch(sectionField("content.footer.copyrightYear", value))
          }
        />
      </details>
      <details className="space-y-4">
        <summary className="cursor-pointer text-sm">Links do rodapé</summary>
        {([0, 1, 2] as const).map((index) => (
          <div
            key={index}
            className="space-y-4 border-b border-sidebar-hover pb-4"
          >
            <SectionTextFields
              {...props}
              fields={[
                [
                  `content.footer.navigationLinks.${index}.label`,
                  `Texto do link ${index + 1}`,
                ],
              ]}
            />
            <EditorSelect
              {...props}
              path={`content.footer.navigationLinks.${index}.target`}
              label={`Destino do link ${index + 1}`}
              value={footer.navigationLinks[index].target}
              options={targets.map(
                (target) => [target, names[target]] as const,
              )}
              onChange={(value) =>
                props.dispatch(
                  sectionField(
                    `content.footer.navigationLinks.${index}.target`,
                    value as HamburgueriaSectionId,
                  ),
                )
              }
            />
          </div>
        ))}
        <p className="text-xs text-secundary">
          Links para seções desativadas são ocultados automaticamente na prévia.
        </p>
      </details>
      <details className="space-y-4">
        <summary className="cursor-pointer text-sm">
          Nota interna do rodapé
        </summary>
        <SectionTextFields
          {...props}
          fields={[
            [
              "content.demoCopy.footerDisclaimer",
              "Nota de revisão (não aparece na página)",
              true,
            ],
          ]}
        />
      </details>
    </div>
  );
}

export function FinalCallToActionFields(props: PanelProps) {
  return (
    <div className="space-y-6">
      <h2 className="text-sm font-semibold">Chamada Final</h2>
      <SectionTextFields
        {...props}
        fields={[
          ["content.finalCallToAction.eyebrow", "Texto de abertura da chamada"],
          ["content.finalCallToAction.title", "Título da chamada final"],
        ]}
      />
      <TextField
        {...props}
        path="content.finalCallToAction.buttonLabel"
        label="Botão da chamada final"
        value={props.document.content.finalCallToAction.buttonLabel}
        onChange={(value) => props.dispatch({ type: "finalButton", value })}
      />
    </div>
  );
}
