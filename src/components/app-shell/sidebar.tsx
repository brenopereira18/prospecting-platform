"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  BarChart3,
  Wallet,
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
    href: "/descobrir-negocios",
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
    label: "Financeiro",
    href: "/financeiro",
    icon: Wallet,
  },
  {
    label: "Configurações",
    href: "/configuracoes",
    icon: Settings,
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const compactOnMobile =
    pathname.startsWith("/financeiro") ||
    pathname === "/prototipos" ||
    pathname === "/dashboard" ||
    pathname.startsWith("/leads/");

  return (
    <aside
      className={`flex h-screen flex-col border-r border-sidebar-hover bg-background ${compactOnMobile ? "w-16 shrink-0 sm:w-60" : "w-60"}`}
    >
      <div
        className={`flex h-16 items-center ${compactOnMobile ? "justify-center px-2 sm:justify-start sm:px-6" : "px-6"}`}
      >
        <Link
          href="/dashboard"
          aria-label="Prospecta"
          className={`flex items-center gap-2 font-bold tracking-tight text-foreground ${compactOnMobile ? "min-h-11 min-w-11 justify-center focus-visible:outline-2 focus-visible:outline-primary sm:min-h-0 sm:min-w-0 sm:justify-start" : ""}`}
        >
          <Sparkles className="h-5 w-5 text-primary" aria-hidden />
          <span className={compactOnMobile ? "hidden sm:inline" : undefined}>
            Prospecta
          </span>
        </Link>
      </div>

      <nav
        aria-label="Navegação principal"
        className={`flex-1 py-4 ${compactOnMobile ? "px-2 sm:px-3" : "px-3"}`}
      >
        <ul className="space-y-1">
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-label={item.label}
                  title={item.label}
                  className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${compactOnMobile ? "min-h-11 justify-center focus-visible:outline-2 focus-visible:outline-primary sm:min-h-0 sm:justify-start" : ""} ${
                    isActive
                      ? "bg-[color-mix(in_oklab,var(--primary)_10%,transparent)] text-primary"
                      : "text-secundary hover:bg-sidebar-hover hover:text-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                  <span
                    className={compactOnMobile ? "hidden sm:inline" : undefined}
                  >
                    {item.label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div
        className={`border-t border-sidebar-hover p-4 ${compactOnMobile ? "hidden sm:block" : ""}`}
      >
        <div className="text-sm font-medium text-foreground">Usuário</div>

        <div className="mt-1 text-xs text-secundary">Minha conta</div>
      </div>
    </aside>
  );
}
