"use client";

import type { ComponentProps } from "react";
import { formatCopy, formatPriceCents, getWhatsAppUrl } from "../lib/format";
import type { HamburgueriaPrototypeDocument } from "../schema/hamburgueria.schema";
import { useInteractions } from "./interaction-provider";
import { useHamburgueriaDocument } from "./document-provider";

type LinkProps = Omit<ComponentProps<"a">, "href" | "onClick">;

export function OrderLink({
  product,
  children,
  ...props
}: LinkProps & {
  product?: HamburgueriaPrototypeDocument["content"]["menu"]["products"][number];
}) {
  const { showDemo } = useInteractions();
  const { business, contact, demo, content, locale, currency } =
    useHamburgueriaDocument();
  const message = formatCopy(
    product
      ? content.interactions.productOrderMessage
      : content.interactions.orderMessage,
    {
      businessName: business.name,
      productName: product?.name ?? "",
      price: product
        ? formatPriceCents(product.priceCents, locale, currency)
        : "",
    },
  );
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
  if (!demo.enabled && !href) return null;
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
  const { sections, content } = useHamburgueriaDocument();
  if (!sections.menu) return null;
  const target =
    content.menu.categories.find(
      (item) => item.id === content.story.featured.targetCategoryId,
    )?.id ??
    content.menu.categories.find(
      (item) => item.id === content.menu.defaultCategoryId,
    )?.id ??
    content.menu.categories[0]?.id;
  if (!target) return null;
  return (
    <a {...props} href="#cardapio" onClick={() => setCategory(target)}>
      {children}
    </a>
  );
}
