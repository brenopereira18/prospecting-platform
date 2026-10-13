import { LeadStatus } from "../../../generated/prisma/client";
import type { LeadSource } from "@/generated/prisma/enums";

export interface LeadListItemDTO {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  website: string | null;
  rating: number | null;
  userRatingCount: number | null;
  score: number | null;
  status: LeadStatus;
  category: {
    id: string;
    name: string;
  };
}

export interface LeadDetailDTO extends LeadListItemDTO {
  source: LeadSource;
  sourceId: string | null;
  notes: string | null;
  wizardStep: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface LeadFiltersDTO {
  name?: string;
  categoryId?: string;
  status?: LeadStatus;
}
