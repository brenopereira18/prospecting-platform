"use client";

import { SectionLink } from "./section-link";

import { tw } from "../styles/tailwind";

import { TemplateImage } from "./template-image";
import { useHamburgueriaDocument } from "./document-provider";
import { formatPriceCents } from "../lib/format";
import { useInteractions } from "./interaction-provider";
import { Icon } from "./icons";
import { OrderLink } from "./contact-links";
import { publicHours } from "../lib/presentation";

export function Menu() {
  const document = useHamburgueriaDocument();
  const {
    content: { menu, hero },
    locale,
    currency,
  } = document;
  const hours = publicHours(document, "hero").join(" ");
  const { products, categories } = menu;
  const { category, setCategory } = useInteractions();
  return (
    <section
      className={
        "menu-section [background:var(--surface)] section-pad [padding:78px_0] max-[900px]:[padding:60px_0] max-[700px]:[padding:48px_0]"
      }
      id="cardapio"
      aria-labelledby="menu-title"
    >
      <div
        className={
          "site-container [width:min(1240px,_calc(100%_-_88px))] mx-auto max-[1150px]:[width:calc(100%_-_56px)] max-[700px]:[width:calc(100%_-_40px)] max-[360px]:[width:calc(100%_-_28px)]"
        }
      >
        <div
          className={
            "section-heading flex justify-between items-end gap-6 [margin-bottom:28px] [&_.text-link]:[border:1px_solid_var(--accent)] [&_.text-link]:[padding:9px_16px] [&_.text-link]:[font-size:14px] max-[700px]:items-start max-[700px]:[gap:17px] max-[700px]:flex-col max-[700px]:[margin-bottom:23px] max-[700px]:[&_.text-link]:[padding:6px_0] max-[700px]:[&_.text-link]:[border:0] max-[700px]:[&_.text-link]:[font-size:13px]"
          }
        >
          <div>
            {menu.eyebrow.trim() && (
              <p
                className={
                  "handwritten [font-family:var(--hand)] [font-size:29px] [line-height:1.3] [color:var(--accent)] [margin-bottom:7px] max-[700px]:[font-size:26px]"
                }
              >
                {menu.eyebrow}
              </p>
            )}
            <h2 id="menu-title">{menu.title}</h2>
          </div>
          <SectionLink
            className={
              "text-link [border:0] [background:none] [padding:8px_0] inline-flex items-center gap-3 [font-size:15px] [font-weight:600] [&:hover]:[text-decoration:underline] [&_svg]:[width:20px]"
            }
            href="#onde-estamos"
          >
            {menu.helpLinkLabel} <Icon name="arrow" />
          </SectionLink>
        </div>
        <div
          className={
            "menu-controls flex justify-between items-center gap-5 [margin-bottom:27px] max-[700px]:[margin-bottom:21px]"
          }
        >
          <div
            className={
              "menu-tabs flex gap-2 flex-wrap max-[700px]:[gap:7px] max-[360px]:[gap:5px]"
            }
            role="group"
            aria-label={menu.categoryGroupLabel}
          >
            {categories.map((item) => (
              <button
                key={item.id}
                className={tw(
                  `menu-tab${category === item.id ? " active" : ""}`,
                )}
                aria-pressed={category === item.id}
                onClick={() => setCategory(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
          {menu.note.trim() && (
            <span
              className={
                "menu-note [font-size:13px] [color:var(--muted)] max-[1150px]:hidden"
              }
            >
              {menu.note}
            </span>
          )}
        </div>
        <div
          id="menu-grid"
          aria-live="polite"
          className="menu-grid grid grid-cols-2 gap-4 max-[900px]:grid-cols-1"
        >
          {!products.some((product) => product.categoryId === category) && (
            <p
              role="status"
              className="col-span-full py-10 text-center [color:var(--muted)]"
            >
              {products.length
                ? "Nenhum produto nesta categoria."
                : "Nenhum produto disponível no momento."}
            </p>
          )}
          {products.map((product) => (
            <article
              key={product.id}
              className="product-card color-card grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-stretch gap-4 rounded-md border border-[var(--line)] bg-[var(--surface)] p-4 max-[700px]:gap-3 max-[700px]:p-3.5 max-[360px]:p-3"
              hidden={product.categoryId !== category}
            >
              <div className="product-body flex h-full min-w-0 flex-col items-start gap-1.5 [overflow-wrap:anywhere]">
                <div className="grid w-full min-w-0 grid-cols-1 justify-items-start gap-1.5">
                  <h3 className="min-w-0 text-xl leading-tight max-[700px]:text-lg">
                    {product.name}
                  </h3>
                  {(product.badge?.trim() || product.vegetarian) && (
                    <span
                      className={`product-badge inline-flex rounded-sm px-2 py-1 text-[10px] font-bold leading-tight ${product.vegetarian ? "bg-[var(--template-tertiary)] text-[var(--page-text)]" : "bg-[var(--brand)] text-[var(--on-brand)]"}`}
                    >
                      {product.badge?.trim() || menu.vegetarianLabel}
                    </span>
                  )}
                </div>
                {product.description.trim() && (
                  <p className="text-[13px] leading-relaxed text-[var(--muted)]">
                    {product.description}
                  </p>
                )}
                <span className="product-price mt-auto whitespace-nowrap pt-1 font-[family-name:var(--display)] text-[22px] font-bold leading-tight text-[var(--accent)] max-[700px]:text-xl">
                  {formatPriceCents(product.priceCents, locale, currency)}
                </span>
              </div>
              <div
                className={`product-image grid size-28 shrink-0 place-items-center self-center overflow-hidden rounded-md max-[700px]:size-22 max-[360px]:size-20 [&_.template-image]:h-full [&_.template-image]:w-full [&_.template-image]:object-cover [&_svg]:size-10 ${product.image ? "bg-[var(--secondary)]" : "bg-[var(--soft-surface)] text-[var(--soft-accent)]"}`}
              >
                {product.image ? (
                  <TemplateImage
                    image={product.image}
                    width={160}
                    height={160}
                    sizes="(max-width: 360px) 80px, (max-width: 700px) 88px, 112px"
                    loading="lazy"
                  />
                ) : (
                  <Icon name={product.icon ?? "burger"} />
                )}
              </div>
            </article>
          ))}
        </div>
        {Boolean(menu.extras.length || menu.extrasHeading.trim()) && (
          <div
            className={
              "extras-strip [margin-top:24px] [border-top:1px_solid_var(--line)] [padding-top:20px] flex flex-wrap [gap:10px_24px] [font-size:13px] [color:var(--muted)] [&_strong]:[color:var(--text)] max-[700px]:[font-size:12px] max-[700px]:[gap:7px_17px] max-[700px]:[&_strong]:w-full"
            }
          >
            {menu.extrasHeading.trim() && <strong>{menu.extrasHeading}</strong>}
            {menu.extras.map((extra) => (
              <span key={extra.id}>
                {extra.name} +{" "}
                {formatPriceCents(extra.priceCents, locale, currency)}
              </span>
            ))}
          </div>
        )}
        {Boolean(
          menu.customizationNote.trim() ||
            (menu.vegetarianNote.trim() &&
              products.some((product) => product.vegetarian)),
        ) && (
          <div
            className={
              "menu-footer flex items-center justify-between gap-5 [padding-top:25px] [font-size:12px] [color:var(--muted)] [&_span]:flex [&_span]:gap-2 [&_span]:items-center [&_svg]:[width:19px] [&_svg]:[color:var(--accent)] max-[700px]:flex-col max-[700px]:items-start max-[700px]:gap-2 max-[700px]:[font-size:11px] max-[700px]:[padding-top:19px]"
            }
          >
            {menu.vegetarianNote.trim() &&
              products.some((product) => product.vegetarian) && (
                <span>
                  <Icon name="leaf" /> {menu.vegetarianNote}
                </span>
              )}
            {menu.customizationNote.trim() && <p>{menu.customizationNote}</p>}
          </div>
        )}
        <div className="menu-order mt-7 flex flex-wrap items-center justify-between gap-4 border-t border-[var(--line)] pt-6">
          {[hours, hero.serviceSummary].some((value) => value.trim()) && (
            <p className="min-w-0 text-sm leading-relaxed text-[var(--muted)] [overflow-wrap:anywhere]">
              {[hours, hero.serviceSummary]
                .filter((value) => value.trim())
                .join(" · ")}
            </p>
          )}
          <OrderLink className="button button-yellow inline-flex min-h-12 items-center justify-center gap-3 rounded-sm border border-[var(--control-border)] bg-[var(--brand)] px-6 py-3 font-[family-name:var(--display)] text-lg font-bold text-[var(--on-brand)] hover:bg-[var(--action-primary-hover)] hover:text-[var(--on-action-primary-hover)] max-[700px]:w-full">
            {menu.orderButtonLabel} <Icon name="arrow" />
          </OrderLink>
        </div>
      </div>
    </section>
  );
}
