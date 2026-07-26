"use client";

import Link from "next/link";
import { useState } from "react";

import { PartArt } from "@/components/part-art";
import { Price, Spinner, cn } from "@/components/ui";
import { formatDelivery, plural } from "@/lib/format";
import { useBasket, useBasketActions } from "@/lib/hooks";
import type { Offer, OfferGroup } from "@/lib/types";

/** Есть ли это предложение уже в корзине: ключ строки совпадает с id предложения. */
function useInBasket(offerId: string): number | null {
  const { data } = useBasket();
  for (const group of data?.groups ?? []) {
    for (const line of group.lines) {
      if (`${line.part_id}:${line.warehouse_id}` === offerId) return line.quantity;
    }
  }
  return null;
}

/** «Сегодня» / «Завтра» — главное, что человек хочет знать после цены. */
export function DeliveryBadge({ offer }: { offer: Offer }) {
  const days = offer.delivery_days;
  const fast = days !== null && days <= 1;

  return (
    <span className="inline-flex items-center gap-2 text-sm">
      <span
        aria-hidden
        className={cn("h-2 w-2 rounded-full", fast ? "bg-positive" : "bg-warning")}
      />
      <span className={fast ? "font-medium text-positive" : "text-muted"}>
        {days === null
          ? "срок уточняется"
          : days === 0
            ? "Заберёте сегодня"
            : days === 1
              ? "Завтра"
              : `Через ${formatDelivery(days)}`}
      </span>
    </span>
  );
}

export function AddButton({ offer, size = "lg" }: { offer: Offer; size?: "lg" | "sm" }) {
  const { add } = useBasketActions();
  const inBasket = useInBasket(offer.id);
  const soldOut = offer.quantity === 0;

  if (soldOut) {
    return (
      <span className={cn("grid place-items-center border border-rule px-5 text-sm text-faint", size === "lg" ? "h-12" : "h-10")}>
        Нет в наличии
      </span>
    );
  }

  if (inBasket) {
    return (
      <Link
        href="/basket"
        className={cn(
          "flex items-center justify-center gap-2 border border-positive bg-positive/10 px-5 font-semibold text-positive transition-colors hover:bg-positive hover:text-paper",
          size === "lg" ? "h-12 text-sm" : "h-10 text-xs",
        )}
      >
        <span aria-hidden>✓</span> В корзине · {inBasket} шт
      </Link>
    );
  }

  return (
    <button
      type="button"
      disabled={add.isPending}
      onClick={() => add.mutate({ offerId: offer.id, quantity: Math.max(1, offer.package) })}
      className={cn(
        "flex items-center justify-center gap-2 border border-accent bg-accent font-semibold text-accent-ink transition-all hover:brightness-95 active:translate-y-px disabled:opacity-60",
        size === "lg" ? "h-12 px-7 text-sm" : "h-10 px-5 text-xs",
      )}
    >
      {add.isPending ? <Spinner /> : null}
      В корзину
    </button>
  );
}

export function ProductCard({ group }: { group: OfferGroup }) {
  const [open, setOpen] = useState(false);
  const [best, ...rest] = group.offers;
  if (!best) return null;

  // Остаток показываем, только когда он маленький: это единственный случай,
  // когда число реально влияет на решение купить сейчас.
  const scarce = best.quantity !== null && best.quantity <= 3 ? best.quantity : null;

  return (
    <article className="hover-corner-frame border border-rule-strong bg-paper">
      <div className="grid gap-5 p-4 sm:grid-cols-[6.5rem_minmax(0,1fr)_auto] sm:items-center sm:gap-6 sm:p-5">
        <Link
          href={`/part/${encodeURIComponent(group.part_id)}`}
          className="grid h-24 w-24 shrink-0 place-items-center border border-rule bg-media sm:h-[6.5rem] sm:w-[6.5rem]"
        >
          <PartArt name={group.part_name} className="h-16 w-16" />
        </Link>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <p className="text-xs font-bold tracking-[0.12em] text-accent uppercase">{group.brand}</p>
            <p className="num text-xs text-faint">арт. {group.part_code}</p>
          </div>
          <h3 className="mt-1.5 text-lg leading-tight font-semibold tracking-tight sm:text-xl">
            <Link
              href={`/part/${encodeURIComponent(group.part_id)}`}
              className="transition-colors hover:text-accent"
            >
              {group.part_name}
            </Link>
          </h3>

          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
            <DeliveryBadge offer={best} />
            {scarce !== null ? (
              <span className="text-sm text-warning">
                осталось {scarce} {plural(scarce, "штука", "штуки", "штук")}
              </span>
            ) : null}
            {best.is_transit ? <span className="text-sm text-muted">под заказ</span> : null}
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-stretch gap-3 border-t border-rule pt-4 sm:min-w-44 sm:items-end sm:border-t-0 sm:border-l sm:py-2 sm:pl-6">
          <div className="flex items-baseline justify-between gap-2 sm:flex-col sm:items-end sm:gap-1">
            <Price value={best.price} currency={best.currency} size="lg" />
            <span className="text-xs text-faint">склад: {best.warehouse_name}</span>
          </div>
          <AddButton offer={best} />
        </div>
      </div>

      {rest.length ? (
        <div className="border-t border-rule">
          <button
            type="button"
            onClick={() => setOpen((current) => !current)}
            aria-expanded={open}
            className="flex w-full items-center gap-2 bg-paper/50 px-5 py-3 text-left text-sm text-muted transition-colors hover:text-ink"
          >
            <span aria-hidden className={cn("text-faint transition-transform", open && "rotate-90")}>
              ▸
            </span>
            {open
              ? "Свернуть"
              : `Ещё ${rest.length} ${plural(rest.length, "вариант", "варианта", "вариантов")} — от ${Math.min(...rest.map((offer) => offer.price)).toLocaleString("ru-RU")} ₽`}
          </button>

          {open ? (
            <ul className="border-t border-rule">
              {rest.map((offer) => (
                <li
                  key={offer.id}
                  className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-rule px-5 py-3.5 last:border-b-0 sm:px-6"
                >
                  <DeliveryBadge offer={offer} />
                  <span className="text-sm text-muted">{offer.warehouse_name}</span>
                  <span className="ml-auto flex items-center gap-4">
                    <Price value={offer.price} currency={offer.currency} size="md" />
                    <AddButton offer={offer} size="sm" />
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
