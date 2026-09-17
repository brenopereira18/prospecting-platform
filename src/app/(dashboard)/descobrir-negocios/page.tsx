import { Plus, Search } from "lucide-react";

import { CategoryService } from "../../../server/categories/category.service";
import { CategorySelect } from "../../../components/discovery/category-select";

const categoryService = new CategoryService();

export default async function DiscoveryPage() {
  const categories = await categoryService.list();

  return (
    <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
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

        <section className="rounded-xl border border-sidebar-hover bg-card shadow">
          <div className="grid gap-4 p-6 md:grid-cols-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">País</label>

              <button
                type="button"
                className="flex h-9 w-full items-center justify-between rounded-md border border-sidebar-hover bg-transparent px-3 py-2 text-sm shadow-sm transition-colors hover:bg-sidebar-hover"
              >
                <span>Brasil</span>
                <span className="text-secundary">⌄</span>
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Cidade / região</label>

              <button
                type="button"
                className="flex h-9 w-full items-center justify-between rounded-md border border-sidebar-hover bg-transparent px-3 py-2 text-sm shadow-sm transition-colors hover:bg-sidebar-hover"
              >
                <span>Juiz de Fora, MG</span>
                <span className="text-secundary">⌄</span>
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Categoria</label>

              <CategorySelect categories={categories} />
            </div>

            <div className="flex items-end">
              <button
                type="button"
                className="inline-flex h-9 w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-background shadow transition-colors hover:opacity-90"
              >
                <Search className="mr-2 h-4 w-4" />
                Pesquisar
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
