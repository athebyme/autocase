"""Составные идентификаторы, кэш и реестр поставщиков."""

from __future__ import annotations

import asyncio

import pytest

from app.core.cache import TTLCache
from app.core.errors import BadIdentifier, SupplierNotFound
from app.domain import ids
from app.suppliers.base import SupplierConfig
from app.suppliers.registry import SupplierRegistry, build_adapter, known_types
from tests.fakes import FakeAdapter, make_config

# --- Идентификаторы ---------------------------------------------------------


def test_encode_decode_roundtrip() -> None:
    encoded = ids.encode("ak", "13333285")
    assert encoded == "ak:13333285"
    assert ids.decode_one(encoded) == ("ak", "13333285")


def test_encode_escapes_separator_inside_segment() -> None:
    encoded = ids.encode("ak", "A:B", "1")
    assert encoded.count(":") == 2, "разделитель внутри значения обязан быть экранирован"
    assert ids.decode(encoded, segments=2) == ("ak", ("A:B", "1"))


def test_decode_rejects_wrong_shape() -> None:
    with pytest.raises(BadIdentifier):
        ids.decode("ak:1:2", segments=1)
    with pytest.raises(BadIdentifier):
        ids.decode_one("простоstring")


def test_supplier_code_is_validated() -> None:
    with pytest.raises(ValueError):
        ids.validate_supplier_code("AK")
    with pytest.raises(ValueError):
        ids.validate_supplier_code("плохой код")
    assert ids.validate_supplier_code("ak-2") == "ak-2"


# --- Кэш --------------------------------------------------------------------


async def test_cache_returns_stored_value() -> None:
    cache = TTLCache(ttl=60, maxsize=4)
    calls = 0

    async def factory() -> int:
        nonlocal calls
        calls += 1
        return 42

    assert await cache.get_or_set("k", factory) == 42
    assert await cache.get_or_set("k", factory) == 42
    assert calls == 1


async def test_cache_expires() -> None:
    cache = TTLCache(ttl=0.01, maxsize=4)
    calls = 0

    async def factory() -> int:
        nonlocal calls
        calls += 1
        return calls

    await cache.get_or_set("k", factory)
    await asyncio.sleep(0.05)
    assert await cache.get_or_set("k", factory) == 2


async def test_cache_collapses_concurrent_misses() -> None:
    """Пять одновременных промахов по ключу — один запрос к поставщику."""
    cache = TTLCache(ttl=60, maxsize=4)
    calls = 0

    async def factory() -> int:
        nonlocal calls
        calls += 1
        await asyncio.sleep(0.02)
        return calls

    results = await asyncio.gather(*(cache.get_or_set("k", factory) for _ in range(5)))

    assert calls == 1
    assert results == [1, 1, 1, 1, 1]


async def test_cache_evicts_least_recently_used() -> None:
    cache = TTLCache(ttl=60, maxsize=2)
    for key in ("a", "b", "c"):
        await cache.get_or_set(key, _const(key))
    assert len(cache) == 2


def _const(value: str):  # noqa: ANN202
    async def factory() -> str:
        return value

    return factory


# --- Реестр -----------------------------------------------------------------


def test_autokontinent_type_is_registered() -> None:
    assert "autokontinent" in known_types()


def test_unknown_type_raises_with_hint() -> None:
    with pytest.raises(ValueError, match="autokontinent"):
        build_adapter(SupplierConfig(code="x", type="нетакого"))


def test_broken_entry_does_not_kill_other_suppliers() -> None:
    registry = SupplierRegistry.from_configs(
        [
            SupplierConfig(code="bad", type="несуществующий"),
            SupplierConfig(code="ak", type="autokontinent", use_fixtures=True),
        ]
    )
    assert [adapter.code for adapter in registry.active()] == ["ak"]


def test_disabled_supplier_is_hidden() -> None:
    registry = SupplierRegistry([FakeAdapter(make_config("aa", enabled=False))])
    assert registry.active() == []
    with pytest.raises(SupplierNotFound):
        registry.get("aa")


def test_active_order_follows_priority() -> None:
    registry = SupplierRegistry(
        [
            FakeAdapter(make_config("slow", priority=50)),
            FakeAdapter(make_config("fast", priority=10)),
        ]
    )
    assert [adapter.code for adapter in registry.active()] == ["fast", "slow"]


def test_duplicate_codes_are_rejected() -> None:
    with pytest.raises(ValueError, match="Дубликат"):
        SupplierRegistry([FakeAdapter(make_config("aa")), FakeAdapter(make_config("aa"))])


def test_supporting_filters_by_capability() -> None:
    registry = SupplierRegistry([FakeAdapter(make_config("aa"))])
    assert [a.code for a in registry.supporting("remote_basket")] == ["aa"]
    assert registry.supporting("несуществующая_фича") == []


def test_credentials_are_trimmed() -> None:
    """Хвостовой перенос из скопированного секрета не должен ломать авторизацию."""
    config = SupplierConfig(
        code="ak",
        type="autokontinent",
        login="  user\n",
        password="\tsecret ",
    )

    assert config.login == "user"
    assert config.password == "secret"
