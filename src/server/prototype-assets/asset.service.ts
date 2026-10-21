import { randomUUID, createHash } from "node:crypto";
import { z } from "zod";
import type {
  PrismaClient,
  PrototypeAsset,
} from "../../../generated/prisma/client";
import type { ImageStorage } from "../storage/r2-storage";
import { validateAssetImage } from "./asset-image";
import { AssetError } from "./asset-error";
import { validateDocumentAssets } from "./document-assets";
import type { HamburgueriaPrototypeDocument } from "../../components/prototypes/templates/hamburgueria/schema/hamburgueria.schema";

function assetDTO(row: PrototypeAsset) {
  return {
    id: row.id,
    prototypeId: row.prototypeId,
    originalName: row.originalName,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    width: row.width,
    height: row.height,
    createdAt: row.createdAt.toISOString(),
    url: `/api/prototipos/${row.prototypeId}/assets/${row.id}`,
  };
}

function referencesAsset(value: unknown, id: string): boolean {
  if (!value || typeof value !== "object") return false;
  if (
    "source" in value &&
    value.source === "upload" &&
    "assetId" in value &&
    value.assetId === id
  )
    return true;
  return Object.values(value).some((child) => referencesAsset(child, id));
}

/** userId comes exclusively from the server session, as in PrototypeService. */
export class PrototypeAssetService {
  async resolveDocumentImages(document: HamburgueriaPrototypeDocument, prototypeId: string, userId: string) {
    await this.requirePrototype(prototypeId, userId);
    const assets = await validateDocumentAssets(this.db, document, prototypeId, userId);
    return Object.fromEntries(assets.map(asset => [asset.id, { src: `/api/prototipos/${prototypeId}/assets/${asset.id}`, width: asset.width, height: asset.height }]));
  }
  constructor(
    private db: PrismaClient,
    private storage: ImageStorage,
    private report: (
      message: string,
      details: Record<string, string>,
    ) => void = console.error,
  ) {}

  async requirePrototype(prototypeId: string, userId: string) {
    z.uuid().parse(prototypeId);
    const prototype = await this.db.prototype.findFirst({
      where: { id: prototypeId, userId },
      select: { id: true },
    });
    if (!prototype)
      throw new AssetError("NOT_FOUND", "Protótipo não encontrado.", 404);
    return prototype;
  }

  private async ownedAsset(
    prototypeId: string,
    id: string,
    userId: string,
    includeDeleted = false,
  ) {
    z.uuid().parse(prototypeId);
    z.uuid().parse(id);
    const row = await this.db.prototypeAsset.findFirst({
      where: {
        id,
        prototypeId,
        userId,
        prototype: { userId },
        ...(!includeDeleted && { deletionRequestedAt: null, deletedAt: null }),
      },
    });
    if (!row) throw new AssetError("NOT_FOUND", "Imagem não encontrada.", 404);
    return row;
  }

