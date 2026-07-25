"""Доменные ошибки шлюза.

Здесь нет ничего про конкретного поставщика: каждый адаптер переводит свой
протокол ошибок в эти классы, а слой API — в HTTP-ответы.
"""

from __future__ import annotations


class GatewayError(Exception):
    """База для всего, что мы умеем показать клиенту осмысленно."""

    status_code: int = 502
    kind: str = "gateway_error"
    default_message: str = "Ошибка шлюза"

    def __init__(
        self,
        message: str | None = None,
        *,
        supplier: str | None = None,
        detail: str | None = None,
    ) -> None:
        self.message = message or self.default_message
        self.supplier = supplier
        self.detail = detail
        super().__init__(self.message)

    def as_payload(self) -> dict[str, object]:
        return {
            "error": {
                "kind": self.kind,
                "message": self.message,
                "detail": self.detail,
                "supplier": self.supplier,
            }
        }


class SupplierUnavailable(GatewayError):
    """Поставщик не ответил: таймаут, обрыв, 5xx, нечитаемое тело."""

    status_code = 503
    kind = "supplier_unavailable"
    default_message = "Поставщик временно недоступен"


class SupplierAuthError(GatewayError):
    """Наши креды к поставщику не подошли. Виноваты мы, не покупатель."""

    status_code = 502
    kind = "supplier_auth"
    default_message = "Не удалось авторизоваться у поставщика"


class SupplierRejected(GatewayError):
    """Поставщик отклонил параметры запроса."""

    status_code = 400
    kind = "supplier_rejected"
    default_message = "Поставщик отклонил параметры запроса"


class SupplierDataError(GatewayError):
    """Поставщик не смог обработать данные (например, позиции уже нет)."""

    status_code = 422
    kind = "supplier_data"
    default_message = "Поставщик не смог обработать запрос"


class SupplierConflict(GatewayError):
    """Конкурентное изменение: версия строки корзины устарела."""

    status_code = 409
    kind = "conflict"
    default_message = "Данные изменились в другом окне, обновите страницу"


class FeatureNotSupported(GatewayError):
    """Поставщик не умеет запрошенную операцию."""

    status_code = 501
    kind = "not_supported"
    default_message = "Поставщик не поддерживает эту операцию"


class SupplierNotFound(GatewayError):
    """В реестре нет такого кода поставщика или он выключен."""

    status_code = 404
    kind = "supplier_not_found"
    default_message = "Поставщик не подключён"


class BadIdentifier(GatewayError):
    """Составной идентификатор пришёл в нечитаемом виде."""

    status_code = 400
    kind = "bad_identifier"
    default_message = "Некорректный идентификатор"
