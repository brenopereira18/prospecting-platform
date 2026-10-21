import { brasaBurgerDefaultDocument } from "../../components/prototypes/templates/hamburgueria/data/default-document";
import { persistablePrototypeDocumentSchema } from "../../components/prototypes/schemas/persistable-document.schema";
import {
  prototypeConfigurationSchema,
  type PrototypeConfiguration,
} from "../../components/prototypes/schemas/prototype-configuration.schema";
import type {
  HamburgueriaPrototypeDocument,
  HamburgueriaConfirmableField,
} from "../../components/prototypes/templates/hamburgueria/schema/hamburgueria.schema";
import { confirmFields } from "../../components/prototypes/templates/hamburgueria/lib/presentation";

// Category IDs vary between databases. A stable, persisted semantic key survives
// category renames and permits explicit mappings without matching display names.
const templates = [
  {
    id: "brasa-burger",
    name: "Hamburgueria · Brasa Burger",
    description:
      "Landing page com cardápio, localização e contato. Cores e fontes originais do template.",
    categoryKeys: ["hamburgueria"],
    version: brasaBurgerDefaultDocument.template.version,
    createDocument: createHamburgueriaDocumentFromConfig,
  },
] as const;

export function compatibleTemplates(categoryKey: string | null) {
  return templates.filter((template) =>
    (template.categoryKeys as readonly string[]).includes(categoryKey ?? ""),
  );
}

export type PrototypeLeadData = {
  name: string;
  address: string | null;
  phone: string | null;
  rating: number | null;
  userRatingCount: number | null;
};

export function normalizeBrazilianPhone(value: string | null): string {
  const digits = value?.replace(/\D/g, "") ?? "";
  if (value?.trim().startsWith("+"))
    return /^\d{10,15}$/.test(digits) ? digits : "";
  if (/^55\d{10,11}$/.test(digits)) return digits;
  if (/^\d{10,11}$/.test(digits)) return `55${digits}`;
  return "";
}

export function configurationFromLead(
  lead: PrototypeLeadData,
): PrototypeConfiguration {
  const phone = normalizeBrazilianPhone(lead.phone);
  return prototypeConfigurationSchema.parse({
    businessName: lead.name.trim().slice(0, 120),
    tagline: "",
    description: "",
    contact: {
      phone: phone && lead.phone?.trim().startsWith("+") ? `+${phone}` : phone,
      whatsapp: "",
      instagramUrl: "",
      mapsUrl: "",
    },
    address: {
      street: lead.address?.trim().slice(0, 160) ?? "",
      neighborhood: "",
      city: "",
      state: "",
    },
  });
}

// Retained for callers of the original lead mapper; both paths use the same factory.
export function createLeadDocument(lead: PrototypeLeadData) {
  return createHamburgueriaDocumentFromConfig(
    configurationFromLead(lead),
    lead,
  );
}

/** Synchronize only the service copy affected by explicitly supplied configuration. */
function personalizeService(
  doc: HamburgueriaPrototypeDocument,
  config: PrototypeConfiguration,
) {
  const options = config.hamburgueria;
  if (!options) return;
  // The form retains hidden draft input for toggling back, but it must not apply it.
  const deliveryRegion = options.modes?.delivery ? options.deliveryRegion : "";
  const { service, hero, footer, howToOrder, location, faq } = doc.content;
  const updateFaq = (id: string, answer: string) => {
    const item = faq.items.find((item) => item.id === id);
    if (item) item.answer = answer;
  };

  if (options.modes) {
    const modes = options.modes;
    service.modes = { ...modes };
    const summary = [
      modes.delivery && "Delivery",
      modes.pickup && "retirada",
      modes.dineIn && "consumo no local",
    ]
      .filter(Boolean)
      .join(" · ");
    hero.serviceSummary = summary;
    footer.serviceLines[0] = summary;
    // Closing rules, lead times and reservation policies were not supplied by this form.
    service.orderingHoursNote = "";
    howToOrder.steps[1].body = config.contact.whatsapp
      ? "Fale com nossa equipe pelo WhatsApp para fazer seu pedido e confirmar o atendimento."
      : "Fale com nossa equipe para fazer seu pedido e confirmar o atendimento.";
    howToOrder.steps[2].body = [
      modes.delivery &&
        "Combine a entrega e confirme o prazo com nossa equipe.",
      modes.pickup && "Combine o horário de retirada do seu pedido.",
      modes.dineIn && "Faça seu pedido para consumir no local.",
    ]
      .filter(Boolean)
      .join(" ");
    const timing = faq.items.find((item) => item.id === "prazo");
    if (timing) {
      timing.question = "Como combinar o atendimento?";
      timing.answer = howToOrder.steps[2].body;
    }
    updateFaq(
      "reserva",
      modes.dineIn
        ? "Oferecemos consumo no local. Consulte a disponibilidade e a política de reservas com nossa equipe."
        : "Não oferecemos consumo no local. Consulte as modalidades de atendimento disponíveis nesta página.",
    );
    if (!modes.dineIn) {
      location.eyebrow = "Fale com a gente";
      if (!config.description)
        location.description = modes.pickup
          ? "Combine sua retirada e confirme os detalhes com nossa equipe."
          : "Entre em contato com nossa equipe para combinar sua entrega.";
    }
  }
  if (options.hoursSummary) {
    service.openingHours = [options.hoursSummary];
    hero.hoursSummary = options.hoursSummary;
    footer.serviceLines[1] = options.hoursSummary;
    service.orderingHoursNote = "";
  }
  if (deliveryRegion) service.delivery.neighborhoodsSummary = deliveryRegion;
  if (options.modes || deliveryRegion) {
    updateFaq(
      "entrega",
      !service.modes.delivery
        ? "Não oferecemos delivery. Consulte as modalidades de atendimento disponíveis nesta página."
        : deliveryRegion
          ? `Entregamos em ${deliveryRegion}. Consulte a disponibilidade, as taxas e o prazo com nossa equipe.`
          : "Oferecemos delivery. Consulte os bairros atendidos, as taxas e o prazo com nossa equipe.",
    );
  }
}

