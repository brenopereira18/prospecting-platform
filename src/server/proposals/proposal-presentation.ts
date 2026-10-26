import {
  balanceOf,
  formatMoney,
  formatProposalDate,
  moneyCents,
  type ProposalDTO,
} from "./proposal.schema";

function payment(method: "PIX" | "CARTAO" | null, installments: number | null) {
  if (method === null || installments === null)
    throw new Error("Condições de pagamento incompletas.");
  return method === "PIX"
    ? "Pix, à vista"
    : `Cartão de crédito em ${installments} ${installments === 1 ? "parcela" : "parcelas"}`;
}
// Shared by the on-screen proposal and the PDF. No live lead data or current dates.
function definedPayments(proposal: ProposalDTO) {
  const balance = balanceOf(proposal);
  if (balance === null || proposal.deposit === null)
    throw new Error("Condições de pagamento incompletas.");
  const deposit = moneyCents(proposal.deposit);
  return [
    ...(deposit > 0
      ? [
          `Entrada: ${formatMoney(proposal.deposit)} · ${payment(proposal.depositMethod, proposal.depositInstallments)}.`,
        ]
      : []),
    ...(moneyCents(balance) > 0
      ? [
          `${deposit > 0 ? "Saldo" : "Pagamento integral"}: ${formatMoney(balance)} · ${payment(proposal.balanceMethod, proposal.balanceInstallments)}.`,
        ]
      : []),
  ].join("\n");
}
export function proposalSections(proposal: ProposalDTO) {
  const payments =
    proposal.paymentMode === "A_NEGOCIAR"
      ? "Pagamento via Pix ou cartão de crédito. Entrada e parcelamento a combinar.\nAs condições poderão ser negociadas antes da contratação."
      : definedPayments(proposal);
  return [
    { title: "Serviço", text: proposal.description },
    { title: "Escopo e entregáveis", text: proposal.scope },
    {
      title: "Prazo e validade",
      text: `Entrega estimada: ${proposal.deliveryDays} dias corridos após a aprovação e o recebimento dos materiais necessários.\nProposta válida até ${formatProposalDate(proposal.validUntil)}.`,
    },
    { title: "Condições de pagamento", text: payments },
    {
      title: "Hospedagem e manutenção",
      text: proposal.managedHosting
        ? `Serviço opcional de hospedagem gerenciada: ${formatMoney(proposal.monthlyAmount!)} por mês, separado do valor do desenvolvimento.\nQuando contratada, a mensalidade será cobrada automaticamente no cartão de crédito.${proposal.maintenance ? `\n\nIncluído na manutenção:\n${proposal.maintenance}` : ""}`
        : `Sem mensalidade. A hospedagem ficará sob responsabilidade do cliente.${proposal.maintenance ? `\n\nManutenção:\n${proposal.maintenance}` : ""}`,
    },
    ...(proposal.notes ? [{ title: "Observações", text: proposal.notes }] : []),
  ];
}
export function proposalReference(proposal: ProposalDTO) {
  return proposal.id.slice(0, 8).toUpperCase();
}
