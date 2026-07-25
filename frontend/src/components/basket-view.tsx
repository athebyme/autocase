"use client";

import Link from "next/link";

import { PartArt } from "@/components/part-art";
import { Button, Empty, Price, Spinner, cn } from "@/components/ui";
import { formatDelivery, plural } from "@/lib/format";
import { useBasket, useBasketActions } from "@/lib/hooks";
import type { BasketLine } from "@/lib/types";

export function BasketView() {
  const { data: basket, isLoading, isError, refetch } = useBasket();
  const { clear, submit } = useBasketActions();

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="flex animate-pulse gap-5 border border-rule p-5">
            <div className="h-20 w-20 shrink-0 bg-rule/60" />
            <div className="flex-1 space-y-3 py-1">
              <div className="h-4 w-2/5 bg-rule/60" />
              <div className="h-3 w-1/4 bg-rule/60" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (isError || !basket) {
    return (
      <Empty
        title="Корзина не загрузилась"
        hint="Попробуйте ещё раз — связь с поставщиком могла оборваться."
        action={
          <Button variant="outline" onClick={() => refetch()}>
            Обновить
          </Button>
        }
      />
    );
  }

  if (!basket.positions) {
    return (
      <Empty
        title="В корзине пусто"
        hint="Найдите деталь по номеру и добавьте её — она появится здесь."
        action={
          <Link
            href="/"
            className="border border-accent bg-accent px-6 py-3 text-sm font-semibold text-accent-ink transition-all hover:brightness-95"
          >
            Найти запчасть
          </Link>
        }
      />
    );
  }

  const lines = basket.groups.flatMap((group) => group.lines);

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
      <div className="space-y-3">
        {basket.stale_suppliers.length ? (
          <p className="border border-critical/45 bg-critical-soft/50 px-4 py-3 text-sm">
            Часть корзины сейчас недоступна и не будет оформлена. Обновите страницу через минуту.
          </p>
        ) : null}

        {lines.map((line) => (
          <BasketRow key={line.id} line={line} />
        ))}

        <button
          type="button"
          onClick={() => clear.mutate(undefined)}
          disabled={clear.isPending}
          className="text-sm text-faint underline underline-offset-4 transition-colors hover:text-critical disabled:opacity-50"
        >
          Очистить корзину
        </button>
      </div>

      {/* Итог всегда на виду: на телефоне прилипает к низу экрана. */}
      <aside className="sticky bottom-0 border border-rule bg-surface p-5 shadow-[0_-8px_20px_-16px_rgba(0,0,0,0.4)] lg:top-24 lg:bottom-auto lg:shadow-none">
        <div className="flex items-baseline justify-between gap-4">
          <span className="text-sm text-muted">
            {basket.units} {plural(basket.units, "товар", "товара", "товаров")}
          </span>
          <Price value={basket.total} currency={basket.currency} size="lg" />
        </div>

        <button
          type="button"
          disabled={submit.isPending}
          onClick={() => submit.mutate({ deliveryModeId: 1 })}
          className="mt-5 flex w-full items-center justify-center gap-2 border border-accent bg-accent py-4 text-sm font-semibold text-accent-ink transition-all hover:brightness-95 active:translate-y-px disabled:opacity-60"
        >
          {submit.isPending ? <Spinner /> : null}
          Оформить заказ
        </button>

        <p className="mt-3 text-xs leading-relaxed text-faint">
          После оформления заказ появится в разделе «Заказы» — там же виден статус.
        </p>
      </aside>
    </div>
  );
}

function BasketRow({ line }: { line: BasketLine }) {
  const { update, remove } = useBasketActions();
  const step = Math.max(1, line.package);
  const busy = update.isPending || remove.isPending;
  const fast = line.delivery_days !== null && line.delivery_days <= 1;

  return (
    <article className="flex gap-4 border border-rule bg-surface/40 p-4 sm:gap-5 sm:p-5">
      <Link
        href={`/part/${encodeURIComponent(line.part_id)}`}
        className="grid h-20 w-20 shrink-0 place-items-center border border-rule bg-paper sm:h-24 sm:w-24"
      >
        <PartArt name={line.part_name} className="h-12 w-12 sm:h-14 sm:w-14" />
      </Link>

      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[0.625rem] font-bold tracking-[0.16em] text-accent uppercase">
              {line.brand}
            </p>
            <h3 className="mt-0.5 leading-tight font-semibold">
              <Link
                href={`/part/${encodeURIComponent(line.part_id)}`}
                className="transition-colors hover:text-accent"
              >
                {line.part_name}
              </Link>
            </h3>
            <p className="mt-1.5 flex items-center gap-2 text-sm">
              <span
                aria-hidden
                className={cn("h-2 w-2 rounded-full", fast ? "bg-positive" : "bg-warning")}
              />
              <span className={fast ? "text-positive" : "text-muted"}>
                {formatDelivery(line.delivery_days)}
              </span>
              <span className="text-faint">· {line.warehouse_name}</span>
            </p>
          </div>

          <button
            type="button"
            disabled={busy}
            onClick={() => remove.mutate(line.id)}
            aria-label={`Убрать ${line.part_name}`}
            className="grid h-8 w-8 shrink-0 place-items-center text-faint transition-colors hover:text-critical disabled:opacity-40"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className={cn("flex items-stretch border border-rule", busy && "opacity-50")}>
            <button
              type="button"
              disabled={busy || line.quantity <= step}
              onClick={() => update.mutate({ lineId: line.id, quantity: line.quantity - step })}
              aria-label="Меньше"
              className="w-9 text-muted transition-colors hover:text-ink disabled:text-faint/50"
            >
              −
            </button>
            <span className="num grid w-10 place-items-center border-x border-rule text-sm tabular-nums">
              {line.quantity}
            </span>
            <button
              type="button"
              disabled={busy}
              onClick={() => update.mutate({ lineId: line.id, quantity: line.quantity + step })}
              aria-label="Больше"
              className="w-9 text-muted transition-colors hover:text-ink disabled:text-faint/50"
            >
              +
            </button>
          </div>

          <Price value={line.total} currency={line.currency} size="md" />
        </div>
      </div>
    </article>
  );
}
