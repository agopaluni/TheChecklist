"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { eventDays, formatDay } from "@/lib/text";
import type { EventData, Item } from "@/lib/types";
import type { Run } from "./EventScreen";
import { Sheet } from "./Sheet";
import { Button } from "./ui";

export function ItemSheet({
  item,
  data,
  isCreator,
  run,
  onClose,
}: {
  item: Item | null;
  data: EventData;
  isCreator: boolean;
  run: Run;
  onClose: () => void;
}) {
  // Keep showing the last item while the sheet slides away.
  const [shown, setShown] = useState(item);
  if (item && item !== shown) setShown(item);
  return (
    <Sheet open={item !== null} onClose={onClose} title={shown?.name ?? ""}>
      {shown && (
        <ItemDetails key={shown.id} item={shown} data={data} isCreator={isCreator} run={run} onClose={onClose} />
      )}
    </Sheet>
  );
}

function ItemDetails({
  item,
  data,
  isCreator,
  run,
  onClose,
}: {
  item: Item;
  data: EventData;
  isCreator: boolean;
  run: Run;
  onClose: () => void;
}) {
  const { participants, me } = data;
  const [name, setName] = useState(item.name);
  const [quantity, setQuantity] = useState(item.quantity ?? "");
  const [note, setNote] = useState(item.note ?? "");
  const pending = item.id.startsWith("temp-");
  const changed =
    name.trim() !== item.name || quantity.trim() !== (item.quantity ?? "") || note.trim() !== (item.note ?? "");
  const owner = participants.find((p) => p.id === item.assigned_to);
  const mine = item.assigned_to === me;
  const canDelete = isCreator || item.created_by === me;
  const days = eventDays(data.event.date, data.event.end_date);
  const setDay = (day: string | null) =>
    run(
      () => api.setItemDay(item.id, day),
      (d) => ({ ...d, items: d.items.map((i) => (i.id === item.id ? { ...i, day } : i)) }),
    );

  const assign = (to: string | null) =>
    run(
      () => api.assignItem(item.id, to),
      (d) => ({
        ...d,
        items: d.items.map((i) =>
          i.id === item.id ? { ...i, assigned_to: to, is_checked: to === i.assigned_to && i.is_checked } : i,
        ),
      }),
    );

  async function save() {
    const ok = await run(
      () => api.updateItem(item.id, { name: name.trim(), quantity: quantity.trim() || null, note: note.trim() || null }),
      (d) => ({
        ...d,
        items: d.items.map((i) =>
          i.id === item.id ? { ...i, name: name.trim(), quantity: quantity.trim() || null, note: note.trim() || null } : i,
        ),
      }),
    );
    if (ok) onClose();
  }

  return (
    <div className="space-y-5">
      <p className="text-[15px] text-muted">
        {owner ? (
          <>
            <strong className="text-ink">{mine ? "You're" : `${owner.display_name} is`}</strong> bringing this
            {item.is_checked ? " and it's ready." : "."}
          </>
        ) : (
          "Nobody's bringing this yet."
        )}
      </p>

      <div className="flex flex-wrap gap-2">
        {mine && (
          <Button
            onClick={() =>
              run(
                () => api.setItemChecked(item.id, !item.is_checked),
                (d) => ({
                  ...d,
                  items: d.items.map((i) => (i.id === item.id ? { ...i, is_checked: !i.is_checked } : i)),
                }),
              )
            }
            disabled={pending}
            className="min-h-11 text-[15px]"
          >
            {item.is_checked ? "Mark not ready" : "Mark ready"}
          </Button>
        )}
        {!owner && (
          <Button onClick={() => run(() => api.takeItem(item.id)).then((ok) => ok && onClose())} disabled={pending} className="min-h-11 text-[15px]">
            I&rsquo;ll bring this
          </Button>
        )}
        {owner && (
          <Button variant="secondary" onClick={() => assign(null).then(() => onClose())} disabled={pending} className="min-h-11 text-[15px]">
            {mine ? "I can't bring this" : "Back to Outstanding"}
          </Button>
        )}
      </div>

      <div>
        <p className="text-[13px] font-bold tracking-[0.12em] text-muted uppercase">Who&rsquo;s bringing it</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {[...participants].sort((a, b) => Number(b.id === me) - Number(a.id === me)).map((p) => (
            <button
              key={p.id}
              type="button"
              disabled={pending}
              onClick={() => assign(p.id)}
              aria-pressed={item.assigned_to === p.id}
              className={`min-h-10 rounded-full px-4 text-[15px] font-semibold ${item.assigned_to === p.id ? "bg-ink text-paper" : "border border-line"}`}
            >
              {p.id === me ? "Me" : p.display_name}
            </button>
          ))}
        </div>
      </div>

      {days.length > 0 && (
        <div>
          <p className="text-[13px] font-bold tracking-[0.12em] text-muted uppercase">Which day</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {[null, ...days].map((d) => (
              <button
                key={d ?? "whole"}
                type="button"
                disabled={pending}
                onClick={() => setDay(d)}
                aria-pressed={item.day === d}
                className={`min-h-10 rounded-full px-4 text-[15px] font-semibold ${item.day === d ? "bg-ink text-paper" : "border border-line"}`}
              >
                {d ? formatDay(d) : "Whole event"}
              </button>
            ))}
          </div>
        </div>
      )}

      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (changed && name.trim()) save();
        }}
      >
        <div className="grid grid-cols-[1fr_6.5rem] gap-2">
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">Item</span>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} className="field" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">How many</span>
            <input value={quantity} onChange={(e) => setQuantity(e.target.value)} maxLength={30} className="field" placeholder="—" />
          </label>
        </div>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Note</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            maxLength={500}
            className="field resize-none"
            placeholder="Brand, size, anything useful"
          />
        </label>
        {changed && (
          <Button type="submit" disabled={!name.trim() || pending} className="w-full">
            Save changes
          </Button>
        )}
      </form>

      {canDelete && (
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (!confirm(`Delete "${item.name}"?`)) return;
            run(
              () => api.deleteItem(item.id),
              (d) => ({ ...d, items: d.items.filter((i) => i.id !== item.id) }),
            );
            onClose();
          }}
          className="text-[15px] font-semibold text-accent"
        >
          Delete item
        </button>
      )}
    </div>
  );
}
