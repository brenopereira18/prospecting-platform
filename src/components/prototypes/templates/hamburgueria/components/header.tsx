"use client";

import { tw } from "../styles/tailwind";

import { useEffect, useState } from "react";
import { restaurant } from "../data/restaurant";
import { Icon } from "./icons";

const navigation = [
  ["#inicio", "Início"],
  ["#cardapio", "Cardápio"],
  ["#nossa-historia", "Nossa brasa"],
  ["#onde-estamos", "Onde estamos"],
  ["#duvidas", "Dúvidas"],
] as const;

export function Header() {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<string>("#inicio");
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [open]);

  return (
    <header
      className={
        "header [background:var(--black)] [color:white] relative [z-index:20]"
      }
    >
      <div
        className={
          "site-container [width:min(1240px,_calc(100%_-_88px))] mx-auto max-[1150px]:[width:calc(100%_-_56px)] max-[700px]:[width:calc(100%_-_40px)] max-[360px]:[width:calc(100%_-_28px)] header-inner [min-height:108px] flex items-center justify-between [gap:26px] max-[1150px]:[gap:18px] max-[900px]:[min-height:91px] max-[700px]:[min-height:84px] max-[700px]:gap-4 max-[700px]:flex-wrap"
        }
      >
        <a
          className={
            "brand flex items-center gap-3 [flex-shrink:0] [&_>_span]:[font:800_29px/0.85_var(--display)] [&_>_span]:[letter-spacing:0.25px] [&_small]:block [&_small]:[font:500_11px_var(--body)] [&_small]:[letter-spacing:1.2px] [&_small]:[color:var(--yellow)] [&_small]:[margin-top:9px] max-[1150px]:[&_>_span]:[font-size:26px] max-[900px]:[&_>_span]:[font-size:24px] max-[700px]:[&_>_span]:[font-size:24px] max-[700px]:[&_small]:[font-size:8px] max-[700px]:[&_small]:[margin-top:7px]"
          }
          href="#inicio"
          aria-label={`${restaurant.name}, início`}
        >
          <Icon
            className={
              "brand-icon [width:53px] [height:63px] [color:var(--yellow)] [stroke-width:2.7] max-[1150px]:[width:45px] max-[900px]:[width:40px] max-[700px]:[width:37px] max-[700px]:[height:47px]"
            }
            name="burger"
          />
          <span>
            {restaurant.brandLines[0]}
            <br />
            {restaurant.brandLines[1]}
            <small>Desde {restaurant.founded}</small>
          </span>
        </a>
        <button
          className={
            "nav-toggle hidden max-[700px]:flex max-[700px]:flex-col max-[700px]:[gap:5px] max-[700px]:ml-auto max-[700px]:[order:2] max-[700px]:[min-height:44px] max-[700px]:[min-width:44px] max-[700px]:[&_span]:block max-[700px]:[&_span]:[width:22px] max-[700px]:[&_span]:[height:2px] max-[700px]:[&_span]:[background:var(--yellow)] icon-button [border:0] [background:transparent] grid place-items-center [padding:10px]"
          }
          aria-label={open ? "Fechar menu" : "Abrir menu"}
          aria-controls="navigation"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          <span />
          <span />
          <span />
        </button>
        <nav
          id="navigation"
          className={tw(`navigation${open ? " open" : ""}`)}
          aria-label="Menu principal"
        >
          {navigation.map(([href, label]) => (
            <a
              key={href}
              className={tw(active === href ? "nav-active" : undefined)}
              href={href}
              onClick={() => {
                setOpen(false);
                setActive(href);
              }}
            >
              {label}
            </a>
          ))}
        </nav>
        <a
          className={
            "button inline-flex items-center justify-center gap-3 [min-height:49px] [padding:13px_23px] [border:1px_solid_transparent] rounded-[2px] [font-family:var(--display)] [font-size:18px] font-bold [line-height:1.2] [transition:background_0.18s,_color_0.18s,_transform_0.18s] [&:hover]:[transform:translateY(-2px)] [&_svg]:[width:21px] [&_svg]:[height:21px] button-yellow [background:var(--yellow)] [color:#17130a] [&:hover]:[background:#ffcc33] header-order [margin-left:14px] [min-height:45px] [font-size:16px] [padding:11px_17px] max-[900px]:[font-size:15px] max-[900px]:[padding:10px_12px] max-[900px]:[margin-left:0] max-[900px]:[&_svg]:hidden max-[700px]:ml-auto max-[700px]:[order:1] max-[700px]:[min-height:42px] max-[700px]:[padding:10px_13px] max-[360px]:[padding:10px] max-[360px]:[font-size:14px]"
          }
          href="#cardapio"
        >
          <Icon name="burger" /> Ver cardápio
        </a>
      </div>
    </header>
  );
}
