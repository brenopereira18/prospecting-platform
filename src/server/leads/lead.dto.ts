import { LeadStatus } from "../../../generated/prisma/client";

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

export interface LeadFiltersDTO {
  name?: string;
  categoryId?: string;
  status?: LeadStatus;
}
