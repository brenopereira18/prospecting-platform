import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import sharp from "sharp";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../../generated/prisma/client";
import { brasaBurgerDefaultDocument } from "../../components/prototypes/templates/hamburgueria/data/default-document";
import { PrototypeAssetService } from "./asset.service";

const url = process.env.PROTOTYPE_TEST_DATABASE_URL;
test(
  "PostgreSQL assets: metadata, ownership, version protection and orphan retention",
  {
    skip: !url
      ? "Set PROTOTYPE_TEST_DATABASE_URL to a migrated, disposable PostgreSQL database."
      : false,
  },
  async () => {
    const db = new PrismaClient({
      adapter: new PrismaPg({ connectionString: url }),
    });
    const userId = randomUUID(),
      otherUser = randomUUID();
    const objects = new Map<string, Buffer>();
    const service = new PrototypeAssetService(db, {
      put: async (key, bytes) => {
        objects.set(key, bytes);
      },
      read: async (key) => objects.get(key)!,
      remove: async (key) => {
        objects.delete(key);
      },
    });
    try {
      for (const id of [userId, otherUser])
        await db.user.create({
          data: {
            id,
            name: "R2 asset integration test",
            email: `asset-test-${id}@example.invalid`,
            passwordHash: "not-a-login-password",
          },
        });
      const prototype = await db.prototype.create({
        data: {
          userId,
          name: "Asset integration",
          templateId: "brasa-burger",
          templateVersion: 1,
          draftDocument: JSON.parse(JSON.stringify(brasaBurgerDefaultDocument)),
        },
      });
      const bytes = await sharp({
        create: { width: 4, height: 3, channels: 3, background: "red" },
      })
        .png()
        .toBuffer();
      const file = () => new File([bytes], "foto.png", { type: "image/png" });
      await assert.rejects(service.upload(prototype.id, file(), otherUser), {
        code: "NOT_FOUND",
      });
      const asset = await service.upload(prototype.id, file(), userId);
      assert.deepEqual(
        (await service.read(prototype.id, asset.id, userId)).bytes,
        bytes,
      );
      await assert.rejects(service.read(prototype.id, asset.id, otherUser), {
        code: "NOT_FOUND",
      });
      const snapshot = structuredClone(brasaBurgerDefaultDocument);
      snapshot.content.hero.image = {
        source: "upload",
        assetId: asset.id,
        alt: "Imagem real",
      };
      await db.prototypeVersion.create({
        data: {
          prototypeId: prototype.id,
          number: 1,
          document: JSON.parse(JSON.stringify(snapshot)),
        },
      });
      await assert.rejects(
        service.deleteUnused(prototype.id, asset.id, userId),
        { code: "IN_USE" },
      );
      const unused = await service.upload(prototype.id, file(), userId);
      await service.deleteUnused(prototype.id, unused.id, userId);
      assert.ok(
        (
          await db.prototypeAsset.findUniqueOrThrow({
            where: { id: unused.id },
          })
        ).deletedAt,
      );
      assert.equal(objects.size, 1);
      await db.prototype.delete({ where: { id: prototype.id } });
      assert.equal(
        (await db.prototypeAsset.findUniqueOrThrow({ where: { id: asset.id } }))
          .prototypeId,
        null,
      );
      assert.equal(
        objects.size,
        1,
        "deleting a prototype must not cascade to R2",
      );
    } finally {
      await db.prototypeAsset.deleteMany({
        where: { userId: { in: [userId, otherUser] } },
      });
      await db.prototype.deleteMany({
        where: { userId: { in: [userId, otherUser] } },
      });
      await db.user.deleteMany({ where: { id: { in: [userId, otherUser] } } });
      await db.$disconnect();
    }
  },
);
