"""Настройки приложения. Читаются из окружения и `.env`."""

from __future__ import annotations

import json
import logging
import os
import re
from functools import lru_cache
from pathlib import Path
from typing import Annotated

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

from app.suppliers.base import SupplierConfig

logger = logging.getLogger(__name__)

_ENV_REF = re.compile(r"\$\{([A-Za-z_][A-Za-z0-9_]*)\}")


def _expand_env(value: object) -> object:
    """Развернуть `${VAR}` в строках конфига, чтобы пароли жили в окружении."""
    if isinstance(value, str):
        return _ENV_REF.sub(lambda m: os.environ.get(m.group(1), ""), value)
    if isinstance(value, list):
        return [_expand_env(item) for item in value]
    if isinstance(value, dict):
        return {key: _expand_env(item) for key, item in value.items()}
    return value


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", ".env.local"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # --- Подключение поставщиков -------------------------------------------
    # Приоритет: файл → JSON в переменной → одиночный «Автоконтинент» из AK_*.
    suppliers_file: str | None = None
    suppliers: str | None = None

    ak_enabled: bool = True
    ak_base_url: str = "http://api.autokontinent.ru/v1"
    ak_login: str = ""
    ak_password: str = ""
    ak_timeout: float = 15.0
    ak_use_fixtures: bool | None = None

    # --- Кэш проценки -------------------------------------------------------
    # Цены и остатки живут недолго, поэтому TTL держим маленьким.
    search_cache_ttl: float = 60.0
    search_cache_size: int = 512

    # --- Распознавание автомобиля по VIN -----------------------------------
    vin_decoder_base_url: str = "https://vpic.nhtsa.dot.gov/api"
    vin_decoder_timeout: float = 10.0
    laximo_base_url: str = "https://ws.laximo.ru/restApi/v1"
    laximo_login: str = ""
    laximo_password: str = ""
    laximo_locale: str = "ru_RU"
    laximo_timeout: float = 15.0

    # --- HTTP ---------------------------------------------------------------
    # NoDecode обязателен: без него pydantic-settings пытается разобрать
    # переменную окружения как JSON и падает на обычном «https://site».
    cors_origins: Annotated[list[str], NoDecode] = Field(
        default_factory=lambda: ["http://localhost:3000"]
    )
    log_level: str = "INFO"
    debug_raw: bool = False
    """Включает /api/debug/raw — сырой ответ поставщика для диагностики."""

    supplier_fanout_timeout: float = 20.0
    """Сколько ждём медленного поставщика, прежде чем отдать выдачу без него."""

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_origins(cls, value: object) -> object:
        if isinstance(value, str):
            return [item.strip() for item in value.split(",") if item.strip()]
        return value

    def supplier_configs(self) -> list[SupplierConfig]:
        raw = self._raw_supplier_entries()
        configs: list[SupplierConfig] = []
        for entry in raw:
            try:
                configs.append(SupplierConfig.model_validate(_expand_env(entry)))
            except Exception:
                logger.exception("Некорректная запись поставщика в конфиге", extra={"entry": entry})
        return configs

    def _raw_supplier_entries(self) -> list[dict[str, object]]:
        if self.suppliers_file:
            path = Path(self.suppliers_file)
            if path.is_file():
                return json.loads(path.read_text("utf-8"))
            logger.warning("SUPPLIERS_FILE не найден: %s", path)
        if self.suppliers:
            return json.loads(self.suppliers)
        return [self._autokontinent_entry()]

    def _autokontinent_entry(self) -> dict[str, object]:
        return {
            "code": "ak",
            "type": "autokontinent",
            "name": "Автоконтинент",
            "enabled": self.ak_enabled,
            "base_url": self.ak_base_url,
            "login": self.ak_login,
            "password": self.ak_password,
            "timeout": self.ak_timeout,
            "use_fixtures": self.ak_use_fixtures,
            "priority": 10,
        }


@lru_cache
def get_settings() -> Settings:
    return Settings()
