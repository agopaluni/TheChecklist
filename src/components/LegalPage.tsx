import Link from "next/link";
import type { ReactNode } from "react";
import { BackIcon } from "./icons";

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-xl px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-16">
      <header className="py-3">
        <Link href="/" className="-ml-2 grid size-11 place-items-center rounded-full hover:bg-soft" aria-label="Home">
          <BackIcon />
        </Link>
      </header>
      <h1 className="font-display text-[2.1rem] leading-tight font-extrabold tracking-tight">{title}</h1>
      <p className="mt-1 text-sm text-muted">Last updated {updated}</p>
      <div className="mt-6 space-y-4 text-[16px] leading-relaxed [&_h2]:mt-8 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-bold [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1.5">
        {children}
      </div>
    </main>
  );
}
