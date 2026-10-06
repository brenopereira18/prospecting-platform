import { LeadStatus } from "@/generated/prisma/enums";

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  [LeadStatus.NOVO]: "Novo",
  [LeadStatus.PROPOSTA_ENVIADA]: "Proposta enviada",
  [LeadStatus.GANHO]: "Ganho",
  [LeadStatus.PERDIDO]: "Perdido",
};

export const LEAD_STATUS_OPTIONS = Object.values(LeadStatus).map((status) => ({
  value: status,
  label: LEAD_STATUS_LABELS[status],
}));
