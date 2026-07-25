"""Что именно умеет конкретный поставщик.

Фронт читает это из `/api/suppliers` и убирает элементы управления, которых
у поставщика нет: не у всех есть корзина на их стороне, не все умеют
аналоги или историю заказов.
"""

from __future__ import annotations

from pydantic import BaseModel, Field


class SupplierCapabilities(BaseModel):
    search: bool = True
    """Поиск карточек по артикулу."""

    offers: bool = True
    """Наличие и цены по карточке."""

    analogs: bool = False
    """Умеет отдавать предложения по аналогам искомого артикула."""

    transit: bool = False
    """Умеет отдавать/скрывать транзитные (кросс-докинг) предложения."""

    remote_basket: bool = False
    """Корзина живёт на стороне поставщика."""

    basket_clear: bool = False
    """Есть массовая очистка корзины."""

    line_comment: bool = False
    """Можно приложить комментарий к строке заказа."""

    orders: bool = False
    """Есть история заказов."""

    orders_max_age_days: int | None = None
    """Насколько глубоко доступна история (None — без ограничения)."""

    delivery_modes: dict[int, str] = Field(default_factory=dict)
    """Доступные виды доставки при оформлении."""
