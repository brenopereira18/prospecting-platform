"use client";

import type { ComponentProps } from "react";
import { restaurant } from "../data/restaurant";
import { formatPrice, getWhatsAppUrl } from "../lib/format";
import type { Product } from "../types/restaurant";
import { useInteractions } from "./interaction-provider";

type LinkProps = Omit<ComponentProps<"a">, "href" | "onClick">;

export function OrderLink({
  product,
  children,
  ...props
}: LinkProps & { product?: Product }) {
  const { showDemo } = useInteractions();
  const message = product
    ? `Olá, ${restaurant.name}! Gostaria de pedir ${product.name} (${formatPrice(product.price)}).`
    : `Olá, ${restaurant.name}! Gostaria de fazer um pedido.`;
  const href = restaurant.demo
    ? null
    : getWhatsAppUrl(restaurant.contact.whatsapp, message);
  return (
    <a
      {...props}
      href={href ?? "#contato"}
      target={href ? "_blank" : undefined}
      rel={href ? "noopener noreferrer" : undefined}
      onClick={(event) => {
        if (!href) {
          event.preventDefault();
          showDemo("order");
        }
      }}
    >
      {children}
    </a>
  );
}

export function SocialLink({ children, ...props }: LinkProps) {
  const { showDemo } = useInteractions();
  const href = restaurant.demo ? "" : restaurant.contact.instagram;
  return (
    <a
      {...props}
      href={href || "#contato"}
      target={href ? "_blank" : undefined}
      rel={href ? "noopener noreferrer" : undefined}
      onClick={(event) => {
        if (!href) {
          event.preventDefault();
          showDemo("social");
        }
      }}
    >
      {children}
    </a>
  );
}

export function ComboLink({ children, ...props }: LinkProps) {
  const { setCategory } = useInteractions();
  return (
    <a {...props} href="#cardapio" onClick={() => setCategory("combos")}>
      {children}
    </a>
  );
}
