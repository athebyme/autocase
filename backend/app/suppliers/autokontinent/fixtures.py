"""Демо-бэкенд «Автоконтинента» для работы без кредов.

Реализует тот же интерфейс, что и `AkHttpClient`, и отдаёт данные в сыром
формате апстрима — значит через настоящий маппинг они проходят целиком, и
режим фикстур проверяет не только вёрстку, но и разбор ответов.
"""

from __future__ import annotations

import hashlib
import random
from datetime import date, datetime, timedelta
from typing import Any

from app.suppliers.autokontinent.http import (
    ERROR_BAD_PARAMETER,
    ERROR_CONCURRENT,
    ERROR_DATA,
    _clean,
    _translate,
)

WAREHOUSES: list[tuple[str, str]] = [
    ("1", "Санкт-Петербург · Основной"),
    ("2", "Москва · Дмитровское ш."),
    ("3", "Екатеринбург · Сибирский тракт"),
    ("4", "Аутпост Мурино"),
    ("5", "Транзит · Европа"),
    ("6", "Кросс-док СПб"),
]

# Каждая группа — семейство взаимозаменяемых артикулов. Внутри группы
# карточки считаются аналогами друг друга.
CROSS_GROUPS: list[dict[str, Any]] = [
    {
        "name": "Фильтр масляный",
        "base_price": 690,
        "package": 1,
        "comment": "Резьба M20x1.5, высота 86 мм, с обратным клапаном",
        "parts": [
            ("13333285", "PH5883", "Fram"),
            ("13151369", "W712/75", "Mann-Filter"),
            ("13208741", "OC90", "Knecht"),
            ("13094522", "0451103316", "Bosch"),
            ("13446012", "LC1520", "Lynxauto"),
        ],
    },
    {
        "name": "Колодки тормозные дисковые, передние",
        "base_price": 2840,
        "package": 1,
        "comment": "Комплект на ось, с датчиком износа",
        "parts": [
            ("14002317", "GDB1330", "TRW"),
            ("14002318", "FDB1636", "Ferodo"),
            ("14002319", "0986494104", "Bosch"),
            ("14002320", "16085", "Febi"),
        ],
    },
    {
        "name": "Свеча зажигания",
        "base_price": 410,
        "package": 4,
        "comment": "Никель-иттриевый электрод, зазор 1.1 мм",
        "parts": [
            ("15550021", "BKR6E-11", "NGK"),
            ("15550022", "FR7DC+", "Bosch"),
            ("15550023", "K20TT", "Denso"),
        ],
    },
    {
        "name": "Ремень поликлиновой",
        "base_price": 1180,
        "package": 1,
        "comment": "6PK, 1053 мм, эластичный",
        "parts": [
            ("16700455", "6PK1053", "Gates"),
            ("16700456", "6PK1053", "Contitech"),
        ],
    },
    {
        "name": "Амортизатор передний, газомасляный",
        "base_price": 5620,
        "package": 1,
        "comment": "Тип крепления: штифт/вилка, длина 520 мм",
        "parts": [
            ("17880901", "341255", "KYB"),
            ("17880902", "22-183581", "Bilstein"),
        ],
    },
    {
        "name": "Диск тормозной вентилируемый",
        "base_price": 3980,
        "package": 2,
        "comment": "Ø 288 мм, высота 46.5 мм, 5 отверстий",
        "parts": [
            ("18220110", "DF4050", "TRW"),
            ("18220111", "24.0125-0138.1", "ATE"),
        ],
    },
]


def _seeded(*parts: str) -> random.Random:
    digest = hashlib.md5("|".join(parts).encode()).hexdigest()
    return random.Random(int(digest[:12], 16))


def _index() -> dict[str, tuple[dict[str, Any], tuple[str, str, str]]]:
    table: dict[str, tuple[dict[str, Any], tuple[str, str, str]]] = {}
    for group in CROSS_GROUPS:
        for entry in group["parts"]:
            table[entry[0]] = (group, entry)
    return table


PART_INDEX = _index()


def _part_row(group: dict[str, Any], entry: tuple[str, str, str]) -> dict[str, Any]:
    part_id, code, brand = entry
    return {
        "part_id": part_id,
        "part_code": code,
        "brand_name": brand,
        "part_descr": group["name"],
    }


