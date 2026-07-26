"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { cn } from "@/components/ui";
import { rememberSearch, useRecentSearches } from "@/lib/command-bus";

export function SearchField({
  initial = "",
  size = "hero",
  autoFocus = false,
}: {
  initial?: string;
  size?: "hero" | "inline";
  autoFocus?: boolean;
}) {
  const router = useRouter();
  // Поле пересоздаётся по key при смене запроса в URL (см. страницу поиска),
  // поэтому синхронизировать проп со стейтом эффектом не нужно.
  const [value, setValue] = useState(initial);
  const recent = useRecentSearches();
  const input = useRef<HTMLInputElement>(null);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const code = value.trim();
    if (!code) {
      input.current?.focus();
      return;
    }
    rememberSearch(code);
    router.push(`/search?q=${encodeURIComponent(code)}`);
  }

  const hero = size === "hero";

  return (
    <div className="w-full">
      <form onSubmit={submit} className="group relative">
        <div
          className={cn(
            "flex items-stretch border-2 bg-paper transition-colors",
            "border-ink focus-within:border-accent",
          )}
        >
          <span
            aria-hidden
            className={cn(
              "grid shrink-0 place-items-center border-r border-rule bg-paper text-muted",
              hero ? "w-12 sm:w-14" : "w-10",
            )}
          >
            <SearchGlyph />
          </span>
          <input
            ref={input}
            value={value}
            autoFocus={autoFocus}
            onChange={(event) => setValue(event.target.value)}
            placeholder="Артикул или OEM-номер"
            aria-label="Артикул или OEM-номер"
            spellCheck={false}
            autoComplete="off"
            className={cn(
              "num w-0 min-w-0 flex-1 bg-transparent px-3 uppercase outline-none placeholder:font-sans placeholder:tracking-normal placeholder:text-faint placeholder:normal-case sm:px-4",
              hero ? "h-16 text-lg sm:h-[4.5rem] sm:text-2xl" : "h-11 text-base",
            )}
          />
          <button
            type="submit"
            className={cn(
              "shrink-0 border-l border-ink bg-accent font-semibold text-accent-ink transition-colors hover:bg-ink hover:text-paper",
              hero ? "px-4 text-sm sm:px-9" : "px-4 text-xs",
            )}
          >
            <span className="sm:hidden">Найти</span>
            <span className="hidden sm:inline">Найти запчасть</span>
          </button>
        </div>
      </form>

      {recent.length ? (
        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="num text-[0.625rem] tracking-[0.18em] text-faint uppercase">
            недавние
          </span>
          {recent.slice(0, 6).map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => {
                rememberSearch(code);
                router.push(`/search?q=${encodeURIComponent(code)}`);
              }}
              className="num border-b border-transparent text-xs text-muted transition-colors hover:border-accent hover:text-ink"
            >
              {code}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function SearchGlyph() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <circle cx="8.5" cy="8.5" r="5.5" />
      <path d="m12.5 12.5 4 4" strokeLinecap="square" />
    </svg>
  );
}
