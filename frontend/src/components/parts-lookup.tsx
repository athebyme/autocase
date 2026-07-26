"use client";

import { useRef, useState } from "react";

import { SearchField } from "@/components/search-field";
import { cn } from "@/components/ui";
import { ApiError, api } from "@/lib/api";
import type { Vehicle, VinConfidence, VinDecodeResult } from "@/lib/types";

type LookupMode = "part" | "vin";

export function PartsLookup() {
  const [mode, setMode] = useState<LookupMode>("part");

  return (
    <div id="parts-search">
      <div className="mb-4 flex border-b border-rule" role="tablist" aria-label="Способ поиска">
        <ModeButton selected={mode === "part"} onClick={() => setMode("part")}>
          По артикулу
        </ModeButton>
        <ModeButton selected={mode === "vin"} onClick={() => setMode("vin")}>
          По VIN
        </ModeButton>
      </div>
      {mode === "part" ? <SearchField /> : <VinLookup />}
    </div>
  );
}

function ModeButton({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onClick}
      className={cn(
        "relative px-5 py-3 text-xs font-semibold tracking-[0.08em] uppercase transition-colors",
        selected ? "text-ink" : "text-faint hover:text-ink",
      )}
    >
      {children}
      {selected ? <span className="absolute inset-x-0 -bottom-px h-0.5 bg-accent" /> : null}
    </button>
  );
}

function VinLookup() {
  const [vin, setVin] = useState("");
  const [result, setResult] = useState<VinDecodeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const normalized = vin.toUpperCase().replace(/\s/g, "");
    setVin(normalized);
    setResult(null);

    if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(normalized)) {
      setError("Проверьте VIN: нужно 17 латинских букв и цифр без I, O и Q.");
      input.current?.focus();
      return;
    }

    setError(null);
    setPending(true);
    try {
      setResult(await api.decodeVin(normalized));
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "Не удалось проверить VIN. Попробуйте ещё раз.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <form onSubmit={submit}>
        <div
          className={cn(
            "flex items-stretch border-2 bg-paper transition-colors",
            error ? "border-critical" : "border-ink focus-within:border-accent",
          )}
        >
          <span
            aria-hidden
            className="num grid w-12 shrink-0 place-items-center border-r border-rule bg-paper text-xs font-bold text-muted sm:w-14"
          >
            VIN
          </span>
          <input
            ref={input}
            value={vin}
            onChange={(event) => {
              setVin(event.target.value.toUpperCase());
              setError(null);
            }}
            maxLength={20}
            placeholder="17 символов VIN-номера"
            aria-label="VIN-номер автомобиля"
            aria-invalid={Boolean(error)}
            spellCheck={false}
            autoCapitalize="characters"
            autoComplete="off"
            className="num h-16 w-0 min-w-0 flex-1 bg-transparent px-3 text-base uppercase outline-none placeholder:font-sans placeholder:tracking-normal placeholder:text-faint placeholder:normal-case sm:h-[4.5rem] sm:px-4 sm:text-xl"
          />
          <button
            type="submit"
            disabled={pending}
            className="shrink-0 border-l border-ink bg-accent px-4 text-xs font-semibold text-accent-ink transition-colors hover:bg-ink disabled:cursor-wait disabled:opacity-70 sm:px-7"
          >
            {pending ? "Проверяем…" : "Найти автомобиль"}
          </button>
        </div>
      </form>

      {error ? <p className="mt-3 text-sm text-critical">{error}</p> : null}
      {result ? (
        <VehicleResult key={`${result.source}:${result.vehicle.vin}`} result={result} />
      ) : null}
    </div>
  );
}

