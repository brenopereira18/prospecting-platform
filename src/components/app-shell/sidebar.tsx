import Link from "next/link";
import {
  BarChart3,
  Search,
  LayoutDashboard,
  Settings,
  Sparkles,
  Users,
} from "lucide-react";

const navigation = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: BarChart3,
  },
  {
    label: "Descobrir negócios",
    href: "/descoberta",
    icon: Search,
  },
  {
    label: "Leads",
    href: "/leads",
    icon: Users,
  },
  {
    label: "Protótipos",
    href: "/prototipos",
    icon: LayoutDashboard,
  },
  {
    label: "Configurações",
    href: "/configuracoes",
    icon: Settings,
  },
];

export function Sidebar() {
  return (
    <aside className="flex h-screen w-60 flex-col border-r border-sidebar-hover bg-background">
      <div className="flex h-16 items-center px-6">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 font-bold tracking-tight text-foreground"
        >
          <Sparkles className="h-5 w-5 text-primary" aria-hidden />
          <span>Prospecta</span>
        </Link>
      </div>

      <nav className="flex-1 px-3 py-4">
        <ul className="space-y-1">
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = item.href === "/dashboard";

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-[color-mix(in_oklab,var(--primary)_10%,transparent)] text-primary"
                      : "text-secundary hover:bg-sidebar-hover hover:text-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-sidebar-hover p-4">
        <div className="text-sm font-medium text-foreground">Usuário</div>

        <div className="mt-1 text-xs text-secundary">Minha conta</div>
      </div>
    </aside>
  );
}
