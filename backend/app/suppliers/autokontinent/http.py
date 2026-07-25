"""Транспорт до api.autokontinent.ru.

Задача модуля — превратить капризы конкретного API (basic-auth, `.json` в
пути, собственные коды ошибок в теле) в обычные питоновские исключения из
`app.core.errors`. Выше по стеку про «Автоконтинент» уже никто не знает.
"""

from __future__ import annotations

import asyncio
import logging
import time
from typing import Any

import httpx

from app.core.errors import (
    GatewayError,
    SupplierAuthError,
    SupplierConflict,
    SupplierDataError,
    SupplierRejected,
    SupplierUnavailable,
)

logger = logging.getLogger(__name__)

# Коды из раздела «Типы ошибок» документации.
ERROR_AUTH = 1
ERROR_METHOD_NOT_FOUND = 2
ERROR_BAD_PARAMETER = 3
ERROR_DATA = 4
ERROR_CONCURRENT = 5


def _translate(code: int, message: str, supplier: str) -> GatewayError:
    """Код ошибки поставщика → доменное исключение.

    В `error_message` апстрим кладёт имя параметра, который ему не понравился,
    а не текст для покупателя, поэтому формулировку пишем свою.
    """
    detail = message or None
    if code == ERROR_AUTH:
        return SupplierAuthError(supplier=supplier, detail=detail)
    if code == ERROR_METHOD_NOT_FOUND:
        return GatewayError(
            "Метод поставщика недоступен",
            supplier=supplier,
            detail=detail,
        )
    if code == ERROR_BAD_PARAMETER:
        return SupplierRejected(
            f"Поставщик отклонил параметр «{message}»" if message else None,
            supplier=supplier,
            detail=detail,
        )
    if code == ERROR_DATA:
        return SupplierDataError(supplier=supplier, detail=detail)
    if code == ERROR_CONCURRENT:
        return SupplierConflict(supplier=supplier, detail=detail)
    return GatewayError(
        f"Поставщик вернул неизвестную ошибку ({code})",
        supplier=supplier,
        detail=detail,
    )


class AkHttpClient:
    """Тонкая обёртка над httpx с ретраями и переводом ошибок."""

    def __init__(
        self,
        *,
        base_url: str,
        login: str,
        password: str,
        supplier_code: str,
        timeout: float = 15.0,
        retries: int = 2,
        max_connections: int = 10,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self._base_url = base_url.rstrip("/")
        self._supplier = supplier_code
        self._retries = max(0, retries)
        self._client = httpx.AsyncClient(
            auth=httpx.BasicAuth(login, password),
            timeout=httpx.Timeout(timeout, connect=min(timeout, 5.0)),
            limits=httpx.Limits(
                max_connections=max_connections,
                max_keepalive_connections=max_connections,
            ),
            headers={"Accept": "application/json"},
            transport=transport,
            follow_redirects=True,
        )

    async def aclose(self) -> None:
        await self._client.aclose()

    async def get(self, method: str, params: dict[str, Any] | None = None) -> Any:
        return await self._request("GET", method, params=params)

    async def post(self, method: str, data: dict[str, Any] | None = None) -> Any:
        """Мутации шлём POST'ом: комментарии бывают длинными и на кириллице."""
        return await self._request("POST", method, data=data)

    async def _request(
        self,
        verb: str,
        method: str,
        *,
        params: dict[str, Any] | None = None,
        data: dict[str, Any] | None = None,
    ) -> Any:
        url = f"{self._base_url}/{method}.json"
        payload = _clean(params if verb == "GET" else data)

        # Ретраим только чтение. Повторить basket/add — значит заказать дважды.
        attempts = self._retries + 1 if verb == "GET" else 1
        last_error: Exception | None = None

        for attempt in range(attempts):
            started = time.monotonic()
            try:
                response = await self._client.request(
                    verb,
                    url,
                    params=payload if verb == "GET" else None,
                    data=payload if verb != "GET" else None,
                )
            except httpx.TimeoutException as exc:
                last_error = SupplierUnavailable(
                    "Поставщик не ответил вовремя", supplier=self._supplier, detail=str(exc)
                )
            except httpx.HTTPError as exc:
                last_error = SupplierUnavailable(
                    "Не удалось соединиться с поставщиком",
                    supplier=self._supplier,
                    detail=str(exc),
                )
            else:
                elapsed_ms = round((time.monotonic() - started) * 1000)
                logger.info(
                    "upstream call",
                    extra={
                        "supplier": self._supplier,
                        "method": method,
                        "verb": verb,
                        "status": response.status_code,
                        "ms": elapsed_ms,
                        "attempt": attempt + 1,
                    },
                )
                if response.status_code >= 500:
                    last_error = SupplierUnavailable(
                        f"Поставщик ответил {response.status_code}",
                        supplier=self._supplier,
                    )
                else:
                    return self._parse(response)

            if attempt + 1 < attempts:
                await asyncio.sleep(0.25 * (2**attempt))

        raise last_error or SupplierUnavailable(supplier=self._supplier)

    def _parse(self, response: httpx.Response) -> Any:
        if response.status_code >= 400:
            raise self._error_from(response)
        try:
            return response.json()
        except ValueError as exc:
            raise SupplierUnavailable(
                "Поставщик вернул не JSON",
                supplier=self._supplier,
                detail=response.text[:200],
            ) from exc

    def _error_from(self, response: httpx.Response) -> GatewayError:
        try:
            body = response.json()
        except ValueError:
            body = None

        if isinstance(body, dict) and "error_code" in body:
            return _translate(
                int(body.get("error_code", 0)),
                str(body.get("error_message", "")),
                self._supplier,
            )

        # 401 без тела — типичный ответ фронтового прокси, когда basic-auth не прошёл.
        if response.status_code in (401, 403):
            return SupplierAuthError(supplier=self._supplier)
        if response.status_code == 404:
            return GatewayError(
                "Метод поставщика недоступен",
                supplier=self._supplier,
                detail=f"HTTP {response.status_code}",
            )
        return SupplierUnavailable(
            f"Поставщик ответил {response.status_code}",
            supplier=self._supplier,
            detail=response.text[:200] or None,
        )


def _clean(params: dict[str, Any] | None) -> dict[str, Any]:
    """Убрать None и привести булевы к тому виду, который понимает апстрим."""
    if not params:
        return {}
    cleaned: dict[str, Any] = {}
    for key, value in params.items():
        if value is None:
            continue
        cleaned[key] = "true" if value is True else "false" if value is False else value
    return cleaned
