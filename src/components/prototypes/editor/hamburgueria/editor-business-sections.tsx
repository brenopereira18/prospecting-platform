"use client";

import type { PanelProps } from "./editor-fields";
import { TextField } from "./editor-fields";
import { ItemCollection, StringCollection } from "./editor-collections";
import { PriceField } from "./editor-number-fields";
import { EditorCheck, SectionTextFields } from "./editor-section-fields";
import { sectionField } from "./editor-section-document";
import { BusinessNameField, OrderChannelFields } from "./editor-shared-fields";

export function StoryFields(props: PanelProps) {
  return <div className="space-y-6">
    <h2 className="text-sm font-semibold">História do estabelecimento</h2>
    <SectionTextFields {...props} fields={[
      ["content.story.eyebrow", "Texto de abertura"], ["content.story.headline.0", "Título · linha 1"],
      ["content.story.headline.1", "Título · linha 2"], ["content.story.headline.2", "Título · linha 3"],
      ["content.story.signature.0", "Assinatura · linha 1"], ["content.story.signature.1", "Assinatura · linha 2"],
    ]} />
    <details className="space-y-4"><summary className="cursor-pointer text-sm">Parágrafos</summary><StringCollection {...props} list="paragraphs" /></details>
    <details className="space-y-4"><summary className="cursor-pointer text-sm">Oferta em destaque</summary>
      <p className="text-xs leading-relaxed text-secundary">{props.document.content.story.featured.productId
        ? "O preço acompanha o produto vinculado no Cardápio. A imagem e o vínculo serão preservados."
        : "Sem produto vinculado. Os textos são preservados, mas a oferta não aparece na prévia."}</p>
      <SectionTextFields {...props} fields={[
        ["content.story.featured.eyebrow", "Texto de abertura da oferta"], ["content.story.featured.headline.0", "Título da oferta · linha 1"],
        ["content.story.featured.headline.1", "Título da oferta · linha 2"], ["content.story.featured.headline.2", "Título da oferta · linha 3"],
        ["content.story.featured.description.0", "Descrição da oferta · linha 1"], ["content.story.featured.description.1", "Descrição da oferta · linha 2"],
        ["content.story.featured.priceLabel", "Chamada do preço"], ["content.story.featured.ctaLabel", "Botão da oferta"],
      ]} />
    </details>

  </div>;
}

export function ServiceFields(props: PanelProps) {
  const { service } = props.document.content;
  return <div className="space-y-6">
    <h2 className="text-sm font-semibold">Como Pedir</h2>
    <SectionTextFields {...props} fields={[
      ["content.howToOrder.eyebrow", "Texto de abertura"], ["content.howToOrder.title", "Título"],
      ["content.howToOrder.minimumDeliveryLabel", "Texto antes da taxa mínima"], ["content.howToOrder.atendimentoLinkLabel", "Link de atendimento"],
    ]} />
    <details className="space-y-4"><summary className="cursor-pointer text-sm">Etapas do pedido</summary>
      <ItemCollection {...props} list="steps" renderItem={(item, index) => <>
        <TextField {...props} path={`content.howToOrder.steps.${index}.title`} label="Título da etapa" value={item.title} onChange={title => props.dispatch({ type: "sectionItem/edit", list: "steps", id: item.id, changes: { title } })} />
        <TextField {...props} path={`content.howToOrder.steps.${index}.body`} label="Instruções · aceita {deliveryEstimate} e {pickupEstimate}" multiline value={item.body} onChange={body => props.dispatch({ type: "sectionItem/edit", list: "steps", id: item.id, changes: { body } })} />
      </>} />
      <SectionTextFields {...props} fields={[["content.service.delivery.estimate", "Prazo de entrega nas instruções"], ["content.service.delivery.pickupEstimate", "Prazo de retirada nas instruções"]]} />
    </details>
    <details className="space-y-4"><summary className="cursor-pointer text-sm">Pagamento, entrega e retirada</summary>
      <EditorCheck label="Entrega habilitada (compartilhado com Localização)" value={service.modes.delivery} onChange={value => props.dispatch(sectionField("content.service.modes.delivery", value))} />
      <EditorCheck label="Retirada habilitada" value={service.modes.pickup} onChange={value => props.dispatch(sectionField("content.service.modes.pickup", value))} />
      <PriceField {...props} path="content.service.delivery.minimumFeeCents" label="Taxa mínima exibida nesta seção (R$)" cents={service.delivery.minimumFeeCents} onChange={value => props.dispatch(sectionField("content.service.delivery.minimumFeeCents", value))} />
      <SectionTextFields {...props} fields={[["content.service.paymentMethodsText", "Formas de pagamento"], ["content.service.pickupFeeText", "Informação de taxa de retirada"]]} />
    </details>
    <OrderChannelFields {...props} allMessages />
  </div>;
}

