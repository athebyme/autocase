"""История заказов: группировка строк и агрегирование стадии."""

from __future__ import annotations

from datetime import UTC, date, datetime, timedelta

from app.domain.ids import encode
from app.domain.models import OrderLine, OrderStage
from app.services.orders import OrdersService, _aggregate_stage, _group
from app.suppliers.registry import SupplierRegistry
from tests.fakes import FakeAdapter, make_config


def line(
    order_id: str, stage: OrderStage, *, part: str = "PH5883", price: float = 100.0
) -> OrderLine:
    return OrderLine(
        id=encode("aa", f"{order_id}-{part}"),
        supplier="aa",
        supplier_name="AA",
        native_id=f"{order_id}-{part}",
        order_id=order_id,
        state_code=1,
        state_label="—",
        stage=stage,
        created_at=datetime(2026, 7, 20, tzinfo=UTC),
        part_id=encode("aa", "1"),
        part_code=part,
        part_name="Деталь",
        brand="FAKE",
        warehouse_id="1",
        warehouse_name="Основной",
        price=price,
        quantity=2,
    )


def test_group_collects_lines_into_orders() -> None:
    orders = _group([line("900", OrderStage.PENDING), line("900", OrderStage.PENDING, part="OC90")])

    assert len(orders) == 1
    assert orders[0].positions == 2
    assert orders[0].units == 4
    assert orders[0].total == 400.0


def test_orders_of_different_suppliers_do_not_merge() -> None:
    first = line("900", OrderStage.PENDING)
    second = line("900", OrderStage.PENDING).model_copy(update={"supplier": "bb"})

    orders = _group([first, second])

    assert len(orders) == 2, "одинаковый номер у разных поставщиков — это разные заказы"


def test_stage_is_the_least_advanced_line() -> None:
    stage = _aggregate_stage([line("1", OrderStage.DONE), line("1", OrderStage.PROCESSING)])
    assert stage is OrderStage.PROCESSING


def test_blocked_line_dominates() -> None:
    stage = _aggregate_stage(
        [line("1", OrderStage.DONE), line("1", OrderStage.BLOCKED), line("1", OrderStage.TRANSIT)]
    )
    assert stage is OrderStage.BLOCKED


def test_partial_refusal_does_not_mark_whole_order_failed() -> None:
    stage = _aggregate_stage([line("1", OrderStage.FAILED), line("1", OrderStage.TRANSIT)])
    assert stage is OrderStage.TRANSIT


def test_all_refused_is_failed() -> None:
    stage = _aggregate_stage([line("1", OrderStage.FAILED), line("1", OrderStage.FAILED)])
    assert stage is OrderStage.FAILED


async def test_window_is_clamped_to_supplier_history_depth() -> None:
    adapter = FakeAdapter(make_config("aa"))
    adapter.capabilities = adapter.capabilities.model_copy(update={"orders_max_age_days": 90})
    captured: list[date] = []

    async def spy(date_from: date | None = None, date_to: date | None = None) -> list[OrderLine]:
        captured.append(date_from)  # type: ignore[arg-type]
        return []

    adapter.orders = spy  # type: ignore[method-assign]
    service = OrdersService(SupplierRegistry([adapter]), timeout=5.0)

    await service.list(date_from=date.today() - timedelta(days=400))

    assert captured[0] >= date.today() - timedelta(days=90)


async def test_orders_are_returned_newest_first() -> None:
    adapter = FakeAdapter(make_config("aa"))
    service = OrdersService(SupplierRegistry([adapter]), timeout=5.0)

    orders, issues = await service.list()

    assert issues == []
    assert len(orders) == 1
    assert orders[0].order_id == "777"
