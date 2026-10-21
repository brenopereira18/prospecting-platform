import { HamburgueriaEditor } from "@/src/components/prototypes/editor/hamburgueria/hamburgueria-editor";
import { loadPrototype } from "../_data";
import { prototypeAssetService } from "@/src/server/prototype-assets/assets";

export default async function PrototypeEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { prototype, user } = await loadPrototype(id);
  const uploads = await prototypeAssetService.resolveDocumentImages(prototype.draftDocument, id, user.id);
  return <HamburgueriaEditor key={id} initialPrototype={prototype} initialUploads={uploads} />;
}