def _offer_rows(part_id: str, *, today: date) -> list[dict[str, Any]]:
    group, entry = PART_INDEX[part_id]
    _, code, brand = entry
    rng = _seeded(part_id, "offers")

    # Разброс цен между брендами внутри одной группы — как в жизни.
    brand_factor = 0.75 + (_seeded(brand).random() * 0.85)
    picked = rng.sample(WAREHOUSES, k=rng.randint(2, 4))

    rows: list[dict[str, Any]] = []
    for warehouse_id, warehouse_name in picked:
        transit = warehouse_id in {"5", "6"}
        days = rng.randint(3, 9) if transit else rng.randint(0, 2)
        price = group["base_price"] * brand_factor * (1.0 + 0.06 * days)
        stock = rng.choice([1, 2, 3, 4, 6, 8, 12, 30])
        rows.append(
            {
                "part_id": part_id,
                "part_code": code,
                "part_name": group["name"],
                "part_comment": group["comment"],
                "brand_name": brand,
                "warehouse_id": warehouse_id,
                "warehouse_name": warehouse_name,
                "price": int(round(price / 10.0) * 10),
                "currency_id": 1,
                "currency_name": "RUB",
                # Апстрим отдаёт остаток строкой и умеет прятать точное число.
                "quantity": f">{stock}" if stock >= 10 else str(stock),
                "package": group["package"],
                "unit": "шт",
                "dt_delivery": (
                    datetime.combine(today + timedelta(days=days), datetime.min.time())
                    + timedelta(hours=rng.choice([10, 14, 18]))
                ).strftime("%Y-%m-%d %H:%M:%S"),
            }
        )
    rows.sort(key=lambda row: row["price"])
    return rows


