"use client";

import Link from "next/link";
import { useState } from "react";

import { AddToBasket } from "@/components/add-to-basket";
import { Pill, Price, SectionLabel, StockGauge, cn } from "@/components/ui";
import { formatDelivery, plural } from "@/lib/format";
import type { Offer, OfferGroup } from "@/lib/types";

export function OfferGroups({
  groups,
  bestOfferId,
  linkToPart = true,
}: {
  groups: OfferGroup[];
  bestOfferId: string | null;
  linkToPart?: boolean;
}) {
  const exact = groups.filter((group) => !group.is_analog);
  const analogs = groups.filter((group) => group.is_analog);

  return (
    <div className="space-y-12">
      {exact.length ? (
        <section>
          <SectionLabel
            index="02"
            aside={`${exact.length} ${plural(exact.length, "карточка", "карточки", "карточек")}`}
          >
            Точное совпадение
          </SectionLabel>
          <div className="mt-6 space-y-6">
            {exact.map((group) => (
              <GroupBlock
                key={group.part_id}
                group={group}
                bestOfferId={bestOfferId}
                linkToPart={linkToPart}
                defaultOpen
              />
            ))}
          </div>
        </section>
      ) : null}

      {analogs.length ? (
        <section>
          <SectionLabel
            index="03"
            aside={`${analogs.length} ${plural(analogs.length, "аналог", "аналога", "аналогов")}`}
          >
            Аналоги и кросс-номера
          </SectionLabel>
          <p className="mt-3 max-w-2xl text-xs leading-relaxed text-muted">
            Взаимозаменяемые детали других брендов. Перед заказом сверьте размеры и применимость к
            вашему автомобилю.
          </p>
          <div className="mt-6 space-y-6">
            {analogs.map((group, index) => (
              <GroupBlock
                key={group.part_id}
                group={group}
                bestOfferId={bestOfferId}
                linkToPart={linkToPart}
                defaultOpen={index === 0}
              />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function GroupBlock({
  group,
  bestOfferId,
  linkToPart,
  defaultOpen = false,
}: {
  group: OfferGroup;
  bestOfferId: string | null;
  linkToPart: boolean;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const hasBest = group.offers.some((offer) => offer.id === bestOfferId);

  return (
    <article className={cn("border", hasBest ? "border-accent" : "border-rule")}>
      {/* Шапка карточки товара */}
      <header
        className={cn(
          "flex flex-wrap items-baseline gap-x-5 gap-y-2 border-b px-4 py-3.5 sm:px-5",
          hasBest ? "border-accent/40 bg-accent-soft/50" : "border-rule bg-surface/60",
        )}
      >
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          aria-expanded={open}
          className="num flex items-center gap-2 text-base font-medium tracking-[0.04em] transition-colors hover:text-accent"
        >
          <span aria-hidden className={cn("text-faint transition-transform", open && "rotate-90")}>
            ▸
          </span>
          {group.part_code}
        </button>

        <span className="text-[0.6875rem] font-semibold tracking-[0.14em] text-muted uppercase">
          {group.brand}
        </span>

        <span className="order-last w-full text-sm text-muted sm:order-none sm:w-auto sm:min-w-0 sm:flex-1 sm:truncate">
          {group.part_name}
        </span>

        <div className="flex items-center gap-4">
          {group.best_delivery_days !== null ? (
            <span className="hidden text-xs text-muted sm:inline">
              от {formatDelivery(group.best_delivery_days)}
            </span>
          ) : null}
          <span className="text-xs text-faint">
            {group.offers.length} {plural(group.offers.length, "склад", "склада", "складов")}
          </span>
          <Price value={group.min_price} currency={group.offers[0]?.currency} size="md" />
        </div>
      </header>

      {open ? (
        <>
          {/* Заголовки колонок — только на широких экранах */}
          <div className="hidden grid-cols-[2.2fr_1fr_1fr_0.9fr_auto] items-center gap-6 border-b border-rule px-5 py-2 text-[0.625rem] tracking-[0.16em] text-faint uppercase lg:grid">
            <span>Склад</span>
            <span>Остаток</span>
            <span>Доставка</span>
            <span className="text-right">Цена</span>
            <span className="w-[15.5rem] text-right">Заказ</span>
          </div>

          <ul>
            {group.offers.map((offer) => (
              <OfferRow key={offer.id} offer={offer} isBest={offer.id === bestOfferId} />
            ))}
          </ul>

          {linkToPart ? (
            <div className="border-t border-rule px-5 py-2.5">
              <Link
                href={`/part/${encodeURIComponent(group.part_id)}`}
                className="num text-[0.6875rem] tracking-[0.1em] text-muted uppercase transition-colors hover:text-accent"
              >
                Открыть карточку →
              </Link>
            </div>
          ) : null}
        </>
      ) : null}
    </article>
  );
}

function OfferRow({ offer, isBest }: { offer: Offer; isBest: boolean }) {
  const soldOut = offer.quantity === 0;

  return (
    <li
      className={cn(
        "relative border-b border-rule last:border-b-0",
        offer.is_transit && "hatch",
        soldOut && "opacity-55",
      )}
    >
      {/* Фон нужен, чтобы штриховка транзита не мешала читать текст. */}
      <div className={cn("relative", offer.is_transit && "bg-paper/85")}>
        {isBest ? <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-accent" /> : null}

        <div className="grid gap-2.5 px-4 py-4 sm:px-5 lg:grid-cols-[2.2fr_1fr_1fr_0.9fr_auto] lg:items-center lg:gap-6">
          {/* Склад */}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="truncate text-sm font-medium">{offer.warehouse_name}</span>
              {isBest ? (
                <Pill tone="accent" solid>
                  лучшая цена
                </Pill>
              ) : null}
              {offer.is_transit ? <Pill tone="warning">транзит</Pill> : null}
            </div>
            <div className="num mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[0.625rem] tracking-[0.08em] text-faint uppercase">
              <span>{offer.supplier_name}</span>
              <span>склад {offer.warehouse_id}</span>
              {offer.package > 1 ? (
                <span className="text-warning">кратно {offer.package}</span>
              ) : null}
            </div>
          </div>

          {/* Остаток */}
          <div className="flex items-center justify-between lg:block lg:justify-self-start">
            <MobileLabel>Остаток</MobileLabel>
            <StockGauge
              quantity={offer.quantity}
              label={offer.quantity_label}
              exact={offer.quantity_exact}
            />
          </div>

          {/* Срок */}
          <div className="flex items-center justify-between lg:block">
            <MobileLabel>Доставка</MobileLabel>
            <span
              className={cn(
                "text-sm",
                offer.delivery_days !== null && offer.delivery_days <= 1
                  ? "text-positive"
                  : "text-ink",
              )}
            >
              {formatDelivery(offer.delivery_days)}
            </span>
          </div>

          {/* Цена */}
          <div className="flex items-center justify-between lg:block lg:text-right">
            <MobileLabel>Цена</MobileLabel>
            <Price
              value={offer.price}
              currency={offer.currency}
              size="md"
              tone={isBest ? "accent" : "ink"}
            />
          </div>

          {/* Действие */}
          <div className="mt-1 lg:mt-0 lg:w-[15.5rem]">
            <AddToBasket offer={offer} />
          </div>
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
