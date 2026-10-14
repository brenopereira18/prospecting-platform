import type { Metadata } from "next";
import { notFound } from "next/navigation";
import favicon from "../../../components/prototypes/templates/hamburgueria/assets/favicon.svg";
import { HamburgueriaTemplate } from "../../../components/prototypes/templates/hamburgueria/hamburgueria-template";
import { Header } from "../../../components/prototypes/templates/hamburgueria/components/header";
import { IconLibrary } from "../../../components/prototypes/templates/hamburgueria/components/icons";
import { InteractionProvider } from "../../../components/prototypes/templates/hamburgueria/components/interaction-provider";
import { Menu } from "../../../components/prototypes/templates/hamburgueria/components/menu";
import {
  Hero,
  Qualities,
  Story,
  HowToOrder,
  Reviews,
  Location,
  Faq,
  FinalCallToAction,
  Footer,
} from "../../../components/prototypes/templates/hamburgueria/components/sections";

export const metadata: Metadata = {
  title: "Brasa Burger — Prévia do template",
  robots: { index: false, follow: false },
  icons: { icon: favicon.src },
};

export default function HamburgueriaPreview() {
  // This route is for local development; published prototypes need their own access policy.
  if (process.env.NODE_ENV !== "development") notFound();

  return (
    <HamburgueriaTemplate>
      <InteractionProvider>
        <a
          className="skip-link fixed [top:-100px] [left:20px] [z-index:100] [background:var(--yellow)] [padding:12px] [&:focus]:[top:10px]"
          href="#conteudo"
        >
          Pular para o conteúdo
        </a>
        <IconLibrary />
        <Header />
        <main id="conteudo">
          <Hero />
          <Qualities />
          <Menu />
          <Story />
          <HowToOrder />
          <Reviews />
          <Location />
          <Faq />
          <FinalCallToAction />
        </main>
        <Footer />
      </InteractionProvider>
    </HamburgueriaTemplate>
  );
}
