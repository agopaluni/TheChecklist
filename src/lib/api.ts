import { deviceToken, takeHandoffToken } from "./identity";
import { supabase } from "./supabase";
import type { EventData, MyEvent, NewItem } from "./types";

// Error codes raised by the Postgres functions, in words people can act on.
const MESSAGES: Record<string, string> = {
  already_claimed: "Someone just picked that name. Choose another one.",
  already_have_person:
    "You're already someone else in this event. Switch person from the menu first.",
  name_taken: "There's already someone with that name. Add a last initial?",
  not_joined: "Pick who you are first.",
  creator_only: "Only the event creator can do that.",
  cannot_release_creator: "The event creator's spot can't be released.",
  cannot_remove_self: "You can't remove yourself from your own event.",
  item_taken: "Someone else just took that one.",
  not_yours: "Only the person bringing it can check it off.",
  not_found: "That's gone. It may have just been removed.",
  bad_day: "That day isn't part of the event any more.",
  no_identity: "Something went wrong saving who you are. Try reloading.",
};

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export function isOfflineError(e: unknown) {
  return e instanceof ApiError && e.code === "offline";
}

// Before the first request: if we came from an old address, take over the people this
// browser had claimed there, so nobody has to pick their name again.
let handoff: Promise<unknown> | null = null;
function finishHandoff(): Promise<unknown> {
  handoff ??= (async () => {
    const old = takeHandoffToken();
    if (!old) return;
    await supabase()
      .rpc("adopt_guest_token", { p_old_token: old, p_token: deviceToken() })
      .then(({ error }) => {
        if (error) console.warn("Couldn't bring over your old guest spots", error.message);
      });
  })();
  return handoff;
}

async function call<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  await finishHandoff();
  const { data, error } = await supabase().rpc(fn, { ...args, p_token: deviceToken() });
  if (error) {
    // supabase-js reports network failures as a TypeError-ish message with no code
    const offline = !error.code && /fetch|network|load failed/i.test(error.message);
    if (offline) throw new ApiError("offline", "You're offline. Try again when you're back.");
    throw new ApiError(error.message, MESSAGES[error.message] ?? "Something went wrong.");
  }
  return data as T;
}

export const api = {
  getEvent: (slug: string) => call<EventData | null>("get_event", { p_slug: slug }),
  myEvents: () => call<MyEvent[]>("my_events"),

  createEvent: (e: {
    name: string;
    creatorName: string;
    date?: string | null;
    endDate?: string | null;
    location?: string | null;
    note?: string | null;
  }) =>
    call<string>("create_event", {
      p_name: e.name,
      p_creator_name: e.creatorName,
      p_date: e.date || null,
      p_end_date: e.endDate || null,
      p_location: e.location || null,
      p_note: e.note || null,
    }),
  updateEvent: (
    eventId: string,
    e: {
      name: string;
      date: string | null;
      end_date: string | null;
      location: string | null;
      note: string | null;
    },
  ) =>
    call<void>("update_event", {
      p_event: eventId,
      p_name: e.name,
      p_date: e.date || null,
      p_end_date: e.end_date || null,
      p_location: e.location,
      p_note: e.note,
    }),
  deleteEvent: (eventId: string) => call<void>("delete_event", { p_event: eventId }),

  claimPerson: (participantId: string) =>
    call<string>("claim_person", { p_participant: participantId }),
  joinAsNew: (eventId: string, name: string) =>
    call<string>("join_as_new", { p_event: eventId, p_name: name }),
  addPerson: (eventId: string, name: string) =>
    call<string>("add_person", { p_event: eventId, p_name: name }),
  releasePerson: (participantId: string) =>
    call<void>("release_person", { p_participant: participantId }),
  removePerson: (participantId: string) =>
    call<void>("remove_person", { p_participant: participantId }),
  linkGuestToAccount: () => call<{ linked: number; released: number }>("link_guest_to_account"),

  addItems: (eventId: string, items: NewItem[], assignTo: string | null, day: string | null) =>
    call<number>("add_items", {
      p_event: eventId,
      p_items: items,
      p_assign_to: assignTo,
      p_day: day,
    }),
  setItemDay: (itemId: string, day: string | null) =>
    call<void>("set_item_day", { p_item: itemId, p_day: day }),
  updateItem: (itemId: string, i: { name: string; quantity: string | null; note: string | null }) =>
    call<void>("update_item", {
      p_item: itemId,
      p_name: i.name,
      p_quantity: i.quantity,
      p_note: i.note,
    }),
  assignItem: (itemId: string, assignTo: string | null) =>
    call<void>("assign_item", { p_item: itemId, p_assign_to: assignTo }),
  takeItem: (itemId: string) => call<void>("take_item", { p_item: itemId }),
  setItemChecked: (itemId: string, checked: boolean) =>
    call<void>("set_item_checked", { p_item: itemId, p_checked: checked }),
  deleteItem: (itemId: string) => call<void>("delete_item", { p_item: itemId }),
};
