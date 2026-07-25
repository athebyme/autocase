import type { Metadata } from "next";

import { OrdersView } from "@/components/orders-view";

export const metadata: Metadata = {
  title: "Заказы",
};

export default function OrdersPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Заказы</h1>
      <div className="mt-8">
        <OrdersView />
      </div>
    </div>
  );
}
