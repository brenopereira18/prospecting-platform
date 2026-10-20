import type { HamburgueriaPrototypeDocument } from "../../components/prototypes/templates/hamburgueria/schema/hamburgueria.schema";

export interface PrototypeSummaryDTO {
  id: string; name: string; templateId: string; templateVersion: number;
  draftRevision: number; leadId: string | null; createdAt: string; updatedAt: string;
}
export interface PrototypeDTO extends PrototypeSummaryDTO { draftDocument: HamburgueriaPrototypeDocument }
export interface PrototypeVersionSummaryDTO { id: string; prototypeId: string; number: number; createdAt: string }
export interface PrototypeVersionDTO extends PrototypeVersionSummaryDTO { document: HamburgueriaPrototypeDocument }
export type PrototypeErrorCode = "UNAUTHENTICATED" | "NOT_FOUND" | "CONFLICT" | "INVALID_INPUT" | "TEMPORARY_IMAGES" | "UNEXPECTED";
export type PrototypeActionResult<T> = { success: true; data: T } | { success: false; code: PrototypeErrorCode; error: string; fieldErrors?: Record<string, string> };
