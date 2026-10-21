import { z } from "zod";
import { AssetError } from "./asset-error";
import { MAX_ASSET_IMAGE_BYTES } from "./asset-image";
import type { PrototypeAssetService } from "./asset.service";

const privateHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  Vary: "Cookie",
  "X-Content-Type-Options": "nosniff",
  "Cross-Origin-Resource-Policy": "same-origin",
};
const MAX_REQUEST_BYTES = MAX_ASSET_IMAGE_BYTES + 64 * 1024;
type Context = { params: Promise<{ id: string; assetId?: string }> };
type Dependencies = {
  getUser: () => Promise<{ id: string } | null>;
  service: Pick<
    PrototypeAssetService,
    "requirePrototype" | "upload" | "list" | "read" | "deleteUnused"
  >;
};

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: privateHeaders });
}

function sameOrigin(request: Request) {
  if (
    request.headers.get("origin") !== new URL(request.url).origin ||
    request.headers.get("sec-fetch-site") === "cross-site"
  )
    throw new AssetError(
      "INVALID_REQUEST",
      "Origem da requisição não permitida.",
      403,
    );
}

async function readFile(request: Request) {
  const type = request.headers.get("content-type") ?? "";
  if (!/^multipart\/form-data\s*;/i.test(type) || !request.body)
    throw new AssetError(
      "INVALID_REQUEST",
      "Envie uma imagem no campo file de um formulário multipart.",
      400,
    );
  const length = request.headers.get("content-length");
  if (
    length !== null &&
    (!/^\d+$/.test(length) || !Number.isSafeInteger(Number(length)))
  )
    throw new AssetError(
      "INVALID_REQUEST",
      "Tamanho da requisição inválido.",
      400,
    );
  if (length && Number(length) > MAX_REQUEST_BYTES)
    throw new AssetError(
      "TOO_LARGE",
      "A requisição excede o limite permitido.",
      413,
    );
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  let timedOut = false;
  const cancel = () => {
    timedOut = true;
    void reader.cancel().catch(() => {});
  };
  const timer = setTimeout(cancel, 15_000);
  request.signal.addEventListener("abort", cancel, { once: true });
  try {
    if (request.signal.aborted) cancel();
    while (true) {
      const { done, value } = await reader.read();
      if (timedOut)
        throw new AssetError(
          "TIMEOUT",
          "O envio foi interrompido ou demorou demais. Tente novamente.",
          408,
        );
      if (done) break;
      size += value.byteLength;
      if (size > MAX_REQUEST_BYTES) {
        void reader.cancel().catch(() => {});
        throw new AssetError(
          "TOO_LARGE",
          "A requisição excede o limite permitido.",
          413,
        );
      }
      chunks.push(value);
    }
  } finally {
    clearTimeout(timer);
    request.signal.removeEventListener("abort", cancel);
    reader.releaseLock();
  }
  try {
    const form = await new Response(
      new Uint8Array(Buffer.concat(chunks, size)),
      { headers: { "Content-Type": type } },
    ).formData();
    const files = form.getAll("file");
    if (
      files.length !== 1 ||
      !(files[0] instanceof File) ||
      [...form.keys()].some((key) => key !== "file")
    )
      throw new Error("Unexpected multipart fields");
    return files[0];
  } catch {
    throw new AssetError(
      "INVALID_REQUEST",
      "Envie exatamente uma imagem no campo file, sem outros campos.",
      400,
    );
  }
}

export function createAssetHandlers({ getUser, service }: Dependencies) {
  function authenticated(
    operation: (
      request: Request,
      params: Awaited<Context["params"]>,
      userId: string,
    ) => Promise<Response>,
  ) {
    return async (request: Request, context: Context) => {
      try {
        const user = await getUser();
        if (!user)
          return json(
            {
              error: "Faça login para acessar as imagens.",
              code: "UNAUTHENTICATED",
            },
            401,
          );
        return await operation(request, await context.params, user.id);
      } catch (cause) {
        if (cause instanceof AssetError)
          return json({ error: cause.message, code: cause.code }, cause.status);
        if (cause instanceof z.ZodError)
          return json(
            { error: "Identificador inválido.", code: "INVALID_REQUEST" },
            400,
          );
        console.error("Falha na operação de assets de protótipos.", {
          name: cause instanceof Error ? cause.name : "UnknownError",
        });
        return json(
          {
            error:
              "Não foi possível concluir a operação de imagem. Tente novamente.",
            code: "UNEXPECTED",
          },
          500,
        );
      }
    };
  }
  return {
    upload: authenticated(async (request, { id }, userId) => {
      sameOrigin(request);
      await service.requirePrototype(id, userId);
      const file = await readFile(request);
      return json({ asset: await service.upload(id, file, userId) }, 201);
    }),
    list: authenticated(async (_request, { id }, userId) =>
      json({ assets: await service.list(id, userId) }),
    ),
    read: authenticated(async (_request, { id, assetId }, userId) => {
      const { asset, bytes } = await service.read(id, assetId ?? "", userId);
      const extension =
        asset.mimeType === "image/jpeg"
          ? "jpg"
          : asset.mimeType === "image/png"
            ? "png"
            : "webp";
      return new Response(new Uint8Array(bytes), {
        headers: {
          ...privateHeaders,
          "Content-Type": asset.mimeType,
          "Content-Length": String(bytes.length),
          "Content-Disposition": `inline; filename="${asset.id}.${extension}"`,
          "Content-Security-Policy": "default-src 'none'; sandbox",
        },
      });
    }),
    remove: authenticated(async (request, { id, assetId }, userId) => {
      sameOrigin(request);
      await service.deleteUnused(id, assetId ?? "", userId);
      return new Response(null, { status: 204, headers: privateHeaders });
    }),
  };
}
