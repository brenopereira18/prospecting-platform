import { brasaBurgerDefaultDocument } from "../data/default-document";
import type {
  HamburgueriaConfirmableField,
  HamburgueriaPrototypeDocument as Document,
} from "../schema/hamburgueria.schema";

function readField(document: Document, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>(
      (value, key) =>
        value && typeof value === "object"
          ? (value as Record<string, unknown>)[key]
          : undefined,
      document,
    );
}

/** Preserve legacy customizations. Only exact template values need confirmation. */
export function isConfirmedField(
  document: Document,
  path: HamburgueriaConfirmableField,
): boolean {
  return (
    document.confirmedFields?.includes(path) === true ||
    JSON.stringify(readField(document, path)) !==
      JSON.stringify(readField(brasaBurgerDefaultDocument, path))
  );
}

export function confirmFields(
  document: Document,
  fields: readonly HamburgueriaConfirmableField[],
): Document {
  if (
    !fields.length ||
    fields.every((field) => document.confirmedFields?.includes(field))
  )
    return document;
  return {
    ...document,
    confirmedFields: [
      ...new Set([...(document.confirmedFields ?? []), ...fields]),
    ],
  };
}

/** Public outbound links must not point to a development machine. Asset URLs and
 * same-page SVG/navigation fragments do not pass through this function. */
export function publicWebUrl(value: string | undefined): string | undefined {
  if (!value?.trim()) return undefined;
  try {
    const url = new URL(value.trim());
    const host = url.hostname.toLowerCase();
    if (
      !/^https?:$/.test(url.protocol) ||
      url.username ||
      url.password ||
      host === "localhost" ||
      host.endsWith(".localhost") ||
      host.endsWith(".local") ||
      host === "0.0.0.0" ||
      host.startsWith("127.") ||
      host === "[::1]"
    )
      return undefined;
    return url.href;
  } catch {
    return undefined;
  }
}

const legacyCityMap =
  "https://www.google.com/maps/search/?api=1&query=S%C3%A3o+Paulo+Brasil";
export function getPublicLocation(document: Document) {
  const address: Partial<Document["business"]["address"]> = {};
  for (const field of [
    "street",
    "neighborhood",
    "city",
    "state",
    "postalCode",
  ] as const) {
    if (
      isConfirmedField(document, `business.address.${field}`) &&
      document.business.address[field]?.trim()
    )
      address[field] = document.business.address[field];
  }
  const explicit = publicWebUrl(document.contact.mapsUrl);
  const mapsUrl =
    explicit &&
    (document.contact.mapsUrl !== legacyCityMap ||
      document.confirmedFields?.includes("contact.mapsUrl"))
      ? explicit
      : address.street
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(Object.values(address).join(", "))}`
        : undefined;
  return { address, mapsUrl };
}

export function publicHours(
  document: Document,
  place: "hero" | "location" | "footer",
): string[] {
  const fields = {
    hero: "content.hero.hoursSummary",
    location: "content.service.openingHours",
    footer: "content.footer.serviceLines.1",
  } as const;
  const hours = isConfirmedField(document, fields[place])
    ? place === "location"
      ? document.content.service.openingHours
      : [
          place === "hero"
            ? document.content.hero.hoursSummary
            : document.content.footer.serviceLines[1],
        ]
    : [];
  return [
    ...hours,
    ...(place === "location" &&
    isConfirmedField(document, "content.service.orderingHoursNote")
      ? [document.content.service.orderingHoursNote]
      : []),
  ].filter((value) => value.trim());
}

// Exact legacy copy, never a keyword filter: custom answers remain untouched.
const legacyFaqCopy: Record<string, readonly [string, string][]> = {
  pagamento: [
    [
      "Na nossa hamburgueria fictícia, aceitamos Pix, cartões de crédito e débito. Nesta demonstração, nenhum pagamento é solicitado ou processado.",
      "Consulte as formas de pagamento disponíveis com nossa equipe ao fazer seu pedido.",
    ],
  ],
  entrega: [
    [
      "Atendemos Vila Brasa (R$ 5,90), Jardim do Fogo (R$ 7,90) e Centro (R$ 9,90). Consulte a disponibilidade no atendimento. Bairros e taxas são fictícios.",
      "Informe seu endereço no atendimento para consultar a disponibilidade e a taxa de entrega.",
    ],
  ],
  prazo: [
    [
      "A estimativa é de 35 a 50 minutos para entrega e de 25 a 35 minutos para retirada. Em uma operação real, os prazos dependem do movimento e seriam confirmados no atendimento.",
      "Confirme o prazo de preparo e as opções de recebimento com nossa equipe ao fazer seu pedido.",
    ],
  ],
};
export function publicFaqAnswer(
  item: Document["content"]["faq"]["items"][number],
): string {
  return (
    legacyFaqCopy[item.id]?.find(([old]) => old === item.answer)?.[1] ??
    item.answer
  );
}
