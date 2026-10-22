import Link from "next/link";
import {
  prototypePageHref,
  PROTOTYPES_PER_PAGE,
} from "./prototype-pagination.utils";

export function PrototypePagination({
  page,
  totalPages,
  totalCount,
  selectedPrototypeId,
}: {
  page: number;
  totalPages: number;
  totalCount: number;
  selectedPrototypeId?: string;
}) {
  if (totalCount === 0 || totalPages <= 1) return null;
  const firstItem = (page - 1) * PROTOTYPES_PER_PAGE + 1;
  const lastItem = Math.min(page * PROTOTYPES_PER_PAGE, totalCount);

  return (
    <div className="mt-6 flex flex-col gap-4 border-t border-sidebar-hover pt-4 text-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="text-secundary">
        <p>Exibindo {firstItem}–{lastItem} de {totalCount} protótipos</p>
        <p className="mt-1">Página {page} de {totalPages}</p>
      </div>
      <nav aria-label="Paginação dos protótipos" className="flex items-center gap-2">
          {page > 1 ? (
            <Link
              href={prototypePageHref(page - 1, selectedPrototypeId)}
              rel="prev"
              className="inline-flex min-h-10 items-center rounded-lg border border-sidebar-hover px-4 font-medium hover:bg-sidebar-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              Anterior
            </Link>
          ) : (
            <span aria-disabled="true" className="inline-flex min-h-10 items-center rounded-lg border border-sidebar-hover px-4 text-secundary opacity-50">
              Anterior
            </span>
          )}
          {page < totalPages ? (
            <Link
              href={prototypePageHref(page + 1, selectedPrototypeId)}
              rel="next"
              className="inline-flex min-h-10 items-center rounded-lg border border-sidebar-hover px-4 font-medium hover:bg-sidebar-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              Próxima
            </Link>
          ) : (
            <span aria-disabled="true" className="inline-flex min-h-10 items-center rounded-lg border border-sidebar-hover px-4 text-secundary opacity-50">
              Próxima
            </span>
          )}
      </nav>
    </div>
  );
}
