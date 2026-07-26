import type { Metadata } from "next";

import { BasketView } from "@/components/basket-view";

export const metadata: Metadata = {
  title: "Корзина",
};

export default function BasketPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="border-b-2 border-ink pb-5">
        <p className="text-xs font-bold tracking-[0.14em] text-muted uppercase">Ваш заказ</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Корзина</h1>
      </div>
      <div className="mt-8">
        <BasketView />
      </div>
    </div>
  );
}
