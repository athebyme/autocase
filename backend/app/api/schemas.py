"""Схемы HTTP-слоя: тела запросов и конверты ответов."""

from __future__ import annotations

from pydantic import BaseModel, Field

from app.domain.models import (
    Basket,
    BasketLine,
    Order,
    SupplierInfo,
    SupplierIssue,
)


class AddLineRequest(BaseModel):
    offer_id: str
    quantity: int = Field(default=1, ge=1, le=9999)
    comment: str = Field(default="", max_length=500)


class UpdateLineRequest(BaseModel):
    quantity: int = Field(ge=1, le=9999)


class ClearBasketRequest(BaseModel):
    supplier: str | None = None


class SubmitRequest(BaseModel):
    delivery_mode_id: int = 1
    supplier: str | None = None


class BasketMutation(BaseModel):
    """После любой правки отдаём корзину целиком: фронту не нужен второй запрос."""

    line: BasketLine | None = None
    basket: Basket


class OrdersResponse(BaseModel):
    orders: list[Order]
    issues: list[SupplierIssue] = Field(default_factory=list)


class SuppliersResponse(BaseModel):
    suppliers: list[SupplierInfo]


class HealthResponse(BaseModel):
    status: str = "ok"
    suppliers: list[SupplierInfo]
    live_suppliers: int
    cached_entries: int
