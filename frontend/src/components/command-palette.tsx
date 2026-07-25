"use client";

import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { cn } from "@/components/ui";
import { api } from "@/lib/api";
import { onOpenCommandPalette, rememberSearch, useRecentSearches } from "@/lib/command-bus";
import { normalizeCode } from "@/lib/format";

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [cursor, setCursor] = useState(0);
  const recent = useRecentSearches();

  // Открытие и закрытие сбрасывают состояние здесь, а не в эффекте на `open`:
  // так React не делает лишний каскад рендеров после каждого переключения.
  const show = useCallback(() => {
    setCursor(0);
    setOpen(true);
  }, []);

  const hide = useCallback(() => {
    setOpen(false);
    setValue("");
  }, []);

  useEffect(() => onOpenCommandPalette(show), [show]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing =
        target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (open) hide();
        else show();
        return;
      }
      // «/» — привычный шорткат поиска, но не когда человек печатает в поле.
      if (event.key === "/" && !typing && !open) {
        event.preventDefault();
        show();
      }
      if (event.key === "Escape") hide();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, show, hide]);

  const query = useDebounced(value.trim(), 220);

  const { data, isFetching } = useQuery({
    queryKey: ["palette", query],
    queryFn: () => api.search(query),
    enabled: open && query.length >= 2,
    staleTime: 30_000,
  });

  const parts = useMemo(() => data?.parts.slice(0, 7) ?? [], [data]);
  const options = query.length >= 2 ? parts.length : recent.length;

  function go(target: string) {
    rememberSearch(target);
    hide();
    router.push(`/search?q=${encodeURIComponent(target)}`);
  }

  function goToPart(partId: string, code: string) {
    rememberSearch(code);
    hide();
    router.push(`/part/${encodeURIComponent(partId)}`);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setCursor((current) => (options ? (current + 1) % options : 0));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setCursor((current) => (options ? (current - 1 + options) % options : 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (query.length >= 2 && parts[cursor]) {
        goToPart(parts[cursor].id, parts[cursor].code);
      } else if (query.length >= 2) {
        go(value.trim());
      } else if (recent[cursor]) {
        go(recent[cursor]);
      }
    }
  }

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-100 flex items-start justify-center px-4 pt-[12vh]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.14 }}
        >
          <div
            className="absolute inset-0 bg-ink/35 backdrop-blur-[2px]"
            onClick={hide}
            aria-hidden
          />
          <motion.div
            role="dialog"
            aria-modal
            aria-label="Поиск по артикулу"
            initial={{ y: -8, scale: 0.99 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: -8, opacity: 0 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-2xl border border-ink bg-surface shadow-[10px_10px_0_0_var(--color-sunken)]"
          >
            <div className="flex items-center gap-3 border-b border-rule px-4">
              <span className="num text-[0.6875rem] tracking-[0.2em] text-accent">→</span>
              <input
                autoFocus
                value={value}
                onChange={(event) => {
                  setValue(event.target.value);
                  setCursor(0);
                }}
                onKeyDown={onKeyDown}
                placeholder="Артикул или OEM-номер"
                spellCheck={false}
                autoComplete="off"
                className="num h-14 flex-1 bg-transparent text-lg tracking-[0.06em] uppercase outline-none placeholder:text-faint placeholder:normal-case placeholder:tracking-normal"
              />
              {isFetching ? (
                <span className="num text-[0.625rem] tracking-[0.1em] text-faint uppercase">
                  ищем…
                </span>
              ) : null}
              <kbd className="num border border-rule px-1.5 py-0.5 text-[0.625rem] text-faint">
                ESC
              </kbd>
            </div>

            <div className="max-h-[46vh] overflow-y-auto">
              {query.length >= 2 ? (
                parts.length ? (
                  parts.map((part, index) => (
                    <button
                      key={part.id}
                      type="button"
                      onMouseEnter={() => setCursor(index)}
                      onClick={() => goToPart(part.id, part.code)}
                      className={cn(
                        "flex w-full items-baseline gap-4 border-b border-rule px-4 py-3 text-left transition-colors",
                        index === cursor ? "bg-accent-soft" : "hover:bg-sunken/60",
                      )}
                    >
                      <span className="num w-32 shrink-0 text-sm font-medium tracking-[0.04em]">
                        {part.code}
                      </span>
                      <span className="w-28 shrink-0 truncate text-xs font-semibold tracking-[0.08em] text-muted uppercase">
                        {part.brand}
                      </span>
                      <span className="flex-1 truncate text-sm">{part.name}</span>
                    </button>
                  ))
                ) : !isFetching ? (
                  <p className="px-4 py-8 text-center text-sm text-muted">
                    По запросу{" "}
                    <span className="num text-ink">{normalizeCode(value) || value}</span> ничего не
                    нашлось
                  </p>
                ) : null
              ) : recent.length ? (
                <>
                  <p className="num px-4 pt-3 pb-1 text-[0.625rem] tracking-[0.18em] text-faint uppercase">
                    Недавние запросы
                  </p>
                  {recent.map((code, index) => (
                    <button
                      key={code}
                      type="button"
                      onMouseEnter={() => setCursor(index)}
                      onClick={() => go(code)}
                      className={cn(
                        "num flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors",
                        index === cursor ? "bg-accent-soft" : "hover:bg-sunken/60",
                      )}
                    >
                      <span className="text-faint">↺</span>
                      {code}
                    </button>
                  ))}
                </>
              ) : (
                <p className="px-4 py-8 text-center text-sm text-muted">
                  Введите артикул — например{" "}
                  <button
                    type="button"
                    className="num text-accent underline underline-offset-4"
                    onClick={() => setValue("PH5883")}
                  >
                    PH5883
                  </button>
                </p>
              )}
            </div>

            <div className="flex items-center gap-4 border-t border-rule px-4 py-2 text-[0.625rem] text-faint">
              <Hint keys="↑↓" text="выбор" />
              <Hint keys="⏎" text="открыть" />
              <Hint keys="/" text="быстрый вызов" />
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function Hint({ keys, text }: { keys: string; text: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <kbd className="num border border-rule px-1 text-[0.625rem]">{keys}</kbd>
      <span className="tracking-[0.08em] uppercase">{text}</span>
    </span>
  );
}

function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
