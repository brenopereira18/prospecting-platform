import { HamburgueriaEditor } from "@/src/components/prototypes/editor/hamburgueria/hamburgueria-editor";
import { loadPrototype } from "../_data";

export default async function PrototypeEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { prototype } = await loadPrototype(id);
  return <HamburgueriaEditor key={id} initialPrototype={prototype} />;
}
