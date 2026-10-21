import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { PrototypeConfigurationFields } from "./prototype-configuration-fields";
import { CreatePrototypeForm } from "./create-prototype-form";
import { configurationFromLead } from "../../server/prototypes/template-registry";
import type { LeadPrototypeOptionsDTO } from "../../server/prototypes/prototype.dto";

const configuration = configurationFromLead({ name: "Casa do Bairro", address: "Rua cadastrada, 100", phone: "11999998888", rating: null, userRatingCount: null });
const noop = () => {};
const options: LeadPrototypeOptionsDTO = {
  lead: { id: "12345678-1234-4234-8234-123456789012", name: "Casa do Bairro", categoryName: "Hamburguerias" },
  templates: [{ id: "brasa-burger", name: "Brasa Burger", description: "Cores e fontes do template", version: 1 }],
  configuration, prototypes: [],
};
function form(data: LeadPrototypeOptionsDTO) {
  return renderToStaticMarkup(<AppRouterContext.Provider value={{ push: noop, replace: noop, refresh: noop, back: noop, forward: noop, prefetch: noop, bfcacheId: "configuration-test" }}><CreatePrototypeForm options={data} /></AppRouterContext.Provider>);
}

test("configuration fields display prefilled data, optional fields and associated validation messages", () => {
  const before = structuredClone(configuration);
  const html = renderToStaticMarkup(<PrototypeConfigurationFields value={configuration} onChange={noop} errors={{ "contact.whatsapp": "Telefone inválido" }} />);
  for (const field of ["businessName", "tagline", "description", "contact-phone", "contact-whatsapp", "contact-instagramUrl", "address-street", "address-neighborhood", "address-city", "address-state", "contact-mapsUrl"]) assert.ok(html.includes(`id="config-${field}"`));
  assert.ok(html.includes('value="Casa do Bairro"'));
  assert.ok(html.includes('value="Rua cadastrada, 100"'));
  assert.ok(html.includes('id="config-contact-whatsapp-error"'));
  assert.ok(html.includes('aria-describedby="config-contact-whatsapp-error"'));
  assert.deepEqual(configuration, before);
});

test("creation form selects the sole compatible template and never renders a second editor", () => {
  const html = form(options);
  assert.ok(html.includes('value="brasa-burger" selected=""'));
  assert.ok(html.includes("Criar protótipo"));
  assert.ok(html.includes("Categoria do lead"));
  assert.ok(html.includes("cadastro original do lead será mantido"));
  assert.ok(!html.includes('type="color"'));
  assert.ok(html.includes('id="config-businessName"'));
});

test("existing prototypes are offered before a new form; unsupported categories cannot submit", () => {
  const html = form({ ...options, prototypes: [{ id: "existing", name: "Proposta anterior", templateId: "brasa-burger", templateVersion: 1, draftRevision: 0, leadId: options.lead.id, createdAt: "", updatedAt: "" }] });
  assert.ok(html.includes('href="/prototipos/existing"'));
  assert.ok(html.includes("Quero criar outro"));
  assert.ok(!html.includes("<form"));
  const unsupported = form({ ...options, templates: [] });
  assert.ok(unsupported.includes("Ainda não há um template compatível"));
  assert.ok(!unsupported.includes("<form"));
  const multiple = form({ ...options, templates: [...options.templates, { ...options.templates[0], id: "future", name: "Outra opção" }] });
  assert.ok(multiple.includes("Selecione um template"));
});
