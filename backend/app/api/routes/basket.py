"""Корзина. Любая мутация возвращает корзину целиком."""

from __future__ import annotations

from fastapi import APIRouter

from app.api.deps import Basket as BasketDep
from app.api.schemas import (
    AddLineRequest,
    BasketMutation,
    ClearBasketRequest,
    SubmitRequest,
    UpdateLineRequest,
)
from app.domain.models import Basket, SubmitResult

router = APIRouter(prefix="/basket", tags=["basket"])


@router.get("", response_model=Basket, summary="Содержимое корзины")
async def get_basket(service: BasketDep) -> Basket:
    return await service.get()


@router.post("/lines", response_model=BasketMutation, summary="Добавить предложение в корзину")
async def add_line(payload: AddLineRequest, service: BasketDep) -> BasketMutation:
    line = await service.add(payload.offer_id, payload.quantity, payload.comment)
    return BasketMutation(line=line, basket=await service.get())


@router.patch(
    "/lines/{line_id}",
    response_model=BasketMutation,
    summary="Изменить количество в строке",
)
async def update_line(
    line_id: str,
    payload: UpdateLineRequest,
    service: BasketDep,
) -> BasketMutation:
    line = await service.set_quantity(line_id, payload.quantity)
    return BasketMutation(line=line, basket=await service.get())


@router.delete("/lines/{line_id}", response_model=BasketMutation, summary="Удалить строку")
async def delete_line(line_id: str, service: BasketDep) -> BasketMutation:
    await service.remove(line_id)
    return BasketMutation(basket=await service.get())


@router.post("/clear", response_model=BasketMutation, summary="Очистить корзину")
async def clear_basket(payload: ClearBasketRequest, service: BasketDep) -> BasketMutation:
    await service.clear(payload.supplier)
    return BasketMutation(basket=await service.get())


@router.post("/submit", response_model=SubmitResult, summary="Оформить заказ")
async def submit_basket(payload: SubmitRequest, service: BasketDep) -> SubmitResult:
    return await service.submit(payload.delivery_mode_id, payload.supplier)
