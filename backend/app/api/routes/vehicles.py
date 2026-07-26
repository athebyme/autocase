"""Определение автомобиля по VIN."""

from __future__ import annotations

from fastapi import APIRouter

from app.api.deps import VehicleLookup
from app.api.schemas import VinDecodeRequest
from app.domain.models import VinDecodeResult

router = APIRouter(tags=["vehicles"])


@router.post("/vin/decode", response_model=VinDecodeResult, summary="Определить автомобиль по VIN")
async def decode_vin(payload: VinDecodeRequest, vehicles: VehicleLookup) -> VinDecodeResult:
    return await vehicles.decode(payload.vin)
