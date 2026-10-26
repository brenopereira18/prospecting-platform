import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import {
  proposalContentSchema,
  createProposalSchema,
  balanceOf,
  moneyCents,
  centsMoney,
  nextStatuses,
  type ProposalContent,
  type ProposalDTO,
} from "./proposal.schema";
import { proposalSections } from "./proposal-presentation";
import { proposalPdfHtml } from "./proposal-pdf";
import { ProposalService } from "./proposal.service";
import type { PrismaClient } from "../../../generated/prisma/client";
export const sampleContent: ProposalContent = {
  title: "Landing page para Hamburgueria Central",
  description:
    "Criação de site responsivo para apresentar a hamburgueria e facilitar pedidos.",
  scope:
    "Página inicial e apresentação do estabelecimento.\nCardápio, avaliações e localização.\nConfiguração de domínio e publicação.",
  total: "2990.90",
  paymentMode: "DEFINIDAS",
  deposit: "990.10",
  depositMethod: "PIX",
  depositInstallments: 1,
  balanceMethod: "CARTAO",
  balanceInstallments: 3,
  deliveryDays: 20,
  validUntil: "2026-11-15",
  notes: "Materiais e fotografias fornecidos pelo cliente.",
  managedHosting: true,
  monthlyAmount: "99.90",
  maintenance: "Hospedagem, backups e atualização de textos.",
};
export const sampleProposal: ProposalDTO = {
  ...sampleContent,
  id: "5ae17d20-7194-46fa-85d7-edb3aa50dc09",
  leadId: "6945add5-e2c4-4ebc-96f0-77a86b83ad6a",
  sourceProposalId: null,
  clientName: "Hamburgueria Central",
  clientAddress: "Rua das Palmeiras, 120",
  clientPhone: "(32) 99999-0000",
  issuerName: "Breno",
  issuerEmail: "breno@example.invalid",
  status: "ENVIADA",
  revision: 1,
  lockedAt: "2026-10-23T12:00:00.000Z",
  deletedAt: null,
  createdAt: "2026-10-23T12:00:00.000Z",
  updatedAt: "2026-10-23T12:00:00.000Z",
};

test("valid proposal: independent payment methods and managed hosting", () =>
  assert.deepEqual(proposalContentSchema.parse(sampleContent), sampleContent));
test("money uses exact cents and canonical decimal strings", () => {
  assert.equal(balanceOf(sampleContent), "2000.80");
  assert.equal(balanceOf({ total: "0.30", deposit: "0.10" }), "0.20");
  assert.equal(centsMoney(moneyCents("9999999999.99")), "9999999999.99");
  assert.equal(
    proposalContentSchema.parse({ ...sampleContent, total: "3000,5" }).total,
    "3000.50",
  );
});
for (const value of [
  "-1",
  "0",
  "1.234",
  "NaN",
  "Infinity",
  "1e5",
  "10000000000",
  "1.000,00",
])
  test(`invalid total ${value} is rejected`, () =>
    assert.equal(
      proposalContentSchema.safeParse({ ...sampleContent, total: value })
        .success,
      false,
    ));
