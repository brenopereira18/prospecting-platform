import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { z } from "zod";
import type { PrismaClient, Prisma, Prototype, PrototypeVersion } from "../../../generated/prisma/client";
import { PrototypeService, PrototypeError } from "./prototype.service";
import { brasaBurgerDefaultDocument } from "../../components/prototypes/templates/hamburgueria/data/default-document";
import { persistablePrototypeDocumentSchema } from "../../components/prototypes/schemas/persistable-document.schema";

const alice = randomUUID(); const bob = randomUUID();
const document = () => structuredClone(brasaBurgerDefaultDocument);
type Where = { id?: string; userId?: string; draftRevision?: number };

/** A transactional test double, not a substitute for PostgreSQL integration tests. */
function memory() {
  let rows: Prototype[] = []; let versions: PrototypeVersion[] = [];
  const leads: { id: string; userId: string }[] = [];
  const match = (row: Prototype, where: Where) => Object.entries(where).every(([key, value]) => row[key as keyof Prototype] === value);
  let tail = Promise.resolve();
  const db = {
    lead: { findFirst: async ({ where }: { where: { id: string; userId: string } }) => leads.find(lead => lead.id === where.id && lead.userId === where.userId) ?? null },
    prototype: {
      create: async ({ data }: { data: Pick<Prototype, "userId" | "name" | "templateId" | "templateVersion" | "draftDocument"> & { leadId?: string } }) => {
        const row: Prototype = { ...structuredClone(data), id: randomUUID(), leadId: data.leadId ?? null, draftRevision: 0, versionSequence: 0, createdAt: new Date(), updatedAt: new Date() };
        rows.push(row); return structuredClone(row);
      },
      findFirst: async ({ where }: { where: Where }) => structuredClone(rows.find(row => match(row, where)) ?? null),
      findFirstOrThrow: async ({ where }: { where: Where }) => { const row = rows.find(row => match(row, where)); if (!row) throw new Error("Missing row"); return structuredClone(row); },
      findMany: async ({ where }: { where: Where }) => structuredClone(rows.filter(row => match(row, where))),
      updateMany: async ({ where, data }: { where: Where; data: Record<string, unknown> }) => {
        const row = rows.find(row => match(row, where)); if (!row) return { count: 0 };
        for (const [key, value] of Object.entries(data)) {
          const record = row as unknown as Record<string, unknown>;
          record[key] = value && typeof value === "object" && "increment" in value ? Number(record[key]) + Number(value.increment) : structuredClone(value);
        }
        row.updatedAt = new Date(); return { count: 1 };
      },
    },
    prototypeVersion: {
      create: async ({ data }: { data: Pick<PrototypeVersion, "prototypeId" | "number" | "document"> }) => {
        if (versions.some(version => version.prototypeId === data.prototypeId && version.number === data.number)) throw new Error("Duplicate version number");
        const row = { ...structuredClone(data), id: randomUUID(), createdAt: new Date() }; versions.push(row); return structuredClone(row);
      },
      findMany: async ({ where }: { where: { prototypeId: string; prototype: { userId: string } } }) => structuredClone(versions.filter(version => version.prototypeId === where.prototypeId && rows.some(row => row.id === version.prototypeId && row.userId === where.prototype.userId)).sort((a, b) => b.number - a.number).map(version => ({ id: version.id, prototypeId: version.prototypeId, number: version.number, createdAt: version.createdAt }))),
      findFirst: async ({ where }: { where: { id: string; prototypeId: string; prototype: { userId: string } } }) => structuredClone(versions.find(version => version.id === where.id && version.prototypeId === where.prototypeId && rows.some(row => row.id === version.prototypeId && row.userId === where.prototype.userId)) ?? null),
    },
    $transaction: async <T,>(work: (tx: Prisma.TransactionClient) => Promise<T>) => {
      const previous = tail; let release!: () => void; tail = new Promise(resolve => { release = resolve; }); await previous;
      const before = structuredClone({ rows, versions });
      try { return await work(db as unknown as Prisma.TransactionClient); }
      catch (cause) { rows = before.rows; versions = before.versions; throw cause; }
      finally { release(); }
    },
  };
  return { service: new PrototypeService(db as unknown as PrismaClient), leads, getRows: () => rows };
}

