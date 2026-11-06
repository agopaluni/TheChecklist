-- TheChecklist schema.
--
-- The browser never reads these tables directly. Every read and write goes through the
-- security definer functions below, which enforce the claim rules. Anyone who knows an
-- event's slug can read and edit it; nobody can list events they don't belong to.
--
-- Identity is kept out of the public rows: `participants` only says whether a spot is
-- claimed. Who claimed it (a hashed guest device token or a Supabase auth user id) lives
-- in `claims`, which no client can select.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.events (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  date date,
  location text check (char_length(location) <= 120),
  note text check (char_length(note) <= 1000),
  created_by uuid, -- participant id of the event creator
  created_at timestamptz not null default now()
);

create table public.participants (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 40),
  is_claimed boolean not null default false, -- kept in sync with `claims` by a trigger
  created_at timestamptz not null default now()
);

create index participants_event_id_idx on public.participants (event_id);
-- Two people called "sam" in one event would make the "Who are you?" list ambiguous.
create unique index participants_event_name_key
  on public.participants (event_id, lower(btrim(display_name)));

create table public.claims (
  -- Primary key on participant: a person can be claimed exactly once. Two simultaneous
  -- claims race on this key and the loser gets a unique violation, so claiming is atomic.
  participant_id uuid primary key references public.participants (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  guest_token_hash text, -- sha256 of the device token; the raw token never reaches the db
  user_id uuid references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint claims_has_owner check (guest_token_hash is not null or user_id is not null),
  -- One device token / one account can hold at most one person per event.
  constraint claims_one_per_guest unique (event_id, guest_token_hash),
  constraint claims_one_per_user unique (event_id, user_id)
);

create table public.items (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  quantity text check (char_length(quantity) <= 30),
  note text check (char_length(note) <= 500),
  assigned_to uuid references public.participants (id) on delete set null, -- null = Outstanding
  is_checked boolean not null default false,
  created_by uuid references public.participants (id) on delete set null,
  created_at timestamptz not null default now(),
  position bigint generated always as identity -- keeps pasted lists in the order they were typed
);

create index items_event_id_idx on public.items (event_id);
create index items_assigned_to_idx on public.items (assigned_to);

-- No direct table access for clients.
alter table public.events enable row level security;
alter table public.participants enable row level security;
alter table public.claims enable row level security;
alter table public.items enable row level security;
revoke all on public.events, public.participants, public.claims, public.items
  from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

create function public._sync_is_claimed() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if tg_op = 'INSERT' then
    update participants set is_claimed = true where id = new.participant_id;
  else
    update participants set is_claimed = false where id = old.participant_id;
  end if;
  return null;
end $$;

create trigger claims_sync_is_claimed
  after insert or delete on public.claims
  for each row execute function public._sync_is_claimed();

-- Moving an item to someone else (or back to Outstanding) un-checks it.
create function public._reset_checked() returns trigger
language plpgsql as $$
begin
  if new.assigned_to is distinct from old.assigned_to or new.assigned_to is null then
    new.is_checked := false;
  end if;
  return new;
end $$;

create trigger items_reset_checked
  before update on public.items
  for each row execute function public._reset_checked();

-- Live updates: every change sends a tiny "changed" message on the event's public
-- Realtime broadcast channel. Clients refetch the event when they hear it.
create function public._broadcast_change() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_row jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  -- events rows use their own id; participants and items carry event_id
  v_event uuid := coalesce(v_row->>'event_id', v_row->>'id')::uuid;
begin
  perform realtime.send(
    jsonb_build_object('table', tg_table_name, 'op', tg_op),
    'changed',
    'event:' || v_event::text,
    false
  );
  return null;
end $$;

create trigger events_broadcast after insert or update or delete on public.events
  for each row execute function public._broadcast_change();
create trigger participants_broadcast after insert or update or delete on public.participants
  for each row execute function public._broadcast_change();
create trigger items_broadcast after insert or update or delete on public.items
  for each row execute function public._broadcast_change();

-- ---------------------------------------------------------------------------
-- Helpers (not callable by clients)
-- ---------------------------------------------------------------------------

create function public._hash(p_token text) returns text
language sql immutable as $$
  select case
    when p_token is null or char_length(p_token) < 20 then null
    else encode(sha256(convert_to(p_token, 'UTF8')), 'hex')
  end
$$;

-- The participant the caller has claimed in this event (by Google account or device token).
create function public._me(p_event uuid, p_token text) returns uuid
language sql stable security definer set search_path = public, pg_temp as $$
  select participant_id
  from claims
  where event_id = p_event
    and ((auth.uid() is not null and user_id = auth.uid())
         or guest_token_hash = _hash(p_token))
  order by (user_id is not distinct from auth.uid()) desc
  limit 1
$$;

create function public._require_me(p_event uuid, p_token text) returns uuid
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_me uuid := _me(p_event, p_token);
begin
  if v_me is null then
    raise exception 'not_joined';
  end if;
  return v_me;
end $$;

create function public._require_creator(p_event uuid, p_token text) returns uuid
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_me uuid := _require_me(p_event, p_token);
begin
  if not exists (select 1 from events where id = p_event and created_by = v_me) then
    raise exception 'creator_only';
  end if;
  return v_me;
end $$;

create function public._require_person_in_event(p_participant uuid, p_event uuid) returns void
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if p_participant is not null
     and not exists (select 1 from participants where id = p_participant and event_id = p_event) then
    raise exception 'not_found';
  end if;
end $$;

-- 10 characters from an unambiguous alphabet, drawn from gen_random_uuid()'s random bytes.
create function public._new_slug() returns text
language plpgsql volatile as $$
declare
  chars constant text := 'abcdefghjkmnpqrstuvwxyz23456789';
  bytes bytea := uuid_send(gen_random_uuid());
  s text := '';
  i int;
begin
  -- bytes 6 and 8 carry the uuid version/variant bits, so skip them
  foreach i in array array[0, 1, 2, 3, 4, 5, 9, 10, 11, 12] loop
    s := s || substr(chars, 1 + get_byte(bytes, i) % char_length(chars), 1);
  end loop;
  return s;
end $$;

-- Who claims the spot: the signed-in account if there is one, otherwise the device token.
create function public._claim(p_participant uuid, p_event uuid, p_token text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_constraint text;
begin
  if auth.uid() is null and _hash(p_token) is null then
    raise exception 'no_identity';
  end if;
  if _me(p_event, p_token) is not null then
    raise exception 'already_have_person';
  end if;
  insert into claims (participant_id, event_id, guest_token_hash, user_id)
  values (
    p_participant,
    p_event,
    case when auth.uid() is null then _hash(p_token) end,
    auth.uid()
  );
exception when unique_violation then
  get stacked diagnostics v_constraint = constraint_name;
  if v_constraint = 'claims_pkey' then
    raise exception 'already_claimed';
  end if;
  raise exception 'already_have_person';
end $$;

-- ---------------------------------------------------------------------------
-- Reads
-- ---------------------------------------------------------------------------

create function public.get_event(p_slug text, p_token text default null) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'event', jsonb_build_object(
      'id', e.id, 'slug', e.slug, 'name', e.name, 'date', e.date,
      'location', e.location, 'note', e.note, 'created_by', e.created_by,
      'created_at', e.created_at
    ),
    'participants', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'display_name', p.display_name,
        'is_claimed', p.is_claimed, 'created_at', p.created_at
      ) order by p.created_at, p.id)
      from participants p where p.event_id = e.id
    ), '[]'::jsonb),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id, 'name', i.name, 'quantity', i.quantity, 'note', i.note,
        'assigned_to', i.assigned_to, 'is_checked', i.is_checked,
        'created_by', i.created_by, 'created_at', i.created_at
      ) order by i.position)
      from items i where i.event_id = e.id
    ), '[]'::jsonb),
    'me', _me(e.id, p_token)
  )
  from events e
  where e.slug = p_slug
