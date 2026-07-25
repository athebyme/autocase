import type { OrderStage } from "@/lib/types";

const priceFormatter = new Intl.NumberFormat("ru-RU", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const CURRENCY_SIGNS: Record<string, string> = {
  RUB: "₽",
  RUR: "₽",
  USD: "$",
  EUR: "€",
};

export function formatPrice(value: number): string {
  return priceFormatter.format(value);
}

export function currencySign(code: string): string {
  return CURRENCY_SIGNS[code.toUpperCase()] ?? code;
}

/** «сегодня» / «завтра» / «через 3 дня» — читается быстрее, чем дата. */
export function formatDelivery(days: number | null): string {
  if (days === null) return "срок уточняется";
  if (days === 0) return "сегодня";
  if (days === 1) return "завтра";
  if (days === 2) return "послезавтра";
  return `${days} ${plural(days, "день", "дня", "дней")}`;
}

export function plural(count: number, one: string, few: string, many: string): string {
  const mod100 = Math.abs(count) % 100;
  const mod10 = mod100 % 10;
  if (mod100 >= 11 && mod100 <= 14) return many;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}

export function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Остаток «>10» показываем как есть: поставщик намеренно не назвал точное число. */
export function formatStock(quantity: number | null, label: string, unit: string): string {
  if (!label) return "под заказ";
  if (quantity === null) return label;
  return `${label} ${unit}`;
}

export const STAGE_LABELS: Record<OrderStage, string> = {
  pending: "Принят",
  blocked: "Требует оплаты",
  processing: "В работе",
  transit: "В пути",
  done: "Выдан",
  failed: "Отказ",
};

export const STAGE_TONE: Record<OrderStage, "neutral" | "accent" | "positive" | "warning" | "critical"> = {
  pending: "neutral",
  blocked: "warning",
  processing: "accent",
  transit: "accent",
  done: "positive",
  failed: "critical",
};

/** Позиция стадии на шкале прогресса заказа, 0…1. */
export const STAGE_PROGRESS: Record<OrderStage, number> = {
  pending: 0.15,
  blocked: 0.3,
  processing: 0.5,
  transit: 0.8,
  done: 1,
  failed: 1,
};

/** Артикулы показываем без разделителей: так их проще сверять глазами. */
export function normalizeCode(value: string): string {
  return value.toUpperCase().replace(/[^A-ZА-Я0-9]/gi, "");
}
