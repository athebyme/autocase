"""Синтетический поставщик для тестов.

Заодно служит проверкой того, что подключить второго поставщика можно, не
трогая ни сервисы, ни роуты.
"""

from __future__ import annotations

from datetime import UTC, date, datetime

from app.domain.capabilities import SupplierCapabilities
from app.domain.ids import encode
from app.domain.models import BasketLine, Offer, OrderLine, OrderStage, Part
from app.suppliers.base import SupplierAdapter, SupplierConfig


def make_config(code: str, **kwargs: object) -> SupplierConfig:
    return SupplierConfig(code=code, type="fake", name=code.upper(), **kwargs)  # type: ignore[arg-type]


class FakeAdapter(SupplierAdapter):
    capabilities = SupplierCapabilities(
        search=True,
        offers=True,
        analogs=True,
        transit=True,
        remote_basket=True,
        basket_clear=True,
        line_comment=True,
        orders=True,
        delivery_modes={1: "Доставка"},
    )

    def __init__(
        self,
        config: SupplierConfig,
        *,
        catalog: dict[str, list[tuple[str, str, float]]] | None = None,
        fail_with: Exception | None = None,
        delay: float = 0.0,
    ) -> None:
        super().__init__(config)
        # {артикул: [(native_part_id, бренд, цена)]}
        self.catalog = catalog or {}
        self.fail_with = fail_with
        self.delay = delay
        self.basket: dict[str, BasketLine] = {}
        self.submitted: list[int] = []
        self.cleared = 0
        self.calls: list[str] = []
        self._next_line = 100

    @property
    def live(self) -> bool:
        return True

    async def _guard(self, name: str) -> None:
        self.calls.append(name)
        if self.delay:
            import asyncio

            await asyncio.sleep(self.delay)
        if self.fail_with is not None:
            raise self.fail_with

    async def search_parts(self, part_code: str) -> list[Part]:
        await self._guard("search_parts")
        entries = self.catalog.get(part_code.upper(), [])
        return [
            Part(
                id=encode(self.code, native_id),
                supplier=self.code,
                supplier_name=self.name,
                native_id=native_id,
                code=part_code.upper(),
                brand=brand,
                name="Деталь",
            )
            for native_id, brand, _ in entries
        ]

    async def get_offers(
        self,
        part_native_id: str,
        *,
        include_analogs: bool = True,
        include_transit: bool = True,
    ) -> list[Offer]:
        await self._guard("get_offers")
        for code, entries in self.catalog.items():
            for native_id, brand, price in entries:
                if native_id != part_native_id:
                    continue
                return [
                    Offer(
                        id=encode(self.code, native_id, "1"),
                        supplier=self.code,
                        supplier_name=self.name,
                        part_id=encode(self.code, native_id),
                        part_native_id=native_id,
                        part_code=code,
                        part_name="Деталь",
                        brand=brand,
                        warehouse_id="1",
                        warehouse_name="Основной",
                        price=price,
                        quantity=5,
                        quantity_label="5",
                        delivery_days=1,
                    )
                ]
        return []

    async def basket_lines(self) -> list[BasketLine]:
        await self._guard("basket_lines")
        return list(self.basket.values())

    async def basket_add(
        self,
        part_native_id: str,
        warehouse_id: str,
        quantity: int = 1,
        comment: str = "",
    ) -> str:
        await self._guard("basket_add")
        self._next_line += 1
        native_id = str(self._next_line)
        self.basket[native_id] = BasketLine(
            id=encode(self.code, native_id),
            supplier=self.code,
            supplier_name=self.name,
            native_id=native_id,
            version=1,
            part_id=encode(self.code, part_native_id),
            part_code="TEST",
            part_name="Деталь",
            brand="FAKE",
            warehouse_id=warehouse_id,
            warehouse_name="Основной",
            price=1000.0,
            quantity=quantity,
            comment=comment,
        )
        return native_id

    async def basket_remove(self, native_line_id: str, version: int) -> None:
        await self._guard("basket_remove")
        self.basket.pop(native_line_id, None)

    async def basket_clear(self) -> None:
        await self._guard("basket_clear")
        self.cleared += 1
        self.basket.clear()

    async def basket_submit(self, delivery_mode_id: int = 1) -> None:
        await self._guard("basket_submit")
        self.submitted.append(delivery_mode_id)
        self.basket.clear()

    async def orders(
        self,
        date_from: date | None = None,
        date_to: date | None = None,
    ) -> list[OrderLine]:
        await self._guard("orders")
        return [
            OrderLine(
                id=encode(self.code, "1"),
                supplier=self.code,
                supplier_name=self.name,
                native_id="1",
                order_id="777",
                state_code=1,
                state_label="Принят",
                stage=OrderStage.PENDING,
                created_at=datetime(2026, 7, 20, tzinfo=UTC),
                part_id=encode(self.code, "1"),
                part_code="TEST",
                part_name="Деталь",
                brand="FAKE",
                warehouse_id="1",
                warehouse_name="Основной",
                price=1000.0,
                quantity=2,
            )
        ]
