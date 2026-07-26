"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/components/ui";
import { openCommandPalette } from "@/lib/command-bus";
import { formatPrice } from "@/lib/format";
import { useBasket } from "@/lib/hooks";

const NAV = [
  { href: "/#catalog", label: "Каталог запчастей" },
  { href: "/#parts-search", label: "Подбор по VIN" },
  { href: "/#popular", label: "Популярные товары" },
  { href: "/#how-to-order", label: "Как заказать" },
  { href: "/account", label: "Личный кабинет" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const { data: basket } = useBasket();
  const count = basket?.units ?? 0;
  const total = basket?.total ?? 0;

  return (
    <header className="sticky top-0 z-50 border-b border-rule-strong bg-paper/98 backdrop-blur-sm">
      <div className="hidden border-b border-rule bg-surface md:block">
        <div className="mx-auto flex h-9 max-w-7xl items-center justify-between px-6 text-xs text-muted">
          <div className="flex items-center gap-5">
            <span>Токсово, Ленинградское ш., 13А</span>
            <span>Ежедневно 10:00–21:00</span>
          </div>
          <div className="flex items-center gap-5">
            <Link href="/account" className="transition-colors hover:text-ink">
              Личный кабинет
            </Link>
            <a
              href="https://avtoservis-toksovo.ru/"
              target="_blank"
              rel="noreferrer"
              className="transition-colors hover:text-ink"
            >
              Автосервис
            </a>
          </div>
        </div>
      </div>

      <div className="mx-auto flex h-[4.75rem] max-w-7xl items-center gap-3 px-4 sm:gap-6 sm:px-6">
        <Link href="/" className="group flex min-w-0 shrink items-center gap-2.5 sm:shrink-0 sm:gap-3" aria-label="Автокейс Запчасти — на главную">
          <Mark />
          <span className="leading-none">
            <span className="font-logo block text-lg font-black tracking-[-0.045em] uppercase sm:text-xl">
              Автокейс
            </span>
            <span className="font-logo mt-1 block text-[0.5625rem] font-bold tracking-[0.24em] text-muted uppercase">
              Запчасти
            </span>
          </span>
        </Link>

        <button
          type="button"
          onClick={openCommandPalette}
          className="hidden h-11 min-w-0 max-w-xl flex-1 items-center border border-rule-strong bg-paper text-left text-sm text-faint transition-colors hover:border-ink md:flex"
        >
          <span className="grid h-full w-11 shrink-0 place-items-center border-r border-rule">
            <SearchIcon />
          </span>
          <span className="truncate px-4">Поиск по артикулу или OEM-номеру</span>
          <kbd className="num mr-3 ml-auto border border-rule bg-paper px-2 py-1 text-[0.625rem] text-faint">
            Ctrl K
          </kbd>
        </button>

        <div className="ml-auto hidden shrink-0 items-center gap-3 lg:flex">
          <span className="text-right text-xs leading-tight text-muted">
            Нужна помощь?
            <a href="tel:+79110141751" className="mt-1 block text-sm font-bold text-ink">
              +7 (911) 014-17-51
            </a>
          </span>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={openCommandPalette}
            aria-label="Быстрый поиск по номеру"
            className="grid h-9 w-9 place-items-center border border-rule text-muted transition-colors hover:border-ink hover:text-ink md:hidden"
          >
            <SearchIcon />
          </button>

          <div className="hidden sm:block">
            <ThemeToggle />
          </div>

          <Link
            href="/account"
            aria-label="Личный кабинет"
            className="grid h-9 w-9 place-items-center border border-rule text-muted transition-colors hover:border-ink hover:text-ink"
          >
            <UserIcon />
          </Link>

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
              <span className="num hidden tabular-nums sm:inline">
                {formatPrice(total)} <span className="opacity-70">₽</span>
              </span>
            ) : (
              <span className="hidden sm:inline">Корзина</span>
            )}
          </Link>
        </div>
      </div>

      <nav className="hidden bg-accent text-accent-ink md:block">
        <div className="mx-auto flex h-12 max-w-7xl items-stretch px-6">
          {NAV.map((item, index) => {
            const active = item.href === "/account" && pathname.startsWith("/account");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex h-full items-center border-r border-paper/20 px-5 text-sm font-semibold transition-colors first:border-l first:border-paper/20",
                  index === 0
                    ? "bg-graphite text-graphite-ink hover:bg-paper hover:text-ink"
                    : active
                      ? "bg-paper text-accent"
                      : "text-accent-ink hover:bg-ink hover:text-paper",
                )}
              >
                {item.label}
              </Link>
            );
          })}
          <span className="ml-auto flex h-full items-center text-xs font-semibold text-accent-ink">
            Запчасти в наличии и под заказ
          </span>
        </div>
      </nav>
    </header>
  );
}

function Mark() {
  return (
    <span
      className="font-logo relative grid h-9 w-10 shrink-0 place-items-center overflow-hidden bg-graphite text-sm font-black tracking-[-0.08em] text-graphite-ink"
      aria-hidden
    >
      <span className="absolute inset-y-0 left-0 w-1 bg-accent" />
      АК
    </span>
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

function UserIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.7}>
      <circle cx="10" cy="6.5" r="3" />
      <path d="M4.5 17c.4-3.2 2.3-5 5.5-5s5.1 1.8 5.5 5" strokeLinecap="round" />
    </svg>
  );
}
