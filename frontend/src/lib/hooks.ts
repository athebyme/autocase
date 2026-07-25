"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useToast } from "@/components/toast";
import { ApiError, api } from "@/lib/api";
import type { Basket, BasketMutation } from "@/lib/types";

export const basketKey = ["basket"] as const;
export const suppliersKey = ["suppliers"] as const;

export function useBasket() {
  return useQuery({ queryKey: basketKey, queryFn: api.basket });
}

export function useSuppliers() {
  return useQuery({ queryKey: suppliersKey, queryFn: api.suppliers, staleTime: 5 * 60_000 });
}

function describe(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return "Непредвиденная ошибка";
}

/** Мутации корзины. Сервер возвращает корзину целиком — кладём её в кэш без перезапроса. */
export function useBasketActions() {
  const queryClient = useQueryClient();
  const toast = useToast();

  const commit = (result: BasketMutation) => {
    queryClient.setQueryData<Basket>(basketKey, result.basket);
  };

  const add = useMutation({
    mutationFn: ({
      offerId,
      quantity,
      comment,
    }: {
      offerId: string;
      quantity: number;
      comment?: string;
    }) => api.addLine(offerId, quantity, comment ?? ""),
    onSuccess: (result) => {
      commit(result);
      const line = result.line;
      toast.ok(
        "Добавлено в корзину",
        line ? `${line.part_code} · ${line.quantity} ${line.unit} · ${line.warehouse_name}` : undefined,
      );
    },
    onError: (error) => toast.fail("Не удалось добавить", describe(error)),
  });

  const update = useMutation({
    mutationFn: ({ lineId, quantity }: { lineId: string; quantity: number }) =>
      api.updateLine(lineId, quantity),
    onSuccess: commit,
    onError: (error) => {
      // Смена количества — это удаление и повторное добавление на стороне
      // поставщика, поэтому при сбое надо показать актуальное состояние.
      queryClient.invalidateQueries({ queryKey: basketKey });
      toast.fail("Не удалось изменить количество", describe(error));
    },
  });

  const remove = useMutation({
    mutationFn: (lineId: string) => api.removeLine(lineId),
    onSuccess: (result) => {
      commit(result);
      toast.push({ title: "Позиция удалена", tone: "neutral" });
    },
    onError: (error) => {
      queryClient.invalidateQueries({ queryKey: basketKey });
      toast.fail("Не удалось удалить позицию", describe(error));
    },
  });

  const clear = useMutation({
    mutationFn: (supplier?: string) => api.clearBasket(supplier),
    onSuccess: (result) => {
      commit(result);
      toast.push({ title: "Корзина очищена", tone: "neutral" });
    },
    onError: (error) => toast.fail("Не удалось очистить корзину", describe(error)),
  });

  const submit = useMutation({
    mutationFn: ({ deliveryModeId, supplier }: { deliveryModeId: number; supplier?: string }) =>
      api.submitBasket(deliveryModeId, supplier),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: basketKey });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      const failed = result.outcomes.filter((outcome) => !outcome.ok);
      if (result.ok) {
        toast.ok("Заказ отправлен", "Следите за статусом в разделе «Заказы»");
      } else if (failed.length === result.outcomes.length) {
        toast.fail("Заказ не отправлен", failed[0]?.message ?? undefined);
      } else {
        toast.fail(
          "Часть заказа не ушла",
          `Не приняли: ${failed.map((outcome) => outcome.supplier_name).join(", ")}`,
        );
      }
    },
    onError: (error) => toast.fail("Не удалось оформить заказ", describe(error)),
  });

  return { add, update, remove, clear, submit };
}
