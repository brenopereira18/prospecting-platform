import { notFound } from "next/navigation";
import { asaasService } from "@/src/server/finance/asaas.runtime";
import { checkoutTermsSchema } from "@/src/server/finance/asaas.schema";
import { formatMoney } from "@/src/server/proposals/proposal.schema";
import { PublicCheckoutButton } from "@/src/components/finance/asaas-controls";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Pagamento | Prospecta",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export default async function PaymentPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const row = await asaasService()
    .publicCheckout(token)
    .catch(() => notFound());
  const terms = checkoutTermsSchema.parse(row.terms);
  const available =
    ["PREPARED", "ACTIVE"].includes(row.status) && row.expiresAt > new Date();
  return (
    <main className="mx-auto w-full max-w-xl space-y-6 px-5 py-12">
      <p className="text-sm font-semibold text-primary">
        Prospecta · Ambiente de testes
      </p>
      <header>
        <p className="text-sm text-secundary">{terms.clientName}</p>
        <h1 className="mt-2 text-2xl font-semibold">{terms.title}</h1>
      </header>
      <section className="space-y-5 rounded-xl border border-sidebar-hover bg-card p-6">
        <p className="whitespace-pre-wrap text-sm leading-6">
          {terms.description}
        </p>
        <p className="text-3xl font-semibold tabular-nums">
          {formatMoney(row.amount.toFixed(2))}
          {row.contractId && (
            <span className="text-base font-normal text-secundary"> / mês</span>
          )}
        </p>
        <p className="text-sm text-secundary">
          {row.contractId
            ? "Serviço opcional, contratado separadamente do desenvolvimento. Cobrança automática mensal no cartão mediante autorização abaixo."
            : `Pix ou cartão à vista${terms.maxInstallments > 1 ? `, em até ${terms.maxInstallments} parcelas sem acréscimo pelo Prospecta` : ""}. Confira o total, a quantidade e o valor de cada parcela no Asaas antes de confirmar.`}
        </p>
        {available ? (
          <PublicCheckoutButton
            token={token}
            authorization={terms.authorization}
          />
        ) : (
          <p role="status" className="text-sm">
            Este checkout não está disponível para uma nova contratação.
            Consulte o prestador para acompanhar o pagamento ou solicitar um
            novo link.
          </p>
        )}
      </section>
      <p className="text-xs text-secundary">
        Teste Sandbox: não utilize cartão real. Os dados de cartão são
        preenchidos somente no Asaas.
      </p>
    </main>
  );
}
