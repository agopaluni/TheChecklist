-- Moving to a new web address. Browsers keep localStorage per address, so a guest who
-- claimed a name on the old address has a different device token on the new one. The old
-- address forwards its token to the new site, which calls this to take those claims over.
--
-- For each event the old token is in:
--   - if this device isn't anyone there yet, the claim simply moves to this device;
--   - if it is, one person per event still holds: the creator's spot wins, otherwise the
--     older claim (the original identity) wins, and the other spot is released with its
--     items intact.

create function public.adopt_guest_token(p_old_token text, p_token text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_old text := _hash(p_old_token);
  v_new text := _hash(p_token);
  r record;
  v_existing record;
  v_moved int := 0;
  v_released int := 0;
begin
  if v_old is null or v_new is null or v_old = v_new then
    return jsonb_build_object('moved', 0, 'released', 0);
  end if;

  for r in
    select c.participant_id, c.event_id, c.created_at, e.created_by
    from claims c join events e on e.id = c.event_id
    where c.guest_token_hash = v_old and c.user_id is null
  loop
    select c.participant_id, c.created_at into v_existing
    from claims c where c.event_id = r.event_id and c.guest_token_hash = v_new;

    if found then
      if v_existing.participant_id = r.created_by
         or (r.participant_id is distinct from r.created_by and v_existing.created_at <= r.created_at) then
        -- keep this device's current person; the old one goes back on the list
        delete from claims where participant_id = r.participant_id;
        v_released := v_released + 1;
        continue;
      end if;
      delete from claims where participant_id = v_existing.participant_id;
      v_released := v_released + 1;
    end if;

    update claims set guest_token_hash = v_new where participant_id = r.participant_id;
    v_moved := v_moved + 1;
  end loop;

  return jsonb_build_object('moved', v_moved, 'released', v_released);
end $$;

revoke execute on function public.adopt_guest_token(text, text) from public;
grant execute on function public.adopt_guest_token(text, text) to anon, authenticated;
