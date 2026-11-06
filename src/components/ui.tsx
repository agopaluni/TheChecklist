"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

export function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
}) {
  const styles = {
    primary: "bg-accent text-accent-ink shadow-[0_6px_18px_-8px_var(--accent)] active:brightness-95",
    secondary: "bg-card text-ink border border-line hover:bg-soft",
    ghost: "text-ink hover:bg-soft",
  }[variant];
  return (
    <button
      type="button"
      className={`inline-flex min-h-13 items-center justify-center gap-2 rounded-2xl px-5 text-[17px] font-semibold transition active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 ${styles} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function Avatar({ name, you = false }: { name: string; you?: boolean }) {
  return (
    <span
      className={`grid size-9 shrink-0 place-items-center rounded-full font-display text-[15px] font-bold ${you ? "bg-accent text-accent-ink" : "bg-soft text-ink"}`}
      aria-hidden
    >
      {name.trim().charAt(0).toUpperCase()}
    </span>
  );
}

export function ProgressBar({ ready, total }: { ready: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((ready / total) * 100);
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-soft" aria-hidden>
      <div
        className="h-full rounded-full bg-accent transition-[width] duration-500 ease-out"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// Toasts ---------------------------------------------------------------------

const ToastContext = createContext<(message: string) => void>(() => {});
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null);
  const show = useCallback((message: string) => {
    const id = Date.now();
    setToast({ id, message });
    setTimeout(() => setToast((t) => (t?.id === id ? null : t)), 3200);
  }, []);
  return (
    <ToastContext.Provider value={show}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center px-4"
        role="status"
        aria-live="polite"
      >
        {toast && (
          <div
            key={toast.id}
            className="animate-rise max-w-sm rounded-2xl bg-ink px-4 py-3 text-center text-[15px] font-medium text-paper shadow-lg"
          >
            {toast.message}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}
