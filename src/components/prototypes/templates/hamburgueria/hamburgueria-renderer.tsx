import type { HamburgueriaPrototypeDocument } from "./schema/hamburgueria.schema";
import { HamburgueriaTemplate } from "./hamburgueria-template";
import { Header } from "./components/header";
import { IconLibrary } from "./components/icons";
import { InteractionProvider } from "./components/interaction-provider";
import { Menu } from "./components/menu";
import {
  Hero, Qualities, Story, HowToOrder, Reviews, Location, Faq,
  FinalCallToAction, Footer,
} from "./components/sections";

export function HamburgueriaRenderer({ document }: { document: HamburgueriaPrototypeDocument }) {
  const { sections } = document;
  return (
    <HamburgueriaTemplate document={document}>
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
          {sections.hero && <Hero />}
          {sections.qualities && <Qualities />}
          {sections.menu && <Menu />}
          {sections.story && <Story />}
          {sections.howToOrder && <HowToOrder />}
          {sections.reviews && <Reviews />}
          {sections.location && <Location />}
          {sections.faq && <Faq />}
          {sections.finalCallToAction && <FinalCallToAction />}
        </main>
        <Footer />
      </InteractionProvider>
    </HamburgueriaTemplate>
  );
}
