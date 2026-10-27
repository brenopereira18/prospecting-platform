import type { CSSProperties, ReactNode } from "react";
import { Barlow, Barlow_Condensed } from "next/font/google";
import localFont from "next/font/local";
import "./hamburgueria.css";
import type { HamburgueriaPrototypeDocument } from "./schema/hamburgueria.schema";
import { HamburgueriaDocumentProvider } from "./components/document-provider";
import type { ResolvedUploadImages } from "./lib/images";
import { getHamburgueriaColorStyles } from "./lib/colors";

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

// Google may return Caveat URLs containing query parameters that fail in
// Turbopack's Google-font resolver. Keep the original font bundled locally.
const handFont = localFont({
  src: "./fonts/Caveat-Variable.ttf",
  weight: "400 700",
  style: "normal",
  display: "swap",
  variable: "--font-hamburgueria-hand",
});

interface HamburgueriaTemplateProps {
  children: ReactNode;
  document: HamburgueriaPrototypeDocument;
  uploads?: ResolvedUploadImages;
}

export function HamburgueriaTemplate({
  children,
  document,
  uploads,
}: HamburgueriaTemplateProps) {
  const { colors, fonts } = document.appearance;
  const fontFamilies = {
    barlow: "var(--font-hamburgueria-body), Arial, sans-serif",
    "barlow-condensed":
      'var(--font-hamburgueria-display), Impact, "Arial Narrow", sans-serif',
    caveat: "var(--font-hamburgueria-hand), cursive",
  };
  const style = {
    ...getHamburgueriaColorStyles(colors),
    "--body": fontFamilies[fonts.body],
    "--display": fontFamilies[fonts.display],
    "--hand": fontFamilies[fonts.hand],
  } as CSSProperties;

  return (
    <div
      className={`hamburgueria-template ${bodyFont.variable} ${displayFont.variable} ${handFont.variable}`}
      style={style}
    >
      <HamburgueriaDocumentProvider document={document} uploads={uploads}>
        {children}
      </HamburgueriaDocumentProvider>
    </div>
  );
}