/** Clone the full demo and replace only populated, explicitly configurable fields. */
export function createHamburgueriaDocumentFromConfig(
  input: PrototypeConfiguration,
  lead?: Pick<PrototypeLeadData, "rating" | "userRatingCount">,
) {
  const config = prototypeConfigurationSchema.parse(input);
  const doc = structuredClone(brasaBurgerDefaultDocument);
  const confirmed: HamburgueriaConfirmableField[] = [];

  if (config.businessName !== doc.business.name) {
    const boundary = config.businessName.lastIndexOf(" ", 40);
    const split = boundary > 0 ? boundary : 40;
    doc.business.brandLines = [
      config.businessName.slice(0, split).trim(),
      config.businessName.slice(split).trim().slice(0, 40),
    ];
    doc.seo.title = doc.seo.title.replace(
      doc.business.name,
      config.businessName,
    );
    doc.business.name = config.businessName;
  }
  if (config.tagline) doc.business.tagline = config.tagline;
  if (config.headline) {
    const [first, second = ""] = config.headline
      .split(/\r?\n/)
      .map((line) => line.trim());
    doc.content.hero.headline = [first, second];
  }

  if (config.description) {
    const boundary = config.description.lastIndexOf(" ", 180);
    const split =
      config.description.length <= 180
        ? config.description.length
        : boundary >= config.description.length - 180
          ? boundary
          : 160;
    doc.content.hero.description = [
      config.description.slice(0, split),
      config.description.slice(split),
    ];
    doc.content.location.description = config.description;
    doc.seo.description = config.description;
  }

  const normalizePhone = (value: string) =>
    normalizeBrazilianPhone(value) || value.replace(/\D/g, "");
  if (config.contact.phone)
    doc.contact.phone = normalizePhone(config.contact.phone);
  if (config.contact.whatsapp)
    doc.contact.whatsapp = normalizePhone(config.contact.whatsapp);
  if (config.contact.instagramUrl) {
    doc.contact.instagramUrl = config.contact.instagramUrl;
    const url = new URL(config.contact.instagramUrl);
    const username = url.pathname.split("/").filter(Boolean)[0];
    doc.contact.instagramLabel =
      /^(www\.)?instagram\.com$/i.test(url.hostname) && username
        ? "@" + username
        : "Instagram";
  }
  if (config.contact.mapsUrl) {
    doc.contact.mapsUrl = config.contact.mapsUrl;
    confirmed.push("contact.mapsUrl");
  }
  for (const field of ["street", "neighborhood", "city", "state"] as const) {
    if (config.address[field]) {
      doc.business.address[field] = config.address[field];
      confirmed.push(`business.address.${field}`);
    }
  }
  // Trusted metadata is supplied by the service, never accepted from form input.
  if (lead?.rating != null) {
    doc.content.reviews.rating = lead.rating;
    doc.content.reviews.ratingSource = "lead";
  }
  if (lead?.userRatingCount != null) {
    doc.content.reviews.count = lead.userRatingCount;
    doc.content.reviews.countSource = "lead";
  }

  personalizeService(doc, config);
  if (config.hamburgueria?.hoursSummary)
    confirmed.push(
      "content.hero.hoursSummary",
      "content.service.openingHours",
      "content.footer.serviceLines.1",
    );
  if (
    config.hamburgueria?.modes?.delivery &&
    config.hamburgueria.deliveryRegion
  )
    confirmed.push("content.service.delivery.neighborhoodsSummary");

  return persistablePrototypeDocumentSchema.parse(
    confirmFields(doc, confirmed),
  );
}
