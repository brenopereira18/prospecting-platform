"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { HamburgueriaPrototypeDocument } from "../schema/hamburgueria.schema";

const HamburgueriaDocumentContext = createContext<HamburgueriaPrototypeDocument | null>(null);

export function HamburgueriaDocumentProvider({
  document,
  children,
}: {
  document: HamburgueriaPrototypeDocument;
  children: ReactNode;
}) {
  return (
    <HamburgueriaDocumentContext.Provider value={document}>
      {children}
    </HamburgueriaDocumentContext.Provider>
  );
}

export function useHamburgueriaDocument() {
  const document = useContext(HamburgueriaDocumentContext);
  if (!document) {
    throw new Error("Use HamburgueriaDocumentProvider para acessar o documento da hamburgueria.");
  }
  return document;
}
