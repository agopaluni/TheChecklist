"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { BackIcon } from "./icons";
import { Button } from "./ui";

export function NewEventForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [start, setStart] = useState("");

  async function submit(form: FormData) {
    const name = String(form.get("name") ?? "").trim();
    const creatorName = String(form.get("creator") ?? "").trim();
    if (!name || !creatorName) return;
    setBusy(true);
    setError(null);
    try {
      const slug = await api.createEvent({
        name,
        creatorName,
        date: String(form.get("date") ?? ""),
        endDate: String(form.get("end_date") ?? ""),
        location: String(form.get("location") ?? ""),
        note: String(form.get("note") ?? ""),
      });
      router.push(`/e/${slug}?new=1`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't create the event. Try again.");
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-5 pt-[max(1rem,env(safe-area-inset-top))]">
      <header className="flex items-center gap-2 py-3">
        <Link
          href="/"
          className="-ml-2 grid size-11 place-items-center rounded-full hover:bg-soft"
          aria-label="Back"
        >
          <BackIcon />
        </Link>
      </header>
      <h1 className="font-display text-[2.1rem] leading-tight font-extrabold tracking-tight">
        New event
      </h1>
      <p className="mt-1 text-muted">You can change any of this later.</p>

      <form action={submit} className="mt-6 flex flex-1 flex-col gap-5">
        <Field label="What's the event?">
          <input
            name="name"
            required
            maxLength={80}
            autoFocus
            className="field"
            placeholder="Camping at Big Sur"
            autoComplete="off"
          />
        </Field>
        <Field label="Your first name" hint="So everyone knows who started the list.">
          <input
            name="creator"
            required
            maxLength={40}
            className="field"
            placeholder="Priya"
            autoComplete="given-name"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="When" optional>
            <input
              name="date"
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="field min-h-[3.2rem]"
            />
          </Field>
          <Field label="Until" optional>
            <input
              name="end_date"
              type="date"
              min={start || undefined}
              disabled={!start}
              className="field min-h-[3.2rem] disabled:opacity-50"
            />
          </Field>
        </div>
        <p className="-mt-3 text-sm text-muted">
          Add an end date for trips and weekends, then give each day its own list.
        </p>
        <Field label="Where" optional>
          <input name="location" maxLength={120} className="field" placeholder="Kirk Creek" />
        </Field>
        <Field label="Note" optional>
          <textarea
            name="note"
            rows={3}
            maxLength={1000}
            className="field resize-none"
            placeholder="Leaving Friday at 4. Bring layers!"
          />
        </Field>

        {error && <p className="text-[15px] font-medium text-accent">{error}</p>}

        <div className="bottom-safe sticky bottom-0 -mx-5 mt-auto bg-gradient-to-t from-paper via-paper to-transparent px-5 pt-6">
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? "Creating…" : "Create event"}
          </Button>
        </div>
      </form>
    </main>
  );
}

function Field({
  label,
  hint,
  optional,
  children,
}: {
  label: string;
  hint?: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline gap-2 text-[15px] font-semibold">
        {label}
        {optional && <span className="text-sm font-normal text-muted">optional</span>}
      </span>
      {children}
      {hint && <span className="mt-1.5 block text-sm text-muted">{hint}</span>}
    </label>
  );
}
