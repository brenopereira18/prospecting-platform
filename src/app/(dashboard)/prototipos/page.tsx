import Link from "next/link";
import { Layers, Users } from "lucide-react";
import { requirePrototypeUser } from "@/src/app/prototipos/_data";
import { prototypeService } from "@/src/server/prototypes/prototype.service";
import { PrototypeList } from "@/src/components/prototypes/prototype-list";

export const dynamic = "force-dynamic";

export default async function PrototypesPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requirePrototypeUser();
  const [prototypes, query] = await Promise.all([
    prototypeService.list(user.id),
    searchParams ??
      Promise.resolve({} as Record<string, string | string[] | undefined>),
  ]);
  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <header className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Protótipos</h1>
          <p className="mt-1 text-sm text-secundary">
            Gerencie seus rascunhos e acompanhe as versões de cada proposta.
          </p>
        </div>
        <Link
          href="/leads"
          className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 self-start rounded-lg bg-primary px-4 text-sm font-medium text-background transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <Users size={16} aria-hidden="true" />
          Gerar a partir de um lead
        </Link>
      </header>
      {prototypes.length ? (
        <PrototypeList
          prototypes={prototypes}
          selectedPrototypeId={
            typeof query.prototype === "string" ? query.prototype : undefined
          }
        />
      ) : (
        <div className="rounded-xl border border-sidebar-hover bg-card px-6 py-12 text-center">
          <Layers
            size={28}
            className="mx-auto mb-4 text-primary"
            aria-hidden="true"
          />
          <h2 className="font-semibold">Nenhum protótipo criado</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-secundary">
            Abra um lead e use “Gerar protótipo” para começar uma proposta
            personalizada.
          </p>
        </div>
      )}
    </div>
  );
}
