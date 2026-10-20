import Link from "next/link";
import { loadPrototype } from "../../_data";
import { prototypeService } from "@/src/server/prototypes/prototype.service";

export default async function PrototypeVersionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { prototype, user } = await loadPrototype(id);
  const versions = await prototypeService.listVersions(id, user.id);
  return <main className="mx-auto max-w-3xl space-y-6 p-6 sm:p-10"><Link href={`/prototipos/${id}`} className="text-sm underline">Voltar ao editor</Link>
    <h1 className="text-2xl font-semibold">Versões · {prototype.name}</h1><p className="text-sm text-secundary">Versões são cópias imutáveis do rascunho salvo. Visualizá-las não altera o rascunho atual.</p>
    {!versions.length && <p className="text-secundary">Nenhuma versão criada. Salve o rascunho e use Criar versão no editor.</p>}
    <ul className="space-y-3">{versions.map(version => <li key={version.id} className="rounded-xl border border-sidebar-hover bg-card p-4"><Link href={`/prototipos/${id}/versoes/${version.id}`} className="underline">Versão {version.number}</Link><p className="mt-2 text-xs text-secundary">{new Date(version.createdAt).toLocaleString("pt-BR")}</p></li>)}</ul>
  </main>;
}
