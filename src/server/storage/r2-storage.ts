import {
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  type S3Client,
} from "@aws-sdk/client-s3";
import { AssetError } from "../prototype-assets/asset-error";

export interface ImageStorage {
  put(key: string, bytes: Buffer, mimeType: string): Promise<void>;
  read(key: string, maxBytes: number): Promise<Buffer>;
  remove(key: string): Promise<void>;
}

/** SDK transport is injectable; credentials are supplied only by the server-only entry point. */
export class R2Storage implements ImageStorage {
  constructor(
    private client: Pick<S3Client, "send">,
    private bucket: string,
  ) {}

  async put(key: string, bytes: Buffer, mimeType: string) {
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: bytes,
          ContentType: mimeType,
          ContentLength: bytes.length,
          CacheControl: "private, no-store",
          IfNoneMatch: "*",
        }),
        { abortSignal: AbortSignal.timeout(15_000) },
      );
    } catch {
      throw new AssetError(
        "STORAGE_ERROR",
        "Não foi possível enviar a imagem ao armazenamento. Tente novamente.",
        502,
      );
    }
  }

  async read(key: string, maxBytes: number) {
    try {
      const response = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
        { abortSignal: AbortSignal.timeout(15_000) },
      );
      if (!response.Body) throw new Error("Missing object body");
      const reader = response.Body.transformToWebStream().getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      try {
        if (
          response.ContentLength !== undefined &&
          response.ContentLength > maxBytes
        ) {
          await reader.cancel();
          throw new Error("Invalid object size");
        }
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > maxBytes) {
            await reader.cancel();
            throw new Error("Object too large");
          }
          chunks.push(value);
        }
      } finally {
        reader.releaseLock();
      }
      return Buffer.concat(chunks, size);
    } catch {
      throw new AssetError(
        "STORAGE_ERROR",
        "Não foi possível carregar a imagem armazenada. Tente novamente.",
        502,
      );
    }
  }

  async remove(key: string) {
    try {
      await this.client.send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
        { abortSignal: AbortSignal.timeout(15_000) },
      );
    } catch {
      throw new AssetError(
        "STORAGE_ERROR",
        "Não foi possível excluir a imagem do armazenamento. Tente novamente.",
        502,
      );
    }
  }
}
