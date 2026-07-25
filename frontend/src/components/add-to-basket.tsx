"use client";

import { useState } from "react";

import { Button, Spinner, cn } from "@/components/ui";
import { useBasketActions } from "@/lib/hooks";
import { plural } from "@/lib/format";
import type { Offer } from "@/lib/types";

/** Счётчик уважает кратность отгрузки: заказать 3 из коробки по 4 нельзя. */
export function AddToBasket({ offer, compact = false }: { offer: Offer; compact?: boolean }) {
  const step = Math.max(1, offer.package);
  const [quantity, setQuantity] = useState(step);
  const { add } = useBasketActions();

  const soldOut = offer.quantity === 0;
  const limit = offer.quantity !== null && offer.quantity_exact ? offer.quantity : null;
  const atLimit = limit !== null && quantity + step > limit;

  function change(delta: number) {
    setQuantity((current) => {
      const next = current + delta * step;
      if (next < step) return step;
      if (limit !== null && next > limit) return current;
      return next;
    });
  }

  return (
    <div className={cn("flex items-stretch gap-2", compact ? "" : "lg:justify-end")}>
      <div className="flex items-stretch border border-rule-strong">
        <button
          type="button"
          onClick={() => change(-1)}
          disabled={quantity <= step}
          aria-label="Уменьшить количество"
          className="w-8 text-muted transition-colors hover:text-ink disabled:text-faint/50"
        >
          −
        </button>
        <span
          className="num grid w-11 place-items-center border-x border-rule-strong text-sm tabular-nums"
          aria-live="polite"
        >
          {quantity}
        </span>
        <button
          type="button"
          onClick={() => change(1)}
          disabled={atLimit}
          aria-label="Увеличить количество"
          className="w-8 text-muted transition-colors hover:text-ink disabled:text-faint/50"
        >
          +
        </button>
      </div>

      <Button
        variant="primary"
        size="md"
        disabled={soldOut || add.isPending}
        onClick={() => add.mutate({ offerId: offer.id, quantity })}
        title={
          step > 1
            ? `Кратность отгрузки: ${step} ${plural(step, "штука", "штуки", "штук")}`
            : undefined
        }
        className="min-w-[7.5rem]"
      >
        {add.isPending ? <Spinner /> : null}
        {soldOut ? "Нет в наличии" : "В корзину"}
      </Button>
    </div>
  );
}
