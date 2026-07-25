"""Корзина, собранная из корзин разных поставщиков.

Снаружи это одна корзина. Внутри — по одной на каждого поставщика, и
оформление разъезжается по ним отдельными заказами.
"""

from __future__ import annotations

import logging

from app.core.errors import SupplierConflict, SupplierRejected
from app.domain.ids import decode, decode_one
from app.domain.models import (
    Basket,
    BasketLine,
    BasketSupplierGroup,
    SubmitOutcome,
    SubmitResult,
)
from app.services.fanout import gather_suppliers
from app.suppliers.base import SupplierAdapter
from app.suppliers.registry import SupplierRegistry

logger = logging.getLogger(__name__)


class BasketService:
    def __init__(self, registry: SupplierRegistry, *, timeout: float = 20.0) -> None:
        self._registry = registry
        self._timeout = timeout

    async def get(self) -> Basket:
        adapters = self._registry.supporting("remote_basket")
        results, issues = await gather_suppliers(
            adapters,
            lambda adapter: adapter.basket_lines(),
            timeout=self._timeout,
        )

        groups: list[BasketSupplierGroup] = []
        for adapter, lines in results:
            if not lines:
                continue
            groups.append(
                BasketSupplierGroup(
                    supplier=adapter.code,
                    supplier_name=adapter.name,
                    lines=lines,
                    total=round(sum(line.total for line in lines), 2),
                    positions=len(lines),
                    units=sum(line.quantity for line in lines),
                    currency=lines[0].currency,
                    delivery_modes=adapter.capabilities.delivery_modes,
                )
            )
        groups.sort(key=lambda group: group.supplier_name)

        return Basket(
            groups=groups,
            total=round(sum(group.total for group in groups), 2),
            positions=sum(group.positions for group in groups),
            units=sum(group.units for group in groups),
            stale_suppliers=[issue.supplier for issue in issues],
        )

    async def add(self, offer_id: str, quantity: int = 1, comment: str = "") -> BasketLine | None:
        supplier_code, (part_native_id, warehouse_id) = decode(offer_id, segments=2)
        adapter = self._registry.get(supplier_code)
        if quantity < 1:
            raise SupplierRejected("Количество должно быть положительным", supplier=supplier_code)

        native_line_id = await adapter.basket_add(
            part_native_id,
            warehouse_id,
            quantity=quantity,
            comment=comment,
        )
        return await self._find_line(adapter, native_line_id)

    async def remove(self, line_id: str) -> None:
        adapter, line = await self._resolve(line_id)
        await self._remove_line(adapter, line)

    async def set_quantity(self, line_id: str, quantity: int) -> BasketLine | None:
        """API поставщика не умеет менять количество: только удалить и добавить.

        Порядок «сначала удалить» выбран сознательно: если второй шаг упадёт,
        мы попробуем вернуть строку как было, и худший исход — пустая позиция,
        которую видно. Обратный порядок в худшем исходе даёт дубль в заказе.
        """
        adapter, line = await self._resolve(line_id)
        if quantity < 1:
            raise SupplierRejected("Количество должно быть положительным", supplier=adapter.code)
        if quantity == line.quantity:
            return line

        await self._remove_line(adapter, line)
        try:
            native_line_id = await adapter.basket_add(
                decode_one(line.part_id)[1],
                line.warehouse_id,
                quantity=quantity,
                comment=line.comment,
            )
        except Exception:
            logger.exception(
                "Не удалось изменить количество, восстанавливаю позицию",
                extra={"supplier": adapter.code, "line": line.native_id},
            )
            await self._restore(adapter, line)
            raise
        return await self._find_line(adapter, native_line_id)

    async def clear(self, supplier: str | None = None) -> None:
        adapters = (
            [self._registry.get(supplier)]
            if supplier
            else self._registry.supporting("basket_clear")
        )
        _, issues = await gather_suppliers(
            adapters,
            lambda adapter: adapter.basket_clear(),
            timeout=self._timeout,
        )
        if issues and supplier:
            raise SupplierRejected(issues[0].message, supplier=supplier)

    async def submit(self, delivery_mode_id: int = 1, supplier: str | None = None) -> SubmitResult:
        basket = await self.get()
        groups = [g for g in basket.groups if supplier is None or g.supplier == supplier]
        stale = [s for s in basket.stale_suppliers if supplier is None or s == supplier]
        if not groups and not stale:
            raise SupplierRejected("Корзина пуста")

        outcomes: list[SubmitOutcome] = []

        # Поставщик, чью корзину мы не смогли прочитать, мог остаться с
        # неоформленными позициями. Промолчать здесь — значит показать
        # «заказ принят» на половину заказа.
        for code in stale:
            adapter = self._registry.get(code)
            outcomes.append(
                SubmitOutcome(
                    supplier=code,
                    supplier_name=adapter.name,
                    ok=False,
                    message="Не удалось получить корзину поставщика, заказ не отправлен",
                )
            )

        for group in groups:
            adapter = self._registry.get(group.supplier)
            try:
                await adapter.basket_submit(delivery_mode_id)
            except Exception as error:
                # Один поставщик не принял заказ — остальные всё равно уходят,
                # иначе покупатель застрянет из-за чужой поломки.
                logger.exception("Не удалось оформить заказ", extra={"supplier": group.supplier})
                outcomes.append(
                    SubmitOutcome(
                        supplier=group.supplier,
                        supplier_name=group.supplier_name,
                        ok=False,
                        positions=group.positions,
                        total=group.total,
                        message=getattr(error, "message", "Не удалось оформить заказ"),
                    )
                )
            else:
                outcomes.append(
                    SubmitOutcome(
                        supplier=group.supplier,
                        supplier_name=group.supplier_name,
                        ok=True,
                        positions=group.positions,
                        total=group.total,
                    )
                )
        return SubmitResult(outcomes=outcomes)

    # --- Внутреннее ---------------------------------------------------------

    async def _resolve(self, line_id: str) -> tuple[SupplierAdapter, BasketLine]:
        supplier_code, (native_id,) = decode(line_id, segments=1)
        adapter = self._registry.get(supplier_code)
        line = await self._find_line(adapter, native_id)
        if line is None:
            raise SupplierRejected("Позиция уже не в корзине", supplier=supplier_code)
        return adapter, line

    async def _find_line(self, adapter: SupplierAdapter, native_id: str) -> BasketLine | None:
        if not native_id:
            return None
        lines = await adapter.basket_lines()
        return next((line for line in lines if line.native_id == native_id), None)

    async def _remove_line(self, adapter: SupplierAdapter, line: BasketLine) -> None:
        """Удаление требует актуальной версии строки: перечитываем и повторяем."""
        try:
            await adapter.basket_remove(line.native_id, line.version)
            return
        except SupplierConflict:
            logger.info(
                "Версия строки устарела, перечитываю корзину",
                extra={"supplier": adapter.code, "line": line.native_id},
            )

        fresh = await self._find_line(adapter, line.native_id)
        if fresh is None:
            return
        await adapter.basket_remove(fresh.native_id, fresh.version)

    async def _restore(self, adapter: SupplierAdapter, line: BasketLine) -> None:
        try:
            await adapter.basket_add(
                decode_one(line.part_id)[1],
                line.warehouse_id,
                quantity=line.quantity,
                comment=line.comment,
            )
        except Exception:
            logger.exception(
                "Не удалось восстановить позицию корзины",
                extra={"supplier": adapter.code, "line": line.native_id},
            )
