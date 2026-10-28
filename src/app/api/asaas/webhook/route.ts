import { createHash, timingSafeEqual } from "node:crypto";
import { after } from "next/server";
import { z } from "zod";
import { asaasService } from "@/src/server/finance/asaas.runtime";
import { asaasConfig } from "@/src/server/finance/asaas.client";
export const runtime = "nodejs";
export const maxDuration = 120;
export async function POST(request: Request) {
  let config;
  try {
    config = asaasConfig();
  } catch {
    return new Response("Integração indisponível", { status: 503 });
  }
  const digest = (v: string) => createHash("sha256").update(v).digest();
  if (
    !timingSafeEqual(
      digest(request.headers.get("asaas-access-token") ?? ""),
      digest(config.webhookToken),
    )
  )
    return new Response("Não autorizado", { status: 401 });
  if (Number(request.headers.get("content-length")) > 131072)
    return new Response("Payload excedido", { status: 413 });
  const reader = request.body?.getReader();
  if (!reader) return new Response("Payload ausente", { status: 400 });
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 131072) {
      await reader.cancel();
      return new Response("Payload excedido", { status: 413 });
    }
    chunks.push(value);
  }
  let input: unknown;
  try {
    input = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return new Response("JSON inválido", { status: 400 });
  }
  try {
    const service = asaasService();
    const id = await service.storeEvent(input);
    after(async () => {
      try {
        await service.processEvent(id);
      } catch {
        /* durable error retained for reconciliation/reprocessing */
      }
    });
    return Response.json({ received: true });
  } catch (error) {
    return Response.json(
      { received: false, retry: !(error instanceof z.ZodError) },
      { status: error instanceof z.ZodError ? 400 : 503 },
    );
  }
}
