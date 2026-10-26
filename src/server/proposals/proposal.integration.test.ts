import "dotenv/config";
import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Prisma } from "../../../generated/prisma/client";
import { ProposalService } from "./proposal.service";
import { proposalPdfHtml } from "./proposal-pdf";
import type { ProposalDTO } from "./proposal.schema";
const content = {
  title: "Proposta de teste",
  description: "Serviço de teste",
  scope: "Entrega de teste",
  total: "1000.30",
  deposit: "300.10",
  depositMethod: "PIX",
  depositInstallments: 1,
  balanceMethod: "CARTAO",
  balanceInstallments: 3,
  deliveryDays: 20,
  validUntil: "2026-11-15",
  notes: "",
  managedHosting: false,
  monthlyAmount: null,
  maintenance: "",
};
test(
  "PostgreSQL proposals: transactions, ownership, revisions, immutability, soft deletion and retry",
  { skip: process.env.PROPOSAL_DATABASE_TEST !== "1" },
  async (t) => {
    const db = new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
    });
    const users = [randomUUID(), randomUUID()];
    const categoryId = randomUUID();
    try {
      await db.user.createMany({
        data: users.map((id) => ({
          id,
          name: "Proposal test",
          email: `proposal-${id}@example.invalid`,
          passwordHash: "test-only",
        })),
      });
      await db.category.create({
        data: { id: categoryId, name: `Proposal ${categoryId}` },
      });
      const lead = await db.lead.create({
        data: {
          userId: users[0],
          categoryId,
          source: "MANUAL",
          name: "Original client",
          address: "Original address",
        },
      });
      const otherLead = await db.lead.create({
        data: {
          userId: users[1],
          categoryId,
          source: "MANUAL",
          name: "Other client",
        },
      });
      const service = new ProposalService(db);
      const id = randomUUID();
      let proposal: ProposalDTO;
      await t.test(
        "creation is associated, exact, and idempotent under concurrent retries",
        async () => {
          const results = await Promise.all([
            service.create({ id, leadId: lead.id, content }, users[0]),
            service.create({ id, leadId: lead.id, content }, users[0]),
          ]);
          proposal = results[0];
          await assert.rejects(
            service.create(
              {
                id,
                leadId: lead.id,
                content: { ...content, title: "Different retry" },
              },
              users[0],
            ),
            { code: "CONFLICT" },
          );
          assert.equal(results[1].id, id);
          assert.equal((await service.list(lead.id, users[0])).length, 1);
          assert.equal(proposal.paymentMode, "DEFINIDAS");
          assert.equal(proposal.total, "1000.30");
          assert.equal(proposal.clientName, lead.name);
        },
      );
      await t.test(
        "server validation and cross-user/cross-lead access are rejected",
        async () => {
          await assert.rejects(
            service.create(
              { id: randomUUID(), leadId: otherLead.id, content },
              users[0],
            ),
            { code: "NOT_FOUND" },
          );
          await assert.rejects(service.get(id, lead.id, users[1]), {
            code: "NOT_FOUND",
          });
          await assert.rejects(service.get(id, otherLead.id, users[0]), {
            code: "NOT_FOUND",
          });
          await assert.rejects(service.list(lead.id, users[1]), {
            code: "NOT_FOUND",
          });
          await assert.rejects(
            service.update(
              {
                id,
                leadId: lead.id,
                expectedRevision: 0,
                content: { ...content, deposit: "2000" },
              },
              users[0],
            ),
          );
          await assert.rejects(
            service.delete(
              { id, leadId: lead.id, expectedRevision: 0 },
              users[1],
            ),
            { code: "NOT_FOUND" },
          );
        },
      );
      await t.test(
        "negotiable proposals can be created without payment details and retried safely",
        async () => {
          const payload: Record<string, unknown> = {
            ...content,
            paymentMode: "A_NEGOCIAR",
          };
          for (const field of [
            "deposit",
            "depositMethod",
            "depositInstallments",
            "balanceMethod",
            "balanceInstallments",
          ])
            delete payload[field];
          const newId = randomUUID();
          const created = await service.create(
            { id: newId, leadId: lead.id, content: payload },
            users[0],
          );
          assert.equal(created.paymentMode, "A_NEGOCIAR");
          assert.equal(created.deposit, null);
          assert.equal(created.balanceMethod, null);
          assert.equal(created.balanceInstallments, null);
          assert.equal(created.total, content.total);
          assert.deepEqual(
            await service.create(
              { id: newId, leadId: lead.id, content: payload },
              users[0],
            ),
            created,
          );
          await assert.rejects(
            db.commercialProposal.update({
              where: { id: newId },
              data: { deposit: "0" },
            }),
          );
          assert.deepEqual(
            await service.get(newId, lead.id, users[0]),
            created,
          );
        },
      );
      await t.test(
        "simultaneous edits cannot silently overwrite one another",
        async () => {
          const results = await Promise.allSettled(
            ["A", "B"].map((title) =>
              service.update(
                {
                  id,
                  leadId: lead.id,
                  expectedRevision: 0,
                  content: { ...content, title },
                },
                users[0],
              ),
            ),
          );
          assert.equal(
            results.filter((item) => item.status === "fulfilled").length,
            1,
          );
          assert.equal(
            (
              results.find(
                (item) => item.status === "rejected",
              ) as PromiseRejectedResult
            ).reason.code,
            "CONFLICT",
          );
          proposal = await service.get(id, lead.id, users[0]);
        },
      );
      await t.test(
        "failed history insert rolls back status and content lock",
        async () => {
          const broken = new ProposalService({
            $transaction: (
              fn: (tx: Prisma.TransactionClient) => Promise<unknown>,
            ) =>
              db.$transaction((tx) =>
                fn(
                  new Proxy(tx, {
                    get(target, key) {
                      return key === "proposalStatusHistory"
                        ? {
                            create: () => {
                              throw new Error("Simulated history failure");
                            },
                          }
                        : Reflect.get(target, key);
                    },
                  }),
                ),
              ),
          } as unknown as PrismaClient);
          await assert.rejects(
            broken.changeStatus(
              {
                id,
                leadId: lead.id,
                expectedRevision: proposal.revision,
                status: "ENVIADA",
              },
              users[0],
            ),
          );
          assert.deepEqual(await service.get(id, lead.id, users[0]), proposal);
        },
      );
      await t.test(
        "sent proposal locks content and preserves lead identification and status",
        async () => {
          proposal = await service.changeStatus(
            {
              id,
              leadId: lead.id,
              expectedRevision: proposal.revision,
              status: "ENVIADA",
            },
            users[0],
          );
          await db.lead.update({
            where: { id: lead.id },
            data: { name: "Renamed client" },
          });
          assert.equal(
            (await service.get(id, lead.id, users[0])).clientName,
            "Original client",
          );
          await assert.rejects(
            service.update(
              {
                id,
                leadId: lead.id,
                expectedRevision: proposal.revision,
                content,
              },
              users[0],
            ),
            { code: "LOCKED" },
          );
          await assert.rejects(
            db.commercialProposal.update({
              where: { id },
              data: { total: "50" },
            }),
          );
          const currentLead = await db.lead.findUniqueOrThrow({
            where: { id: lead.id },
          });
          assert.equal(currentLead.status, "NOVO");
          assert.equal(currentLead.statusRevision, 0);
          assert.equal(
            (await service.history(id, lead.id, users[0])).length,
            1,
          );
        },
      );
      await t.test(
        "sent proposals can be negotiated through independent linked drafts in either mode",
        async () => {
          const original = await service.get(id, lead.id, users[0]);
          const originalHistory = await service.history(id, lead.id, users[0]);
          const draft = await service.duplicate(
            {
              id,
              leadId: lead.id,
              expectedRevision: original.revision,
              newId: randomUUID(),
            },
            users[0],
          );
          const negotiableContent = {
            ...content,
            paymentMode: "A_NEGOCIAR",
            deposit: null,
            depositMethod: null,
            depositInstallments: null,
            balanceMethod: null,
            balanceInstallments: null,
          };
          let negotiated = await service.update(
            {
              id: draft.id,
              leadId: lead.id,
              expectedRevision: 0,
              content: negotiableContent,
            },
            users[0],
          );
          assert.equal(negotiated.paymentMode, "A_NEGOCIAR");
          assert.equal(negotiated.deposit, null);
          assert.equal(negotiated.balanceMethod, null);
          assert.equal(negotiated.sourceProposalId, id);
          assert.match(
            proposalPdfHtml(negotiated),
            /Entrada e parcelamento a combinar/,
          );
          assert.doesNotMatch(proposalPdfHtml(negotiated), /Entrada:|Saldo:/);
          negotiated = await service.changeStatus(
            {
              id: negotiated.id,
              leadId: lead.id,
              expectedRevision: negotiated.revision,
              status: "ENVIADA",
            },
            users[0],
          );
          await assert.rejects(
            service.update(
              {
                id: negotiated.id,
                leadId: lead.id,
                expectedRevision: negotiated.revision,
                content,
              },
              users[0],
            ),
            { code: "LOCKED" },
          );
          await assert.rejects(
            db.commercialProposal.update({
              where: { id: negotiated.id },
              data: {
                paymentMode: "DEFINIDAS",
                deposit: "0",
                depositMethod: "PIX",
                depositInstallments: 1,
                balanceMethod: "PIX",
                balanceInstallments: 1,
              },
            }),
          );
          const nextDraft = await service.duplicate(
            {
              id: negotiated.id,
              leadId: lead.id,
              expectedRevision: negotiated.revision,
              newId: randomUUID(),
            },
            users[0],
          );
          assert.equal(nextDraft.paymentMode, "A_NEGOCIAR");
          assert.equal(nextDraft.status, "RASCUNHO");
          const defined = await service.update(
            { id: nextDraft.id, leadId: lead.id, expectedRevision: 0, content },
            users[0],
          );
          assert.equal(defined.paymentMode, "DEFINIDAS");
          assert.equal(defined.deposit, "300.10");
          assert.match(proposalPdfHtml(defined), /Entrada:|Saldo:/);
          assert.deepEqual(await service.get(id, lead.id, users[0]), original);
          assert.deepEqual(
            await service.history(id, lead.id, users[0]),
            originalHistory,
          );
          assert.deepEqual(
            await service.get(negotiated.id, lead.id, users[0]),
            negotiated,
          );
          assert.equal(
            (await service.history(negotiated.id, lead.id, users[0])).length,
            1,
          );
          await assert.rejects(service.get(negotiated.id, lead.id, users[1]), {
            code: "NOT_FOUND",
          });
          await assert.rejects(
            db.commercialProposal.update({
              where: { id: nextDraft.id },
              data: { paymentMode: "A_NEGOCIAR" },
            }),
          );
        },
      );
      await t.test(
        "accepted proposal retains the exact commercial PDF and cannot reopen",
        async () => {
          const html = proposalPdfHtml(proposal);
          proposal = await service.changeStatus(
            {
              id,
              leadId: lead.id,
              expectedRevision: proposal.revision,
              status: "ACEITA",
            },
            users[0],
          );
          assert.equal(proposalPdfHtml(proposal), html);
          await assert.rejects(
            service.changeStatus(
              {
                id,
                leadId: lead.id,
                expectedRevision: proposal.revision,
                status: "RASCUNHO",
              },
              users[0],
            ),
            { code: "INVALID_STATUS" },
          );
        },
      );
      await t.test(
        "duplication creates a linked editable draft without changing the original",
        async () => {
          const copy = await service.duplicate(
            {
              id,
              leadId: lead.id,
              expectedRevision: proposal.revision,
              newId: randomUUID(),
            },
            users[0],
          );
          assert.equal(copy.status, "RASCUNHO");
          assert.equal(copy.lockedAt, null);
          assert.equal(copy.sourceProposalId, id);
          await service.update(
            {
              id: copy.id,
              leadId: lead.id,
              expectedRevision: 0,
              content: { ...content, total: "2000" },
            },
            users[0],
          );
          assert.deepEqual(await service.get(id, lead.id, users[0]), proposal);
        },
      );
      await t.test(
        "deletion hides only selected proposal and preserves its history and PDF",
        async () => {
          const html = proposalPdfHtml(proposal);
          const countBefore = (await service.list(lead.id, users[0])).length;
          await service.delete(
            { id, leadId: lead.id, expectedRevision: proposal.revision },
            users[0],
          );
          assert.equal(
            (await service.list(lead.id, users[0])).length,
            countBefore - 1,
          );
          const archived = await service.get(id, lead.id, users[0]);
          assert.ok(archived.deletedAt);
          assert.equal(proposalPdfHtml(archived), html);
          assert.equal(
            (await service.history(id, lead.id, users[0])).length,
            2,
          );
          assert.equal(await db.lead.count({ where: { id: lead.id } }), 1);
        },
      );
    } finally {
      await db.proposalStatusHistory.deleteMany({
        where: { proposal: { userId: { in: users } } },
      });
      const copies = await db.commercialProposal.findMany({
        where: { userId: { in: users }, sourceProposalId: { not: null } },
        select: { id: true },
        orderBy: { createdAt: "desc" },
      });
      for (const copy of copies)
        await db.commercialProposal.delete({ where: { id: copy.id } });
      await db.commercialProposal.deleteMany({
        where: { userId: { in: users } },
      });
      await db.user.deleteMany({ where: { id: { in: users } } });
      await db.category.deleteMany({ where: { id: categoryId } });
      await db.$disconnect();
    }
  },
);
