"use client";

import { Icon } from "./icons";
import { useHamburgueriaDocument } from "./document-provider";
import { SectionLink } from "./section-link";
import { structuralSectionIds } from "../lib/navigation";

export function Header() {
  const { business, content } = useHamburgueriaDocument();

  return (
    <header
      id={structuralSectionIds.header}
      className={
        "header color-deep [background:var(--surface)] [color:var(--text)] relative [z-index:20]"
      }
    >
      <div
        className={
          "site-container [width:min(1240px,_calc(100%_-_88px))] mx-auto max-[1150px]:[width:calc(100%_-_56px)] max-[700px]:[width:calc(100%_-_40px)] max-[360px]:[width:calc(100%_-_28px)] header-inner [min-height:108px] py-4 flex flex-wrap items-center justify-between [gap:26px] max-[1150px]:[gap:18px] max-[900px]:[min-height:91px] max-[700px]:[min-height:84px] max-[700px]:gap-4 max-[360px]:gap-2"
        }
      >
        <SectionLink
          className={
            "brand flex min-w-0 max-w-full flex-1 items-center gap-3 [&_>_span]:min-w-0 [&_>_span]:[overflow-wrap:anywhere] [&_>_span]:[font:800_29px/0.85_var(--display)] [&_>_span]:[letter-spacing:0.25px] [&_small]:block [&_small]:[font:500_11px_var(--body)] [&_small]:[letter-spacing:1.2px] [&_small]:[color:var(--accent)] [&_small]:[margin-top:9px] max-[1150px]:[&_>_span]:[font-size:26px] max-[900px]:[&_>_span]:[font-size:24px] max-[700px]:[&_>_span]:[font-size:24px] max-[700px]:[&_small]:[font-size:8px] max-[700px]:[&_small]:[margin-top:7px]"
          }
          href="#inicio"
          fallbackHref="#conteudo"
          aria-label={`${business.name}, início`}
        >
          <Icon
            className={
              "brand-icon shrink-0 [width:53px] [height:63px] [color:var(--accent)] [stroke-width:2.7] max-[1150px]:[width:45px] max-[900px]:[width:40px] max-[700px]:[width:37px] max-[700px]:[height:47px]"
            }
            name="burger"
          />
          <span>
            {business.brandLines[0]}
            {business.brandLines[1].trim() && (
              <>
                <br />
                {business.brandLines[1]}
              </>
            )}
            {business.foundedYear !== undefined && (
              <small>Desde {business.foundedYear}</small>
            )}
          </span>
        </SectionLink>
        <SectionLink
          className={
            "button inline-flex items-center justify-center gap-3 [min-height:49px] [padding:13px_23px] [border:1px_solid_var(--control-border)] rounded-[2px] [font-family:var(--display)] [font-size:18px] font-bold [line-height:1.2] [transition:background_0.18s,_color_0.18s,_transform_0.18s] [&:hover]:[transform:translateY(-2px)] [&_svg]:[width:21px] [&_svg]:[height:21px] button-yellow [background:var(--brand)] [color:var(--on-brand)] [&:hover]:[background:var(--action-primary-hover)] [&:hover]:[color:var(--on-action-primary-hover)] [&:active]:[background:var(--action-primary-hover)] [&:active]:[color:var(--on-action-primary-hover)] header-order max-w-full shrink-0 [overflow-wrap:anywhere] [margin-left:14px] [min-height:45px] [font-size:16px] [padding:11px_17px] max-[900px]:[font-size:15px] max-[900px]:[padding:10px_12px] max-[900px]:[margin-left:0] max-[900px]:[&_svg]:hidden max-[700px]:ml-auto max-[700px]:[order:1] max-[700px]:[min-height:44px] max-[700px]:[padding:10px_13px] max-[360px]:[padding:10px] max-[360px]:[font-size:14px]"
          }
          href="#cardapio"
        >
          <Icon name="burger" /> {content.header.menuButtonLabel}
        </SectionLink>
      </div>
    </header>
  );
}
