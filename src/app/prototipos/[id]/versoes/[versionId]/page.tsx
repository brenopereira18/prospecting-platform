import Link from "next/link";
import { prototypeAssetService } from "@/src/server/prototype-assets/assets";
import { notFound } from "next/navigation";
import { z } from "zod";
import { loadPrototype } from "../../../_data";
import { prototypeService, PrototypeError } from "@/src/server/prototypes/prototype.service";
import { HamburgueriaRenderer } from "@/src/components/prototypes/templates/hamburgueria/hamburgueria-renderer";

export default async function PrototypeVersionPage({ params }: { params: Promise<{ id: string; versionId: string }> }) {
  const { id, versionId } = await params;
  if (!z.uuid().safeParse(versionId).success) notFound();
  const { user } = await loadPrototype(id);
  const version = await prototypeService.findVersion(id, versionId, user.id).catch(cause => {
    if (cause instanceof PrototypeError && cause.code === "NOT_FOUND") notFound();
    throw cause;
  });
  const uploads = await prototypeAssetService.resolveDocumentImages(version.document, id, user.id);
  return <><header className="flex flex-wrap items-center gap-5 border-b border-sidebar-hover bg-card p-4 text-sm"><Link href={`/prototipos/${id}/versoes`} className="underline">Voltar às versões</Link><strong>Versão {version.number} · Somente leitura</strong><Link href={`/prototipos/${id}`} className="underline">Abrir rascunho atual</Link></header><HamburgueriaRenderer document={version.document} resolveUpload={assetId => uploads[assetId]} /></>;
}
