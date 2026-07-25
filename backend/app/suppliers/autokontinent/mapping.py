"""Перевод ответов «Автоконтинента» в канонические модели.

Апстрим типизирован свободно: `part_id` приходит строкой, хотя объявлен
int'ом, `quantity` в проценке — тоже строка и может быть «>10». Всё
приведение к нормальным типам живёт здесь и больше нигде.
"""

from __future__ import annotations

import re
from datetime import UTC, date, datetime
from typing import Any
from zoneinfo import ZoneInfo

from app.domain.ids import encode
from app.domain.models import BasketLine, Offer, OrderLine, OrderStage, Part

# Бизнес работает по Москве: срок доставки считаем в её сутках, иначе
# «доставка завтра» у клиента во Владивостоке уедет на день.
BUSINESS_TZ = ZoneInfo("Europe/Moscow")

_DATE_FORMATS = (
    "%Y-%m-%d %H:%M:%S",
    "%Y-%m-%dT%H:%M:%S",
    "%Y-%m-%d %H:%M",
    "%Y-%m-%d",
    "%d.%m.%Y %H:%M:%S",
    "%d.%m.%Y %H:%M",
    "%d.%m.%Y",
)

_QUANTITY_RE = re.compile(r"(\d+(?:[.,]\d+)?)")
_TRANSIT_RE = re.compile(r"транзит|transit|кросс|cross|под\s*заказ", re.IGNORECASE)

# «Статус строки заказа» из документации.
ORDER_STATES: dict[int, tuple[str, OrderStage]] = {
    1: ("Принят", OrderStage.PENDING),
    2: ("Проверка кредитного лимита", OrderStage.PENDING),
    3: ("Заблокирован, требует оплаты", OrderStage.BLOCKED),
    4: ("В работе на складе", OrderStage.PROCESSING),
    5: ("Отгружен", OrderStage.TRANSIT),
    6: ("Отправлен заказ поставщику", OrderStage.PROCESSING),
    7: ("Отказ поставщика", OrderStage.FAILED),
    8: ("Поступил на склад", OrderStage.PROCESSING),
    9: ("Отказ", OrderStage.FAILED),
    10: ("Подтверждён поставщиком", OrderStage.PROCESSING),
    11: ("Отправлен на аутпост", OrderStage.TRANSIT),
    12: ("Прибыл на аутпост", OrderStage.TRANSIT),
    13: ("Просроченный платёж", OrderStage.BLOCKED),
    14: ("Выдан", OrderStage.DONE),
}


def as_str(value: Any, default: str = "") -> str:
    if value is None:
        return default
    text = str(value).strip()
    return text or default


def as_int(value: Any, default: int = 0) -> int:
    if value is None or value == "":
        return default
    try:
        return int(float(str(value).replace(",", ".")))
    except (TypeError, ValueError):
        return default


def as_float(value: Any, default: float = 0.0) -> float:
    if value is None or value == "":
        return default
    try:
        return float(str(value).replace(" ", "").replace(",", "."))
    except (TypeError, ValueError):
        return default


def as_datetime(value: Any) -> datetime | None:
    if not value:
        return None
    text = str(value).strip()
    if not text:
        return None

    parsed: datetime | None = None
    try:
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        for fmt in _DATE_FORMATS:
            try:
                parsed = datetime.strptime(text, fmt)
                break
            except ValueError:
                continue
    if parsed is None:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=BUSINESS_TZ)
    return parsed


def parse_quantity(value: Any) -> tuple[int | None, str, bool]:
    """`"10"` → (10, «10», True); `">10"` → (10, «>10», False)."""
    label = as_str(value)
    if not label:
        return None, "", True
    match = _QUANTITY_RE.search(label.replace(",", "."))
    if not match:
        return None, label, False
    number = int(float(match.group(1)))
    exact = label.strip().replace(" ", "") == match.group(1)
    return number, label, exact


def delivery_days(moment: datetime | None, *, today: date | None = None) -> int | None:
    if moment is None:
        return None
    reference = today or datetime.now(BUSINESS_TZ).date()
    local = moment.astimezone(BUSINESS_TZ) if moment.tzinfo else moment.replace(tzinfo=BUSINESS_TZ)
    return max(0, (local.date() - reference).days)


def looks_transit(warehouse_name: str) -> bool:
    """Эвристика: у API нет явного признака кросс-докинга в ответе.

    Фильтрация транзита всё равно делается настоящим параметром `show_odds`,
    здесь мы только рисуем метку в интерфейсе.
    """
    return bool(_TRANSIT_RE.search(warehouse_name))


def _utc_iso(moment: datetime | None) -> datetime | None:
    return moment.astimezone(UTC) if moment else None


def to_part(row: dict[str, Any], *, supplier: str, supplier_name: str) -> Part:
    native_id = as_str(row.get("part_id"))
    return Part(
        id=encode(supplier, native_id),
        supplier=supplier,
        supplier_name=supplier_name,
        native_id=native_id,
        code=as_str(row.get("part_code")).upper(),
        brand=as_str(row.get("brand_name")),
        name=as_str(row.get("part_descr")) or as_str(row.get("part_name")),
    )


