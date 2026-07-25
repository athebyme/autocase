"""Поиск и проценка поверх всех подключённых поставщиков."""

from __future__ import annotations

import logging

from app.core.cache import TTLCache
from app.domain.ids import decode_one
from app.domain.models import (
    Offer,
    OfferGroup,
    OffersResult,
    Part,
    SearchResult,
    SupplierIssue,
)
from app.services.fanout import gather_suppliers
from app.suppliers.base import SupplierAdapter
from app.suppliers.registry import SupplierRegistry

logger = logging.getLogger(__name__)

# Сколько карточек одного поставщика проценивать в сводном режиме. Поиск по
# артикулу обычно даёт 1–6 карточек; ограничение защищает от шторма запросов
# на слишком общем вводе.
MAX_PARTS_PER_SUPPLIER = 6


def normalize_code(value: str) -> str:
    """«ph-58 83» → «PH5883». Используем как запасной вариант поиска."""
    return "".join(ch for ch in value.upper() if ch.isalnum())


class CatalogService:
    def __init__(
        self,
        registry: SupplierRegistry,
        cache: TTLCache,
        *,
        timeout: float = 20.0,
    ) -> None:
        self._registry = registry
        self._cache = cache
        self._timeout = timeout

    # --- Поиск карточек -----------------------------------------------------

    async def search(self, query: str) -> SearchResult:
        raw = query.strip()
        normalized = normalize_code(raw)
        if not raw:
            return SearchResult(query=raw, normalized_query=normalized, parts=[])

        parts, issues = await self._search_all(raw)

        # Апстрим ищет по точному написанию, а люди вводят с дефисами и
        # пробелами. Если по вводу пусто — повторяем очищенным артикулом.
        if not parts and normalized and normalized != raw.upper():
            retry_parts, retry_issues = await self._search_all(normalized)
            if retry_parts:
                parts, issues = retry_parts, retry_issues

        parts.sort(key=lambda p: (p.code != normalized, p.code, p.brand))
        return SearchResult(query=raw, normalized_query=normalized, parts=parts, issues=issues)

    async def _search_all(self, code: str) -> tuple[list[Part], list[SupplierIssue]]:
        adapters = self._registry.supporting("search")

        async def run(adapter: SupplierAdapter) -> list[Part]:
            key = f"parts:{adapter.code}:{code.upper()}"
            return await self._cache.get_or_set(key, lambda: adapter.search_parts(code))

        results, issues = await gather_suppliers(adapters, run, timeout=self._timeout)
        parts = [part for _, batch in results for part in batch]
        return parts, issues

    # --- Проценка по конкретной карточке ------------------------------------

    async def offers_for_part(
        self,
        part_id: str,
        *,
        include_analogs: bool = True,
        include_transit: bool = True,
    ) -> OffersResult:
        supplier_code, native_id = decode_one(part_id)
        adapter = self._registry.get(supplier_code)

        offers, issues = await self._offers(
            adapter,
            native_id,
            include_analogs=include_analogs,
            include_transit=include_transit,
        )
        part = next(
            (
                Part(
                    id=offer.part_id,
                    supplier=offer.supplier,
                    supplier_name=offer.supplier_name,
                    native_id=offer.part_native_id,
                    code=offer.part_code,
                    brand=offer.brand,
                    name=offer.part_name,
                )
                for offer in offers
                if not offer.is_analog
            ),
            None,
        )
        return _assemble(offers, issues, part=part)

    # --- Сводная проценка по артикулу у всех поставщиков --------------------

    async def offers_for_code(
        self,
        query: str,
        *,
        include_analogs: bool = True,
        include_transit: bool = True,
    ) -> OffersResult:
        found = await self.search(query)
        issues = list(found.issues)
        if not found.parts:
            return OffersResult(offers=[], groups=[], issues=issues)

        by_supplier: dict[str, list[Part]] = {}
        for part in found.parts:
            by_supplier.setdefault(part.supplier, []).append(part)

        targets: list[tuple[SupplierAdapter, Part]] = []
        for supplier_code, parts in by_supplier.items():
            adapter = self._registry.get(supplier_code)
            if len(parts) > MAX_PARTS_PER_SUPPLIER:
                logger.info(
                    "Проценка ограничена по числу карточек",
                    extra={
                        "supplier": supplier_code,
                        "found": len(parts),
                        "used": MAX_PARTS_PER_SUPPLIER,
                    },
                )
            targets.extend((adapter, part) for part in parts[:MAX_PARTS_PER_SUPPLIER])

        offers: list[Offer] = []
        seen: set[str] = set()
        for adapter, part in targets:
            batch, batch_issues = await self._offers(
                adapter,
                part.native_id,
                include_analogs=include_analogs,
                include_transit=include_transit,
            )
            issues.extend(batch_issues)
            for offer in batch:
                # Карточки внутри одной кросс-группы возвращают пересекающиеся
                # предложения — оставляем каждое ровно один раз.
                if offer.id in seen:
                    continue
                seen.add(offer.id)
                offers.append(offer)

        exact = {normalize_code(part.code) for part in found.parts}
        for offer in offers:
            offer.is_analog = normalize_code(offer.part_code) not in exact

        return _assemble(offers, _dedupe_issues(issues))

    async def _offers(
        self,
        adapter: SupplierAdapter,
        native_id: str,
        *,
        include_analogs: bool,
        include_transit: bool,
    ) -> tuple[list[Offer], list[SupplierIssue]]:
        key = f"offers:{adapter.code}:{native_id}:{int(include_analogs)}{int(include_transit)}"

        async def run(_: SupplierAdapter) -> list[Offer]:
            return await self._cache.get_or_set(
                key,
                lambda: adapter.get_offers(
                    native_id,
                    include_analogs=include_analogs,
                    include_transit=include_transit,
                ),
            )

        results, issues = await gather_suppliers([adapter], run, timeout=self._timeout)
        return ([offer for _, batch in results for offer in batch], issues)


