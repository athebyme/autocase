"""История заказов по всем поставщикам."""

from __future__ import annotations

from datetime import date, timedelta

from app.domain.models import Order, OrderLine, OrderStage, SupplierIssue
from app.services.fanout import gather_suppliers
from app.suppliers.registry import SupplierRegistry

# Насколько «продвинута» стадия. Заказ в целом готов ровно настолько,
# насколько готова самая отстающая его строка.
_PROGRESS: dict[OrderStage, int] = {
    OrderStage.PENDING: 0,
    OrderStage.PROCESSING: 1,
    OrderStage.TRANSIT: 2,
    OrderStage.DONE: 3,
}

DEFAULT_WINDOW_DAYS = 30


class OrdersService:
    def __init__(self, registry: SupplierRegistry, *, timeout: float = 20.0) -> None:
        self._registry = registry
        self._timeout = timeout

    async def list(
        self,
        date_from: date | None = None,
        date_to: date | None = None,
    ) -> tuple[list[Order], list[SupplierIssue]]:
        adapters = self._registry.supporting("orders")
        today = date.today()
        end = date_to or today
        start = date_from or (end - timedelta(days=DEFAULT_WINDOW_DAYS))

        results, issues = await gather_suppliers(
            adapters,
            lambda adapter: adapter.orders(
                # Поставщик может не отдавать историю глубже своего лимита —
                # обрезаем окно заранее, чтобы не ловить ошибку параметров.
                _clamp(start, adapter.capabilities.orders_max_age_days, today),
                end,
            ),
            timeout=self._timeout,
        )

        orders: list[Order] = []
        for _, lines in results:
            orders.extend(_group(lines))
        orders.sort(key=lambda order: (order.created_at is None, order.created_at), reverse=True)
        return orders, issues


def _clamp(start: date, max_age_days: int | None, today: date) -> date:
    if max_age_days is None:
        return start
    return max(start, today - timedelta(days=max_age_days))


def _group(lines: list[OrderLine]) -> list[Order]:
    buckets: dict[tuple[str, str], list[OrderLine]] = {}
    for line in lines:
        buckets.setdefault((line.supplier, line.order_id), []).append(line)

    orders: list[Order] = []
    for (supplier, order_id), batch in buckets.items():
        head = batch[0]
        orders.append(
            Order(
                id=f"{supplier}:{order_id}",
                order_id=order_id,
                supplier=supplier,
                supplier_name=head.supplier_name,
                created_at=min(
                    (line.created_at for line in batch if line.created_at), default=None
                ),
                stage=_aggregate_stage(batch),
                lines=sorted(batch, key=lambda line: (line.part_code, line.warehouse_name)),
                total=round(sum(line.total for line in batch), 2),
                positions=len(batch),
                units=sum(line.quantity for line in batch),
                currency=head.currency,
                contract_name=head.contract_name,
                address_name=head.address_name,
            )
        )
    return orders


def _aggregate_stage(lines: list[OrderLine]) -> OrderStage:
    stages = [line.stage for line in lines]
    if OrderStage.BLOCKED in stages:
        return OrderStage.BLOCKED
    active = [stage for stage in stages if stage != OrderStage.FAILED]
    if not active:
        return OrderStage.FAILED
    return min(active, key=lambda stage: _PROGRESS.get(stage, 1))
