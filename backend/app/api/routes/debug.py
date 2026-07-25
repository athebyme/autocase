"""Диагностика интеграции: сырой ответ поставщика без нашего маппинга.

Нужна ровно в одном случае — когда шлюз отвечает «ничего не найдено», а
причина может быть и в кредах, и в формате ответа. Ручка выключена по
умолчанию: включается переменной DEBUG_RAW=1.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Query, Request

from app.api.deps import Registry
from app.core.errors import GatewayError, SupplierNotFound

router = APIRouter(prefix="/debug", tags=["debug"])

ALLOWED_METHODS = {
    "search/part",
    "search/price",
    "basket/get",
    "order/get",
}


@router.get("/raw", summary="Сырой ответ поставщика (только при DEBUG_RAW=1)")
async def raw(
    request: Request,
    registry: Registry,
    supplier: str = Query("ak"),
    method: str = Query("search/part"),
    part_code: str | None = Query(None),
    part_id: str | None = Query(None),
) -> dict[str, Any]:
    if not getattr(request.app.state.settings, "debug_raw", False):
        raise SupplierNotFound("Диагностика выключена", detail="Задайте DEBUG_RAW=1")
    if method not in ALLOWED_METHODS:
        raise GatewayError(
            f"Метод {method!r} недоступен для диагностики",
            detail=f"разрешены: {', '.join(sorted(ALLOWED_METHODS))}",
        )

    adapter = registry.get(supplier)
    api = getattr(adapter, "_api", None)
    if api is None:
        raise GatewayError("У адаптера нет HTTP-транспорта", supplier=supplier)

    params: dict[str, Any] = {}
    if part_code:
        params["part_code"] = part_code
    if part_id:
        params["part_id"] = part_id

    try:
        payload = await api.get(method, params)
    except GatewayError as error:
        # Ошибку тоже показываем целиком: она и есть ответ на вопрос «почему пусто».
        return {
            "ok": False,
            "supplier": supplier,
            "method": method,
            "params": params,
            "error": error.as_payload()["error"],
        }

    return {
        "ok": True,
        "supplier": supplier,
        "method": method,
        "params": params,
        "live": adapter.live,
        "type": type(payload).__name__,
        "count": len(payload) if isinstance(payload, list) else None,
        # Больше пары записей для диагностики не нужно, а ответ бывает большим.
        "sample": payload[:2] if isinstance(payload, list) else payload,
    }
