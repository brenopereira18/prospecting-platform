"use client";

import { useActionState } from "react";
import Link from "next/link";
import { loginAction } from "../../actions/auth";
import { CandyButton } from "../../../components/ui/candy-button";

export const initialLoginState = {
  success: false,
  errors: {},
};

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(
    loginAction,
    initialLoginState,
  );

  return (
    <form
      action={formAction}
      className="mt-8 rounded-3xl border border-[oklch(0.3_0.014_160)] bg-[oklch(0.21_0.012_160)] p-8"
    >
      <div className="grid gap-6">
        <div>
          <label htmlFor="email" className="text-sm font-medium">
            E-mail
          </label>

          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="seu@email.com"
            className="mt-2 w-full rounded-xl border border-[oklch(0.3_0.014_160)] bg-[oklch(0.16_0.008_160)] px-4 py-3.5 text-sm outline-none transition placeholder:text-[oklch(0.72_0.012_160)] focus:border-[oklch(0.82_0.22_155)] focus:ring-1 focus:ring-[oklch(0.82_0.22_155)]"
          />

          {state.errors?.email?.map((error) => (
            <p key={error} className="mt-2 text-sm text-red-500">
              {error}
            </p>
          ))}
        </div>

        <div>
          <div>
            <label htmlFor="password" className="text-sm font-medium">
              Senha
            </label>
          </div>

          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            className="mt-2 mb-1 w-full rounded-xl border border-[oklch(0.3_0.014_160)] bg-[oklch(0.16_0.008_160)] px-4 py-3.5 text-sm outline-none transition placeholder:text-[oklch(0.72_0.012_160)] focus:border-[oklch(0.82_0.22_155)] focus:ring-1 focus:ring-[oklch(0.82_0.22_155)]"
          />

          {state.errors?.password?.map((error) => (
            <p key={error} className="mt-2 text-sm text-red-500">
              {error}
            </p>
          ))}

          <Link
            href="/forgot-password"
            className="text-xs font-medium text-[oklch(0.7019_0.1557_254.3)] transition hover:opacity-80"
          >
            Esqueci minha senha
          </Link>
        </div>

        {state.error && <p className="text-sm text-red-500">{state.error}</p>}

        <CandyButton>{isPending ? "Entrando..." : "Entrar"}</CandyButton>
      </div>
    </form>
  );
}
