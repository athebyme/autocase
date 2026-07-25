import type { Metadata } from "next";

import { BasketView } from "@/components/basket-view";
import { SectionLabel } from "@/components/ui";

export const metadata: Metadata = {
  title: "Корзина",
  description: "Позиции к заказу, сгруппированные по поставщикам.",
};

export default function BasketPage() {
  return (
    <div className="mx-auto max-w-[104rem] px-4 py-10 sm:px-6 sm:py-12">
      <SectionLabel index="01" aside="корзина ведётся на стороне поставщика">
        Заказ
      </SectionLabel>

      <h1 className="mt-6 text-[clamp(2.5rem,7vw,5rem)] leading-[0.9] font-black tracking-[-0.04em] uppercase">
        Корзина
      </h1>

      <div className="mt-10">
        <BasketView />
      </div>
    </div>
  );
}
