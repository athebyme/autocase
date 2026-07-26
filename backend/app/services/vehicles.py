"""Многоуровневое распознавание VIN без привязки HTTP-слоя к провайдеру.

Точный OEM-каталог имеет приоритет, публичный декодер остаётся резервом.
Поля разных источников приводятся к одной модели, а неполнота не скрывается.
"""

from __future__ import annotations

import re
from collections.abc import Sequence
from datetime import date
from typing import Any, Protocol

import httpx

from app.core.errors import VehicleLookupUnavailable, VehicleNotFound
from app.domain.models import (
    Vehicle,
    VehicleAttribute,
    VinConfidence,
    VinDecodeResult,
)

_MODEL_YEAR_CODES = "ABCDEFGHJKLMNPRSTVWXY123456789"
_CC_RE = re.compile(r"(?P<value>\d{3,5})\s*CC", re.IGNORECASE)
_HP_RE = re.compile(r"(?P<value>\d{2,4})\s*HP", re.IGNORECASE)


class VinProvider(Protocol):
    code: str
    label: str

    async def decode(self, vin: str) -> VinDecodeResult: ...

    async def aclose(self) -> None: ...


class VehicleLookupService:
    """Попробовать декодеры по приоритету и не ронять поиск из-за одного."""

    def __init__(
        self,
        *,
        providers: Sequence[VinProvider] | None = None,
        base_url: str | None = None,
        timeout: float = 10.0,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        # base_url и transport оставлены для простого запуска и изолированных тестов.
        self._providers = list(
            providers
            or [
                NhtsaVinProvider(
                    base_url=base_url or "https://vpic.nhtsa.dot.gov/api",
                    timeout=timeout,
                    transport=transport,
                )
            ]
        )

    async def decode(self, vin: str) -> VinDecodeResult:
        unavailable: list[str] = []
        not_found: list[str] = []

        for provider in self._providers:
            try:
                result = await provider.decode(vin)
            except VehicleNotFound as exc:
                not_found.append(exc.detail or provider.label)
            except VehicleLookupUnavailable:
                unavailable.append(provider.label)
            else:
                if unavailable:
                    warning = (
                        f"{', '.join(unavailable)} сейчас недоступен; "
                        f"показан результат из источника «{result.source_label}»."
                    )
                    return result.model_copy(update={"warnings": [warning, *result.warnings]})
                return result

        if not_found:
            raise VehicleNotFound(detail="; ".join(not_found))
        raise VehicleLookupUnavailable(detail=", ".join(unavailable) or None)

    async def aclose(self) -> None:
        for provider in self._providers:
            await provider.aclose()


class NhtsaVinProvider:
    """Публичный декодер: хорош как бесплатный резерв, особенно для рынка США."""

    code = "nhtsa"
    label = "Открытая база NHTSA"

    def __init__(
        self,
        *,
        base_url: str,
        timeout: float = 10.0,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self._client = httpx.AsyncClient(
            base_url=base_url.rstrip("/"),
            timeout=httpx.Timeout(timeout, connect=min(timeout, 5.0)),
            headers={"Accept": "application/json"},
            transport=transport,
        )

    async def aclose(self) -> None:
        await self._client.aclose()

    async def decode(self, vin: str) -> VinDecodeResult:
        try:
            response = await self._client.get(
                f"/vehicles/DecodeVinValuesExtended/{vin}",
                params={
                    "format": "json",
                    "modelyear": self._likely_model_year(vin),
                },
            )
            response.raise_for_status()
            body = response.json()
        except (httpx.HTTPError, ValueError) as exc:
            raise VehicleLookupUnavailable(detail=str(exc)) from exc

        raw = self._first_result(body)
        make = self._text(raw.get("Make"))
        manufacturer = self._text(raw.get("Manufacturer"))
        if not make and not manufacturer:
            raise VehicleNotFound(detail=self._text(raw.get("ErrorText")))

        vehicle = Vehicle(
            vin=vin,
            make=make or manufacturer or "",
            model=self._text(raw.get("Model")),
            model_year=self._integer(raw.get("ModelYear")),
            manufacturer=manufacturer,
            series=self._text(raw.get("Series")),
            trim=self._first_text(raw, "Trim", "Trim2"),
            body_class=self._text(raw.get("BodyClass")),
            vehicle_type=self._text(raw.get("VehicleType")),
            doors=self._integer(raw.get("Doors")),
            drive_type=self._text(raw.get("DriveType")),
            transmission=self._text(raw.get("TransmissionStyle")),
            transmission_speeds=self._integer(raw.get("TransmissionSpeeds")),
            engine_model=self._text(raw.get("EngineModel")),
            engine_manufacturer=self._text(raw.get("EngineManufacturer")),
            engine_liters=self._number(raw.get("DisplacementL")),
            engine_cylinders=self._integer(raw.get("EngineCylinders")),
            engine_power_hp=self._integer(raw.get("EngineHP")),
            fuel_type=self._text(raw.get("FuelTypePrimary")),
            electrification_level=self._text(raw.get("ElectrificationLevel")),
            plant_city=self._text(raw.get("PlantCity")),
            plant_country=self._text(raw.get("PlantCountry")),
        )
        missing = self._missing_fields(vehicle)
        error_code = self._text(raw.get("ErrorCode")) or ""
        complete = not missing and error_code in {"", "0"}
        confidence = (
            VinConfidence.EXACT
            if complete
            else VinConfidence.LIKELY
            if vehicle.model and vehicle.model_year
            else VinConfidence.PARTIAL
        )
        warnings = self._warnings(error_code, missing)
        return VinDecodeResult(
            vehicle=vehicle,
            complete=complete,
            confidence=confidence,
            source=self.code,
            source_label=self.label,
            warnings=warnings,
            missing_fields=missing,
        )

    @staticmethod
    def _first_result(body: Any) -> dict[str, Any]:
        if not isinstance(body, dict):
            raise VehicleLookupUnavailable(detail="VIN-декодер вернул не объект")
        results = body.get("Results")
        if not isinstance(results, list) or not results or not isinstance(results[0], dict):
            raise VehicleLookupUnavailable(detail="В ответе VIN-декодера нет результата")
        return results[0]

    @classmethod
    def _first_text(cls, raw: dict[str, Any], *keys: str) -> str | None:
        for key in keys:
            value = cls._text(raw.get(key))
            if value:
                return value
        return None

    @staticmethod
    def _text(value: object) -> str | None:
        if value is None:
            return None
        text = str(value).strip()
        return text or None

    @classmethod
    def _integer(cls, value: object) -> int | None:
        text = cls._text(value)
        if text is None:
            return None
        try:
            return int(float(text))
        except ValueError:
            return None

    @classmethod
    def _number(cls, value: object) -> float | None:
        text = cls._text(value)
        if text is None:
            return None
        try:
            return round(float(text), 2)
        except ValueError:
            return None

    @staticmethod
    def _missing_fields(vehicle: Vehicle) -> list[str]:
        missing: list[str] = []
        if not vehicle.model:
            missing.append("модель")
        if not vehicle.model_year:
            missing.append("год выпуска")
        if not (vehicle.engine_model or vehicle.engine_liters):
            missing.append("двигатель")
        if not vehicle.transmission:
            missing.append("коробка передач")
        return missing

    @staticmethod
    def _warnings(error_code: str, missing: list[str]) -> list[str]:
        warnings: list[str] = []
        codes = {part.strip() for part in error_code.split(",")}
        if "7" in codes:
            warnings.append(
                "Производитель не зарегистрировал эту комплектацию для рынка США, "
                "поэтому открытая база знает о ней не всё."
            )
        elif codes - {"", "0"}:
            warnings.append(
                "VIN распознан частично: формат или данные производителя не полностью "
                "совпали с правилами американской базы."
            )
        if missing:
            warnings.append(f"Не определены: {', '.join(missing)}.")
        return warnings

    @staticmethod
    def _likely_model_year(vin: str, current_year: int | None = None) -> int | None:
        """Выбрать современный цикл кода года, который повторяется каждые 30 лет."""
        if len(vin) < 10 or vin[9] not in _MODEL_YEAR_CODES:
            return None
        ceiling = (current_year or date.today().year) + 1
        first_year = 1980 + _MODEL_YEAR_CODES.index(vin[9])
        return first_year + max(0, (ceiling - first_year) // 30) * 30


class LaximoVinProvider:
    """Точное распознавание через OEM-каталоги Laximo.CAT."""

    code = "laximo"
    label = "OEM-каталог Laximo"

    def __init__(
        self,
        *,
        base_url: str,
        login: str,
        password: str,
        locale: str = "ru_RU",
        timeout: float = 15.0,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self._locale = locale
        self._client = httpx.AsyncClient(
            base_url=base_url.rstrip("/"),
            auth=httpx.BasicAuth(login, password),
            timeout=httpx.Timeout(timeout, connect=min(timeout, 5.0)),
            headers={"Accept": "application/json", "Accept-Language": locale},
            transport=transport,
        )

    async def aclose(self) -> None:
        await self._client.aclose()

    async def decode(self, vin: str) -> VinDecodeResult:
        try:
            response = await self._client.post(
                "/findVehicle",
                params={"identString": vin, "localized": "true", "locale": self._locale},
            )
            response.raise_for_status()
            body = response.json()
        except (httpx.HTTPError, ValueError) as exc:
            raise VehicleLookupUnavailable(detail=str(exc)) from exc

        rows = self._rows(body)
        vehicles = [self._vehicle(vin, row) for row in rows]
        if not vehicles:
            raise VehicleNotFound(detail="OEM-каталог не нашёл этот VIN")

        primary = vehicles[0]
        level = self._filter_level(rows[0])
        missing = NhtsaVinProvider._missing_fields(primary)
        complete = level == "full" and not missing
        confidence = VinConfidence.EXACT if level == "full" else VinConfidence.LIKELY
        warnings: list[str] = []
        if len(vehicles) > 1:
            warnings.append(
                "Найдено несколько каталогов или модификаций. "
                "Перед подбором подтвердите подходящий вариант."
            )
        if missing:
            warnings.append(f"OEM-каталог не вернул: {', '.join(missing)}.")

        return VinDecodeResult(
            vehicle=primary,
            alternatives=vehicles[1:],
            complete=complete,
            confidence=confidence,
            source=self.code,
            source_label=self.label,
            warnings=warnings,
            missing_fields=missing,
        )

    @staticmethod
    def _rows(body: Any) -> list[dict[str, Any]]:
        if isinstance(body, list):
            return [row for row in body if isinstance(row, dict)]
        if isinstance(body, dict):
            rows = body.get("results") or body.get("Results")
            if isinstance(rows, list):
                return [row for row in rows if isinstance(row, dict)]
        raise VehicleLookupUnavailable(detail="OEM-каталог вернул неожиданный формат")

    @classmethod
    def _vehicle(cls, vin: str, raw: dict[str, Any]) -> Vehicle:
        attributes = cls._attributes(raw)
        values = {item.key.lower(): item.value for item in attributes}
        engine_info = cls._pick(values, "engine_info", "engineinfo")
        displacement = cls._displacement(values, engine_info)
        model = cls._pick(values, "model", "vehiclemodel") or cls._text(raw.get("name"))
        series = cls._text(raw.get("name")) if values.get("model") else None

        return Vehicle(
            vin=vin,
            make=cls._text(raw.get("brand")) or "",
            model=model,
            model_year=cls._year(values),
            series=series,
            trim=cls._pick(values, "grade", "trimlevel", "trim_level", "modification"),
            body_class=cls._pick(values, "bodystyle", "body_style", "vehiclebody"),
            vehicle_type=cls._pick(values, "vehicletype", "vehicle_type"),
            doors=cls._integer(cls._pick(values, "doors", "doorcount")),
            drive_type=cls._pick(values, "drive", "drivetype", "drive_type"),
            transmission=cls._pick(values, "transmission", "gearbox"),
            engine_code=cls._pick(values, "engine", "engine1", "engine2"),
            engine_model=engine_info,
            engine_liters=displacement,
            engine_power_hp=cls._power_hp(engine_info),
            fuel_type=cls._pick(values, "fuel", "fueltype", "fuel_type"),
            production_date=cls._pick(values, "date", "productiondate"),
            market=cls._pick(values, "market", "destinationregion", "region"),
            plant_country=cls._pick(values, "creationregion", "country"),
            catalog_code=cls._text(raw.get("catalog")),
            vehicle_id=cls._text(raw.get("vehicleId") or raw.get("vehicleid")),
            attributes=attributes,
        )

    @classmethod
    def _attributes(cls, raw: dict[str, Any]) -> list[VehicleAttribute]:
        raw_attributes = raw.get("attributes")
        if not isinstance(raw_attributes, list):
            return []
        attributes: list[VehicleAttribute] = []
        for item in raw_attributes:
            if not isinstance(item, dict):
                continue
            key = cls._text(item.get("key"))
            value = cls._text(item.get("value"))
            if not key or not value:
                continue
            label = cls._text(item.get("name")) or key
            attributes.append(VehicleAttribute(key=key, label=label, value=value))
        return attributes

    @staticmethod
    def _filter_level(raw: dict[str, Any]) -> str:
        properties = raw.get("sysProperties") or raw.get("sysproperties")
        if isinstance(properties, dict):
            return str(properties.get("filter_level") or "").lower()
        return ""

    @staticmethod
    def _pick(values: dict[str, str], *keys: str) -> str | None:
        return next((values[key] for key in keys if values.get(key)), None)

    @staticmethod
    def _text(value: object) -> str | None:
        if value is None:
            return None
        text = str(value).strip()
        return text or None

    @staticmethod
    def _integer(value: str | None) -> int | None:
        if not value:
            return None
        match = re.search(r"\d+", value)
        return int(match.group()) if match else None

    @classmethod
    def _year(cls, values: dict[str, str]) -> int | None:
        return cls._integer(
            cls._pick(values, "manufactured", "model_year", "modelyear", "year")
        )

    @classmethod
    def _displacement(cls, values: dict[str, str], engine_info: str | None) -> float | None:
        raw = cls._pick(values, "displacement", "enginecapacity")
        match = _CC_RE.search(engine_info or "") or _CC_RE.search(raw or "")
        if match:
            return round(int(match.group("value")) / 1000, 2)
        if not raw:
            return None
        number = re.search(r"\d+(?:[.,]\d+)?", raw)
        if not number:
            return None
        value = float(number.group().replace(",", "."))
        return round(value / 1000 if value > 20 else value, 2)

    @staticmethod
    def _power_hp(engine_info: str | None) -> int | None:
        match = _HP_RE.search(engine_info or "")
        return int(match.group("value")) if match else None
