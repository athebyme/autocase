"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";

import { PartArt } from "@/components/part-art";
import { Button, Empty, Price, cn } from "@/components/ui";
import { api } from "@/lib/api";
import { STAGE_LABELS, formatDate, plural } from "@/lib/format";
import type { Order, OrderStage } from "@/lib/types";

const PERIODS = [
  { days: 7, label: "Неделя" },
  { days: 30, label: "Месяц" },
  { days: 90, label: "3 месяца" },
] as const;

const STAGE_DOT: Record<OrderStage, string> = {
  pending: "bg-faint",
  blocked: "bg-warning",
  processing: "bg-accent",
  transit: "bg-accent",
  done: "bg-positive",
  failed: "bg-critical",
};

const STAGE_TEXT: Record<OrderStage, string> = {
  pending: "text-muted",
  blocked: "text-warning",
  processing: "text-ink",
  transit: "text-ink",
  done: "text-positive",
  failed: "text-critical",
};

function since(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

export function OrdersView() {
  const [days, setDays] = useState<number>(30);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["orders", since(days)],
    queryFn: () => api.orders(since(days)),
  });

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap gap-2">
        {PERIODS.map((period) => (
          <button
            key={period.days}
            type="button"
            onClick={() => setDays(period.days)}
            aria-pressed={days === period.days}
            className={cn(
              "border px-4 py-2 text-sm transition-colors",
              days === period.days
                ? "border-ink bg-ink text-paper"
                : "border-rule text-muted hover:border-ink hover:text-ink",
            )}
          >
            {period.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, index) => (
            <div key={index} className="animate-pulse border border-rule p-5">
              <div className="h-4 w-48 bg-rule/60" />
              <div className="mt-5 h-12 w-full bg-rule/40" />
            </div>
          ))}
        </div>
      ) : isError || !data ? (
        <Empty
          title="Заказы не загрузились"
          hint="Попробуйте ещё раз."
          action={
            <Button variant="outline" onClick={() => refetch()}>
              Обновить
            </Button>
          }
        />
      ) : !data.orders.length ? (
        <Empty
          title="Заказов пока нет"
          hint="Оформите заказ из корзины — он появится здесь вместе со статусом."
          action={
            <Link
              href="/"
              className="border border-accent bg-accent px-6 py-3 text-sm font-semibold text-accent-ink transition-all hover:brightness-95"
            >
              Найти запчасть
            </Link>
          }
        />
      ) : (
        <div className="space-y-4">
          {data.orders.map((order) => (
            <OrderCard key={order.id} order={order} />
          ))}
        </div>
      )}
    </div>
  );
}

function OrderCard({ order }: { order: Order }) {
  return (
    <article className="border border-rule bg-surface/40">
      <header className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-rule px-5 py-4">
        <h2 className="font-semibold">
          Заказ <span className="num">№ {order.order_id}</span>
        </h2>
        <span className="text-sm text-faint">{formatDate(order.created_at)}</span>

        <span className="ml-auto flex items-center gap-2 text-sm">
          <span aria-hidden className={cn("h-2 w-2 rounded-full", STAGE_DOT[order.stage])} />
          <span className={cn("font-medium", STAGE_TEXT[order.stage])}>
            {STAGE_LABELS[order.stage]}
          </span>
        </span>
      </header>

      <ul>
        {order.lines.map((line) => (
          <li
            key={line.id}
            className="flex items-center gap-4 border-b border-rule px-5 py-4 last:border-b-0"
          >
            <Link
              href={`/part/${encodeURIComponent(line.part_id)}`}
              className="grid h-14 w-14 shrink-0 place-items-center border border-rule bg-paper"
            >
              <PartArt name={line.part_name} className="h-9 w-9" tone="muted" />
            </Link>

            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">
                <Link
                  href={`/part/${encodeURIComponent(line.part_id)}`}
                  className="transition-colors hover:text-accent"
                >
                  {line.part_name}
                </Link>
              </p>
              <p className="mt-0.5 text-sm text-faint">
                {line.brand} · {line.quantity} {plural(line.quantity, "шт", "шт", "шт")}
                {line.state_label !== STAGE_LABELS[order.stage] ? (
                  <span className="text-muted"> · {line.state_label}</span>
                ) : null}
              </p>
            </div>

            <Price value={line.total} currency={line.currency} size="md" />
          </li>
        ))}
      </ul>

      <footer className="flex items-baseline justify-between gap-4 border-t border-rule bg-sunken/30 px-5 py-3.5">
        <span className="text-sm text-muted">
          {order.units} {plural(order.units, "товар", "товара", "товаров")}
        </span>
        <Price value={order.total} currency={order.currency} size="md" />
      </footer>
    </article>
  );
}
