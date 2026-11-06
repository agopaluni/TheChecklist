"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import type { AuthState } from "@/lib/auth";
import { setPendingJoin, type PendingJoin } from "@/lib/identity";
import { googleSignInEnabled } from "@/lib/supabase";
import { closeMatch, formatWhen } from "@/lib/text";
import type { EventData, Participant } from "@/lib/types";
import type { Run } from "./EventScreen";
import { GoogleButton } from "./GoogleButton";
import { BackIcon } from "./icons";
import { Avatar, Button } from "./ui";

type Choice = { kind: "claim"; person: Participant } | { kind: "new"; name: string };

export function WhoAreYou({ data, run, auth }: { data: EventData; run: Run; auth: AuthState }) {
  const { event, participants } = data;
  const unclaimed = participants.filter((p) => !p.is_claimed);
  const creator = participants.find((p) => p.id === event.created_by);
  const [choice, setChoice] = useState<Choice | null>(null);
  const [typingNew, setTypingNew] = useState(unclaimed.length === 0);
  const [busy, setBusy] = useState(false);

  // Signed in already, or Google isn't set up: no second step, just join.
  const askHowToKeep = googleSignInEnabled && !auth.user;

  async function join(c: Choice) {
    setBusy(true);
    const ok = await run(() =>
      c.kind === "claim" ? api.claimPerson(c.person.id) : api.joinAsNew(event.id, c.name),
    );
    if (!ok) {
      setChoice(null);
      setBusy(false);
    }
  }

  function pick(c: Choice) {
    if (askHowToKeep) setChoice(c);
    else join(c);
  }

  // Signed in through Google's popup: claim the name with the account, unless the account
  // already has someone in this event (a returning user on a new device).
  async function afterGoogle(c: Choice) {
    setBusy(true);
    const fresh = await api.getEvent(event.slug).catch(() => null);
    if (fresh?.me) await run(async () => {});
    else await join(c);
  }

  // Only used when Google's script is blocked and we fall back to the redirect flow.
  function rememberChoice(c: Choice) {
    const pending: PendingJoin =
      c.kind === "claim"
        ? { slug: event.slug, kind: "claim", participantId: c.person.id, name: c.person.display_name }
        : { slug: event.slug, kind: "new", name: c.name };
    setPendingJoin(pending);
  }

  const when = [formatWhen(event.date, event.end_date), event.location].filter(Boolean).join(" · ");

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pt-[max(2rem,env(safe-area-inset-top))] pb-10">
      <p className="text-[13px] font-bold tracking-[0.12em] text-accent uppercase">
        {creator ? `${creator.display_name}'s event` : "You're invited"}
      </p>
      <h1 className="mt-1 font-display text-[2.3rem] leading-[1.05] font-extrabold tracking-tight text-balance">
        {event.name}
      </h1>
      {when && <p className="mt-1.5 text-[17px] text-muted">{when}</p>}

      {choice ? (
        <KeepIdentity
          name={choice.kind === "claim" ? choice.person.display_name : choice.name}
          busy={busy}
          onGuest={() => join(choice)}
          onGoogleSignedIn={() => afterGoogle(choice)}
          onBeforeRedirect={() => rememberChoice(choice)}
          onBack={() => setChoice(null)}
        />
      ) : (
        <section className="mt-9 animate-rise">
          <h2 className="font-display text-2xl font-bold tracking-tight">Who are you?</h2>
          <p className="mt-1 text-muted">Tap your name to jump in.</p>

          <ul className="mt-5 space-y-2.5">
            {unclaimed.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => pick({ kind: "claim", person: p })}
                  className="flex min-h-15 w-full items-center gap-3 rounded-2xl border border-line bg-card px-4 text-left text-[18px] font-semibold transition hover:border-accent active:scale-[0.99]"
                >
                  <Avatar name={p.display_name} />
                  I&rsquo;m {p.display_name}
                </button>
              </li>
            ))}
            <li>
              {typingNew ? (
                <NewName
                  participants={participants}
                  busy={busy}
                  onPickExisting={(p) => pick({ kind: "claim", person: p })}
                  onSubmit={(name) => pick({ kind: "new", name })}
                  onCancel={unclaimed.length ? () => setTypingNew(false) : undefined}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setTypingNew(true)}
                  className="flex min-h-15 w-full items-center gap-3 rounded-2xl border border-dashed border-line px-4 text-left text-[18px] font-semibold text-muted transition hover:border-accent hover:text-ink"
                >
                  <span className="grid size-9 place-items-center rounded-full border border-dashed border-current text-xl">
                    +
                  </span>
                  I&rsquo;m someone new
                </button>
              )}
            </li>
          </ul>

          <MissingName creator={creator?.display_name} auth={auth} />
        </section>
      )}
    </main>
  );
}

