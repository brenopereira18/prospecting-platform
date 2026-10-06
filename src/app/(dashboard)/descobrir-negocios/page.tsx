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
        <header className="mb-6 flex items-center justify-between gap-4">
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
            className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-background transition-opacity hover:opacity-90"
          >
            <Plus className="mr-2 h-4 w-4" />
            Cadastro manual
          </button>
        </header>

        <DiscoveryFilters states={states} categories={categories} />
      </div>
    </main>
  );
}
