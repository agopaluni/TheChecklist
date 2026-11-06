"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { closeMatch } from "@/lib/text";
import type { EventData } from "@/lib/types";
import type { Run } from "./EventScreen";
import { Sheet } from "./Sheet";
import { Button } from "./ui";

export function AddPersonSheet({
  open,
  onClose,
  data,
  run,
}: {
  open: boolean;
  onClose: () => void;
  data: EventData;
  run: Run;
}) {
  return (
    <Sheet open={open} onClose={onClose} title="Add someone">
      <p className="mb-4 text-[15px] text-muted">
        Add people who haven&rsquo;t opened the link yet, so you can give them things to bring.
        They&rsquo;ll tap their name when they join.
      </p>
      {open && <AddPersonForm data={data} run={run} onAdded={onClose} />}
    </Sheet>
  );
}

// Shared by the "Add someone" sheet and the "New person" option when adding items.
export function AddPersonForm({
  data,
  run,
  onAdded,
  onCancel,
}: {
  data: EventData;
  run: Run;
  onAdded: (participantId: string) => void;
  onCancel?: () => void;
}) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const match = name.trim() ? closeMatch(name, data.participants) : null;
  const exact = match && match.display_name.trim().toLowerCase() === name.trim().toLowerCase();
  const nearMatch = match && !exact;

  async function submit() {
    const n = name.trim();
    if (!n || exact) return;
    setBusy(true);
    let id = "";
    const ok = await run(async () => {
      id = await api.addPerson(data.event.id, n);
    });
    setBusy(false);
    if (ok) {
      setName("");
      onAdded(id);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={40}
        className="field"
        placeholder="First name"
        autoComplete="off"
        enterKeyHint="done"
        aria-label="Their first name"
      />
      {match && (
        <p className="mt-2.5 rounded-xl bg-accent-soft px-3 py-2.5 text-[15px]">
          {exact ? (
            <>{match.display_name} is already on the list.</>
          ) : (
            <>
              Did you mean <strong>{match.display_name}</strong>? They&rsquo;re already on the
              list. Adding someone else?
            </>
          )}
        </p>
      )}
      <div className="mt-3 flex gap-2">
        {onCancel && (
          <Button variant="ghost" onClick={onCancel} className="flex-1">
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={busy || !name.trim() || Boolean(exact)} className="flex-[2]">
          {nearMatch ? `Add ${name.trim()} anyway` : "Add"}
        </Button>
      </div>
    </form>
  );
}