function LocationServiceFields(props: PanelProps) {
  const { service } = props.document.content;
  return <>
    <details className="space-y-4"><summary className="cursor-pointer text-sm">Horários exibidos em Localização</summary>
      <StringCollection {...props} list="openingHours" />
      <SectionTextFields {...props} fields={[["content.service.orderingHoursNote", "Observação de horários", true]]} />
      <EditorCheck label="Consumo no local disponível" value={service.modes.dineIn} onChange={value => props.dispatch(sectionField("content.service.modes.dineIn", value))} />
    </details>
    <details className="space-y-4"><summary className="cursor-pointer text-sm">Entrega e bairros atendidos</summary>
      <EditorCheck label="Entrega habilitada (compartilhado com Como Pedir)" value={service.modes.delivery} onChange={value => props.dispatch(sectionField("content.service.modes.delivery", value))} />
      <SectionTextFields {...props} fields={[["content.service.delivery.neighborhoodsSummary", "Resumo dos bairros", true], ["content.service.delivery.priceRangeText", "Texto da faixa de taxas"]]} />
      <p className="text-xs text-secundary">O resumo e a faixa de taxas são textos independentes das áreas cadastradas abaixo.</p>
      <ItemCollection {...props} list="areas" renderItem={(item, index) => <>
        <TextField {...props} path={`content.service.delivery.areas.${index}.name`} label="Nome da área ou bairro" value={item.name} onChange={name => props.dispatch({ type: "sectionItem/edit", list: "areas", id: item.id, changes: { name } })} />
        <PriceField {...props} path={`content.service.delivery.areas.${index}.feeCents`} label="Taxa da área (R$)" cents={item.feeCents} onChange={feeCents => props.dispatch({ type: "sectionItem/edit", list: "areas", id: item.id, changes: { feeCents } })} />
      </>} />
    </details>
  </>;
}

export function LocationFields(props: PanelProps) {
  return <div className="space-y-6">
    <h2 className="text-sm font-semibold">Localização</h2>
    <BusinessNameField {...props} />
    <SectionTextFields {...props} fields={[
      ["business.address.street", "Rua e número"], ["business.address.neighborhood", "Bairro"], ["business.address.city", "Cidade"],
      ["business.address.state", "Estado"], ["business.address.postalCode", "CEP (opcional)"],
    ]} />
    <LocationServiceFields {...props} />
    <OrderChannelFields {...props} />
    <details className="space-y-4"><summary className="cursor-pointer text-sm">Instagram exibido nesta seção</summary>
      <TextField {...props} path="contact.instagramUrl" label="Link do Instagram" inputMode="url" value={props.document.contact.instagramUrl ?? ""} onChange={value => props.dispatch({ type: "contact", field: "instagramUrl", value })} />
      <TextField {...props} path="contact.instagramLabel" label="Nome exibido no Instagram" value={props.document.contact.instagramLabel ?? ""} onChange={value => props.dispatch({ type: "contact", field: "instagramLabel", value })} />
      <SectionTextFields {...props} fields={[["content.demoCopy.socialDialogTitle", "Título do aviso social na demonstração"], ["content.demoCopy.socialDialogMessage", "Mensagem do aviso social", true]]} />
    </details>
    <details className="space-y-4"><summary className="cursor-pointer text-sm">Avisos de Localização</summary>
      <SectionTextFields {...props} fields={[["content.demoCopy.locationDisclaimer", "Aviso do endereço", true], ["content.demoCopy.contactDisclaimer", "Aviso abaixo do botão de contato", true]]} />
    </details>
    <details className="space-y-4"><summary className="cursor-pointer text-sm">Textos da seção e botões</summary>
      <SectionTextFields {...props} fields={[
        ["content.location.eyebrow", "Texto de abertura"], ["content.location.headline.0", "Título · linha 1"], ["content.location.headline.1", "Título · linha 2"],
        ["content.location.description", "Descrição", true], ["content.location.addressHeading", "Título do endereço"], ["content.location.hoursHeading", "Título dos horários"],
        ["content.location.deliveryHeading", "Título da entrega"], ["content.location.orderLinkLabel", "Botão de pedido"], ["content.location.socialLinkPrefix", "Texto do link social"],
      ]} />
    </details>
    <details className="space-y-4"><summary className="cursor-pointer text-sm">Mapa ilustrativo</summary>
      <TextField {...props} path="contact.mapsUrl" label="Link do mapa" inputMode="url" value={props.document.contact.mapsUrl ?? ""} onChange={value => props.dispatch({ type: "contact", field: "mapsUrl", value })} />
      <SectionTextFields {...props} fields={[
        ["content.location.mapRoad", "Rua ilustrativa"], ["content.location.mapAvenue", "Avenida ilustrativa"], ["content.location.mapPlaceTagline", "Frase do estabelecimento no mapa"],
        ["content.location.mapAccessibleLabel", "Descrição acessível · aceita {businessName}"], ["content.location.mapLinkLabel", "Texto do link · aceita {city}"], ["content.location.mapCaption", "Legenda"],
      ]} />
    </details>
  </div>;
}
