"""Разбор настроек из окружения."""

from __future__ import annotations

import pytest

from app.config import Settings


def test_cors_origins_accepts_plain_url(monkeypatch: pytest.MonkeyPatch) -> None:
    """Обычный URL в переменной окружения не должен считаться JSON."""
    monkeypatch.setenv("CORS_ORIGINS", "https://parts.seller-platform.tech")

    assert Settings().cors_origins == ["https://parts.seller-platform.tech"]


def test_cors_origins_accepts_comma_separated_list(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CORS_ORIGINS", "https://a.test, https://b.test")

    assert Settings().cors_origins == ["https://a.test", "https://b.test"]


def test_cors_origins_defaults_to_localhost(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("CORS_ORIGINS", raising=False)

    assert Settings().cors_origins == ["http://localhost:3000"]
