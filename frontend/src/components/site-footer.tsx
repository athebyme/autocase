"use client";

import { useSuppliers } from "@/lib/hooks";

export function SiteFooter() {
  const { data } = useSuppliers();
  const suppliers = data?.suppliers ?? [];
  const demo = suppliers.filter((supplier) => !supplier.live);

  return (
    <footer className="mt-24 border-t border-rule">
      <div className="mx-auto grid max-w-[104rem] gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1fr_auto]">
        <div>
          <p className="text-[0.6875rem] leading-[1.05] font-black tracking-[0.02em] uppercase">
            Авто
            <br />
            Континент
          </p>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-muted">
            Подбор запчастей по артикулу и OEM-номеру. Наличие на складах, сроки поставки и
            оформление заказа в один экран.
          </p>
        </div>

        <dl className="grid gap-x-8 gap-y-2 self-start text-xs sm:grid-cols-2">
          <dt className="text-faint">Поставщиков подключено</dt>
          <dd className="num text-ink">{suppliers.length || "—"}</dd>

          <dt className="text-faint">Источник данных</dt>
          <dd className="num text-ink">
            {suppliers.length === 0
              ? "—"
              : demo.length === suppliers.length
                ? "демо-режим"
                : demo.length
                  ? `частично демо (${demo.length})`
                  : "живой API"}
          </dd>

          <dt className="text-faint">Часовой пояс сроков</dt>
          <dd className="num text-ink">Europe/Moscow</dd>
        </dl>
      </div>

      <div className="sprocket h-px w-full" aria-hidden />
    </footer>
  );
}
