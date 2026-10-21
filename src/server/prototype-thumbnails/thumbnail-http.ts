import { z } from "zod";
import {
  ThumbnailError,
  type PrototypeThumbnailService,
} from "./thumbnail.service";

type Context = { params: Promise<{ id: string; versionId: string }> };
const headers = {
  "Cache-Control": "private, no-store, max-age=0",
  Vary: "Cookie",
  "X-Content-Type-Options": "nosniff",
  "Cross-Origin-Resource-Policy": "same-origin",
};
export function createThumbnailHandlers(deps: {
  getUser: () => Promise<{ id: string } | null>;
  getSessionToken: () => Promise<string | undefined>;
  service: Pick<PrototypeThumbnailService, "read" | "generate">;
}) {
  function handler(generate: boolean) {
    return async (request: Request, context: Context) => {
      try {
        const user = await deps.getUser();
        if (!user)
          return Response.json(
            { error: "Faça login para acessar as miniaturas." },
            { status: 401, headers },
          );
        const { id, versionId } = await context.params;
        if (generate) {
          const requestUrl = new URL(request.url);
          const origin = request.headers.get("origin");
          let sameOrigin = false;
          try {
            const originUrl = new URL(origin ?? "");
            // Next may normalize the internal URL hostname. Host identifies the
            // browser-facing authority; it is never used as a capture destination.
            const host = request.headers.get("host") ?? requestUrl.host;
            sameOrigin =
              originUrl.origin === origin &&
              originUrl.host.toLowerCase() === host.toLowerCase() &&
              originUrl.protocol === requestUrl.protocol;
          } catch {
            /* Missing/malformed Origin is rejected. */
          }
          if (
            !sameOrigin ||
            request.headers.get("sec-fetch-site") === "cross-site"
          )
            return Response.json(
              { error: "Origem não permitida." },
              { status: 403, headers },
            );
          const token = await deps.getSessionToken();
          if (!token)
            return Response.json(
              { error: "Sessão expirada." },
              { status: 401, headers },
            );
          const result = await deps.service.generate(
            id,
            versionId,
            user.id,
            token,
          );
          return Response.json(result, { headers });
        }
        const bytes = await deps.service.read(id, versionId, user.id);
        return new Response(new Uint8Array(bytes), {
          headers: {
            ...headers,
            "Content-Type": "image/webp",
            "Content-Length": String(bytes.length),
            "Content-Security-Policy": "default-src 'none'; sandbox",
          },
        });
      } catch (cause) {
        const status =
          cause instanceof ThumbnailError
            ? cause.status
            : cause instanceof z.ZodError
              ? 400
              : 502;
        const error =
          cause instanceof ThumbnailError
            ? cause.message
            : "Não foi possível carregar a miniatura. Tente novamente.";
        return Response.json({ error }, { status, headers });
      }
    };
  }
  return { GET: handler(false), POST: handler(true) };
}
