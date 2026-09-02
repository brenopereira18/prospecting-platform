"use server";

import { registerSchema } from "../../server/auth/auth.schema";
import { register } from "../../server/auth/auth.service";

export async function registerAction(input: unknown) {
  const result = registerSchema.safeParse(input);

  if (!result.success) {
    return {
      success: false,
      errors: result.error.flatten().fieldErrors,
    };
  }

  const user = await register(result.data);

  return {
    success: true,
    user,
  };
}
