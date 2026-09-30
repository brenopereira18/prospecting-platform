import { Plus } from "lucide-react";

import { LocationService } from "../../../server/location/location.service";
import { CategoryService } from "../../../server/categories/category.service";
import { DiscoveryFilters } from "@/src/components/discovery/discovery-filter";

const categoryService = new CategoryService();
const locationService = new LocationService();

export default async function DiscoveryPage() {
  const categories = await categoryService.list();
  const states = await locationService.listStates();

  return (
    <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
      <div className="w-full">
        <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Descobrir negócios
            </h1>

            <p className="mt-1 text-sm text-secundary">
              Encontre estabelecimentos por região e categoria.
            </p>
          </div>

          <button
            type="button"
            className="inline-flex h-9 items-center justify-center rounded-md border border-sidebar-hover px-4 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-sidebar-hover"
          >
            <Plus className="mr-2 h-4 w-4" />
            Cadastro manual
          </button>
        </header>

        <section className="rounded-xl border border-sidebar-hover bg-terciary shadow">
          <DiscoveryFilters states={states} categories={categories} />
        </section>
      </div>
    </main>
  );
}
