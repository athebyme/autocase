"""Параллельный опрос поставщиков.

Правило одно: один упавший поставщик не имеет права уронить выдачу.
Мы отдаём то, что успели собрать, и отдельным списком — кто и почему
не ответил, чтобы интерфейс мог сказать об этом честно.
"""

from __future__ import annotations

import asyncio
import logging
from collections.abc import Awaitable, Callable, Sequence
from typing import TypeVar

from app.core.errors import GatewayError
from app.domain.models import SupplierIssue
from app.suppliers.base import SupplierAdapter

logger = logging.getLogger(__name__)

T = TypeVar("T")


async def gather_suppliers(
    adapters: Sequence[SupplierAdapter],
    call: Callable[[SupplierAdapter], Awaitable[T]],
    *,
    timeout: float = 20.0,
) -> tuple[list[tuple[SupplierAdapter, T]], list[SupplierIssue]]:
    if not adapters:
        return [], []

    async def guarded(adapter: SupplierAdapter) -> tuple[SupplierAdapter, T]:
        return adapter, await asyncio.wait_for(call(adapter), timeout=timeout)

    settled = await asyncio.gather(
        *(guarded(adapter) for adapter in adapters),
        return_exceptions=True,
    )

    results: list[tuple[SupplierAdapter, T]] = []
    issues: list[SupplierIssue] = []

    for adapter, outcome in zip(adapters, settled, strict=True):
        if isinstance(outcome, BaseException):
            issues.append(_describe(adapter, outcome))
            continue
        results.append(outcome)

    return results, issues


def _describe(adapter: SupplierAdapter, error: BaseException) -> SupplierIssue:
    if isinstance(error, asyncio.TimeoutError):
        logger.warning("Поставщик не уложился в таймаут", extra={"supplier": adapter.code})
        return SupplierIssue(
            supplier=adapter.code,
            supplier_name=adapter.name,
            kind="timeout",
            message="Поставщик не ответил вовремя",
        )
    if isinstance(error, GatewayError):
        logger.warning(
            "Поставщик вернул ошибку",
            extra={"supplier": adapter.code, "kind": error.kind, "detail": error.detail},
        )
        return SupplierIssue(
            supplier=adapter.code,
            supplier_name=adapter.name,
            kind=error.kind,
            message=error.message,
        )
    if isinstance(error, asyncio.CancelledError):
        raise error

    logger.exception("Непредвиденная ошибка поставщика", extra={"supplier": adapter.code})
    return SupplierIssue(
        supplier=adapter.code,
        supplier_name=adapter.name,
        kind="internal",
        message="Внутренняя ошибка при обращении к поставщику",
    )
