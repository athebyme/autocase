"""История заказов."""

from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Query

from app.api.deps import Orders
from app.api.schemas import OrdersResponse

router = APIRouter(prefix="/orders", tags=["orders"])


@router.get("", response_model=OrdersResponse, summary="Заказы за период")
async def list_orders(
    service: Orders,
    date_from: date | None = Query(None, description="Начало интервала"),
    date_to: date | None = Query(None, description="Конец интервала"),
) -> OrdersResponse:
    orders, issues = await service.list(date_from, date_to)
    return OrdersResponse(orders=orders, issues=issues)
