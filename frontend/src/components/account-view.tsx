"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { useToast } from "@/components/toast";
import { Price, cn } from "@/components/ui";
import {
  DELIVERY_METHODS,
  saveAccountProfile,
  useAccountProfile,
} from "@/lib/account-store";
import { api } from "@/lib/api";
import { formatDate, plural } from "@/lib/format";
import { useBasket } from "@/lib/hooks";
import type { OrderStage } from "@/lib/types";

const ACTIVE_STAGES: OrderStage[] = ["pending", "blocked", "processing", "transit"];

function dateFrom(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

function field(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
}

export function AccountView() {
  const toast = useToast();
  const profile = useAccountProfile();
  const { data: basket } = useBasket();
  const { data: orderData, isLoading: ordersLoading } = useQuery({
    queryKey: ["orders", "account", dateFrom(90)],
    queryFn: () => api.orders(dateFrom(90)),
  });
  const orders = orderData?.orders ?? [];
  const activeOrders = orders.filter((order) => ACTIVE_STAGES.includes(order.stage));
  const selectedDelivery =
    DELIVERY_METHODS.find((method) => method.id === profile.delivery_method) ??
    DELIVERY_METHODS[0];

  function saveContacts(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    saveAccountProfile({
      full_name: field(data, "full_name"),
      phone: field(data, "phone"),
      email: field(data, "email"),
    });
    toast.ok("Контакты сохранены");
  }

  function saveVehicle(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    saveAccountProfile({
      vehicle_label: field(data, "vehicle_label"),
      vehicle_vin: field(data, "vehicle_vin").toUpperCase().replace(/\s/g, ""),
    });
    toast.ok("Автомобиль сохранён");
  }

  function saveAddress(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    saveAccountProfile({ delivery_address: field(data, "delivery_address") });
    toast.ok("Адрес сохранён");
  }

  return (
    <div className="grid min-w-0 gap-7 lg:grid-cols-[14rem_minmax(0,1fr)]">
      <aside className="min-w-0 border border-rule-strong bg-surface lg:sticky lg:top-28 lg:self-start">
        <div className="border-b border-rule p-5">
          <p className="text-xs font-bold tracking-[0.1em] text-accent uppercase">
            Профиль покупателя
          </p>
          <p className="mt-3 font-bold">{profile.full_name || "Ваш кабинет"}</p>
          <p className="mt-1 text-xs text-muted">
            {profile.phone || "Добавьте телефон для связи"}
          </p>
        </div>
        <nav className="text-sm" aria-label="Разделы кабинета">
          <a href="#overview" className="block border-b border-rule px-5 py-3 hover:text-accent">
            Обзор
          </a>
          <a href="#profile" className="block border-b border-rule px-5 py-3 hover:text-accent">
            Контактные данные
          </a>
          <a href="#vehicle" className="block border-b border-rule px-5 py-3 hover:text-accent">
            Мой автомобиль
          </a>
          <a href="#delivery" className="block border-b border-rule px-5 py-3 hover:text-accent">
            Получение заказа
          </a>
          <Link href="/orders" className="block px-5 py-3 hover:text-accent">
            Все заказы →
          </Link>
        </nav>
      </aside>

      <div className="min-w-0 space-y-7">
        <section id="overview">
          <div className="grid border-t border-l border-rule sm:grid-cols-3">
            <AccountStat
              label="В корзине"
              value={basket ? `${basket.units}` : "—"}
              hint={
                basket
                  ? plural(basket.units, "товар", "товара", "товаров")
                  : "загрузка"
              }
              href="/basket"
            />
            <AccountStat
              label="Активные заказы"
              value={ordersLoading ? "—" : `${activeOrders.length}`}
              hint="в работе и в пути"
              href="/orders"
            />
            <AccountStat
              label="Способ получения"
              value={selectedDelivery.title}
              hint={profile.delivery_address || "адрес можно указать ниже"}
              href="#delivery"
              compact
            />
          </div>
        </section>

        <section id="profile" className="border border-rule-strong bg-paper">
          <SectionHeader
            index="01"
            title="Контактные данные"
            description="Нужны менеджеру для подтверждения заказа и доставки."
          />
          <form
            onSubmit={saveContacts}
            className="grid min-w-0 gap-4 p-5 sm:grid-cols-2 sm:p-6"
          >
            <AccountField
              name="full_name"
              label="Имя и фамилия"
              defaultValue={profile.full_name}
              autoComplete="name"
              placeholder="Как к вам обращаться"
            />
            <AccountField
              name="phone"
              label="Телефон"
              defaultValue={profile.phone}
              autoComplete="tel"
              inputMode="tel"
              placeholder="+7 900 000-00-00"
            />
            <AccountField
              name="email"
              label="Электронная почта"
              defaultValue={profile.email}
              autoComplete="email"
              inputMode="email"
              type="email"
              placeholder="mail@example.ru"
            />
            <div className="flex items-end">
              <SaveButton />
            </div>
          </form>
        </section>

        <section id="vehicle" className="border border-rule-strong bg-paper">
          <SectionHeader
            index="02"
            title="Мой автомобиль"
            description="VIN подставляется в кабинете, чтобы не искать его каждый раз."
          />
          <form
            onSubmit={saveVehicle}
            className="grid min-w-0 gap-4 p-5 sm:grid-cols-2 sm:p-6"
          >
            <AccountField
              name="vehicle_label"
              label="Автомобиль"
              defaultValue={profile.vehicle_label}
              placeholder="Например, Volkswagen Tiguan 2020"
            />
            <AccountField
              name="vehicle_vin"
              label="VIN"
              defaultValue={profile.vehicle_vin}
              minLength={17}
              maxLength={17}
              pattern="[A-HJ-NPR-Z0-9]{17}"
              className="num uppercase"
              placeholder="17 символов"
            />
            <div className="sm:col-span-2 flex flex-wrap gap-3">
              <SaveButton />
              {profile.vehicle_vin ? (
                <Link
                  href="/#parts-search"
                  className="inline-flex h-11 items-center border border-rule-strong px-5 text-xs font-semibold uppercase transition-colors hover:border-accent hover:text-accent"
                >
                  Подобрать по этому VIN
                </Link>
              ) : null}
            </div>
          </form>
        </section>

        <section id="delivery" className="border border-rule-strong bg-paper">
          <SectionHeader
            index="03"
            title="Получение заказа"
            description="Этот вариант будет заранее выбран при оформлении корзины."
          />
          <div className="grid border-b border-rule md:grid-cols-3">
            {DELIVERY_METHODS.map((method) => {
              const selected = profile.delivery_method === method.id;
              return (
                <button
                  key={method.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => saveAccountProfile({ delivery_method: method.id })}
                  className={cn(
                    "min-h-28 border-b border-rule p-4 text-left transition-colors md:border-r md:border-b-0 md:last:border-r-0",
                    selected
                      ? "bg-accent-soft text-ink"
                      : "bg-paper text-muted hover:text-ink",
                  )}
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className="font-bold">{method.title}</span>
                    <span
                      aria-hidden
                      className={cn(
                        "grid h-4 w-4 place-items-center border",
                        selected ? "border-accent" : "border-rule-strong",
                      )}
                    >
                      {selected ? <span className="h-2 w-2 bg-accent" /> : null}
                    </span>
                  </span>
                  <span className="mt-2 block text-xs leading-relaxed">
                    {method.description}
                  </span>
                </button>
              );
            })}
          </div>
          <form onSubmit={saveAddress} className="p-5 sm:p-6">
            <label className="block">
              <span className="text-xs font-semibold tracking-[0.08em] uppercase">
                Адрес доставки
              </span>
              <textarea
                name="delivery_address"
                defaultValue={profile.delivery_address}
                rows={3}
                placeholder="Населённый пункт, улица, дом, квартира или офис"
                className="mt-2 w-full resize-y border border-rule-strong bg-paper px-4 py-3 text-sm outline-none transition-colors placeholder:text-faint focus:border-accent"
              />
            </label>
            <div className="mt-4">
              <SaveButton />
            </div>
          </form>
        </section>

        <section className="border border-rule-strong bg-surface">
          <SectionHeader
            index="04"
            title="Последние заказы"
            description="История за последние 90 дней от подключённых поставщиков."
          />
          {ordersLoading ? (
            <p className="p-5 text-sm text-muted">Загружаем заказы…</p>
          ) : orders.length ? (
            <ul>
              {orders.slice(0, 3).map((order) => (
                <li
                  key={order.id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-rule px-5 py-4 last:border-b-0"
                >
                  <span className="font-semibold">
                    Заказ <span className="num">№ {order.order_id}</span>
                  </span>
                  <span className="text-xs text-faint">{formatDate(order.created_at)}</span>
                  <span className="ml-auto">
                    <Price value={order.total} currency={order.currency} />
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-4 p-5">
              <p className="text-sm text-muted">Заказов пока нет.</p>
              <Link href="/" className="text-xs font-bold text-accent">
                Найти запчасть →
              </Link>
            </div>
          )}
        </section>

        <p className="border-l-2 border-rule-strong pl-4 text-xs leading-relaxed text-faint">
          Контакты, автомобиль и адрес хранятся только в этом браузере. Заказы и корзина
          загружаются через API поставщиков.
        </p>
      </div>
    </div>
  );
}

function AccountStat({
  label,
  value,
  hint,
  href,
  compact = false,
}: {
  label: string;
  value: string;
  hint: string;
  href: string;
  compact?: boolean;
}) {
  return (
    <Link
      href={href}
      className="group min-h-32 border-r border-b border-rule bg-paper p-5 transition-colors hover:border-b-accent"
    >
      <span className="block text-[0.625rem] font-bold tracking-[0.1em] text-muted uppercase">
        {label}
      </span>
      <span
        className={cn(
          "mt-3 block font-logo font-black group-hover:text-accent",
          compact ? "text-lg" : "num text-3xl",
        )}
      >
        {value}
      </span>
      <span className="mt-1 block truncate text-xs text-faint">{hint}</span>
    </Link>
  );
}

function SectionHeader({
  index,
  title,
  description,
}: {
  index: string;
  title: string;
  description: string;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3 border-b border-rule p-5 sm:px-6">
      <div>
        <p className="num text-[0.625rem] font-bold tracking-[0.12em] text-accent uppercase">
          {index}
        </p>
        <h2 className="mt-2 text-xl font-black">{title}</h2>
      </div>
      <p className="max-w-sm text-xs leading-relaxed text-muted">{description}</p>
    </header>
  );
}

function AccountField({
  label,
  className,
  ...props
}: React.ComponentProps<"input"> & { label: string }) {
  return (
    <label className="block min-w-0">
      <span className="text-xs font-semibold tracking-[0.08em] uppercase">{label}</span>
      <input
        {...props}
        className={cn(
          "mt-2 h-11 min-w-0 w-full border border-rule-strong bg-paper px-4 text-sm outline-none transition-colors placeholder:text-faint focus:border-accent",
          className,
        )}
      />
    </label>
  );
}

function SaveButton() {
  return (
    <button
      type="submit"
      className="h-11 bg-accent px-5 text-xs font-semibold text-accent-ink uppercase transition-colors hover:bg-graphite"
    >
      Сохранить
    </button>
  );
}
