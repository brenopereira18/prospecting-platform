import Link from "next/link";
import { prototypeAssetService } from "@/src/server/prototype-assets/assets";
import { loadPrototype } from "../../_data";
import { HamburgueriaRenderer } from "@/src/components/prototypes/templates/hamburgueria/hamburgueria-renderer";

export default async function PrototypePreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { prototype, user } = await loadPrototype(id);
  const uploads = await prototypeAssetService.resolveDocumentImages(prototype.draftDocument, id, user.id);
  return <>
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-sidebar-hover bg-card p-4 text-sm">
      <span>Prévia privada · {prototype.name} · Rascunho salvo</span>
      <Link href={`/prototipos/${id}`} className="text-primary underline">Voltar ao editor</Link>
    </header>
    <HamburgueriaRenderer document={prototype.draftDocument} resolveUpload={assetId => uploads[assetId]} />
  </>;
}
