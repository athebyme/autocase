"use client";

import { useSyncExternalStore } from "react";

export type DeliveryMethod = "pickup" | "courier" | "yandex_go";

export interface AccountProfile {
  full_name: string;
  phone: string;
  email: string;
  vehicle_vin: string;
  vehicle_label: string;
  delivery_method: DeliveryMethod;
  delivery_address: string;
}

export const DELIVERY_METHODS: ReadonlyArray<{
  id: DeliveryMethod;
  title: string;
  description: string;
}> = [
  {
    id: "pickup",
    title: "Самовывоз",
    description: "Бесплатно · Токсово, Ленинградское ш., 13А",
  },
  {
    id: "courier",
    title: "Курьером",
    description: "По Ленинградской области · стоимость уточнит менеджер",
  },
  {
    id: "yandex_go",
    title: "Яндекс Go",
    description: "По тарифу сервиса · вызовем после подтверждения заказа",
  },
];

const STORAGE_KEY = "autocase-account";
const UPDATE_EVENT = "autocase:account-updated";

const EMPTY_PROFILE: AccountProfile = {
  full_name: "",
  phone: "",
  email: "",
  vehicle_vin: "",
  vehicle_label: "",
  delivery_method: "pickup",
  delivery_address: "",
};

let cachedRaw: string | null | undefined;
let cachedProfile = EMPTY_PROFILE;

function isDeliveryMethod(value: unknown): value is DeliveryMethod {
  return value === "pickup" || value === "courier" || value === "yandex_go";
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function parseProfile(raw: string | null): AccountProfile {
  if (!raw) return EMPTY_PROFILE;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) return EMPTY_PROFILE;
    const record = value as Record<string, unknown>;
    return {
      full_name: text(record.full_name),
      phone: text(record.phone),
      email: text(record.email),
      vehicle_vin: text(record.vehicle_vin),
      vehicle_label: text(record.vehicle_label),
      delivery_method: isDeliveryMethod(record.delivery_method)
        ? record.delivery_method
        : "pickup",
      delivery_address: text(record.delivery_address),
    };
  } catch {
    return EMPTY_PROFILE;
  }
}

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function snapshot(): AccountProfile {
  const raw = readRaw();
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedProfile = parseProfile(raw);
  }
  return cachedProfile;
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(UPDATE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(UPDATE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function useAccountProfile(): AccountProfile {
  return useSyncExternalStore(subscribe, snapshot, () => EMPTY_PROFILE);
}

export function saveAccountProfile(patch: Partial<AccountProfile>): void {
  if (typeof window === "undefined") return;
  const next = { ...snapshot(), ...patch };
  const raw = JSON.stringify(next);
  try {
    window.localStorage.setItem(STORAGE_KEY, raw);
    cachedRaw = raw;
    cachedProfile = next;
    window.dispatchEvent(new CustomEvent(UPDATE_EVENT));
  } catch {
    // В приватном режиме профиль останется доступен только до обновления страницы.
    cachedRaw = null;
    cachedProfile = next;
    window.dispatchEvent(new CustomEvent(UPDATE_EVENT));
  }
}
