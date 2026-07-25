import type { Metadata } from "next";

import { OrdersView } from "@/components/orders-view";
import { SectionLabel } from "@/components/ui";

export const metadata: Metadata = {
  title: "Заказы",
  description: "История заказов со статусом каждой строки.",
};

export default function OrdersPage() {
  return (
    <div className="mx-auto max-w-[104rem] px-4 py-10 sm:px-6 sm:py-12">
      <SectionLabel index="01" aside="статусы приходят от поставщика">
        История
      </SectionLabel>

      <h1 className="mt-6 text-[clamp(2.5rem,7vw,5rem)] leading-[0.9] font-black tracking-[-0.04em] uppercase">
        Заказы
      </h1>

      <div className="mt-10">
        <OrdersView />
      </div>
    </div>
  );
}
