/**
 * Товарные изображения запчастей из единого спрайта.
 *
 * Один файл не даёт карточкам загружать девять отдельных тяжёлых изображений,
 * а позиция ячейки выбирается по названию детали.
 */

type Kind =
  | "filter"
  | "brake"
  | "spark"
  | "shock"
  | "belt"
  | "bearing"
  | "lamp"
  | "oil"
  | "generic";

const RULES: Array<[RegExp, Kind]> = [
  [/фильтр/i, "filter"],
  [/колодк|суппорт|диск|бараба/i, "brake"],
  [/свеч/i, "spark"],
  [/амортизат|стойк|пружин/i, "shock"],
  [/ремень|ремн|грм/i, "belt"],
  [/подшипник|ступиц|шрус|сцеплен/i, "bearing"],
  [/лампа|фар/i, "lamp"],
  [/масло|жидкост|антифриз/i, "oil"],
];

const POSITIONS: Record<Kind, string> = {
  filter: "0% 0%",
  brake: "50% 0%",
  spark: "100% 0%",
  shock: "0% 50%",
  belt: "50% 50%",
  bearing: "100% 50%",
  lamp: "0% 100%",
  oil: "50% 100%",
  generic: "100% 100%",
};

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
  return (
    <span
      role="img"
      aria-label={name || "Деталь"}
      className={`block shrink-0 bg-media bg-no-repeat ${
        tone === "muted" ? "grayscale opacity-65" : ""
      } ${className}`}
      style={{
        backgroundImage: 'url("/images/parts-sprite.webp")',
        backgroundPosition: POSITIONS[detectKind(name)],
        backgroundSize: "300% 300%",
      }}
    />
  );
}
