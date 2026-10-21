import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../../generated/prisma/client";
import { PrototypeService } from "./prototype.service";
import { brasaBurgerDefaultDocument } from "../../components/prototypes/templates/hamburgueria/data/default-document";

const url = process.env.PROTOTYPE_TEST_DATABASE_URL;
test(
  "PostgreSQL: transactions, isolation, concurrent revisions/versions and database immutability",
  {
    skip: !url
      ? "Set PROTOTYPE_TEST_DATABASE_URL to a migrated, disposable PostgreSQL database."
      : false,
  },
  async () => {
    const db = new PrismaClient({
      adapter: new PrismaPg({ connectionString: url }),
    });
    const service = new PrototypeService(db);
    const ids = [randomUUID(), randomUUID()];
    try {
      await db.user.createMany({
        data: ids.map((id) => ({
          id,
          name: "Prototype integration test",
          email: `prototype-test-${id}@example.invalid`,
          passwordHash: "test-only",
        })),
      });
      const prototype = await service.create(
        { name: "Integration", document: brasaBurgerDefaultDocument },
        ids[0],
      );
      const leadCategory = await db.category.create({
        data: {
          name: `prototype-test-${randomUUID()}`,
          prototypeCategoryKey: "hamburgueria",
        },
      });
      try {
        const lead = await db.lead.create({
          data: {
            userId: ids[0],
            categoryId: leadCategory.id,
            name: "Test lead",
            source: "MANUAL",
            rating: 4.3,
            userRatingCount: 127,
          },
        });
        await assert.rejects(
          service.create(
            {
              name: "Wrong lead owner",
              document: brasaBurgerDefaultDocument,
              leadId: lead.id,
            },
            ids[1],
          ),
        );
        const initialOptions = await service.leadCreationOptions(
          lead.id,
          ids[0],
        );
        const input = {
          name: "Owned lead",
          leadId: lead.id,
          templateId: "brasa-burger",
          expectedPrototypeCount: 0,
          configuration: initialOptions.configuration,
        };
        await assert.rejects(service.createFromLead(input, ids[1]), {
          code: "NOT_FOUND",
        });
        const concurrent = await Promise.allSettled([
          service.createFromLead(input, ids[0]),
          service.createFromLead(input, ids[0]),
        ]);
        assert.equal(
          concurrent.filter((result) => result.status === "fulfilled").length,
          1,
        );
        const options = await service.leadCreationOptions(lead.id, ids[0]);
        assert.equal(options.prototypes.length, 1);
        assert.equal(
          (await service.findById(options.prototypes[0].id, ids[0]))
            .draftDocument.business.name,
          lead.name,
        );
        const configuration = structuredClone(options.configuration);
        configuration.businessName = "Configured business";
        configuration.description = "Description supplied in the form.";
        configuration.contact.whatsapp = "11999998888";
        configuration.headline = "SABOR DO BAIRRO\nDO SEU JEITO";
        configuration.hamburgueria = {
          modes: { delivery: true, pickup: true, dineIn: false },
          hoursSummary: "Quinta a domingo, das 18h às 23h",
          deliveryRegion: "Centro e Santa Helena",
        };
        const configured = await service.createFromLead(
          {
            ...input,
            configuration,
            expectedPrototypeCount: 1,
            createAnother: true,
          },
          ids[0],
        );
        const reloaded = await service.findById(configured.id, ids[0]);
        assert.equal(
          reloaded.draftDocument.business.name,
          "Configured business",
        );
        assert.equal(reloaded.draftDocument.contact.whatsapp, "5511999998888");
        assert.equal(
          reloaded.draftDocument.content.location.description,
          configuration.description,
        );
        assert.deepEqual(reloaded.draftDocument.content.hero.headline, [
          "SABOR DO BAIRRO",
          "DO SEU JEITO",
        ]);
        assert.deepEqual(
          reloaded.draftDocument.content.service.modes,
          configuration.hamburgueria.modes,
        );
        assert.equal(
          reloaded.draftDocument.content.hero.hoursSummary,
          configuration.hamburgueria.hoursSummary,
        );
        assert.equal(
          reloaded.draftDocument.content.service.delivery.neighborhoodsSummary,
          configuration.hamburgueria.deliveryRegion,
        );
        assert.deepEqual(
          reloaded.draftDocument.content.menu,
          brasaBurgerDefaultDocument.content.menu,
        );
        assert.deepEqual(
          reloaded.draftDocument.sections,
          brasaBurgerDefaultDocument.sections,
        );
        assert.deepEqual(reloaded.draftDocument.content.reviews, {
          ...brasaBurgerDefaultDocument.content.reviews,
          rating: 4.3,
          count: 127,
          ratingSource: "lead",
          countSource: "lead",
        });
        const serviceQuestions = new Set(["entrega", "prazo", "reserva"]);
        assert.deepEqual(
          reloaded.draftDocument.content.faq.items.filter(
            (item) => !serviceQuestions.has(item.id),
          ),
          brasaBurgerDefaultDocument.content.faq.items.filter(
            (item) => !serviceQuestions.has(item.id),
          ),
        );
        assert.deepEqual(
          reloaded.draftDocument.content.faq.items.map((item) => item.id),
          brasaBurgerDefaultDocument.content.faq.items.map((item) => item.id),
        );
        assert.ok(
          reloaded.draftDocument.content.faq.items
            .find((item) => item.id === "entrega")!
            .answer.includes(configuration.hamburgueria.deliveryRegion),
        );
        assert.equal(
          (await db.lead.findUniqueOrThrow({ where: { id: lead.id } })).name,
          "Test lead",
        );
        const snapshot = await service.createVersion(
          { id: configured.id, expectedRevision: 0 },
          ids[0],
        );
        await assert.rejects(
          service.delete({ id: configured.id, expectedRevision: 0 }, ids[1]),
          { code: "NOT_FOUND" },
        );
        await service.delete(
          { id: configured.id, expectedRevision: 0 },
          ids[0],
        );
        assert.equal(
          await db.prototypeVersion.count({ where: { id: snapshot.id } }),
          0,
        );
        assert.equal(
          await db.prototype.count({ where: { id: configured.id } }),
          0,
        );
        assert.equal(
          (await db.lead.findUniqueOrThrow({ where: { id: lead.id } })).name,
          "Test lead",
        );
        await db.category.update({
          where: { id: leadCategory.id },
          data: { name: `renamed-${randomUUID()}` },
        });
        assert.equal(
          (await service.leadCreationOptions(lead.id, ids[0])).templates.length,
          1,
        );
        await db.category.update({
          where: { id: leadCategory.id },
          data: { prototypeCategoryKey: null },
        });
        assert.equal(
          (await service.leadCreationOptions(lead.id, ids[0])).templates.length,
          0,
        );
        await assert.rejects(
          service.createFromLead(
            { ...input, expectedPrototypeCount: 2, createAnother: true },
            ids[0],
          ),
          { code: "INVALID_INPUT" },
        );
        await db.lead.delete({ where: { id: lead.id } });
      } finally {
        await db.lead.deleteMany({
          where: { categoryId: leadCategory.id, userId: { in: ids } },
        });
        await db.category.delete({ where: { id: leadCategory.id } });
      }
      await assert.rejects(service.findById(prototype.id, ids[1]), {
        code: "NOT_FOUND",
      });
      assert.deepEqual(await service.list(ids[1]), []);
      const paletteDocument = structuredClone(brasaBurgerDefaultDocument);
      paletteDocument.appearance.colors = {
        primary: "#0044cc",
        secondary: "#fff",
        tertiary: "#121212",
      };
      const save = {
        id: prototype.id,
        expectedRevision: 0,
        name: "Saved",
        document: paletteDocument,
      };
      const saves = await Promise.allSettled([
        service.updateDraft(save, ids[0]),
        service.updateDraft(save, ids[0]),
      ]);
      assert.equal(
        saves.filter((result) => result.status === "fulfilled").length,
        1,
      );
      const reopened = await service.findById(prototype.id, ids[0]);
      assert.equal(reopened.draftRevision, 1);
      assert.deepEqual(
        reopened.draftDocument.appearance.colors,
        paletteDocument.appearance.colors,
      );
      await assert.rejects(
        service.updateDraft({ ...save, expectedRevision: 1 }, ids[1]),
        { code: "NOT_FOUND" },
      );
      const versions = await Promise.all(
        Array.from({ length: 5 }, () =>
          service.createVersion(
            { id: prototype.id, expectedRevision: 1 },
            ids[0],
          ),
        ),
      );
      assert.deepEqual(
        versions.map((version) => version.number).sort((a, b) => a - b),
        [1, 2, 3, 4, 5],
      );
      await assert.rejects(service.listVersions(prototype.id, ids[1]), {
        code: "NOT_FOUND",
      });
      await assert.rejects(
        service.findVersion(prototype.id, versions[0].id, ids[1]),
        { code: "NOT_FOUND" },
      );
      await assert.rejects(
        db.prototypeVersion.update({
          where: { id: versions[0].id },
          data: { document: { invalid: true } },
        }),
      );
      const changed = structuredClone(brasaBurgerDefaultDocument);
      changed.business.name = "Changed after version";
      await service.updateDraft(
        { ...save, expectedRevision: 1, document: changed },
        ids[0],
      );
      assert.equal(
        (await service.findVersion(prototype.id, versions[0].id, ids[0]))
          .document.business.name,
        brasaBurgerDefaultDocument.business.name,
      );
      assert.deepEqual(
        (await service.findVersion(prototype.id, versions[0].id, ids[0]))
          .document.appearance.colors,
        paletteDocument.appearance.colors,
      );
      const bad = structuredClone(changed);
      bad.content.hero.image = {
        source: "upload",
        assetId: "local-test",
        alt: "Test",
      };
      await assert.rejects(
        service.updateDraft(
          { ...save, expectedRevision: 2, document: bad },
          ids[0],
        ),
      );
      assert.equal(
        (await service.findById(prototype.id, ids[0])).draftDocument.business
          .name,
        changed.business.name,
      );
      const history = await service.create({ name: "History integration", document: paletteDocument }, ids[0]);
      const historical = await service.createVersion({ id: history.id, expectedRevision: 0 }, ids[0]);
      await service.updateDraft({ id: history.id, expectedRevision: 0, name: history.name, document: changed }, ids[0]);
      const restoreInput = { id: history.id, versionId: historical.id, expectedRevision: 1, confirmed: true };
      const restores = await Promise.allSettled([service.restoreVersion(restoreInput, ids[0]), service.restoreVersion(restoreInput, ids[0])]);
      assert.equal(restores.filter(result => result.status === "fulfilled").length, 1);
      const restored = await service.findById(history.id, ids[0]);
      assert.equal(restored.draftRevision, 2);
      assert.deepEqual(restored.draftDocument, historical.document);
      assert.deepEqual(await service.findVersion(history.id, historical.id, ids[0]), historical);
      const retained = await service.createVersion({ id: history.id, expectedRevision: 2 }, ids[0]);
      await assert.rejects(service.deleteVersion({ id: history.id, versionId: historical.id, confirmed: true }, ids[1]), { code: "NOT_FOUND" });
      await service.deleteVersion({ id: history.id, versionId: historical.id, confirmed: true }, ids[0]);
      assert.deepEqual(await service.findById(history.id, ids[0]), restored);
      assert.deepEqual(await service.findVersion(history.id, retained.id, ids[0]), retained);
      assert.equal((await service.createVersion({ id: history.id, expectedRevision: 2 }, ids[0])).number, 3);
    } finally {
      await db.user.deleteMany({ where: { id: { in: ids } } });
      await db.$disconnect();
    }
  },
);