test("creates, saves, lists and retrieves validated documents with schema and template versions", async () => {
  const { service } = memory();
  const input = document(); input.template.version = 2;
  const created = await service.create({ name: "  Proposta Bairro  ", document: input }, alice);
  assert.equal(created.name, "Proposta Bairro"); assert.equal(created.draftRevision, 0);
  assert.equal(created.templateVersion, 2); assert.equal(created.draftDocument.schemaVersion, 1);
  const changed = document(); changed.business.name = "Hamburgueria personalizada"; changed.template.version = 2;
  const saved = await service.updateDraft({ id: created.id, expectedRevision: 0, name: "Proposta editada", document: changed }, alice);
  assert.equal(saved.draftRevision, 1);
  assert.deepEqual(await service.findById(created.id, alice), saved);
  assert.equal((await service.list(alice))[0].name, "Proposta editada");
  assert.deepEqual(input.business.name, brasaBurgerDefaultDocument.business.name);
});

test("rejects arbitrary, unknown-template, invalid-version and broken-reference documents before creation", async () => {
  const { service } = memory();
  for (const mutate of [
    (doc: ReturnType<typeof document>) => { doc.template.id = "desconhecido" as typeof doc.template.id; },
    (doc: ReturnType<typeof document>) => { doc.schemaVersion = 99 as typeof doc.schemaVersion; },
    (doc: ReturnType<typeof document>) => { doc.content.menu.products[0].categoryId = "categoria-ausente"; },
    (doc: ReturnType<typeof document>) => { doc.content.menu.products[0].priceCents = -1; },
  ]) { const doc = document(); mutate(doc); await assert.rejects(service.create({ name: "Teste", document: doc }, alice), z.ZodError); }
  await assert.rejects(service.create({ name: "Teste", document: { arbitrary: true } }, alice), z.ZodError);
  await assert.rejects(service.create({ name: "Teste", document: document(), userId: bob }, alice), z.ZodError);
  for (const name of ["blob:http://localhost:3000/file", "data:image/png;base64,YQ=="]) await assert.rejects(service.create({ name, document: document() }, alice), z.ZodError);
  assert.deepEqual(await service.list(alice), []);
});

test("all document image locations reject upload references, including hidden sections and SEO", () => {
  const ref = { source: "upload" as const, assetId: "persisted-looking-id", alt: "Imagem" };
  for (const mutate of [
    (doc: ReturnType<typeof document>) => { doc.seo.socialImage = ref; },
    (doc: ReturnType<typeof document>) => { doc.content.hero.image = ref; doc.sections.hero = false; },
    (doc: ReturnType<typeof document>) => { doc.content.story.featured.image = ref; },
    (doc: ReturnType<typeof document>) => { doc.content.location.image = ref; },
    (doc: ReturnType<typeof document>) => { doc.content.menu.products[0].image = ref; },
  ]) { const doc = document(); mutate(doc); assert.equal(persistablePrototypeDocumentSchema.safeParse(doc).success, false); }
});

test("ordinary Portuguese date labels are valid copy, not data URLs", () => {
  const doc = document(); doc.content.hero.description[0] = "Data: 20/10, venha conhecer a casa.";
  assert.equal(persistablePrototypeDocumentSchema.safeParse(doc).success, true);
});

test("save rejects temporary images and blob/data URLs without changing the stored draft", async () => {
  const { service } = memory(); const created = await service.create({ name: "Teste", document: document() }, alice);
  for (const mutate of [
    (doc: ReturnType<typeof document>) => { doc.content.hero.image = { source: "upload", assetId: "local-file", alt: "Foto" }; },
    (doc: ReturnType<typeof document>) => { doc.contact.mapsUrl = "blob:http://localhost:3000/abc"; },
    (doc: ReturnType<typeof document>) => { doc.contact.instagramUrl = "data:image/png;base64,YQ=="; },
    (doc: ReturnType<typeof document>) => { doc.content.hero.description[0] = "data:image/png;base64,YQ=="; },
  ]) { const doc = document(); mutate(doc); await assert.rejects(service.updateDraft({ id: created.id, expectedRevision: 0, name: "Teste", document: doc }, alice), z.ZodError); }
  assert.deepEqual(await service.findById(created.id, alice), created);
});

