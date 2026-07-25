"""Контракт адаптера поставщика.

Новый поставщик = новый подкласс `SupplierAdapter` + регистрация типа в
`app.suppliers.registry`. Остальное приложение о нём ничего не знает:
роуты и сервисы работают только с каноническими моделями из `app.domain`.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import date

from pydantic import BaseModel, Field, field_validator

from app.core.errors import FeatureNotSupported
from app.domain.capabilities import SupplierCapabilities
from app.domain.ids import validate_supplier_code
from app.domain.models import BasketLine, Offer, OrderLine, Part, SupplierInfo


class SupplierConfig(BaseModel):
    """Описание одного подключения. Приходит из окружения или JSON-файла."""

    code: str
    """Короткий код: попадает во все составные ID, менять его больно."""

    type: str
    """Какой адаптер поднимать. См. реестр типов."""

    name: str = ""
    enabled: bool = True

    base_url: str = ""
    login: str = ""
    password: str = ""

    timeout: float = 15.0
    retries: int = 2
    max_connections: int = 10

    use_fixtures: bool | None = None
    """None — решает сам адаптер (обычно: нет кредов → фикстуры."""

    priority: int = 100
    """Порядок в выдаче при равных цене и сроке. Меньше — выше."""

    options: dict[str, object] = Field(default_factory=dict)
    """Специфика конкретного адаптера, которой не место в общей схеме."""

    @field_validator("code")
    @classmethod
    def _check_code(cls, value: str) -> str:
        return validate_supplier_code(value.strip().lower())

    @field_validator("base_url")
    @classmethod
    def _strip(cls, value: str) -> str:
        return value.rstrip("/")

    def model_post_init(self, _: object) -> None:
        if not self.name:
            object.__setattr__(self, "name", self.code.upper())


class SupplierAdapter(ABC):
    """Базовый адаптер. Всё, что поставщик не умеет, остаётся 501-м."""

    capabilities: SupplierCapabilities = SupplierCapabilities()

    def __init__(self, config: SupplierConfig) -> None:
        self.config = config

    @property
    def code(self) -> str:
        return self.config.code

    @property
    def name(self) -> str:
        return self.config.name

    @property
    def enabled(self) -> bool:
        return self.config.enabled

    @property
    def priority(self) -> int:
        return self.config.priority

    @property
    def configured(self) -> bool:
        """Есть ли всё, чтобы ходить в настоящий API."""
        return bool(self.config.login and self.config.password)

    @property
    def live(self) -> bool:
        """False — отдаём демо-данные."""
        return self.configured

    def info(self) -> SupplierInfo:
        return SupplierInfo(
            code=self.code,
            name=self.name,
            enabled=self.enabled,
            configured=self.configured,
            live=self.live,
            capabilities=self.capabilities,
        )

    # --- Каталог ------------------------------------------------------------

    @abstractmethod
    async def search_parts(self, part_code: str) -> list[Part]:
        """Найти карточки товара по артикулу."""

    async def get_offers(
        self,
        part_native_id: str,
        *,
        include_analogs: bool = True,
        include_transit: bool = True,
    ) -> list[Offer]:
        raise FeatureNotSupported(supplier=self.code)

    # --- Корзина ------------------------------------------------------------

    async def basket_lines(self) -> list[BasketLine]:
        raise FeatureNotSupported(supplier=self.code)

    async def basket_add(
        self,
        part_native_id: str,
        warehouse_id: str,
        quantity: int = 1,
        comment: str = "",
    ) -> str:
        """Вернуть native-идентификатор добавленной строки."""
        raise FeatureNotSupported(supplier=self.code)

    async def basket_remove(self, native_line_id: str, version: int) -> None:
        raise FeatureNotSupported(supplier=self.code)

    async def basket_clear(self) -> None:
        raise FeatureNotSupported(supplier=self.code)

    async def basket_submit(self, delivery_mode_id: int = 1) -> None:
        raise FeatureNotSupported(supplier=self.code)

    # --- Заказы -------------------------------------------------------------

    async def orders(
        self,
        date_from: date | None = None,
        date_to: date | None = None,
    ) -> list[OrderLine]:
        raise FeatureNotSupported(supplier=self.code)

    # --- Жизненный цикл -----------------------------------------------------

    async def aclose(self) -> None:  # noqa: B027 - не всем адаптерам есть что закрывать
        """Закрыть сетевые ресурсы."""
