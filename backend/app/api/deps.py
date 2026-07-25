"""Достаём собранные на старте сервисы из состояния приложения."""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends, Request

from app.core.cache import TTLCache
from app.services.basket import BasketService
from app.services.catalog import CatalogService
from app.services.orders import OrdersService
from app.suppliers.registry import SupplierRegistry


def get_registry(request: Request) -> SupplierRegistry:
    return request.app.state.registry


def get_cache(request: Request) -> TTLCache:
    return request.app.state.cache


def get_catalog(request: Request) -> CatalogService:
    return request.app.state.catalog


def get_basket(request: Request) -> BasketService:
    return request.app.state.basket


def get_orders(request: Request) -> OrdersService:
    return request.app.state.orders


Registry = Annotated[SupplierRegistry, Depends(get_registry)]
Cache = Annotated[TTLCache, Depends(get_cache)]
Catalog = Annotated[CatalogService, Depends(get_catalog)]
Basket = Annotated[BasketService, Depends(get_basket)]
Orders = Annotated[OrdersService, Depends(get_orders)]
