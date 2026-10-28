import { z } from "zod";

export class AsaasError extends Error {
  constructor(
    message: string,
    public readonly uncertain = false,
  ) {
    super(message);
  }
}
export type AsaasConfig = {
  apiKey: string;
  ownerUserId: string;
  origin: string;
  webhookToken: string;
};
export function asaasConfig(): AsaasConfig {
  if (
    process.env.ASAAS_ENVIRONMENT &&
    process.env.ASAAS_ENVIRONMENT !== "sandbox"
  )
    throw new AsaasError("Esta integração ainda está restrita ao Sandbox.");
  const result = z
    .object({
      apiKey: z.string().min(10),
      ownerUserId: z.uuid(),
      origin: z.url(),
      webhookToken: z.string().min(32),
    })
    .safeParse({
      apiKey: process.env.ASAAS_SANDBOX_API_KEY,
      ownerUserId: process.env.ASAAS_OWNER_USER_ID,
      origin: process.env.ASAAS_APP_URL,
      webhookToken: process.env.ASAAS_WEBHOOK_TOKEN,
    });
  if (!result.success)
    throw new AsaasError(
      "Configure ASAAS_SANDBOX_API_KEY, ASAAS_OWNER_USER_ID, ASAAS_APP_URL e ASAAS_WEBHOOK_TOKEN no servidor.",
    );
  if (new URL(result.data.origin).protocol !== "https:")
    throw new AsaasError(
      "ASAAS_APP_URL deve usar HTTPS para o checkout e os retornos.",
    );
  return result.data;
}
/** Server service only; no card payloads and no automatic retries of POSTs. */
export class AsaasClient {
  constructor(
    private key: string,
    private transport: typeof fetch = fetch,
  ) {}
  async request(
    path: string,
    method = "GET",
    body?: unknown,
  ): Promise<unknown> {
    if (!path.startsWith("/") || path.includes(".."))
      throw new AsaasError("Caminho de API inválido.");
    let response: Response;
    try {
      response = await this.transport(
        `https://api-sandbox.asaas.com/v3${path}`,
        {
          method,
          headers: {
            access_token: this.key,
            "Content-Type": "application/json",
            "User-Agent": "Prospecta/Sandbox",
          },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
          cache: "no-store",
          signal: AbortSignal.timeout(65000),
          redirect: "error",
        },
      );
    } catch {
      throw new AsaasError(
        "O Asaas não confirmou a operação. Concilie antes de repetir.",
        true,
      );
    }
    if (!response.ok) {
      const details = (await response.json().catch(() => null)) as {
        errors?: { code?: string; description?: string }[];
      } | null;
      const errors = details?.errors ?? [];
      const message = errors.some((e) => e.description?.includes("chave Pix"))
        ? "Cadastre uma chave Pix no painel Sandbox do Asaas antes de preparar este checkout."
        : errors.some((e) => e.code === "invalid_environment")
          ? "A chave configurada não pertence ao Sandbox do Asaas."
          : `Asaas retornou HTTP ${response.status}. Revise a configuração ou tente conciliar.`;
      throw new AsaasError(
        message,
        response.status >= 500 || response.status === 429,
      );
    }
    try {
      return await response.json();
    } catch {
      throw new AsaasError(
        "Resposta incompleta do Asaas. Concilie antes de repetir.",
        true,
      );
    }
  }
  async payments(
    filter: { checkoutSession: string } | { subscription: string },
  ) {
    const result: unknown[] = [];
    for (let offset = 0; offset < 10000; offset += 100) {
      const query = new URLSearchParams({
        ...filter,
        offset: String(offset),
        limit: "100",
      });
      const page = z
        .object({ hasMore: z.boolean(), data: z.array(z.unknown()) })
        .parse(await this.request(`/payments?${query}`));
      result.push(...page.data);
      if (!page.hasMore) return result;
    }
    throw new AsaasError(
      "Conciliação excedeu o limite de segurança. Nenhum pagamento foi ignorado silenciosamente.",
    );
  }
}
export function hostedCheckoutUrl(id: string) {
  return `https://sandbox.asaas.com/checkoutSession/show?id=${encodeURIComponent(id)}`;
}
