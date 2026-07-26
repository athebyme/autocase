import type { Metadata } from "next";

import { AccountView } from "@/components/account-view";

export const metadata: Metadata = {
  title: "Личный кабинет",
  description: "Профиль покупателя, автомобиль, доставка, корзина и история заказов.",
};

export default function AccountPage() {
  return (
    <div className="mx-auto min-w-0 max-w-7xl overflow-x-clip px-4 py-8 sm:px-6 sm:py-12">
      <header className="border-b-2 border-graphite pb-5">
        <p className="text-xs font-bold tracking-[0.14em] text-accent uppercase">
          Автокейс Запчасти
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
          Личный кабинет
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
          Контактные данные, ваш автомобиль, способ получения и состояние заказов в
          одном месте.
        </p>
      </header>
      <div className="mt-8">
        <AccountView />
      </div>
    </div>
  );
}
