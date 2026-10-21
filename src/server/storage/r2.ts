import "server-only";
import { S3Client } from "@aws-sdk/client-s3";
import { z } from "zod";
import { R2Storage } from "./r2-storage";
import { AssetError } from "../prototype-assets/asset-error";

let storage: R2Storage | undefined;

/** Lazy configuration avoids accessing credentials during imports/builds. */
export function getR2Storage() {
  if (storage) return storage;
  const parsed = z
    .object({
      R2_ACCOUNT_ID: z.string().regex(/^[a-f\d]{32}$/i),
      R2_ACCESS_KEY_ID: z.string().min(1),
      R2_SECRET_ACCESS_KEY: z.string().min(1),
      R2_BUCKET_NAME: z
        .string()
        .min(3)
        .max(63)
        .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/),
      R2_ENDPOINT: z.url(),
    })
    .safeParse(process.env);
  if (!parsed.success)
    throw new AssetError(
      "STORAGE_ERROR",
      "Armazenamento de imagens não configurado no servidor.",
      503,
    );
  const config = parsed.data;
  const endpoint = new URL(config.R2_ENDPOINT);
  if (
    endpoint.protocol !== "https:" ||
    endpoint.username ||
    endpoint.password ||
    endpoint.search ||
    endpoint.hash ||
    endpoint.port ||
    endpoint.pathname !== "/" ||
    ![
      `${config.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      `${config.R2_ACCOUNT_ID}.eu.r2.cloudflarestorage.com`,
      `${config.R2_ACCOUNT_ID}.fedramp.r2.cloudflarestorage.com`,
    ].includes(endpoint.hostname)
  ) {
    throw new AssetError(
      "STORAGE_ERROR",
      "Endpoint R2 inválido na configuração do servidor.",
      503,
    );
  }
  storage = new R2Storage(
    new S3Client({
      region: "auto",
      endpoint: endpoint.href,
      maxAttempts: 2,
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
      credentials: {
        accessKeyId: config.R2_ACCESS_KEY_ID,
        secretAccessKey: config.R2_SECRET_ACCESS_KEY,
      },
    }),
    config.R2_BUCKET_NAME,
  );
  return storage;
}
