"""Адаптер поставщика «Автоконтинент» (API v1)."""

from __future__ import annotations

import logging
from datetime import date
from typing import Any, Protocol

from app.domain.capabilities import SupplierCapabilities
from app.domain.models import BasketLine, Offer, OrderLine, Part
from app.suppliers.autokontinent import mapping
from app.suppliers.autokontinent.fixtures import FixtureApi
from app.suppliers.autokontinent.http import AkHttpClient
from app.suppliers.base import SupplierAdapter, SupplierConfig
from app.suppliers.registry import register_supplier_type

logger = logging.getLogger(__name__)


class _Api(Protocol):
    """То, что нужно адаптеру от транспорта. Живой HTTP и фикстуры взаимозаменяемы."""

    async def get(self, method: str, params: dict[str, Any] | None = None) -> Any: ...
    async def post(self, method: str, data: dict[str, Any] | None = None) -> Any: ...
    async def aclose(self) -> None: ...


class AkAdapter(SupplierAdapter):
    capabilities = SupplierCapabilities(
        search=True,
        offers=True,
        analogs=True,
        transit=True,
        remote_basket=True,
        basket_clear=True,
        line_comment=True,
        orders=True,
        orders_max_age_days=90,
        delivery_modes={1: "Доставка"},
    )

    def __init__(self, config: SupplierConfig, api: _Api | None = None) -> None:
        super().__init__(config)
        self._fixtures = (
            config.use_fixtures
            if config.use_fixtures is not None
            else not (config.login and config.password)
        )
        if api is not None:
            self._api: _Api = api
        elif self._fixtures:
            logger.warning(
                "Поставщик работает на демо-данных: не заданы креды",
                extra={"supplier": config.code},
            )
            self._api = FixtureApi(config.code)
        else:
            self._api = AkHttpClient(
                base_url=config.base_url or "http://api.autokontinent.ru/v1",
                login=config.login,
                password=config.password,
                supplier_code=config.code,
                timeout=config.timeout,
                retries=config.retries,
                max_connections=config.max_connections,
            )

    @property
    def live(self) -> bool:
        return not self._fixtures

    # --- Каталог ------------------------------------------------------------

    async def search_parts(self, part_code: str) -> list[Part]:
        payload = await self._api.get("search/part", {"part_code": part_code})
        return [
            mapping.to_part(row, supplier=self.code, supplier_name=self.name)
            for row in mapping.rows(payload)
        ]

    async def get_offers(
        self,
        part_native_id: str,
        *,
        include_analogs: bool = True,
        include_transit: bool = True,
    ) -> list[Offer]:
        payload = await self._api.get(
            "search/price",
            {
                "part_id": part_native_id,
                "show_cross": include_analogs,
                "show_odds": include_transit,
            },
        )
        return [
            mapping.to_offer(
                row,
                supplier=self.code,
                supplier_name=self.name,
                requested_part_id=part_native_id,
            )
            for row in mapping.rows(payload)
        ]

    # --- Корзина ------------------------------------------------------------

    async def basket_lines(self) -> list[BasketLine]:
        payload = await self._api.get("basket/get")
        return [
            mapping.to_basket_line(row, supplier=self.code, supplier_name=self.name)
            for row in mapping.rows(payload)
        ]

    async def basket_add(
        self,
        part_native_id: str,
        warehouse_id: str,
        quantity: int = 1,
        comment: str = "",
    ) -> str:
        payload = await self._api.post(
            "basket/add",
            {
                "part_id": part_native_id,
                "warehouse_id": warehouse_id,
                "quantity": quantity,
                "comment": comment or None,
            },
        )
        if isinstance(payload, dict):
            return mapping.as_str(payload.get("basket_id"))
        return ""

    async def basket_remove(self, native_line_id: str, version: int) -> None:
        await self._api.post("basket/del", {"basket_id": native_line_id, "version": version})

    async def basket_clear(self) -> None:
        await self._api.post("basket/clear")

    async def basket_submit(self, delivery_mode_id: int = 1) -> None:
        await self._api.post("basket/order", {"delivery_mode_id": delivery_mode_id})

    # --- Заказы -------------------------------------------------------------

    async def orders(
        self,
        date_from: date | None = None,
        date_to: date | None = None,
    ) -> list[OrderLine]:
        payload = await self._api.get(
            "order/get",
            {
                "date_from": date_from.isoformat() if date_from else None,
                "date_to": date_to.isoformat() if date_to else None,
            },
        )
        return [
            mapping.to_order_line(row, supplier=self.code, supplier_name=self.name)
            for row in mapping.rows(payload)
        ]

    async def aclose(self) -> None:
        await self._api.aclose()


@register_supplier_type("autokontinent")
def _build(config: SupplierConfig) -> SupplierAdapter:
    return AkAdapter(config)
