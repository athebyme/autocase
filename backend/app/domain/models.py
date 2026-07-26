"""Канонические модели каталога.

Это то, что видит фронт. Адаптеры поставщиков переводят свои ответы сюда,
поэтому в этом модуле не должно появляться ни одного поля, существующего
ради одного конкретного API.
"""

from __future__ import annotations

from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, Field, computed_field

from app.domain.capabilities import SupplierCapabilities


class OrderStage(StrEnum):
    """Укрупнённая стадия строки заказа — для цветовой кодировки в интерфейсе.

    Точную формулировку поставщика отдаём отдельно, в `state_label`.
    """

    PENDING = "pending"
    """Принят, ждёт проверки."""

    BLOCKED = "blocked"
    """Требует действия покупателя: оплата, просроченный платёж."""

    PROCESSING = "processing"
    """В работе: склад, поставщик, подтверждение."""

    TRANSIT = "transit"
    """Едет: отгружен, аутпост."""

    DONE = "done"
    """Выдан."""

    FAILED = "failed"
    """Отказ."""


class SupplierInfo(BaseModel):
    code: str
    name: str
    enabled: bool = True
    configured: bool = True
    """Есть ли рабочие креды. Если нет — адаптер работает на фикстурах."""

    live: bool = True
    """False, если сейчас отдаём демо-данные, а не реальные остатки."""

    capabilities: SupplierCapabilities = Field(default_factory=SupplierCapabilities)


class VinConfidence(StrEnum):
    """Насколько точно источник связал VIN с конкретной комплектацией."""

    EXACT = "exact"
    LIKELY = "likely"
    PARTIAL = "partial"


class VehicleAttribute(BaseModel):
    """Дополнительный параметр OEM-каталога, не потерянный при нормализации."""

    key: str
    label: str
    value: str


class Vehicle(BaseModel):
    """Автомобиль, распознанный по VIN независимым декодером."""

    vin: str
    make: str
    model: str | None = None
    model_year: int | None = None
    manufacturer: str | None = None
    series: str | None = None
    trim: str | None = None
    body_class: str | None = None
    vehicle_type: str | None = None
    doors: int | None = None
    drive_type: str | None = None
    transmission: str | None = None
    transmission_speeds: int | None = None
    engine_code: str | None = None
    engine_model: str | None = None
    engine_manufacturer: str | None = None
    engine_liters: float | None = None
    engine_cylinders: int | None = None
    engine_power_hp: int | None = None
    fuel_type: str | None = None
    electrification_level: str | None = None
    production_date: str | None = None
    market: str | None = None
    plant_city: str | None = None
    plant_country: str | None = None
    catalog_code: str | None = None
    vehicle_id: str | None = None
    attributes: list[VehicleAttribute] = Field(default_factory=list)


class VinDecodeResult(BaseModel):
    vehicle: Vehicle
    alternatives: list[Vehicle] = Field(default_factory=list)
    complete: bool
    """False означает частичное распознавание, а не подтверждение комплектации."""

    confidence: VinConfidence = VinConfidence.PARTIAL
    source: str = "nhtsa"
    source_label: str = "Открытая база NHTSA"
    warnings: list[str] = Field(default_factory=list)
    missing_fields: list[str] = Field(default_factory=list)


class Part(BaseModel):
    """Карточка товара в каталоге поставщика."""

    id: str
    """Составной ID: `<supplier>:<native>`."""

    supplier: str
    supplier_name: str
    native_id: str
    code: str
    """Артикул, приведённый к верхнему регистру."""

    brand: str
    name: str


class Offer(BaseModel):
    """Предложение: конкретный склад, цена, срок."""

    id: str
    """`<supplier>:<part>:<warehouse>` — уникален в пределах выдачи."""

    supplier: str
    supplier_name: str

    part_id: str
    part_native_id: str
    part_code: str
    part_name: str
    part_comment: str | None = None
    brand: str

    warehouse_id: str
    warehouse_name: str

    price: float
    currency: str = "RUB"

    quantity: int | None = None
    """Числовая оценка остатка. None — поставщик не назвал число."""

    quantity_label: str = ""
    """Остаток как его показал поставщик: «10», «>10», «под заказ»."""

    quantity_exact: bool = True
    """False для оценок вроде «>10»."""

    package: int = 1
    """Кратность отгрузки: заказывать можно только кратно этому числу."""

    unit: str = "шт"

    delivery_at: datetime | None = None
    delivery_days: int | None = None
    """Сколько дней до доставки, считая от сегодняшнего дня в МСК."""

    is_analog: bool = False
    """Предложение по аналогу, а не по запрошенной карточке."""

    is_transit: bool = False
    """Кросс-докинг: товара нет на складе, он приедет транзитом."""


