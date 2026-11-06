"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useRef, useState } from "react";
import { flushSync } from "react-dom";
import { api } from "@/lib/api";
import type { AuthState } from "@/lib/auth";
import { formatDate } from "@/lib/text";
import type { EventData, Item, Participant } from "@/lib/types";
import { AddItemsSheet } from "./AddItemsSheet";
import { AddPersonSheet } from "./AddPersonSheet";
import { EventMenu } from "./EventMenu";
import type { Run } from "./EventScreen";
import { BackIcon, CheckIcon, MoreIcon, PlusIcon, ShareIcon } from "./icons";
import { ItemSheet } from "./ItemSheet";
import { PersonSheet } from "./PersonSheet";
import { Avatar, Button, ProgressBar, useToast } from "./ui";

export function EventView({
  data,
  run,
  auth,
  offline,
}: {
  data: EventData;
  run: Run;
  auth: AuthState;
  offline: boolean;
}) {
  const { event, participants, items, me } = data;
  const toast = useToast();
  const router = useRouter();
  const isNew = useSearchParams().get("new") === "1";
  const isCreator = event.created_by === me;

  const [mineOnly, setMineOnly] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addFor, setAddFor] = useState<string | null>(me);
  const [addingPerson, setAddingPerson] = useState(false);
  const [itemId, setItemId] = useState<string | null>(null);
  const [personId, setPersonId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const addInput = useRef<HTMLInputElement>(null);

  // Open the quick-add sheet and focus its field in the same tap, so the keyboard comes up.
  function openAdd(assignTo: string | null = addFor) {
    flushSync(() => {
      setAddFor(assignTo);
      setAdding(true);
      setPersonId(null);
    });
    addInput.current?.focus();
  }

  const people = [...participants].sort((a, b) =>
    a.id === me ? -1 : b.id === me ? 1 : a.created_at.localeCompare(b.created_at),
  );
  const outstanding = items.filter((i) => !i.assigned_to);
  const ready = items.filter((i) => i.is_checked).length;
  const mine = items.filter((i) => i.assigned_to === me);
  const meName = participants.find((p) => p.id === me)?.display_name ?? "";

  async function share() {
    const url = `${location.origin}/e/${event.slug}`;
    const text = `Here's the list for ${event.name}. Tap your name and grab something to bring.`;
    if (navigator.share) {
      try {
        await navigator.share({ title: event.name, text, url });
      } catch {}
      return;
    }
    await navigator.clipboard.writeText(url);
    toast("Link copied");
  }

  const take = (item: Item) =>
    run(
      () => api.takeItem(item.id),
      (d) => ({
        ...d,
        items: d.items.map((i) => (i.id === item.id ? { ...i, assigned_to: me } : i)),
      }),
    );
  const toggle = (item: Item) =>
    run(
      () => api.setItemChecked(item.id, !item.is_checked),
      (d) => ({
        ...d,
        items: d.items.map((i) => (i.id === item.id ? { ...i, is_checked: !i.is_checked } : i)),
      }),
    );

  const when = [formatDate(event.date), event.location].filter(Boolean).join(" · ");
  const openItem = items.find((i) => i.id === itemId) ?? null;
  const openPerson = participants.find((p) => p.id === personId) ?? null;

  return (
    <div className="mx-auto w-full max-w-xl">
      <header className="sticky top-0 z-20 flex items-center gap-1 bg-paper/90 px-2 pt-[max(0.5rem,env(safe-area-inset-top))] pb-1 backdrop-blur">
        <Link href="/" className="grid size-11 place-items-center rounded-full hover:bg-soft" aria-label="All events">
          <BackIcon />
        </Link>
        <span className="flex-1" />
        <button type="button" onClick={share} className="grid size-11 place-items-center rounded-full hover:bg-soft" aria-label="Share link">
          <ShareIcon />
        </button>
        <button type="button" onClick={() => setMenuOpen(true)} className="grid size-11 place-items-center rounded-full hover:bg-soft" aria-label="Event menu">
          <MoreIcon />
        </button>
      </header>

      <main className="px-5 pb-36">
        <h1 className="font-display text-[2.1rem] leading-[1.05] font-extrabold tracking-tight text-balance">
          {event.name}
        </h1>
        {when && <p className="mt-1 text-[17px] text-muted">{when}</p>}
        {event.note && <p className="mt-3 whitespace-pre-line text-[16px] leading-relaxed">{event.note}</p>}

        {isNew && (
          <div className="animate-rise mt-5 rounded-2xl bg-accent-soft p-4">
            <p className="font-semibold">Send this to everyone</p>
            <p className="mt-0.5 text-[15px] text-muted">
              Anyone with the link can join, pick their name and grab things to bring.
            </p>
            <div className="mt-3 flex gap-2">
              <Button onClick={share} className="min-h-11 flex-1 text-[15px]">
                <ShareIcon className="size-4" /> Share link
              </Button>
              <Button
                variant="secondary"
                onClick={() => router.replace(`/e/${event.slug}`, { scroll: false })}
                className="min-h-11 text-[15px]"
              >
                Later
              </Button>
            </div>
          </div>
        )}

        {/* Overall progress + filter */}
        <div className="mt-6">
          <div className="flex items-baseline justify-between">
            <p className="text-[15px] font-semibold">
              {items.length === 0 ? "Nothing on the list yet" : `${ready} of ${items.length} ready`}
            </p>
            {outstanding.length > 0 && (
              <p className="text-sm font-medium text-accent">{outstanding.length} need someone</p>
            )}
          </div>
          <div className="mt-2">
            <ProgressBar ready={ready} total={items.length} />
          </div>
          <div className="mt-4 inline-flex rounded-full bg-soft p-1" role="tablist">
            {[
              ["Everyone", false],
              [`My items${mine.length ? ` · ${mine.length}` : ""}`, true],
            ].map(([label, value]) => (
              <button
                key={String(value)}
                type="button"
                role="tab"
                aria-selected={mineOnly === value}
                onClick={() => setMineOnly(value as boolean)}
                className={`min-h-10 rounded-full px-4 text-[15px] font-semibold transition ${mineOnly === value ? "bg-card shadow-sm" : "text-muted"}`}
              >
                {label as string}
              </button>
            ))}
          </div>
        </div>

        {items.length === 0 && !mineOnly && (
          <div className="mt-6 rounded-2xl border border-dashed border-line px-5 py-7 text-center">
            <p className="font-semibold">Start with what&rsquo;s needed.</p>
            <p className="mt-1 text-[15px] text-muted">
              Tents, snacks, the speaker. Leave things unassigned and people can grab them.
            </p>
            <Button onClick={() => openAdd(null)} className="mt-4 min-h-11 text-[15px]">
              <PlusIcon className="size-4" /> Add the first items
            </Button>
          </div>
        )}

        {!mineOnly && items.length > 0 && (
          <section className="mt-7" aria-labelledby="outstanding">
            <div className="flex items-center gap-2">
              <h2 id="outstanding" className="text-[13px] font-bold tracking-[0.12em] text-accent uppercase">
                Outstanding
              </h2>
              <span className="text-[13px] font-bold text-accent">{outstanding.length || ""}</span>
            </div>
            {outstanding.length === 0 ? (
              <p className="mt-2 text-[15px] text-muted">Everything has someone. Nice.</p>
            ) : (
              <ul className="mt-1 divide-y divide-line">
                {outstanding.map((item) => (
                  <ItemRow key={item.id} item={item} onOpen={() => setItemId(item.id)}>
                    <button
                      type="button"
                      onClick={() => take(item)}
                      disabled={offline}
                      className="shrink-0 rounded-full bg-accent px-3.5 py-2 text-[14px] font-bold text-accent-ink active:scale-95 disabled:opacity-50"
                    >
                      I&rsquo;ll bring this
                    </button>
                  </ItemRow>
                ))}
              </ul>
            )}
          </section>
        )}

        {people
          .filter((p) => !mineOnly || p.id === me)
          .map((p) => (
            <PersonSection
              key={p.id}
              person={p}
              items={items.filter((i) => i.assigned_to === p.id)}
              you={p.id === me}
              outstandingCount={outstanding.length}
              onMenu={() => setPersonId(p.id)}
              onOpenItem={(i) => setItemId(i.id)}
              onToggle={toggle}
              onAdd={() => openAdd(p.id)}
            />
          ))}

        {mineOnly && outstanding.length > 0 && (
          <button type="button" onClick={() => setMineOnly(false)} className="mt-6 text-[15px] font-semibold text-accent">
            {outstanding.length} {outstanding.length === 1 ? "thing still needs" : "things still need"} someone &rarr;
          </button>
        )}

        {!mineOnly && (
          <button
            type="button"
            onClick={() => setAddingPerson(true)}
            className="mt-8 flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-line text-[15px] font-semibold text-muted hover:border-accent hover:text-ink"
          >
            <PlusIcon className="size-4" /> Add someone who hasn&rsquo;t joined yet
          </button>
        )}
      </main>

      {/* Bottom-anchored primary action */}
      <div className="bottom-safe fixed inset-x-0 bottom-0 z-30 bg-gradient-to-t from-paper via-paper/95 to-transparent px-5 pt-6">
        <div className="mx-auto max-w-xl">
          <Button onClick={() => openAdd()} disabled={offline} className="min-h-14 w-full text-[18px]">
            <PlusIcon /> Add items
          </Button>
        </div>
      </div>

      <AddItemsSheet
        open={adding}
        onClose={() => setAdding(false)}
        data={data}
        assignee={addFor}
        onAssigneeChange={setAddFor}
        inputRef={addInput}
        run={run}
      />
      <AddPersonSheet open={addingPerson} onClose={() => setAddingPerson(false)} data={data} run={run} />
      <ItemSheet
        item={openItem}
        data={data}
        isCreator={isCreator}
        run={run}
        onClose={() => setItemId(null)}
      />
      <PersonSheet
        person={openPerson}
        data={data}
        isCreator={isCreator}
        run={run}
        onClose={() => setPersonId(null)}
        onAddFor={(id) => openAdd(id)}
      />
      <EventMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        data={data}
        meName={meName}
        isCreator={isCreator}
        auth={auth}
        run={run}
        onShare={share}
      />
    </div>
  );
}