class FixtureApi:
    """Мини-реализация протокола «Автоконтинента» в памяти процесса."""

    def __init__(self, supplier_code: str) -> None:
        self._supplier = supplier_code
        self._basket: dict[str, dict[str, Any]] = {}
        self._orders: list[dict[str, Any]] = []
        self._next_basket_id = 4200
        self._next_order_id = 918_340
        self._seed_history()

    # --- Публичный интерфейс, совпадающий с AkHttpClient --------------------

    # Параметры прогоняем через ту же нормализацию, что и боевой транспорт:
    # по HTTP значения None не уезжают вовсе, и фикстуры не должны видеть их
    # иначе — иначе пустой комментарий превратится в строку «None».
    async def get(self, method: str, params: dict[str, Any] | None = None) -> Any:
        return self._dispatch(method, _clean(params))

    async def post(self, method: str, data: dict[str, Any] | None = None) -> Any:
        return self._dispatch(method, _clean(data))

    async def aclose(self) -> None:  # noqa: D401 - симметрия с боевым клиентом
        """Закрывать нечего."""

    # --- Роутинг ------------------------------------------------------------

    def _dispatch(self, method: str, params: dict[str, Any]) -> Any:
        handlers = {
            "search/part": self._search_part,
            "search/price": self._search_price,
            "basket/add": self._basket_add,
            "basket/get": self._basket_get,
            "basket/del": self._basket_del,
            "basket/clear": self._basket_clear,
            "basket/order": self._basket_order,
            "order/get": self._order_get,
        }
        handler = handlers.get(method)
        if handler is None:
            raise _translate(2, method, self._supplier)
        return handler(params)

    # --- Методы -------------------------------------------------------------

    def _search_part(self, params: dict[str, Any]) -> list[dict[str, Any]]:
        raw = str(params.get("part_code", "")).strip()
        if not raw:
            raise _translate(ERROR_BAD_PARAMETER, "part_code", self._supplier)

        needle = _normalize(raw)
        found: list[dict[str, Any]] = []
        for group in CROSS_GROUPS:
            for entry in group["parts"]:
                if needle in _normalize(entry[1]):
                    found.append(_part_row(group, entry))
        return found

    def _search_price(self, params: dict[str, Any]) -> list[dict[str, Any]]:
        part_id = str(params.get("part_id", "")).strip()
        if not part_id or part_id not in PART_INDEX:
            if not part_id:
                raise _translate(ERROR_BAD_PARAMETER, "part_id", self._supplier)
            return []

        show_cross = _as_bool(params.get("show_cross"), True)
        show_odds = _as_bool(params.get("show_odds"), True)
        today = date.today()

        part_ids = [part_id]
        if show_cross:
            group, _ = PART_INDEX[part_id]
            part_ids += [e[0] for e in group["parts"] if e[0] != part_id]

        rows: list[dict[str, Any]] = []
        for pid in part_ids:
            rows.extend(_offer_rows(pid, today=today))
        if not show_odds:
            rows = [row for row in rows if row["warehouse_id"] not in {"5", "6"}]
        return rows

    def _basket_add(self, params: dict[str, Any]) -> dict[str, Any]:
        part_id = str(params.get("part_id", "")).strip()
        warehouse_id = str(params.get("warehouse_id", "")).strip()
        if not part_id:
            raise _translate(ERROR_BAD_PARAMETER, "part_id", self._supplier)
        if not warehouse_id:
            raise _translate(ERROR_BAD_PARAMETER, "warehouse_id", self._supplier)
        if part_id not in PART_INDEX:
            raise _translate(ERROR_DATA, "part_id", self._supplier)

        offer = next(
            (
                row
                for row in _offer_rows(part_id, today=date.today())
                if row["warehouse_id"] == warehouse_id
            ),
            None,
        )
        if offer is None:
            raise _translate(ERROR_DATA, "warehouse_id", self._supplier)

        quantity = max(1, _as_int(params.get("quantity"), 1))
        self._next_basket_id += 1
        basket_id = str(self._next_basket_id)
        self._basket[basket_id] = {
            "basket_id": basket_id,
            "version": 1,
            "state": "Новая",
            "dt_created": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            **{k: v for k, v in offer.items() if k != "quantity"},
            "quantity": quantity,
            "comment": str(params.get("comment", "")),
        }
        return {"status": "ok", "basket_id": int(basket_id)}

    def _basket_get(self, _: dict[str, Any]) -> list[dict[str, Any]]:
        return list(self._basket.values())

    def _basket_del(self, params: dict[str, Any]) -> dict[str, Any]:
        basket_id = str(params.get("basket_id", "")).strip()
        if not basket_id:
            raise _translate(ERROR_BAD_PARAMETER, "basket_id", self._supplier)
        line = self._basket.get(basket_id)
        if line is None:
            raise _translate(ERROR_DATA, "basket_id", self._supplier)
        if _as_int(params.get("version"), -1) != line["version"]:
            raise _translate(ERROR_CONCURRENT, "version", self._supplier)
        del self._basket[basket_id]
        return {"status": "ok"}

    def _basket_clear(self, _: dict[str, Any]) -> dict[str, Any]:
        self._basket.clear()
        return {"status": "ok"}

    def _basket_order(self, params: dict[str, Any]) -> dict[str, Any]:
        if not self._basket:
            raise _translate(ERROR_DATA, "basket", self._supplier)
        self._next_order_id += 1
        order_id = str(self._next_order_id)
        mode = _as_int(params.get("delivery_mode_id"), 1)
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        for line in self._basket.values():
            self._orders.append(
                {
                    **line,
                    "order_id": order_id,
                    "state": 1,
                    "dt_created": now,
                    "delivery_mode_id": mode,
                    "reserved_quantity": line["quantity"],
                    "contract_name": "Договор поставки № 7741/24",
                    "address_name": "Санкт-Петербург, Полюстровский пр., 68",
                }
            )
        self._basket.clear()
        return {"status": "ok"}

    def _order_get(self, params: dict[str, Any]) -> list[dict[str, Any]]:
        date_from = _as_date(params.get("date_from")) or (date.today() - timedelta(days=7))
        date_to = _as_date(params.get("date_to")) or date.today()
        result = []
        for row in self._orders:
            created = datetime.strptime(row["dt_created"], "%Y-%m-%d %H:%M:%S").date()
            if date_from <= created <= date_to:
                result.append(row)
        return result

    # --- Предзаполненная история -------------------------------------------

    def _seed_history(self) -> None:
        """Пара заказов в прошлом, чтобы экран истории не был пустым."""
        plan = [
            (2, [("13333285", "1", 4, 14), ("14002317", "2", 1, 14)]),
            (5, [("15550021", "1", 8, 5), ("16700455", "5", 1, 10)]),
            (11, [("17880901", "3", 2, 4), ("18220110", "6", 2, 6)]),
        ]
        today = date.today()
        for days_ago, items in plan:
            self._next_order_id += 1
            order_id = str(self._next_order_id)
            created = datetime.combine(
                today - timedelta(days=days_ago), datetime.min.time()
            ) + timedelta(hours=11, minutes=24)
            for part_id, warehouse_id, quantity, state in items:
                offer = (
                    next(
                        (
                            row
                            for row in _offer_rows(part_id, today=today - timedelta(days=days_ago))
                            if row["warehouse_id"] == warehouse_id
                        ),
                        None,
                    )
                    or _offer_rows(part_id, today=today - timedelta(days=days_ago))[0]
                )
                self._next_basket_id += 1
                self._orders.append(
                    {
                        **offer,
                        "basket_id": str(self._next_basket_id),
                        "order_id": order_id,
                        "state": state,
                        "dt_created": created.strftime("%Y-%m-%d %H:%M:%S"),
                        "delivery_mode_id": 1,
                        "quantity": quantity,
                        "reserved_quantity": quantity if state != 7 else 0,
                        "comment": "",
                        "contract_name": "Договор поставки № 7741/24",
                        "address_name": "Санкт-Петербург, Полюстровский пр., 68",
                    }
                )


def _normalize(code: str) -> str:
    return "".join(ch for ch in code.upper() if ch.isalnum())


def _as_bool(value: Any, default: bool) -> bool:
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() not in {"0", "false", "no", ""}


def _as_int(value: Any, default: int) -> int:
    try:
        return int(str(value))
    except (TypeError, ValueError):
        return default


def _as_date(value: Any) -> date | None:
    if not value:
        return None
    for fmt in ("%Y-%m-%d", "%d.%m.%Y"):
        try:
            return datetime.strptime(str(value), fmt).date()
        except ValueError:
            continue
    return None
