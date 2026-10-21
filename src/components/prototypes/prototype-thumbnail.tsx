"use client";

import Image from "next/image";
import Link from "next/link";
import { ImageOff, LoaderCircle, ScanEye } from "lucide-react";
import { useRef, useState } from "react";
import type { PrototypeVersionSummaryDTO } from "../../server/prototypes/prototype.dto";

export async function requestPrototypeThumbnail(
  endpoint: string,
  request: typeof fetch = fetch,
) {
  let response: Response;
  try {
    response = await request(endpoint, {
      method: "POST",
      credentials: "same-origin",
    });
  } catch {
    throw new Error("Não foi possível conectar ao servidor. Tente novamente.");
  }
  const result = await response.json().catch(() => null);
  if (!response.ok || typeof result?.url !== "string")
    throw new Error(
      typeof result?.error === "string"
        ? result.error
        : "Não foi possível gerar a miniatura. Tente novamente.",
    );
}

export function PrototypeThumbnail({
  prototypeId,
  version,
}: {
  prototypeId: string;
  version?: PrototypeVersionSummaryDTO | null;
}) {
  const [ready, setReady] = useState(version?.thumbnailReady ?? false);
  const [failed, setFailed] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const lock = useRef(false);
  const endpoint = version
    ? `/api/prototipos/${prototypeId}/versoes/${version.id}/miniatura`
    : "";
  const preview = version
    ? `/prototipos/${prototypeId}/versoes/${version.id}`
    : `/prototipos/${prototypeId}/previa`;

  async function generate() {
    if (!version || lock.current) return;
    lock.current = true;
    setPending(true);
    setError("");
    try {
      await requestPrototypeThumbnail(endpoint);
      setAttempt((value) => value + 1);
      setFailed(false);
      setReady(true);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível gerar a miniatura. Tente novamente.",
      );
    } finally {
      lock.current = false;
      setPending(false);
    }
  }

  return (
    <div
      aria-busy={pending}
      className="group/thumbnail relative aspect-[2.5/1] overflow-hidden border-b border-sidebar-hover bg-background/60"
    >
      {ready && !failed ? (
        <Link
          href={preview}
          aria-label={`Visualizar protótipo, versão ${version?.number}`}
          className="absolute inset-0 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
        >
          <Image
            src={`${endpoint}?attempt=${attempt}`}
            alt={`Captura da versão ${version?.number}`}
            fill
            unoptimized
            loading="lazy"
            sizes="(min-width: 1280px) 33vw, (min-width: 768px) 50vw, 100vw"
            onError={() => setFailed(true)}
            className="object-cover motion-safe:transition-transform motion-safe:duration-300 motion-safe:group-hover/thumbnail:scale-[1.025] motion-safe:group-focus-within/thumbnail:scale-[1.025]"
          />
          <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 bg-black/75 px-3 py-3 text-xs font-medium text-white sm:opacity-0 sm:group-hover/thumbnail:opacity-100 sm:group-focus-within/thumbnail:opacity-100 motion-safe:transition-opacity">
            <ScanEye size={16} aria-hidden="true" />
            Visualizar protótipo
          </span>
        </Link>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 overflow-y-auto px-4 py-4 text-center">
          <ImageOff
            size={22}
            className="shrink-0 text-secundary"
            aria-hidden="true"
          />
          <p className="max-w-xs text-xs leading-relaxed text-secundary">
            {version
              ? failed
                ? "Miniatura indisponível."
                : "Esta versão ainda não tem miniatura."
              : "Crie uma versão no editor para gerar uma miniatura."}
          </p>
          {version && (
            <button
              type="button"
              disabled={pending}
              onClick={generate}
              className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg border border-sidebar-hover px-3 text-xs font-medium hover:bg-sidebar-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-wait disabled:opacity-60"
            >
              {pending && (
                <LoaderCircle
                  size={14}
                  className="motion-safe:animate-spin"
                  aria-hidden="true"
                />
              )}
              {pending
                ? "Gerando miniatura…"
                : error || failed
                  ? "Tentar novamente"
                  : "Gerar miniatura"}
            </button>
          )}
          {error && (
            <p
              role="alert"
              className="max-w-xs text-xs leading-relaxed text-red-300"
            >
              {error}
            </p>
          )}
        </div>
      )}
      {ready && !failed && (
        <span role="status" className="sr-only">
          Miniatura da versão {version?.number} disponível.
        </span>
      )}
    </div>
  );
}
