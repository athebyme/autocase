"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/components/ui";
import { useBasket } from "@/lib/hooks";
import { openCommandPalette } from "@/lib/command-bus";

const NAV = [
  { href: "/", label: "Подбор" },
  { href: "/orders", label: "Заказы" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const { data: basket } = useBasket();
  const count = basket?.positions ?? 0;

  return (
    <header className="sticky top-0 z-50 border-b border-rule bg-paper/95 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-[104rem] items-center gap-4 px-4 sm:px-6">
        <Link href="/" className="group flex items-center gap-3" aria-label="На главную">
          <Mark />
          <span className="hidden text-[0.6875rem] leading-[1.05] font-black tracking-[0.02em] uppercase sm:block">
            Авто
            <br />
            Континент
          </span>
        </Link>

        <nav className="ml-2 flex items-stretch self-stretch sm:ml-6">
          {NAV.map((item) => {
            const active =
              item.href === "/" ? pathname === "/" || pathname.startsWith("/part") : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative flex items-center px-3 text-[0.6875rem] font-semibold tracking-[0.16em] uppercase transition-colors sm:px-4",
                  active ? "text-ink" : "text-muted hover:text-ink",
                )}
              >
                {item.label}
                {active ? (
                  <span aria-hidden className="absolute inset-x-2 bottom-0 h-[3px] bg-accent sm:inset-x-3" />
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={openCommandPalette}
            className="hidden h-9 items-center gap-2 border border-rule px-3 text-muted transition-colors hover:border-ink hover:text-ink md:flex"
          >
            <span className="text-[0.6875rem] tracking-[0.1em] uppercase">Найти артикул</span>
            <kbd className="num border border-rule px-1 text-[0.625rem] text-faint">⌘K</kbd>
          </button>

          <ThemeToggle />

          <Link
            href="/basket"
            className={cn(
              "relative flex h-9 items-center gap-2 border px-3 transition-colors",
              count > 0
                ? "border-accent bg-accent text-accent-ink"
                : "border-rule text-muted hover:border-ink hover:text-ink",
            )}
          >
            <span className="text-[0.6875rem] font-semibold tracking-[0.14em] uppercase">Корзина</span>
            <span className="num text-[0.6875rem] tabular-nums">{count}</span>
          </Link>
        </div>
      </div>
    </header>
  );
}

/** Знак: гайка-шестигранник с прорезью — читается и в 20 px. */
function Mark() {
  return (
    <svg viewBox="0 0 32 32" className="h-7 w-7 shrink-0" aria-hidden>
      <path
        d="M16 2.5 28 9.25v13.5L16 29.5 4 22.75V9.25z"
        className="fill-ink"
      />
      <path d="M16 9.5 22 13v6l-6 3.5L10 19v-6z" className="fill-paper" />
      <rect x="14.75" y="12.5" width="2.5" height="7" className="fill-accent" />
    </svg>
  );
}
