"use client";
import { useEffect, useId, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";

export function MonthlyMonthPicker({
  month,
  max,
}: {
  month: string;
  max: string;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  useEffect(() => {
    if (input.current) input.current.value = month;
  }, [month]);
  return (
    <div className="min-w-0 shrink-0" aria-busy={pending}>
      <label htmlFor={id} className="sr-only">
        Mês de referência
      </label>
      <input
        ref={input}
        id={id}
        name="month"
        type="month"
        min="1000-01"
        max={max}
        required
        defaultValue={month}
        onChange={(event) => {
          const field = event.currentTarget;
          if (!field.validity.valid || !field.value || field.value === month)
            return;
          const url = new URL(window.location.href);
          url.searchParams.set("month", field.value);
          startTransition(() =>
            router.push(`${url.pathname}${url.search}${url.hash}`, {
              scroll: false,
            }),
          );
        }}
        onBlur={(event) => {
          if (!event.currentTarget.validity.valid)
            event.currentTarget.value = month;
        }}
        className="min-h-11 w-full rounded-lg border border-sidebar-hover bg-background px-3 text-sm text-foreground [color-scheme:dark] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:w-48"
      />
      <span role="status" className="sr-only">
        {pending ? "Atualizando período…" : ""}
      </span>
    </div>
  );
}
