import Link from "next/link";
import { loadPrototype } from "../../_data";
import { HamburgueriaRenderer } from "@/src/components/prototypes/templates/hamburgueria/hamburgueria-renderer";

export default async function PrototypePreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { prototype } = await loadPrototype(id);
  return <>
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-sidebar-hover bg-card p-4 text-sm">
      <span>Prévia privada · {prototype.name} · Rascunho salvo</span>
      <Link href={`/prototipos/${id}`} className="text-primary underline">Voltar ao editor</Link>
    </header>
    <HamburgueriaRenderer document={prototype.draftDocument} />
  </>;
}
