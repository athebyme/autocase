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
            "flex items-stretch border bg-surface transition-colors",
            "border-ink focus-within:border-accent",
          )}
        >
          <span
            aria-hidden
            className={cn(
              "num grid shrink-0 place-items-center border-r border-rule text-accent",
              hero ? "w-12 text-sm sm:w-14" : "w-10 text-xs",
            )}
          >
            №
          </span>
          <input
            ref={input}
            value={value}
            autoFocus={autoFocus}
            onChange={(event) => setValue(event.target.value)}
            placeholder="PH5883"
            aria-label="Артикул или OEM-номер"
            spellCheck={false}
            autoComplete="off"
            className={cn(
              "num min-w-0 flex-1 bg-transparent px-4 tracking-[0.06em] uppercase outline-none placeholder:text-faint",
              hero ? "h-16 text-xl sm:h-20 sm:text-3xl" : "h-11 text-base",
            )}
          />
          <button
            type="submit"
            className={cn(
              "shrink-0 border-l border-ink bg-ink font-semibold tracking-[0.16em] text-paper uppercase transition-colors hover:bg-accent hover:border-accent hover:text-accent-ink",
              hero ? "px-5 text-xs sm:px-9 sm:text-sm" : "px-4 text-[0.6875rem]",
            )}
          >
            Найти
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
