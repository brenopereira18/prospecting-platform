import type { CSSProperties, ReactNode } from "react";
import { Barlow, Barlow_Condensed, Caveat } from "next/font/google";
import "./hamburgueria.css";

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
  primaryColor?: string;
  secondaryColor?: string;
  tertiaryColor?: string;
}

export function HamburgueriaTemplate({
  children,
  primaryColor = "#f5bb16",
  secondaryColor = "#141413",
  tertiaryColor = "#f6f3ec",
}: HamburgueriaTemplateProps) {
  const style = {
    "--template-primary": primaryColor,
    "--template-secondary": secondaryColor,
    "--template-tertiary": tertiaryColor,
  } as CSSProperties;

  return (
    <div
      className={`hamburgueria-template ${bodyFont.variable} ${displayFont.variable} ${handFont.variable}`}
      style={style}
    >
      {children}
    </div>
  );
}