function NewName({
  participants,
  busy,
  onSubmit,
  onPickExisting,
  onCancel,
}: {
  participants: Participant[];
  busy: boolean;
  onSubmit: (name: string) => void;
  onPickExisting: (p: Participant) => void;
  onCancel?: () => void;
}) {
  const [name, setName] = useState("");
  const match = closeMatch(name, participants);
  const exact = match && match.display_name.trim().toLowerCase() === name.trim().toLowerCase();

  return (
    <form
      className="rounded-2xl border border-accent bg-card p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim() && !(exact && match?.is_claimed)) onSubmit(name.trim());
      }}
    >
      <label className="block text-[15px] font-semibold" htmlFor="new-name">
        Your first name
      </label>
      <input
        id="new-name"
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={40}
        autoComplete="given-name"
        enterKeyHint="go"
        className="field mt-2"
        placeholder="Alex"
      />
      {match && name.trim() && (
        <div className="mt-3 rounded-xl bg-accent-soft px-3 py-2.5 text-[15px]">
          {!match.is_claimed ? (
            <>
              Did you mean{" "}
              <button
                type="button"
                className="font-semibold underline"
                onClick={() => onPickExisting(match)}
              >
                {match.display_name}
              </button>
              ? They&rsquo;re already on the list.
            </>
          ) : exact ? (
            <>
              {match.display_name} has already joined. Add a last initial so people can tell you
              apart.
            </>
          ) : (
            <>There&rsquo;s already a {match.display_name} here. Is that someone else?</>
          )}
        </div>
      )}
      <div className="mt-3 flex gap-2">
        {onCancel && (
          <Button variant="ghost" onClick={onCancel} className="flex-1">
            Cancel
          </Button>
        )}
        <Button
          type="submit"
          disabled={busy || !name.trim() || Boolean(exact && match?.is_claimed)}
          className="flex-[2]"
        >
          {match && !match.is_claimed && name.trim() ? "No, I'm new" : "Continue"}
        </Button>
      </div>
    </form>
  );
}

function KeepIdentity({
  name,
  busy,
  onGuest,
  onGoogleSignedIn,
  onBeforeRedirect,
  onBack,
}: {
  name: string;
  busy: boolean;
  onGuest: () => void;
  onGoogleSignedIn: () => void;
  onBeforeRedirect: () => void;
  onBack: () => void;
}) {
  return (
    <section className="mt-9 animate-rise">
      <button
        type="button"
        onClick={onBack}
        className="-ml-1 inline-flex items-center gap-1 text-[15px] font-semibold text-muted"
      >
        <BackIcon className="size-4" /> Not {name}?
      </button>
      <h2 className="mt-3 font-display text-2xl font-bold tracking-tight">Hi {name}!</h2>
      <p className="mt-1 text-muted">How should we remember you?</p>

      <Button onClick={onGuest} disabled={busy} className="mt-6 w-full min-h-15 text-[18px]">
        {busy ? "Joining…" : "Continue as guest"}
      </Button>
      <p className="mt-2 text-center text-sm text-muted">
        Saved on this device. Nothing else needed.
      </p>

      <div className="my-6 flex items-center gap-3 text-sm text-muted">
        <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
      </div>

      <GoogleButton onSignedIn={onGoogleSignedIn} beforeRedirect={onBeforeRedirect} />
      <p className="mt-2 text-center text-sm text-muted">
        See all your events in one place and use any device. Nobody else in the event ever sees
        your email.
      </p>
    </section>
  );
}

function MissingName({ creator, auth }: { creator?: string; auth: AuthState }) {
  return (
    <details className="group mt-8 rounded-2xl bg-soft px-4 py-3 text-[15px]">
      <summary className="cursor-pointer list-none font-semibold marker:hidden">
        Don&rsquo;t see your name?
      </summary>
      <div className="mt-2 space-y-2 text-muted">
        <p>
          If you joined before on another phone or cleared your browser, your name is still taken
          by that old device. Ask {creator ?? "the event creator"} to release your spot from your
          name&rsquo;s menu, then tap your name here. All your items will still be there.
        </p>
        {googleSignInEnabled && !auth.user && (
          <div className="space-y-3">
            <p>Used Google last time? Sign in and you&rsquo;ll be back automatically.</p>
            <GoogleButton />
          </div>
        )}
      </div>
    </details>
  );
}
