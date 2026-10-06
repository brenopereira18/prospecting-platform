import { redirect } from "next/navigation";
import Link from "next/link";
import { Search } from "lucide-react";

import { getCurrentUser } from "@/src/server/auth/current-user.service";
import { LeadService } from "@/src/server/leads/leads.service";
import { CategoryService } from "@/src/server/categories/category.service";
import { LeadFilters } from "@/src/components/leads/lead-filters";
import { LeadStatus } from "@/generated/prisma/enums";
import { LeadCard } from "@/src/components/leads/lead-card";

interface LeadsPageProps {
  searchParams: Promise<{
    name?: string;
    categoryId?: string;
    status?: string;
  }>;
}

const leadService = new LeadService();
const categoryService = new CategoryService();

export default async function LeadsPage({ searchParams }: LeadsPageProps) {
  const user = await getCurrentUser();
  const params = await searchParams;

  if (!user) {
    redirect("/login");
  }

  const status = Object.values(LeadStatus).includes(params.status as LeadStatus)
    ? (params.status as LeadStatus)
    : undefined;

  const [leads, categories] = await Promise.all([
    leadService.listByUser(user.id, {
      name: params.name?.trim() || undefined,
      categoryId: params.categoryId || undefined,
      status,
    }),
    categoryService.list(),
  ]);

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="w-full">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Leads</h1>

            <p className="mt-1 text-sm text-secundary">
              Todos os negócios em prospecção.
            </p>
          </div>

          <Link
            href="/descobrir-negocios"
            className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-background transition-opacity hover:opacity-90"
          >
            <Search className="h-4 w-4" />
            Descobrir negócios
          </Link>
        </div>

        <LeadFilters categories={categories} />

        <div className="space-y-3">
          {leads.length > 0 ? (
            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {leads.map((lead) => (
                <LeadCard key={lead.id} lead={lead} />
              ))}
            </div>
          ) : (
            <div className="mt-6 rounded-xl border border-sidebar-hover bg-terciary p-8 text-center">
              <p className="font-medium">Nenhum lead encontrado</p>

              <p className="mt-1 text-sm text-secundary">
                Tente alterar os filtros para encontrar outros leads.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
