import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { PrismaClient } from "../../../generated/prisma/client";
import type { ImageStorage } from "../storage/r2-storage";
import { MAX_THUMBNAIL_BYTES, validateThumbnail } from "./thumbnail-image";

export class ThumbnailError extends Error {
  constructor(
    public readonly code: "NOT_FOUND" | "BUSY" | "GENERATION_FAILED",
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

export type CaptureThumbnail = (
  prototypeId: string,
  versionId: string,
  sessionToken: string,
) => Promise<Buffer>;
const LEASE_MS = 180_000;
export const thumbnailPath = (prototypeId: string, versionId: string) =>
  `/api/prototipos/${prototypeId}/versoes/${versionId}/miniatura`;

export class PrototypeThumbnailService {
  constructor(
    private readonly db: PrismaClient,
    private readonly storage: ImageStorage,
    private readonly capture: CaptureThumbnail,
  ) {}

  private async ownedVersion(
    prototypeId: string,
    versionId: string,
    userId: string,
  ) {
    z.uuid().parse(prototypeId);
    z.uuid().parse(versionId);
    const version = await this.db.prototypeVersion.findFirst({
      where: { id: versionId, prototypeId, prototype: { userId } },
      select: { id: true },
    });
    if (!version)
      throw new ThumbnailError("NOT_FOUND", "Versão não encontrada.", 404);
  }

  private objectKey(prototypeId: string, versionId: string, userId: string) {
    return `thumbnails/v1/users/${userId}/prototypes/${prototypeId}/versions/${versionId}.webp`;
  }

  private async cached(key: string): Promise<Buffer | null> {
    try {
      const bytes = await this.storage.read(key, MAX_THUMBNAIL_BYTES);
      await validateThumbnail(bytes);
      return bytes;
    } catch {
      return null;
    }
  }

  async read(prototypeId: string, versionId: string, userId: string) {
    await this.ownedVersion(prototypeId, versionId, userId);
    const thumbnail = await this.db.prototypeThumbnail.findUnique({
      where: { versionId },
    });
    if (
      !thumbnail ||
      thumbnail.status !== "ready" ||
      thumbnail.objectKey !== this.objectKey(prototypeId, versionId, userId)
    )
      throw new ThumbnailError(
        "NOT_FOUND",
        "Esta versão ainda não tem uma miniatura disponível.",
        404,
      );
    const bytes = await this.storage.read(
      thumbnail.objectKey,
      MAX_THUMBNAIL_BYTES,
    );
    await validateThumbnail(bytes);
    return bytes;
  }

  async generate(
    prototypeId: string,
    versionId: string,
    userId: string,
    sessionToken: string,
  ) {
    await this.ownedVersion(prototypeId, versionId, userId);
    const key = this.objectKey(prototypeId, versionId, userId);
    const current = await this.db.prototypeThumbnail.findUnique({
      where: { versionId },
    });
    if (current?.status === "ready" && (await this.cached(key)))
      return { url: thumbnailPath(prototypeId, versionId), reused: true };

    const attemptId = randomUUID();
    const now = new Date();
    // One row per version; the atomic lease works across tabs and application instances.
    await this.db.prototypeThumbnail.upsert({
      where: { versionId },
      update: {},
      create: {
        versionId,
        objectKey: key,
        status: "failed",
        attemptId,
        leaseExpiresAt: new Date(0),
      },
    });
    const claimed = await this.db.prototypeThumbnail.updateMany({
      where: {
        versionId,
        OR: [
          { status: { in: ["failed", "ready"] } },
          { status: "generating", leaseExpiresAt: { lt: now } },
        ],
      },
      data: {
        objectKey: key,
        status: "generating",
        attemptId,
        leaseExpiresAt: new Date(now.getTime() + LEASE_MS),
      },
    });
    if (claimed.count !== 1)
      throw new ThumbnailError(
        "BUSY",
        "Esta miniatura já está sendo gerada. Aguarde e tente novamente.",
        409,
      );

    try {
      // Recover an uploaded object if a previous DB acknowledgement was lost.
      let bytes = await this.cached(key);
      const reused = bytes !== null;
      if (!bytes) {
        bytes = await this.capture(prototypeId, versionId, sessionToken);
        await validateThumbnail(bytes);
        const claim = await this.db.prototypeThumbnail.findUnique({
          where: { versionId },
        });
        if (
          claim?.attemptId !== attemptId ||
          claim.status !== "generating" ||
          claim.leaseExpiresAt <= new Date()
        )
          throw new ThumbnailError(
            "BUSY",
            "A captura expirou. Tente novamente.",
            409,
          );
        try {
          // The shared R2 client uses If-None-Match: *: an existing artifact is never overwritten.
          await this.storage.put(key, bytes, "image/webp");
        } catch (cause) {
          if (!(await this.cached(key))) throw cause;
        }
      }
      const saved = await this.db.prototypeThumbnail.updateMany({
        where: {
          versionId,
          attemptId,
          status: "generating",
          leaseExpiresAt: { gt: new Date() },
        },
        data: { status: "ready", generatedAt: new Date() },
      });
      if (saved.count !== 1)
        throw new ThumbnailError(
          "BUSY",
          "A captura expirou. Tente novamente.",
          409,
        );
      return { url: thumbnailPath(prototypeId, versionId), reused };
    } catch (cause) {
      await this.db.prototypeThumbnail
        .updateMany({
          where: { versionId, attemptId, status: "generating" },
          data: { status: "failed", leaseExpiresAt: new Date() },
        })
        .catch(() => {});
      if (cause instanceof ThumbnailError) throw cause;
      console.error("Falha ao gerar miniatura de versão.", {
        name: cause instanceof Error ? cause.name : "UnknownError",
      });
      // Never remove objects with uncertain persistence. A retry can recover them.
      throw new ThumbnailError(
        "GENERATION_FAILED",
        "Não foi possível gerar a miniatura. Verifique a configuração de captura e tente novamente.",
        502,
      );
    }
  }
}
