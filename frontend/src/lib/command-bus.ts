"use client";

import { useSyncExternalStore } from "react";

/** Крошечная шина событий, чтобы шапка могла открыть палитру без общего контекста. */

const EVENT = "autocase:command-palette";
const RECENT_EVENT = "autocase:recent-updated";
const RECENT_KEY = "autocase-recent";
const RECENT_LIMIT = 8;

export function openCommandPalette() {
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function onOpenCommandPalette(handler: () => void): () => void {
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}

function parse(raw: string | null): string[] {
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

export function readRecentSearches(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return parse(window.localStorage.getItem(RECENT_KEY));
  } catch {
    return [];
  }
}

export function rememberSearch(code: string): void {
  if (typeof window === "undefined" || !code.trim()) return;
  const normalized = code.trim().toUpperCase();
  const next = [normalized, ...readRecentSearches().filter((item) => item !== normalized)].slice(
    0,
    RECENT_LIMIT,
  );
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent(RECENT_EVENT));
  } catch {
    // Приватный режим браузера — история просто не сохранится.
  }
}

/* --- Подписка на историю поиска -------------------------------------------
   localStorage — внешнее хранилище, поэтому читаем его через
   useSyncExternalStore, а не копируем в состояние эффектом. Снимок обязан
   быть стабильным по ссылке, иначе React зациклит рендер, — кэшируем его до
   изменения сырой строки. */

const EMPTY: string[] = [];
let cachedRaw: string | null = null;
let cachedValue: string[] = EMPTY;

function snapshot(): string[] {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(RECENT_KEY);
  } catch {
    return EMPTY;
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedValue = parse(raw);
  }
  return cachedValue;
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(RECENT_EVENT, onChange);
  // Событие storage прилетает из других вкладок — история общая.
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(RECENT_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function useRecentSearches(): string[] {
  return useSyncExternalStore(subscribe, snapshot, () => EMPTY);
}
