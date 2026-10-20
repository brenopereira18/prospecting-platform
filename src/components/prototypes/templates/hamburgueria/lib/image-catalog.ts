import { HAMBURGUERIA_TEMPLATE_ASSETS } from "../schema/hamburgueria.schema";

export type HamburgueriaImageKey = (typeof HAMBURGUERIA_TEMPLATE_ASSETS)[number];

const descriptions = {
  bacon: { label: "Burger com bacon", alt: "Hambúrguer com bacon e queijo" },
  classic: { label: "Burger clássico", alt: "Hambúrguer clássico com queijo e salada" },
  hero: { label: "Hambúrguer principal", alt: "Hambúrguer artesanal com bacon, cheddar e salada" },
  interior: { label: "Espaço da hamburgueria", alt: "Interior da hamburgueria" },
  veggie: { label: "Burger vegetariano", alt: "Hambúrguer vegetariano com salada" },
} satisfies Record<HamburgueriaImageKey, { label: string; alt: string }>;

/** Metadata only. The existing image resolver owns the actual static imports. */
export const hamburgueriaImageOptions = HAMBURGUERIA_TEMPLATE_ASSETS.map(key => ({ key, ...descriptions[key] }));