def _offer_rank(offer: Offer) -> tuple[int, int, float, int]:
    """Сначала то, что реально можно купить: наличие, потом цена, потом срок."""
    out_of_stock = 1 if offer.quantity == 0 else 0
    return (out_of_stock, offer.is_analog, offer.price, offer.delivery_days or 99)


def _assemble(
    offers: list[Offer],
    issues: list[SupplierIssue],
    *,
    part: Part | None = None,
) -> OffersResult:
    ordered = sorted(offers, key=_offer_rank)

    grouped: dict[str, list[Offer]] = {}
    for offer in ordered:
        grouped.setdefault(offer.part_id, []).append(offer)

    groups: list[OfferGroup] = []
    for part_id, batch in grouped.items():
        head = batch[0]
        quantities = [o.quantity for o in batch if o.quantity is not None]
        deliveries = [o.delivery_days for o in batch if o.delivery_days is not None]
        groups.append(
            OfferGroup(
                part_id=part_id,
                part_code=head.part_code,
                part_name=head.part_name,
                brand=head.brand,
                is_analog=head.is_analog,
                offers=batch,
                min_price=min(o.price for o in batch),
                best_delivery_days=min(deliveries) if deliveries else None,
                total_quantity=sum(quantities) if quantities else None,
            )
        )
    groups.sort(key=lambda g: (g.is_analog, g.min_price))

    return OffersResult(
        part=part,
        offers=ordered,
        groups=groups,
        best_offer_id=ordered[0].id if ordered else None,
        analog_count=sum(1 for offer in ordered if offer.is_analog),
        issues=issues,
    )


def _dedupe_issues(issues: list[SupplierIssue]) -> list[SupplierIssue]:
    seen: set[tuple[str, str]] = set()
    unique: list[SupplierIssue] = []
    for issue in issues:
        key = (issue.supplier, issue.kind)
        if key in seen:
            continue
        seen.add(key)
        unique.append(issue)
    return unique
