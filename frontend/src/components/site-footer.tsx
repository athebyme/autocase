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
    <footer className="mt-20 border-t-4 border-graphite bg-surface">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1.3fr_1fr_1fr]">
        <div>
          <p className="text-xl font-black tracking-[-0.04em] uppercase">Автокейс</p>
          <p className="mt-1 text-xs font-bold tracking-[0.2em] text-muted uppercase">Запчасти</p>
          <p className="mt-5 max-w-sm text-sm leading-relaxed text-muted">
            Интернет-магазин автозапчастей для частных клиентов и автосервисов.
            Подбираем по артикулу, показываем реальные сроки и остатки поставщика.
          </p>
        </div>

        <div>
          <p className="text-xs font-bold tracking-[0.12em] uppercase">Магазин</p>
          <nav className="mt-4 grid gap-2 text-sm text-muted">
            <Link href="/" className="transition-colors hover:text-ink">Подбор запчастей</Link>
            <Link href="/account" className="transition-colors hover:text-ink">Личный кабинет</Link>
            <Link href="/basket" className="transition-colors hover:text-ink">Корзина</Link>
            <Link href="/orders" className="transition-colors hover:text-ink">Мои заказы</Link>
          </nav>
        </div>

        <div>
          <p className="text-xs font-bold tracking-[0.12em] uppercase">Пункт выдачи</p>
          <p className="mt-4 text-sm leading-relaxed text-muted">
            Токсово, Ленинградская область
            <br />
            Ленинградское ш., д. 13А
            <br />
            Ежедневно 10:00–21:00
            <br />
            <a href="tel:+79110141751" className="transition-colors hover:text-ink">
              +7 (911) 014-17-51
            </a>
          </p>
        </div>
      </div>

      <div className="border-t border-rule">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 text-xs text-faint sm:px-6">
          <p>© 2026 ООО «АВТОКЕЙС»</p>
          {demo ? <p>Демо-данные · ключи поставщика не заданы</p> : <p>Цены и наличие обновляются при поиске</p>}
        </div>
      </div>
    </footer>
  );
}
