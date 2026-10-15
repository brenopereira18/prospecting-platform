import type { CSSProperties, ReactNode } from "react";
import { Barlow, Barlow_Condensed, Caveat } from "next/font/google";
import "./hamburgueria.css";
import type { HamburgueriaPrototypeDocument } from "./schema/hamburgueria.schema";
import { HamburgueriaDocumentProvider } from "./components/document-provider";

const bodyFont = Barlow({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-hamburgueria-body",
});

const displayFont = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["600", "700", "800", "900"],
  display: "swap",
  variable: "--font-hamburgueria-display",
});

const handFont = Caveat({
  subsets: ["latin"],
  weight: ["600", "700"],
  display: "swap",
  variable: "--font-hamburgueria-hand",
});

interface HamburgueriaTemplateProps {
  children: ReactNode;
  document: HamburgueriaPrototypeDocument;
}

export function HamburgueriaTemplate({
  children,
  document,
}: HamburgueriaTemplateProps) {
  const { colors, fonts } = document.appearance;
  const fontFamilies = {
    barlow: "var(--font-hamburgueria-body), Arial, sans-serif",
    "barlow-condensed": 'var(--font-hamburgueria-display), Impact, "Arial Narrow", sans-serif',
    caveat: "var(--font-hamburgueria-hand), cursive",
  };
  const style = {
    "--template-primary": colors.primary,
    "--template-secondary": colors.secondary,
    "--template-tertiary": colors.tertiary,
    "--body": fontFamilies[fonts.body],
    "--display": fontFamilies[fonts.display],
    "--hand": fontFamilies[fonts.hand],
  } as CSSProperties;

  return (
    <div
      className={`hamburgueria-template ${bodyFont.variable} ${displayFont.variable} ${handFont.variable}`}
      style={style}
    >
      <HamburgueriaDocumentProvider document={document}>
        {children}
      </HamburgueriaDocumentProvider>
    </div>
  );
}
