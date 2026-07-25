"""Транспорт: перевод чужих ошибок в наши и правила ретраев."""

from __future__ import annotations

import httpx
import pytest
import respx

from app.core.errors import (
    GatewayError,
    SupplierAuthError,
    SupplierConflict,
    SupplierDataError,
    SupplierRejected,
    SupplierUnavailable,
)
from app.suppliers.autokontinent.http import AkHttpClient

BASE = "http://api.example.test/v1"


def make_client(**kwargs: object) -> AkHttpClient:
    return AkHttpClient(
        base_url=BASE,
        login="user",
        password="secret",
        supplier_code="ak",
        timeout=1.0,
        **kwargs,  # type: ignore[arg-type]
    )


@respx.mock
async def test_get_sends_basic_auth_and_json_suffix() -> None:
    route = respx.get(f"{BASE}/search/part.json").mock(
        return_value=httpx.Response(200, json=[{"part_id": "1"}])
    )
    client = make_client()
    try:
        assert await client.get("search/part", {"part_code": "PH5883"}) == [{"part_id": "1"}]
    finally:
        await client.aclose()

    request = route.calls.last.request
    assert request.url.params["part_code"] == "PH5883"
    assert request.headers["authorization"].startswith("Basic ")


@respx.mock
async def test_booleans_become_lowercase_strings() -> None:
    route = respx.get(f"{BASE}/search/price.json").mock(return_value=httpx.Response(200, json=[]))
    client = make_client()
    try:
        await client.get("search/price", {"part_id": "1", "show_cross": True, "show_odds": False})
    finally:
        await client.aclose()

    params = route.calls.last.request.url.params
    assert params["show_cross"] == "true"
    assert params["show_odds"] == "false"


@respx.mock
async def test_none_parameters_are_dropped() -> None:
    route = respx.get(f"{BASE}/order/get.json").mock(return_value=httpx.Response(200, json=[]))
    client = make_client()
    try:
        await client.get("order/get", {"date_from": "2026-07-01", "date_to": None})
    finally:
        await client.aclose()

    params = route.calls.last.request.url.params
    assert "date_to" not in params


@pytest.mark.parametrize(
    ("error_code", "expected", "status"),
    [
        (1, SupplierAuthError, 502),
        (3, SupplierRejected, 400),
        (4, SupplierDataError, 422),
        (5, SupplierConflict, 409),
    ],
)
@respx.mock
async def test_error_codes_are_translated(
    error_code: int, expected: type[GatewayError], status: int
) -> None:
    respx.get(f"{BASE}/search/part.json").mock(
        return_value=httpx.Response(
            400, json={"error_code": error_code, "error_message": "part_code"}
        )
    )
    client = make_client()
    try:
        with pytest.raises(expected) as caught:
            await client.get("search/part", {"part_code": "x"})
    finally:
        await client.aclose()

    assert caught.value.status_code == status
    assert caught.value.supplier == "ak"


@respx.mock
async def test_bare_401_becomes_auth_error_not_browser_prompt() -> None:
    respx.get(f"{BASE}/basket/get.json").mock(return_value=httpx.Response(401, text="Unauthorized"))
    client = make_client()
    try:
        with pytest.raises(SupplierAuthError) as caught:
            await client.get("basket/get")
    finally:
        await client.aclose()
    # Наружу 401 отдавать нельзя: браузер покажет диалог basic-auth.
    assert caught.value.status_code == 502


@respx.mock
async def test_non_json_body_is_reported_as_unavailable() -> None:
    respx.get(f"{BASE}/search/part.json").mock(
        return_value=httpx.Response(200, text="<html>502 Bad Gateway</html>")
    )
    client = make_client()
    try:
        with pytest.raises(SupplierUnavailable):
            await client.get("search/part", {"part_code": "x"})
    finally:
        await client.aclose()


@respx.mock
async def test_reads_are_retried_on_server_error() -> None:
    route = respx.get(f"{BASE}/search/part.json").mock(
        side_effect=[
            httpx.Response(503),
            httpx.Response(200, json=[{"part_id": "1"}]),
        ]
    )
    client = make_client(retries=2)
    try:
        assert await client.get("search/part", {"part_code": "x"}) == [{"part_id": "1"}]
    finally:
        await client.aclose()
    assert route.call_count == 2


@respx.mock
async def test_reads_give_up_after_retries() -> None:
    route = respx.get(f"{BASE}/search/part.json").mock(return_value=httpx.Response(500))
    client = make_client(retries=1)
    try:
        with pytest.raises(SupplierUnavailable):
            await client.get("search/part", {"part_code": "x"})
    finally:
        await client.aclose()
    assert route.call_count == 2


@respx.mock
async def test_mutations_are_never_retried() -> None:
    """Повтор basket/add — это вторая строка в заказе. Ретраить нельзя."""
    route = respx.post(f"{BASE}/basket/add.json").mock(return_value=httpx.Response(502))
    client = make_client(retries=3)
    try:
        with pytest.raises(SupplierUnavailable):
            await client.post("basket/add", {"part_id": "1", "warehouse_id": "1"})
    finally:
        await client.aclose()
    assert route.call_count == 1


@respx.mock
async def test_timeout_is_translated() -> None:
    respx.get(f"{BASE}/search/part.json").mock(side_effect=httpx.ConnectTimeout("slow"))
    client = make_client(retries=0)
    try:
        with pytest.raises(SupplierUnavailable):
            await client.get("search/part", {"part_code": "x"})
    finally:
        await client.aclose()


@respx.mock
async def test_post_sends_form_encoded_body() -> None:
    route = respx.post(f"{BASE}/basket/add.json").mock(
        return_value=httpx.Response(200, json={"status": "ok", "basket_id": 1001})
    )
    client = make_client()
    try:
        await client.post(
            "basket/add",
            {"part_id": "13333285", "warehouse_id": "1", "quantity": 2, "comment": "срочно"},
        )
    finally:
        await client.aclose()

    request = route.calls.last.request
    assert request.headers["content-type"].startswith("application/x-www-form-urlencoded")
    assert "comment=" in request.content.decode()


@respx.mock
async def test_redirect_is_not_followed_with_credentials() -> None:
    """https-хост поставщика уводит на другой домен — туда basic-auth уезжать не должен."""
    route = respx.get(f"{BASE}/search/part.json").mock(
        return_value=httpx.Response(301, headers={"location": "https://elsewhere.test/v1"})
    )
    client = make_client(retries=0)
    try:
        with pytest.raises(GatewayError) as caught:
            await client.get("search/part", {"part_code": "x"})
    finally:
        await client.aclose()

    assert route.call_count == 1, "переход по редиректу выполняться не должен"
    assert "перенаправляет" in caught.value.message
