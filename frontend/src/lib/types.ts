/** Типы шлюза. Зеркалят канонические модели из `backend/app/domain/models.py`. */

export type OrderStage =
  | "pending"
  | "blocked"
  | "processing"
  | "transit"
  | "done"
  | "failed";

export interface SupplierCapabilities {
  search: boolean;
  offers: boolean;
  analogs: boolean;
  transit: boolean;
  remote_basket: boolean;
  basket_clear: boolean;
  line_comment: boolean;
  orders: boolean;
  orders_max_age_days: number | null;
  delivery_modes: Record<string, string>;
}

export interface SupplierInfo {
  code: string;
  name: string;
  enabled: boolean;
  configured: boolean;
  /** false — сейчас отдаются демо-данные, а не реальные остатки. */
  live: boolean;
  capabilities: SupplierCapabilities;
}

export type VinConfidence = "exact" | "likely" | "partial";

export interface VehicleAttribute {
  key: string;
  label: string;
  value: string;
}

export interface Vehicle {
  vin: string;
  make: string;
  model: string | null;
  model_year: number | null;
  manufacturer: string | null;
  series: string | null;
  trim: string | null;
  body_class: string | null;
  vehicle_type: string | null;
  doors: number | null;
  drive_type: string | null;
  transmission: string | null;
  transmission_speeds: number | null;
  engine_code: string | null;
  engine_model: string | null;
  engine_manufacturer: string | null;
  engine_liters: number | null;
  engine_cylinders: number | null;
  engine_power_hp: number | null;
  fuel_type: string | null;
  electrification_level: string | null;
  production_date: string | null;
  market: string | null;
  plant_city: string | null;
  plant_country: string | null;
  catalog_code: string | null;
  vehicle_id: string | null;
  attributes: VehicleAttribute[];
}

export interface VinDecodeResult {
  vehicle: Vehicle;
  alternatives: Vehicle[];
  complete: boolean;
  confidence: VinConfidence;
  source: string;
  source_label: string;
  warnings: string[];
  missing_fields: string[];
}

export interface SupplierIssue {
  supplier: string;
  supplier_name: string;
  kind: string;
  message: string;
}

export interface Part {
  id: string;
  supplier: string;
  supplier_name: string;
  native_id: string;
  code: string;
  brand: string;
  name: string;
}

export interface Offer {
  id: string;
  supplier: string;
  supplier_name: string;
  part_id: string;
  part_native_id: string;
  part_code: string;
  part_name: string;
  part_comment: string | null;
  brand: string;
  warehouse_id: string;
  warehouse_name: string;
  price: number;
  currency: string;
  quantity: number | null;
  quantity_label: string;
  quantity_exact: boolean;
  package: number;
  unit: string;
  delivery_at: string | null;
  delivery_days: number | null;
  is_analog: boolean;
  is_transit: boolean;
}

export interface OfferGroup {
  part_id: string;
  part_code: string;
  part_name: string;
  brand: string;
  is_analog: boolean;
  offers: Offer[];
  min_price: number;
  best_delivery_days: number | null;
  total_quantity: number | null;
}

export interface SearchResult {
  query: string;
  normalized_query: string;
  parts: Part[];
  issues: SupplierIssue[];
}

export interface OffersResult {
  part: Part | null;
  offers: Offer[];
  groups: OfferGroup[];
  best_offer_id: string | null;
  analog_count: number;
  issues: SupplierIssue[];
}

export interface BasketLine {
  id: string;
  supplier: string;
  supplier_name: string;
  native_id: string;
  version: number;
  state: string;
  created_at: string | null;
  part_id: string;
  part_code: string;
  part_name: string;
  part_comment: string | null;
  brand: string;
  warehouse_id: string;
  warehouse_name: string;
  price: number;
  currency: string;
  quantity: number;
  package: number;
  unit: string;
  delivery_at: string | null;
  delivery_days: number | null;
  comment: string;
  total: number;
}

export interface BasketSupplierGroup {
  supplier: string;
  supplier_name: string;
  lines: BasketLine[];
  total: number;
  positions: number;
  units: number;
  currency: string;
  delivery_modes: Record<string, string>;
}

export interface Basket {
  groups: BasketSupplierGroup[];
  total: number;
  positions: number;
  units: number;
  currency: string;
  /** Поставщики, чью корзину прочитать не удалось. */
  stale_suppliers: string[];
}

export interface BasketMutation {
  line: BasketLine | null;
  basket: Basket;
}

export interface SubmitOutcome {
  supplier: string;
  supplier_name: string;
  ok: boolean;
  positions: number;
  total: number;
  message: string | null;
}

export interface SubmitResult {
  outcomes: SubmitOutcome[];
  ok: boolean;
}

export interface OrderLine {
  id: string;
  supplier: string;
  supplier_name: string;
  native_id: string;
  order_id: string;
  state_code: number;
  state_label: string;
  stage: OrderStage;
  created_at: string | null;
  delivery_mode_id: number | null;
  part_id: string;
  part_code: string;
  part_name: string;
  part_comment: string | null;
  brand: string;
  warehouse_id: string;
  warehouse_name: string;
  price: number;
  currency: string;
  quantity: number;
  reserved_quantity: number;
  unit: string;
  delivery_at: string | null;
  comment: string;
  contract_name: string;
  address_name: string;
  total: number;
}

export interface Order {
  id: string;
  order_id: string;
  supplier: string;
  supplier_name: string;
  created_at: string | null;
  stage: OrderStage;
  lines: OrderLine[];
  total: number;
  positions: number;
  units: number;
  currency: string;
  contract_name: string;
  address_name: string;
}

export interface OrdersResponse {
  orders: Order[];
  issues: SupplierIssue[];
}

export interface SuppliersResponse {
  suppliers: SupplierInfo[];
}

export interface GatewayErrorBody {
  error: {
    kind: string;
    message: string;
    detail: string | null;
    supplier: string | null;
  };
}
