export const metadata = { robots: { index: false, follow: false } };
export default function PaymentReturn() {
  return (
    <main className="mx-auto max-w-lg space-y-4 px-5 py-16">
      <h1 className="text-2xl font-semibold">Acompanhe sua contratação</h1>
      <p className="text-sm text-secundary">
        O retorno do checkout não confirma o recebimento. O prestador
        acompanhará o resultado diretamente pelo Asaas.
      </p>
    </main>
  );
}
