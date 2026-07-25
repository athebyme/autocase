import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto grid max-w-[104rem] place-items-center px-4 py-24 sm:px-6">
      <div className="text-center">
        <p className="num text-[0.6875rem] tracking-[0.2em] text-accent uppercase">Ошибка 404</p>
        <h1 className="mt-4 text-[clamp(3rem,10vw,7rem)] leading-[0.9] font-black tracking-[-0.04em] uppercase">
          Не найдено
        </h1>
        <p className="mx-auto mt-4 max-w-md text-sm text-muted">
          Такой страницы нет. Возможно, карточка товара больше недоступна у поставщика.
        </p>
        <Link
          href="/"
          className="mt-8 inline-block border border-ink px-6 py-3 text-[0.6875rem] font-semibold tracking-[0.14em] uppercase transition-colors hover:bg-ink hover:text-paper"
        >
          К подбору
        </Link>
      </div>
    </div>
  );
}
