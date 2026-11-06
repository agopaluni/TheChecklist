"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import type { EventData, Participant } from "@/lib/types";
import type { Run } from "./EventScreen";
import { Sheet, SheetAction } from "./Sheet";

export function PersonSheet({
  person,
  data,
  isCreator,
  run,
  onClose,
  onAddFor,
}: {
  person: Participant | null;
  data: EventData;
  isCreator: boolean;
  run: Run;
  onClose: () => void;
  onAddFor: (participantId: string) => void;
}) {
  const [shown, setShown] = useState(person);
  if (person && person !== shown) setShown(person);
  const p = shown;
  const { me, event } = data;
  const isMe = p?.id === me;
  const isCreatorSpot = p?.id === event.created_by;
  const count = p ? data.items.filter((i) => i.assigned_to === p.id).length : 0;

  return (
    <Sheet open={person !== null} onClose={onClose} title={p ? (isMe ? `${p.display_name} (you)` : p.display_name) : ""}>
      {p && (
        <div className="-mx-4">
          <p className="mb-2 px-4 text-[15px] text-muted">
            {isCreatorSpot ? "Started this event. " : ""}
            {p.is_claimed ? "Joined." : "Hasn't joined yet. They'll see their name when they open the link."}
          </p>

          <SheetAction onClick={() => onAddFor(p.id)}>
            {isMe ? "Add items for me" : `Add items for ${p.display_name}`}
          </SheetAction>

          {isMe && !isCreatorSpot && (
            <SheetAction
              hint={`Your items stay with ${p.display_name}, and the name goes back on the list.`}
              onClick={() => {
                if (!confirm(`Stop being ${p.display_name} on this device?`)) return;
                run(() => api.releasePerson(p.id));
                onClose();
              }}
            >
              I&rsquo;m not {p.display_name}, switch person
            </SheetAction>
          )}

          {isCreator && !isMe && p.is_claimed && (
            <SheetAction
              hint={`For a lost phone or cleared browser. ${p.display_name} can then tap their name again. Items stay put.`}
              onClick={() => {
                if (!confirm(`Release ${p.display_name}'s spot?`)) return;
                run(() => api.releasePerson(p.id));
                onClose();
              }}
            >
              Release {p.display_name}&rsquo;s spot
            </SheetAction>
          )}

          {isCreator && !isMe && (
            <SheetAction
              tone="danger"
              hint={count ? `Their ${count} ${count === 1 ? "item goes" : "items go"} back to Outstanding.` : undefined}
              onClick={() => {
                if (!confirm(`Remove ${p.display_name} from the event?`)) return;
                run(() => api.removePerson(p.id));
                onClose();
              }}
            >
              Remove {p.display_name}
            </SheetAction>
          )}
        </div>
      )}
    </Sheet>
  );
}
