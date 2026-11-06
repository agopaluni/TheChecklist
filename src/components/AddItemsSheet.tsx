"use client";

import { useState, type RefObject } from "react";
import { api } from "@/lib/api";
import { formatDay, parseItemLines } from "@/lib/text";
import type { EventData, Item, NewItem } from "@/lib/types";
import { AddPersonForm } from "./AddPersonSheet";
import type { Run } from "./EventScreen";
import { ListIcon, PlusIcon } from "./icons";
import { Sheet } from "./Sheet";
import { Button } from "./ui";

let tempId = 0;

export function AddItemsSheet({
  open,
  onClose,
  data,
  assignee,
  onAssigneeChange,
  inputRef,
  run,
  days,
  day,
  onDayChange,
}: {
  open: boolean;
  onClose: () => void;
  data: EventData;
  assignee: string | null;
  onAssigneeChange: (id: string | null) => void;
  inputRef: RefObject<HTMLInputElement | null>;
  run: Run;
  days: string[];
  day: string | null;
  onDayChange: (day: string | null) => void;
}) {
  const { event, participants, me } = data;
  const [text, setText] = useState("");
  const [listMode, setListMode] = useState(false);
  const [list, setList] = useState("");
  const [newPerson, setNewPerson] = useState(false);
  // What was added while the sheet is open, remembered per person and day, so the
  // "Added 3 for Alexis" summary only ever lists Alexis's items for the chosen day.
  const [added, setAdded] = useState<{ id: number; name: string; for: string | null; day: string | null }[]>([]);
  const shown = added.filter((a) => a.for === assignee && a.day === day);

  const target = participants.find((p) => p.id === assignee);

  function pickDay(d: string | null) {
    onDayChange(d);
    if (!listMode) inputRef.current?.focus();
  }

  // Picking who it's for shouldn't drop the keyboard: put focus straight back in the field.
  function pickAssignee(id: string | null) {
    onAssigneeChange(id);
    if (!listMode) inputRef.current?.focus();
  }
  const targetLabel = !assignee ? "Outstanding" : assignee === me ? "you" : target?.display_name;

  function add(newItems: NewItem[]) {
    if (newItems.length === 0) return;
    setAdded((a) => [
      ...newItems.map((i) => ({ id: ++tempId, name: i.name, for: assignee, day })).reverse(),
      ...a,
    ]);
    const optimistic: Item[] = newItems.map((i) => ({
      id: `temp-${++tempId}`,
      name: i.name,
      quantity: i.quantity ?? null,
      note: null,
      day,
      assigned_to: assignee,
      is_checked: false,
      created_by: me,
      created_at: new Date().toISOString(),
    }));
    run(
      () => api.addItems(event.id, newItems, assignee, day),
      (d) => ({ ...d, items: [...d.items, ...optimistic] }),
    );
  }

  function close() {
    setAdded([]);
    setNewPerson(false);
    onClose();
  }

  const listItems = parseItemLines(list);

  return (
    <Sheet
      open={open}
      onClose={close}
      title="Add items"
      footer={
        listMode ? (
          <Button
            className="w-full"
            disabled={listItems.length === 0}
            onClick={() => {
              add(listItems);
              setList("");
              close();
            }}
          >
            {listItems.length === 0
              ? "Add items"
              : `Add ${listItems.length} ${listItems.length === 1 ? "item" : "items"} for ${targetLabel}`}
          </Button>
        ) : undefined
      }
    >
      {/* Who it's for */}
      <p className="text-[13px] font-bold tracking-[0.12em] text-muted uppercase">For</p>
      <div className="scrollbar-none -mx-5 mt-2 flex gap-2 overflow-x-auto px-5 pb-1 lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0">
        <Chip active={assignee === me} onClick={() => pickAssignee(me)}>
          Me
        </Chip>
        <Chip active={!assignee} onClick={() => pickAssignee(null)}>
          Outstanding
        </Chip>
        {participants
          .filter((p) => p.id !== me)
          .map((p) => (
            <Chip key={p.id} active={assignee === p.id} onClick={() => pickAssignee(p.id)}>
              {p.display_name}
            </Chip>
          ))}
        <Chip active={false} onClick={() => setNewPerson(true)} dashed>
          + New person
        </Chip>
      </div>
      <p className="mt-2 text-sm text-muted">
        {!assignee
          ? "Unassigned, so anyone can grab them."
          : assignee === me
            ? "You're bringing these."
            : `${target?.display_name} is bringing these.`}
      </p>

      {days.length > 0 && (
        <>
          <p className="mt-4 text-[13px] font-bold tracking-[0.12em] text-muted uppercase">Which day</p>
          <div className="scrollbar-none -mx-5 mt-2 flex gap-2 overflow-x-auto px-5 pb-1 lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0">
            <Chip active={!day} onClick={() => pickDay(null)}>
              Whole event
            </Chip>
            {days.map((d) => (
              <Chip key={d} active={day === d} onClick={() => pickDay(d)}>
                {formatDay(d)}
              </Chip>
            ))}
          </div>
        </>
      )}

      {newPerson && (
        <div className="mt-4 rounded-2xl border border-line p-4">
          <p className="mb-2 text-[15px] font-semibold">Who else is coming?</p>
          <AddPersonForm
            data={data}
            run={run}
            onAdded={(id) => {
              setNewPerson(false);
              onAssigneeChange(id);
              requestAnimationFrame(() => inputRef.current?.focus());
            }}
            onCancel={() => setNewPerson(false)}
          />
        </div>
      )}

      {/* Quick add: Enter adds and keeps the keyboard up. Pasting several lines adds them all. */}
      <div className={newPerson ? "hidden" : ""}>
        {listMode ? (
          <textarea
            autoFocus
            value={list}
            onChange={(e) => setList(e.target.value)}
            rows={7}
            className="field mt-4 resize-none leading-relaxed"
            placeholder={"One item per line\nTent\nHeadlamps x4\nMarshmallows"}
            aria-label="Items, one per line"
          />
        ) : (
          <form
            className="mt-4 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              add(parseItemLines(text));
              setText("");
              inputRef.current?.focus();
            }}
          >
            <input
              ref={inputRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onPaste={(e) => {
                const pasted = e.clipboardData.getData("text");
                if (pasted.includes("\n")) {
                  e.preventDefault();
                  add(parseItemLines(pasted));
                }
              }}
              className="field"
              placeholder="Add an item, then press enter"
              aria-label="Item name"
              enterKeyHint="enter"
              autoComplete="off"
              maxLength={140}
            />
            <button
              type="submit"
              disabled={!text.trim()}
              onMouseDown={(e) => e.preventDefault()}
              className="grid size-[3.2rem] shrink-0 place-items-center rounded-2xl bg-accent text-accent-ink disabled:opacity-40"
              aria-label="Add item"
            >
              <PlusIcon />
            </button>
          </form>
        )}

        <div className="mt-2 flex items-center justify-between">
          <p className="text-sm text-muted">
            {listMode ? "Paste or type a whole list." : 'Tip: "Ice x3" sets a quantity.'}
          </p>
          <button
            type="button"
            onClick={() => setListMode((m) => !m)}
            className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-sm font-semibold text-accent"
          >
            <ListIcon className="size-4" /> {listMode ? "One at a time" : "Add a list"}
          </button>
        </div>

        {shown.length > 0 && (
          <div className="mt-4">
            <p className="text-sm font-semibold text-muted">
              Added {shown.length} for {targetLabel}
              {day ? ` on ${formatDay(day)}` : ""}
            </p>
            <ul className="mt-1.5 flex flex-wrap gap-1.5">
              {shown.slice(0, 30).map((a) => (
                <li key={a.id} className="animate-rise rounded-full bg-soft px-3 py-1 text-[14px]">
                  {a.name}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Sheet>
  );
}

function Chip({
  active,
  onClick,
  dashed,
  children,
}: {
  active: boolean;
  onClick: () => void;
  dashed?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseDown={(e) => e.preventDefault()} // keep focus (and the keyboard) in the item field
      aria-pressed={active}
      className={`min-h-10 shrink-0 rounded-full px-4 text-[15px] font-semibold whitespace-nowrap transition ${
        active
          ? "bg-ink text-paper"
          : dashed
            ? "border border-dashed border-line text-muted"
            : "border border-line bg-card"
      }`}
    >
      {children}
    </button>
  );
}
