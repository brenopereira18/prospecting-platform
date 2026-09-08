"use server";

import { registerSchema, loginSchema } from "../../server/auth/auth.schema";
import { register, login } from "../../server/auth/auth.service";
import {
  createSession,
  deleteSession,
} from "../../server/auth/session.service";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function registerAction(input: unknown) {
  const result = registerSchema.safeParse(input);

  if (!result.success) {
    return {
      success: false,
      errors: result.error.flatten().fieldErrors,
    };
  }

  const user = await register(result.data);
  const session = await createSession(user.id);
  const cookieStore = await cookies();

  cookieStore.set("session", session.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: session.expiresAt,
    path: "/",
  });

  return {
    success: true,
    user,
    session,
  };
}

export async function loginAction(
  _previousState: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> {
  const input = {
    email: formData.get("email"),
    password: formData.get("password"),
  };

  const result = loginSchema.safeParse(input);

  if (!result.success) {
    return {
      success: false,
      errors: result.error.flatten().fieldErrors,
    };
  }

  try {
    const user = await login(result.data);
    const session = await createSession(user.id);
    const cookieStore = await cookies();

    cookieStore.set("session", session.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      expires: session.expiresAt,
      path: "/",
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Invalid email or password"
    ) {
      return {
        success: false,
        error: "E-mail ou senha inválidos.",
      };
    }
    throw error;
  }

  redirect("/dashboard");
}

export type LoginActionState = {
  success: boolean;
  errors?: {
    email?: string[];
    password?: string[];
  };
  error?: string;
};

export async function logoutAction() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("session")?.value;

  if (sessionToken) {
    await deleteSession(sessionToken);
  }

  cookieStore.delete("session");
  redirect("/login");
}
