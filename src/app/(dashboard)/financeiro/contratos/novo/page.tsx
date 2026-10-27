import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma/client";
import { getCurrentUser } from "@/src/server/auth/current-user.service";
import {
  FinanceError,
  FinanceService,
} from "@/src/server/finance/finance.service";
import { todayInSaoPaulo } from "@/src/server/finance/finance.schema";
import { ContractForm } from "@/src/components/finance/contract-controls";
import { financeButton } from "@/src/components/finance/finance-ui";

export default async function NewContractPage({
  searchParams,
}: {
  searchParams: Promise<{ saleId?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { saleId } = await searchParams;
  if (!saleId || !z.uuid().safeParse(saleId).success) notFound();
  const sale = await new FinanceService(prisma)
    .get(saleId, user.id)
    .catch((error) => {
      if (error instanceof FinanceError && error.code === "NOT_FOUND")
        notFound();
      throw error;
    });
  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 py-6 sm:p-8">
      <Link href={`/financeiro/vendas/${sale.id}`} className={financeButton}>
        Voltar à venda
      </Link>
      <header>
        <h1 className="text-2xl font-semibold">Novo contrato recorrente</h1>
        <p className="mt-2 text-sm text-secundary">
          {sale.clientName} · {sale.title}
        </p>
      </header>
      <section className="rounded-xl border border-sidebar-hover bg-card p-5 sm:p-6">
        <ContractForm saleId={sale.id} today={todayInSaoPaulo()} />
      </section>
    </div>
  );
}
