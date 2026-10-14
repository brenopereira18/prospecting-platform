import { prisma } from "@/lib/prisma/client";
import type { ApproachTemplateDTO } from "./approach-template.dto";

export class ApproachTemplateService {
  async findByCategory(categoryId: string): Promise<ApproachTemplateDTO[]> {
    return prisma.approachTemplate.findMany({
      where: {
        categoryId,
      },
      select: {
        id: true,
        title: true,
        content: true,
      },
      orderBy: {
        title: "asc",
      },
    });
  }
}

export const approachTemplateService = new ApproachTemplateService();
