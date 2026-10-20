import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../../generated/prisma/client";
import { PrototypeService } from "./prototype.service";
import { brasaBurgerDefaultDocument } from "../../components/prototypes/templates/hamburgueria/data/default-document";

const url = process.env.PROTOTYPE_TEST_DATABASE_URL;
test("PostgreSQL: transactions, isolation, concurrent revisions/versions and database immutability", { skip: !url ? "Set PROTOTYPE_TEST_DATABASE_URL to a migrated, disposable PostgreSQL database." : false }, async () => {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  const service = new PrototypeService(db);
  const ids = [randomUUID(), randomUUID()];
  try {
    await db.user.createMany({ data: ids.map(id => ({ id, name: "Prototype integration test", email: `prototype-test-${id}@example.invalid`, passwordHash: "test-only" })) });
    const prototype = await service.create({ name: "Integration", document: brasaBurgerDefaultDocument }, ids[0]);
    const leadCategory = await db.category.create({ data: { name: `prototype-test-${randomUUID()}` } });
    try {
      const lead = await db.lead.create({ data: { userId: ids[0], categoryId: leadCategory.id, name: "Test lead", source: "MANUAL" } });
      await assert.rejects(service.create({ name: "Wrong lead owner", document: brasaBurgerDefaultDocument, leadId: lead.id }, ids[1]));
      await service.create({ name: "Owned lead", document: brasaBurgerDefaultDocument, leadId: lead.id }, ids[0]);
      await db.lead.delete({ where: { id: lead.id } });
    } finally {
      await db.lead.deleteMany({ where: { categoryId: leadCategory.id, userId: { in: ids } } });
      await db.category.delete({ where: { id: leadCategory.id } });
    }
    await assert.rejects(service.findById(prototype.id, ids[1]), { code: "NOT_FOUND" });
    assert.deepEqual(await service.list(ids[1]), []);
    const save = { id: prototype.id, expectedRevision: 0, name: "Saved", document: brasaBurgerDefaultDocument };
    const saves = await Promise.allSettled([service.updateDraft(save, ids[0]), service.updateDraft(save, ids[0])]);
    assert.equal(saves.filter(result => result.status === "fulfilled").length, 1);
    assert.equal((await service.findById(prototype.id, ids[0])).draftRevision, 1);
    await assert.rejects(service.updateDraft({ ...save, expectedRevision: 1 }, ids[1]), { code: "NOT_FOUND" });
    const versions = await Promise.all(Array.from({ length: 5 }, () => service.createVersion({ id: prototype.id, expectedRevision: 1 }, ids[0])));
    assert.deepEqual(versions.map(version => version.number).sort((a, b) => a - b), [1, 2, 3, 4, 5]);
    await assert.rejects(service.listVersions(prototype.id, ids[1]), { code: "NOT_FOUND" });
    await assert.rejects(service.findVersion(prototype.id, versions[0].id, ids[1]), { code: "NOT_FOUND" });
    await assert.rejects(db.prototypeVersion.update({ where: { id: versions[0].id }, data: { document: { invalid: true } } }));
    const changed = structuredClone(brasaBurgerDefaultDocument); changed.business.name = "Changed after version";
    await service.updateDraft({ ...save, expectedRevision: 1, document: changed }, ids[0]);
    assert.equal((await service.findVersion(prototype.id, versions[0].id, ids[0])).document.business.name, brasaBurgerDefaultDocument.business.name);
    const bad = structuredClone(changed); bad.content.hero.image = { source: "upload", assetId: "local-test", alt: "Test" };
    await assert.rejects(service.updateDraft({ ...save, expectedRevision: 2, document: bad }, ids[0]));
    assert.equal((await service.findById(prototype.id, ids[0])).draftDocument.business.name, changed.business.name);
  } finally {
    await db.user.deleteMany({ where: { id: { in: ids } } });
    await db.$disconnect();
  }
});