function VehicleResult({ result }: { result: VinDecodeResult }) {
  const matches = [result.vehicle, ...result.alternatives];
  const [selected, setSelected] = useState(0);
  const vehicle = matches[selected] ?? result.vehicle;
  const title = [vehicle.make, vehicle.series || vehicle.model, vehicle.model_year]
    .filter(Boolean)
    .join(" ");
  const engine = [
    vehicle.engine_code,
    vehicle.engine_model,
    vehicle.engine_liters ? `${vehicle.engine_liters} л` : null,
    vehicle.engine_power_hp ? `${vehicle.engine_power_hp} л.с.` : null,
    vehicle.engine_cylinders ? `${vehicle.engine_cylinders} цил.` : null,
    vehicle.fuel_type,
    vehicle.electrification_level,
  ]
    .filter(Boolean)
    .join(" · ");
  const transmission = [
    vehicle.transmission,
    vehicle.transmission_speeds ? `${vehicle.transmission_speeds} ступ.` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const plant = [vehicle.plant_city, vehicle.plant_country].filter(Boolean).join(", ");
  const facts = [
    { label: "Модель / код", value: vehicle.model },
    { label: "Дата производства", value: vehicle.production_date },
    { label: "Двигатель", value: engine || null },
    { label: "Коробка передач", value: transmission || null },
    { label: "Кузов", value: vehicle.body_class },
    { label: "Привод", value: vehicle.drive_type },
    { label: "Комплектация", value: vehicle.trim },
    { label: "Рынок", value: vehicle.market },
    { label: "Завод", value: plant || null },
  ].filter((fact) => fact.value);
  const confidence = confidenceMeta(result.confidence);

  return (
    <div className="mt-5 border border-rule-strong bg-paper">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-rule p-4 sm:p-5">
        <div>
          <p className="text-xs font-semibold tracking-[0.08em] text-positive uppercase">
            Автомобиль найден
          </p>
          <h3 className="mt-2 text-lg font-bold sm:text-xl">{title}</h3>
          <p className="num mt-2 text-xs text-faint">{vehicle.vin}</p>
        </div>
        <div className="text-right">
          <span className={cn("inline-block border px-3 py-2 text-xs", confidence.className)}>
            {confidence.label}
          </span>
          <p className="mt-2 text-[0.625rem] text-faint">Источник: {result.source_label}</p>
        </div>
      </div>

      {matches.length > 1 ? (
        <div className="border-b border-rule bg-surface p-4 sm:p-5">
          <p className="text-xs font-semibold uppercase">Выберите найденную модификацию</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {matches.map((match, index) => (
              <button
                key={`${match.catalog_code}:${match.vehicle_id}:${index}`}
                type="button"
                onClick={() => setSelected(index)}
                className={cn(
                  "border px-3 py-2 text-left text-xs transition-colors",
                  selected === index
                    ? "border-ink bg-ink text-paper"
                    : "border-rule-strong bg-paper hover:border-accent",
                )}
              >
                {[match.make, match.series || match.model, match.model_year]
                  .filter(Boolean)
                  .join(" ")}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {facts.length ? (
        <dl className="grid sm:grid-cols-2 lg:grid-cols-3">
          {facts.map((fact) => (
            <VehicleFact key={fact.label} label={fact.label} value={fact.value} />
          ))}
        </dl>
      ) : null}

      {vehicle.attributes.length ? <AdditionalFacts vehicle={vehicle} /> : null}

      {result.warnings.length ? (
        <div className="border-t border-warning bg-warning-soft p-4 text-sm text-warning sm:p-5">
          <p className="font-semibold">Что нужно проверить перед заказом</p>
          <ul className="mt-2 space-y-1.5">
            {result.warnings.map((warning) => (
              <li key={warning}>— {warning}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex flex-col gap-4 border-t border-rule bg-surface p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <p className="max-w-xl text-sm leading-relaxed text-muted">
          {result.complete
            ? "Комплектация определена. Перед оформлением всё равно сверим применимость детали по OEM-каталогу."
            : `Для точного подбора нужно уточнить: ${
                result.missing_fields.join(", ") || "модификацию автомобиля"
              }.`}
        </p>
        <a
          href="tel:+79110141751"
          className="shrink-0 bg-ink px-5 py-3 text-center text-xs font-semibold text-paper transition-colors hover:bg-accent"
        >
          Уточнить по VIN
        </a>
      </div>
    </div>
  );
}

function VehicleFact({ label, value }: { label: string; value: string | number | null }) {
  return (
    <div className="border-r border-b border-rule p-4">
      <dt className="text-[0.625rem] font-semibold tracking-[0.08em] text-faint uppercase">
        {label}
      </dt>
      <dd className="mt-2 text-sm font-semibold">{value ?? "Не определено"}</dd>
    </div>
  );
}

function AdditionalFacts({ vehicle }: { vehicle: Vehicle }) {
  return (
    <details className="border-t border-rule">
      <summary className="cursor-pointer px-4 py-3 text-xs font-semibold uppercase hover:text-accent sm:px-5">
        Все параметры OEM-каталога · {vehicle.attributes.length}
      </summary>
      <dl className="grid border-t border-rule bg-surface sm:grid-cols-2 lg:grid-cols-3">
        {vehicle.attributes.map((attribute, index) => (
          <VehicleFact
            key={`${attribute.key}:${index}`}
            label={attribute.label}
            value={attribute.value}
          />
        ))}
      </dl>
    </details>
  );
}

function confidenceMeta(confidence: VinConfidence) {
  const values: Record<
    VinConfidence,
    {
      label: string;
      className: string;
    }
  > = {
    exact: {
      label: "Точная комплектация",
      className: "border-positive bg-positive-soft text-positive",
    },
    likely: {
      label: "Нужно подтверждение",
      className: "border-warning bg-warning-soft text-warning",
    },
    partial: {
      label: "Базовые сведения",
      className: "border-warning bg-warning-soft text-warning",
    },
  };
  return values[confidence];
}
