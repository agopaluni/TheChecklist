"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useRef, useState } from "react";
import { flushSync } from "react-dom";
import { api } from "@/lib/api";
import type { AuthState } from "@/lib/auth";
import { eventDays, formatDay, formatWhen } from "@/lib/text";
import type { EventData, Item, Participant } from "@/lib/types";
import { AddItemsSheet } from "./AddItemsSheet";
import { AddPersonSheet } from "./AddPersonSheet";
import { EventMenu } from "./EventMenu";
import type { Run } from "./EventScreen";
import { BackIcon, CheckIcon, MoreIcon, PlusIcon, ShareIcon } from "./icons";
import { ItemSheet } from "./ItemSheet";
import { PersonSheet } from "./PersonSheet";
import { Avatar, Button, ProgressBar, useToast } from "./ui";
import { Wordmark } from "./Wordmark";

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
  const { event, participants, items: allItems, me } = data;
  const toast = useToast();
  const router = useRouter();
  const isNew = useSearchParams().get("new") === "1";
  const isCreator = event.created_by === me;

  const [mineOnly, setMineOnly] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addFor, setAddFor] = useState<string | null>(me);
  const [day, setDay] = useState<string | null>(null); // null = all days
  const [addDay, setAddDay] = useState<string | null>(null);
  const [addingPerson, setAddingPerson] = useState(false);
  const [itemId, setItemId] = useState<string | null>(null);
  const [personId, setPersonId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const addInput = useRef<HTMLInputElement>(null);

  // Open the quick-add sheet and focus its field in the same tap, so the keyboard comes up.
  function openAdd(assignTo: string | null = addFor) {
    flushSync(() => {
      setAddFor(assignTo);
      setAddDay(activeDay);
      setAdding(true);
      setPersonId(null);
    });
    addInput.current?.focus();
  }

  const people = [...participants].sort((a, b) =>
    a.id === me ? -1 : b.id === me ? 1 : a.created_at.localeCompare(b.created_at),
  );
  // Multi-day events get a tab per day; a day's tab shows only that day's list.
  const days = eventDays(event.date, event.end_date);
  const activeDay = day && days.includes(day) ? day : null;
  const items = activeDay ? allItems.filter((i) => i.day === activeDay) : allItems;
  const dayTag = (item: Item) => (!activeDay && item.day ? formatDay(item.day) : null);

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

  const when = [formatWhen(event.date, event.end_date), event.location].filter(Boolean).join(" · ");
  const openItem = allItems.find((i) => i.id === itemId) ?? null;
  const openPerson = participants.find((p) => p.id === personId) ?? null;

  const dayTabs = days.length > 0 && (
    <div
      className="scrollbar-none -mx-5 mt-5 flex gap-2 overflow-x-auto px-5 lg:mx-0 lg:mt-7 lg:flex-col lg:gap-1 lg:overflow-visible lg:px-0"
      role="tablist"
      aria-label="Days"
    >
      <p className="hidden text-[12px] font-bold tracking-[0.12em] text-muted uppercase lg:mb-1 lg:block">Days</p>
      {[null, ...days].map((d) => {
        const count = d ? allItems.filter((i) => i.day === d).length : allItems.length;
        const active = activeDay === d;
        return (
          <button
            key={d ?? "all"}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => setDay(d)}
            className={`flex min-h-11 shrink-0 flex-col items-center justify-center rounded-2xl px-4 leading-tight transition lg:min-h-10 lg:flex-row lg:justify-between lg:rounded-xl lg:px-3 ${active ? "bg-ink text-paper" : "border border-line bg-card lg:border-transparent lg:bg-transparent lg:hover:bg-soft"}`}
          >
            <span className="text-[15px] font-semibold whitespace-nowrap">{d ? formatDay(d) : "All days"}</span>
            <span className={`text-[12px] lg:text-[13px] ${active ? "opacity-70" : "text-muted"}`}>
              {count} <span className="lg:hidden">{count === 1 ? "item" : "items"}</span>
            </span>
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-xl lg:max-w-6xl lg:px-8">
      <header className="sticky top-0 z-20 flex items-center gap-1 bg-paper/90 px-2 pt-[max(0.5rem,env(safe-area-inset-top))] pb-1 backdrop-blur lg:-mx-8 lg:mb-6 lg:px-8 lg:py-4">
        <Link href="/" className="grid size-11 place-items-center rounded-full hover:bg-soft lg:hidden" aria-label="All events">
          <BackIcon />
        </Link>
        <Link href="/" className="hidden rounded-xl px-1 py-1 lg:block" aria-label="All events">
          <Wordmark />
        </Link>
        <span className="flex-1" />
        <button type="button" onClick={share} className="grid size-11 place-items-center rounded-full hover:bg-soft lg:flex lg:w-auto lg:gap-2 lg:px-4 lg:text-[15px] lg:font-semibold" aria-label="Share link">
          <ShareIcon /> <span className="hidden lg:inline">Share</span>
        </button>
        <button type="button" onClick={() => setMenuOpen(true)} className="grid size-11 place-items-center rounded-full hover:bg-soft" aria-label="Event menu">
          <MoreIcon />
        </button>
      </header>

      <div className="lg:grid lg:grid-cols-[18.5rem_minmax(0,1fr)] lg:gap-12">
        {/* Sidebar on desktop; the top of the page on phones */}
        <aside className="px-5 lg:sticky lg:top-24 lg:max-h-[calc(100dvh-7rem)] lg:self-start lg:overflow-y-auto lg:px-0 lg:pb-8">
          <h1 className="font-display text-[2.1rem] leading-[1.05] font-extrabold tracking-tight text-balance lg:text-[2.2rem]">
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

          <div className="lg:hidden">{dayTabs}</div>

          {/* Overall progress + filter */}
          <div className="mt-6 lg:mt-7 lg:rounded-2xl lg:border lg:border-line lg:bg-card lg:p-4">
            <div className="flex items-baseline justify-between">
              <p className="text-[15px] font-semibold">
                {items.length === 0
                  ? activeDay
                    ? `Nothing for ${formatDay(activeDay)} yet`
                    : "Nothing on the list yet"
                  : `${ready} of ${items.length} ready${activeDay ? ` on ${formatDay(activeDay)}` : ""}`}
              </p>
              {outstanding.length > 0 && (
                <p className="text-sm font-medium text-accent">{outstanding.length} need someone</p>
              )}
            </div>
            <div className="mt-2">
              <ProgressBar ready={ready} total={items.length} />
            </div>
            <div className="mt-4 inline-flex rounded-full bg-soft p-1 lg:flex" role="tablist">
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
                  className={`min-h-10 rounded-full px-4 text-[15px] font-semibold transition lg:flex-1 ${mineOnly === value ? "bg-card shadow-sm" : "text-muted"}`}
                >
                  {label as string}
                </button>
              ))}
            </div>
          </div>

          <div className="hidden lg:block">{dayTabs}</div>

          {/* Desktop: actions and the roster live in the sidebar */}
          <div className="mt-7 hidden gap-2 lg:flex">
            <Button onClick={() => openAdd()} disabled={offline} className="min-h-12 flex-1 text-[16px]">
              <PlusIcon className="size-4" /> Add items
            </Button>
            <Button variant="secondary" onClick={() => setAddingPerson(true)} className="min-h-12 px-4 text-[16px]" aria-label="Add someone">
              <PlusIcon className="size-4" /> Person
            </Button>
          </div>
          <div className="mt-7 hidden lg:block">
            <p className="mb-1 text-[12px] font-bold tracking-[0.12em] text-muted uppercase">People</p>
            <ul>
              {people.map((p) => {
                const theirs = items.filter((i) => i.assigned_to === p.id);
                const done = theirs.filter((i) => i.is_checked).length;
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setMineOnly(false);
                        requestAnimationFrame(() =>
                          document.getElementById(`person-${p.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }),
                        );
                      }}
                      className="flex min-h-10 w-full items-center gap-2.5 rounded-xl px-2 text-left hover:bg-soft"
                    >
                      <span className={`size-2 shrink-0 rounded-full ${p.is_claimed ? "bg-accent" : "border border-muted"}`} aria-hidden />
                      <span className="flex-1 truncate text-[15px] font-medium">
                        {p.display_name}
                        {p.id === me && <span className="ml-1.5 text-[12px] font-bold text-accent uppercase">You</span>}
                      </span>
                      <span className={`text-[13px] tabular-nums ${theirs.length && done === theirs.length ? "font-semibold text-accent" : "text-muted"}`}>
                        {theirs.length ? `${done}/${theirs.length}` : "–"}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <p className="mt-2 px-2 text-[12px] text-muted">
              <span className="mr-1 inline-block size-2 rounded-full bg-accent align-middle" /> joined
              <span className="mr-1 ml-3 inline-block size-2 rounded-full border border-muted align-middle" /> not yet
            </p>
          </div>
        </aside>

        <main className="px-5 pb-36 lg:px-0 lg:pb-16">
          {items.length === 0 && !mineOnly && (
            <div className="mt-6 rounded-2xl border border-dashed border-line px-5 py-7 text-center lg:mt-0 lg:rounded-3xl lg:py-16">
              {activeDay ? (
                <>
                  <p className="font-semibold">Nothing just for {formatDay(activeDay)}.</p>
                  <p className="mt-1 text-[15px] text-muted">
                    Add things only needed that day, like Saturday&rsquo;s dinner.
                  </p>
                </>
              ) : (
                <>
                  <p className="font-semibold">Start with what&rsquo;s needed.</p>
                  <p className="mt-1 text-[15px] text-muted">
                    Tents, snacks, the speaker. Leave things unassigned and people can grab them.
                  </p>
                </>
              )}
              <Button onClick={() => openAdd(null)} className="mt-4 min-h-11 text-[15px]">
                <PlusIcon className="size-4" /> {activeDay ? `Add items for ${formatDay(activeDay)}` : "Add the first items"}
              </Button>
            </div>
          )}

          {!mineOnly && items.length > 0 && (
            <section
              className="mt-7 lg:mt-0 lg:mb-6 lg:rounded-3xl lg:border lg:border-accent/25 lg:bg-accent-soft/40 lg:px-6 lg:py-5"
              aria-labelledby="outstanding"
            >
              <div className="flex items-center gap-2">
                <h2 id="outstanding" className="text-[13px] font-bold tracking-[0.12em] text-accent uppercase">
                  Outstanding
                </h2>
                <span className="text-[13px] font-bold text-accent">{outstanding.length || ""}</span>
              </div>
              {outstanding.length === 0 ? (
                <p className="mt-2 text-[15px] text-muted">Everything has someone. Nice.</p>
              ) : (
                <ul className="mt-1 divide-y divide-line lg:grid lg:grid-cols-2 lg:gap-x-10 lg:divide-y-0">
                  {outstanding.map((item) => (
                    <ItemRow key={item.id} item={item} tag={dayTag(item)} onOpen={() => setItemId(item.id)}>
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

          <div className="lg:columns-2 lg:gap-6">
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
                  dayTag={dayTag}
                />
              ))}
          </div>

          {mineOnly && outstanding.length > 0 && (
            <button type="button" onClick={() => setMineOnly(false)} className="mt-6 text-[15px] font-semibold text-accent">
              {outstanding.length} {outstanding.length === 1 ? "thing still needs" : "things still need"} someone &rarr;
            </button>
          )}

          {!mineOnly && (
            <button
              type="button"
              onClick={() => setAddingPerson(true)}
              className="mt-8 flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-line text-[15px] font-semibold text-muted hover:border-accent hover:text-ink lg:hidden"
            >
              <PlusIcon className="size-4" /> Add someone who hasn&rsquo;t joined yet
            </button>
          )}
        </main>
      </div>

      {/* Bottom-anchored primary action (phones; desktop has it in the sidebar) */}
      <div className="bottom-safe fixed inset-x-0 bottom-0 z-30 bg-gradient-to-t from-paper via-paper/95 to-transparent px-5 pt-6 lg:hidden">
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
        days={days}
        day={addDay}
        onDayChange={setAddDay}
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
  dayTag,
}: {
  person: Participant;
  items: Item[];
  you: boolean;
  outstandingCount: number;
  onMenu: () => void;
  onOpenItem: (i: Item) => void;
  onToggle: (i: Item) => void;
  onAdd: () => void;
  dayTag: (item: Item) => string | null;
}) {
  const ready = items.filter((i) => i.is_checked).length;
  return (
    <section
      id={`person-${person.id}`}
      className="mt-8 scroll-mt-24 lg:mt-0 lg:mb-6 lg:break-inside-avoid lg:rounded-3xl lg:border lg:border-line lg:bg-card lg:p-5"
    >
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
        <div className="mt-2.5 pl-12 lg:pl-0">
          <ProgressBar ready={ready} total={items.length} />
        </div>
      )}
      {items.length > 0 ? (
        <ul className="mt-1 divide-y divide-line pl-12 lg:pl-0">
          {items.map((item) => (
            <ItemRow key={item.id} item={item} tag={dayTag(item)} onOpen={() => onOpenItem(item)}>
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
  tag,
  onOpen,
  children,
}: {
  item: Item;
  tag?: string | null;
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
        {tag && (
          <span className="ml-2 rounded-md bg-accent-soft px-1.5 py-0.5 align-[1px] text-[12px] font-bold text-accent">
            {tag}
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
