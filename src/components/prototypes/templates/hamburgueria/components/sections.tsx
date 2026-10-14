import Image from "next/image";
import { Fragment } from "react";
import { restaurant } from "../data/restaurant";
import { formatPrice } from "../lib/format";
import { OrderLink, SocialLink, ComboLink } from "./contact-links";
import { Icon } from "./icons";

export function Hero() {
  return (
    <section
      className={
        "hero relative [background:var(--black)] [color:var(--paper)] overflow-hidden [&_.handwritten]:[color:var(--yellow)] [&_.handwritten]:[font-size:32px] [&_.handwritten]:[transform:rotate(-3deg)] [&_.handwritten]:[transform-origin:left] [&_.handwritten]:[margin-bottom:20px] [&_h1]:[font:800_clamp(70px,_7.4vw,_106px)/0.92_var(--display)] [&_h1]:[letter-spacing:-2px] [&_h1_span]:[color:var(--yellow)] max-[1150px]:[&_h1]:[font-size:87px] max-[900px]:[&_h1]:[font-size:76px] max-[700px]:[&_.handwritten]:[font-size:27px] max-[700px]:[&_.handwritten]:[margin-bottom:15px] max-[700px]:[&_h1]:[font-size:clamp(65px,_13.8vw,_93px)] max-[700px]:[&_h1]:[letter-spacing:-1.6px] max-[360px]:[&_h1]:[font-size:63px]"
      }
      id="inicio"
      aria-labelledby="hero-title"
    >
      <Image
        className={
          "hero-photo absolute [right:0] [top:-12%] w-full [height:116%] object-cover [object-position:center_51%] min-[1600px]:[object-position:center_55%] max-[1150px]:[width:115%] max-[1150px]:[max-width:none] max-[1150px]:[right:-12%] max-[1150px]:[object-position:center] max-[700px]:[top:auto] max-[700px]:[bottom:-27px] max-[700px]:[height:440px] max-[700px]:[width:140%] max-[700px]:[right:-11%] max-[700px]:[object-position:61%_55%]"
        }
        src={restaurant.hero.image}
        alt={restaurant.hero.imageAlt}
        fetchPriority="high"
        loading="eager"
        width="1536"
        height="1024"
      />
      <div
        className={
          "hero-shade absolute [inset:0] [background:linear-gradient(_90deg,_#0c0c0b_0%,_#0c0c0bf5_21%,_#0c0c0bb0_38%,_#0c0c0b0d_65%_),_linear-gradient(0deg,_#0c0c0b_0%,_transparent_18%)] max-[900px]:[background:linear-gradient(_90deg,_#0c0c0b_0%,_#0c0c0be8_28%,_#0c0c0b55_66%,_#0c0c0b11_),_linear-gradient(0deg,_#0c0c0b,_transparent_20%)] max-[700px]:[background:linear-gradient(_180deg,_#0c0c0b_0%,_#0c0c0b_36%,_#0c0c0bc0_43%,_transparent_64%,_#0c0c0b55_100%_)]"
        }
      ></div>
      <div
        className={
          "site-container [width:min(1240px,_calc(100%_-_88px))] mx-auto max-[1150px]:[width:calc(100%_-_56px)] max-[700px]:[width:calc(100%_-_40px)] max-[360px]:[width:calc(100%_-_28px)] hero-inner [min-height:622px] relative flex items-center min-[1600px]:[min-height:680px] max-[1150px]:[min-height:590px] max-[900px]:[min-height:570px] max-[700px]:[min-height:740px] max-[700px]:items-start max-[360px]:[min-height:715px]"
        }
      >
        <div
          className={
            "hero-copy relative [padding:35px_0_50px] [z-index:2] [max-width:650px] max-[900px]:[max-width:480px] max-[700px]:[padding:31px_0_0] max-[700px]:max-w-full max-[700px]:w-full"
          }
        >
          <p
            className={
              "handwritten [font-family:var(--hand)] [font-size:29px] [line-height:1.3] [color:var(--yellow-dark)] [margin-bottom:7px] max-[700px]:[font-size:26px]"
            }
          >
            {restaurant.hero.eyebrow}
          </p>
          <h1 id="hero-title">
            {restaurant.hero.headline[0]}
            <br />
            <span>{restaurant.hero.headline[1]}</span>
          </h1>
          <p
            className={
              "hero-description [margin-top:27px] [color:#e4e1d8] [font-size:17px] [line-height:1.65] max-[1150px]:[font-size:16px] max-[900px]:[max-width:335px] max-[700px]:[max-width:360px] max-[700px]:[font-size:14px] max-[700px]:[margin-top:20px] max-[700px]:[line-height:1.7]"
            }
          >
            {restaurant.hero.description[0]}
            <br className={"desktop-break max-[900px]:hidden"} />
            {restaurant.hero.description[1]}
          </p>
          <div
            className={
              "hero-actions flex [gap:13px] [margin-top:29px] max-[700px]:[margin-top:23px] max-[700px]:[gap:9px] max-[700px]:[&_.button]:[font-size:16px] max-[700px]:[&_.button]:[padding:12px_16px] max-[700px]:[&_.button]:[min-height:47px] max-[700px]:[&_.button_svg]:[width:18px] max-[360px]:[&_.button]:[font-size:15px] max-[360px]:[&_.button]:[padding:12px] max-[360px]:[&_svg]:hidden"
            }
          >
            <a
              className={
                "button inline-flex items-center justify-center gap-3 [min-height:49px] [padding:13px_23px] [border:1px_solid_transparent] rounded-[2px] [font-family:var(--display)] [font-size:18px] font-bold [line-height:1.2] [transition:background_0.18s,_color_0.18s,_transform_0.18s] [&:hover]:[transform:translateY(-2px)] [&_svg]:[width:21px] [&_svg]:[height:21px] button-yellow [background:var(--yellow)] [color:#17130a] [&:hover]:[background:#ffcc33]"
              }
              href="#cardapio"
            >
              Ver cardápio e pedir{" "}
              <svg>
                <use href="#i-burger" />
              </svg>
            </a>
            <a
              className={
                "button inline-flex items-center justify-center gap-3 [min-height:49px] [padding:13px_23px] [border:1px_solid_transparent] rounded-[2px] [font-family:var(--display)] [font-size:18px] font-bold [line-height:1.2] [transition:background_0.18s,_color_0.18s,_transform_0.18s] [&:hover]:[transform:translateY(-2px)] [&_svg]:[width:21px] [&_svg]:[height:21px] button-outline [border-color:#ba901f] [color:var(--paper)] [background:transparent] [&:hover]:[background:#f5bb1614]"
              }
              href="#onde-estamos"
            >
              Conhecer a casa{" "}
              <svg>
                <use href="#i-pin" />
              </svg>
            </a>
          </div>
          <a
            className={
              "hero-reviews flex items-center [gap:13px] [margin-top:27px] [font-size:13px] [&_strong]:[font-size:16px] [&_>_span:last-child]:[color:#d9d6cc] max-[700px]:[margin-top:22px] max-[700px]:[gap:10px] max-[700px]:[font-size:11px] max-[700px]:flex-wrap max-[700px]:[&_.stars]:[font-size:17px] max-[700px]:[&_.stars]:[letter-spacing:2px] max-[700px]:[&_strong]:[font-size:14px] max-[360px]:[&_>_span:last-child]:[font-size:10px]"
            }
            href="#avaliacoes"
          >
            <span
              className={
                "stars [color:var(--yellow)] [letter-spacing:3px] whitespace-nowrap [font-size:20px] [line-height:1]"
              }
              aria-label="5 estrelas"
            >
              ★★★★★
            </span>
            <strong>{restaurant.reviews.rating.toLocaleString("pt-BR")}</strong>
            <span>
              Mais de {restaurant.reviews.count} boas mordidas
              {restaurant.demo && "*"}
            </span>
          </a>
          <p
            className={
              "hero-service flex items-center gap-2 [font-size:12px] [color:#bdb9ad] [margin-top:14px] [&_svg]:[width:15px] [&_svg]:[height:15px] [&_>_span]:[height:3px] [&_>_span]:[width:3px] [&_>_span]:[background:var(--yellow)] [&_>_span]:rounded-full [&_>_span]:[margin:0_3px] max-[700px]:[font-size:10px] max-[700px]:[margin-top:10px] max-[700px]:[gap:5px]"
            }
          >
            <svg>
              <use href="#i-clock" />
            </svg>{" "}
            {restaurant.hero.hours} <span></span> {restaurant.hero.service}
          </p>
        </div>
        <div
          className={
            "hero-stamp absolute [right:0] [bottom:35px] [width:136px] [height:136px] [background:#111110ec] [border:2px_solid_#b88c16] rounded-full [color:var(--yellow)] flex flex-col items-center justify-center [transform:rotate(-11deg)] [outline:1px_solid_#7f6218] [outline-offset:-8px] [box-shadow:0_5px_25px_#0007] [&_span]:[font:600_23px_var(--display)] [&_strong]:[font:700_24px/1_var(--display)] [&_strong]:[text-align:center] [&_svg]:[height:24px] [&_svg]:[margin-top:5px] max-[900px]:[width:115px] max-[900px]:[height:115px] max-[900px]:[right:-8px] max-[900px]:[&_strong]:[font-size:21px] max-[900px]:[&_span]:[font-size:21px] max-[700px]:[bottom:26px] max-[700px]:[right:2px] max-[700px]:[width:104px] max-[700px]:[height:104px] max-[700px]:[background:#111110ec] max-[700px]:[&_strong]:[font-size:19px] max-[700px]:[&_span]:[font-size:18px] max-[700px]:[&_svg]:[height:20px]"
          }
          aria-label="100% feito na brasa"
        >
          <span>100%</span>
          <strong>
            FEITO
            <br />
            NA BRASA
          </strong>
          <svg>
            <use href="#i-fire" />
          </svg>
        </div>
      </div>
      <div
        className={
          "hero-bottom absolute [bottom:16px] [right:calc((100%_-_min(1240px,_100%_-_88px))_/_2_+_166px)] [font-family:var(--hand)] [font-size:20px] [color:#d9c693] [transform:rotate(-3deg)] max-[1150px]:hidden"
        }
      >
        Feito na hora. Do nosso jeito. Pra sua fome.
      </div>
    </section>
  );
}

