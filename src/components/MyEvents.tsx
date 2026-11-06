"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { signOut, useAuth } from "@/lib/auth";
import { googleSignInEnabled } from "@/lib/supabase";
import { formatWhen } from "@/lib/text";
import type { MyEvent } from "@/lib/types";
import { GoogleButton } from "./GoogleButton";

export function MyEvents() {
  const auth = useAuth();
  const [events, setEvents] = useState<MyEvent[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!auth.ready) return;
    api
      .myEvents()
      .then((e) => {
        setEvents(e);
        setFailed(false);
      })
      .catch(() => setFailed(true));
  }, [auth.ready, auth.user]);

  return (
    <section className="pb-6">
      <h2 className="mb-2 text-[13px] font-bold tracking-[0.12em] text-muted uppercase">
        Your events
      </h2>

      {failed && !events && (
        <p className="py-6 text-muted">Couldn&rsquo;t load your events. Are you online?</p>
      )}

      {!failed && events === null && (
        <div className="space-y-2" aria-label="Loading">
          {[0, 1].map((i) => (
            <div key={i} className="h-[74px] animate-pulse rounded-2xl bg-soft" />
          ))}
        </div>
      )}

      {events?.length === 0 && (
        <p className="rounded-2xl border border-dashed border-line px-4 py-6 text-center text-muted">
          Events you start or join show up here.
        </p>
      )}

      {events && events.length > 0 && (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
          {events.map((e) => (
            <li key={e.slug}>
              <Link
                href={`/e/${e.slug}`}
                className="flex items-center gap-4 px-4 py-3.5 hover:bg-soft active:bg-soft"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[17px] font-semibold">{e.name}</p>
                  <p className="truncate text-sm text-muted">
                    {[formatWhen(e.date, e.end_date), `You're ${e.me}`].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-semibold tabular-nums text-muted">
                  {e.total === 0 ? "Empty" : `${e.ready}/${e.total}`}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {googleSignInEnabled && auth.ready && (
        <div className="mt-4 text-sm text-muted">
          {auth.user ? (
            <p>
              Signed in with Google.{" "}
              <button type="button" className="font-semibold text-ink underline" onClick={() => signOut()}>
                Sign out
              </button>
            </p>
          ) : (
            <div className="space-y-3">
              <p>Sign in to see your events on any device.</p>
              <GoogleButton />
            </div>
          )}
        </div>
      )}
    </section>
  );
}
