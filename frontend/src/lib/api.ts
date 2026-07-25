import type {
  Basket,
  BasketMutation,
  GatewayErrorBody,
  OffersResult,
  OrdersResponse,
  SearchResult,
  SubmitResult,
  SuppliersResponse,
} from "@/lib/types";

/* В браузере ходим на собственный /api — его проксирует Next (см. next.config.ts).
   На сервере rewrites не работают, поэтому обращаемся к шлюзу напрямую. */
const isServer = typeof window === "undefined";
const base = isServer ? (process.env.BACKEND_URL ?? "http://127.0.0.1:8000") : "";

export class ApiError extends Error {
  readonly kind: string;
  readonly detail: string | null;
  readonly supplier: string | null;
  readonly status: number;

  constructor(
    message: string,
    options: { kind?: string; detail?: string | null; supplier?: string | null; status: number },
  ) {
    super(message);
    this.name = "ApiError";
    this.kind = options.kind ?? "unknown";
    this.detail = options.detail ?? null;
    this.supplier = options.supplier ?? null;
    this.status = options.status;
  }
}

interface RequestOptions extends RequestInit {
  /** Секунды кэширования на стороне Next. По умолчанию — без кэша. */
  revalidate?: number;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { revalidate, ...init } = options;

  let response: Response;
  try {
    response = await fetch(`${base}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
      },
      ...(revalidate === undefined ? { cache: "no-store" } : { next: { revalidate } }),
    });
  } catch (cause) {
    // Шлюз не поднят или сеть отвалилась — это не «ошибка поставщика».
    throw new ApiError("Не удалось связаться со шлюзом", {
      kind: "network",
      detail: cause instanceof Error ? cause.message : null,
      status: 0,
    });
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as GatewayErrorBody | null;
    throw new ApiError(body?.error?.message ?? `Ошибка ${response.status}`, {
      kind: body?.error?.kind,
      detail: body?.error?.detail,
      supplier: body?.error?.supplier,
      status: response.status,
    });
  }

  return (await response.json()) as T;
}

const flag = (value: boolean) => (value ? "true" : "false");

export interface OfferFilters {
  analogs?: boolean;
  transit?: boolean;
}

function offerQuery({ analogs = true, transit = true }: OfferFilters) {
  return `analogs=${flag(analogs)}&transit=${flag(transit)}`;
}

export const api = {
  suppliers: () => request<SuppliersResponse>("/api/suppliers", { revalidate: 60 }),

  search: (query: string) =>
    request<SearchResult>(`/api/search?q=${encodeURIComponent(query)}`, { revalidate: 30 }),

  offersByCode: (query: string, filters: OfferFilters = {}) =>
    request<OffersResult>(
      `/api/offers?q=${encodeURIComponent(query)}&${offerQuery(filters)}`,
      // Остатки живут недолго: свежесть важнее экономии на запросе.
      { revalidate: 15 },
    ),

  offersForPart: (partId: string, filters: OfferFilters = {}) =>
    request<OffersResult>(
      `/api/parts/${encodeURIComponent(partId)}/offers?${offerQuery(filters)}`,
      { revalidate: 15 },
    ),

  basket: () => request<Basket>("/api/basket"),

  addLine: (offerId: string, quantity: number, comment = "") =>
    request<BasketMutation>("/api/basket/lines", {
      method: "POST",
      body: JSON.stringify({ offer_id: offerId, quantity, comment }),
    }),

  updateLine: (lineId: string, quantity: number) =>
    request<BasketMutation>(`/api/basket/lines/${encodeURIComponent(lineId)}`, {
      method: "PATCH",
      body: JSON.stringify({ quantity }),
    }),

  removeLine: (lineId: string) =>
    request<BasketMutation>(`/api/basket/lines/${encodeURIComponent(lineId)}`, {
      method: "DELETE",
    }),

  clearBasket: (supplier?: string) =>
    request<BasketMutation>("/api/basket/clear", {
      method: "POST",
      body: JSON.stringify({ supplier: supplier ?? null }),
    }),

  submitBasket: (deliveryModeId = 1, supplier?: string) =>
    request<SubmitResult>("/api/basket/submit", {
      method: "POST",
      body: JSON.stringify({ delivery_mode_id: deliveryModeId, supplier: supplier ?? null }),
    }),

  orders: (dateFrom?: string, dateTo?: string) => {
    const params = new URLSearchParams();
    if (dateFrom) params.set("date_from", dateFrom);
    if (dateTo) params.set("date_to", dateTo);
    const suffix = params.size ? `?${params}` : "";
    return request<OrdersResponse>(`/api/orders${suffix}`);
  },
};