function PersonSection({
  person,
  items,
  you,
  outstandingCount,
  onMenu,
  onOpenItem,
  onToggle,
  onAdd,
}: {
  person: Participant;
  items: Item[];
  you: boolean;
  outstandingCount: number;
  onMenu: () => void;
  onOpenItem: (i: Item) => void;
  onToggle: (i: Item) => void;
  onAdd: () => void;
}) {
  const ready = items.filter((i) => i.is_checked).length;
  return (
    <section className="mt-8">
      <div className="flex items-center gap-3">
        <Avatar name={person.display_name} you={you} />
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-display text-[19px] leading-tight font-bold tracking-tight">
            {person.display_name}
            {you && <span className="ml-2 align-middle text-[12px] font-bold tracking-wider text-accent uppercase">You</span>}
          </h2>
          {!person.is_claimed && <p className="text-[13px] text-muted">Hasn&rsquo;t joined yet</p>}
        </div>
        {items.length > 0 && (
          <span className={`text-[15px] font-semibold tabular-nums ${ready === items.length ? "text-accent" : "text-muted"}`}>
            {ready}/{items.length}
          </span>
        )}
        <button type="button" onClick={onMenu} className="-mr-2 grid size-10 place-items-center rounded-full text-muted hover:bg-soft" aria-label={`Options for ${person.display_name}`}>
          <MoreIcon />
        </button>
      </div>
      {items.length > 0 && (
        <div className="mt-2.5 pl-12">
          <ProgressBar ready={ready} total={items.length} />
        </div>
      )}
      {items.length > 0 ? (
        <ul className="mt-1 divide-y divide-line pl-12">
          {items.map((item) => (
            <ItemRow key={item.id} item={item} onOpen={() => onOpenItem(item)}>
              <CheckButton item={item} canCheck={you} onToggle={() => onToggle(item)} />
            </ItemRow>
          ))}
        </ul>
      ) : (
        <p className="mt-1.5 pl-12 text-[15px] text-muted">
          {you
            ? outstandingCount > 0
              ? "Nothing yet. Grab something from Outstanding, or "
              : "Nothing yet. "
            : "Nothing yet. "}
          <button type="button" onClick={onAdd} className="font-semibold text-ink underline decoration-line underline-offset-4">
            {you ? "add your own" : `add some for ${person.display_name}`}
          </button>
        </p>
      )}
    </section>
  );
}

