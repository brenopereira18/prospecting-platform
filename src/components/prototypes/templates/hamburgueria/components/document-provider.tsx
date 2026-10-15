"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { HamburgueriaPrototypeDocument } from "../schema/hamburgueria.schema";
import type { ResolvedUploadImages } from "../lib/images";

const HamburgueriaDocumentContext = createContext<{
  document: HamburgueriaPrototypeDocument;
  uploads: ResolvedUploadImages;
} | null>(null);

export function HamburgueriaDocumentProvider({
  document,
  children,
  uploads = {},
}: {
  document: HamburgueriaPrototypeDocument;
  children: ReactNode;
  uploads?: ResolvedUploadImages;
}) {
  return (
    <HamburgueriaDocumentContext.Provider value={{ document, uploads }}>
      {children}
    </HamburgueriaDocumentContext.Provider>
  );
}

export function useHamburgueriaDocument() {
  return useHamburgueriaContext().document;
}

function useHamburgueriaContext() {
  const context = useContext(HamburgueriaDocumentContext);
  if (!context) {
    throw new Error(
      "Use HamburgueriaDocumentProvider para acessar o documento da hamburgueria.",
    );
  }
  return context;
}

export function useHamburgueriaUploads() {
  return useHamburgueriaContext().uploads;
}
