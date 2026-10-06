import { redirect } from "next/navigation";

import { getCurrentUser } from "@/src/server/auth/current-user.service";
import { LeadService } from "@/src/server/leads/leads.service";
import { CategoryService } from "@/src/server/categories/category.service";
import { LeadFilters } from "@/src/components/leads/lead-filters";
import { LeadStatus } from "@/generated/prisma/enums";

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
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">Leads</h1>

          <p className="mt-1 text-sm text-secundary">
            Todos os negócios em prospecção.
          </p>
        </div>

        <LeadFilters categories={categories} />

        <div className="space-y-3">
          {leads.map((lead) => (
            <div
              key={lead.id}
              className="rounded-xl border border-sidebar-hover bg-terciary p-4"
            >
              <p className="font-medium">{lead.name}</p>

              <p className="mt-1 text-sm text-secundary">
                {lead.category.name}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
