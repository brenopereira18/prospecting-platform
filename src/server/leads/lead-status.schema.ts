import { z } from "zod";
import { LeadStatus } from "../../../generated/prisma/enums";

export const changeLeadStatusSchema = z.strictObject({
  leadId: z.uuid(),
  status: z.enum(LeadStatus),
  expectedRevision: z.number().int().nonnegative().max(2_147_483_646),
});

export type ChangeLeadStatusInput = z.infer<typeof changeLeadStatusSchema>;

export type LeadStatusChangeResult = {
  changed: boolean;
  status: LeadStatus;
  statusRevision: number;
};

export type LeadStatusHistoryDTO = {
  id: string;
  fromStatus: LeadStatus;
  toStatus: LeadStatus;
  revision: number;
  occurredAt: string;
  recordedAt: string;
};

export type ChangeLeadStatusActionResult =
  | { success: true; data: LeadStatusChangeResult }
  | {
      success: false;
      code:
        | "UNAUTHENTICATED"
        | "INVALID_INPUT"
        | "NOT_FOUND"
        | "CONFLICT"
        | "ERROR";
      error: string;
    };