export function Qualities() {
  return (
    <section
      className={
        "qualities [background:#191918] [color:white] [border-top:1px_solid_#ffffff0a] [&_svg]:[height:39px] [&_svg]:[width:39px] [&_svg]:[color:var(--yellow)] [&_svg]:[stroke-width:1.25] [&_strong]:block [&_strong]:[font:600_20px_var(--display)] [&_strong]:whitespace-nowrap [&_span]:block [&_span]:[color:#bab8b0] [&_span]:[font-size:12px] [&_span]:[margin-top:4px] max-[1150px]:[&_strong]:[font-size:17px] max-[1150px]:[&_span]:[font-size:11px] max-[1150px]:[&_svg]:[width:31px] max-[900px]:[&_strong]:[font-size:21px] max-[900px]:[&_span]:[font-size:12px] max-[700px]:[&_svg]:[width:30px] max-[700px]:[&_svg]:[height:34px] max-[700px]:[&_strong]:[font-size:16px] max-[700px]:[&_strong]:[white-space:normal] max-[700px]:[&_strong]:[line-height:1.1] max-[700px]:[&_span]:[font-size:10px] max-[700px]:[&_span]:[line-height:1.5]"
      }
      aria-label="O jeito Brasa de fazer"
    >
      <div
        className={
          "site-container [width:min(1240px,_calc(100%_-_88px))] mx-auto max-[1150px]:[width:calc(100%_-_56px)] max-[700px]:[width:calc(100%_-_40px)] max-[360px]:[width:calc(100%_-_28px)] qualities-grid grid [grid-template-columns:repeat(4,_1fr)] [padding:29px_0] [&_>_div]:flex [&_>_div]:items-center [&_>_div]:[gap:15px] [&_>_div]:[padding:0_24px] [&_>_div]:[border-right:1px_solid_#ffffff25] [&_>_div:first-child]:[padding-left:0] [&_>_div:last-child]:[border:0] [&_>_div:last-child]:[padding-right:0] max-[1150px]:[&_>_div]:[padding:0_16px] max-[1150px]:[&_>_div]:[gap:10px] max-[900px]:[grid-template-columns:1fr_1fr] max-[900px]:[gap:22px] max-[900px]:[padding:25px_0] max-[900px]:[&_>_div:nth-child(2)]:[border:0] max-[700px]:[gap:23px_12px] max-[700px]:[padding:26px_0] max-[700px]:[&_>_div]:[gap:9px]"
        }
      >
        <div>
          <svg>
            <use href="#i-fire" />
          </svg>
          <p>
            <strong>Brasa de verdade</strong>
            <span>Carne fresca, sabor de fogo.</span>
          </p>
        </div>
        <div>
          <svg>
            <use href="#i-fries" />
          </svg>
          <p>
            <strong>Crocância no ponto</strong>
            <span>Batata sequinha a cada pedido.</span>
          </p>
        </div>
        <div>
          <svg>
            <use href="#i-burger" />
          </svg>
          <p>
            <strong>Feito na hora</strong>
            <span>Da chapa direto para você.</span>
          </p>
        </div>
        <div>
          <svg>
            <use href="#i-leaf" />
          </svg>
          <p>
            <strong>Capricho do início ao fim</strong>
            <span>Ingredientes escolhidos a dedo.</span>
          </p>
        </div>
      </div>
    </section>
  );
}

