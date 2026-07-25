"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";

import { IssuesBanner } from "@/components/issues-banner";
import { Button, Empty, Pill, Price, SkeletonRow, cn } from "@/components/ui";
import { api } from "@/lib/api";
import {
  STAGE_LABELS,
  STAGE_PROGRESS,
  STAGE_TONE,
  formatDate,
  formatDateTime,
  plural,
} from "@/lib/format";
import type { Order, OrderStage } from "@/lib/types";

const PERIODS = [
  { days: 7, label: "7 дней" },
  { days: 30, label: "30 дней" },
  { days: 90, label: "3 месяца" },
] as const;

function since(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

export function OrdersView() {
  const [days, setDays] = useState<number>(30);
  const dateFrom = since(days);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["orders", dateFrom],
    queryFn: () => api.orders(dateFrom),
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-2">
        <span className="num text-[0.625rem] tracking-[0.16em] text-faint uppercase">Период</span>
        {PERIODS.map((period) => (
          <button
            key={period.days}
            type="button"
            onClick={() => setDays(period.days)}
            aria-pressed={days === period.days}
            className={cn(
              "border px-3 py-1.5 text-[0.6875rem] font-semibold tracking-[0.12em] uppercase transition-colors",
              days === period.days
                ? "border-ink bg-ink text-paper"
                : "border-rule text-muted hover:border-ink hover:text-ink",
            )}
          >
            {period.label}
          </button>
        ))}
        <span className="num ml-auto text-[0.625rem] text-faint">
          глубина истории у поставщика ограничена
        </span>
      </div>

      {isLoading ? (
        <div className="border border-rule">
          {Array.from({ length: 3 }).map((_, index) => (
            <SkeletonRow key={index} columns={4} />
          ))}
        </div>
      ) : isError || !data ? (
        <Empty
          title="История недоступна"
          hint="Не удалось получить заказы у поставщика."
          action={
            <Button variant="outline" onClick={() => refetch()}>
              Повторить
            </Button>
          }
        />
      ) : !data.orders.length ? (
        <Empty
          title="Заказов за период нет"
          hint="Оформите заказ из корзины — он появится здесь вместе со статусом каждой строки."
          action={
            <Link
              href="/"
              className="border border-ink px-5 py-2.5 text-[0.6875rem] font-semibold tracking-[0.14em] uppercase transition-colors hover:bg-ink hover:text-paper"
            >
              К подбору
            </Link>
          }
        />
      ) : (
        <div className="space-y-4">
          {data.issues.length ? <IssuesBanner issues={data.issues} /> : null}
          {data.orders.map((order) => (
            <OrderCard key={order.id} order={order} />
          ))}
        </div>
      )}
    </div>
  );
}

function OrderCard({ order }: { order: Order }) {
  const [open, setOpen] = useState(false);
  const tone = STAGE_TONE[order.stage];

  return (
    <article className="border border-rule">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className="flex w-full flex-wrap items-center gap-x-5 gap-y-2 px-4 py-4 text-left transition-colors hover:bg-surface/60 sm:px-5"
      >
        <span aria-hidden className={cn("text-faint transition-transform", open && "rotate-90")}>
          ▸
        </span>

        <span className="num text-base font-medium tracking-[0.04em]">№ {order.order_id}</span>

        <span className="text-xs text-muted">{formatDate(order.created_at)}</span>

        <Pill tone={tone} solid={order.stage === "failed" || order.stage === "blocked"}>
          {STAGE_LABELS[order.stage]}
        </Pill>

        <span className="hidden text-xs text-faint sm:inline">
          {order.positions} {plural(order.positions, "позиция", "позиции", "позиций")} ·{" "}
          {order.units} {plural(order.units, "шт", "шт", "шт")}
        </span>

        <span className="ml-auto flex items-center gap-5">
          <StageBar stage={order.stage} />
          <Price value={order.total} currency={order.currency} size="md" />
        </span>
      </button>

      {open ? (
        <div className="border-t border-rule">
          <div className="hidden grid-cols-[2.2fr_1.2fr_1.3fr_0.8fr_1fr] items-center gap-6 border-b border-rule px-5 py-2 text-[0.625rem] tracking-[0.16em] text-faint uppercase lg:grid">
            <span>Позиция</span>
            <span>Склад</span>
            <span>Статус</span>
            <span>Кол-во</span>
            <span className="text-right">Сумма</span>
          </div>

          <ul>
            {order.lines.map((line) => (
              <li key={line.id} className="border-b border-rule last:border-b-0">
                <div className="grid gap-2 px-4 py-3.5 sm:px-5 lg:grid-cols-[2.2fr_1.2fr_1.3fr_0.8fr_1fr] lg:items-center lg:gap-6">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-baseline gap-x-3">
                      <Link
                        href={`/part/${encodeURIComponent(line.part_id)}`}
                        className="num text-sm font-medium tracking-[0.04em] transition-colors hover:text-accent"
                      >
                        {line.part_code}
                      </Link>
                      <span className="text-[0.625rem] font-semibold tracking-[0.14em] text-muted uppercase">
                        {line.brand}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted">{line.part_name}</p>
                  </div>

                  <span className="text-xs text-muted">{line.warehouse_name}</span>

                  <span className="text-xs">
                    <span className={cn("inline-flex items-center gap-2")}>
                      <span
                        aria-hidden
                        className={cn("h-1.5 w-1.5 rounded-full", DOT[line.stage])}
                      />
                      {line.state_label}
                    </span>
                  </span>

                  <span className="num text-xs tabular-nums">
                    {line.quantity} {line.unit}
                    {line.reserved_quantity !== line.quantity ? (
                      <span
                        className="ml-1 text-warning"
                        title={`Зарезервировано: ${line.reserved_quantity}`}
                      >
                        ({line.reserved_quantity})
                      </span>
                    ) : null}
                  </span>

                  <span className="lg:text-right">
                    <Price value={line.total} currency={line.currency} size="sm" />
                  </span>
                </div>
              </li>
            ))}
          </ul>

          <dl className="grid gap-x-8 gap-y-1 border-t border-rule px-5 py-3 text-xs sm:grid-cols-2">
            <Meta term="Оформлен" value={formatDateTime(order.created_at)} />
            <Meta term="Поставщик" value={order.supplier_name} />
            {order.contract_name ? <Meta term="Договор" value={order.contract_name} /> : null}
            {order.address_name ? <Meta term="Адрес доставки" value={order.address_name} /> : null}
          </dl>
        </div>
      ) : null}
    </article>
  );
}

const DOT: Record<OrderStage, string> = {
  pending: "bg-faint",
  blocked: "bg-warning",
  processing: "bg-accent",
  transit: "bg-accent",
  done: "bg-positive",
  failed: "bg-critical",
};

/** Шкала продвижения заказа: короткая, но сразу читается взглядом. */
function StageBar({ stage }: { stage: OrderStage }) {
  const width = `${Math.round(STAGE_PROGRESS[stage] * 100)}%`;
  const failed = stage === "failed";

  return (
    <span className="hidden h-1 w-24 bg-rule sm:block" aria-hidden>
      <span
        className={cn("block h-full", failed ? "bg-critical" : stage === "done" ? "bg-positive" : "bg-accent")}
        style={{ width }}
      />
    </span>
  );
}

function Meta({ term, value }: { term: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="text-faint">{term}:</dt>
      <dd className="text-muted">{value}</dd>
    </div>
  );
}
