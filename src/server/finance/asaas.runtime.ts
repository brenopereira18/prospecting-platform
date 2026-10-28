import "server-only";
import { prisma } from "@/lib/prisma/client";
import { AsaasClient, asaasConfig } from "./asaas.client";
import { AsaasService } from "./asaas.service";
export function asaasService() {
  const config = asaasConfig();
  return new AsaasService(prisma, new AsaasClient(config.apiKey), config);
}
