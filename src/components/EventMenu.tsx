"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";
import { signInWithGoogle, signOut, type AuthState } from "@/lib/auth";
import { googleSignInEnabled } from "@/lib/supabase";
import type { EventData } from "@/lib/types";
import type { Run } from "./EventScreen";
import { GoogleIcon } from "./icons";
import { Sheet, SheetAction } from "./Sheet";
import { Button } from "./ui";

export function EventMenu({
  open,
  onClose,
  data,
  meName,
  isCreator,
  auth,
  run,
  onShare,
}: {
  open: boolean;
  onClose: () => void;
  data: EventData;
  meName: string;
  isCreator: boolean;
  auth: AuthState;
  run: Run;
  onShare: () => void;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const { event, me } = data;

  function close() {
    setEditing(false);
    onClose();
  }

  return (
    <Sheet open={open} onClose={close} title={editing ? "Edit event" : event.name}>
      {editing ? (
        <EditEvent data={data} run={run} onDone={close} />
      ) : (
        <div className="-mx-4">
          <p className="mb-2 px-4 text-[15px] text-muted">
            You&rsquo;re <strong className="text-ink">{meName}</strong>
            {isCreator ? ", and you started this event." : "."}
          </p>
          <SheetAction
            onClick={() => {
              close();
              onShare();
            }}
            hint="Anyone with the link can join and edit the list."
          >
            Share link
          </SheetAction>
          {isCreator && <SheetAction onClick={() => setEditing(true)}>Edit name, date, place or note</SheetAction>}

          {googleSignInEnabled &&
            (auth.user ? (
              <SheetAction
                hint={`You'll need to sign in again to be ${meName} on this device.`}
                onClick={async () => {
                  close();
                  await signOut();
                }}
              >
                Sign out of Google
              </SheetAction>
            ) : (
              <button
                type="button"
                onClick={() => signInWithGoogle()}
                className="flex w-full items-start gap-3 rounded-2xl px-4 py-3.5 text-left hover:bg-soft"
              >
                <GoogleIcon className="mt-0.5 size-5 shrink-0" />
                <span>
                  <span className="block text-[17px] font-semibold">Sign in with Google</span>
                  <span className="mt-0.5 block text-sm text-muted">
                    Keep being {meName} on any device and see all your events in one place.
                  </span>
                </span>
              </button>
            ))}

          {!isCreator && me && (
            <SheetAction
              hint={`Your items stay with ${meName}.`}
              onClick={() => {
                if (!confirm(`Stop being ${meName} on this device?`)) return;
                close();
                run(() => api.releasePerson(me));
              }}
            >
              Switch person
            </SheetAction>
          )}

          {isCreator && (
            <SheetAction
              tone="danger"
              hint="Removes the list for everyone. This can't be undone."
              onClick={async () => {
                if (!confirm(`Delete "${event.name}" for everyone?`)) return;
                const ok = await run(() => api.deleteEvent(event.id));
                if (ok) {
                  localStorage.removeItem(`tc:event:${event.slug}`);
                  router.replace("/");
                }
              }}
            >
              Delete event
            </SheetAction>
          )}
        </div>
      )}
    </Sheet>
  );
}

function EditEvent({ data, run, onDone }: { data: EventData; run: Run; onDone: () => void }) {
  const { event } = data;
  const [busy, setBusy] = useState(false);
  const [start, setStart] = useState(event.date ?? "");

  async function save(form: FormData) {
    const fields = {
      name: String(form.get("name") ?? "").trim(),
      date: String(form.get("date") ?? "") || null,
      end_date: String(form.get("end_date") ?? "") || null,
      location: String(form.get("location") ?? "").trim() || null,
      note: String(form.get("note") ?? "").trim() || null,
    };
    if (!fields.name) return;
    setBusy(true);
    const ok = await run(
      () => api.updateEvent(event.id, fields),
      (d) => ({ ...d, event: { ...d.event, ...fields } }),
    );
    setBusy(false);
    if (ok) onDone();
  }

  return (
    <form action={save} className="space-y-4">
      <label className="block">
        <span className="mb-1 block text-sm font-semibold">Name</span>
        <input name="name" defaultValue={event.name} required maxLength={80} className="field" />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">When</span>
          <input
            name="date"
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="field min-h-[3.2rem]"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Until</span>
          <input
            name="end_date"
            type="date"
            defaultValue={event.end_date ?? ""}
            min={start || undefined}
            disabled={!start}
            className="field min-h-[3.2rem] disabled:opacity-50"
          />
        </label>
      </div>
      <label className="block">
        <span className="mb-1 block text-sm font-semibold">Where</span>
        <input name="location" defaultValue={event.location ?? ""} maxLength={120} className="field" />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-semibold">Note</span>
        <textarea name="note" defaultValue={event.note ?? ""} rows={3} maxLength={1000} className="field resize-none" />
      </label>
      <Button type="submit" disabled={busy} className="w-full">
        Save
      </Button>
    </form>
  );
}