test("entry cannot exceed total; zero and full entry are supported", () => {
  assert.equal(
    proposalContentSchema.safeParse({ ...sampleContent, deposit: "2991" })
      .success,
    false,
  );
  assert.equal(
    proposalContentSchema.safeParse({
      ...sampleContent,
      deposit: sampleContent.total,
    }).success,
    true,
  );
  assert.equal(
    proposalContentSchema.safeParse({ ...sampleContent, deposit: "0" }).success,
    true,
  );
});
test("Pix cannot be split; card installment bounds are enforced", () => {
  for (const update of [
    { depositInstallments: 2 },
    { balanceInstallments: 0 },
    { balanceInstallments: 25 },
    { balanceInstallments: 1.5 },
  ])
    assert.equal(
      proposalContentSchema.safeParse({ ...sampleContent, ...update }).success,
      false,
    );
});
test("optional hosting cannot introduce hidden recurring amounts", () => {
  assert.equal(
    proposalContentSchema.safeParse({
      ...sampleContent,
      managedHosting: false,
      monthlyAmount: null,
    }).success,
    true,
  );
  assert.equal(
    proposalContentSchema.safeParse({ ...sampleContent, managedHosting: false })
      .success,
    false,
  );
  for (const monthlyAmount of [null, "0", "-1"])
    assert.equal(
      proposalContentSchema.safeParse({ ...sampleContent, monthlyAmount })
        .success,
      false,
    );
});
test("invalid dates, blank scope and extra client-controlled owner fields are rejected", () => {
  assert.equal(
    proposalContentSchema.safeParse({
      ...sampleContent,
      validUntil: "2026-02-30",
    }).success,
    false,
  );
  assert.equal(
    proposalContentSchema.safeParse({ ...sampleContent, scope: " " }).success,
    false,
  );
  assert.equal(
    createProposalSchema.safeParse({
      id: randomUUID(),
      leadId: randomUUID(),
      userId: randomUUID(),
      content: sampleContent,
    }).success,
    false,
  );
});
test("presentation displays all commercial terms without implying receipt", () => {
  const sections = proposalSections(sampleProposal)
    .map((item) => item.text)
    .join("\n");
  assert.match(sections, /2\.000,80/);
  assert.match(sections, /3 parcelas/);
  assert.match(sections, /990,10/);
  assert.match(sections, /cobrada automaticamente no cartão/);
  assert.match(sections, /15\/11\/2026/);
  assert.match(sections, /20 dias corridos/);
  assert.doesNotMatch(sections, /pagamento recebido/i);
});
test("full payment and client hosting have no fabricated entry or monthly fee", () => {
  const sections = proposalSections({
    ...sampleProposal,
    deposit: "0.00",
    managedHosting: false,
    monthlyAmount: null,
  })
    .map((item) => item.text)
    .join("\n");
  assert.match(sections, /Pagamento integral/);
  assert.doesNotMatch(sections, /Entrada:|99,90/);
  assert.match(sections, /responsabilidade do cliente/);
});
test("PDF escapes untrusted content and follows the preserved proposal, independent of status", () => {
  const html = proposalPdfHtml({
    ...sampleProposal,
    description: '<script>alert("x")</script>',
  });
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
  assert.equal(
    proposalPdfHtml(sampleProposal),
    proposalPdfHtml({
      ...sampleProposal,
      status: "ACEITA",
      revision: 2,
      updatedAt: "2026-10-24T12:00:00.000Z",
    }),
  );
  assert.match(
    proposalPdfHtml({ ...sampleProposal, status: "RASCUNHO" }),
    /sujeito a revisão/,
  );
});
test("PDF presents the commercial narrative in order and preserves every registered text", () => {
  const html = proposalPdfHtml(sampleProposal);
  const labels = [
    "Preparada para",
    sampleProposal.title,
    "Objetivo do projeto",
    "Escopo e entregáveis",
    "Investimento no projeto",
    "Prazo e validade",
    "Condições de pagamento",
    "Hospedagem e manutenção",
    "Observações e condições comerciais",
  ];
  let position = html.indexOf("<body>");
  assert.doesNotMatch(
    html,
    /Vamos iniciar o projeto\?|Para aprovar esta proposta e alinhar a contratação/,
  );
  for (const label of labels) {
    const next = html.indexOf(label, position + 1);
    assert.ok(next > position, `${label} must follow the previous section`);
    position = next;
  }
  for (const text of [
    sampleProposal.description,
    sampleProposal.scope,
    sampleProposal.notes,
    sampleProposal.maintenance,
  ])
    assert.ok(html.includes(text));
});
test("commercial status never transitions back to an editable draft", () => {
  for (const transitions of Object.values(nextStatuses))
    assert.ok(!transitions.includes("RASCUNHO"));
  assert.deepEqual(nextStatuses.ACEITA, []);
});
test("all service operations reject missing session identity before touching the DB", async () => {
  const service = new ProposalService({} as PrismaClient);
  for (const operation of [
    () => service.create({}, ""),
    () => service.update({}, ""),
    () => service.changeStatus({}, ""),
    () => service.duplicate({}, ""),
    () => service.delete({}, ""),
    () => service.list(sampleProposal.leadId, ""),
    () => service.get(sampleProposal.id, sampleProposal.leadId, ""),
  ])
    await assert.rejects(operation(), { code: "UNAUTHENTICATED" });
});

test("legacy inputs default to defined terms without changing any amount", () => {
  const { paymentMode: _mode, ...legacy } = sampleContent;
  void _mode;
  assert.deepEqual(proposalContentSchema.parse(legacy), sampleContent);
});
test("negotiable payment requires only the total and persists no invented terms", () => {
  const {
    deposit: _deposit,
    depositMethod: _method,
    depositInstallments: _parts,
    balanceMethod: _balanceMethod,
    balanceInstallments: _balanceParts,
    ...rest
  } = sampleContent;
  void [_deposit, _method, _parts, _balanceMethod, _balanceParts];
  const parsed = proposalContentSchema.parse({
    ...rest,
    paymentMode: "A_NEGOCIAR",
  });
  assert.equal(parsed.total, sampleContent.total);
  for (const key of [
    "deposit",
    "depositMethod",
    "depositInstallments",
    "balanceMethod",
    "balanceInstallments",
  ] as const)
    assert.equal(parsed[key], null);
  assert.equal(balanceOf(parsed), null);
});
test("defined terms cannot omit required payment details; negotiable terms reject stale details", () => {
  assert.equal(
    proposalContentSchema.safeParse({ ...sampleContent, deposit: null })
      .success,
    false,
  );
  assert.equal(
    proposalContentSchema.safeParse({
      ...sampleContent,
      paymentMode: "A_NEGOCIAR",
    }).success,
    false,
  );
  assert.equal(
    proposalContentSchema.safeParse({
      ...sampleContent,
      paymentMode: "INVALID",
    }).success,
    false,
  );
});
test("negotiable PDF has negotiation copy and optional hosting without entry, balance or installments", () => {
  const negotiable = {
    ...sampleProposal,
    paymentMode: "A_NEGOCIAR" as const,
    deposit: null,
    depositMethod: null,
    depositInstallments: null,
    balanceMethod: null,
    balanceInstallments: null,
  };
  const html = proposalPdfHtml(negotiable);
  assert.match(
    html,
    /Pagamento via Pix ou cartão de crédito\. Entrada e parcelamento a combinar\./,
  );
  assert.match(html, /negociadas antes da contratação/);
  assert.doesNotMatch(html, /Entrada:|Saldo:|3 parcelas|990,10|2\.000,80/);
  assert.match(html, /Serviço opcional de hospedagem gerenciada/);
  assert.match(html, /99,90 por mês, separado do valor do desenvolvimento/);
  assert.match(
    html,
    /Quando contratada, a mensalidade será cobrada automaticamente/,
  );
  assert.equal(html, proposalPdfHtml({ ...negotiable, status: "ACEITA" }));
});
