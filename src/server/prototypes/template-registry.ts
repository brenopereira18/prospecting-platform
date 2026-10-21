import { brasaBurgerDefaultDocument } from "../../components/prototypes/templates/hamburgueria/data/default-document";
import { persistablePrototypeDocumentSchema } from "../../components/prototypes/schemas/persistable-document.schema";
import { prototypeConfigurationSchema, type PrototypeConfiguration } from "../../components/prototypes/schemas/prototype-configuration.schema";

// Category IDs vary between databases. A stable, persisted semantic key survives
// category renames and permits explicit mappings without matching display names.
const templates = [{ id: "brasa-burger", name: "Hamburgueria · Brasa Burger", description: "Landing page com cardápio, localização e contato. Cores e fontes originais do template.", categoryKeys: ["hamburgueria"], version: brasaBurgerDefaultDocument.template.version, createDocument: createHamburgueriaDocumentFromConfig }] as const;

export function compatibleTemplates(categoryKey: string | null) {
  return templates.filter(template => (template.categoryKeys as readonly string[]).includes(categoryKey ?? ""));
}

export type PrototypeLeadData = {
  name: string; address: string | null; phone: string | null;
  rating: number | null; userRatingCount: number | null;
};

export function normalizeBrazilianPhone(value: string | null): string {
  const digits = value?.replace(/\D/g, "") ?? "";
  if (value?.trim().startsWith("+")) return /^\d{10,15}$/.test(digits) ? digits : "";
  if (/^55\d{10,11}$/.test(digits)) return digits;
  if (/^\d{10,11}$/.test(digits)) return `55${digits}`;
  return "";
}

export function configurationFromLead(lead: PrototypeLeadData): PrototypeConfiguration {
  const phone = normalizeBrazilianPhone(lead.phone);
  return prototypeConfigurationSchema.parse({
    businessName: lead.name.trim().slice(0, 120), tagline: "", description: "",
    contact: { phone: phone && lead.phone?.trim().startsWith("+") ? `+${phone}` : phone, whatsapp: "", instagramUrl: "", mapsUrl: "" },
    address: { street: lead.address?.trim().slice(0, 160) ?? "", neighborhood: "", city: "", state: "" },
  });
}

// Retained for callers of the original lead mapper; both paths use the same factory.
export function createLeadDocument(lead: PrototypeLeadData) {
  return createHamburgueriaDocumentFromConfig(configurationFromLead(lead), lead);
}

/** Clone the full demo and replace only populated, explicitly configurable fields. */
export function createHamburgueriaDocumentFromConfig(input: PrototypeConfiguration, lead?: Pick<PrototypeLeadData, "rating" | "userRatingCount">) {
  const config = prototypeConfigurationSchema.parse(input);
  const doc = structuredClone(brasaBurgerDefaultDocument);

  if (config.businessName !== doc.business.name) {
    const boundary = config.businessName.lastIndexOf(" ", 40);
    const split = boundary > 0 ? boundary : 40;
    doc.business.brandLines = [config.businessName.slice(0, split).trim(), config.businessName.slice(split).trim().slice(0, 40)];
    doc.seo.title = doc.seo.title.replace(doc.business.name, config.businessName);
    doc.business.name = config.businessName;
  }
  if (config.tagline) doc.business.tagline = config.tagline;

  if (config.description) {
    const boundary = config.description.lastIndexOf(" ", 180);
    const split = config.description.length <= 180 ? config.description.length : boundary >= config.description.length - 180 ? boundary : 160;
    doc.content.hero.description = [config.description.slice(0, split), config.description.slice(split)];
    doc.content.location.description = config.description;
    doc.seo.description = config.description;
  }

  const normalizePhone = (value: string) => normalizeBrazilianPhone(value) || value.replace(/\D/g, "");
  if (config.contact.phone) doc.contact.phone = normalizePhone(config.contact.phone);
  if (config.contact.whatsapp) doc.contact.whatsapp = normalizePhone(config.contact.whatsapp);
  if (config.contact.instagramUrl) {
    doc.contact.instagramUrl = config.contact.instagramUrl;
    const url = new URL(config.contact.instagramUrl);
    const username = url.pathname.split("/").filter(Boolean)[0];
    doc.contact.instagramLabel = /^(www\.)?instagram\.com$/i.test(url.hostname) && username ? "@" + username : "Instagram";
  }
  if (config.contact.mapsUrl) doc.contact.mapsUrl = config.contact.mapsUrl;
  for (const field of ["street", "neighborhood", "city", "state"] as const) {
    if (config.address[field]) doc.business.address[field] = config.address[field];
  }
  // Trusted metadata is supplied by the service, never accepted from form input.
  if (lead?.rating != null) doc.content.reviews.rating = lead.rating;
  if (lead?.userRatingCount != null) doc.content.reviews.count = lead.userRatingCount;

  return persistablePrototypeDocumentSchema.parse(doc);
}
