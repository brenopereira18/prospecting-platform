"use client";

import {
  createContext,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { MenuCategory } from "../types/restaurant";
import { restaurant } from "../data/restaurant";
import { Icon } from "./icons";

type DemoKind = "order" | "social";
interface Interactions {
  category: MenuCategory;
  setCategory: (category: MenuCategory) => void;
  showDemo: (kind: DemoKind) => void;
}
const Context = createContext<Interactions | null>(null);

export function useInteractions() {
  const context = useContext(Context);
  if (!context)
    throw new Error(
      "Os componentes interativos precisam de InteractionProvider.",
    );
  return context;
}

export function InteractionProvider({ children }: { children: ReactNode }) {
  const [category, setCategory] = useState<MenuCategory>("burgers");
  const [demoKind, setDemoKind] = useState<DemoKind>("order");
  const dialog = useRef<HTMLDialogElement>(null);

  function showDemo(kind: DemoKind) {
    setDemoKind(kind);
    dialog.current?.showModal();
  }

  return (
    <Context.Provider value={{ category, setCategory, showDemo }}>
      {children}
      <dialog
        ref={dialog}
        id="contact-dialog"
        className={
          "demo-dialog [border:1px_solid_#d8d0bf] [padding:32px] [max-width:460px] [width:calc(100%_-_40px)] rounded-md [background:var(--paper)] [color:var(--ink)] [&::backdrop]:[background:#000b] [&::backdrop]:[backdrop-filter:blur(3px)] [&_h2]:[font-size:39px] [&_h2]:[margin:12px_0] [&_>_p]:[font-size:15px] [&_>_p]:[color:#706858] [&_>_p]:[margin-bottom:23px] [&_>_.icon-button]:absolute [&_>_.icon-button]:[right:12px] [&_>_.icon-button]:[top:12px] [&_>_svg]:[width:42px] [&_>_svg]:[height:42px] [&_>_svg]:[color:#ae7d00] [&_.button]:w-full"
        }
        aria-labelledby="contact-dialog-title"
        onClick={(event) => {
          if (event.target !== event.currentTarget) return;
          const rect = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < rect.left ||
            event.clientX > rect.right ||
            event.clientY < rect.top ||
            event.clientY > rect.bottom
          )
            dialog.current?.close();
        }}
      >
        <button
          className={
            "icon-button [border:0] [background:transparent] grid place-items-center [padding:10px]"
          }
          aria-label="Fechar aviso"
          onClick={() => dialog.current?.close()}
        >
          <Icon name="close" />
        </button>
        <Icon name="burger" />
        <h2 id="contact-dialog-title">
          {demoKind === "social" ? "UMA CASA FICTÍCIA" : "DEU VONTADE, NÉ?"}
        </h2>
        <p>
          {demoKind === "social"
            ? `A ${restaurant.name} é uma marca criada para esta demonstração e ainda não possui um perfil nas redes sociais.`
            : "Esta é uma hamburgueria fictícia. Os pratos e preços são ilustrativos, e não recebemos pedidos. Em uma loja real, você falaria com a equipe pelo WhatsApp."}
        </p>
        <button
          className={
            "button inline-flex items-center justify-center gap-3 [min-height:49px] [padding:13px_23px] [border:1px_solid_transparent] rounded-[2px] [font-family:var(--display)] [font-size:18px] font-bold [line-height:1.2] [transition:background_0.18s,_color_0.18s,_transform_0.18s] [&:hover]:[transform:translateY(-2px)] [&_svg]:[width:21px] [&_svg]:[height:21px] button-yellow [background:var(--yellow)] [color:#17130a] [&:hover]:[background:#ffcc33]"
          }
          onClick={() => dialog.current?.close()}
        >
          Continuar explorando
        </button>
      </dialog>
    </Context.Provider>
  );
}
