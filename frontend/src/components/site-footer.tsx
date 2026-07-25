"use client";

import Link from "next/link";

import { useSuppliers } from "@/lib/hooks";

export function SiteFooter() {
  const { data } = useSuppliers();
  const suppliers = data?.suppliers ?? [];
  // Пока данные демонстрационные, об этом нужно сказать прямо — но один раз
  // и мелким шрифтом, а не техническими сводками на каждом экране.
  const demo = suppliers.length > 0 && suppliers.every((supplier) => !supplier.live);

  return (
    <footer className="mt-20 border-t border-rule">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-8 gap-y-4 px-4 py-8 sm:px-6">
        <p className="text-[0.6875rem] leading-[1.05] font-black tracking-[0.02em] uppercase">
          Авто
          <br />
          Континент
        </p>

        <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
          <Link href="/" className="transition-colors hover:text-ink">
            Поиск
          </Link>
          <Link href="/basket" className="transition-colors hover:text-ink">
            Корзина
          </Link>
          <Link href="/orders" className="transition-colors hover:text-ink">
            Заказы
          </Link>
        </nav>

        {demo ? (
          <p className="ml-auto text-xs text-faint">
            Демонстрационный режим: цены и наличие показаны для примера
          </p>
        ) : null}
      </div>
    </footer>
  );
}
