"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError, isOfflineError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { takePendingJoin } from "@/lib/identity";
import { supabase } from "@/lib/supabase";
import type { EventData } from "@/lib/types";
import { EventView } from "./EventView";
import { ToastProvider, useToast } from "./ui";
import { WhoAreYou } from "./WhoAreYou";
import { Wordmark } from "./Wordmark";

export type Run = (
  action: () => Promise<unknown>,
  optimistic?: (d: EventData) => EventData,
) => Promise<boolean>;

export function EventScreen({ slug }: { slug: string }) {
  return (
    <ToastProvider>
      <EventLoader slug={slug} />
    </ToastProvider>
  );
}

function EventLoader({ slug }: { slug: string }) {
  const auth = useAuth();
  const toast = useToast();
  // undefined = loading, null = not found
  const [data, setData] = useState<EventData | null | undefined>(undefined);
  const [offline, setOffline] = useState(false);
  const latest = useRef(0);
  const cacheKey = `tc:event:${slug}`;

  // Show the last copy we saw straight away (also what you get offline).
  useEffect(() => {
    const cached = localStorage.getItem(cacheKey);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading browser storage after mount
    if (cached) setData((d) => (d === undefined ? (JSON.parse(cached) as EventData) : d));
  }, [cacheKey]);

  const load = useCallback(async () => {
    const request = ++latest.current;
    try {
      const fresh = await api.getEvent(slug);
      if (request !== latest.current) return; // a newer load is on its way
      setData(fresh);
      setOffline(false);
      if (fresh) localStorage.setItem(cacheKey, JSON.stringify(fresh));
      else localStorage.removeItem(cacheKey);
    } catch (e) {
      // Keep showing what we have; the next change or reconnect loads again.
      if (isOfflineError(e)) setOffline(true);
    }
  }, [slug, cacheKey]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetching from Supabase
    if (auth.ready) load();
  }, [auth.ready, auth.user?.id, load]);

  // Live updates: the database broadcasts "changed" on this channel after every write.
  const eventId = data?.event.id;
  useEffect(() => {
    if (!eventId) return;
    let timer: ReturnType<typeof setTimeout>;
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(load, 120);
    };
    const channel = supabase()
      .channel(`event:${eventId}`, { config: { private: false } })
      .on("broadcast", { event: "changed" }, refresh)
      .subscribe((status) => status === "SUBSCRIBED" && refresh()); // catch up after reconnects
    const onVisible = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", refresh);
    return () => {
      clearTimeout(timer);
      supabase().removeChannel(channel);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", refresh);
    };
  }, [eventId, load]);

  useEffect(() => {
    const goOffline = () => setOffline(true);
    window.addEventListener("offline", goOffline);
    return () => window.removeEventListener("offline", goOffline);
  }, []);

  const run: Run = useCallback(
    async (action, optimistic) => {
      if (optimistic) setData((d) => (d ? optimistic(d) : d));
      try {
        await action();
        return true;
      } catch (e) {
        toast(e instanceof ApiError ? e.message : "Something went wrong.");
        return false;
      } finally {
        load();
      }
    },
    [load, toast],
  );

  // Back from Google sign-in with a name picked before leaving: claim it now.
  const me = data?.me;
  useEffect(() => {
    if (!auth.ready || !auth.user || !eventId || me) return;
    const pending = takePendingJoin(slug);
    if (!pending) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- finishing a join started before sign-in
    run(() =>
      pending.kind === "claim"
        ? api.claimPerson(pending.participantId)
        : api.joinAsNew(eventId, pending.name),
    );
  }, [auth.ready, auth.user, eventId, me, slug, run]);

  if (data === undefined) return <Loading />;
  if (data === null) return <NotFound />;

  return (
    <>
      {offline && (
        <div className="sticky top-0 z-30 bg-ink px-4 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] text-center text-sm font-medium text-paper">
          You&rsquo;re offline. Showing the last saved copy.
        </div>
      )}
      {data.me && data.participants.some((p) => p.id === data.me) ? (
        <EventView data={data} run={run} auth={auth} offline={offline} />
      ) : (
        <WhoAreYou data={data} run={run} auth={auth} />
      )}
    </>
  );
}

function Loading() {
  return (
    <main className="mx-auto w-full max-w-xl px-5 pt-[max(1.5rem,env(safe-area-inset-top))]" aria-busy>
      <div className="mt-10 h-9 w-2/3 animate-pulse rounded-xl bg-soft" />
      <div className="mt-3 h-5 w-1/3 animate-pulse rounded-lg bg-soft" />
      <div className="mt-10 space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-12 animate-pulse rounded-xl bg-soft" />
        ))}
      </div>
    </main>
  );
}

function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col items-start justify-center px-6">
      <Wordmark />
      <h1 className="mt-6 font-display text-3xl font-extrabold tracking-tight">
        Can&rsquo;t find this event
      </h1>
      <p className="mt-2 text-muted">
        It may have been deleted, or the link got cut off. Ask whoever sent it for a fresh one.
      </p>
      <Link href="/" className="mt-6 font-semibold text-accent">
        Go to your events
      </Link>
    </main>
  );
}
