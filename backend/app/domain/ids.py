"""Составные идентификаторы вида `<supplier>:<native>`.

У разных поставщиков идентификаторы независимы и запросто пересекаются:
`13333285` может существовать сразу у троих. Наружу мы отдаём только
составные ID, чтобы любой объект сам говорил, к какому адаптеру его нести.

Сегменты кодируются percent-encoding'ом, поэтому разделитель не может
случайно оказаться внутри значения, а сам ID остаётся безопасным для URL.
"""

from __future__ import annotations

import re
from urllib.parse import quote, unquote

from app.core.errors import BadIdentifier

SEPARATOR = ":"
SUPPLIER_CODE_RE = re.compile(r"^[a-z0-9][a-z0-9_-]{0,31}$")


def validate_supplier_code(code: str) -> str:
    if not SUPPLIER_CODE_RE.match(code):
        raise ValueError(
            f"Код поставщика {code!r} недопустим: ожидается [a-z0-9_-], до 32 символов"
        )
    return code


def encode(supplier: str, *segments: str | int) -> str:
    parts = [supplier]
    parts.extend(quote(str(segment), safe="") for segment in segments)
    return SEPARATOR.join(parts)


def decode(value: str, *, segments: int = 1) -> tuple[str, tuple[str, ...]]:
    """Разобрать составной ID. `segments` — сколько частей ждём после кода."""
    chunks = value.split(SEPARATOR)
    if len(chunks) != segments + 1:
        raise BadIdentifier(
            f"Идентификатор {value!r} не разбирается",
            detail=f"ожидалось {segments + 1} сегментов, получено {len(chunks)}",
        )
    supplier, *rest = chunks
    if not SUPPLIER_CODE_RE.match(supplier):
        raise BadIdentifier(f"Идентификатор {value!r} не содержит кода поставщика")
    return supplier, tuple(unquote(chunk) for chunk in rest)


def decode_one(value: str) -> tuple[str, str]:
    supplier, (native,) = decode(value, segments=1)
    return supplier, native
