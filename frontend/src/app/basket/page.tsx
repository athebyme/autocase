import type { Metadata } from "next";

import { BasketView } from "@/components/basket-view";

export const metadata: Metadata = {
  title: "Корзина",
};

export default function BasketPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Корзина</h1>
      <div className="mt-8">
        <BasketView />
      </div>
    </div>
  );
}
