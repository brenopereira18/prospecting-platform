import type { HamburgueriaSectionId } from "../schema/hamburgueria.schema";

export const structuralSectionIds = { header: "hamburgueria-header", footer: "hamburgueria-footer" } as const;

// Preserve os IDs existentes: links externos e o CSS já podem referenciá-los.
export const sectionAnchors = {
  hero: "#inicio",
  qualities: "#qualidades",
  menu: "#cardapio",
  story: "#nossa-historia",
  howToOrder: "#como-pedir",
  reviews: "#avaliacoes",
  location: "#onde-estamos",
  faq: "#duvidas",
  finalCallToAction: "#chamada-final",
} as const satisfies Record<HamburgueriaSectionId, string>;

export function getAnchorSection(href: string): HamburgueriaSectionId | undefined {
  if (href === "#contato") return "location";
  return (Object.keys(sectionAnchors) as HamburgueriaSectionId[]).find(
    (section) => sectionAnchors[section] === href,
  );
}