function ItemRow({
  item,
  onOpen,
  children,
}: {
  item: Item;
  onOpen: () => void;
  children: React.ReactNode;
}) {
  const pending = item.id.startsWith("temp-");
  return (
    <li className={`flex min-h-14 items-center gap-3 py-2 ${pending ? "opacity-60" : ""}`}>
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 py-1 text-left">
        <span className={`text-[17px] leading-snug ${item.is_checked ? "text-muted line-through decoration-2" : ""}`}>
          {item.name}
        </span>
        {item.quantity && (
          <span className="ml-2 rounded-md bg-soft px-1.5 py-0.5 align-[1px] text-[13px] font-semibold text-muted">
            &times;{item.quantity}
          </span>
        )}
        {item.note && <span className="mt-0.5 block truncate text-[14px] text-muted">{item.note}</span>}
      </button>
      {children}
    </li>
  );
}

function CheckButton({
  item,
  canCheck,
  onToggle,
}: {
  item: Item;
  canCheck: boolean;
  onToggle: () => void;
}) {
  const label = item.is_checked ? `${item.name}: ready` : `${item.name}: not ready yet`;
  if (!canCheck) {
    return (
      <span
        className={`grid size-8 shrink-0 place-items-center rounded-full ${item.is_checked ? "bg-soft text-muted" : "border-2 border-line"}`}
        aria-label={label}
        title={item.is_checked ? "Ready" : "Not ready yet"}
      >
        {item.is_checked && <CheckIcon />}
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={onToggle}
      role="checkbox"
      aria-checked={item.is_checked}
      aria-label={item.is_checked ? `Uncheck ${item.name}` : `Check off ${item.name}`}
      className="-m-2 grid size-12 shrink-0 place-items-center rounded-full"
    >
      <span
        key={String(item.is_checked)}
        className={`grid size-8 place-items-center rounded-full transition ${item.is_checked ? "animate-pop bg-accent text-accent-ink" : "border-2 border-muted/60"}`}
      >
        {item.is_checked && <CheckIcon />}
      </span>
    </button>
  );
}