$$;

-- Events this device (guest token) or this Google account has joined.
create function public.my_events(p_token text default null) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(jsonb_agg(x order by x->>'date' nulls last, x->>'created_at' desc), '[]'::jsonb)
  from (
    select distinct on (e.id) jsonb_build_object(
      'slug', e.slug, 'name', e.name, 'date', e.date, 'location', e.location,
      'me', p.display_name, 'is_creator', e.created_by = p.id,
      'total', (select count(*) from items i where i.event_id = e.id),
      'ready', (select count(*) from items i where i.event_id = e.id and i.is_checked),
      'created_at', e.created_at
    ) as x
    from claims c
    join participants p on p.id = c.participant_id
    join events e on e.id = c.event_id
    where (auth.uid() is not null and c.user_id = auth.uid())
       or c.guest_token_hash = _hash(p_token)
    order by e.id, (c.user_id is not distinct from auth.uid()) desc
  ) s
$$;

-- ---------------------------------------------------------------------------
-- Events
-- ---------------------------------------------------------------------------

create function public.create_event(
  p_name text,
  p_creator_name text,
  p_token text default null,
  p_date date default null,
  p_location text default null,
  p_note text default null
) returns text
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_event uuid;
  v_person uuid;
  v_slug text;
begin
  loop
    v_slug := _new_slug();
    exit when not exists (select 1 from events where slug = v_slug);
  end loop;

  insert into events (slug, name, date, location, note)
  values (v_slug, btrim(p_name), p_date, nullif(btrim(p_location), ''), nullif(btrim(p_note), ''))
  returning id into v_event;

  insert into participants (event_id, display_name)
  values (v_event, btrim(p_creator_name))
  returning id into v_person;

  perform _claim(v_person, v_event, p_token);
  update events set created_by = v_person where id = v_event;
  return v_slug;
