import Link from "next/link";
import { Eye, Layers, Pencil } from "lucide-react";
import type { PrototypeSummaryDTO } from "../../server/prototypes/prototype.dto";
import { DeletePrototypeButton } from "./delete-prototype-button";
import { PrototypeVersionHistory } from "./prototype-version-history";

export function LeadPrototypes({
  leadId,
  prototypes,
  selectedPrototypeId,
}: {
  leadId: string;
  prototypes: PrototypeSummaryDTO[];
  selectedPrototypeId?: string;
}) {
  const ownPrototypes = prototypes.filter(
    (prototype) => prototype.leadId === leadId,
  );
  const link =
    "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 text-xs font-medium hover:bg-sidebar-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";
  const versionCount = (count: number) =>
    `${count} ${count === 1 ? "versão" : "versões"}`;
  return (
    <section
      id="prototipos"
      aria-labelledby="lead-prototypes-title"
      className="scroll-mt-6 space-y-5"
    >
      <div className="flex items-center gap-3">
        <Layers size={21} className="text-primary" aria-hidden="true" />
        <h2 id="lead-prototypes-title" className="text-lg font-semibold">
          Protótipos
        </h2>
        <span className="text-sm tabular-nums text-secundary">
          {ownPrototypes.length}
        </span>
      </div>
      <p className="text-sm leading-relaxed text-secundary">
        Edite os rascunhos ou consulte os históricos deste estabelecimento.
      </p>
      {!ownPrototypes.length && (
        <div className="rounded-xl border border-dashed border-sidebar-hover px-5 py-10 text-center">
          <p className="text-sm text-secundary">
            Este lead ainda não tem protótipos. Use “Gerar protótipo” para
            começar.
          </p>
        </div>
      )}
      <div className="space-y-4">
        {ownPrototypes.map((prototype) => (
          <article
            id={`prototipo-${prototype.id}`}
            key={prototype.id}
            className={`min-w-0 overflow-hidden rounded-xl border bg-card ${selectedPrototypeId === prototype.id ? "border-primary/60 ring-1 ring-primary/20" : "border-sidebar-hover"}`}
          >
            <div className="p-4 sm:p-5">
              <div className="min-w-0">
                <h3 className="break-words text-base font-semibold">
                  {prototype.name}
                </h3>
                <p className="mt-1.5 text-xs text-secundary">
                  {prototype.templateId === "brasa-burger"
                    ? "Hamburgueria"
                    : prototype.templateId}{" "}
                  · {versionCount(prototype.versionCount ?? 0)}
                </p>
              </div>
            </div>
            <section
              aria-labelledby={`prototype-draft-${prototype.id}`}
              className="border-t border-sidebar-hover px-4 py-3 sm:px-5"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <h4
                    id={`prototype-draft-${prototype.id}`}
                    className="text-sm font-semibold"
                  >
                    Rascunho atual
                  </h4>
                  <p className="mt-1 text-xs leading-relaxed text-secundary">
                    Área de trabalho editável. Salvar o rascunho não altera as
                    versões históricas.
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-1">
                  <Link
                    href={`/prototipos/${prototype.id}`}
                    className={`${link} text-primary`}
                  >
                    <Pencil size={14} aria-hidden="true" />
                    Editar rascunho
                  </Link>
                  <Link
                    href={`/prototipos/${prototype.id}/previa`}
                    className={link}
                  >
                    <Eye size={14} aria-hidden="true" />
                    Visualizar
                  </Link>
                  <span
                    aria-hidden="true"
                    className="mx-1 hidden h-5 border-l border-sidebar-hover sm:block"
                  />
                  <DeletePrototypeButton
                    id={prototype.id}
                    name={prototype.name}
                    revision={prototype.draftRevision}
                  />
                </div>
              </div>
            </section>
            <PrototypeVersionHistory
              key={`${prototype.id}:${prototype.updatedAt}`}
              prototype={prototype}
              initiallyExpanded={selectedPrototypeId === prototype.id}
            />
          </article>
        ))}
      </div>
    </section>
  );
}
