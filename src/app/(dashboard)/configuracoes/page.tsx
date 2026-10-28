import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/src/server/auth/current-user.service";
import { asaasConfig, AsaasError } from "@/src/server/finance/asaas.client";
import { asaasService } from "@/src/server/finance/asaas.runtime";
import { AsaasPolicyForm } from "@/src/components/finance/asaas-controls";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  let config;
  let error = "";
  try {
    config = asaasConfig();
  } catch (e) {
    error = e instanceof AsaasError ? e.message : "Integração indisponível.";
  }
  const authorized = config?.ownerUserId === user.id;
  const fields = [
    ["ASAAS_SANDBOX_API_KEY", "Chave do Sandbox"],
    ["ASAAS_OWNER_USER_ID", "Usuário proprietário"],
    ["ASAAS_APP_URL", "Origem pública HTTPS"],
    ["ASAAS_WEBHOOK_TOKEN", "Segredo do webhook"],
  ];
  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6 sm:p-8">
      <header>
        <h1 className="text-2xl font-semibold">Configurações</h1>
        <p className="mt-2 text-sm text-secundary">
          Integrações e condições comerciais.
        </p>
      </header>
      <section
        id="asaas"
        className="space-y-5 rounded-xl border border-sidebar-hover bg-card p-5 sm:p-6"
      >
        <header>
          <h2 className="text-lg font-semibold">
            Asaas{" "}
            <span className="text-sm font-normal text-secundary">
              · Sandbox
            </span>
          </h2>
          <p className="mt-2 text-sm text-secundary">
            Venda do site por Pix ou cartão e contratação mensal separada.
          </p>
        </header>
        <p role="status" className="text-sm">
          {error ||
            (authorized
              ? "Integração habilitada para sua conta."
              : "Esta integração pertence a outra conta do Prospecta.")}
        </p>
        <ul className="divide-y divide-sidebar-hover">
          {fields.map(([key, label]) => (
            <li
              key={key}
              className="flex flex-wrap justify-between gap-2 py-3 text-sm"
            >
              <span>
                {label}
                <code className="mt-1 block break-all text-xs text-secundary">
                  {key}
                </code>
              </span>
              <span className="text-secundary">
                {process.env[key]
                  ? "Configurado no servidor"
                  : "Pendente no servidor"}
              </span>
            </li>
          ))}
        </ul>
        {!config && (
          <div className="space-y-2 text-sm text-secundary">
            <p>
              Configure as variáveis no ambiente do servidor e reinicie o
              Next.js. As credenciais não são editadas nem exibidas no
              navegador.
            </p>
            <p>
              A variável ASAAS_OWNER_USER_ID deve ser configurada no ambiente do
              servidor por um administrador.
            </p>
          </div>
        )}
        <p className="text-sm text-secundary">
          Webhook: <code className="break-all">/api/asaas/webhook</code>.
          Cadastre-o no painel Sandbox com uma origem HTTPS pública e o mesmo
          segredo do servidor. Ter as variáveis configuradas não confirma a
          conectividade ou a entrega de eventos.
        </p>
        {authorized && (
          <div className="border-t border-sidebar-hover pt-5">
            <h3 className="font-medium">Regras de parcelamento</h3>
            <AsaasPolicyForm initial={await asaasService().policy(user.id)} />
          </div>
        )}
        <Link
          href="/financeiro"
          className="inline-flex min-h-11 items-center text-sm text-primary underline underline-offset-4"
        >
          Acessar vendas e contratos
        </Link>
      </section>
    </div>
  );
}
