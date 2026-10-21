"use client";

import type { ComponentProps } from "react";
import { formatCopy, formatPriceCents, getWhatsAppUrl } from "../lib/format";
import type { HamburgueriaPrototypeDocument } from "../schema/hamburgueria.schema";
import { useInteractions } from "./interaction-provider";
import { useHamburgueriaDocument } from "./document-provider";
import { publicWebUrl } from "../lib/presentation";

type LinkProps = Omit<ComponentProps<"a">, "href" | "onClick">;

export function OrderLink({
  product,
  children,
  ...props
}: LinkProps & {
  product?: HamburgueriaPrototypeDocument["content"]["menu"]["products"][number];
}) {
  const { business, contact, content, locale, currency } =
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
  const href = getWhatsAppUrl(contact.whatsapp ?? "", message);
  return (
    <a
      {...props}
      href={href ?? undefined}
      role={href ? props.role : "link"}
      aria-disabled={href ? undefined : true}
      tabIndex={href ? props.tabIndex : -1}
      title={href ? props.title : "Pedidos indisponíveis no momento."}
      className={`${props.className ?? ""}${href ? "" : " cursor-not-allowed opacity-50"}`}
      target={href ? "_blank" : undefined}
      rel={href ? "noopener noreferrer" : undefined}
    >
      {children}
    </a>
  );
}

export function SocialLink({ children, ...props }: LinkProps) {
  const { contact } = useHamburgueriaDocument();
  const href = publicWebUrl(contact.instagramUrl);
  if (!href) return null;
  return (
    <a {...props} href={href} target="_blank" rel="noopener noreferrer">
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
