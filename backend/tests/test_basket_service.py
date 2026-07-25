"""Корзина: агрегация по поставщикам и обход ограничений их API."""

from __future__ import annotations

import pytest

from app.core.errors import SupplierConflict, SupplierRejected, SupplierUnavailable
from app.services.basket import BasketService
from app.suppliers.registry import SupplierRegistry
from tests.fakes import FakeAdapter, make_config


def build(*adapters: FakeAdapter) -> BasketService:
    return BasketService(SupplierRegistry(adapters), timeout=5.0)


async def test_add_routes_by_offer_id() -> None:
    first = FakeAdapter(make_config("aa"))
    second = FakeAdapter(make_config("bb"))
    service = build(first, second)

    line = await service.add("bb:13333285:1", quantity=3)

    assert line is not None and line.supplier == "bb"
    assert line.quantity == 3
    assert first.basket == {}, "поставщик из чужого ID не должен получать запрос"


async def test_basket_groups_by_supplier_and_sums() -> None:
    first = FakeAdapter(make_config("aa"))
    second = FakeAdapter(make_config("bb"))
    service = build(first, second)

    await service.add("aa:1:1", quantity=2)
    await service.add("bb:1:1", quantity=1)
    basket = await service.get()

    assert len(basket.groups) == 2
    assert basket.positions == 2
    assert basket.units == 3
    assert basket.total == pytest.approx(3000.0)


async def test_broken_supplier_marks_basket_stale_but_keeps_rest() -> None:
    alive = FakeAdapter(make_config("aa"))
    broken = FakeAdapter(make_config("bb"), fail_with=SupplierUnavailable(supplier="bb"))
    service = build(alive, broken)
    await service.add("aa:1:1")

    basket = await service.get()

    assert basket.positions == 1
    assert basket.stale_suppliers == ["bb"]


async def test_set_quantity_replaces_line_because_api_cannot_update() -> None:
    adapter = FakeAdapter(make_config("aa"))
    service = build(adapter)
    created = await service.add("aa:13333285:1", quantity=1, comment="срочно")
    assert created is not None

    updated = await service.set_quantity(created.id, 5)

    assert updated is not None
    assert updated.quantity == 5
    assert updated.comment == "срочно", "комментарий должен пережить пересоздание строки"
    assert updated.id != created.id
    assert len(adapter.basket) == 1, "старая строка не должна остаться дублем"
    assert adapter.calls.count("basket_remove") == 1


async def test_set_quantity_is_noop_for_same_value() -> None:
    adapter = FakeAdapter(make_config("aa"))
    service = build(adapter)
    created = await service.add("aa:1:1", quantity=2)
    assert created is not None

    same = await service.set_quantity(created.id, 2)

    assert same is not None and same.id == created.id
    assert adapter.calls.count("basket_remove") == 0


async def test_set_quantity_restores_line_when_re_add_fails() -> None:
    class BrokenOnSecondAdd(FakeAdapter):
        adds = 0

        async def basket_add(self, *args: object, **kwargs: object) -> str:  # type: ignore[override]
            BrokenOnSecondAdd.adds += 1
            if BrokenOnSecondAdd.adds == 2:
                raise SupplierUnavailable(supplier=self.code)
            return await super().basket_add(*args, **kwargs)  # type: ignore[arg-type]

    adapter = BrokenOnSecondAdd(make_config("aa"))
    service = build(adapter)
    created = await service.add("aa:1:1", quantity=1)
    assert created is not None

    with pytest.raises(SupplierUnavailable):
        await service.set_quantity(created.id, 4)

    # Позиция должна вернуться в корзину, а не исчезнуть молча.
    assert len(adapter.basket) == 1
    assert next(iter(adapter.basket.values())).quantity == 1


async def test_remove_retries_after_version_conflict() -> None:
    class StaleVersion(FakeAdapter):
        raised = False

        async def basket_remove(self, native_line_id: str, version: int) -> None:  # type: ignore[override]
            if not StaleVersion.raised:
                StaleVersion.raised = True
                raise SupplierConflict(supplier=self.code)
            await super().basket_remove(native_line_id, version)

    adapter = StaleVersion(make_config("aa"))
    service = build(adapter)
    created = await service.add("aa:1:1")
    assert created is not None

    await service.remove(created.id)

    assert adapter.basket == {}


async def test_remove_unknown_line_is_rejected() -> None:
    service = build(FakeAdapter(make_config("aa")))

    with pytest.raises(SupplierRejected):
        await service.remove("aa:999")


async def test_submit_sends_each_supplier_its_own_order() -> None:
    first = FakeAdapter(make_config("aa"))
    second = FakeAdapter(make_config("bb"))
    service = build(first, second)
    await service.add("aa:1:1")
    await service.add("bb:1:1")

    result = await service.submit(delivery_mode_id=1)

    assert result.ok is True
    assert len(result.outcomes) == 2
    assert first.submitted == [1] and second.submitted == [1]


async def test_submit_reports_partial_failure_without_blocking_others() -> None:
    good = FakeAdapter(make_config("aa"))
    service = build(good, FakeAdapter(make_config("bb")))
    await service.add("aa:1:1")
    await service.add("bb:1:1")

    registry_bb = service._registry.get("bb")  # noqa: SLF001 - точечная поломка в тесте
    registry_bb.fail_with = SupplierUnavailable(supplier="bb")  # type: ignore[attr-defined]

    result = await service.submit()

    assert result.ok is False
    assert {outcome.supplier: outcome.ok for outcome in result.outcomes} == {
        "aa": True,
        "bb": False,
    }
    assert good.submitted == [1], "исправный поставщик всё равно получает заказ"


async def test_submit_empty_basket_is_rejected() -> None:
    service = build(FakeAdapter(make_config("aa")))

    with pytest.raises(SupplierRejected):
        await service.submit()


async def test_clear_hits_every_supplier() -> None:
    first = FakeAdapter(make_config("aa"))
    second = FakeAdapter(make_config("bb"))
    service = build(first, second)

    await service.clear()

    assert first.cleared == 1 and second.cleared == 1


async def test_clear_can_target_single_supplier() -> None:
    first = FakeAdapter(make_config("aa"))
    second = FakeAdapter(make_config("bb"))
    service = build(first, second)

    await service.clear("bb")

    assert first.cleared == 0 and second.cleared == 1


async def test_quantity_must_be_positive() -> None:
    service = build(FakeAdapter(make_config("aa")))

    with pytest.raises(SupplierRejected):
        await service.add("aa:1:1", quantity=0)
