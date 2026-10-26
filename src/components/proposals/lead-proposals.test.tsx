import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
  AppRouterContext,
  type AppRouterInstance,
} from "next/dist/shared/lib/app-router-context.shared-runtime";
import { LeadProposals } from "./lead-proposals";
import type { ProposalDTO } from "@/src/server/proposals/proposal.schema";
const proposal: ProposalDTO = {
  id: "5ae17d20-7194-46fa-85d7-edb3aa50dc09",
  leadId: "6945add5-e2c4-4ebc-96f0-77a86b83ad6a",
  title: "Uma proposta com título completo",
  description: "Serviço",
  scope: "Escopo",
  total: "1000.00",
  paymentMode: "A_NEGOCIAR",
  deposit: null,
  depositMethod: null,
  depositInstallments: null,
  balanceMethod: null,
  balanceInstallments: null,
  deliveryDays: 10,
  validUntil: "2027-01-01",
  notes: "",
  managedHosting: true,
  monthlyAmount: "50.00",
  maintenance: "Manutenção opcional",
  sourceProposalId: null,
  clientName: "Cliente",
  clientAddress: null,
  clientPhone: null,
  issuerName: "Emissor",
  issuerEmail: "teste@example.invalid",
  status: "RASCUNHO",
  revision: 0,
  lockedAt: null,
  deletedAt: null,
  createdAt: "2026-10-26T12:00:00Z",
  updatedAt: "2026-10-26T12:00:00Z",
};
function render(
  proposals: ProposalDTO[],
  leadStatus = "GANHO",
  sales: { id: string; proposalId: string; title: string }[] = [],
) {
  return renderToStaticMarkup(
    <AppRouterContext.Provider value={{} as AppRouterInstance}>
      <LeadProposals
        leadId={proposal.leadId}
        proposals={proposals}
        leadStatus={leadStatus}
        sales={sales}
      />
    </AppRouterContext.Provider>,
  );
}
test("draft card prioritizes editing, preserves the title and separates monthly hosting from development", () => {
  const html = render([proposal]);
  assert.match(html, />Editar proposta</);
  assert.ok(html.includes(`${proposal.id}?edit=1`));
  assert.ok(html.includes(proposal.title));
  assert.match(html, /Desenvolvimento/);
  assert.match(html, /1.000,00/);
  assert.match(html, /Hospedagem opcional:/);
  assert.match(html, /50,00/);
  assert.match(html, /Válida até/);
  assert.match(html, /Mais ações da proposta/);
  assert.match(html, /aria-label="Baixar PDF"/);
});
test("sent and final proposals prioritize opening, without enabling edits to preserved content", () => {
  for (const status of ["ENVIADA", "RECUSADA", "EXPIRADA", "ACEITA"] as const) {
    const html = render(
      [{ ...proposal, status, lockedAt: proposal.createdAt }],
      "NOVO",
    );
    assert.match(html, />Abrir proposta</);
    assert.doesNotMatch(html, />Editar proposta</);
    assert.doesNotMatch(html, />Registrar venda</);
  }
});
test("accepted proposal only offers sale registration for a won lead with no associated sale", () => {
  const html = render([
    { ...proposal, status: "ACEITA", lockedAt: proposal.createdAt },
  ]);
  assert.match(html, />Registrar venda</);
  assert.ok(
    html.includes(
      `/financeiro/vendas/nova?lead=${proposal.leadId}&amp;proposal=${proposal.id}`,
    ),
  );
});
test("registered sale is associated with its own proposal without duplication or a second registration link", () => {
  const html = render([{ ...proposal, status: "ACEITA" }], "GANHO", [
    { id: "sale-one", proposalId: proposal.id, title: "Venda" },
  ]);
  assert.match(html, />Abrir venda</);
  assert.match(html, /Venda registrada/);
  assert.doesNotMatch(html, />Registrar venda</);
  assert.doesNotMatch(html, /Vendas de propostas arquivadas/);
  assert.equal(html.split('href="/financeiro/vendas/sale-one"').length - 1, 1);
});
test("sales from archived proposals remain accessible even when there are no listed proposals", () => {
  const html = render([], "GANHO", [
    {
      id: "archived-sale",
      proposalId: "archived-proposal",
      title: "Venda preservada",
    },
  ]);
  assert.match(html, /Vendas de propostas arquivadas \(1\)/);
  assert.match(html, /Nenhuma proposta na listagem/);
  assert.match(html, /href="\/financeiro\/vendas\/archived-sale"/);
});
