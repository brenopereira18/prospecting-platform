"use client";

import { useState, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { LeadStatus } from "../../../generated/prisma/enums";
import { LEAD_STATUS_OPTIONS } from "@/src/constants/lead-status";
import type { CategoryDTO } from "../../server/categories/category.dto";

interface LeadFiltersProps {
  categories: CategoryDTO[];
}

export function LeadFilters({ categories }: LeadFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [name, setName] = useState(searchParams.get("name") ?? "");
  const [categoryId, setCategoryId] = useState(
    searchParams.get("categoryId") ?? "",
  );
  const [status, setStatus] = useState<LeadStatus | "">(
    (searchParams.get("status") as LeadStatus) ?? "",
  );

  function updateFilters(updates: {
    name?: string;
    categoryId?: string;
    status?: string;
  }) {
    const params = new URLSearchParams(searchParams.toString());

    Object.entries(updates).forEach(([key, value]) => {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    });

    const query = params.toString();

    router.replace(query ? `${pathname}?${query}` : pathname);
  }

  useEffect(() => {
    const timeout = setTimeout(() => {
      updateFilters({
        name: name.trim(),
      });
    }, 400);

    return () => {
      clearTimeout(timeout);
    };
  }, [name]);

  return (
    <section className="rounded-xl border border-sidebar-hover bg-terciary shadow">
      <div className="grid gap-4 p-6 md:grid-cols-3">
        <input
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Buscar por nome..."
          className="h-10 w-full rounded-lg border border-sidebar-hover bg-transparent px-3 text-sm outline-none transition-colors placeholder:text-secundary focus:border-primary"
        />

        <select
          value={categoryId}
          onChange={(event) => {
            const value = event.target.value;

            setCategoryId(value);

            updateFilters({
              categoryId: value,
            });
          }}
          className="h-10 w-full rounded-lg border border-sidebar-hover bg-terciary px-3 text-sm outline-none transition-colors focus:border-primary"
        >
          <option value="">Todas as categorias</option>

          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>

        <div className="relative">
          <select
            value={status}
            onChange={(event) => {
              const value = event.target.value as LeadStatus | "";

              setStatus(value);

              updateFilters({
                status: value,
              });
            }}
            className="h-10 w-full appearance-none rounded-lg border border-sidebar-hover bg-terciary px-3 pr-10 text-sm outline-none transition-colors focus:border-primary"
          >
            <option value="">Todos os status</option>

            {LEAD_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-secundary" />
        </div>
      </div>
    </section>
  );
}
