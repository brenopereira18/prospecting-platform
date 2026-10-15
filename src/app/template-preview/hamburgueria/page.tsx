import type { Metadata } from "next";
import { notFound } from "next/navigation";
import favicon from "../../../components/prototypes/templates/hamburgueria/assets/favicon.svg";
import { HamburgueriaRenderer } from "../../../components/prototypes/templates/hamburgueria/hamburgueria-renderer";
import { brasaBurgerDefaultDocument } from "../../../components/prototypes/templates/hamburgueria/data/default-document";

export const metadata: Metadata = {
  title: brasaBurgerDefaultDocument.seo.title,
  description: brasaBurgerDefaultDocument.seo.description,
  robots: { index: false, follow: false },
  icons: { icon: favicon.src },
};

export default function HamburgueriaPreview() {
  // This route is for local development; published prototypes need their own access policy.
  if (process.env.NODE_ENV !== "development") notFound();

  return <HamburgueriaRenderer document={brasaBurgerDefaultDocument} />;
}
