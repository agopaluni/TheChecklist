// Server-side rule tests. They call the same RPCs the app uses, against a running
// Supabase (local by default). Run with: npm run test:db
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secret = process.env.SUPABASE_SECRET_KEY;
assert.ok(key, "Set NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (see .env.local)");

const client = () =>
  createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const anon = client();
const token = () => randomUUID() + randomUUID();

async function rpc(fn, args, c = anon) {
  const { data, error } = await c.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data;
}
async function rejects(promise, code) {
  await assert.rejects(promise, (e) => e.message === code, `expected ${code}`);
}
async function newEvent(creatorToken) {
  const slug = await rpc("create_event", {
    p_name: "Test camping",
    p_creator_name: "Organizer",
    p_token: creatorToken,
  });
  const data = await rpc("get_event", { p_slug: slug, p_token: creatorToken });
  return { slug, event: data.event, me: data.me };
}
const people = async (slug) => (await rpc("get_event", { p_slug: slug })).participants;

test("tables are not readable directly", async () => {
  for (const table of ["events", "participants", "claims", "items"]) {
    const { data, error } = await anon.from(table).select("*").limit(1);
    assert.ok(error || data.length === 0, `${table} should not be readable`);
  }
});

test("creating an event claims the creator's spot", async () => {
  const t = token();
  const { slug, event, me } = await newEvent(t);
  assert.equal(event.created_by, me);
  const list = await people(slug);
  assert.equal(list.length, 1);
  assert.equal(list[0].is_claimed, true);
  assert.equal(list[0].guest_token_hash, undefined, "no identity fields leak");
});

test("a claimed person can't be claimed again", async () => {
  const creator = token();
  const { event } = await newEvent(creator);
  const priya = await rpc("add_person", { p_event: event.id, p_name: "Priya", p_token: creator });
  await rpc("claim_person", { p_participant: priya, p_token: token() });
  await rejects(rpc("claim_person", { p_participant: priya, p_token: token() }), "already_claimed");
});

test("two people tapping the same name at once: exactly one wins", async () => {
  const creator = token();
  const { event } = await newEvent(creator);
  const sam = await rpc("add_person", { p_event: event.id, p_name: "Sam", p_token: creator });
  const results = await Promise.allSettled(
    Array.from({ length: 8 }, () => rpc("claim_person", { p_participant: sam, p_token: token() })),
  );
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  for (const r of results.filter((r) => r.status === "rejected")) {
    assert.equal(r.reason.message, "already_claimed");
  }
});

test("one device can claim only one person per event", async () => {
  const creator = token();
  const { event } = await newEvent(creator);
  const a = await rpc("add_person", { p_event: event.id, p_name: "Ana", p_token: creator });
  const b = await rpc("add_person", { p_event: event.id, p_name: "Ben", p_token: creator });
  const guest = token();
  await rpc("claim_person", { p_participant: a, p_token: guest });
  await rejects(rpc("claim_person", { p_participant: b, p_token: guest }), "already_have_person");
  await rejects(
    rpc("join_as_new", { p_event: event.id, p_name: "Cy", p_token: guest }),
    "already_have_person",
  );
  // ...until they release their current person.
  await rpc("release_person", { p_participant: a, p_token: guest });
  await rpc("claim_person", { p_participant: b, p_token: guest });
});

test("release keeps items and makes the spot claimable again", async () => {
  const creator = token();
  const { slug, event } = await newEvent(creator);
  const guest = token();
  const marcus = await rpc("join_as_new", { p_event: event.id, p_name: "Marcus", p_token: guest });
  await rpc("add_items", {
    p_event: event.id,
    p_items: [{ name: "Tent" }, { name: "Lantern", quantity: "2" }],
    p_assign_to: marcus,
    p_token: guest,
  });
  await rpc("release_person", { p_participant: marcus, p_token: guest });
  const data = await rpc("get_event", { p_slug: slug, p_token: guest });
  assert.equal(data.me, null);
  assert.equal(data.participants.find((p) => p.id === marcus).is_claimed, false);
  assert.equal(data.items.filter((i) => i.assigned_to === marcus).length, 2);
  await rpc("claim_person", { p_participant: marcus, p_token: token() });
});

test("only the creator can release someone else", async () => {
  const creator = token();
  const { event } = await newEvent(creator);
  const g1 = token();
  const g2 = token();
  const p1 = await rpc("join_as_new", { p_event: event.id, p_name: "One", p_token: g1 });
  await rpc("join_as_new", { p_event: event.id, p_name: "Two", p_token: g2 });
  await rejects(rpc("release_person", { p_participant: p1, p_token: g2 }), "creator_only");
  await rpc("release_person", { p_participant: p1, p_token: creator });
  await rejects(rpc("release_person", { p_participant: p1, p_token: g1 }), "not_joined");
});

