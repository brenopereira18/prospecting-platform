"use client";

import type { ComponentProps } from "react";
import { getAnchorSection } from "../lib/navigation";
import { useHamburgueriaDocument } from "./document-provider";

export function SectionLink({
  href,
  fallbackHref,
  ...props
}: ComponentProps<"a"> & { href: string; fallbackHref?: string }) {
  const { sections } = useHamburgueriaDocument();
  const section = getAnchorSection(href);
  if (section && !sections[section]) {
    return fallbackHref ? <a {...props} href={fallbackHref} /> : null;
  }
  return <a {...props} href={href} />;
}
