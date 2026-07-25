"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import { cn } from "@/components/ui";

const FILTERS = [
  { key: "analogs", label: "Аналоги", hint: "Показывать кросс-номера других брендов" },
  { key: "transit", label: "Транзит", hint: "Показывать позиции под заказ, которых нет на складе" },
] as const;

export function OfferFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  function toggle(key: string, next: boolean) {
    const updated = new URLSearchParams(params.toString());
    // Значение по умолчанию — «включено», поэтому в URL пишем только выключение.
    if (next) updated.delete(key);
    else updated.set(key, "0");
    startTransition(() => router.replace(`${pathname}?${updated}`, { scroll: false }));
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-2", pending && "opacity-60")}>
      {FILTERS.map((filter) => {
        const active = params.get(filter.key) !== "0";
        return (
          <button
            key={filter.key}
            type="button"
            title={filter.hint}
            aria-pressed={active}
            onClick={() => toggle(filter.key, !active)}
            className={cn(
              "flex items-center gap-2 border px-3 py-1.5 text-[0.6875rem] font-semibold tracking-[0.12em] uppercase transition-colors",
              active
                ? "border-ink bg-ink text-paper"
                : "border-rule text-muted hover:border-ink hover:text-ink",
            )}
          >
            <span
              aria-hidden
              className={cn("h-1.5 w-1.5", active ? "bg-accent" : "bg-rule-strong")}
            />
            {filter.label}
          </button>
        );
      })}
    </div>
  );
}