test("names are unique per event, case-insensitively", async () => {
  const creator = token();
  const { event } = await newEvent(creator);
  await rpc("add_person", { p_event: event.id, p_name: "Priya", p_token: creator });
  await rejects(
    rpc("add_person", { p_event: event.id, p_name: " priya ", p_token: creator }),
    "name_taken",
  );
});

test("Outstanding items: take is atomic, unclaim sends back, check needs owner", async () => {
  const creator = token();
  const { event, me: organizer } = await newEvent(creator);
  const g = token();
  const guest = await rpc("join_as_new", { p_event: event.id, p_name: "Gail", p_token: g });
  await rpc("add_items", { p_event: event.id, p_items: [{ name: "Ice" }], p_token: g });
  const { items } = await rpc("get_event", { p_slug: event.slug });
  const ice = items[0];
  assert.equal(ice.assigned_to, null);

  await rejects(rpc("set_item_checked", { p_item: ice.id, p_checked: true, p_token: g }), "not_yours");
  await rpc("take_item", { p_item: ice.id, p_token: g });
  await rejects(rpc("take_item", { p_item: ice.id, p_token: creator }), "item_taken");
  await rejects(
    rpc("set_item_checked", { p_item: ice.id, p_checked: true, p_token: creator }),
    "not_yours",
  );
  await rpc("set_item_checked", { p_item: ice.id, p_checked: true, p_token: g });
  let after = (await rpc("get_event", { p_slug: event.slug })).items[0];
  assert.equal(after.assigned_to, guest);
  assert.equal(after.is_checked, true);

  await rpc("assign_item", { p_item: ice.id, p_assign_to: null, p_token: g });
  after = (await rpc("get_event", { p_slug: event.slug })).items[0];
  assert.equal(after.assigned_to, null);
  assert.equal(after.is_checked, false, "moving an item un-checks it");
  assert.ok(organizer);
});

test("bulk-added items keep their order", async () => {
  const creator = token();
  const { slug, event } = await newEvent(creator);
  const names = ["Tent", "Headlamps", "Camp stove", "Ice", "Firewood", "Water", "Map"];
  await rpc("add_items", {
    p_event: event.id,
    p_items: names.map((name) => ({ name })),
    p_token: creator,
  });
  const { items } = await rpc("get_event", { p_slug: slug });
  assert.deepEqual(items.map((i) => i.name), names);
});

test("removing a person sends their items to Outstanding", async () => {
  const creator = token();
  const { event } = await newEvent(creator);
  const dana = await rpc("add_person", { p_event: event.id, p_name: "Dana", p_token: creator });
  await rpc("add_items", {
    p_event: event.id,
    p_items: [{ name: "Chips" }],
    p_assign_to: dana,
    p_token: creator,
  });
  const g = token();
  await rpc("join_as_new", { p_event: event.id, p_name: "Eve", p_token: g });
  await rejects(rpc("remove_person", { p_participant: dana, p_token: g }), "creator_only");
  await rpc("remove_person", { p_participant: dana, p_token: creator });
  const data = await rpc("get_event", { p_slug: event.slug });
  assert.equal(data.participants.some((p) => p.id === dana), false);
  assert.equal(data.items[0].assigned_to, null);
});

test("writes need an identity in the event", async () => {
  const { event } = await newEvent(token());
  await rejects(
    rpc("add_items", { p_event: event.id, p_items: [{ name: "x" }], p_token: token() }),
    "not_joined",
  );
  await rejects(rpc("delete_event", { p_event: event.id, p_token: token() }), "not_joined");
});

test("Google merge moves guest spots onto the account", { skip: !secret }, async () => {
  const admin = createClient(url, secret, { auth: { persistSession: false } });
  const email = `test-${randomUUID()}@example.test`;
  const password = randomUUID();
  const { error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  assert.ifError(createError);
  const user = client();
  const { error: signInError } = await user.auth.signInWithPassword({ email, password });
  assert.ifError(signInError);

  const creator = token();
  const { event } = await newEvent(creator);
  const deviceA = token();
  const priya = await rpc("join_as_new", { p_event: event.id, p_name: "Priya", p_token: deviceA });

  // Signing in on device A merges the guest spot into the account.
  assert.deepEqual(await rpc("link_guest_to_account", { p_token: deviceA }, user), {
    linked: 1,
    released: 0,
  });
  // A brand new device B, signed in to the same account, gets Priya back automatically.
  const deviceB = token();
  assert.equal((await rpc("get_event", { p_slug: event.slug, p_token: deviceB }, user)).me, priya);
  // The account still can't hold two people in one event.
  const other = await rpc("add_person", { p_event: event.id, p_name: "Other", p_token: creator });
  await rejects(rpc("claim_person", { p_participant: other, p_token: deviceB }, user), "already_have_person");
  // Account events list.
  const mine = await rpc("my_events", { p_token: deviceB }, user);
  assert.ok(mine.some((e) => e.slug === event.slug && e.me === "Priya"));
});
