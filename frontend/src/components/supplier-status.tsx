"use client";

import { useSuppliers } from "@/lib/hooks";
import { plural } from "@/lib/format";

/** Короткая честная строка о том, откуда сейчас берутся данные. */
export function SupplierStatus() {
  const { data, isLoading } = useSuppliers();
  if (isLoading || !data) return null;

  const suppliers = data.suppliers;
  if (!suppliers.length) {
    return <span className="text-critical">поставщики не подключены</span>;
  }

  const demo = suppliers.filter((supplier) => !supplier.live);
  const allDemo = demo.length === suppliers.length;

  return (
    <span className="inline-flex items-center gap-2">
      <span
        aria-hidden
        className={`h-1.5 w-1.5 rounded-full ${allDemo ? "bg-warning" : demo.length ? "bg-warning" : "bg-positive"}`}
      />
      <span className="num text-[0.6875rem] tracking-[0.08em]">
        {allDemo
          ? "демо-данные · ключи не заданы"
          : `${suppliers.length} ${plural(suppliers.length, "поставщик", "поставщика", "поставщиков")}`}
      </span>
    </span>
  );
}
