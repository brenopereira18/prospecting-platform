import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HamburgueriaEditor } from "../../../components/prototypes/editor/hamburgueria/hamburgueria-editor";

export const metadata: Metadata = {
  title: "Editor de hamburgueria · Prospecta",
  robots: { index: false, follow: false },
};

export default function HamburgueriaEditorPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <HamburgueriaEditor />;
}
