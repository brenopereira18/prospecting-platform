import { Sparkles } from "lucide-react";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-[oklch(0.16_0.008_160)] text-foreground">
      <div
        className="flex min-h-screen flex-col"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 70% 55% at 50% -10%, color-mix(in oklab, oklch(0.7019 0.1557 254.3) 18%, transparent), transparent 70%)",
        }}
      >
        <header className="mx-auto flex w-full max-w-6xl items-center px-6 py-6">
          <span className="flex items-center gap-2 font-bold tracking-tight">
            <Sparkles
              className="h-5 w-5 text-[oklch(0.7019_0.1557_254.3)]"
              aria-hidden
            />
            Prospecta
          </span>
        </header>

        <div className="flex flex-1 items-center justify-center px-6 py-6">
          <div className="w-full max-w-md">
            <div className="text-center">
              <h1 className="mt-4 text-[oklch(0.7019_0.1557_254.3)] text-4xl font-bold leading-tight">
                Acesse sua conta
              </h1>

              <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-[oklch(0.72_0.012_160)]">
                Continue suas prospecções e encontre novas oportunidades para o
                seu negócio.
              </p>
            </div>

            <LoginForm />
          </div>
        </div>

        <footer className="px-6 py-8 text-center text-xs text-[oklch(0.72_0.012_160)]">
          © {new Date().getFullYear()} Prospecta. Todos os direitos reservados.
        </footer>
      </div>
    </main>
  );
}
