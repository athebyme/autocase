"use client";

import Link from "next/link";
import { useState } from "react";

import { Button, Empty, Pill, Price, SkeletonRow, Spinner, cn } from "@/components/ui";
import { formatDelivery, plural } from "@/lib/format";
import { useBasket, useBasketActions } from "@/lib/hooks";
import type { BasketLine, BasketSupplierGroup } from "@/lib/types";

export function BasketView() {
  const { data: basket, isLoading, isError, refetch } = useBasket();
  const { clear } = useBasketActions();

  if (isLoading) {
    return (
      <div className="border border-rule">
        {Array.from({ length: 4 }).map((_, index) => (
          <SkeletonRow key={index} columns={6} />
        ))}
      </div>
    );
  }

  if (isError || !basket) {
    return (
      <Empty
        title="Корзина недоступна"
        hint="Не удалось получить содержимое корзины у поставщика."
        action={
          <Button variant="outline" onClick={() => refetch()}>
            Повторить
          </Button>
        }
      />
    );
  }

  if (!basket.positions) {
    return (
      <Empty
        title="Корзина пуста"
        hint="Найдите деталь по артикулу и добавьте подходящее предложение — можно с разных складов сразу."
        action={
          <Link
            href="/"
            className="border border-ink px-5 py-2.5 text-[0.6875rem] font-semibold tracking-[0.14em] uppercase transition-colors hover:bg-ink hover:text-paper"
          >
            К подбору
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-8">
      {basket.stale_suppliers.length ? (
        <div className="border border-critical/45 bg-critical-soft/50 px-4 py-3 text-sm">
          <p className="font-semibold">Часть корзины не загрузилась</p>
          <p className="mt-1 text-muted">
            Не отвечают: {basket.stale_suppliers.join(", ")}. Позиции этих поставщиков сейчас не
            видны и не будут оформлены.
          </p>
        </div>
      ) : null}

      {basket.groups.map((group) => (
        <SupplierBasket key={group.supplier} group={group} />
      ))}

      <div className="flex flex-wrap items-center justify-between gap-4 border-t-2 border-ink pt-5">
        <dl className="flex flex-wrap items-baseline gap-x-8 gap-y-2">
          <Total term="Позиций" value={String(basket.positions)} />
          <Total term="Единиц" value={String(basket.units)} />
          <div>
            <dt className="num text-[0.625rem] tracking-[0.16em] text-faint uppercase">Итого</dt>
            <dd className="mt-1">
              <Price value={basket.total} currency={basket.currency} size="lg" />
            </dd>
          </div>
        </dl>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => clear.mutate(undefined)}
          disabled={clear.isPending}
        >
          {clear.isPending ? <Spinner /> : null}
          Очистить всё
        </Button>
      </div>
    </div>
  );
}

function Total({ term, value }: { term: string; value: string }) {
  return (
    <div>
      <dt className="num text-[0.625rem] tracking-[0.16em] text-faint uppercase">{term}</dt>
      <dd className="num mt-1 text-xl tabular-nums">{value}</dd>
    </div>
  );
}

function SupplierBasket({ group }: { group: BasketSupplierGroup }) {
  const { submit, clear } = useBasketActions();
  const modes = Object.entries(group.delivery_modes);
  const [mode, setMode] = useState(modes[0]?.[0] ?? "1");

  return (
    <section className="border border-rule">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-rule bg-surface/60 px-4 py-3 sm:px-5">
        <h3 className="text-[0.6875rem] font-semibold tracking-[0.16em] uppercase">
          {group.supplier_name}
        </h3>
        <Pill>{`${group.positions} ${plural(group.positions, "позиция", "позиции", "позиций")}`}</Pill>
        <div className="ml-auto flex items-center gap-4">
          <Price value={group.total} currency={group.currency} size="md" />
        </div>
      </header>

      <div className="hidden grid-cols-[2.4fr_1.1fr_1fr_1.5fr_1fr_2.5rem] items-center gap-6 border-b border-rule px-5 py-2 text-[0.625rem] tracking-[0.16em] text-faint uppercase lg:grid">
        <span>Позиция</span>
        <span>Склад</span>
        <span>Доставка</span>
        <span>Количество</span>
        <span className="text-right">Сумма</span>
        <span />
      </div>

      <ul>
        {group.lines.map((line) => (
          <BasketRow key={line.id} line={line} />
        ))}
      </ul>

      <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-rule px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-center gap-3">
          {modes.length > 1 ? (
            <label className="flex items-center gap-2 text-[0.6875rem] tracking-[0.12em] text-muted uppercase">
              Доставка
              <select
                value={mode}
                onChange={(event) => setMode(event.target.value)}
                className="num border border-rule bg-surface px-2 py-1.5 text-xs text-ink outline-none"
              >
                {modes.map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <Button
            variant="ghost"
            size="sm"
            onClick={() => clear.mutate(group.supplier)}
            disabled={clear.isPending}
          >
            Очистить
          </Button>
        </div>

        <Button
          variant="primary"
          size="lg"
          disabled={submit.isPending}
          onClick={() => submit.mutate({ deliveryModeId: Number(mode), supplier: group.supplier })}
        >
          {submit.isPending ? <Spinner /> : null}
          Оформить заказ
        </Button>
      </footer>
    </section>
  );
}

function BasketRow({ line }: { line: BasketLine }) {
  const { update, remove } = useBasketActions();
  const step = Math.max(1, line.package);
  const busy = update.isPending || remove.isPending;

  return (
    <li className="border-b border-rule last:border-b-0">
      <div className="grid gap-2.5 px-4 py-4 sm:px-5 lg:grid-cols-[2.4fr_1.1fr_1fr_1.5fr_1fr_2.5rem] lg:items-center lg:gap-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
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
          {line.comment ? (
            <p className="mt-1 border-l-2 border-accent/40 pl-2 text-[0.6875rem] text-muted">
              {line.comment}
            </p>
          ) : null}
        </div>

        <div className="flex items-center justify-between text-xs text-muted lg:block">
          <MobileLabel>Склад</MobileLabel>
          {line.warehouse_name}
        </div>

        <div className="flex items-center justify-between text-xs lg:block">
          <MobileLabel>Доставка</MobileLabel>
          {formatDelivery(line.delivery_days)}
        </div>

        <div>
          <MobileLabel>Количество</MobileLabel>
          <div className="flex items-center gap-3">
            <div className={cn("flex items-stretch border border-rule-strong", busy && "opacity-50")}>
              <button
                type="button"
                disabled={busy || line.quantity <= step}
                onClick={() => update.mutate({ lineId: line.id, quantity: line.quantity - step })}
                aria-label="Уменьшить"
                className="w-7 text-muted transition-colors hover:text-ink disabled:text-faint/50"
              >
                −
              </button>
              <span className="num grid w-10 place-items-center border-x border-rule-strong text-sm tabular-nums">
                {line.quantity}
              </span>
              <button
                type="button"
                disabled={busy}
                onClick={() => update.mutate({ lineId: line.id, quantity: line.quantity + step })}
                aria-label="Увеличить"
                className="w-7 text-muted transition-colors hover:text-ink disabled:text-faint/50"
              >
                +
              </button>
            </div>
            <span className="flex items-baseline gap-1 whitespace-nowrap">
              <span className="num text-[0.625rem] text-faint">×</span>
              <Price value={line.price} currency={line.currency} size="sm" tone="muted" />
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between lg:block lg:text-right">
          <MobileLabel>Сумма</MobileLabel>
          <Price value={line.total} currency={line.currency} size="md" />
        </div>

        <div className="lg:justify-self-end">
          <button
            type="button"
            disabled={busy}
            onClick={() => remove.mutate(line.id)}
            aria-label={`Удалить ${line.part_code}`}
            className="grid h-8 w-8 place-items-center border border-transparent text-faint transition-colors hover:border-critical hover:text-critical disabled:opacity-40"
          >
            ✕
          </button>
        </div>
      </div>
    </li>
  );
}

function MobileLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="num text-[0.625rem] tracking-[0.16em] text-faint uppercase lg:hidden">
      {children}
    </span>
  );
}
