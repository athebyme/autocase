"""Каталог поверх нескольких поставщиков."""

from __future__ import annotations

from app.core.cache import TTLCache
from app.core.errors import SupplierUnavailable
from app.services.catalog import CatalogService, normalize_code
from app.suppliers.registry import SupplierRegistry
from tests.fakes import FakeAdapter, make_config


def build(*adapters: FakeAdapter, ttl: float = 60.0) -> CatalogService:
    registry = SupplierRegistry(adapters)
    return CatalogService(registry, TTLCache(ttl=ttl, maxsize=32), timeout=5.0)


def test_normalize_code_strips_noise() -> None:
    assert normalize_code("ph-58 83") == "PH5883"
    assert normalize_code("w712/75") == "W71275"


async def test_search_merges_all_suppliers() -> None:
    first = FakeAdapter(make_config("aa"), catalog={"PH5883": [("1", "Fram", 700.0)]})
    second = FakeAdapter(make_config("bb"), catalog={"PH5883": [("1", "Mann", 650.0)]})

    result = await build(first, second).search("PH5883")

    assert len(result.parts) == 2
    # Одинаковый native_id у разных поставщиков не должен схлопываться.
    assert {part.id for part in result.parts} == {"aa:1", "bb:1"}
    assert result.issues == []


async def test_search_survives_broken_supplier() -> None:
    alive = FakeAdapter(make_config("aa"), catalog={"PH5883": [("1", "Fram", 700.0)]})
    broken = FakeAdapter(make_config("bb"), fail_with=SupplierUnavailable(supplier="bb"))

    result = await build(alive, broken).search("PH5883")

    assert [part.supplier for part in result.parts] == ["aa"]
    assert len(result.issues) == 1
    assert result.issues[0].supplier == "bb"
    assert result.issues[0].kind == "supplier_unavailable"


async def test_search_retries_with_normalized_code() -> None:
    adapter = FakeAdapter(make_config("aa"), catalog={"PH5883": [("1", "Fram", 700.0)]})

    result = await build(adapter).search("ph-58 83")

    assert len(result.parts) == 1
    assert result.normalized_query == "PH5883"
    assert adapter.calls.count("search_parts") == 2, (
        "первый заход по сырому вводу, второй — по очищенному"
    )


async def test_search_does_not_retry_when_something_found() -> None:
    adapter = FakeAdapter(make_config("aa"), catalog={"PH5883": [("1", "Fram", 700.0)]})

    await build(adapter).search("PH5883")

    assert adapter.calls.count("search_parts") == 1


async def test_offers_sorted_by_price_and_best_offer_chosen() -> None:
    cheap = FakeAdapter(make_config("aa"), catalog={"PH5883": [("1", "Fram", 640.0)]})
    pricey = FakeAdapter(make_config("bb"), catalog={"PH5883": [("1", "Mann", 910.0)]})

    result = await build(cheap, pricey).offers_for_code("PH5883")

    assert [offer.price for offer in result.offers] == [640.0, 910.0]
    assert result.best_offer_id == "aa:1:1"
    assert result.analog_count == 0


async def test_offers_group_by_part_card() -> None:
    adapter = FakeAdapter(
        make_config("aa"),
        catalog={"PH5883": [("1", "Fram", 700.0), ("2", "Mann", 650.0)]},
    )

    result = await build(adapter).offers_for_code("PH5883")

    assert len(result.groups) == 2
    assert [group.min_price for group in result.groups] == [650.0, 700.0]
    assert all(group.offers for group in result.groups)


async def test_offers_for_part_targets_single_supplier() -> None:
    target = FakeAdapter(make_config("aa"), catalog={"PH5883": [("1", "Fram", 700.0)]})
    other = FakeAdapter(make_config("bb"), catalog={"PH5883": [("1", "Mann", 650.0)]})

    result = await build(target, other).offers_for_part("aa:1")

    assert [offer.supplier for offer in result.offers] == ["aa"]
    assert other.calls == [], "чужого поставщика дёргать не за чем"
    assert result.part is not None and result.part.brand == "Fram"


async def test_cache_prevents_repeat_calls() -> None:
    adapter = FakeAdapter(make_config("aa"), catalog={"PH5883": [("1", "Fram", 700.0)]})
    service = build(adapter)

    await service.search("PH5883")
    await service.search("PH5883")

    assert adapter.calls.count("search_parts") == 1


async def test_empty_query_returns_nothing_without_calling_suppliers() -> None:
    adapter = FakeAdapter(make_config("aa"))

    result = await build(adapter).search("   ")

    assert result.parts == []
    assert adapter.calls == []
