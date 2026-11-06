-- Multi-day events and per-day items.
--
-- events.date is the first day; events.end_date (optional) the last. An item can be
-- pinned to one day of the event with items.day; null means "the whole event".

alter table public.events
  add column end_date date,
  add constraint events_date_range check (
    end_date is null or (date is not null and end_date > date and end_date - date <= 30)
  );

alter table public.items add column day date;

-- A day must fall inside its event's dates.
create function public._require_day_in_event(p_day date, p_event uuid) returns void
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if p_day is not null and not exists (
    select 1 from events
    where id = p_event and end_date is not null and p_day between date and end_date
  ) then
    raise exception 'bad_day';
  end if;
end $$;

revoke execute on function public._require_day_in_event(date, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Reads: include end_date and item days
-- ---------------------------------------------------------------------------

create or replace function public.get_event(p_slug text, p_token text default null) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'event', jsonb_build_object(
      'id', e.id, 'slug', e.slug, 'name', e.name, 'date', e.date, 'end_date', e.end_date,
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
        'id', i.id, 'name', i.name, 'quantity', i.quantity, 'note', i.note, 'day', i.day,
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

create or replace function public.my_events(p_token text default null) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(jsonb_agg(x order by x->>'date' nulls last, x->>'created_at' desc), '[]'::jsonb)
  from (
    select distinct on (e.id) jsonb_build_object(
      'slug', e.slug, 'name', e.name, 'date', e.date, 'end_date', e.end_date,
      'location', e.location,
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
-- Events: take an optional end date
-- ---------------------------------------------------------------------------

drop function public.create_event(text, text, text, date, text, text);
create function public.create_event(
  p_name text,
  p_creator_name text,
  p_token text default null,
  p_date date default null,
  p_location text default null,
  p_note text default null,
  p_end_date date default null
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

  insert into events (slug, name, date, end_date, location, note)
  values (
    v_slug, btrim(p_name), p_date,
    case when p_end_date > p_date then p_end_date end, -- same day = single-day event
    nullif(btrim(p_location), ''), nullif(btrim(p_note), '')
  )
  returning id into v_event;

  insert into participants (event_id, display_name)
  values (v_event, btrim(p_creator_name))
  returning id into v_person;

  perform _claim(v_person, v_event, p_token);
  update events set created_by = v_person where id = v_event;
  return v_slug;
end $$;

drop function public.update_event(uuid, text, text, date, text, text);
create function public.update_event(
  p_event uuid,
  p_token text,
  p_name text,
  p_date date default null,
  p_location text default null,
  p_note text default null,
  p_end_date date default null
) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_end date := case when p_end_date > p_date then p_end_date end;
begin
  perform _require_creator(p_event, p_token);
  update events
  set name = btrim(p_name),
      date = p_date,
      end_date = v_end,
      location = nullif(btrim(p_location), ''),
      note = nullif(btrim(p_note), '')
  where id = p_event;
  -- Items pinned to days that are no longer part of the event go back to "whole event".
  update items set day = null
  where event_id = p_event
    and day is not null
    and (v_end is null or day not between p_date and v_end);
end $$;

-- ---------------------------------------------------------------------------
-- Items: optional day
-- ---------------------------------------------------------------------------

drop function public.add_items(uuid, jsonb, uuid, text);
create function public.add_items(
  p_event uuid,
  p_items jsonb,
  p_assign_to uuid default null,
  p_token text default null,
  p_day date default null
) returns int
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_me uuid := _require_me(p_event, p_token);
  v_count int;
begin
  perform _require_person_in_event(p_assign_to, p_event);
  perform _require_day_in_event(p_day, p_event);
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 200 then
    raise exception 'bad_request';
  end if;
  insert into items (event_id, name, quantity, note, day, assigned_to, created_by)
  select p_event, btrim(x.item->>'name'), nullif(btrim(x.item->>'quantity'), ''),
         nullif(btrim(x.item->>'note'), ''), p_day, p_assign_to, v_me
  from jsonb_array_elements(p_items) with ordinality as x(item, n)
  where nullif(btrim(x.item->>'name'), '') is not null
  order by x.n;
  get diagnostics v_count = row_count;
  return v_count;
end $$;

-- Move an item to a day of the event, or back to the whole event (null).
create function public.set_item_day(p_item uuid, p_day date, p_token text default null) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_event uuid;
begin
  select event_id into v_event from items where id = p_item;
  if v_event is null then
    raise exception 'not_found';
  end if;
  perform _require_me(v_event, p_token);
  perform _require_day_in_event(p_day, v_event);
  update items set day = p_day where id = p_item;
end $$;

revoke execute on function
  public.create_event(text, text, text, date, text, text, date),
  public.update_event(uuid, text, text, date, text, text, date),
  public.add_items(uuid, jsonb, uuid, text, date),
  public.set_item_day(uuid, date, text)
from public;

grant execute on function
  public.create_event(text, text, text, date, text, text, date),
  public.update_event(uuid, text, text, date, text, text, date),
  public.add_items(uuid, jsonb, uuid, text, date),
  public.set_item_day(uuid, date, text)
to anon, authenticated;
