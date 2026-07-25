"""Разбор сырых ответов поставщика: типы у него плавают, у нас — нет."""

from __future__ import annotations

from datetime import date, datetime

import pytest

from app.domain.models import OrderStage
from app.suppliers.autokontinent import mapping


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("10", (10, "10", True)),
        (">10", (10, ">10", False)),
        ("  7  ", (7, "7", True)),
        (12, (12, "12", True)),
        ("", (None, "", True)),
        (None, (None, "", True)),
        ("под заказ", (None, "под заказ", False)),
    ],
)
def test_parse_quantity(raw: object, expected: tuple[int | None, str, bool]) -> None:
    assert mapping.parse_quantity(raw) == expected


@pytest.mark.parametrize(
    "raw",
    ["2026-07-30 14:00:00", "2026-07-30T14:00:00", "30.07.2026 14:00", "2026-07-30"],
)
def test_as_datetime_formats(raw: str) -> None:
    parsed = mapping.as_datetime(raw)
    assert parsed is not None
    assert parsed.date() == date(2026, 7, 30)
    assert parsed.tzinfo is not None, "наивное время должно получить бизнес-таймзону"


def test_as_datetime_rejects_garbage() -> None:
    assert mapping.as_datetime("не дата") is None
    assert mapping.as_datetime("") is None


def test_delivery_days_counts_from_business_today() -> None:
    moment = datetime(2026, 7, 30, 10, 0, tzinfo=mapping.BUSINESS_TZ)
    assert mapping.delivery_days(moment, today=date(2026, 7, 28)) == 2
    # Прошедшая дата не должна давать отрицательный срок.
    assert mapping.delivery_days(moment, today=date(2026, 8, 5)) == 0


def test_as_int_and_float_survive_supplier_quirks() -> None:
    assert mapping.as_int("13333285") == 13333285
    assert mapping.as_int("") == 0
    assert mapping.as_int(None, 5) == 5
    assert mapping.as_float("1 240,50") == pytest.approx(1240.5)


def test_to_part_normalizes_code() -> None:
    part = mapping.to_part(
        {"part_id": 13333285, "part_code": "ph5883", "brand_name": "Fram", "part_descr": "Фильтр"},
        supplier="ak",
        supplier_name="Автоконтинент",
    )
    assert part.id == "ak:13333285"
    assert part.code == "PH5883"
    assert part.native_id == "13333285"


def test_offer_marks_other_part_as_analog() -> None:
    row = {
        "part_id": "13151369",
        "part_code": "W712/75",
        "part_name": "Фильтр масляный",
        "brand_name": "Mann",
        "warehouse_id": 5,
        "warehouse_name": "Транзит · Европа",
        "price": 690,
        "quantity": ">10",
        "package": 1,
        "dt_delivery": "2026-08-02 10:00:00",
    }
    offer = mapping.to_offer(
        row,
        supplier="ak",
        supplier_name="Автоконтинент",
        requested_part_id="13333285",
        today=date(2026, 7, 28),
    )
    assert offer.is_analog is True
    assert offer.is_transit is True, "склад «Транзит» должен получить метку кросс-докинга"
    assert offer.id == "ak:13151369:5"
    assert offer.delivery_days == 5
    assert offer.quantity == 10 and offer.quantity_exact is False


def test_offer_for_requested_part_is_not_analog() -> None:
    offer = mapping.to_offer(
        {"part_id": "13333285", "part_code": "PH5883", "warehouse_id": "1", "price": 500},
        supplier="ak",
        supplier_name="Автоконтинент",
        requested_part_id="13333285",
    )
    assert offer.is_analog is False
    assert offer.is_transit is False


@pytest.mark.parametrize(
    ("code", "stage"),
    [
        (1, OrderStage.PENDING),
        (3, OrderStage.BLOCKED),
        (5, OrderStage.TRANSIT),
        (7, OrderStage.FAILED),
        (14, OrderStage.DONE),
    ],
)
def test_order_state_mapping(code: int, stage: OrderStage) -> None:
    line = mapping.to_order_line(
        {"basket_id": "1", "order_id": "900", "state": code, "part_id": "13333285"},
        supplier="ak",
        supplier_name="Автоконтинент",
    )
    assert line.stage is stage
    assert line.state_label


def test_unknown_order_state_does_not_crash() -> None:
    line = mapping.to_order_line(
        {"basket_id": "1", "order_id": "900", "state": 99},
        supplier="ak",
        supplier_name="Автоконтинент",
    )
    assert line.stage is OrderStage.PROCESSING
    assert "99" in line.state_label


def test_rows_tolerates_non_list_payload() -> None:
    assert mapping.rows([{"a": 1}, "мусор"]) == [{"a": 1}]
    assert mapping.rows({"data": [{"a": 1}]}) == [{"a": 1}]
    assert mapping.rows({"status": "ok"}) == []
    assert mapping.rows(None) == []
