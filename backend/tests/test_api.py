"""Сквозные проверки HTTP-слоя на демо-поставщике."""

from __future__ import annotations

from fastapi.testclient import TestClient


def test_health_reports_fixture_mode(client: TestClient) -> None:
    body = client.get("/api/health").json()

    assert body["status"] == "ok"
    assert body["live_suppliers"] == 0, "без кредов мы на демо-данных и говорим об этом"
    assert body["suppliers"][0]["code"] == "ak"


def test_suppliers_expose_capabilities(client: TestClient) -> None:
    body = client.get("/api/suppliers").json()

    capabilities = body["suppliers"][0]["capabilities"]
    assert capabilities["remote_basket"] is True
    assert capabilities["delivery_modes"] == {"1": "Доставка"}


def test_search_finds_part(client: TestClient) -> None:
    body = client.get("/api/search", params={"q": "PH5883"}).json()

    assert body["parts"], "PH5883 должен находиться в демо-каталоге"
    assert body["parts"][0]["code"] == "PH5883"
    assert body["parts"][0]["id"].startswith("ak:")


def test_search_normalizes_messy_input(client: TestClient) -> None:
    body = client.get("/api/search", params={"q": "ph-58 83"}).json()

    assert body["normalized_query"] == "PH5883"
    assert body["parts"]


def test_search_of_nonsense_returns_empty_not_error(client: TestClient) -> None:
    response = client.get("/api/search", params={"q": "ZZZNOTHING"})

    assert response.status_code == 200
    assert response.json()["parts"] == []


def test_empty_query_is_rejected_in_our_envelope(client: TestClient) -> None:
    response = client.get("/api/search", params={"q": ""})

    assert response.status_code == 422
    assert response.json()["error"]["kind"] == "validation"


def test_offers_include_analogs_and_pick_best(client: TestClient) -> None:
    body = client.get("/api/offers", params={"q": "PH5883"}).json()

    assert body["offers"]
    assert body["best_offer_id"] == body["offers"][0]["id"]
    assert body["analog_count"] > 0, "у PH5883 в демо-каталоге есть кроссы"
    prices = [offer["price"] for offer in body["offers"] if not offer["is_analog"]]
    assert prices == sorted(prices)


def test_offers_can_hide_analogs_and_transit(client: TestClient) -> None:
    body = client.get(
        "/api/offers",
        params={"q": "PH5883", "analogs": "false", "transit": "false"},
    ).json()

    assert body["analog_count"] == 0
    assert all(not offer["is_transit"] for offer in body["offers"])


def test_offers_for_part_returns_card(client: TestClient) -> None:
    part_id = client.get("/api/search", params={"q": "PH5883"}).json()["parts"][0]["id"]

    body = client.get(f"/api/parts/{part_id}/offers").json()

    assert body["part"]["id"] == part_id
    assert body["offers"]


def test_bad_part_id_is_rejected(client: TestClient) -> None:
    response = client.get("/api/parts/мусор/offers")

    assert response.status_code == 400
    assert response.json()["error"]["kind"] == "bad_identifier"


def test_unknown_supplier_is_404(client: TestClient) -> None:
    response = client.get("/api/parts/zz:1/offers")

    assert response.status_code == 404
    assert response.json()["error"]["kind"] == "supplier_not_found"


def _first_offer_id(client: TestClient) -> str:
    return client.get("/api/offers", params={"q": "PH5883"}).json()["offers"][0]["id"]


def test_basket_full_cycle(client: TestClient) -> None:
    offer_id = _first_offer_id(client)

    added = client.post(
        "/api/basket/lines",
        json={"offer_id": offer_id, "quantity": 2, "comment": "для стенда"},
    )
    assert added.status_code == 200
    line = added.json()["line"]
    assert line["quantity"] == 2
    assert line["comment"] == "для стенда"
    assert line["total"] == line["price"] * 2

    basket = client.get("/api/basket").json()
    assert basket["positions"] == 1
    assert basket["units"] == 2
    assert basket["groups"][0]["supplier"] == "ak"

    updated = client.patch(f"/api/basket/lines/{line['id']}", json={"quantity": 5}).json()
    assert updated["line"]["quantity"] == 5
    assert updated["basket"]["units"] == 5
    assert updated["basket"]["positions"] == 1, "смена количества не должна плодить строки"

    new_line_id = updated["line"]["id"]
    after_delete = client.delete(f"/api/basket/lines/{new_line_id}").json()
    assert after_delete["basket"]["positions"] == 0


def test_empty_comment_stays_empty(client: TestClient) -> None:
    """Пустой комментарий не должен доехать до поставщика строкой «None»."""
    added = client.post("/api/basket/lines", json={"offer_id": _first_offer_id(client)}).json()

    assert added["line"]["comment"] == ""


def test_basket_clear(client: TestClient) -> None:
    offer_id = _first_offer_id(client)
    client.post("/api/basket/lines", json={"offer_id": offer_id})

    body = client.post("/api/basket/clear", json={}).json()

    assert body["basket"]["positions"] == 0


def test_submit_moves_basket_into_orders(client: TestClient) -> None:
    offer_id = _first_offer_id(client)
    client.post("/api/basket/lines", json={"offer_id": offer_id, "quantity": 3})

    submitted = client.post("/api/basket/submit", json={"delivery_mode_id": 1}).json()
    assert submitted["ok"] is True
    assert submitted["outcomes"][0]["positions"] == 1

    assert client.get("/api/basket").json()["positions"] == 0

    orders = client.get("/api/orders").json()["orders"]
    assert any(order.get("lines") for order in orders)


def test_submit_empty_basket_is_rejected(client: TestClient) -> None:
    response = client.post("/api/basket/submit", json={})

    assert response.status_code == 400
    assert response.json()["error"]["kind"] == "supplier_rejected"


def test_add_with_zero_quantity_is_rejected(client: TestClient) -> None:
    response = client.post(
        "/api/basket/lines", json={"offer_id": _first_offer_id(client), "quantity": 0}
    )

    assert response.status_code == 422


def test_orders_have_stage_and_labels(client: TestClient) -> None:
    body = client.get("/api/orders", params={"date_from": "2026-01-01"}).json()

    assert body["orders"], "в демо-режиме история предзаполнена"
    order = body["orders"][0]
    assert order["stage"] in {"pending", "blocked", "processing", "transit", "done", "failed"}
    assert order["lines"][0]["state_label"]
    assert order["total"] > 0
