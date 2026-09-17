"use server";

import { CategoryService } from "@/src/server/categories/category.service";

const categoryService = new CategoryService();

export async function getCategories() {
  return categoryService.list();
}
