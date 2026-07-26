"use client";

import Link from "next/link";

import { PartArt } from "@/components/part-art";
import { AddButton, DeliveryBadge, ProductCard } from "@/components/product-card";
import { Price } from "@/components/ui";
import { plural } from "@/lib/format";
import type { OffersResult } from "@/lib/types";

export function PartDetail({ result }: { result: OffersResult }) {
  const own = result.offers.filter((offer) => !offer.is_analog);
  const [best, ...others] = own;
  const similar = result.groups.filter((group) => group.is_analog);
  const part = result.part;

  if (!best || !part) {
    return (
      <p className="border border-rule px-6 py-16 text-center text-muted">
        Эта деталь сейчас недоступна ни на одном складе.
      </p>
    );
  }

  const comment = own.find((offer) => offer.part_comment)?.part_comment ?? null;
  const scarce = best.quantity !== null && best.quantity <= 3 ? best.quantity : null;

  return (
    <div className="space-y-14">
      <div className="grid gap-8 md:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] md:gap-12">
        <div className="grid aspect-square place-items-center border border-rule bg-media">
          <PartArt name={part.name} className="h-40 w-40 sm:h-52 sm:w-52" />
        </div>

        <div className="min-w-0">
          <p className="text-xs font-bold tracking-[0.18em] text-accent uppercase">{part.brand}</p>
          <h1 className="mt-2 text-3xl leading-tight font-bold tracking-tight sm:text-4xl">
            {part.name}
          </h1>
          <p className="num mt-2 text-sm text-faint">Артикул {part.code}</p>

          <div className="mt-7 flex flex-wrap items-end gap-x-8 gap-y-4">
            <Price value={best.price} currency={best.currency} size="lg" />
            <div className="space-y-1">
              <DeliveryBadge offer={best} />
              <p className="text-xs text-faint">Забрать: {best.warehouse_name}</p>
            </div>
          </div>

          {scarce !== null ? (
            <p className="mt-3 text-sm text-warning">
              Осталось {scarce} {plural(scarce, "штука", "штуки", "штук")}
            </p>
          ) : null}

          <div className="mt-7 max-w-xs">
            <AddButton offer={best} />
          </div>

          {comment ? (
            <div className="mt-9 border-t border-rule pt-5">
              <h2 className="text-sm font-semibold">Характеристики</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">{comment}</p>
            </div>
          ) : null}
        </div>
      </div>

      {others.length ? (
        <section>
          <h2 className="text-xl font-bold tracking-tight">Другие варианты доставки</h2>
          <p className="mt-1.5 text-sm text-muted">
            Та же деталь на других складах — иногда дешевле, если готовы подождать.
          </p>

          <ul className="mt-5 border border-rule">
            {others.map((offer) => (
              <li
                key={offer.id}
                className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-rule px-5 py-4 last:border-b-0"
              >
                <DeliveryBadge offer={offer} />
                <span className="text-sm text-muted">{offer.warehouse_name}</span>
                <span className="ml-auto flex items-center gap-5">
                  <Price value={offer.price} currency={offer.currency} size="md" />
                  <AddButton offer={offer} size="sm" />
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {similar.length ? (
        <section>
          <h2 className="text-xl font-bold tracking-tight">Подходящие замены</h2>
          <p className="mt-1.5 max-w-2xl text-sm text-muted">
            Детали других производителей с теми же характеристиками.
          </p>
          <div className="mt-5 space-y-4">
            {similar.map((group) => (
              <ProductCard key={group.part_id} group={group} />
            ))}
          </div>
        </section>
      ) : null}

      <Link
        href={`/search?q=${encodeURIComponent(part.code)}`}
        className="inline-block text-sm text-muted underline underline-offset-4 transition-colors hover:text-accent"
      >
        Все предложения по номеру {part.code}
      </Link>
    </div>
  );
}
