"use client";

import type { ComponentProps } from "react";
import { formatPrice, getWhatsAppUrl } from "../lib/format";
import type { Product } from "../types/restaurant";
import { useInteractions } from "./interaction-provider";
import { useHamburgueriaDocument } from "./document-provider";

type LinkProps = Omit<ComponentProps<"a">, "href" | "onClick">;

export function OrderLink({
  product,
  children,
  ...props
}: LinkProps & { product?: Product }) {
  const { showDemo } = useInteractions();
  const { business, contact, demo } = useHamburgueriaDocument();
  const message = product
    ? `Olá, ${business.name}! Gostaria de pedir ${product.name} (${formatPrice(product.price)}).`
    : `Olá, ${business.name}! Gostaria de fazer um pedido.`;
  const href = demo.enabled
    ? null
    : getWhatsAppUrl(contact.whatsapp ?? "", message);
  return (
    <a
      {...props}
      href={href ?? "#contact-dialog"}
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
  const { contact, demo } = useHamburgueriaDocument();
  const href = demo.enabled ? "" : contact.instagramUrl;
  return (
    <a
      {...props}
      href={href || "#contact-dialog"}
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
  const { sections } = useHamburgueriaDocument();
  if (!sections.menu) return null;
  return (
    <a {...props} href="#cardapio" onClick={() => setCategory("combos")}>
      {children}
    </a>
  );
}
