"use client";

import { SectionLink } from "./section-link";

import { tw } from "../styles/tailwind";

import { TemplateImage } from "./template-image";
import { useHamburgueriaDocument } from "./document-provider";
import { formatPriceCents } from "../lib/format";
import { useInteractions } from "./interaction-provider";
import { OrderLink } from "./contact-links";
import { Icon } from "./icons";

export function Menu() {
  const { content: { menu }, locale, currency } = useHamburgueriaDocument();
  const { products, categories } = menu;
  const { category, setCategory } = useInteractions();
  return (
    <section
      className={
        "menu-section [background:var(--paper)] section-pad [padding:78px_0] max-[900px]:[padding:60px_0] max-[700px]:[padding:48px_0]"
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
            "section-heading flex justify-between items-end gap-6 [margin-bottom:28px] [&_.text-link]:[border:1px_solid_var(--yellow-dark)] [&_.text-link]:[padding:9px_16px] [&_.text-link]:[font-size:14px] max-[700px]:items-start max-[700px]:[gap:17px] max-[700px]:flex-col max-[700px]:[margin-bottom:23px] max-[700px]:[&_.text-link]:[padding:6px_0] max-[700px]:[&_.text-link]:[border:0] max-[700px]:[&_.text-link]:[font-size:13px]"
          }
        >
          <div>
            <p
              className={
                "handwritten [font-family:var(--hand)] [font-size:29px] [line-height:1.3] [color:var(--yellow-dark)] [margin-bottom:7px] max-[700px]:[font-size:26px]"
              }
            >
              {menu.eyebrow}
            </p>
            <h2 id="menu-title">{menu.title}</h2>
          </div>
          <SectionLink
            className={
              "text-link [border:0] [background:none] [padding:8px_0] inline-flex items-center gap-3 [font-size:15px] [font-weight:600] [&:hover]:[text-decoration:underline] [&_svg]:[width:20px]"
            }
            href="#como-pedir"
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
          <span
            className={
              "menu-note [font-size:13px] [color:var(--muted)] max-[1150px]:hidden"
            }
          >
            {menu.note}
          </span>
        </div>
        <div
          id="menu-grid"
          className={
            "menu-grid grid [grid-template-columns:repeat(4,_1fr)] [gap:22px] max-[1150px]:[gap:16px] max-[900px]:[grid-template-columns:repeat(2,_1fr)] max-[900px]:[gap:22px] max-[700px]:[gap:14px] max-[360px]:[gap:10px]"
          }
          aria-live="polite"
        >
          {products.map((product) => (
            <article
              key={product.id}
              className={tw(
                `product-card${product.image ? "" : " simple-product"}`,
              )}
              hidden={product.categoryId !== category}
            >
              <div
                className={
                  "product-image relative [background:#141412] [aspect-ratio:1.2] overflow-hidden [&_.template-image]:w-full [&_.template-image]:h-full [&_.template-image]:object-cover [&_.template-image]:[transition:transform_0.4s] max-[900px]:[aspect-ratio:1.5] max-[700px]:[aspect-ratio:1.05]"
                }
              >
                {product.image ? (
                  <TemplateImage
                    image={product.image}
                    width={640}
                    height={640}
                    loading="lazy"
                  />
                ) : (
                  <Icon name={product.icon ?? "burger"} />
                )}
                {(product.badge || product.vegetarian) && (
                  <span
                    className={tw(
                      `product-badge${product.vegetarian ? " vegetarian" : ""}`,
                    )}
                  >
                    {product.badge ?? menu.vegetarianLabel}
                  </span>
                )}
              </div>
              <div
                className={
                  "product-body [padding:18px] flex flex-col [flex:1] [&_h3]:[font-size:25px] [&_h3]:[line-height:1.1] [&_h3]:[margin-bottom:9px] [&_>_p]:[font-size:13px] [&_>_p]:[line-height:1.55] [&_>_p]:[color:#646057] [&_>_p]:flex-1 [&_>_p]:[min-height:61px] max-[1150px]:[padding:14px] max-[1150px]:[&_h3]:[font-size:23px] max-[1150px]:[&_>_p]:[font-size:12px] max-[900px]:[padding:20px] max-[900px]:[&_h3]:[font-size:28px] max-[900px]:[&_>_p]:[font-size:14px] max-[900px]:[&_>_p]:[min-height:43px] max-[700px]:[padding:13px_12px] max-[700px]:[&_h3]:[font-size:23px] max-[700px]:[&_>_p]:[font-size:12px] max-[700px]:[&_>_p]:[min-height:94px] max-[360px]:[padding:11px] max-[360px]:[&_h3]:[font-size:21px]"
                }
              >
                <h3>{product.name}</h3>
                <p>{product.description}</p>
                <div
                  className={
                    "product-bottom flex justify-between items-center [gap:10px] [margin-top:19px] max-[700px]:flex-col max-[700px]:items-start max-[700px]:[gap:11px] max-[700px]:[margin-top:13px]"
                  }
                >
                  <span
                    className={
                      "product-price [font-family:var(--display)] [font-size:28px] font-bold [color:#9d6500] whitespace-nowrap max-[1150px]:[font-size:25px] max-[900px]:[font-size:30px] max-[700px]:[font-size:29px] max-[700px]:[line-height:1]"
                    }
                  >
                    {formatPriceCents(product.priceCents, locale, currency)}
                  </span>
                  <OrderLink
                    product={product}
                    className={
                      "product-order [font-family:var(--display)] [font-size:17px] font-semibold flex items-center [gap:6px] [border:0] [background:var(--ink)] [color:white] [padding:8px_12px] [border-radius:3px] [&:hover]:[background:#55421a] [&_svg]:[width:16px] [&_svg]:[height:16px] max-[1150px]:[font-size:15px] max-[1150px]:[padding:7px_9px] max-[900px]:[font-size:17px] max-[900px]:[padding:8px_15px] max-[700px]:[font-size:16px] max-[700px]:justify-center max-[700px]:[padding:9px_10px] max-[700px]:[min-height:40px] max-[700px]:w-full order-link"
                    }
                    aria-label={`Pedir ${product.name.toLocaleLowerCase(locale)} pelo WhatsApp`}
                  >
                    {menu.orderButtonLabel} <Icon name="arrow" />
                  </OrderLink>
                </div>
                {product.allergens && (
                  <p className={"product-allergens [margin-top:12px]"}>
                    {product.allergens}
                  </p>
                )}
              </div>
            </article>
          ))}
        </div>
        <div
          className={
            "extras-strip [margin-top:24px] [border-top:1px_solid_var(--line)] [padding-top:20px] flex flex-wrap [gap:10px_24px] [font-size:13px] [color:#726b5e] [&_strong]:[color:var(--ink)] max-[700px]:[font-size:12px] max-[700px]:[gap:7px_17px] max-[700px]:[&_strong]:w-full"
          }
        >
          <strong>{menu.extrasHeading}</strong>
          {menu.extras.map((extra) => (
            <span key={extra.id}>
              {extra.name} + {formatPriceCents(extra.priceCents, locale, currency)}
            </span>
          ))}
        </div>
        <div
          className={
            "menu-footer flex items-center justify-between gap-5 [padding-top:25px] [font-size:12px] [color:#716d64] [&_span]:flex [&_span]:gap-2 [&_span]:items-center [&_svg]:[width:19px] [&_svg]:[color:#607b2d] max-[700px]:flex-col max-[700px]:items-start max-[700px]:gap-2 max-[700px]:[font-size:11px] max-[700px]:[padding-top:19px]"
          }
        >
          {products.some(product => product.vegetarian) && (
            <span><Icon name="leaf" /> {menu.vegetarianNote}</span>
          )}
          <p>{menu.customizationNote}</p>
        </div>
      </div>
    </section>
  );
}
