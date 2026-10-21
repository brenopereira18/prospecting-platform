"use client";

import { TextField, type PanelProps } from "./editor-fields";
import { NumberField } from "./editor-number-fields";
import { EditorSelect, SectionTextFields } from "./editor-section-fields";
import { sectionField } from "./editor-section-document";
import { getReviewSummaryNotice } from "../../templates/hamburgueria/lib/reviews";

export function BusinessNameField(props: PanelProps) {
  return (
    <div className="space-y-2">
      <TextField
        {...props}
        path="business.name"
        label="Nome do estabelecimento (compartilhado)"
        value={props.document.business.name}
        onChange={(value) =>
          props.dispatch({ type: "business", field: "name", value })
        }
      />
      <p className="text-xs text-secundary">
        Usado no mapa, nas mensagens e na identificação do estabelecimento. A
        marca visual do cabeçalho e do rodapé utiliza as linhas editáveis
        abaixo.
      </p>
    </div>
  );
}

export function BrandFields(props: PanelProps) {
  return (
    <div className="space-y-4">
      <BusinessNameField {...props} />
      {([0, 1] as const).map((index) => (
        <TextField
          {...props}
          key={index}
          path={`business.brandLines.${index}`}
          label={`Marca · linha ${index + 1} (compartilhada)`}
          value={props.document.business.brandLines[index]}
          onChange={(value) =>
            props.dispatch({ type: "brandLine", index, value })
          }
        />
      ))}
      <p className="text-xs text-secundary">
        As linhas da marca são compartilhadas entre Cabeçalho e Rodapé. Ao mudar
        o nome do estabelecimento, revise também estas linhas e os textos da
        história.
      </p>
    </div>
  );
}

export function ReviewSummaryFields(props: PanelProps) {
  const { reviews } = props.document.content;
  return (
    <div className="space-y-4">
      <p className="text-xs text-secundary">
        Nota e contagem compartilhadas entre Hero e Avaliações. São
        independentes dos depoimentos exibidos.
      </p>
      <p className="text-xs text-secundary">
        {getReviewSummaryNotice(props.document)}
      </p>
      <NumberField
        {...props}
        path="content.reviews.rating"
        label="Nota geral (compartilhada)"
        value={reviews.rating}
        min={0}
        max={5}
        onChange={(value) =>
          props.dispatch(sectionField("content.reviews.rating", value))
        }
      />
      <NumberField
        {...props}
        path="content.reviews.count"
        label="Quantidade total de avaliações (compartilhada)"
        value={reviews.count}
        min={0}
        max={100_000_000}
        integer
        onChange={(value) =>
          props.dispatch(sectionField("content.reviews.count", value))
        }
      />
      {(["ratingSource", "countSource"] as const).map((field) => (
        <EditorSelect
          key={field}
          {...props}
          path={`content.reviews.${field}`}
          label={
            field === "ratingSource" ? "Origem da nota" : "Origem da quantidade"
          }
          value={reviews[field] ?? "demo"}
          options={[
            ["demo", "Exemplo ilustrativo"],
            ["lead", "Importada do lead"],
            ["provided", "Informada pelo estabelecimento"],
          ]}
          onChange={(value) =>
            props.dispatch(
              sectionField(
                `content.reviews.${field}`,
                value as "demo" | "lead" | "provided",
              ),
            )
          }
        />
      ))}
      <p className="text-xs text-secundary">
        Revise a origem ao alterar estes valores. Os depoimentos têm
        identificação própria; um link não comprova que o relato foi verificado.
      </p>
      <p className="text-xs text-secundary">
        Nota e contagem só aparecem na página quando ambas têm origem
        confirmada. Exemplos permanecem disponíveis apenas no editor.
      </p>
    </div>
  );
}

export function OrderChannelFields(
  props: PanelProps & { product?: boolean; allMessages?: boolean },
) {
  return (
    <details className="space-y-4">
      <summary className="cursor-pointer text-sm">
        Canal de pedidos (compartilhado)
      </summary>
      <TextField
        {...props}
        path="contact.phone"
        label="Telefone cadastrado (não confirma WhatsApp)"
        inputMode="tel"
        value={props.document.contact.phone ?? ""}
        onChange={(value) =>
          props.dispatch({ type: "contact", field: "phone", value })
        }
      />
      <p className="text-xs text-secundary">
        O WhatsApp e as mensagens são compartilhados pelo Cardápio, Localização
        e Chamada Final. Com um número válido, os botões abrem a conversa
        diretamente.
      </p>
      <TextField
        {...props}
        path="contact.whatsapp"
        label="WhatsApp com DDI e DDD (compartilhado)"
        inputMode="tel"
        value={props.document.contact.whatsapp ?? ""}
        onChange={(value) =>
          props.dispatch({ type: "contact", field: "whatsapp", value })
        }
      />
      {(!props.product || props.allMessages) && (
        <SectionTextFields
          {...props}
          fields={[
            [
              "content.interactions.orderMessage",
              "Mensagem geral · aceita {businessName}",
              true,
            ],
          ]}
        />
      )}
      {(props.product || props.allMessages) && (
        <SectionTextFields
          {...props}
          fields={[
            [
              "content.interactions.productOrderMessage",
              "Mensagem do produto · aceita {businessName}, {productName} e {price}",
              true,
            ],
          ]}
        />
      )}
    </details>
  );
}
