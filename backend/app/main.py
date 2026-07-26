"""Точка входа шлюза.

Приложение ничего не хранит: это фасад над поставщиками, который приводит
их разнородные API к одному каталогу, одной корзине и одной истории заказов.
"""

from __future__ import annotations

import logging
import time
import uuid
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.routes import basket, catalog, debug, orders, system, vehicles
from app.config import get_settings
from app.core.cache import TTLCache
from app.core.errors import GatewayError
from app.core.logging import configure_logging
from app.services.basket import BasketService
from app.services.catalog import CatalogService
from app.services.orders import OrdersService
from app.services.vehicles import LaximoVinProvider, NhtsaVinProvider, VehicleLookupService
from app.suppliers.registry import SupplierRegistry

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    configure_logging(settings.log_level)

    registry = SupplierRegistry.from_configs(settings.supplier_configs())
    cache = TTLCache(ttl=settings.search_cache_ttl, maxsize=settings.search_cache_size)
    timeout = settings.supplier_fanout_timeout

    app.state.settings = settings
    app.state.registry = registry
    app.state.cache = cache
    app.state.catalog = CatalogService(registry, cache, timeout=timeout)
    app.state.basket = BasketService(registry, timeout=timeout)
    app.state.orders = OrdersService(registry, timeout=timeout)
    vin_providers = []
    if settings.laximo_login and settings.laximo_password:
        vin_providers.append(
            LaximoVinProvider(
                base_url=settings.laximo_base_url,
                login=settings.laximo_login,
                password=settings.laximo_password,
                locale=settings.laximo_locale,
                timeout=settings.laximo_timeout,
            )
        )
    vin_providers.append(
        NhtsaVinProvider(
            base_url=settings.vin_decoder_base_url,
            timeout=settings.vin_decoder_timeout,
        )
    )
    app.state.vehicle_lookup = VehicleLookupService(providers=vin_providers)

    logger.info(
        "Шлюз запущен",
        extra={
            "suppliers": [a.code for a in registry.active()],
            "live": [a.code for a in registry.active() if a.live],
        },
    )
    try:
        yield
    finally:
        await app.state.vehicle_lookup.aclose()
        await registry.aclose()


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="Autocase Gateway",
        version="0.1.0",
        summary="Единый каталог автозапчастей поверх API поставщиков",
        lifespan=lifespan,
        docs_url="/api/docs",
        openapi_url="/api/openapi.json",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.middleware("http")
    async def access_log(request: Request, call_next):  # type: ignore[no-untyped-def]
        request_id = request.headers.get("x-request-id") or uuid.uuid4().hex[:12]
        started = time.monotonic()
        response = await call_next(request)
        response.headers["x-request-id"] = request_id
        logger.info(
            "request",
            extra={
                "request_id": request_id,
                "method": request.method,
                "path": request.url.path,
                "status": response.status_code,
                "ms": round((time.monotonic() - started) * 1000),
            },
        )
        return response

    @app.exception_handler(GatewayError)
    async def gateway_error(_: Request, error: GatewayError) -> JSONResponse:
        return JSONResponse(status_code=error.status_code, content=error.as_payload())

    @app.exception_handler(RequestValidationError)
    async def validation_error(_: Request, error: RequestValidationError) -> JSONResponse:
        # Приводим к тому же конверту, что и остальные ошибки: у фронта
        # должен быть ровно один способ разобрать неудачный ответ.
        first = error.errors()[0] if error.errors() else {}
        field = ".".join(str(part) for part in first.get("loc", ())[1:]) or "запрос"
        return JSONResponse(
            status_code=422,
            content={
                "error": {
                    "kind": "validation",
                    "message": f"Некорректный параметр: {field}",
                    "detail": first.get("msg"),
                    "supplier": None,
                }
            },
        )

    for router in (
        system.router,
        catalog.router,
        vehicles.router,
        basket.router,
        orders.router,
        debug.router,
    ):
        app.include_router(router, prefix="/api")

    return app


app = create_app()
