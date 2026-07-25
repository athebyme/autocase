import type { ComponentProps, ReactNode } from "react";

import { currencySign, formatPrice } from "@/lib/format";

export function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}

/* --- Заголовок секции: номер + название, как в техдокументации ------------- */

export function SectionLabel({
  index,
  children,
  aside,
}: {
  index: string;
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-3 border-b border-rule pb-2">
      <span className="num text-[0.6875rem] tracking-[0.2em] text-accent">{index}</span>
      <h2 className="text-[0.6875rem] font-semibold tracking-[0.22em] uppercase">{children}</h2>
      {/* На узких экранах довесок уезжает на свою строку целиком, чтобы не
          ломать заголовок на два ряда. */}
      {aside ? (
        <div className="w-full text-[0.6875rem] text-muted sm:ml-auto sm:w-auto">{aside}</div>
      ) : null}
    </div>
  );
}

/* --- Цена ------------------------------------------------------------------ */

export function Price({
  value,
  currency = "RUB",
  size = "md",
  tone = "ink",
}: {
  value: number;
  currency?: string;
  size?: "sm" | "md" | "lg";
  tone?: "ink" | "accent" | "muted";
}) {
  const sizes = {
    sm: "text-sm",
    md: "text-base",
    lg: "text-2xl",
  } as const;
  const tones = {
    ink: "text-ink",
    accent: "text-accent",
    muted: "text-muted",
  } as const;

  return (
    <span className={cn("num font-medium whitespace-nowrap", sizes[size], tones[tone])}>
      {formatPrice(value)}
      <span className="ml-1 text-[0.75em] text-faint">{currencySign(currency)}</span>
    </span>
  );
}

/* --- Шкала наличия --------------------------------------------------------- */

const STOCK_STEPS = [1, 3, 6, 12, 24];

export function StockGauge({
  quantity,
  label,
  exact = true,
}: {
  quantity: number | null;
  label: string;
  exact?: boolean;
}) {
  const filled = quantity === null ? 0 : STOCK_STEPS.filter((step) => quantity >= step).length;
  const empty = quantity === 0 || quantity === null;

  return (
    <span className="inline-flex items-center gap-2" title={`Остаток: ${label || "нет данных"}`}>
      <span className="flex gap-[2px]" aria-hidden>
        {STOCK_STEPS.map((step, index) => (
          <span
            key={step}
            className={cn(
              "h-3 w-[3px]",
              index < filled ? "bg-positive" : "bg-rule-strong/45",
            )}
          />
        ))}
      </span>
      <span className={cn("num text-xs", empty ? "text-faint" : "text-ink")}>
        {label || "—"}
        {!exact && quantity !== null ? null : null}
      </span>
    </span>
  );
}

/* --- Чипы и метки ---------------------------------------------------------- */

type Tone = "neutral" | "accent" | "positive" | "warning" | "critical";

const PILL_TONES: Record<Tone, string> = {
  neutral: "border-rule-strong text-muted",
  accent: "border-accent text-accent",
  positive: "border-positive/50 text-positive",
  warning: "border-warning/50 text-warning",
  critical: "border-critical/50 text-critical",
};

export function Pill({
  children,
  tone = "neutral",
  solid = false,
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  solid?: boolean;
  className?: string;
}) {
  const solidTones: Record<Tone, string> = {
    neutral: "bg-sunken text-ink border-transparent",
    accent: "bg-accent text-accent-ink border-transparent",
    positive: "bg-positive text-paper border-transparent",
    warning: "bg-warning text-paper border-transparent",
    critical: "bg-critical text-paper border-transparent",
  };

  return (
    <span
      className={cn(
        "num inline-flex items-center border px-1.5 py-0.5 text-[0.625rem] leading-none tracking-[0.1em] uppercase",
        solid ? solidTones[tone] : PILL_TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/* --- Кнопки ---------------------------------------------------------------- */

type ButtonVariant = "primary" | "outline" | "ghost" | "danger";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-accent-ink border-accent hover:brightness-95 active:translate-y-px disabled:bg-rule-strong disabled:border-rule-strong disabled:text-faint",
  outline:
    "border-ink text-ink hover:bg-ink hover:text-paper active:translate-y-px disabled:border-rule disabled:text-faint disabled:hover:bg-transparent disabled:hover:text-faint",
  ghost:
    "border-transparent text-muted hover:text-ink hover:border-rule disabled:text-faint disabled:hover:border-transparent",
  danger:
    "border-critical text-critical hover:bg-critical hover:text-paper active:translate-y-px disabled:border-rule disabled:text-faint",
};

export function Button({
  variant = "outline",
  size = "md",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: ButtonVariant; size?: "sm" | "md" | "lg" }) {
  const sizes = {
    sm: "h-8 px-3 text-[0.6875rem]",
    md: "h-10 px-4 text-xs",
    lg: "h-12 px-6 text-sm",
  } as const;

  return (
    <button
      {...props}
      className={cn(
        "inline-flex items-center justify-center gap-2 border font-semibold tracking-[0.12em] uppercase transition-all disabled:cursor-not-allowed",
        sizes[size],
        BUTTON_VARIANTS[variant],
        className,
      )}
    />
  );
}

/* --- Состояния ------------------------------------------------------------- */

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-block h-3 w-3 animate-spin border border-current border-t-transparent",
        className,
      )}
      aria-hidden
    />
  );
}

export function Empty({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="hatch border border-rule">
      <div className="m-px bg-paper px-6 py-16 text-center">
        <p className="text-lg font-bold tracking-tight">{title}</p>
        {hint ? <div className="mx-auto mt-2 max-w-md text-sm text-muted">{hint}</div> : null}
        {action ? <div className="mt-6 flex justify-center">{action}</div> : null}
      </div>
    </div>
  );
}

export function SkeletonRow({ columns = 5 }: { columns?: number }) {
  return (
    <div className="flex animate-pulse items-center gap-4 border-b border-rule px-4 py-4">
      {Array.from({ length: columns }).map((_, index) => (
        <div
          key={index}
          className="h-3 bg-rule/70"
          style={{ width: `${[22, 14, 30, 12, 18][index % 5]}%` }}
        />
      ))}
    </div>
  );
}

/* --- Рамка с угловыми метками, как на печатных макетах --------------------- */

export function CornerFrame({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("relative border border-rule", className)}>
      <Corner className="-top-px -left-px border-t-2 border-l-2" />
      <Corner className="-top-px -right-px border-t-2 border-r-2" />
      <Corner className="-bottom-px -left-px border-b-2 border-l-2" />
      <Corner className="-right-px -bottom-px border-r-2 border-b-2" />
      {children}
    </div>
  );
}

function Corner({ className }: { className: string }) {
  return <span aria-hidden className={cn("pointer-events-none absolute h-2.5 w-2.5 border-accent", className)} />;
}

/* --- Метка поставщика ------------------------------------------------------ */

export function SupplierTag({ name, live = true }: { name: string; live?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={cn("h-1.5 w-1.5 rounded-full", live ? "bg-positive" : "bg-warning")}
        aria-hidden
      />
      <span className="num text-[0.625rem] tracking-[0.12em] text-muted uppercase">{name}</span>
    </span>
  );
}
