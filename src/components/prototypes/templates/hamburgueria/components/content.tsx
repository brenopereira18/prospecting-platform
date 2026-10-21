import type { HamburgueriaPrototypeDocument } from "../schema/hamburgueria.schema";
import { Header } from "./header";
import { IconLibrary } from "./icons";
import { InteractionProvider } from "./interaction-provider";
import { Menu } from "./menu";
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
} from "./sections";

export function HamburgueriaContent({
  document,
}: {
  document: HamburgueriaPrototypeDocument;
}) {
  const { sections } = document;
  return (
    <InteractionProvider>
      <a
        className="skip-link fixed [top:-100px] [left:20px] [z-index:100] [background:var(--brand)] [color:var(--on-brand)] [padding:12px] [&:focus]:[top:10px]"
        href="#conteudo"
      >
        Pular para o conteúdo
      </a>
      <IconLibrary />
      <Header />
      <main id="conteudo">
        {sections.hero && <Hero document={document} />}
        {sections.qualities && <Qualities document={document} />}
        {sections.menu && <Menu />}
        {sections.story && <Story document={document} />}
        {sections.howToOrder && <HowToOrder document={document} />}
        {sections.reviews && <Reviews document={document} />}
        {sections.location && <Location document={document} />}
        {sections.faq && <Faq document={document} />}
        {sections.finalCallToAction && (
          <FinalCallToAction document={document} />
        )}
      </main>
      <Footer document={document} />
    </InteractionProvider>
  );
}
