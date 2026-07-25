"""Поиск по артикулу и проценка."""

from __future__ import annotations

from fastapi import APIRouter, Query

from app.api.deps import Catalog
from app.domain.models import OffersResult, SearchResult

router = APIRouter(tags=["catalog"])


@router.get("/search", response_model=SearchResult, summary="Найти карточки по артикулу")
async def search(
    catalog: Catalog,
    q: str = Query(min_length=1, max_length=64, description="Артикул или OEM-номер"),
) -> SearchResult:
    return await catalog.search(q)


@router.get("/offers", response_model=OffersResult, summary="Сводная проценка по артикулу")
async def offers_by_code(
    catalog: Catalog,
    q: str = Query(min_length=1, max_length=64),
    analogs: bool = Query(True, description="Показывать предложения по аналогам"),
    transit: bool = Query(True, description="Показывать транзитные предложения"),
) -> OffersResult:
    """Спрашивает всех поставщиков сразу — то, ради чего нужен мультикаталог."""
    return await catalog.offers_for_code(q, include_analogs=analogs, include_transit=transit)


@router.get(
    "/parts/{part_id}/offers",
    response_model=OffersResult,
    summary="Наличие и цены по конкретной карточке",
)
async def offers_for_part(
    part_id: str,
    catalog: Catalog,
    analogs: bool = Query(True),
    transit: bool = Query(True),
) -> OffersResult:
    return await catalog.offers_for_part(part_id, include_analogs=analogs, include_transit=transit)