end $$;

create function public.update_event(
  p_event uuid,
  p_token text,
  p_name text,
  p_date date default null,
  p_location text default null,
  p_note text default null
) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform _require_creator(p_event, p_token);
  update events
  set name = btrim(p_name),
      date = p_date,
      location = nullif(btrim(p_location), ''),
      note = nullif(btrim(p_note), '')
  where id = p_event;
end $$;

create function public.delete_event(p_event uuid, p_token text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform _require_creator(p_event, p_token);
  delete from events where id = p_event;
end $$;

-- ---------------------------------------------------------------------------
-- People and claims
-- ---------------------------------------------------------------------------

-- "I'm Priya": claim an existing unclaimed person.
create function public.claim_person(p_participant uuid, p_token text default null) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_event uuid;
begin
  select event_id into v_event from participants where id = p_participant;
  if v_event is null then
    raise exception 'not_found';
  end if;
  perform _claim(p_participant, v_event, p_token);
  return p_participant;
end $$;

-- "I'm someone new": create a person and claim it in one step.
create function public.join_as_new(p_event uuid, p_name text, p_token text default null) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_person uuid;
begin
  if not exists (select 1 from events where id = p_event) then
    raise exception 'not_found';
  end if;
  if _me(p_event, p_token) is not null then
    raise exception 'already_have_person';
  end if;
  begin
    insert into participants (event_id, display_name)
    values (p_event, btrim(p_name))
    returning id into v_person;
  exception when unique_violation then
    raise exception 'name_taken';
  end;
  perform _claim(v_person, p_event, p_token);
  return v_person;
end $$;

-- Add someone who hasn't joined yet (a placeholder).
create function public.add_person(p_event uuid, p_name text, p_token text default null) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_person uuid;
begin
  perform _require_me(p_event, p_token);
  insert into participants (event_id, display_name)
  values (p_event, btrim(p_name))
  returning id into v_person;
  return v_person;
exception when unique_violation then
  raise exception 'name_taken';
end $$;

-- Turn a claimed person back into an unclaimed one. Their items stay put.
-- Allowed for the person themselves, or for the event creator.
create function public.release_person(p_participant uuid, p_token text default null) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_event uuid;
  v_creator uuid;
  v_me uuid;
begin
  select p.event_id, e.created_by into v_event, v_creator
  from participants p join events e on e.id = p.event_id
  where p.id = p_participant;
  if v_event is null then
    raise exception 'not_found';
  end if;
  v_me := _require_me(v_event, p_token);
  if p_participant = v_creator then
    raise exception 'cannot_release_creator';
  end if;
  if v_me <> p_participant and v_me is distinct from v_creator then
    raise exception 'creator_only';
  end if;
  delete from claims where participant_id = p_participant;
end $$;

-- Creator only. Their items go back to Outstanding.
create function public.remove_person(p_participant uuid, p_token text default null) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_event uuid;
  v_me uuid;
begin
  select event_id into v_event from participants where id = p_participant;
  if v_event is null then
    raise exception 'not_found';
  end if;
  v_me := _require_creator(v_event, p_token);
  if v_me = p_participant then
    raise exception 'cannot_remove_self';
  end if;
  delete from participants where id = p_participant;
end $$;

-- After Google sign-in: move this device's guest spots onto the account.
-- If the account already has a different person in one of those events, the account's
-- person wins and the device's guest spot goes back to unclaimed (one person per event).
create function public.link_guest_to_account(p_token text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_hash text := _hash(p_token);
  r record;
  v_linked int := 0;
  v_released int := 0;
begin
  if v_uid is null then
    raise exception 'not_signed_in';
  end if;
  if v_hash is null then
    return jsonb_build_object('linked', 0, 'released', 0);
  end if;
  for r in
    select c.participant_id, c.event_id, e.created_by
    from claims c join events e on e.id = c.event_id
    where c.guest_token_hash = v_hash and c.user_id is null
  loop
    if exists (select 1 from claims where event_id = r.event_id and user_id = v_uid) then
      if r.participant_id is distinct from r.created_by then
        delete from claims where participant_id = r.participant_id;
        v_released := v_released + 1;
      end if;
    else
      update claims set user_id = v_uid, guest_token_hash = null
      where participant_id = r.participant_id;
      v_linked := v_linked + 1;
    end if;
  end loop;
  return jsonb_build_object('linked', v_linked, 'released', v_released);
end $$;

-- ---------------------------------------------------------------------------
-- Items
-- ---------------------------------------------------------------------------

-- Bulk add. p_items is a JSON array of {name, quantity?, note?}.
create function public.add_items(
  p_event uuid,
  p_items jsonb,
  p_assign_to uuid default null,
  p_token text default null
) returns int
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_me uuid := _require_me(p_event, p_token);
  v_count int;
begin
  perform _require_person_in_event(p_assign_to, p_event);
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 200 then
    raise exception 'bad_request';
  end if;
  insert into items (event_id, name, quantity, note, assigned_to, created_by)
  select p_event, btrim(x.item->>'name'), nullif(btrim(x.item->>'quantity'), ''),
         nullif(btrim(x.item->>'note'), ''), p_assign_to, v_me
  from jsonb_array_elements(p_items) with ordinality as x(item, n)
  where nullif(btrim(x.item->>'name'), '') is not null
  order by x.n;
  get diagnostics v_count = row_count;
  return v_count;
end $$;

create function public.update_item(
  p_item uuid,
  p_token text,
  p_name text,
  p_quantity text default null,
  p_note text default null
) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_event uuid;
begin
  select event_id into v_event from items where id = p_item;
  if v_event is null then
    raise exception 'not_found';
  end if;
  perform _require_me(v_event, p_token);
  update items
  set name = btrim(p_name),
      quantity = nullif(btrim(p_quantity), ''),
      note = nullif(btrim(p_note), '')
  where id = p_item;
end $$;

-- Give an item to anyone in the event, or back to Outstanding (null).
create function public.assign_item(p_item uuid, p_assign_to uuid, p_token text default null) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_event uuid;
begin
  select event_id into v_event from items where id = p_item;
  if v_event is null then
    raise exception 'not_found';
  end if;
  perform _require_me(v_event, p_token);
  perform _require_person_in_event(p_assign_to, v_event);
  update items set assigned_to = p_assign_to where id = p_item;
end $$;

-- "I'll bring this": only succeeds if the item is still Outstanding, so two people
-- tapping at once can't both get it.
create function public.take_item(p_item uuid, p_token text default null) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_event uuid;
  v_me uuid;
begin
  select event_id into v_event from items where id = p_item;
  if v_event is null then
    raise exception 'not_found';
  end if;
  v_me := _require_me(v_event, p_token);
  update items set assigned_to = v_me where id = p_item and assigned_to is null;
  if not found then
    raise exception 'item_taken';
  end if;
end $$;

-- Only the person responsible can check an item off.
create function public.set_item_checked(p_item uuid, p_checked boolean, p_token text default null) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_event uuid;
  v_me uuid;
begin
  select event_id into v_event from items where id = p_item;
  if v_event is null then
    raise exception 'not_found';
  end if;
  v_me := _require_me(v_event, p_token);
  update items set is_checked = p_checked where id = p_item and assigned_to = v_me;
  if not found then
    raise exception 'not_yours';
  end if;
end $$;

-- The event creator, or whoever added the item.
create function public.delete_item(p_item uuid, p_token text default null) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_event uuid;
  v_added_by uuid;
  v_me uuid;
begin
  select event_id, created_by into v_event, v_added_by from items where id = p_item;
  if v_event is null then
    raise exception 'not_found';
  end if;
  v_me := _require_me(v_event, p_token);
  if v_me is distinct from v_added_by
     and not exists (select 1 from events where id = v_event and created_by = v_me) then
    raise exception 'creator_only';
  end if;
  delete from items where id = p_item;
end $$;

-- ---------------------------------------------------------------------------
-- Function privileges
-- ---------------------------------------------------------------------------

revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function
  public.get_event(text, text),
  public.my_events(text),
  public.create_event(text, text, text, date, text, text),
  public.update_event(uuid, text, text, date, text, text),
  public.delete_event(uuid, text),
  public.claim_person(uuid, text),
  public.join_as_new(uuid, text, text),
  public.add_person(uuid, text, text),
  public.release_person(uuid, text),
  public.remove_person(uuid, text),
  public.link_guest_to_account(text),
  public.add_items(uuid, jsonb, uuid, text),
  public.update_item(uuid, text, text, text, text),
  public.assign_item(uuid, uuid, text),
  public.take_item(uuid, text),
  public.set_item_checked(uuid, boolean, text),
  public.delete_item(uuid, text)
to anon, authenticated;
