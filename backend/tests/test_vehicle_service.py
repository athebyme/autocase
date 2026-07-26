"""VIN-декодер: маппинг публичного ответа в компактную доменную модель."""

from __future__ import annotations

import httpx
import pytest

from app.core.errors import VehicleLookupUnavailable, VehicleNotFound
from app.services.vehicles import (
    LaximoVinProvider,
    NhtsaVinProvider,
    VehicleLookupService,
)

BASE = "https://vin.example.test/api"
VIN = "WAUZZZ8V5GA000001"


def make_service(payload: object, status: int = 200) -> VehicleLookupService:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path.endswith(f"/vehicles/DecodeVinValuesExtended/{VIN}")
        assert request.url.params["format"] == "json"
        assert request.url.params["modelyear"] == "2016"
        return httpx.Response(status, json=payload)

    return VehicleLookupService(
        base_url=BASE,
        timeout=1.0,
        transport=httpx.MockTransport(handler),
    )


async def test_decode_maps_vehicle_fields() -> None:
    service = make_service(
        {
            "Results": [
                {
                    "ErrorCode": "0",
                    "Make": "AUDI",
                    "Model": "A3",
                    "ModelYear": "2016",
                    "Manufacturer": "AUDI AG",
                    "Series": "8V",
                    "Trim": "Sport",
                    "BodyClass": "Hatchback/Liftback/Notchback",
                    "VehicleType": "PASSENGER CAR",
                    "Doors": "5",
                    "DriveType": "Front-Wheel Drive",
                    "TransmissionStyle": "Automatic",
                    "TransmissionSpeeds": "7",
                    "EngineModel": "EA888",
                    "EngineManufacturer": "AUDI",
                    "EngineHP": "180",
                    "DisplacementL": "1.798",
                    "EngineCylinders": "4",
                    "FuelTypePrimary": "Gasoline",
                    "PlantCity": "INGOLSTADT",
                    "PlantCountry": "GERMANY",
                }
            ]
        }
    )
    try:
        result = await service.decode(VIN)
    finally:
        await service.aclose()

    assert result.complete is True
    assert result.vehicle.make == "AUDI"
    assert result.vehicle.model_year == 2016
    assert result.vehicle.engine_liters == 1.8
    assert result.vehicle.engine_cylinders == 4
    assert result.vehicle.engine_power_hp == 180
    assert result.vehicle.transmission == "Automatic"
    assert result.vehicle.plant_city == "INGOLSTADT"
    assert result.confidence == "exact"
    assert result.source == "nhtsa"


async def test_partial_decode_is_returned_when_make_is_known() -> None:
    service = make_service(
        {
            "Results": [
                {
                    "ErrorCode": "7",
                    "ErrorText": "Manufacturer is not registered for the US market",
                    "Make": "AUDI",
                    "Model": "",
                }
            ]
        }
    )
    try:
        result = await service.decode(VIN)
    finally:
        await service.aclose()

    assert result.complete is False
    assert result.vehicle.make == "AUDI"
    assert result.vehicle.model is None
    assert result.confidence == "partial"
    assert "модель" in result.missing_fields
    assert result.warnings


async def test_unknown_vin_is_not_found() -> None:
    service = make_service(
        {"Results": [{"ErrorCode": "7", "ErrorText": "Manufacturer is not registered"}]}
    )
    try:
        with pytest.raises(VehicleNotFound):
            await service.decode(VIN)
    finally:
        await service.aclose()


async def test_bad_upstream_response_is_unavailable() -> None:
    service = make_service({"Results": []})
    try:
        with pytest.raises(VehicleLookupUnavailable):
            await service.decode(VIN)
    finally:
        await service.aclose()


def test_model_year_code_uses_latest_non_future_cycle() -> None:
    assert NhtsaVinProvider._likely_model_year(VIN, current_year=2026) == 2016
    assert NhtsaVinProvider._likely_model_year("WVWZZZ1JZ5W000001", current_year=2026) == 2005


async def test_laximo_maps_exact_oem_vehicle_and_alternatives() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.method == "POST"
        assert request.url.path.endswith("/findVehicle")
        assert request.url.params["identString"] == VIN
        assert request.headers["authorization"].startswith("Basic ")
        return httpx.Response(
            200,
            json=[
                {
                    "catalog": "AU1587",
                    "brand": "AUDI",
                    "name": "A3/S3 Sportback",
                    "vehicleId": "0",
                    "attributes": [
                        {"key": "date", "name": "Дата выпуска", "value": "15.06.2016"},
                        {"key": "manufactured", "name": "Выпущено", "value": "2016"},
                        {"key": "model", "name": "Модель", "value": "8VA"},
                        {"key": "engine", "name": "Двигатель", "value": "CJSA"},
                        {
                            "key": "engine_info",
                            "name": "Двигатель",
                            "value": "1800CC / 180hp / 132kW",
                        },
                        {"key": "transmission", "name": "КПП", "value": "QDQ(7A)"},
                        {"key": "market", "name": "Рынок", "value": "Европа"},
                    ],
                    "sysProperties": {"filter_level": "full"},
                },
                {
                    "catalog": "AU1588",
                    "brand": "AUDI",
                    "name": "A3",
                    "vehicleId": "1",
                    "attributes": [
                        {"key": "manufactured", "name": "Выпущено", "value": "2016"}
                    ],
                    "sysProperties": {"filter_level": "basic"},
                },
            ],
        )

    provider = LaximoVinProvider(
        base_url="https://laximo.example.test/restApi/v1",
        login="user",
        password="secret",
        transport=httpx.MockTransport(handler),
    )
    try:
        result = await provider.decode(VIN)
    finally:
        await provider.aclose()

    assert result.source == "laximo"
    assert result.confidence == "exact"
    assert result.vehicle.model == "8VA"
    assert result.vehicle.series == "A3/S3 Sportback"
    assert result.vehicle.engine_code == "CJSA"
    assert result.vehicle.engine_liters == 1.8
    assert result.vehicle.engine_power_hp == 180
    assert result.vehicle.transmission == "QDQ(7A)"
    assert result.vehicle.production_date == "15.06.2016"
    assert len(result.alternatives) == 1
    assert result.warnings


async def test_lookup_falls_back_when_primary_provider_is_unavailable() -> None:
    class UnavailableProvider:
        code = "exact"
        label = "Точный OEM-каталог"

        async def decode(self, vin: str):  # type: ignore[no-untyped-def]
            raise VehicleLookupUnavailable()

        async def aclose(self) -> None:
            return None

    fallback = make_service(
        {
            "Results": [
                {
                    "ErrorCode": "7",
                    "Make": "AUDI",
                    "ModelYear": "2016",
                }
            ]
        }
    )._providers[0]
    service = VehicleLookupService(providers=[UnavailableProvider(), fallback])
    try:
        result = await service.decode(VIN)
    finally:
        await service.aclose()

    assert result.source == "nhtsa"
    assert "недоступен" in result.warnings[0]
