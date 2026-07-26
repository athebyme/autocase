"use client";

import { AnimatePresence, motion } from "motion/react";
import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

type Tone = "neutral" | "positive" | "critical";

interface Toast {
  id: number;
  title: string;
  body?: string;
  tone: Tone;
}

interface ToastApi {
  push: (toast: Omit<Toast, "id">) => void;
  ok: (title: string, body?: string) => void;
  fail: (title: string, body?: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const TONE_BAR: Record<Tone, string> = {
  neutral: "bg-graphite",
  positive: "bg-positive",
  critical: "bg-critical",
};

const TONE_LABEL: Record<Tone, string> = {
  neutral: "Сообщение",
  positive: "Готово",
  critical: "Ошибка",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);

  const push = useCallback((toast: Omit<Toast, "id">) => {
    const id = ++counter.current;
    setToasts((current) => [...current.slice(-2), { ...toast, id }]);
    // Ошибку держим дольше: её нужно успеть прочитать.
    const ttl = toast.tone === "critical" ? 7000 : 3800;
    setTimeout(() => setToasts((current) => current.filter((item) => item.id !== id)), ttl);
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      push,
      ok: (title, body) => push({ title, body, tone: "positive" }),
      fail: (title, body) => push({ title, body, tone: "critical" }),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        className="pointer-events-none fixed right-4 bottom-4 z-100 flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2"
        role="status"
        aria-live="polite"
      >
        <AnimatePresence initial={false}>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 24 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="pointer-events-auto flex border border-rule-strong bg-surface shadow-[6px_6px_0_0_var(--color-sunken)]"
            >
              <div className={`w-[3px] shrink-0 ${TONE_BAR[toast.tone]}`} aria-hidden />
              <div className="px-4 py-3">
                <p className="num text-[0.625rem] tracking-[0.18em] text-faint uppercase">
                  {TONE_LABEL[toast.tone]}
                </p>
                <p className="mt-1 text-sm leading-snug font-semibold">{toast.title}</p>
                {toast.body ? (
                  <p className="mt-1 text-xs leading-snug text-muted">{toast.body}</p>
                ) : null}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error("useToast должен вызываться внутри ToastProvider");
  return api;
}
