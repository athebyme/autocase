"""Небольшой асинхронный TTL-кэш с защитой от «стада» одинаковых запросов."""

from __future__ import annotations

import asyncio
import time
from collections import OrderedDict
from collections.abc import Awaitable, Callable
from typing import Any


class TTLCache:
    """LRU + TTL. Параллельные промахи по одному ключу ждут один общий запрос.

    Это важно именно для проценки: страница карточки товара умеет дёргать
    один и тот же `part_id` из нескольких мест сразу, и без single-flight мы
    бы отправляли поставщику дубли.
    """

    def __init__(self, *, ttl: float, maxsize: int = 256) -> None:
        self._ttl = ttl
        self._maxsize = maxsize
        self._store: OrderedDict[str, tuple[float, Any]] = OrderedDict()
        self._inflight: dict[str, asyncio.Task[Any]] = {}
        self._lock = asyncio.Lock()

    def _read_fresh(self, key: str) -> tuple[bool, Any]:
        entry = self._store.get(key)
        if entry is None:
            return False, None
        expires_at, value = entry
        if expires_at <= time.monotonic():
            self._store.pop(key, None)
            return False, None
        self._store.move_to_end(key)
        return True, value

    def _write(self, key: str, value: Any) -> None:
        self._store[key] = (time.monotonic() + self._ttl, value)
        self._store.move_to_end(key)
        while len(self._store) > self._maxsize:
            self._store.popitem(last=False)

    async def get_or_set(self, key: str, factory: Callable[[], Awaitable[Any]]) -> Any:
        async with self._lock:
            hit, value = self._read_fresh(key)
            if hit:
                return value
            task = self._inflight.get(key)
            if task is None:
                task = asyncio.create_task(factory())
                self._inflight[key] = task
                owner = True
            else:
                owner = False

        try:
            result = await asyncio.shield(task)
        except asyncio.CancelledError:
            # Клиент отвалился, но запрос к поставщику пусть доедет: его
            # результат достанется следующему, кто спросит тот же ключ.
            raise
        finally:
            if owner:
                async with self._lock:
                    self._inflight.pop(key, None)

        if owner:
            async with self._lock:
                self._write(key, result)
        return result

    async def clear(self) -> None:
        async with self._lock:
            self._store.clear()

    def __len__(self) -> int:
        return len(self._store)
