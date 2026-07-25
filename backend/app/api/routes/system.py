"""Служебные ручки: состав подключённых поставщиков и health-check."""

from __future__ import annotations

from fastapi import APIRouter

from app.api.deps import Cache, Registry
from app.api.schemas import HealthResponse, SuppliersResponse

router = APIRouter(tags=["system"])


@router.get("/suppliers", response_model=SuppliersResponse, summary="Подключённые поставщики")
async def suppliers(registry: Registry) -> SuppliersResponse:
    """Фронт читает это, чтобы прятать элементы управления, которых нет."""
    return SuppliersResponse(suppliers=[adapter.info() for adapter in registry.active()])


@router.get("/health", response_model=HealthResponse, summary="Состояние шлюза")
async def health(registry: Registry, cache: Cache) -> HealthResponse:
    infos = [adapter.info() for adapter in registry.active()]
    return HealthResponse(
        status="ok" if infos else "degraded",
        suppliers=infos,
        live_suppliers=sum(1 for info in infos if info.live),
        cached_entries=len(cache),
    )