export function Story() {
  return (
    <section
      className={
        "combo-story grid [grid-template-columns:1fr_1fr] max-[700px]:[grid-template-columns:1fr]"
      }
      id="nossa-historia"
    >
      <div
        className={
          "combo-panel [background:#0c0c0b] relative overflow-hidden [color:white] [min-height:510px] [&_>_img]:absolute [&_>_img]:[inset:0] [&_>_img]:w-full [&_>_img]:h-full [&_>_img]:object-cover [&_>_img]:[object-position:25%_60%] max-[700px]:[min-height:485px] max-[700px]:[&_>_img]:[object-position:20%_60%] max-[700px]:[&_>_img]:w-full"
        }
      >
        <Image
          src={restaurant.featuredCombo.image}
          alt={restaurant.featuredCombo.imageAlt}
          loading="lazy"
          width="1024"
          height="1024"
        />
        <div
          className={
            "combo-panel-shade absolute [inset:0] [background:linear-gradient(90deg,_#00000005_0%,_#0006_30%,_#0c0c0be8_62%)]"
          }
        ></div>
        <div
          className={
            "combo-copy relative [width:49%] [margin-left:48%] [padding:45px_24px_48px_0] [&_.handwritten]:[color:var(--yellow)] [&_.handwritten]:[font-size:26px] [&_h2]:[font-size:clamp(36px,_4vw,_58px)] [&_h2]:[margin:10px_0_17px] [&_h2]:[line-height:0.97] [&_>_p:not(.handwritten)]:[font-size:14px] [&_>_p:not(.handwritten)]:[color:#ccc8bd] [&_.button]:[padding:12px_16px] [&_.button]:[font-size:17px] max-[900px]:[margin-left:38%] max-[900px]:[width:62%] max-[900px]:[padding-left:10px] max-[900px]:[&_h2]:[font-size:45px] max-[700px]:[width:53%] max-[700px]:[margin-left:47%] max-[700px]:[padding:35px_20px_36px_0] max-[700px]:[&_h2]:[font-size:51px] max-[700px]:[&_.handwritten]:[font-size:25px] max-[700px]:[&_.button]:[font-size:15px] max-[700px]:[&_.button]:[padding:12px] max-[700px]:[&_.button_svg]:[width:16px] max-[360px]:[margin-left:43%] max-[360px]:[width:57%] max-[360px]:[&_h2]:[font-size:47px]"
          }
        >
          <p
            className={
              "handwritten [font-family:var(--hand)] [font-size:29px] [line-height:1.3] [color:var(--yellow-dark)] [margin-bottom:7px] max-[700px]:[font-size:26px]"
            }
          >
            Sua fome merece o combo.
          </p>
          <h2>
            BURGER.
            <br />
            FRITAS.
            <br />
            FELICIDADE.
          </h2>
          <p>
            {restaurant.featuredCombo.description[0]}
            <br />
            {restaurant.featuredCombo.description[1]}
          </p>
          <div
            className={
              "combo-price flex flex-col [margin:16px_0_20px] [&_small]:[font-size:12px] [&_small]:[color:#c6c0ae] [&_strong]:[font:700_49px/1_var(--display)] [&_strong]:[color:var(--yellow)] [&_strong_span]:[font-size:30px]"
            }
          >
            <small>O trio por</small>
            <strong>
              R$ {Math.trunc(restaurant.featuredCombo.price)}
              <span>
                ,{restaurant.featuredCombo.price.toFixed(2).split(".")[1]}
              </span>
            </strong>
          </div>
          <ComboLink
            className={
              "button inline-flex items-center justify-center gap-3 [min-height:49px] [padding:13px_23px] [border:1px_solid_transparent] rounded-[2px] [font-family:var(--display)] [font-size:18px] font-bold [line-height:1.2] [transition:background_0.18s,_color_0.18s,_transform_0.18s] [&:hover]:[transform:translateY(-2px)] [&_svg]:[width:21px] [&_svg]:[height:21px] button-yellow [background:var(--yellow)] [color:#17130a] [&:hover]:[background:#ffcc33]"
            }
          >
            Conhecer os combos{" "}
            <svg>
              <use href="#i-arrow" />
            </svg>
          </ComboLink>
        </div>
      </div>
      <div
        className={
          "story-panel [background:var(--yellow)] [padding:49px_clamp(32px,_5vw,_78px)] relative overflow-hidden [&_.handwritten]:[color:#70520f] [&_h2]:[font-size:clamp(40px,_4.1vw,_60px)] [&_h2]:[margin:14px_0_22px] [&_>_p:not(.handwritten)]:[max-width:430px] [&_>_p:not(.handwritten)]:[font-size:15px] [&_>_p:not(.handwritten)]:[line-height:1.65] [&_>_p:not(.handwritten)]:[margin-top:13px] max-[900px]:[padding:40px_30px] max-[900px]:[&_h2]:[font-size:46px] max-[900px]:[&_>_p:not(.handwritten)]:[font-size:14px] max-[700px]:[padding:38px_28px_40px] max-[700px]:[&_h2]:[font-size:53px] max-[700px]:[&_>_p:not(.handwritten)]:[font-size:15px] max-[700px]:[&_>_p:not(.handwritten)]:[max-width:100%]"
        }
      >
        <p
          className={
            "handwritten [font-family:var(--hand)] [font-size:29px] [line-height:1.3] [color:var(--yellow-dark)] [margin-bottom:7px] max-[700px]:[font-size:26px]"
          }
        >
          Nossa casa, nossa essência
        </p>
        <h2>
          A GENTE LEVA
          <br />
          HAMBÚRGUER
          <br />A SÉRIO.
        </h2>
        {restaurant.story.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
        <div
          className={
            "story-signature flex items-center gap-4 [margin-top:29px] [border-top:1px_solid_#15151538] [padding-top:20px] [max-width:430px] [&_svg]:[width:42px] [&_svg]:[height:42px] [&_span]:[font-family:var(--hand)] [&_span]:[font-size:24px] [&_span]:[line-height:1.05] max-[700px]:[max-width:100%]"
          }
        >
          <svg>
            <use href="#i-fire" />
          </svg>
          <span>
            Fogo no preparo.
            <br />
            <strong>Carinho em cada pedido.</strong>
          </span>
        </div>
      </div>
    </section>
  );
}

export function HowToOrder() {
  return (
    <section
      className={
        "how-section [background:#fffdfa] section-pad [padding:78px_0] max-[900px]:[padding:60px_0] max-[700px]:[padding:48px_0]"
      }
      id="como-pedir"
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
              Da nossa chapa para você
            </p>
            <h2>CHEGOU A HORA DE MATAR A FOME.</h2>
          </div>
        </div>
        <div
          className={
            "steps grid [grid-template-columns:repeat(3,_1fr)] [gap:40px] [margin-top:38px] [&_article]:flex [&_article]:items-start [&_article]:[gap:19px] [&_h3]:[font-size:26px] [&_h3]:[margin-bottom:12px] [&_p]:[color:var(--muted)] [&_p]:[font-size:14px] [&_p]:[line-height:1.7] [&_p]:[max-width:290px] max-[1150px]:[gap:25px] max-[1150px]:[&_h3]:[font-size:23px] max-[900px]:[gap:25px] max-[900px]:[&_article]:block max-[900px]:[&_h3]:[font-size:25px] max-[700px]:[grid-template-columns:1fr] max-[700px]:[gap:29px] max-[700px]:[margin-top:30px] max-[700px]:[&_article]:flex max-[700px]:[&_article]:[gap:20px] max-[700px]:[&_h3]:[font-size:27px] max-[700px]:[&_p]:max-w-full max-[700px]:[&_p]:[font-size:14px]"
          }
        >
          <article>
            <span
              className={
                "step-number [font:700_52px/0.9_var(--display)] [color:#c69311] max-[900px]:block max-[900px]:[margin-bottom:18px] max-[700px]:[font-size:49px] max-[700px]:[margin:0]"
              }
            >
              01
            </span>
            <div>
              <h3>Escolha seus favoritos</h3>
              <p>
                Explore os burgers, acompanhamentos e bebidas do cardápio. Já
                sabe qual vai ser?
              </p>
            </div>
          </article>
          <article>
            <span
              className={
                "step-number [font:700_52px/0.9_var(--display)] [color:#c69311] max-[900px]:block max-[900px]:[margin-bottom:18px] max-[700px]:[font-size:49px] max-[700px]:[margin:0]"
              }
            >
              02
            </span>
            <div>
              <h3>Fale com a nossa equipe</h3>
              <p>
                Peça pelo WhatsApp ou direto no balcão. Conte como você gosta e
                a gente capricha.
              </p>
            </div>
          </article>
          <article>
            <span
              className={
                "step-number [font:700_52px/0.9_var(--display)] [color:#c69311] max-[900px]:block max-[900px]:[margin-bottom:18px] max-[700px]:[font-size:49px] max-[700px]:[margin:0]"
              }
            >
              03
            </span>
            <div>
              <h3>Pronto para a primeira mordida</h3>
              <p>
                Entregamos em {restaurant.delivery.estimate}. Prefere buscar? A
                retirada fica pronta em {restaurant.delivery.pickupEstimate}.
              </p>
            </div>
          </article>
        </div>
        <div
          className={
            "delivery-strip flex justify-between items-center [gap:15px] [border-top:1px_solid_var(--line)] [padding-top:24px] [margin-top:42px] [font-size:13px] [&_>_span]:flex [&_>_span]:[gap:9px] [&_>_span]:items-center [&_svg]:[color:#a2740c] [&_svg]:[width:23px] [&_>_.text-link]:[font-size:13px] max-[900px]:flex-wrap max-[900px]:justify-start max-[900px]:[gap:16px_27px] max-[700px]:[margin-top:28px] max-[700px]:[padding-top:22px] max-[700px]:grid max-[700px]:[grid-template-columns:1fr_1fr] max-[700px]:[gap:18px_10px] max-[700px]:[font-size:11px] max-[700px]:[&_>_span]:items-start max-[700px]:[&_>_span]:[gap:6px] max-[700px]:[&_svg]:[width:19px] max-[700px]:[&_svg]:[height:19px] max-[700px]:[&_.text-link]:[padding:0] max-[700px]:[&_.text-link]:[font-size:11px] max-[700px]:[&_.text-link]:[gap:5px] max-[360px]:[grid-template-columns:1fr]"
          }
        >
          <span>
            <svg>
              <use href="#i-truck" />
            </svg>{" "}
            Entrega a partir de {formatPrice(restaurant.delivery.minimumFee)}
          </span>
          <span>
            <svg>
              <use href="#i-bag" />
            </svg>{" "}
            Retirada sem taxa
          </span>
          <span>
            <svg>
              <use href="#i-check" />
            </svg>{" "}
            {restaurant.paymentMethods}
          </span>
          <a
            className={
              "text-link [border:0] [background:none] [padding:8px_0] inline-flex items-center gap-3 [font-size:15px] [font-weight:600] [&:hover]:[text-decoration:underline] [&_svg]:[width:20px]"
            }
            href="#onde-estamos"
          >
            Ver atendimento{" "}
            <svg>
              <use href="#i-arrow" />
            </svg>
          </a>
        </div>
      </div>
    </section>
  );
}

export function Reviews() {
  return (
    <section
      className={
        "reviews-section [background:#1a1a17] [color:var(--paper)] [&_.handwritten]:[color:var(--yellow)] [&_h2]:[font-size:clamp(34px,_3.5vw,_48px)] max-[900px]:[&_.section-heading]:items-start section-pad [padding:78px_0] max-[900px]:[padding:60px_0] max-[700px]:[padding:48px_0]"
      }
      id="avaliacoes"
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
              Quem prova, conta
            </p>
            <h2>É BOM. MAS PODE PERGUNTAR.</h2>
          </div>
          <div
            className={
              "rating-summary flex items-center gap-4 [flex-shrink:0] [&_>_strong]:[font:700_56px/1_var(--display)] [&_>_strong_>_span]:[font-size:24px] [&_>_strong_>_span]:[color:#9e9b91] [&_>_strong_>_span]:[margin-left:4px] [&_small]:[font-size:11px] [&_small]:block [&_small]:[color:#b8b2a4] [&_small]:[margin-top:9px] max-[900px]:[&_>_strong]:[font-size:44px] max-[900px]:[gap:10px] max-[900px]:[&_.stars]:[font-size:16px] max-[700px]:[align-self:flex-start] max-[700px]:[margin:7px_0] max-[700px]:[&_>_strong]:[font-size:47px] max-[700px]:[&_small]:[font-size:12px]"
            }
          >
            <strong>
              {restaurant.reviews.rating.toLocaleString("pt-BR")}
              <span>/5</span>
            </strong>
            <div>
              <span
                className={
                  "stars [color:var(--yellow)] [letter-spacing:3px] whitespace-nowrap [font-size:20px] [line-height:1]"
                }
              >
                ★★★★★
              </span>
              <small>
                Mais de {restaurant.reviews.count} avaliações
                {restaurant.demo && "*"}
              </small>
            </div>
          </div>
        </div>
        <div
          className={
            "reviews-grid grid [grid-template-columns:repeat(3,_1fr)] [gap:24px] [&_figure]:[margin:0] [&_figure]:[border:1px_solid_#ffffff20] [&_figure]:[padding:27px_26px] [&_figure]:[background:#ffffff03] [&_figure]:[border-radius:3px] [&_.stars]:[font-size:17px] [&_blockquote]:[margin:21px_0_25px] [&_blockquote]:[font-size:15px] [&_blockquote]:[line-height:1.8] [&_blockquote]:[color:#e3e0d5] [&_blockquote]:[min-height:108px] [&_figcaption]:flex [&_figcaption]:items-center [&_figcaption]:[gap:12px] [&_figure:nth-child(2)_.avatar]:[background:#a8b7a2] [&_figure:nth-child(3)_.avatar]:[background:#c8b0a0] [&_figcaption_strong]:[font-size:13px] [&_figcaption_strong]:block [&_figcaption_strong]:[font-weight:600] [&_figcaption_small]:[font-size:11px] [&_figcaption_small]:[color:#a7a194] [&_figcaption_small]:block [&_figcaption_svg]:ml-auto [&_figcaption_svg]:[color:var(--yellow)] [&_figcaption_svg]:[width:18px] max-[900px]:[gap:15px] max-[900px]:[&_figure]:[padding:23px_19px] max-[900px]:[&_blockquote]:[font-size:13px] max-[900px]:[&_blockquote]:[min-height:150px] max-[700px]:[grid-template-columns:1fr] max-[700px]:[gap:16px] max-[700px]:[&_figure]:[padding:24px] max-[700px]:[&_blockquote]:[min-height:0] max-[700px]:[&_blockquote]:[font-size:15px] max-[700px]:[&_blockquote]:[margin:18px_0_22px] max-[700px]:[&_figcaption_strong]:[font-size:14px] max-[700px]:[&_figcaption_small]:[font-size:12px]"
          }
        >
          {restaurant.reviews.entries.map((review) => (
            <figure key={review.name}>
              <div
                className={
                  "stars [color:var(--yellow)] [letter-spacing:3px] whitespace-nowrap [font-size:20px] [line-height:1]"
                }
                aria-label="5 estrelas"
              >
                ★★★★★
              </div>
              <blockquote>“{review.quote}”</blockquote>
              <figcaption>
                <span
                  className={
                    "avatar grid place-items-center [width:39px] [height:39px] rounded-full [background:#d9b778] [color:#302c22] [font-size:12px] [font-weight:700]"
                  }
                >
                  {review.initials}
                </span>
                <span>
                  <strong>{review.name}</strong>
                  <small>{review.role}</small>
                </span>
                <Icon name="check" />
              </figcaption>
            </figure>
          ))}
        </div>
        {restaurant.demo && (
          <p
            className={
              "demo-note [font-size:11px] [color:#8f8a7d] [margin-top:18px]"
            }
          >
            *Avaliações e depoimentos ilustrativos, criados para esta
            hamburgueria fictícia.
          </p>
        )}
      </div>
    </section>
  );
}

export function Location() {
  return (
    <section
      className={
        "location-section section-pad [padding:78px_0] max-[900px]:[padding:60px_0] max-[700px]:[padding:48px_0]"
      }
      id="onde-estamos"
    >
      <div
        className={
          "site-container [width:min(1240px,_calc(100%_-_88px))] mx-auto max-[1150px]:[width:calc(100%_-_56px)] max-[700px]:[width:calc(100%_-_40px)] max-[360px]:[width:calc(100%_-_28px)] location-grid grid [grid-template-columns:1fr_1fr] [gap:70px] items-center max-[1150px]:[gap:40px] max-[900px]:[gap:30px] max-[700px]:[grid-template-columns:1fr] max-[700px]:[gap:34px]"
        }
      >
        <div
          className={
            "location-info [&_h2]:[font-size:clamp(36px,_3.7vw,_52px)] [&_>_p:not(.handwritten)]:[margin:22px_0] [&_>_p:not(.handwritten)]:[color:#6e695d] [&_>_p:not(.handwritten)]:[font-size:15px] [&_>_p:not(.handwritten)]:[max-width:430px] max-[700px]:[&_h2]:[font-size:43px] max-[700px]:[&_>_p:not(.handwritten)]:[font-size:14px]"
          }
        >
          <p
            className={
              "handwritten [font-family:var(--hand)] [font-size:29px] [line-height:1.3] [color:var(--yellow-dark)] [margin-bottom:7px] max-[700px]:[font-size:26px]"
            }
          >
            Puxa uma cadeira
          </p>
          <h2>
            O MELHOR CAMINHO
            <br />
            TERMINA EM BURGER.
          </h2>
          <p>
            Uma casa descontraída, brasa acesa e espaço para reunir a turma. Ou
            levar esse momento para casa.
          </p>
          <div
            className={
              "location-details [margin:29px_0] [&_>_div]:flex [&_>_div]:items-start [&_>_div]:[gap:15px] [&_>_div]:[margin:22px_0] [&_>_div_>_svg]:[width:22px] [&_>_div_>_svg]:[color:#a57915] [&_>_div_>_svg]:[margin-top:3px] [&_h3]:[font-size:22px] [&_h3]:[margin-bottom:8px] [&_p]:[font-size:13px] [&_p]:[color:#6e695d] [&_p]:[line-height:1.7] max-[700px]:[&_p]:[font-size:14px]"
            }
          >
            <div>
              <svg>
                <use href="#i-pin" />
              </svg>
              <div>
                <h3>Nosso cantinho</h3>
                <p>
                  {restaurant.location.street} ·{" "}
                  {restaurant.location.neighborhood}
                  <br />
                  {restaurant.location.city}, {restaurant.location.state}{" "}
                  {restaurant.demo && (
                    <span
                      className={
                        "fiction-label block [font-size:10px] [color:#8a8170]"
                      }
                    >
                      Endereço fictício · o mapa abre a cidade de{" "}
                      {restaurant.location.city}
                    </span>
                  )}
                </p>
              </div>
            </div>
            <div>
              <svg>
                <use href="#i-clock" />
              </svg>
              <div>
                <h3>Quando a brasa acende</h3>
                <p>
                  {restaurant.openingHours.map((hours) => (
                    <Fragment key={hours}>
                      {hours}
                      <br />
                    </Fragment>
                  ))}
                  {restaurant.orderingHoursNote}
                </p>
              </div>
            </div>
            <div>
              <svg>
                <use href="#i-truck" />
              </svg>
              <div>
                <h3>A gente chega até você</h3>
                <p>
                  {restaurant.delivery.neighborhoods}
                  <br />
                  {restaurant.delivery.priceRange}
                </p>
              </div>
            </div>
          </div>
          <div id="contato">
            <OrderLink
              className={
                "button inline-flex items-center justify-center gap-3 [min-height:49px] [padding:13px_23px] [border:1px_solid_transparent] rounded-[2px] [font-family:var(--display)] [font-size:18px] font-bold [line-height:1.2] [transition:background_0.18s,_color_0.18s,_transform_0.18s] [&:hover]:[transform:translateY(-2px)] [&_svg]:[width:21px] [&_svg]:[height:21px] button-yellow [background:var(--yellow)] [color:#17130a] [&:hover]:[background:#ffcc33] order-link"
              }
            >
              Pedir pelo WhatsApp{" "}
              <svg>
                <use href="#i-arrow" />
              </svg>
            </OrderLink>
            {restaurant.demo && (
              <p className={"service-note [margin-top:7px] [color:#8a8170]"}>
                Canal ilustrativo · marca fictícia
              </p>
            )}
            <div
              className={
                "location-social flex gap-5 [margin-top:20px] [font-size:13px] [&_a]:[text-decoration:underline] [&_a]:[text-underline-offset:4px]"
              }
            >
              <SocialLink>
                Instagram · {restaurant.contact.instagramLabel}
              </SocialLink>
            </div>
          </div>
        </div>
        <div className={"location-visual [&_.location-map]:[height:300px]"}>
          <Image
            className={
              "location-photo w-full [height:230px] object-cover [border-radius:4px] [margin-bottom:16px] max-[700px]:[height:220px]"
            }
            src={restaurant.location.image}
            alt={restaurant.location.imageAlt}
            width="900"
            height="600"
            loading="lazy"
          />
          <div
            className={
              "location-map relative [height:530px] [background:#e6e1d4] overflow-hidden [border-radius:5px] [border:1px_solid_#d9d0bd] max-[900px]:[height:550px] max-[700px]:[height:370px]"
            }
            aria-label={`Mapa ilustrativo de ${restaurant.name}`}
          >
            <div
              className={
                "map-park absolute [background:#ccd1ad] [border:7px_solid_#d5dab9] [border-radius:24px] park-one [width:150px] [height:130px] [left:8%] [top:14%] [transform:rotate(-26deg)]"
              }
            ></div>
            <div
              className={
                "map-park absolute [background:#ccd1ad] [border:7px_solid_#d5dab9] [border-radius:24px] park-two [width:170px] [height:200px] [right:-30px] [bottom:30px] [transform:rotate(-26deg)]"
              }
            ></div>
            <div
              className={
                "map-street [background:#faf7ee] [border:1px_solid_#cfc9b9] absolute [box-shadow:0_0_0_6px_#e1dccc] street-one [width:150%] [height:38px] [top:48%] [left:-25%] [transform:rotate(-26deg)]"
              }
            ></div>
            <div
              className={
                "map-street [background:#faf7ee] [border:1px_solid_#cfc9b9] absolute [box-shadow:0_0_0_6px_#e1dccc] street-two [height:140%] [width:28px] [top:-20%] [left:39%] [transform:rotate(-26deg)]"
              }
            ></div>
            <div
              className={
                "map-street [background:#faf7ee] [border:1px_solid_#cfc9b9] absolute [box-shadow:0_0_0_6px_#e1dccc] street-three [height:140%] [width:22px] [top:-20%] [right:10%] [transform:rotate(-26deg)]"
              }
            ></div>
            <div
              className={
                "map-street [background:#faf7ee] [border:1px_solid_#cfc9b9] absolute [box-shadow:0_0_0_6px_#e1dccc] street-four [width:150%] [height:23px] [top:18%] [left:-25%] [transform:rotate(-26deg)]"
              }
            ></div>
            <div
              className={
                "map-street [background:#faf7ee] [border:1px_solid_#cfc9b9] absolute [box-shadow:0_0_0_6px_#e1dccc] street-five [width:150%] [height:26px] [bottom:13%] [left:-25%] [transform:rotate(-26deg)]"
              }
            ></div>
            <span
              className={
                "map-label absolute [color:#9b9587] [font-size:10px] [letter-spacing:1px] [z-index:1] map-label-one [top:48%] [left:4%] [transform:rotate(-26deg)]"
              }
            >
              {restaurant.location.mapRoad}
            </span>
            <span
              className={
                "map-label absolute [color:#9b9587] [font-size:10px] [letter-spacing:1px] [z-index:1] map-label-two [bottom:17%] [left:36%] [transform:rotate(64deg)]"
              }
            >
              {restaurant.location.mapAvenue}
            </span>
            <span
              className={
                "map-neighborhood absolute [top:13%] [right:13%] [font-size:13px] [color:#8c887d] [letter-spacing:3px]"
              }
            >
              {restaurant.location.neighborhood.toLocaleUpperCase("pt-BR")}
            </span>
            <div
              className={
                "map-pin absolute [top:40%] [left:48%] [width:71px] [height:71px] [background:var(--yellow)] [border-radius:50%_50%_50%_0] [transform:translate(-50%,_-50%)_rotate(-45deg)] grid place-items-center [box-shadow:0_7px_25px_#493d173b] [z-index:3] [&_svg]:[width:43px] [&_svg]:[height:43px] [&_svg]:[transform:rotate(45deg)] [&_svg]:[stroke-width:2]"
              }
            >
              <svg>
                <use href="#i-burger" />
              </svg>
            </div>
            <div
              className={
                "map-place absolute [top:52%] [left:50%] [transform:translateX(-50%)] [background:var(--ink)] [color:#fff] [padding:14px_22px] text-center whitespace-nowrap [box-shadow:0_6px_22px_#35270722] rounded-[3px] [z-index:4] [&_strong]:[font:700_24px_var(--display)] [&_span]:block [&_span]:[font-size:11px] [&_span]:[color:#c2bda9]"
              }
            >
              <strong>{restaurant.name.toLocaleUpperCase("pt-BR")}</strong>
              <span>Seu próximo lugar favorito.</span>
            </div>
            <a
              className={
                "map-link absolute [bottom:35px] [left:50%] [transform:translateX(-50%)] [z-index:5] whitespace-nowrap button inline-flex items-center justify-center gap-3 [min-height:49px] [padding:13px_23px] [border:1px_solid_transparent] rounded-[2px] [font-family:var(--display)] [font-size:18px] font-bold [line-height:1.2] [transition:background_0.18s,_color_0.18s,_transform_0.18s] [&:hover]:[transform:translateY(-2px)] [&_svg]:[width:21px] [&_svg]:[height:21px] button-dark [background:var(--ink)] [color:white] [&:hover]:[background:#302b20]"
              }
              href={restaurant.contact.maps}
              target="_blank"
              rel="noopener noreferrer"
            >
              Ver {restaurant.location.city} no mapa{" "}
              <svg>
                <use href="#i-pin" />
              </svg>
            </a>
            <span
              className={
                "map-caption absolute [bottom:12px] [right:12px] [font-size:10px] [background:#fff8] [padding:3px_8px] [color:#7e776a]"
              }
            >
              Localização ilustrativa
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

export function Faq() {
  return (
    <section
      className={
        "faq-section [background:#eeeadf] [border-top:1px_solid_#e1dbcf] section-pad [padding:78px_0] max-[900px]:[padding:60px_0] max-[700px]:[padding:48px_0]"
      }
      id="duvidas"
    >
      <div
        className={
          "site-container [width:min(1240px,_calc(100%_-_88px))] mx-auto max-[1150px]:[width:calc(100%_-_56px)] max-[700px]:[width:calc(100%_-_40px)] max-[360px]:[width:calc(100%_-_28px)] faq-layout grid [grid-template-columns:0.8fr_1.2fr] [gap:80px] [&_>_div_>_p:not(.handwritten)]:[margin-top:20px] [&_>_div_>_p:not(.handwritten)]:[color:#7c7365] [&_>_div_>_p:not(.handwritten)]:[font-size:15px] max-[900px]:[gap:35px] max-[900px]:[grid-template-columns:0.8fr_1.2fr] max-[700px]:[grid-template-columns:1fr] max-[700px]:[gap:28px] max-[700px]:[&_>_div_>_p:not(.handwritten)]:hidden max-[700px]:[&_h2]:[font-size:43px] max-[700px]:[&_h2_br]:hidden"
        }
      >
        <div>
          <p
            className={
              "handwritten [font-family:var(--hand)] [font-size:29px] [line-height:1.3] [color:var(--yellow-dark)] [margin-bottom:7px] max-[700px]:[font-size:26px]"
            }
          >
            Antes da primeira mordida
          </p>
          <h2>
            FICOU COM
            <br />
            ALGUMA DÚVIDA?
          </h2>
          <p>
            A fome a gente resolve.
            <br />
            As dúvidas também.
          </p>
        </div>
        <div
          className={
            "faq-list [&_details]:[border-bottom:1px_solid_#d0c8b7] [&_details:first-child]:[border-top:1px_solid_#d0c8b7] [&_summary]:[list-style:none] [&_summary]:flex [&_summary]:justify-between [&_summary]:items-center [&_summary]:gap-5 [&_summary]:[padding:20px_0] [&_summary]:[font-size:15px] [&_summary]:font-semibold [&_summary]:[cursor:pointer] [&_summary::-webkit-details-marker]:hidden [&_summary_span]:[font-size:24px] [&_summary_span]:[line-height:1] [&_summary_span]:[font-weight:400] [&_details[open]_summary_span]:[transform:rotate(45deg)] [&_details_p]:[padding:0_32px_20px_0] [&_details_p]:[color:#6f685b] [&_details_p]:[font-size:14px] [&_details_p]:[line-height:1.7] max-[700px]:[&_summary]:[font-size:14px] max-[700px]:[&_summary]:[padding:19px_0] max-[700px]:[&_details_p]:[font-size:13px]"
          }
        >
          {restaurant.faq
            .filter((item) => !item.demoOnly || restaurant.demo)
            .map((item) => (
              <details key={item.question}>
                <summary>
                  {item.question}
                  <span>+</span>
                </summary>
                <p>{item.answer}</p>
              </details>
            ))}
        </div>
      </div>
    </section>
  );
}

export function FinalCallToAction() {
  return (
    <section
      className={
        "final-cta [padding:36px_0] [background:var(--yellow)] [&_>_.site-container]:flex [&_>_.site-container]:items-center [&_>_.site-container]:justify-between [&_>_.site-container]:[gap:20px] [&_.handwritten]:[color:#765209] [&_.handwritten]:[font-size:27px] [&_.handwritten]:[margin-bottom:2px] [&_h2]:[font-size:clamp(30px,_3.8vw,_49px)] [&_.button]:[min-width:210px] max-[700px]:[padding:31px_0] max-[700px]:[&_>_.site-container]:items-start max-[700px]:[&_>_.site-container]:flex-col max-[700px]:[&_>_.site-container]:[gap:22px] max-[700px]:[&_h2]:[font-size:39px] max-[700px]:[&_.button]:[min-width:0] max-[700px]:[&_.button]:w-full"
      }
    >
      <div
        className={
          "site-container [width:min(1240px,_calc(100%_-_88px))] mx-auto max-[1150px]:[width:calc(100%_-_56px)] max-[700px]:[width:calc(100%_-_40px)] max-[360px]:[width:calc(100%_-_28px)]"
        }
      >
        <div>
          <p
            className={
              "handwritten [font-family:var(--hand)] [font-size:29px] [line-height:1.3] [color:var(--yellow-dark)] [margin-bottom:7px] max-[700px]:[font-size:26px]"
            }
          >
            A brasa já está acesa.
          </p>
          <h2>SÓ FALTA VOCÊ ESCOLHER.</h2>
        </div>
        <a
          className={
            "button inline-flex items-center justify-center gap-3 [min-height:49px] [padding:13px_23px] [border:1px_solid_transparent] rounded-[2px] [font-family:var(--display)] [font-size:18px] font-bold [line-height:1.2] [transition:background_0.18s,_color_0.18s,_transform_0.18s] [&:hover]:[transform:translateY(-2px)] [&_svg]:[width:21px] [&_svg]:[height:21px] button-dark [background:var(--ink)] [color:white] [&:hover]:[background:#302b20]"
          }
          href="#cardapio"
        >
          Bora de Brasa{" "}
          <svg>
            <use href="#i-burger" />
          </svg>
        </a>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className={"footer [background:#111110] [color:#ccc8bd]"}>
      <div
        className={
          "site-container [width:min(1240px,_calc(100%_-_88px))] mx-auto max-[1150px]:[width:calc(100%_-_56px)] max-[700px]:[width:calc(100%_-_40px)] max-[360px]:[width:calc(100%_-_28px)] footer-main grid [grid-template-columns:1.1fr_1fr_1.25fr_1.15fr] [gap:30px] [padding-top:46px] [padding-bottom:38px] [&_>_.brand]:[align-self:start] [&_>_.brand]:[color:#fff] [&_h3]:[color:var(--yellow)] [&_h3]:[font-size:21px] [&_h3]:[margin-bottom:14px] [&_>_div_>_a:not(.button)]:block [&_>_div_>_p]:block [&_>_div_>_a:not(.button)]:[font-size:12px] [&_>_div_>_p]:[font-size:12px] [&_>_div_>_a:not(.button)]:[line-height:1.8] [&_>_div_>_p]:[line-height:1.8] [&_>_div_>_a:not(.button)]:[margin:5px_0] [&_>_div_>_p]:[margin:5px_0] [&_>_div_>_a:not(.button):hover]:[color:var(--yellow)] max-[1150px]:[gap:24px] max-[900px]:[grid-template-columns:1fr_1fr] max-[900px]:[gap:36px] max-[700px]:[grid-template-columns:1fr_1fr] max-[700px]:[gap:32px_20px] max-[700px]:[padding-top:36px] max-[700px]:[&_>_.brand]:[grid-column:1/-1] max-[700px]:[&_>_div:nth-child(2)]:[order:2] max-[700px]:[&_>_div:nth-child(3)]:[order:3]"
        }
      >
        <a
          className={
            "brand flex items-center gap-3 [flex-shrink:0] [&_>_span]:[font:800_29px/0.85_var(--display)] [&_>_span]:[letter-spacing:0.25px] [&_small]:block [&_small]:[font:500_11px_var(--body)] [&_small]:[letter-spacing:1.2px] [&_small]:[color:var(--yellow)] [&_small]:[margin-top:9px] max-[1150px]:[&_>_span]:[font-size:26px] max-[900px]:[&_>_span]:[font-size:24px] max-[700px]:[&_>_span]:[font-size:24px] max-[700px]:[&_small]:[font-size:8px] max-[700px]:[&_small]:[margin-top:7px]"
          }
          href="#inicio"
        >
          <svg
            className={
              "brand-icon [width:53px] [height:63px] [color:var(--yellow)] [stroke-width:2.7] max-[1150px]:[width:45px] max-[900px]:[width:40px] max-[700px]:[width:37px] max-[700px]:[height:47px]"
            }
          >
            <use href="#i-burger" />
          </svg>
          <span>
            {restaurant.brandLines[0]}
            <br />
            {restaurant.brandLines[1]}
            <small>{restaurant.tagline}</small>
          </span>
        </a>
        <div>
          <h3>Explore a casa</h3>
          <a href="#cardapio">Cardápio</a>
          <a href="#nossa-historia">Nossa história</a>
          <a href="#onde-estamos">Onde estamos</a>
        </div>
        <div>
          <h3>Acenda a fome</h3>
          <p>Delivery, retirada e salão.</p>
          <p>Terça a domingo, a partir das 18h.</p>
          <a href="#duvidas">Dúvidas frequentes</a>
        </div>
        <div
          className={
            "footer-order [&_>_p]:[font-family:var(--hand)] [&_.button]:[font-size:15px] [&_.button]:[padding:10px_14px] [&_.button]:[min-height:42px] [&_.button]:w-full max-[700px]:[grid-column:1/-1] max-[700px]:[order:4] max-[700px]:[border-top:1px_solid_#ffffff20] max-[700px]:[padding-top:25px] max-[700px]:flex max-[700px]:items-center max-[700px]:[gap:18px] max-[700px]:[&_>_p]:[flex:1] max-[700px]:[&_.button]:[width:auto] max-[700px]:[&_.button]:[font-size:14px] max-[700px]:[&_.button_svg]:hidden"
          }
        >
          <p>
            Da primeira mordida
            <br />
            ao último guardanapo.
          </p>
          <a
            className={
              "button inline-flex items-center justify-center gap-3 [min-height:49px] [padding:13px_23px] [border:1px_solid_transparent] rounded-[2px] [font-family:var(--display)] [font-size:18px] font-bold [line-height:1.2] [transition:background_0.18s,_color_0.18s,_transform_0.18s] [&:hover]:[transform:translateY(-2px)] [&_svg]:[width:21px] [&_svg]:[height:21px] button-outline [border-color:#ba901f] [color:var(--paper)] [background:transparent] [&:hover]:[background:#f5bb1614]"
            }
            href="#cardapio"
          >
            Escolher meu burger{" "}
            <svg>
              <use href="#i-arrow" />
            </svg>
          </a>
        </div>
      </div>
      <div
        className={
          "site-container [width:min(1240px,_calc(100%_-_88px))] mx-auto max-[1150px]:[width:calc(100%_-_56px)] max-[700px]:[width:calc(100%_-_40px)] max-[360px]:[width:calc(100%_-_28px)] footer-bottom [padding:17px_0] [border-top:1px_solid_#ffffff17] flex items-center justify-between gap-5 [font-size:10px] [color:#8e8879] [&_a:hover]:[color:white] max-[700px]:[padding:18px_0_25px] max-[700px]:[gap:6px] max-[700px]:items-start max-[700px]:flex-wrap max-[700px]:[&_>_span:nth-child(2)]:[order:3] max-[700px]:[&_>_span:nth-child(2)]:w-full max-[700px]:[&_>_a]:[margin-left:auto]"
        }
      >
        <span>© 2026 {restaurant.name}.</span>
        {restaurant.demo && (
          <span>
            Projeto demonstrativo. Dados fictícios e imagens geradas por IA.
          </span>
        )}
        <a href="#inicio">Voltar ao topo ↑</a>
      </div>
    </footer>
  );
}
