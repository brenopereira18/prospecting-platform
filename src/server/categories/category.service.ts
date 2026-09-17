import { prisma } from "@/lib/prisma/client";
import type { CategoryDTO } from "./category.dto";

export class CategoryService {
  async list(): Promise<CategoryDTO[]> {
    const categories = await prisma.category.findMany({
      orderBy: {
        name: "asc",
      },
    });

    return categories.map((category) => ({
      id: category.id,
      name: category.name,
    }));
  }

  async findById(id: string): Promise<CategoryDTO | null> {
    const category = await prisma.category.findUnique({
      where: {
        id,
      },
    });

    if (!category) {
      return null;
    }

    return {
      id: category.id,
      name: category.name,
    };
  }

  async create(name: string): Promise<CategoryDTO> {
    const category = await prisma.category.create({
      data: {
        name,
      },
    });

    return {
      id: category.id,
      name: category.name,
    };
  }
}