class OfferGroup(BaseModel):
    """Предложения одной карточки товара, собранные вместе."""

    part_id: str
    part_code: str
    part_name: str
    brand: str
    is_analog: bool
    offers: list[Offer]
    min_price: float
    best_delivery_days: int | None = None
    total_quantity: int | None = None


class BasketLine(BaseModel):
    id: str
    """`<supplier>:<native_basket_id>`."""

    supplier: str
    supplier_name: str
    native_id: str

    version: int
    """Нужна поставщику для оптимистичной блокировки при удалении."""

    state: str = ""
    created_at: datetime | None = None

    part_id: str
    part_code: str
    part_name: str
    part_comment: str | None = None
    brand: str

    warehouse_id: str
    warehouse_name: str

    price: float
    currency: str = "RUB"
    quantity: int = 1
    package: int = 1
    unit: str = "шт"

    delivery_at: datetime | None = None
    delivery_days: int | None = None
    comment: str = ""

    @computed_field
    @property
    def total(self) -> float:
        return round(self.price * self.quantity, 2)


class BasketSupplierGroup(BaseModel):
    """Часть корзины, которая уедет одному поставщику."""

    supplier: str
    supplier_name: str
    lines: list[BasketLine]
    total: float
    positions: int
    units: int
    currency: str = "RUB"
    delivery_modes: dict[int, str] = Field(default_factory=dict)


class Basket(BaseModel):
    groups: list[BasketSupplierGroup]
    total: float
    positions: int
    units: int
    currency: str = "RUB"
    stale_suppliers: list[str] = Field(default_factory=list)
    """Поставщики, чью корзину прочитать не удалось."""


class SubmitOutcome(BaseModel):
    """Результат отправки корзины одному поставщику."""

    supplier: str
    supplier_name: str
    ok: bool
    positions: int = 0
    total: float = 0.0
    message: str | None = None


class SubmitResult(BaseModel):
    outcomes: list[SubmitOutcome]

    @computed_field
    @property
    def ok(self) -> bool:
        return bool(self.outcomes) and all(item.ok for item in self.outcomes)


class OrderLine(BaseModel):
    id: str
    supplier: str
    supplier_name: str
    native_id: str

    order_id: str
    state_code: int
    state_label: str
    stage: OrderStage

    created_at: datetime | None = None
    delivery_mode_id: int | None = None

    part_id: str
    part_code: str
    part_name: str
    part_comment: str | None = None
    brand: str

    warehouse_id: str
    warehouse_name: str

    price: float
    currency: str = "RUB"
    quantity: int = 0
    reserved_quantity: int = 0
    unit: str = "шт"

    delivery_at: datetime | None = None
    comment: str = ""
    contract_name: str = ""
    address_name: str = ""

    @computed_field
    @property
    def total(self) -> float:
        return round(self.price * self.quantity, 2)


class Order(BaseModel):
    """Строки заказа, собранные по номеру заказа поставщика."""

    id: str
    order_id: str
    supplier: str
    supplier_name: str
    created_at: datetime | None = None
    stage: OrderStage
    lines: list[OrderLine]
    total: float
    positions: int
    units: int
    currency: str = "RUB"
    contract_name: str = ""
    address_name: str = ""


class SupplierIssue(BaseModel):
    """Один поставщик отвалился, остальные ответили. Показываем это честно."""

    supplier: str
    supplier_name: str
    kind: str
    message: str


class SearchResult(BaseModel):
    query: str
    normalized_query: str
    parts: list[Part]
    issues: list[SupplierIssue] = Field(default_factory=list)


class OffersResult(BaseModel):
    part: Part | None = None
    """Карточка, по которой спрашивали. None для сводной проценки по артикулу."""

    offers: list[Offer]
    """Плоский список, отсортированный по выгодности."""

    groups: list[OfferGroup]
    """Те же предложения, сгруппированные по карточкам товара."""

    best_offer_id: str | None = None
    analog_count: int = 0
    issues: list[SupplierIssue] = Field(default_factory=list)