  async upload(prototypeId: string, file: File, userId: string) {
    await this.requirePrototype(prototypeId, userId);
    const image = await validateAssetImage(file);
    const id = randomUUID();
    const objectKey = `users/${userId}/prototypes/${prototypeId}/assets/${id}.${image.extension}`;
    try {
      await this.storage.put(objectKey, image.bytes, image.mimeType);
    } catch (cause) {
      // An interrupted request may have committed at R2. Never blindly delete an uncertain PUT.
      this.report("Falha no envio R2; verificar possível objeto órfão.", {
        assetId: id,
        objectKey,
      });
      throw cause;
    }
    try {
      const row = await this.db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "prototypes" WHERE "id" = ${prototypeId} AND "userId" = ${userId} FOR UPDATE`;
        if (
          !(await tx.prototype.findFirst({
            where: { id: prototypeId, userId },
            select: { id: true },
          }))
        )
          throw new AssetError("NOT_FOUND", "Protótipo não encontrado.", 404);
        return tx.prototypeAsset.create({
          data: {
            id,
            userId,
            prototypeId,
            objectKey,
            originalName: image.originalName,
            mimeType: image.mimeType,
            sizeBytes: image.bytes.length,
            width: image.width,
            height: image.height,
            sha256: image.sha256,
          },
        });
      });
      return assetDTO(row);
    } catch (cause) {
      // A lost COMMIT acknowledgement must not cause deletion of an already registered asset.
      let persisted: PrototypeAsset | null;
      try {
        persisted = await this.db.prototypeAsset.findFirst({
          where: { id, userId, objectKey },
        });
      } catch {
        this.report(
          "Registro do asset incerto; objeto preservado para reconciliação.",
          { assetId: id, objectKey },
        );
        throw cause;
      }
      if (persisted) {
        if (
          persisted.prototypeId === prototypeId &&
          !persisted.deletionRequestedAt &&
          !persisted.deletedAt
        )
          return assetDTO(persisted);
        throw cause;
      }
      try {
        await this.storage.remove(objectKey);
      } catch {
        this.report("Compensação R2 pendente após falha de registro.", {
          assetId: id,
          objectKey,
        });
      }
      throw cause;
    }
  }

  async findById(prototypeId: string, id: string, userId: string) {
    return assetDTO(await this.ownedAsset(prototypeId, id, userId));
  }

  async list(prototypeId: string, userId: string) {
    await this.requirePrototype(prototypeId, userId);
    const rows = await this.db.prototypeAsset.findMany({
      where: {
        prototypeId,
        userId,
        prototype: { userId },
        deletionRequestedAt: null,
        deletedAt: null,
      },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    });
    return rows.map(assetDTO);
  }

  async read(prototypeId: string, id: string, userId: string) {
    const row = await this.ownedAsset(prototypeId, id, userId);
    const bytes = await this.storage.read(row.objectKey, row.sizeBytes);
    if (
      bytes.length !== row.sizeBytes ||
      createHash("sha256").update(bytes).digest("hex") !== row.sha256
    )
      throw new AssetError(
        "STORAGE_ERROR",
        "A imagem armazenada não corresponde ao registro. Entre em contato com o suporte.",
        502,
      );
    return { asset: assetDTO(row), bytes };
  }

  async deleteUnused(prototypeId: string, id: string, userId: string) {
    z.uuid().parse(prototypeId);
    z.uuid().parse(id);
    const row = await this.db.$transaction(async (tx) => {
      // Same row lock used by draft saves/version creation; references cannot race this decision.
      await tx.$queryRaw`SELECT "id" FROM "prototypes" WHERE "id" = ${prototypeId} AND "userId" = ${userId} FOR UPDATE`;
      const prototype = await tx.prototype.findFirst({
        where: { id: prototypeId, userId },
        select: { draftDocument: true },
      });
      const asset = await tx.prototypeAsset.findFirst({
        where: { id, prototypeId, userId, prototype: { userId } },
      });
      if (!prototype || !asset)
        throw new AssetError("NOT_FOUND", "Imagem não encontrada.", 404);
      const versions = await tx.prototypeVersion.findMany({
        where: { prototypeId, prototype: { userId } },
        select: { document: true },
      });
      if (
        referencesAsset(prototype.draftDocument, id) ||
        versions.some((version) => referencesAsset(version.document, id))
      )
        throw new AssetError(
          "IN_USE",
          "A imagem está em uso no rascunho ou em uma versão e não pode ser excluída.",
          409,
        );
      if (asset.deletionRequestedAt) return asset;
      return tx.prototypeAsset.update({
        where: { id },
        data: { deletionRequestedAt: new Date() },
      });
    });
    if (row.deletedAt) return;
    // Durable tombstone precedes R2 deletion. Failures are retryable, including DB failure afterwards.
    await this.storage.remove(row.objectKey);
    await this.db.prototypeAsset.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
