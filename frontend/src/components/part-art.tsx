/**
 * Иллюстрация детали.
 *
 * У API поставщика нет фотографий, а магазин без картинок читается как
 * выгрузка из базы. Рисуем деталь сами: тип угадываем по названию, форма
 * узнаётся с одного взгляда и не притворяется фотографией.
 */

type Kind =
  | "filter"
  | "pads"
  | "spark"
  | "belt"
  | "shock"
  | "disc"
  | "bearing"
  | "lamp"
  | "oil"
  | "generic";

const RULES: Array<[RegExp, Kind]> = [
  [/фильтр/i, "filter"],
  [/колодк/i, "pads"],
  [/свеч/i, "spark"],
  [/ремень|ремн/i, "belt"],
  [/амортизат|стойк/i, "shock"],
  [/диск|бараба/i, "disc"],
  [/подшипник|ступиц/i, "bearing"],
  [/лампа|фар/i, "lamp"],
  [/масло|жидкост|антифриз/i, "oil"],
];

export function detectKind(name: string): Kind {
  for (const [pattern, kind] of RULES) {
    if (pattern.test(name)) return kind;
  }
  return "generic";
}

export function PartArt({
  name,
  className = "",
  tone = "default",
}: {
  name: string;
  className?: string;
  tone?: "default" | "muted";
}) {
  const kind = detectKind(name);
  const stroke = tone === "muted" ? "var(--color-faint)" : "var(--color-ink)";

  return (
    <svg
      viewBox="0 0 120 120"
      className={className}
      role="img"
      aria-label={name || "Деталь"}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <g stroke={stroke} strokeWidth={2.5}>
        {SHAPES[kind]}
      </g>
    </svg>
  );
}

const ACCENT = "var(--color-accent)";

const SHAPES: Record<Kind, React.ReactNode> = {
  filter: (
    <>
      <ellipse cx="60" cy="34" rx="30" ry="11" />
      <path d="M30 34v52c0 6 13 11 30 11s30-5 30-11V34" />
      <ellipse cx="60" cy="34" rx="17" ry="6" stroke={ACCENT} />
      <path d="M38 50h44M38 62h44M38 74h44" opacity={0.35} />
    </>
  ),
  pads: (
    <>
      <path d="M24 44c0-6 5-10 11-10h50c6 0 11 4 11 10v16c0 6-5 10-11 10H35c-6 0-11-4-11-10z" />
      <path d="M24 74h72v10c0 4-3 7-7 7H31c-4 0-7-3-7-7z" stroke={ACCENT} />
      <path d="M36 46v12M52 46v12M68 46v12M84 46v12" opacity={0.35} />
    </>
  ),
  spark: (
    <>
      <path d="M52 14h16v18H52z" />
      <path d="M48 32h24v16H48z" />
      <path d="M44 48h32l-4 14H48z" />
      <path d="M54 62h12v22H54z" stroke={ACCENT} />
      <path d="M60 84v18M60 102h10" stroke={ACCENT} />
    </>
  ),
  belt: (
    <>
      <path d="M22 60c0-18 17-30 38-30s38 12 38 30-17 30-38 30-38-12-38-30z" />
      <path d="M32 60c0-12 12-20 28-20s28 8 28 20-12 20-28 20-28-8-28-20z" stroke={ACCENT} />
      <path d="M22 52h76M22 68h76" opacity={0.3} />
    </>
  ),
  shock: (
    <>
      <circle cx="60" cy="20" r="8" />
      <path d="M60 28v16" />
      <path d="M46 44h28v46c0 6-6 10-14 10s-14-4-14-10z" />
      <path d="M52 52c0 0 16 0 16 0M52 62h16M52 72h16" stroke={ACCENT} opacity={0.6} />
      <path d="M60 100v10" />
    </>
  ),
  disc: (
    <>
      <circle cx="60" cy="60" r="40" />
      <circle cx="60" cy="60" r="17" stroke={ACCENT} />
      <circle cx="60" cy="60" r="6" />
      <path d="M60 26v8M94 60h-8M60 94v-8M26 60h8" opacity={0.4} />
      <path d="M84 36l-6 6M84 84l-6-6M36 84l6-6M36 36l6 6" opacity={0.4} />
    </>
  ),
  bearing: (
    <>
      <circle cx="60" cy="60" r="38" />
      <circle cx="60" cy="60" r="20" stroke={ACCENT} />
      <circle cx="60" cy="31" r="6" />
      <circle cx="89" cy="60" r="6" />
      <circle cx="60" cy="89" r="6" />
      <circle cx="31" cy="60" r="6" />
    </>
  ),
  lamp: (
    <>
      <path d="M40 44c0-14 9-24 20-24s20 10 20 24c0 10-6 15-6 24H46c0-9-6-14-6-24z" />
      <path d="M46 76h28v10H46z" stroke={ACCENT} />
      <path d="M50 86h20v12H50z" />
      <path d="M54 34c0 0 3 10 6 10s6-10 6-10" opacity={0.5} />
    </>
  ),
  oil: (
    <>
      <path d="M44 22h32v12H44z" />
      <path d="M36 34h48v62c0 4-3 6-7 6H43c-4 0-7-2-7-6z" />
      <path d="M44 56h32v26H44z" stroke={ACCENT} />
      <path d="M50 64h20M50 72h14" opacity={0.4} />
    </>
  ),
  generic: (
    <>
      <path d="M60 18l34 20v44L60 102 26 82V38z" />
      <circle cx="60" cy="60" r="16" stroke={ACCENT} />
      <circle cx="60" cy="60" r="5" />
    </>
  ),
};
