"use client";

type Theme = "light" | "dark";

/**
 * Текущую тему показываем средствами CSS, а не состоянием React: значение
 * живёт в атрибуте `data-theme` на <html>, его выставляет инлайн-скрипт ещё
 * до гидрации. Держать копию в useState значило бы синхронизировать её
 * эффектом и ловить расхождение между сервером и клиентом.
 */
export function ThemeToggle() {
  function toggle() {
    const current = document.documentElement.getAttribute("data-theme");
    const next: Theme = current === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("autocase-theme", next);
    } catch {
      // Приватный режим — выбор просто не переживёт перезагрузку.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Переключить тему оформления"
      className="grid h-9 w-9 place-items-center border border-rule text-muted transition-colors hover:border-ink hover:text-ink"
    >
      <span className="num text-[0.6875rem] tracking-tight">
        <span className="dark:hidden">LT</span>
        <span className="hidden dark:inline">DK</span>
      </span>
    </button>
  );
}
