"""Реестр подключённых поставщиков.

Адаптеры регистрируют свой тип декоратором, реестр собирает их по конфигу.
Добавить поставщика — написать адаптер и дописать строчку в конфиг;
убрать — снять `enabled` или удалить запись. Кода трогать не нужно.
"""

from __future__ import annotations

import asyncio
import logging
from collections.abc import Callable, Iterable, Iterator

from app.core.errors import SupplierNotFound
from app.suppliers.base import SupplierAdapter, SupplierConfig

logger = logging.getLogger(__name__)

AdapterFactory = Callable[[SupplierConfig], SupplierAdapter]

_TYPES: dict[str, AdapterFactory] = {}
_BUILTINS_LOADED = False


def register_supplier_type(name: str) -> Callable[[AdapterFactory], AdapterFactory]:
    def decorator(factory: AdapterFactory) -> AdapterFactory:
        key = name.strip().lower()
        if key in _TYPES and _TYPES[key] is not factory:
            raise RuntimeError(f"Тип поставщика {key!r} уже зарегистрирован")
        _TYPES[key] = factory
        return factory

    return decorator


def _ensure_builtin_types() -> None:
    """Импортировать штатные адаптеры, чтобы сработали их декораторы."""
    global _BUILTINS_LOADED
    if _BUILTINS_LOADED:
        return
    from app.suppliers.autokontinent import adapter as _autokontinent  # noqa: F401

    _BUILTINS_LOADED = True


def known_types() -> list[str]:
    _ensure_builtin_types()
    return sorted(_TYPES)


def build_adapter(config: SupplierConfig) -> SupplierAdapter:
    _ensure_builtin_types()
    factory = _TYPES.get(config.type.strip().lower())
    if factory is None:
        raise ValueError(
            f"Неизвестный тип поставщика {config.type!r}. Доступны: {', '.join(known_types())}"
        )
    return factory(config)


class SupplierRegistry:
    def __init__(self, adapters: Iterable[SupplierAdapter]) -> None:
        self._adapters: dict[str, SupplierAdapter] = {}
        for adapter in adapters:
            if adapter.code in self._adapters:
                raise ValueError(f"Дубликат кода поставщика: {adapter.code!r}")
            self._adapters[adapter.code] = adapter

    @classmethod
    def from_configs(cls, configs: Iterable[SupplierConfig]) -> SupplierRegistry:
        adapters: list[SupplierAdapter] = []
        for config in configs:
            try:
                adapters.append(build_adapter(config))
            except Exception:
                # Кривая запись в конфиге не должна ронять весь магазин:
                # остальные поставщики продолжают работать.
                logger.exception("Не удалось поднять поставщика", extra={"supplier": config.code})
        return cls(adapters)

    def all(self) -> list[SupplierAdapter]:
        return list(self._adapters.values())

    def active(self) -> list[SupplierAdapter]:
        return sorted(
            (a for a in self._adapters.values() if a.enabled),
            key=lambda a: (a.priority, a.code),
        )

    def supporting(self, feature: str) -> list[SupplierAdapter]:
        return [a for a in self.active() if getattr(a.capabilities, feature, False)]

    def get(self, code: str) -> SupplierAdapter:
        adapter = self._adapters.get(code)
        if adapter is None or not adapter.enabled:
            raise SupplierNotFound(f"Поставщик {code!r} не подключён", supplier=code)
        return adapter

    async def aclose(self) -> None:
        await asyncio.gather(
            *(adapter.aclose() for adapter in self._adapters.values()),
            return_exceptions=True,
        )

    def __iter__(self) -> Iterator[SupplierAdapter]:
        return iter(self._adapters.values())

    def __len__(self) -> int:
        return len(self._adapters)
