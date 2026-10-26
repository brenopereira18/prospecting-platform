"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  createProposalAction,
  updateProposalAction,
} from "@/src/app/actions/proposals";
import {
  balanceOf,
  formatMoney,
  moneyCents,
  proposalContentSchema,
  type ProposalContent,
  type ProposalDTO,
} from "@/src/server/proposals/proposal.schema";

const inputClass =
  "mt-2 min-h-11 w-full rounded-lg border border-sidebar-hover bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30 disabled:opacity-50";
function Field({
  name,
  label,
  error,
  children,
}: {
  name: string;
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={name} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {error && (
        <p id={`${name}-error`} className="mt-1.5 text-xs text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="min-w-0 rounded-xl border border-sidebar-hover bg-card p-5 sm:p-6">
      <legend className="px-2 text-base font-semibold">{title}</legend>
      <div className="grid gap-5 pt-1">{children}</div>
    </fieldset>
  );
}
const blank: ProposalContent = {
  title: "",
  description: "",
  scope: "",
  total: "",
  paymentMode: "DEFINIDAS",
  deposit: "0.00",
  depositMethod: "PIX",
  depositInstallments: 1,
  balanceMethod: "PIX",
  balanceInstallments: 1,
  deliveryDays: 0,
  validUntil: "",
  notes: "",
  managedHosting: false,
  monthlyAmount: null,
  maintenance: "",
};
export function ProposalForm({
  leadId,
  clientName,
  proposal,
}: {
  leadId: string;
  clientName: string;
  proposal?: ProposalDTO;
}) {
  const initial = proposal
    ? (Object.fromEntries(
        Object.keys(blank).map((key) => [
          key,
          proposal[key as keyof ProposalContent],
        ]),
      ) as ProposalContent)
    : blank;
  const [content, setContent] = useState<ProposalContent>(initial);
  const [hasDeposit, setHasDeposit] = useState(
    Boolean(proposal && Number(proposal.deposit) > 0),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const requestId = useRef<string | null>(null);
  const router = useRouter();
  const dirty = JSON.stringify(content) !== JSON.stringify(initial);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  function update<K extends keyof ProposalContent>(
    key: K,
    value: ProposalContent[K],
  ) {
    setContent((previous) => ({ ...previous, [key]: value }));
  }
  function props(name: keyof ProposalContent) {
    return {
      id: name,
      name,
      className: inputClass,
      "aria-invalid": Boolean(errors[name]),
      "aria-describedby": errors[name] ? `${name}-error` : undefined,
    };
  }
  function textField(
    name: "title" | "description" | "scope" | "notes" | "maintenance",
    label: string,
    max: number,
    multiline = false,
  ) {
    return (
      <Field name={name} label={label} error={errors[name]}>
        {multiline ? (
          <textarea
            {...props(name)}
            rows={name === "scope" ? 6 : 4}
            maxLength={max}
            value={content[name]}
            onChange={(event) => update(name, event.target.value)}
          />
        ) : (
          <input
            {...props(name)}
            maxLength={max}
            value={content[name]}
            onChange={(event) => update(name, event.target.value)}
          />
        )}
      </Field>
    );
  }
  function moneyField(
    name: "total" | "deposit" | "monthlyAmount",
    label: string,
  ) {
    return (
      <Field name={name} label={label} error={errors[name]}>
        <input
          {...props(name)}
          inputMode="decimal"
          autoComplete="off"
          placeholder="0,00"
          value={content[name] ?? ""}
          onChange={(event) => update(name, event.target.value)}
        />
      </Field>
    );
  }
  function paymentFields(kind: "deposit" | "balance", label: string) {
    const method = kind === "deposit" ? "depositMethod" : "balanceMethod";
    const installments =
      kind === "deposit" ? "depositInstallments" : "balanceInstallments";
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <Field name={method} label={label} error={errors[method]}>
          <select
            {...props(method)}
            value={content[method] ?? ""}
            onChange={(event) =>
              setContent((previous) => ({
                ...previous,
                [method]: event.target.value as "PIX" | "CARTAO",
                [installments]: 1,
              }))
            }
          >
            <option value="PIX">Pix</option>
            <option value="CARTAO">Cartão de crédito</option>
          </select>
        </Field>
        {content[method] === "CARTAO" && (
          <Field
            name={installments}
            label="Quantidade de parcelas"
            error={errors[installments]}
          >
            <input
              {...props(installments)}
              type="number"
              min={1}
              max={24}
              value={content[installments] || ""}
              onChange={(event) =>
                update(installments, Number(event.target.value))
              }
            />
          </Field>
        )}
      </div>
    );
  }
  const parsed = proposalContentSchema.safeParse(content);
  const totalValid = /^\d{1,10}([.,]\d{1,2})?$/.test(content.total);
  const paymentValid =
    totalValid &&
    content.deposit !== null &&
    /^\d{1,10}([.,]\d{1,2})?$/.test(content.deposit) &&
    moneyCents(content.deposit) <= moneyCents(content.total);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting.current) return;
    setError("");
    if (!parsed.success) {
      setErrors(
        Object.fromEntries(
          parsed.error.issues.map((issue) => [
            String(issue.path[0]),
            issue.message,
          ]),
        ),
      );
      setError("Revise os campos indicados antes de salvar.");
      return;
    }
    submitting.current = true;
    setBusy(true);
    setErrors({});
    try {
      requestId.current ??= crypto.randomUUID();
      const result = proposal
        ? await updateProposalAction({
            id: proposal.id,
            leadId,
            expectedRevision: proposal.revision,
            content: parsed.data,
          })
        : await createProposalAction({
            id: requestId.current,
            leadId,
            content: parsed.data,
          });
      if (!result.success) {
        setError(result.error);
        setErrors(result.fields ?? {});
        return;
      }
      router.push(`/leads/${leadId}/propostas/${result.data.id}`);
      router.refresh();
    } catch {
      setError(
        "Não foi possível salvar. Os campos foram mantidos para você tentar novamente.",
      );
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  return (
    <form
      onSubmit={submit}
      noValidate
      className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_280px]"
    >
      <fieldset disabled={busy} className="min-w-0 space-y-7">
        <Block title="Serviço e entregáveis">
          {textField("title", "Título da proposta", 160)}
          {textField("description", "Descrição do serviço", 4000, true)}
          {textField("scope", "Escopo e entregáveis", 8000, true)}
          <p className="text-xs leading-5 text-secundary">
            Descreva o que o SEO inclui nesta proposta. Uma rodada de ajustes
            reúne os pedidos de revisão do cliente; mantenha a quantidade
            combinada.
          </p>
        </Block>
        <Block title="Investimento e pagamento">
          {moneyField("total", "Valor do desenvolvimento (R$)")}
          <Field
            name="paymentMode"
            label="Condições de pagamento"
            error={errors.paymentMode}
          >
            <select
              {...props("paymentMode")}
              value={content.paymentMode}
              onChange={(event) => {
                const paymentMode = event.target
                  .value as ProposalContent["paymentMode"];
                setHasDeposit(false);
                setContent((previous) => ({
                  ...previous,
                  paymentMode,
                  deposit: paymentMode === "A_NEGOCIAR" ? null : "0.00",
                  depositMethod: paymentMode === "A_NEGOCIAR" ? null : "PIX",
                  depositInstallments: paymentMode === "A_NEGOCIAR" ? null : 1,
                  balanceMethod: paymentMode === "A_NEGOCIAR" ? null : "PIX",
                  balanceInstallments: paymentMode === "A_NEGOCIAR" ? null : 1,
                }));
              }}
            >
              <option value="A_NEGOCIAR">A negociar</option>
              <option value="DEFINIDAS">Condições definidas</option>
            </select>
          </Field>
          {content.paymentMode === "A_NEGOCIAR" ? (
            <p className="text-sm leading-6 text-secundary">
              Pagamento via Pix ou cartão de crédito. Entrada e parcelamento a
              combinar antes da contratação.
            </p>
          ) : (
            <>
              <label className="flex min-h-10 items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={hasDeposit}
                  onChange={(event) => {
                    setHasDeposit(event.target.checked);
                    if (!event.target.checked)
                      setContent((previous) => ({
                        ...previous,
                        deposit: "0.00",
                        depositMethod: "PIX",
                        depositInstallments: 1,
                      }));
                  }}
                />
                Definir uma entrada
              </label>
              {hasDeposit && (
                <div className="space-y-4 border-l-2 border-primary/40 pl-4">
                  {moneyField("deposit", "Valor da entrada (R$)")}
                  {paymentFields("deposit", "Pagamento da entrada")}
                </div>
              )}
              {paymentFields(
                "balance",
                hasDeposit ? "Pagamento do saldo" : "Pagamento integral",
              )}
              {paymentValid && (
                <p className="text-sm text-secundary">
                  {hasDeposit ? "Saldo após a entrada" : "Valor a pagar"}:{" "}
                  <strong className="font-medium text-foreground">
                    {formatMoney(balanceOf(content)!)}
                  </strong>
                </p>
              )}
            </>
          )}
        </Block>
        <Block title="Prazo e validade">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              name="deliveryDays"
              label="Prazo de entrega (dias corridos)"
              error={errors.deliveryDays}
            >
              <input
                {...props("deliveryDays")}
                type="number"
                min={1}
                max={3650}
                value={content.deliveryDays || ""}
                onChange={(event) =>
                  update("deliveryDays", Number(event.target.value))
                }
              />
            </Field>
            <Field
              name="validUntil"
              label="Válida até"
              error={errors.validUntil}
            >
              <input
                {...props("validUntil")}
                type="date"
                value={content.validUntil}
                onChange={(event) => update("validUntil", event.target.value)}
              />
            </Field>
          </div>
          <p className="text-xs leading-5 text-secundary">
            Prazo contado após a aprovação e o recebimento dos materiais
            necessários.
          </p>
        </Block>
        <Block title="Hospedagem e manutenção">
          <label className="flex min-h-10 items-center gap-3 text-sm">
            <input
              type="checkbox"
              className="size-4 accent-primary"
              checked={content.managedHosting}
              onChange={(event) =>
                setContent((previous) => ({
                  ...previous,
                  managedHosting: event.target.checked,
                  monthlyAmount: event.target.checked ? "" : null,
                }))
              }
            />
            Oferecer hospedagem gerenciada (opcional)
          </label>
          {content.managedHosting ? (
            <>
              {moneyField("monthlyAmount", "Mensalidade (R$)")}
              <p className="text-xs leading-5 text-secundary">
                Quando contratada, a mensalidade será cobrada automaticamente no
                cartão. Esta proposta não inicia cobranças.
              </p>
            </>
          ) : (
            <p className="text-sm text-secundary">
              Sem mensalidade. A hospedagem fica sob responsabilidade do
              cliente.
            </p>
          )}
          {textField(
            "maintenance",
            "O que está incluído na manutenção (opcional)",
            4000,
            true,
          )}
        </Block>
        <Block title="Observações">
          <p className="text-xs leading-5 text-secundary">
            Registre os pagamentos em Condições de pagamento.{" "}
            {content.paymentMode === "A_NEGOCIAR"
              ? "Evite fixar entrada, parcelas ou vencimento do saldo nas observações enquanto estiverem a combinar."
              : "As observações devem respeitar os valores e formas cadastrados."}
          </p>
          {textField("notes", "Informações adicionais (opcional)", 4000, true)}
        </Block>
      </fieldset>
      <aside className="space-y-5 rounded-xl border border-sidebar-hover bg-card p-5 lg:sticky lg:top-6">
        <div>
          <p className="text-xs text-secundary">Proposta para</p>
          <p className="mt-1 break-words font-medium">{clientName}</p>
        </div>
        <div className="border-t border-sidebar-hover pt-4">
          <p className="text-sm text-secundary">Desenvolvimento</p>
          <p className="mt-1 break-words text-2xl font-semibold tabular-nums">
            {totalValid ? formatMoney(content.total) : "—"}
          </p>
          {content.managedHosting && (
            <p className="mt-2 text-xs text-secundary">
              Hospedagem opcional, com mensalidade separada se contratada.
            </p>
          )}
        </div>
        <p className="text-xs leading-5 text-secundary">
          Salve como rascunho para revisar. Ao marcar como enviada, o conteúdo
          será preservado.
        </p>
        {error && (
          <p role="alert" className="text-sm text-red-300">
            {error}
          </p>
        )}
        <button
          disabled={busy}
          className="min-h-11 w-full rounded-lg bg-primary px-4 text-sm font-semibold text-background hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50"
        >
          {busy ? "Salvando…" : "Salvar rascunho"}
        </button>
        <Link
          href={
            proposal
              ? `/leads/${leadId}/propostas/${proposal.id}`
              : `/leads/${leadId}?tab=proposals`
          }
          className="flex min-h-10 items-center justify-center rounded-lg text-sm text-secundary hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary"
        >
          Cancelar
        </Link>
      </aside>
    </form>
  );
}
