import type {
  InteractionChannel,
  InteractionType,
} from "@/generated/prisma/enums";

export interface CreateLeadInteractionDTO {
  leadId: string;
  channel: InteractionChannel;
  type: InteractionType;
  notes?: string | null;
}

export interface LeadInteractionDTO {
  id: string;
  leadId: string;
  channel: InteractionChannel;
  type: InteractionType;
  notes: string | null;
  createdAt: Date;
}