test("all reads, updates and version operations isolate users without leaking foreign prototypes", async () => {
  const { service } = memory();
  const owned = await service.create({ name: "Privado", document: document() }, alice);
  const version = await service.createVersion({ id: owned.id, expectedRevision: 0 }, alice);
  assert.deepEqual(await service.list(bob), []);
  for (const operation of [
    () => service.findById(owned.id, bob),
    () => service.updateDraft({ id: owned.id, expectedRevision: 0, name: "Ataque", document: document() }, bob),
    () => service.createVersion({ id: owned.id, expectedRevision: 0 }, bob),
    () => service.listVersions(owned.id, bob),
    () => service.findVersion(owned.id, version.id, bob),
  ]) await assert.rejects(operation(), { code: "NOT_FOUND" });
  assert.equal((await service.findById(owned.id, alice)).name, "Privado");
});

test("optional lead association only accepts the user's own lead", async () => {
  const { service, leads } = memory(); const id = randomUUID(); leads.push({ id, userId: alice });
  await service.create({ name: "Com lead", leadId: id, document: document() }, alice);
  await assert.rejects(service.create({ name: "Outro lead", leadId: id, document: document() }, bob), { code: "NOT_FOUND" });
  assert.deepEqual(await service.list(bob), []);
});

test("optimistic revision rejects stale saves and exactly one simultaneous save succeeds", async () => {
  const { service } = memory(); const owned = await service.create({ name: "Teste", document: document() }, alice);
  const payload = { id: owned.id, expectedRevision: 0, name: "Salvo", document: document() };
  const results = await Promise.allSettled([service.updateDraft(payload, alice), service.updateDraft({ ...payload, name: "Outra aba" }, alice)]);
  assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
  const rejected = results.find(result => result.status === "rejected") as PromiseRejectedResult;
  assert.ok(rejected.reason instanceof PrototypeError); assert.equal(rejected.reason.code, "CONFLICT");
  assert.equal((await service.findById(owned.id, alice)).draftRevision, 1);
  await assert.rejects(service.createVersion({ id: owned.id, expectedRevision: 0 }, alice), { code: "CONFLICT" });
});

test("concurrent version requests receive sequential numbers and leave the draft revision unchanged", async () => {
  const { service } = memory(); const owned = await service.create({ name: "Teste", document: document() }, alice);
  const versions = await Promise.all(Array.from({ length: 8 }, () => service.createVersion({ id: owned.id, expectedRevision: 0 }, alice)));
  assert.deepEqual(versions.map(version => version.number).sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal((await service.findById(owned.id, alice)).draftRevision, 0);
  assert.equal((await service.listVersions(owned.id, alice)).length, 8);
});

test("versions are independent snapshots and viewing an older version does not restore the draft", async () => {
  const { service } = memory(); const owned = await service.create({ name: "Teste", document: document() }, alice);
  const first = await service.createVersion({ id: owned.id, expectedRevision: 0 }, alice);
  const changed = document(); changed.business.name = "Nova identidade";
  await service.updateDraft({ id: owned.id, expectedRevision: 0, name: "Teste", document: changed }, alice);
  const second = await service.createVersion({ id: owned.id, expectedRevision: 1 }, alice);
  const older = await service.findVersion(owned.id, first.id, alice);
  assert.equal(older.document.business.name, brasaBurgerDefaultDocument.business.name);
  older.document.business.name = "Tentativa de mutação no retorno";
  assert.equal((await service.findVersion(owned.id, first.id, alice)).document.business.name, brasaBurgerDefaultDocument.business.name);
  assert.equal((await service.findVersion(owned.id, second.id, alice)).document.business.name, "Nova identidade");
  assert.equal((await service.findById(owned.id, alice)).draftDocument.business.name, "Nova identidade");
});

test("failed version validation rolls the sequence back instead of committing a partial version", async () => {
  const { service, getRows } = memory(); const owned = await service.create({ name: "Teste", document: document() }, alice);
  getRows()[0].draftDocument = { invalid: true };
  await assert.rejects(service.createVersion({ id: owned.id, expectedRevision: 0 }, alice), z.ZodError);
  assert.equal(getRows()[0].versionSequence, 0);
  getRows()[0].draftDocument = document();
  assert.equal((await service.createVersion({ id: owned.id, expectedRevision: 0 }, alice)).number, 1);
});
