"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/components/ui";
import { openCommandPalette } from "@/lib/command-bus";
import { formatPrice } from "@/lib/format";
import { useBasket } from "@/lib/hooks";

const NAV = [
  { href: "/", label: "Поиск" },
  { href: "/orders", label: "Заказы" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const { data: basket } = useBasket();
  const count = basket?.units ?? 0;
  const total = basket?.total ?? 0;

  return (
    <header className="sticky top-0 z-50 border-b border-rule bg-paper/95 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:gap-6 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5" aria-label="На главную">
          <Mark />
          <span className="hidden text-[0.6875rem] leading-[1.05] font-black tracking-[0.02em] uppercase sm:block">
            Авто
            <br />
            Континент
          </span>
        </Link>

        <nav className="flex items-stretch self-stretch">
          {NAV.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/" || pathname.startsWith("/part") || pathname.startsWith("/search")
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative flex items-center px-3 text-sm font-medium transition-colors sm:px-4",
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
            aria-label="Быстрый поиск по номеру"
            className="grid h-9 w-9 place-items-center border border-rule text-muted transition-colors hover:border-ink hover:text-ink"
          >
            <SearchIcon />
          </button>

          <ThemeToggle />

          <Link
            href="/basket"
            className={cn(
              "flex h-9 items-center gap-2.5 border px-3 text-sm font-medium transition-colors",
              count > 0
                ? "border-accent bg-accent text-accent-ink"
                : "border-rule text-muted hover:border-ink hover:text-ink",
            )}
          >
            <CartIcon />
            {count > 0 ? (
              <span className="num tabular-nums">
                {formatPrice(total)} <span className="opacity-70">₽</span>
              </span>
            ) : (
              <span className="hidden sm:inline">Корзина</span>
            )}
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
      <path d="M16 2.5 28 9.25v13.5L16 29.5 4 22.75V9.25z" className="fill-ink" />
      <path d="M16 9.5 22 13v6l-6 3.5L10 19v-6z" className="fill-paper" />
      <rect x="14.75" y="12.5" width="2.5" height="7" className="fill-accent" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <circle cx="9" cy="9" r="6" />
      <path d="M13.5 13.5 17 17" strokeLinecap="round" />
    </svg>
  );
}

function CartIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path d="M3 4h2l2 9h9l2-6H6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="9" cy="16.5" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="15" cy="16.5" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}
