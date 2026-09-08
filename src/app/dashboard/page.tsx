import { redirect } from "next/navigation";
import { getCurrentUser } from "../../server/auth/current-user.service";
import { logoutAction } from "../actions/auth";

export default async function DashboardPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen max-w-6xl items-center justify-center px-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold">Dashboard</h1>

          <form action={logoutAction} className="mt-6">
            <button
              type="submit"
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              Sair
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
