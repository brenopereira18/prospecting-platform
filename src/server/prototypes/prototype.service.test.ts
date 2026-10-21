import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { z } from "zod";
import type {
  PrismaClient,
  Prisma,
  Prototype,
  PrototypeVersion,
} from "../../../generated/prisma/client";
import { PrototypeService, PrototypeError } from "./prototype.service";
import { brasaBurgerDefaultDocument } from "../../components/prototypes/templates/hamburgueria/data/default-document";
import { persistablePrototypeDocumentSchema } from "../../components/prototypes/schemas/persistable-document.schema";

const alice = randomUUID();
const bob = randomUUID();
const document = () => structuredClone(brasaBurgerDefaultDocument);
type Where = {
  id?: string;
  userId?: string;
  draftRevision?: number;
  leadId?: string;
};

/** A transactional test double, not a substitute for PostgreSQL integration tests. */
function memory() {
  const assets: { id: string; userId: string; prototypeId: string | null; width: number; height: number; deletionRequestedAt: Date | null; deletedAt: Date | null }[] = [];
  let rows: Prototype[] = [];
  let versions: PrototypeVersion[] = [];
  const leads: {
    id: string;
    userId: string;
    categoryKey?: string | null;
    name?: string;
  }[] = [];
  const match = (row: Prototype, where: Where) =>
    Object.entries(where).every(
      ([key, value]) => row[key as keyof Prototype] === value,
    );
  let tail = Promise.resolve();
  const db = {
    prototypeAsset: {
      findMany: async ({ where }: { where: { id: { in: string[] }; userId: string; prototypeId: string } }) => assets.filter(asset =>
        where.id.in.includes(asset.id) && asset.userId === where.userId && asset.prototypeId === where.prototypeId && !asset.deletionRequestedAt && !asset.deletedAt &&
        rows.some(row => row.id === asset.prototypeId && row.userId === where.userId)),
    },
    $queryRaw: async () => [],
    lead: {
      findFirst: async ({
        where,
      }: {
        where: { id: string; userId: string };
      }) => {
        const lead = leads.find(
          (lead) => lead.id === where.id && lead.userId === where.userId,
        );
        return lead
          ? {
              ...lead,
              name: lead.name ?? "Burger do lead",
              address: "Rua cadastrada, 20",
              phone: "11999998888",
              rating: 4.2,
              userRatingCount: 50,
              category: {
                name: "Nome editável",
                prototypeCategoryKey:
                  lead.categoryKey === undefined
                    ? "hamburgueria"
                    : lead.categoryKey,
              },
            }
          : null;
      },
    },
    prototype: {
      create: async ({
        data,
      }: {
        data: Pick<
          Prototype,
          "userId" | "name" | "templateId" | "templateVersion" | "draftDocument"
        > & { leadId?: string };
      }) => {
        const row: Prototype = {
          ...structuredClone(data),
          id: randomUUID(),
          leadId: data.leadId ?? null,
          draftRevision: 0,
          versionSequence: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        rows.push(row);
        return structuredClone(row);
      },
      findFirst: async ({ where }: { where: Where }) =>
        structuredClone(rows.find((row) => match(row, where)) ?? null),
      findFirstOrThrow: async ({ where }: { where: Where }) => {
        const row = rows.find((row) => match(row, where));
        if (!row) throw new Error("Missing row");
        return structuredClone(row);
      },
      findMany: async ({ where }: { where: Where }) =>
        structuredClone(rows.filter((row) => match(row, where))),
      count: async ({ where }: { where: Where }) =>
        rows.filter((row) => match(row, where)).length,
      deleteMany: async ({ where }: { where: Where }) => {
        const ids = new Set(
          rows.filter((row) => match(row, where)).map((row) => row.id),
        );
        rows = rows.filter((row) => !ids.has(row.id));
        versions = versions.filter((version) => !ids.has(version.prototypeId));
        return { count: ids.size };
      },
      updateMany: async ({
        where,
        data,
      }: {
        where: Where;
        data: Record<string, unknown>;
      }) => {
        const row = rows.find((row) => match(row, where));
        if (!row) return { count: 0 };
        for (const [key, value] of Object.entries(data)) {
          const record = row as unknown as Record<string, unknown>;
          record[key] =
            value && typeof value === "object" && "increment" in value
              ? Number(record[key]) + Number(value.increment)
              : structuredClone(value);
        }
        row.updatedAt = new Date();
        return { count: 1 };
      },
    },
    prototypeVersion: {
      create: async ({
        data,
      }: {
        data: Pick<PrototypeVersion, "prototypeId" | "number" | "document">;
      }) => {
        if (
          versions.some(
            (version) =>
              version.prototypeId === data.prototypeId &&
              version.number === data.number,
          )
        )
          throw new Error("Duplicate version number");
        const row = {
          ...structuredClone(data),
          id: randomUUID(),
          createdAt: new Date(),
        };
        versions.push(row);
        return structuredClone(row);
      },
      findMany: async ({
        where,
      }: {
        where: { prototypeId: string; prototype: { userId: string } };
      }) =>
        structuredClone(
          versions
            .filter(
              (version) =>
                version.prototypeId === where.prototypeId &&
                rows.some(
                  (row) =>
                    row.id === version.prototypeId &&
                    row.userId === where.prototype.userId,
                ),
            )
            .sort((a, b) => b.number - a.number)
            .map((version) => ({
              id: version.id,
              prototypeId: version.prototypeId,
              number: version.number,
              createdAt: version.createdAt,
            })),
        ),
      findFirst: async ({
        where,
      }: {
        where: {
          id: string;
          prototypeId: string;
          prototype: { userId: string };
        };
      }) =>
        structuredClone(
          versions.find(
            (version) =>
              version.id === where.id &&
              version.prototypeId === where.prototypeId &&
              rows.some(
                (row) =>
                  row.id === version.prototypeId &&
                  row.userId === where.prototype.userId,
              ),
          ) ?? null,
        ),
    },
    $transaction: async <T>(
      work: (tx: Prisma.TransactionClient) => Promise<T>,
    ) => {
      const previous = tail;
      let release!: () => void;
      tail = new Promise((resolve) => {
        release = resolve;
      });
      await previous;
      const before = structuredClone({ rows, versions });
      try {
        return await work(db as unknown as Prisma.TransactionClient);
      } catch (cause) {
        rows = before.rows;
        versions = before.versions;
        throw cause;
      } finally {
        release();
      }
    },
  };
  return {
    service: new PrototypeService(db as unknown as PrismaClient),
    leads,
    assets,
    getRows: () => rows,
  };
}

test("creates, saves, lists and retrieves validated documents with schema and template versions", async () => {
  const { service } = memory();
  const input = document();
  input.template.version = 2;
  const created = await service.create(
    { name: "  Proposta Bairro  ", document: input },
    alice,
  );
  assert.equal(created.name, "Proposta Bairro");
  assert.equal(created.draftRevision, 0);
  assert.equal(created.templateVersion, 2);
  assert.equal(created.draftDocument.schemaVersion, 1);
  const changed = document();
  changed.business.name = "Hamburgueria personalizada";
  changed.template.version = 2;
  const saved = await service.updateDraft(
    {
      id: created.id,
      expectedRevision: 0,
      name: "Proposta editada",
      document: changed,
    },
    alice,
  );
  assert.equal(saved.draftRevision, 1);
  assert.deepEqual(await service.findById(created.id, alice), saved);
  assert.equal((await service.list(alice))[0].name, "Proposta editada");
  assert.deepEqual(
    input.business.name,
    brasaBurgerDefaultDocument.business.name,
  );
});

test("draft save and reopen preserve all chosen colors and keep version palettes immutable", async () => {
  const { service } = memory();
  const created = await service.create(
    { name: "Cores editáveis", document: document() },
    alice,
  );
  const changed = document();
  changed.appearance.colors = {
    primary: "#123abc",
    secondary: "#fff",
    tertiary: "#121212",
  };
  const snapshot = await service.createVersion(
    { id: created.id, expectedRevision: 0 },
    alice,
  );
  const saved = await service.updateDraft(
    {
      id: created.id,
      expectedRevision: 0,
      name: created.name,
      document: changed,
    },
    alice,
  );
  const reopened = await service.findById(created.id, alice);
  assert.deepEqual(
    reopened.draftDocument.appearance.colors,
    changed.appearance.colors,
  );
  assert.deepEqual(reopened.draftDocument, changed);
  assert.equal(saved.draftRevision, 1);
  assert.deepEqual(
    (await service.findVersion(created.id, snapshot.id, alice)).document
      .appearance.colors,
    brasaBurgerDefaultDocument.appearance.colors,
  );
});

test("rejects arbitrary, unknown-template, invalid-version and broken-reference documents before creation", async () => {
  const { service } = memory();
  for (const mutate of [
    (doc: ReturnType<typeof document>) => {
      doc.template.id = "desconhecido" as typeof doc.template.id;
    },
    (doc: ReturnType<typeof document>) => {
      doc.schemaVersion = 99 as typeof doc.schemaVersion;
    },
    (doc: ReturnType<typeof document>) => {
      doc.content.menu.products[0].categoryId = "categoria-ausente";
    },
    (doc: ReturnType<typeof document>) => {
      doc.content.menu.products[0].priceCents = -1;
    },
  ]) {
    const doc = document();
    mutate(doc);
    await assert.rejects(
      service.create({ name: "Teste", document: doc }, alice),
      z.ZodError,
    );
  }
  await assert.rejects(
    service.create({ name: "Teste", document: { arbitrary: true } }, alice),
    z.ZodError,
  );
  await assert.rejects(
    service.create({ name: "Teste", document: document(), userId: bob }, alice),
    z.ZodError,
  );
  for (const name of [
    "blob:http://localhost:3000/file",
    "data:image/png;base64,YQ==",
  ])
    await assert.rejects(
      service.create({ name, document: document() }, alice),
      z.ZodError,
    );
  assert.deepEqual(await service.list(alice), []);
});

test("all document image locations reject upload references, including hidden sections and SEO", () => {
  const ref = {
    source: "upload" as const,
    assetId: "persisted-looking-id",
    alt: "Imagem",
  };
  for (const mutate of [
    (doc: ReturnType<typeof document>) => {
      doc.seo.socialImage = ref;
    },
    (doc: ReturnType<typeof document>) => {
      doc.content.hero.image = ref;
      doc.sections.hero = false;
    },
    (doc: ReturnType<typeof document>) => {
      doc.content.story.featured.image = ref;
    },
    (doc: ReturnType<typeof document>) => {
      doc.content.location.image = ref;
    },
    (doc: ReturnType<typeof document>) => {
      doc.content.menu.products[0].image = ref;
    },
  ]) {
    const doc = document();
    mutate(doc);
    assert.equal(
      persistablePrototypeDocumentSchema.safeParse(doc).success,
      false,
    );
  }
});

test("ordinary Portuguese date labels are valid copy, not data URLs", () => {
  const doc = document();
  doc.content.hero.description[0] = "Data: 20/10, venha conhecer a casa.";
  assert.equal(persistablePrototypeDocumentSchema.safeParse(doc).success, true);
});

test("lead generation requires configuration and rejects old direct-creation requests without persisting", async () => {
  const { service, leads } = memory();
  const leadId = randomUUID();
  leads.push({ id: leadId, userId: alice });
  await assert.rejects(
    service.createFromLead(
      {
        leadId,
        name: "Sem formulário",
        templateId: "brasa-burger",
        expectedPrototypeCount: 0,
      },
      alice,
    ),
    z.ZodError,
  );
  assert.deepEqual(await service.list(alice), []);
});

test("deletion removes the owned draft and its versions while preserving the lead and other prototypes", async () => {
  const { service, leads } = memory();
  const leadId = randomUUID();
  leads.push({ id: leadId, userId: alice });
  const owned = await service.create(
    { name: "Excluir", leadId, document: document() },
    alice,
  );
  const other = await service.create(
    { name: "Manter", document: document() },
    alice,
  );
  const version = await service.createVersion(
    { id: owned.id, expectedRevision: 0 },
    alice,
  );
  assert.deepEqual(
    await service.delete({ id: owned.id, expectedRevision: 0 }, alice),
    { id: owned.id, leadId },
  );
  await assert.rejects(service.findById(owned.id, alice), {
    code: "NOT_FOUND",
  });
  await assert.rejects(service.findVersion(owned.id, version.id, alice), {
    code: "NOT_FOUND",
  });
  assert.equal((await service.findById(other.id, alice)).name, "Manter");
  assert.equal(leads[0].id, leadId);
});

test("deletion rejects foreign prototypes, malformed input, missing IDs and stale revisions", async () => {
  const { service } = memory();
  const owned = await service.create(
    { name: "Privado", document: document() },
    alice,
  );
  await assert.rejects(
    service.delete({ id: owned.id, expectedRevision: 0 }, bob),
    { code: "NOT_FOUND" },
  );
  await assert.rejects(
    service.delete({ id: randomUUID(), expectedRevision: 0 }, alice),
    { code: "NOT_FOUND" },
  );
  await assert.rejects(
    service.delete({ id: "invalid", expectedRevision: 0 }, alice),
    z.ZodError,
  );
  await assert.rejects(
    service.delete({ id: owned.id, expectedRevision: 0, userId: alice }, bob),
    z.ZodError,
  );
  await service.updateDraft(
    {
      id: owned.id,
      expectedRevision: 0,
      name: "Revisão nova",
      document: document(),
    },
    alice,
  );
  await assert.rejects(
    service.delete({ id: owned.id, expectedRevision: 0 }, alice),
    { code: "CONFLICT" },
  );
  assert.equal((await service.findById(owned.id, alice)).name, "Revisão nova");
  const results = await Promise.allSettled([
    service.delete({ id: owned.id, expectedRevision: 1 }, alice),
    service.delete({ id: owned.id, expectedRevision: 1 }, alice),
  ]);
  assert.equal(
    results.filter((result) => result.status === "fulfilled").length,
    1,
  );
});

test("save rejects temporary images and blob/data URLs without changing the stored draft", async () => {
  const { service } = memory();
  const created = await service.create(
    { name: "Teste", document: document() },
    alice,
  );
  for (const mutate of [
    (doc: ReturnType<typeof document>) => {
      doc.content.hero.image = {
        source: "upload",
        assetId: "local-file",
        alt: "Foto",
      };
    },
    (doc: ReturnType<typeof document>) => {
      doc.contact.mapsUrl = "blob:http://localhost:3000/abc";
    },
    (doc: ReturnType<typeof document>) => {
      doc.contact.instagramUrl = "data:image/png;base64,YQ==";
    },
    (doc: ReturnType<typeof document>) => {
      doc.content.hero.description[0] = "data:image/png;base64,YQ==";
    },
  ]) {
    const doc = document();
    mutate(doc);
    await assert.rejects(
      service.updateDraft(
        { id: created.id, expectedRevision: 0, name: "Teste", document: doc },
        alice,
      ),
      z.ZodError,
    );
  }
  assert.deepEqual(await service.findById(created.id, alice), created);
});

test("all reads, updates and version operations isolate users without leaking foreign prototypes", async () => {
  const { service } = memory();
  const owned = await service.create(
    { name: "Privado", document: document() },
    alice,
  );
  const version = await service.createVersion(
    { id: owned.id, expectedRevision: 0 },
    alice,
  );
  assert.deepEqual(await service.list(bob), []);
  for (const operation of [
    () => service.findById(owned.id, bob),
    () =>
      service.updateDraft(
        {
          id: owned.id,
          expectedRevision: 0,
          name: "Ataque",
          document: document(),
        },
        bob,
      ),
    () => service.createVersion({ id: owned.id, expectedRevision: 0 }, bob),
    () => service.listVersions(owned.id, bob),
    () => service.findVersion(owned.id, version.id, bob),
  ])
    await assert.rejects(operation(), { code: "NOT_FOUND" });
  assert.equal((await service.findById(owned.id, alice)).name, "Privado");
});

test("optional lead association only accepts the user's own lead", async () => {
  const { service, leads } = memory();
  const id = randomUUID();
  leads.push({ id, userId: alice });
  await service.create(
    { name: "Com lead", leadId: id, document: document() },
    alice,
  );
  await assert.rejects(
    service.create(
      { name: "Outro lead", leadId: id, document: document() },
      bob,
    ),
    { code: "NOT_FOUND" },
  );
  assert.deepEqual(await service.list(bob), []);
});

test("optimistic revision rejects stale saves and exactly one simultaneous save succeeds", async () => {
  const { service } = memory();
  const owned = await service.create(
    { name: "Teste", document: document() },
    alice,
  );
  const payload = {
    id: owned.id,
    expectedRevision: 0,
    name: "Salvo",
    document: document(),
  };
  const results = await Promise.allSettled([
    service.updateDraft(payload, alice),
    service.updateDraft({ ...payload, name: "Outra aba" }, alice),
  ]);
  assert.equal(
    results.filter((result) => result.status === "fulfilled").length,
    1,
  );
  const rejected = results.find(
    (result) => result.status === "rejected",
  ) as PromiseRejectedResult;
  assert.ok(rejected.reason instanceof PrototypeError);
  assert.equal(rejected.reason.code, "CONFLICT");
  assert.equal((await service.findById(owned.id, alice)).draftRevision, 1);
  await assert.rejects(
    service.createVersion({ id: owned.id, expectedRevision: 0 }, alice),
    { code: "CONFLICT" },
  );
});

test("concurrent version requests receive sequential numbers and leave the draft revision unchanged", async () => {
  const { service } = memory();
  const owned = await service.create(
    { name: "Teste", document: document() },
    alice,
  );
  const versions = await Promise.all(
    Array.from({ length: 8 }, () =>
      service.createVersion({ id: owned.id, expectedRevision: 0 }, alice),
    ),
  );
  assert.deepEqual(
    versions.map((version) => version.number).sort((a, b) => a - b),
    [1, 2, 3, 4, 5, 6, 7, 8],
  );
  assert.equal((await service.findById(owned.id, alice)).draftRevision, 0);
  assert.equal((await service.listVersions(owned.id, alice)).length, 8);
});

test("versions are independent snapshots and viewing an older version does not restore the draft", async () => {
  const { service } = memory();
  const owned = await service.create(
    { name: "Teste", document: document() },
    alice,
  );
  const first = await service.createVersion(
    { id: owned.id, expectedRevision: 0 },
    alice,
  );
  const changed = document();
  changed.business.name = "Nova identidade";
  await service.updateDraft(
    { id: owned.id, expectedRevision: 0, name: "Teste", document: changed },
    alice,
  );
  const second = await service.createVersion(
    { id: owned.id, expectedRevision: 1 },
    alice,
  );
  const older = await service.findVersion(owned.id, first.id, alice);
  assert.equal(
    older.document.business.name,
    brasaBurgerDefaultDocument.business.name,
  );
  older.document.business.name = "Tentativa de mutação no retorno";
  assert.equal(
    (await service.findVersion(owned.id, first.id, alice)).document.business
      .name,
    brasaBurgerDefaultDocument.business.name,
  );
  assert.equal(
    (await service.findVersion(owned.id, second.id, alice)).document.business
      .name,
    "Nova identidade",
  );
  assert.equal(
    (await service.findById(owned.id, alice)).draftDocument.business.name,
    "Nova identidade",
  );
});

test("failed version validation rolls the sequence back instead of committing a partial version", async () => {
  const { service, getRows } = memory();
  const owned = await service.create(
    { name: "Teste", document: document() },
    alice,
  );
  getRows()[0].draftDocument = { invalid: true };
  await assert.rejects(
    service.createVersion({ id: owned.id, expectedRevision: 0 }, alice),
    z.ZodError,
  );
  assert.equal(getRows()[0].versionSequence, 0);
  getRows()[0].draftDocument = document();
  assert.equal(
    (await service.createVersion({ id: owned.id, expectedRevision: 0 }, alice))
      .number,
    1,
  );
});

test("generates from an owned lead, associates it and personalizes the persisted document", async () => {
  const { service, leads } = memory();
  const leadId = randomUUID();
  leads.push({ id: leadId, userId: alice, name: "Burger Central" });
  const options = await service.leadCreationOptions(leadId, alice);
  assert.equal(options.templates[0].id, "brasa-burger");
  assert.equal(options.prototypes.length, 0);
  const result = await service.createFromLead(
    {
      leadId,
      name: "Proposta Central",
      templateId: "brasa-burger",
      expectedPrototypeCount: 0,
      configuration: options.configuration,
    },
    alice,
  );
  assert.equal(result.leadId, leadId);
  assert.equal(result.draftDocument.business.name, "Burger Central");
  assert.equal(result.draftDocument.contact.phone, "5511999998888");
  assert.deepEqual(
    (await service.findById(result.id, alice)).draftDocument,
    result.draftDocument,
  );
  assert.equal(
    (await service.leadCreationOptions(leadId, alice)).prototypes[0].id,
    result.id,
  );
});

test("lead generation and options reject foreign leads; template compatibility is enforced server-side", async () => {
  const { service, leads } = memory();
  const leadId = randomUUID();
  leads.push({ id: leadId, userId: alice });
  const { configuration } = await service.leadCreationOptions(leadId, alice);
  const input = {
    leadId,
    name: "Proposta",
    templateId: "brasa-burger",
    expectedPrototypeCount: 0,
    configuration,
  };
  await assert.rejects(service.leadCreationOptions(leadId, bob), {
    code: "NOT_FOUND",
  });
  await assert.rejects(service.createFromLead(input, bob), {
    code: "NOT_FOUND",
  });
  await assert.rejects(
    service.createFromLead({ ...input, templateId: "outro" }, alice),
    { code: "INVALID_INPUT" },
  );
  await assert.rejects(
    service.createFromLead({ ...input, userId: alice }, bob),
    z.ZodError,
  );
  leads[0].categoryKey = null;
  assert.deepEqual(
    (await service.leadCreationOptions(leadId, alice)).templates,
    [],
  );
  await assert.rejects(service.createFromLead(input, alice), {
    code: "INVALID_INPUT",
  });
  await assert.rejects(
    service.create({ name: "Bypass", leadId, document: document() }, alice),
    { code: "INVALID_INPUT" },
  );
  assert.deepEqual(await service.list(alice), []);
});

test("double clicks serialize, existing prototypes require explicit intent, and repeated requests do not duplicate", async () => {
  const { service, leads } = memory();
  const leadId = randomUUID();
  leads.push({ id: leadId, userId: alice });
  const { configuration } = await service.leadCreationOptions(leadId, alice);
  const input = {
    leadId,
    name: "Proposta",
    templateId: "brasa-burger",
    expectedPrototypeCount: 0,
    configuration,
  };
  const results = await Promise.allSettled([
    service.createFromLead(input, alice),
    service.createFromLead(input, alice),
  ]);
  assert.equal(
    results.filter((result) => result.status === "fulfilled").length,
    1,
  );
  await assert.rejects(
    service.createFromLead({ ...input, expectedPrototypeCount: 1 }, alice),
    { code: "CONFLICT" },
  );
  await assert.rejects(
    service.create({ name: "Bypass", leadId, document: document() }, alice),
    { code: "CONFLICT" },
  );
  const another = { ...input, expectedPrototypeCount: 1, createAnother: true };
  await service.createFromLead(another, alice);
  await assert.rejects(service.createFromLead(another, alice), {
    code: "CONFLICT",
  });
  assert.equal(
    (await service.leadCreationOptions(leadId, alice)).prototypes.length,
    2,
  );
  assert.equal((await service.list(alice)).length, 2);
});

test("configuration persists submitted changes without modifying the source lead or creating on load", async () => {
  const { service, leads } = memory();
  const leadId = randomUUID();
  leads.push({ id: leadId, userId: alice, name: "Nome do cadastro" });
  const options = await service.leadCreationOptions(leadId, alice);
  assert.equal(options.configuration.businessName, "Nome do cadastro");
  assert.deepEqual(await service.list(alice), []);
  const configuration = structuredClone(options.configuration);
  configuration.businessName = "Nome da página";
  configuration.tagline = "Slogan informado";
  configuration.contact.whatsapp = "11988887777";
  configuration.address.city = "São Paulo";
  configuration.address.state = "SP";
  configuration.headline = "SABOR DO BAIRRO\nDO SEU JEITO";
  configuration.hamburgueria = {
    modes: { delivery: true, pickup: false, dineIn: false },
    hoursSummary: "Quinta a domingo, das 18h às 23h",
    deliveryRegion: "Centro e bairros próximos",
  };
  const input = {
    leadId,
    name: "Proposta",
    templateId: "brasa-burger",
    expectedPrototypeCount: 0,
    configuration,
  };
  const created = await service.createFromLead(input, alice);
  assert.equal(created.draftDocument.business.name, "Nome da página");
  assert.equal(created.draftDocument.business.tagline, "Slogan informado");
  assert.equal(created.draftDocument.contact.whatsapp, "5511988887777");
  assert.equal(created.draftDocument.business.address.city, "São Paulo");
  assert.deepEqual(
    created.draftDocument.content.menu,
    brasaBurgerDefaultDocument.content.menu,
  );
  assert.deepEqual(
    created.draftDocument.sections,
    brasaBurgerDefaultDocument.sections,
  );
  assert.deepEqual(created.draftDocument.content.reviews, {
    ...brasaBurgerDefaultDocument.content.reviews,
    rating: 4.2,
    count: 50,
    ratingSource: "lead",
    countSource: "lead",
  });
  assert.equal(leads[0].name, "Nome do cadastro");
  assert.equal((await service.list(alice))[0].businessName, "Nome da página");
  const reopened = await service.findById(created.id, alice);
  assert.equal(reopened.leadId, leadId);
  assert.deepEqual(reopened.draftDocument.content.hero.headline, [
    "SABOR DO BAIRRO",
    "DO SEU JEITO",
  ]);
  assert.deepEqual(
    reopened.draftDocument.content.service.modes,
    configuration.hamburgueria.modes,
  );
  assert.equal(
    reopened.draftDocument.content.footer.serviceLines[1],
    configuration.hamburgueria.hoursSummary,
  );
  assert.equal(
    reopened.draftDocument.content.service.delivery.neighborhoodsSummary,
    configuration.hamburgueria.deliveryRegion,
  );
  assert.deepEqual(reopened.draftDocument, created.draftDocument);
  await assert.rejects(
    service.createFromLead({ ...input, createAnother: true }, alice),
    { code: "CONFLICT" },
  );
});

test("server validates configuration fields before persisting and rejects forged ownership and ratings", async () => {
  const { service, leads } = memory();
  const leadId = randomUUID();
  leads.push({ id: leadId, userId: alice });
  const { configuration } = await service.leadCreationOptions(leadId, alice);
  const input = {
    leadId,
    name: "Proposta",
    templateId: "brasa-burger",
    expectedPrototypeCount: 0,
    configuration,
  };
  for (const changes of [
    { businessName: "" },
    { rating: 5 },
    { userId: bob },
    { headline: "x".repeat(61) },
    {
      hamburgueria: {
        modes: { delivery: false, pickup: false, dineIn: false },
      },
    },
    { contact: { ...configuration.contact, whatsapp: "123" } },
    { contact: { ...configuration.contact, mapsUrl: "javascript:alert(1)" } },
  ])
    await assert.rejects(
      service.createFromLead(
        { ...input, configuration: { ...configuration, ...changes } },
        alice,
      ),
      z.ZodError,
    );
  await assert.rejects(service.createFromLead(input, bob), {
    code: "NOT_FOUND",
  });
  assert.deepEqual(await service.list(alice), []);
});

test("registered images persist, reopen and remain referenced in immutable versions", async () => {
  const f = memory(); const prototype = await f.service.create({ name: "Fotos", document: document() }, alice);
  const id = randomUUID(); f.assets.push({ id, userId: alice, prototypeId: prototype.id, width: 4, height: 3, deletionRequestedAt: null, deletedAt: null });
  const edited = document(); edited.content.hero.image = { source: "upload", assetId: id, alt: "Foto do cliente", focalPoint: { x: 10, y: 70 } };
  const saved = await f.service.updateDraft({ id: prototype.id, expectedRevision: 0, name: "Fotos", document: edited }, alice);
  const reopened = await f.service.findById(prototype.id, alice); assert.deepEqual(reopened.draftDocument.content.hero.image, edited.content.hero.image);
  const version = await f.service.createVersion({ id: prototype.id, expectedRevision: saved.draftRevision }, alice);
  await f.service.updateDraft({ id: prototype.id, expectedRevision: 1, name: "Fotos", document: document() }, alice);
  assert.deepEqual((await f.service.findVersion(prototype.id, version.id, alice)).document.content.hero.image, edited.content.hero.image);
});

test("saving rejects foreign, cross-prototype, deleted and unknown permanent image IDs without advancing the draft", async () => {
  const f = memory(); const prototype = await f.service.create({ name: "Privado", document: document() }, alice);
  const other = await f.service.create({ name: "Outro", document: document() }, alice);
  for (const changes of [{ userId: bob }, { prototypeId: other.id }, { prototypeId: null }, { deletionRequestedAt: new Date() }, { deletedAt: new Date() }]) {
    const asset = { id: randomUUID(), userId: alice, prototypeId: prototype.id as string | null, width: 4, height: 3, deletionRequestedAt: null as Date | null, deletedAt: null as Date | null, ...changes };
    f.assets.push(asset); const edited = document(); edited.sections.hero = false;
    edited.seo.socialImage = { source: "upload", assetId: asset.id, alt: "Foto" };
    await assert.rejects(f.service.updateDraft({ id: prototype.id, expectedRevision: 0, name: "Privado", document: edited }, alice), z.ZodError);
    assert.equal((await f.service.findById(prototype.id, alice)).draftRevision, 0);
  }
  const unknown = document(); unknown.content.hero.image = { source: "upload", assetId: randomUUID(), alt: "Desconhecida" };
  await assert.rejects(f.service.updateDraft({ id: prototype.id, expectedRevision: 0, name: "Privado", document: unknown }, alice), z.ZodError);
});

test("version creation validates current asset authorization and rolls back sequence on failure", async () => {
  const f = memory(); const prototype = await f.service.create({ name: "Versões", document: document() }, alice);
  const asset = { id: randomUUID(), userId: alice, prototypeId: prototype.id, width: 4, height: 3, deletionRequestedAt: null as Date | null, deletedAt: null };
  f.assets.push(asset); const edited = document(); edited.content.hero.image = { source: "upload", assetId: asset.id, alt: "Foto" };
  await f.service.updateDraft({ id: prototype.id, expectedRevision: 0, name: "Versões", document: edited }, alice);
  asset.deletionRequestedAt = new Date();
  await assert.rejects(f.service.createVersion({ id: prototype.id, expectedRevision: 1 }, alice), z.ZodError);
  assert.equal(f.getRows()[0].versionSequence, 0);
});
