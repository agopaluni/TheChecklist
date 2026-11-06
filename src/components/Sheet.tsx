"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { CloseIcon } from "./icons";

// Bottom sheet. Stays mounted (inert while closed) so a field inside it can be focused
// in the same tap that opens it, which is what keeps the phone keyboard coming up.
export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const keyboard = useKeyboardInset();
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <div
      className={`fixed inset-0 z-40 ${open ? "" : "pointer-events-none"}`}
      inert={!open}
      aria-hidden={!open}
    >
      <div
        className={`absolute inset-0 bg-black/35 transition-opacity duration-200 ${open ? "opacity-100" : "opacity-0"}`}
        onClick={onClose}
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === "string" ? title : undefined}
        style={keyboard ? { bottom: keyboard } : undefined}
        className={`absolute inset-x-0 bottom-0 mx-auto flex max-h-[88dvh] w-full max-w-lg flex-col rounded-t-3xl border border-b-0 border-line bg-card shadow-[0_-12px_40px_-12px_rgba(0,0,0,0.25)] transition-[translate,scale,opacity] duration-200 ease-out sm:mb-4 sm:rounded-3xl sm:border-b lg:top-1/2 lg:bottom-auto lg:mb-0 lg:max-h-[80dvh] lg:max-w-xl lg:-translate-y-1/2 lg:shadow-[0_24px_80px_-20px_rgba(0,0,0,0.35)] ${open ? "translate-y-0 lg:scale-100 lg:opacity-100" : "translate-y-[110%] lg:scale-95 lg:opacity-0"}`}
      >
        <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-2">
          <h2 className="font-display text-xl font-bold tracking-tight">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="-mr-2 grid size-10 place-items-center rounded-full text-muted hover:bg-soft"
            aria-label="Close"
          >
            <CloseIcon />
          </button>
        </div>
        <div className="overflow-y-auto overscroll-contain px-5 pb-4">{children}</div>
        {footer && <div className="bottom-safe border-t border-line px-5 pt-3">{footer}</div>}
        {!footer && <div className="bottom-safe" />}
      </div>
    </div>
  );
}

// How far the on-screen keyboard covers the layout viewport (iOS doesn't resize it).
function useKeyboardInset() {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () =>
      setInset(Math.max(0, window.innerHeight - vv.height - vv.offsetTop));
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);
  return inset;
}

export function SheetAction({
  children,
  onClick,
  tone = "default",
  hint,
}: {
  children: ReactNode;
  onClick: () => void;
  tone?: "default" | "danger";
  hint?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full flex-col items-start rounded-2xl px-4 py-3.5 text-left hover:bg-soft active:bg-soft ${tone === "danger" ? "text-accent" : ""}`}
    >
      <span className="text-[17px] font-semibold">{children}</span>
      {hint && <span className="mt-0.5 text-sm text-muted">{hint}</span>}
    </button>
  );
}
