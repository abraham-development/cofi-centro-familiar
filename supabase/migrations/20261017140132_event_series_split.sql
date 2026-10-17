-- =============================================================================
-- «Cambiar esta y las siguientes» en una serie de eventos: se termina la serie
-- en la fecha indicada y se crea la nueva desde esa fecha, en UNA transacción.
-- Las ocurrencias anteriores y las excepciones editadas a mano se conservan.
-- =============================================================================

create or replace function private.split_event_series(
  p_series_id uuid,
  p_from date,
  p_command_id uuid,
  p_title text,
  p_category_id uuid,
  p_is_all_day boolean,
  p_start_time time,
  p_duration_minutes integer,
  p_location text,
  p_description text,
  p_visibility text,
  p_importance text,
  p_whole_family boolean,
  p_participant_ids uuid[],
  p_freq text,
  p_interval integer,
  p_by_weekday smallint[],
  p_month_day smallint,
  p_missing text,
  p_until date
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.event_series;
  v_new uuid;
begin
  select * into s from public.event_series where id = p_series_id;
  if not found or not private.is_family_adult(s.family_id) then
    perform private.raise_domain('NOT_FOUND', 'series');
  end if;
  -- Idempotencia: si el comando ya creó la nueva serie, devolverla.
  select x.id into v_new from public.event_series x where x.family_id = s.family_id and x.command_id = p_command_id;
  if found then
    return v_new;
  end if;

  perform private.end_event_series(p_series_id, p_from, false);
  v_new := private.create_event_series(
    s.family_id, p_command_id, p_title, p_category_id, p_is_all_day, p_start_time, p_duration_minutes,
    p_location, p_description, p_visibility, p_importance, p_whole_family, p_participant_ids,
    p_freq, p_interval, p_by_weekday, p_month_day, p_missing, p_from, p_until);
  perform private.audit(s.family_id, 'event_series.split', 'event_series', v_new,
                        jsonb_build_object('from_series', p_series_id));
  return v_new;
end;
$$;

create or replace function public.split_event_series(
  p_series_id uuid, p_from date, p_command_id uuid, p_title text, p_category_id uuid, p_is_all_day boolean,
  p_start_time time, p_duration_minutes integer, p_location text, p_description text, p_visibility text,
  p_importance text, p_whole_family boolean, p_participant_ids uuid[], p_freq text, p_interval integer,
  p_by_weekday smallint[], p_month_day smallint, p_missing text, p_until date
)
returns uuid language sql security invoker set search_path = '' as $$
  select private.split_event_series(p_series_id, p_from, p_command_id, p_title, p_category_id, p_is_all_day,
    p_start_time, p_duration_minutes, p_location, p_description, p_visibility, p_importance, p_whole_family,
    p_participant_ids, p_freq, p_interval, p_by_weekday, p_month_day, p_missing, p_until);
$$;

revoke all on function private.split_event_series(uuid, date, uuid, text, uuid, boolean, time, integer, text, text,
  text, text, boolean, uuid[], text, integer, smallint[], smallint, text, date) from public, anon;
grant execute on function private.split_event_series(uuid, date, uuid, text, uuid, boolean, time, integer, text, text,
  text, text, boolean, uuid[], text, integer, smallint[], smallint, text, date) to authenticated;
revoke all on function public.split_event_series(uuid, date, uuid, text, uuid, boolean, time, integer, text, text,
  text, text, boolean, uuid[], text, integer, smallint[], smallint, text, date) from public, anon;
grant execute on function public.split_event_series(uuid, date, uuid, text, uuid, boolean, time, integer, text, text,
  text, text, boolean, uuid[], text, integer, smallint[], smallint, text, date) to authenticated;
