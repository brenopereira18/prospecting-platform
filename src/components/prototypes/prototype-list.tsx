import Link from "next/link";
import { ArrowUpRight, Eye, History, Pencil } from "lucide-react";
import type { PrototypeSummaryDTO } from "../../server/prototypes/prototype.dto";
import { DeletePrototypeButton } from "./delete-prototype-button";
import { prototypeHistoryHref } from "./prototype-navigation";
import { PrototypeVersionHistory } from "./prototype-version-history";
import { PrototypeThumbnail } from "./prototype-thumbnail";

const action =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";
const versionDate = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});

export function PrototypeList({
  prototypes,
  selectedPrototypeId,
}: {
  prototypes: PrototypeSummaryDTO[];
  selectedPrototypeId?: string;
}) {
  return (
    <ul
      aria-label="Protótipos salvos"
      className="grid items-stretch gap-4 md:grid-cols-2 xl:grid-cols-3"
    >
      {prototypes.map((prototype) => {
        const title =
          prototype.leadName?.trim() ||
          prototype.businessName?.trim() ||
          prototype.name;
        const category =
          prototype.categoryName ||
          (prototype.templateId === "brasa-burger" ? "Hamburgueria" : null);
        const latest = prototype.latestVersion;
        return (
          <li
            key={prototype.id}
            id={`prototipo-${prototype.id}`}
            className={`h-full min-w-0 scroll-mt-6 overflow-hidden rounded-xl border bg-card motion-safe:transition-[border-color,box-shadow] motion-safe:duration-200 hover:border-primary/40 hover:shadow-md ${selectedPrototypeId === prototype.id ? "border-primary/60 ring-1 ring-primary/20" : "border-sidebar-hover"}`}
          >
            <article className="flex h-full flex-col">
              <PrototypeThumbnail
                key={latest?.id ?? prototype.id}
                prototypeId={prototype.id}
                version={latest}
              />
              <div className="flex flex-1 flex-col p-5">
                <h2
                  title={title}
                  className="line-clamp-2 min-h-14 break-words text-lg font-semibold leading-7 tracking-tight"
                >
                  <Link
                    href={`/prototipos/${prototype.id}`}
                    className="rounded-sm hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
                  >
                    {title}
                  </Link>
                </h2>
                <p
                  className="mt-2 line-clamp-1 text-sm text-secundary"
                  title={category ?? undefined}
                >
                  {category && <>{category} · </>}
                  {latest ? `Versão ${latest.number}` : "Nenhuma versão criada"}
                </p>
                <div className="mt-1 min-h-4">
                  {latest && (
                    <time
                      dateTime={latest.createdAt}
                      className="block text-xs text-secundary"
                    >
                      {versionDate
                        .format(new Date(latest.createdAt))
                        .replace(", ", " às ")}
                    </time>
                  )}
                </div>
                {!prototype.leadId && (
                  <div className="mt-4">
                    <PrototypeVersionHistory
                      key={`${prototype.id}:${prototype.updatedAt}`}
                      prototype={prototype}
                      initiallyExpanded={selectedPrototypeId === prototype.id}
                    />
                  </div>
                )}
                <div className="mt-auto flex flex-wrap gap-2 pt-5">
                  <Link
                    href={`/prototipos/${prototype.id}`}
                    className={`${action} bg-primary text-background hover:bg-primary/90`}
                  >
                    <Pencil size={14} aria-hidden="true" />
                    Editar rascunho
                  </Link>
                  <Link
                    href={`/prototipos/${prototype.id}/previa`}
                    className={`${action} border border-sidebar-hover hover:bg-sidebar-hover`}
                    title="Abrir a prévia real do rascunho salvo"
                  >
                    <Eye size={15} aria-hidden="true" />
                    Prévia
                  </Link>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-sidebar-hover px-4 py-2 text-xs">
                <div className="flex flex-wrap items-center gap-1">
                  <Link
                    href={prototypeHistoryHref(prototype)}
                    className={`${action} text-secundary hover:bg-sidebar-hover hover:text-foreground`}
                  >
                    <History size={14} aria-hidden="true" />
                    Versões
                  </Link>
                  {prototype.leadId && prototype.leadName && (
                    <Link
                      href={`/leads/${prototype.leadId}`}
                      className={`${action} text-secundary hover:bg-sidebar-hover hover:text-foreground`}
                    >
                      Ver lead
                      <ArrowUpRight size={14} aria-hidden="true" />
                    </Link>
                  )}
                </div>
                <DeletePrototypeButton
                  id={prototype.id}
                  name={prototype.name}
                  revision={prototype.draftRevision}
                />
              </div>
            </article>
          </li>
        );
      })}
    </ul>
  );
}