def to_offer(
    row: dict[str, Any],
    *,
    supplier: str,
    supplier_name: str,
    requested_part_id: str,
    today: date | None = None,
) -> Offer:
    native_part_id = as_str(row.get("part_id"))
    warehouse_id = as_str(row.get("warehouse_id"))
    warehouse_name = as_str(row.get("warehouse_name"))
    quantity, quantity_label, quantity_exact = parse_quantity(row.get("quantity"))
    delivery_at = as_datetime(row.get("dt_delivery"))

    return Offer(
        id=encode(supplier, native_part_id, warehouse_id),
        supplier=supplier,
        supplier_name=supplier_name,
        part_id=encode(supplier, native_part_id),
        part_native_id=native_part_id,
        part_code=as_str(row.get("part_code")).upper(),
        part_name=as_str(row.get("part_name")) or as_str(row.get("part_descr")),
        part_comment=as_str(row.get("part_comment")) or None,
        brand=as_str(row.get("brand_name")),
        warehouse_id=warehouse_id,
        warehouse_name=warehouse_name,
        price=as_float(row.get("price")),
        currency=as_str(row.get("currency_name"), "RUB"),
        quantity=quantity,
        quantity_label=quantity_label,
        quantity_exact=quantity_exact,
        package=max(1, as_int(row.get("package"), 1)),
        unit=as_str(row.get("unit"), "шт"),
        delivery_at=_utc_iso(delivery_at),
        delivery_days=delivery_days(delivery_at, today=today),
        # Карточка с другим part_id в выдаче проценки — это аналог (кросс).
        is_analog=bool(requested_part_id) and native_part_id != requested_part_id,
        is_transit=looks_transit(warehouse_name),
    )


def to_basket_line(
    row: dict[str, Any],
    *,
    supplier: str,
    supplier_name: str,
    today: date | None = None,
) -> BasketLine:
    native_id = as_str(row.get("basket_id"))
    native_part_id = as_str(row.get("part_id"))
    delivery_at = as_datetime(row.get("dt_delivery"))

    return BasketLine(
        id=encode(supplier, native_id),
        supplier=supplier,
        supplier_name=supplier_name,
        native_id=native_id,
        version=as_int(row.get("version")),
        state=as_str(row.get("state")),
        created_at=_utc_iso(as_datetime(row.get("dt_created"))),
        part_id=encode(supplier, native_part_id),
        part_code=as_str(row.get("part_code")).upper(),
        part_name=as_str(row.get("part_name")),
        part_comment=as_str(row.get("part_comment")) or None,
        brand=as_str(row.get("brand_name")),
        warehouse_id=as_str(row.get("warehouse_id")),
        warehouse_name=as_str(row.get("warehouse_name")),
        price=as_float(row.get("price")),
        currency=as_str(row.get("currency_name"), "RUB"),
        quantity=max(1, as_int(row.get("quantity"), 1)),
        package=max(1, as_int(row.get("package"), 1)),
        unit=as_str(row.get("unit"), "шт"),
        delivery_at=_utc_iso(delivery_at),
        delivery_days=delivery_days(delivery_at, today=today),
        comment=as_str(row.get("comment")),
    )


def to_order_line(row: dict[str, Any], *, supplier: str, supplier_name: str) -> OrderLine:
    native_id = as_str(row.get("basket_id"))
    native_part_id = as_str(row.get("part_id"))
    state_code = as_int(row.get("state"))
    label, stage = ORDER_STATES.get(state_code, (f"Статус {state_code}", OrderStage.PROCESSING))

    return OrderLine(
        id=encode(supplier, native_id),
        supplier=supplier,
        supplier_name=supplier_name,
        native_id=native_id,
        order_id=as_str(row.get("order_id")),
        state_code=state_code,
        state_label=label,
        stage=stage,
        created_at=_utc_iso(as_datetime(row.get("dt_created"))),
        delivery_mode_id=as_int(row.get("delivery_mode_id")) or None,
        part_id=encode(supplier, native_part_id),
        part_code=as_str(row.get("part_code")).upper(),
        part_name=as_str(row.get("part_name")),
        part_comment=as_str(row.get("part_comment")) or None,
        brand=as_str(row.get("brand_name")),
        warehouse_id=as_str(row.get("warehouse_id")),
        warehouse_name=as_str(row.get("warehouse_name")),
        price=as_float(row.get("price")),
        currency=as_str(row.get("currency_name"), "RUB"),
        quantity=as_int(row.get("quantity")),
        reserved_quantity=as_int(row.get("reserved_quantity")),
        unit=as_str(row.get("unit"), "шт"),
        delivery_at=_utc_iso(as_datetime(row.get("dt_delivery"))),
        comment=as_str(row.get("comment")),
        contract_name=as_str(row.get("contract_name")),
        address_name=as_str(row.get("address_name")),
    )


def rows(payload: Any) -> list[dict[str, Any]]:
    """Апстрим обещает массив, но на пустой выдаче встречается и объект."""
    if isinstance(payload, list):
        return [row for row in payload if isinstance(row, dict)]
    if isinstance(payload, dict):
        for key in ("data", "items", "result"):
            nested = payload.get(key)
            if isinstance(nested, list):
                return [row for row in nested if isinstance(row, dict)]
    return []
