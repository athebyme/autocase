from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.config import get_settings
from app.suppliers.autokontinent.adapter import AkAdapter
from app.suppliers.base import SupplierConfig


@pytest.fixture
def settings_env(monkeypatch: pytest.MonkeyPatch) -> None:
    """Изолируем тесты от локального .env и заставляем работать на фикстурах."""
    for name in ("AK_LOGIN", "AK_PASSWORD", "SUPPLIERS", "SUPPLIERS_FILE"):
        monkeypatch.delenv(name, raising=False)
    monkeypatch.setenv("AK_USE_FIXTURES", "true")
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


@pytest.fixture
def client(settings_env: None) -> TestClient:
    from app.main import create_app

    with TestClient(create_app()) as test_client:
        yield test_client


@pytest.fixture
def fixture_adapter() -> AkAdapter:
    return AkAdapter(
        SupplierConfig(code="ak", type="autokontinent", name="Автоконтинент", use_fixtures=True)
    )
