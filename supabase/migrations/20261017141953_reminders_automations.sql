-- =============================================================================
-- COFI · Hito C · Avisos persistentes, reglas de preparativos y entregas Push.
--
-- Responsabilidades separadas:
--   1. Persistencia: reminder_jobs se escribe en la MISMA transacción que el
--      evento (trigger diferido = outbox).
--   2. Programación: pg_cron procesa por lotes cada minuto, sin pantallas.
--   3. Entrega: se crea el aviso interno (notifications) y, si hay
--      suscripciones, las entregas Push (notification_deliveries).
--   4. Presentación: cada pantalla decide cómo destacarlo (Realtime + RLS).
-- =============================================================================

create extension if not exists pg_net with schema extensions;

-- -----------------------------------------------------------------------------
-- Preferencias nuevas
-- -----------------------------------------------------------------------------

alter table public.families
  add column quiet_start time not null default '21:30',
  add column quiet_end time not null default '06:30';

grant update (quiet_start, quiet_end) on public.families to authenticated;

-- Recordatorios: minutos antes del inicio (o de las 08:00 en días completos).
alter table public.calendar_events
  add column reminder_offsets integer[] not null default '{}'
    check (reminder_offsets <@ array[0, 10, 15, 30, 60, 120, 1440]);
alter table public.event_series
  add column reminder_offsets integer[] not null default '{}'
    check (reminder_offsets <@ array[0, 10, 15, 30, 60, 120, 1440]);

-- Tareas generadas por reglas: origen trazable y clave única.
alter table public.task_occurrences
  add column source_event_id uuid,
  add column source_rule_id uuid,
  add column generated_key text,
  add constraint task_occurrences_generated_key unique (family_id, generated_key);

create index task_occurrences_source_event_idx on public.task_occurrences (family_id, source_event_id)
  where source_event_id is not null;

-- -----------------------------------------------------------------------------
-- Reglas deterministas (configuradas y aceptadas por adultos)
-- -----------------------------------------------------------------------------

create table public.automation_rules (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  kind text not null check (kind in ('visit_prep', 'school_prep')),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  enabled boolean not null default true,
  evening_time time not null default '20:00',
  morning_time time not null default '07:00',
  prep_minutes_before integer not null default 60 check (prep_minutes_before between 0 and 1440),
  task_title text check (char_length(task_title) <= 120),
  task_member_ids uuid[] not null default '{}',
  task_points integer not null default 10 check (task_points between 0 and 1000),
  notify_audience text not null default 'family' check (notify_audience in ('family', 'adults')),
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  constraint automation_rules_family_id_id_key unique (family_id, id)
);

create table public.event_automations (
  family_id uuid not null,
  event_id uuid not null,
  rule_id uuid not null,
  accepted_by uuid,
  accepted_at timestamptz not null default now(),
  primary key (family_id, event_id, rule_id),
  constraint event_automations_event_fk
    foreign key (family_id, event_id) references public.calendar_events (family_id, id) on delete cascade,
  constraint event_automations_rule_fk
    foreign key (family_id, rule_id) references public.automation_rules (family_id, id) on delete cascade
);

create index event_automations_rule_idx on public.event_automations (family_id, rule_id);

create trigger automation_rules_biu before insert or update on public.automation_rules
  for each row execute function private.tg_versioned_biu();

-- -----------------------------------------------------------------------------
-- Trabajos, avisos y entregas
-- -----------------------------------------------------------------------------

create table public.reminder_jobs (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  job_key text not null,
  kind text not null check (kind in ('event_reminder', 'prep_evening', 'prep_morning')),
  source_type text not null check (source_type in ('event')),
  source_id uuid not null,
  source_version integer not null,
  rule_id uuid,
  offset_minutes integer,
  due_at timestamptz not null,
  relevant_until timestamptz not null,
  status text not null default 'pending'
    check (status in ('pending', 'claimed', 'completed', 'retry', 'cancelled', 'failed')),
  attempts integer not null default 0,
  next_attempt_at timestamptz,
  claimed_at timestamptz,
  completed_at timestamptz,
  last_error text check (char_length(last_error) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reminder_jobs_key unique (family_id, job_key)
);

create index reminder_jobs_due_idx on public.reminder_jobs ((coalesce(next_attempt_at, due_at)))
  where status in ('pending', 'retry');
create index reminder_jobs_claimed_idx on public.reminder_jobs (claimed_at) where status = 'claimed';
create index reminder_jobs_source_idx on public.reminder_jobs (family_id, source_id);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  audience text not null check (audience in ('adults', 'family', 'member')),
  member_id uuid,
  kind text not null check (kind in ('event_reminder', 'prep_evening', 'prep_morning', 'rule_conflict', 'system')),
  title text not null check (char_length(title) between 1 and 200),
  body text check (char_length(body) <= 600),
  importance text not null default 'normal' check (importance in ('normal', 'high')),
  source_type text,
  source_id uuid,
  job_id uuid,
  dedupe_key text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  constraint notifications_dedupe_key unique (family_id, dedupe_key),
  constraint notifications_member_fk
    foreign key (family_id, member_id) references public.family_members (family_id, id) on delete cascade,
  constraint notifications_audience_member check ((audience = 'member') = (member_id is not null))
);

create index notifications_family_idx on public.notifications (family_id, created_at desc);
create index notifications_member_idx on public.notifications (family_id, member_id) where member_id is not null;

-- Lectura/reconocimiento por destinatario: un adulto ('user:<id>') o una
-- pantalla ('device:<id>'). Reconocer en la cocina no confirma por cada hijo.
create table public.notification_receipts (
  notification_id uuid not null references public.notifications (id) on delete cascade,
  family_id uuid not null references public.families (id) on delete cascade,
  recipient text not null check (recipient ~ '^(user|device):[0-9a-f-]{36}$'),
  read_at timestamptz,
  acknowledged_at timestamptz,
  primary key (notification_id, recipient)
);

create index notification_receipts_family_idx on public.notification_receipts (family_id, recipient);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  owner_user_id uuid not null,
  device_id uuid,
  endpoint text not null unique check (endpoint ~ '^https://'),
  p256dh text not null check (char_length(p256dh) between 20 and 200),
  auth_key text not null check (char_length(auth_key) between 8 and 100),
  user_agent text check (char_length(user_agent) <= 300),
  created_at timestamptz not null default now(),
  last_success_at timestamptz,
  failure_count integer not null default 0,
  revoked_at timestamptz,
  constraint push_subscriptions_device_fk
    foreign key (family_id, device_id) references public.paired_devices (family_id, id) on delete cascade
);

create index push_subscriptions_family_idx on public.push_subscriptions (family_id) where revoked_at is null;
create index push_subscriptions_owner_idx on public.push_subscriptions (owner_user_id);
create index push_subscriptions_device_idx on public.push_subscriptions (family_id, device_id);

create table public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  notification_id uuid not null references public.notifications (id) on delete cascade,
  subscription_id uuid not null references public.push_subscriptions (id) on delete cascade,
  channel text not null default 'push' check (channel = 'push'),
  status text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'retry', 'failed', 'gone')),
  not_before timestamptz,
  attempts integer not null default 0,
  next_attempt_at timestamptz,
  claimed_at timestamptz,
  last_status_code integer,
  last_error text check (char_length(last_error) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_deliveries_unique unique (notification_id, subscription_id)
);

create index notification_deliveries_due_idx on public.notification_deliveries (
  (coalesce(next_attempt_at, not_before, created_at))) where status in ('pending', 'retry');
create index notification_deliveries_sub_idx on public.notification_deliveries (subscription_id);
create index notification_deliveries_family_idx on public.notification_deliveries (family_id, created_at desc);

-- -----------------------------------------------------------------------------
-- Formato de fechas en español (para el texto de los avisos)
-- -----------------------------------------------------------------------------

create or replace function private.format_local(p_ts timestamptz, p_tz text, p_hour_format text, p_with_day boolean)
returns text
language sql
stable
set search_path = ''
as $$
  with l as (select (p_ts at time zone p_tz) as t)
  select
    case when p_with_day then
      (array['lunes','martes','miércoles','jueves','viernes','sábado','domingo'])[extract(isodow from l.t)::int]
      || ' ' || extract(day from l.t)::int || ' de '
      || (array['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre',
                'noviembre','diciembre'])[extract(month from l.t)::int] || ', '
    else '' end
    || case when p_hour_format = '24h' then to_char(l.t, 'HH24:MI')
            else ltrim(to_char(l.t, 'HH12:MI'), '0') || ' ' || to_char(l.t, 'AM') end
  from l;
$$;

-- -----------------------------------------------------------------------------
-- Sincronización evento → trabajos y tareas de preparación (idempotente)
-- -----------------------------------------------------------------------------

create or replace function private.sync_event_side_effects(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  e public.calendar_events;
  v_ref timestamptz;           -- inicio (o 08:00 local en días completos)
  v_end timestamptz;
  v_offset integer;
  v_keys text[] := '{}';
  v_rule record;
  v_member uuid;
  v_deadline timestamptz;
  v_task public.task_occurrences;
  v_key text;
  v_due timestamptz;
  v_task_keys text[] := '{}';
begin
  select * into e from public.calendar_events where id = p_event_id;
  if not found then
    return;
  end if;
  -- Los cambios hechos por la sincronización no cuentan como ajustes manuales.
  perform set_config('cofi.sync', 'on', true);

  if e.is_all_day then
    v_ref := (e.start_date + time '08:00') at time zone e.timezone;
    v_end := (e.end_date + time '00:00') at time zone e.timezone;
  else
    v_ref := e.starts_at;
    v_end := coalesce(e.ends_at, e.starts_at + interval '30 minutes');
  end if;

  -- Evento cancelado: anular trabajos y tareas futuras no realizadas.
  if e.status = 'cancelled' then
    update public.reminder_jobs set status = 'cancelled', last_error = 'evento cancelado', updated_at = now()
    where family_id = e.family_id and source_id = e.id and status in ('pending', 'retry', 'claimed');
    update public.task_occurrences set status = 'cancelled'
    where family_id = e.family_id and source_event_id = e.id and status = 'pending'
      and submitted_at is null and not is_exception;
    perform set_config('cofi.sync', 'off', true);
    return;
  end if;

  -- Recordatorios configurados en el evento.
  foreach v_offset in array e.reminder_offsets loop
    v_due := v_ref - make_interval(mins => v_offset);
    v_key := 'event:' || e.id || ':reminder:' || v_offset;
    v_keys := v_keys || v_key;
    if v_due > now() - interval '10 minutes' then
      insert into public.reminder_jobs (family_id, job_key, kind, source_type, source_id, source_version,
                                        offset_minutes, due_at, relevant_until)
      values (e.family_id, v_key, 'event_reminder', 'event', e.id, e.version, v_offset, v_due, v_end)
      on conflict (family_id, job_key) do update set
        source_version = excluded.source_version,
        relevant_until = excluded.relevant_until,
        -- Reprogramado: se vuelve a avisar en la nueva hora.
        status = case when public.reminder_jobs.due_at = excluded.due_at
                       and public.reminder_jobs.status in ('completed', 'failed')
                      then public.reminder_jobs.status else 'pending' end,
        attempts = case when public.reminder_jobs.due_at = excluded.due_at then public.reminder_jobs.attempts else 0 end,
        due_at = excluded.due_at,
        next_attempt_at = null,
        updated_at = now();
    end if;
  end loop;

  -- Reglas aceptadas para este evento.
  for v_rule in
    select r.* from public.event_automations a
    join public.automation_rules r on r.family_id = a.family_id and r.id = a.rule_id
    where a.family_id = e.family_id and a.event_id = e.id and r.enabled
  loop
    -- Aviso la noche anterior y por la mañana del día del evento.
    foreach v_key in array array['evening', 'morning'] loop
      v_due := case when v_key = 'evening'
                    then ((e.local_start_date - 1) + v_rule.evening_time) at time zone e.timezone
                    else (e.local_start_date + v_rule.morning_time) at time zone e.timezone end;
      if v_due < v_ref and v_due > now() - interval '10 minutes' then
        insert into public.reminder_jobs (family_id, job_key, kind, source_type, source_id, source_version,
                                          rule_id, due_at, relevant_until)
        values (e.family_id, 'rule:' || v_rule.id || ':event:' || e.id || ':' || v_key,
                case when v_key = 'evening' then 'prep_evening' else 'prep_morning' end,
                'event', e.id, e.version, v_rule.id, v_due, v_ref)
        on conflict (family_id, job_key) do update set
          source_version = excluded.source_version,
          relevant_until = excluded.relevant_until,
          status = case when public.reminder_jobs.due_at = excluded.due_at
                         and public.reminder_jobs.status in ('completed', 'failed')
                        then public.reminder_jobs.status else 'pending' end,
          attempts = case when public.reminder_jobs.due_at = excluded.due_at then public.reminder_jobs.attempts else 0 end,
          due_at = excluded.due_at,
          next_attempt_at = null,
          updated_at = now();
        v_keys := v_keys || ('rule:' || v_rule.id || ':event:' || e.id || ':' || v_key);
      end if;
    end loop;

    -- Tareas de preparación con hora límite antes del evento.
    if v_rule.task_title is not null and cardinality(v_rule.task_member_ids) > 0 then
      v_deadline := v_ref - make_interval(mins => v_rule.prep_minutes_before);
      foreach v_member in array v_rule.task_member_ids loop
        continue when not exists (
          select 1 from public.family_members fm
          where fm.family_id = e.family_id and fm.id = v_member and fm.kind = 'child' and fm.archived_at is null);
        v_key := 'rule:' || v_rule.id || ':event:' || e.id || ':member:' || v_member;
        v_task_keys := v_task_keys || v_key;
        select * into v_task from public.task_occurrences t
        where t.family_id = e.family_id and t.generated_key = v_key;
        if not found then
          insert into public.task_occurrences (family_id, kind, title, notes, assignee_member_id, due_date, due_time,
                                               timezone, points, requires_review, visibility, status,
                                               source_event_id, source_rule_id, generated_key)
          values (e.family_id, 'chore', v_rule.task_title, 'Para: ' || e.title, v_member,
                  (v_deadline at time zone e.timezone)::date, (v_deadline at time zone e.timezone)::time,
                  e.timezone, v_rule.task_points, true, 'family', 'pending', e.id, v_rule.id, v_key);
        elsif v_task.status = 'cancelled' and v_task.submitted_at is null and not v_task.is_exception then
          update public.task_occurrences set status = 'pending',
            due_date = (v_deadline at time zone e.timezone)::date, due_time = (v_deadline at time zone e.timezone)::time
          where id = v_task.id;
        elsif v_task.status = 'pending' and v_task.submitted_at is null and not v_task.is_exception then
          if v_task.due_at is distinct from v_deadline then
            update public.task_occurrences set
              due_date = (v_deadline at time zone e.timezone)::date,
              due_time = (v_deadline at time zone e.timezone)::time
            where id = v_task.id;
          end if;
        elsif v_task.is_exception and v_task.due_at is distinct from v_deadline and v_task.status = 'pending' then
          -- Ajuste manual: no se sobrescribe; se avisa a los adultos para decidir.
          insert into public.notifications (family_id, audience, kind, title, body, importance,
                                            source_type, source_id, dedupe_key)
          values (e.family_id, 'adults', 'rule_conflict', 'Revisa una tarea de preparación',
                  '«' || v_task.title || '» fue ajustada a mano y el evento «' || e.title || '» cambió de hora.',
                  'high', 'event', e.id, 'conflict:' || v_task.id || ':' || e.version)
          on conflict (family_id, dedupe_key) do nothing;
        end if;
      end loop;
    end if;
  end loop;

  -- Lo que ya no corresponde (recordatorio quitado, regla retirada) se anula.
  update public.reminder_jobs set status = 'cancelled', last_error = 'ya no aplica', updated_at = now()
  where family_id = e.family_id and source_id = e.id and status in ('pending', 'retry', 'claimed')
    and job_key <> all (v_keys);
  update public.task_occurrences set status = 'cancelled'
  where family_id = e.family_id and source_event_id = e.id and status = 'pending'
    and submitted_at is null and not is_exception and generated_key <> all (v_task_keys);
  perform set_config('cofi.sync', 'off', true);
end;
$$;

create or replace function private.tg_sync_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.sync_event_side_effects(coalesce(new.event_id, old.event_id));
  return null;
end;
$$;

create or replace function private.tg_sync_event_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.sync_event_side_effects(new.id);
  return null;
end;
$$;

-- Diferidos: se ejecutan al confirmar, con participantes y reglas ya guardados.
create constraint trigger calendar_events_sync_side_effects
  after insert or update on public.calendar_events
  deferrable initially deferred
  for each row execute function private.tg_sync_event_row();

create constraint trigger event_automations_sync
  after insert or delete on public.event_automations
  deferrable initially deferred
  for each row execute function private.tg_sync_event();

-- Ajustes manuales en tareas generadas se marcan como excepción.
create or replace function private.tg_generated_task_exception()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.generated_key is not null and auth.uid() is not null
     and (new.title is distinct from old.title or new.due_date is distinct from old.due_date
          or new.due_time is distinct from old.due_time)
     and current_setting('cofi.sync', true) is distinct from 'on' then
    new.is_exception := true;
  end if;
  return new;
end;
$$;

create trigger task_occurrences_generated_exception
  before update on public.task_occurrences
  for each row execute function private.tg_generated_task_exception();

-- -----------------------------------------------------------------------------
-- Procesamiento de trabajos (pg_cron, por lotes, reintentable)
-- -----------------------------------------------------------------------------

create or replace function private.notification_audiences(p_event public.calendar_events, p_rule_audience text)
returns table (audience text, member_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select 'adults'::text, null::uuid
  where p_event.visibility = 'adults' or p_rule_audience = 'adults'
     or (p_event.visibility = 'participants' and not p_event.whole_family)
  union all
  select 'family', null
  where p_event.visibility = 'family' and coalesce(p_rule_audience, 'family') = 'family'
     or (p_event.visibility = 'participants' and p_event.whole_family and coalesce(p_rule_audience, 'family') = 'family')
  union all
  select 'member', fm.id
  from public.event_participants p
  join public.family_members fm on fm.family_id = p.family_id and fm.id = p.member_id and fm.kind = 'child'
  where p.family_id = p_event.family_id and p.event_id = p_event.id
    and p_event.visibility = 'participants' and not p_event.whole_family
    and coalesce(p_rule_audience, 'family') = 'family';
$$;

/** Encola entregas Push para un aviso (respeta horas de silencio de la familia). */
create or replace function private.enqueue_push(p_notification public.notifications)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  f public.families;
  v_local time;
  v_not_before timestamptz;
  v_count integer;
begin
  select * into f from public.families where id = p_notification.family_id;
  v_local := (now() at time zone f.timezone)::time;
  if p_notification.importance <> 'high' and (
       (f.quiet_start < f.quiet_end and v_local >= f.quiet_start and v_local < f.quiet_end)
    or (f.quiet_start > f.quiet_end and (v_local >= f.quiet_start or v_local < f.quiet_end))) then
    v_not_before := (((now() at time zone f.timezone)::date
                      + case when v_local >= f.quiet_end then 1 else 0 end) + f.quiet_end) at time zone f.timezone;
  end if;

  with recipients as (
    select s.id from public.push_subscriptions s
    where s.family_id = p_notification.family_id and s.revoked_at is null
      and (
        -- adultos activos (en cualquier audiencia)
        (s.device_id is null and s.owner_user_id in (
           select m.user_id from public.adult_memberships m
           where m.family_id = p_notification.family_id and m.status = 'active'))
        or (s.device_id is not null and exists (
           select 1 from public.paired_devices d
           where d.id = s.device_id and d.revoked_at is null
             and (p_notification.audience = 'family'
                  or (p_notification.audience = 'member' and d.scope = 'child' and d.member_id = p_notification.member_id)
                  or (p_notification.audience = 'member' and d.scope = 'home'))))
      )
  ), ins as (
    insert into public.notification_deliveries (family_id, notification_id, subscription_id, not_before)
    select p_notification.family_id, p_notification.id, r.id, v_not_before from recipients r
    on conflict (notification_id, subscription_id) do nothing
    returning 1
  )
  select count(*) into v_count from ins;
  return v_count;
end;
$$;

create or replace function private.process_one_reminder(j public.reminder_jobs)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  e public.calendar_events;
  f public.families;
  r public.automation_rules;
  v_title text;
  v_body text;
  v_when text;
  v_aud record;
  v_notification public.notifications;
  v_created integer := 0;
begin
  select * into e from public.calendar_events where id = j.source_id;
  if not found or e.status <> 'scheduled' then
    update public.reminder_jobs set status = 'cancelled', last_error = 'evento no vigente', updated_at = now()
    where id = j.id;
    return 'cancelled';
  end if;
  if e.version <> j.source_version then
    -- Una versión más nueva ya reprogramó este trabajo con su propia clave.
    update public.reminder_jobs set status = 'cancelled', last_error = 'versión superada', updated_at = now()
    where id = j.id;
    return 'superseded';
  end if;
  if now() > j.relevant_until then
    update public.reminder_jobs set status = 'cancelled', last_error = 'fuera de la ventana de relevancia',
      updated_at = now() where id = j.id;
    return 'stale';
  end if;

  select * into f from public.families where id = e.family_id;
  if j.rule_id is not null then
    select * into r from public.automation_rules where id = j.rule_id;
  end if;

  v_when := case when e.is_all_day then 'todo el día'
                 else 'a las ' || private.format_local(e.starts_at, e.timezone, f.time_format, false) end;
  if j.kind = 'event_reminder' then
    v_title := e.title;
    v_body := case
      when e.is_all_day then 'Hoy, todo el día.'
      when j.offset_minutes = 0 then 'Empieza ahora.'
      else 'Empieza ' || private.format_local(e.starts_at, e.timezone, f.time_format, true) || '.' end;
  else
    v_title := case when j.kind = 'prep_evening' then 'Mañana: ' else 'Hoy: ' end || e.title || ' ' || v_when;
    v_body := concat_ws(' ', e.description,
      case when r.task_title is not null and cardinality(r.task_member_ids) > 0 then
        'Preparar: ' || r.task_title || ' antes de las '
        || private.format_local(
             case when e.is_all_day then (e.start_date + time '08:00') at time zone e.timezone else e.starts_at end
             - make_interval(mins => r.prep_minutes_before), e.timezone, f.time_format, false) || '.'
      end);
  end if;

  for v_aud in select * from private.notification_audiences(e, case when j.rule_id is null then null else r.notify_audience end)
  loop
    insert into public.notifications (family_id, audience, member_id, kind, title, body, importance,
                                      source_type, source_id, job_id, dedupe_key, expires_at)
    values (e.family_id, v_aud.audience, v_aud.member_id, j.kind, left(v_title, 200), left(nullif(v_body, ''), 600),
            e.importance, 'event', e.id, j.id,
            j.job_key || ':' || v_aud.audience || ':' || coalesce(v_aud.member_id::text, '') || ':' ||
              to_char(j.due_at at time zone 'UTC', 'YYYYMMDDHH24MI'),
            j.relevant_until)
    on conflict (family_id, dedupe_key) do nothing
    returning * into v_notification;
    if v_notification.id is not null then
      v_created := v_created + 1;
      perform private.enqueue_push(v_notification);
    end if;
  end loop;

  update public.reminder_jobs set status = 'completed', completed_at = now(), last_error = null, updated_at = now()
  where id = j.id;
  return case when v_created > 0 then 'completed' else 'duplicate' end;
end;
$$;

create or replace function private.process_reminder_jobs(p_batch integer default 100)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  j public.reminder_jobs;
  v_result text;
  v_summary jsonb := '{}'::jsonb;
begin
  for j in
    with due as (
      select id from public.reminder_jobs
      where (status in ('pending', 'retry') and coalesce(next_attempt_at, due_at) <= now())
         or (status = 'claimed' and claimed_at < now() - interval '5 minutes') -- reclamación vencida
      order by due_at
      limit p_batch
      for update skip locked
    )
    update public.reminder_jobs r set status = 'claimed', claimed_at = now(), attempts = r.attempts + 1, updated_at = now()
    from due where r.id = due.id
    returning r.*
  loop
    begin
      v_result := private.process_one_reminder(j);
    exception when others then
      v_result := case when j.attempts >= 5 then 'failed' else 'retry' end;
      update public.reminder_jobs set
        status = v_result,
        next_attempt_at = now() + (array[interval '1 minute', interval '5 minutes', interval '15 minutes',
                                         interval '60 minutes', interval '60 minutes'])[least(j.attempts, 5)],
        last_error = left(sqlstate || ': ' || sqlerrm, 300),
        updated_at = now()
      where id = j.id;
    end;
    v_summary := jsonb_set(v_summary, array[v_result], to_jsonb(coalesce((v_summary ->> v_result)::int, 0) + 1));
  end loop;
  return v_summary;
end;
$$;

-- -----------------------------------------------------------------------------
-- Entregas Push: reclamación y resultado (solo la Edge Function, service_role)
-- -----------------------------------------------------------------------------

create or replace function private.claim_push_deliveries(p_batch integer default 50)
returns table (delivery_id uuid, endpoint text, p256dh text, auth_key text, title text, body text, tag text, url text)
language sql
security definer
set search_path = ''
as $$
  with due as (
    select d.id from public.notification_deliveries d
    where (d.status in ('pending', 'retry') and coalesce(d.next_attempt_at, d.not_before, d.created_at) <= now())
       or (d.status = 'sending' and d.claimed_at < now() - interval '5 minutes')
    order by d.created_at
    limit p_batch
    for update skip locked
  ), claimed as (
    update public.notification_deliveries d set status = 'sending', claimed_at = now(), attempts = d.attempts + 1,
      updated_at = now()
    from due where d.id = due.id
    returning d.id, d.notification_id, d.subscription_id
  )
  select c.id, s.endpoint, s.p256dh, s.auth_key, n.title, n.body, n.id::text,
         case when n.audience = 'adults' then '/avisos' else '/' end
  from claimed c
  join public.push_subscriptions s on s.id = c.subscription_id
  join public.notifications n on n.id = c.notification_id;
$$;

create or replace function private.complete_push_delivery(p_delivery_id uuid, p_status_code integer, p_error text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.notification_deliveries;
begin
  select * into d from public.notification_deliveries where id = p_delivery_id for update;
  if not found then
    return;
  end if;
  if p_status_code between 200 and 299 then
    update public.notification_deliveries set status = 'sent', last_status_code = p_status_code, last_error = null,
      updated_at = now() where id = d.id;
    update public.push_subscriptions set last_success_at = now(), failure_count = 0 where id = d.subscription_id;
  elsif p_status_code in (404, 410) then
    -- La suscripción ya no existe en el navegador: no se reintenta.
    update public.notification_deliveries set status = 'gone', last_status_code = p_status_code,
      last_error = left(p_error, 300), updated_at = now() where id = d.id;
    update public.push_subscriptions set revoked_at = now() where id = d.subscription_id;
  else
    update public.notification_deliveries set
      status = case when d.attempts >= 5 then 'failed' else 'retry' end,
      next_attempt_at = now() + (array[interval '1 minute', interval '5 minutes', interval '15 minutes',
                                       interval '60 minutes', interval '60 minutes'])[least(d.attempts, 5)],
      last_status_code = p_status_code, last_error = left(p_error, 300), updated_at = now()
    where id = d.id;
    update public.push_subscriptions set failure_count = failure_count + 1 where id = d.subscription_id;
  end if;
end;
$$;

-- Llama a la Edge Function solo si hay entregas pendientes y Push está
-- configurado (URL y secreto en Vault). Nunca expone el secreto.
create or replace function private.dispatch_push()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  if not exists (
    select 1 from public.notification_deliveries d
    where (d.status in ('pending', 'retry') and coalesce(d.next_attempt_at, d.not_before, d.created_at) <= now())
       or (d.status = 'sending' and d.claimed_at < now() - interval '5 minutes')
  ) then
    return 'idle';
  end if;
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'cofi_push_function_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'cofi_cron_secret';
  if v_url is null or v_secret is null then
    return 'push_not_configured';
  end if;
  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cofi-cron', v_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 15000
  );
  return 'dispatched';
end;
$$;

-- -----------------------------------------------------------------------------
-- RPC para adultos y pantallas
-- -----------------------------------------------------------------------------

create or replace function private.my_recipient()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select 'device:' || d.id from private.my_device() d limit 1),
    'user:' || auth.uid()
  );
$$;

create or replace function private.acknowledge_notification(p_notification_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  n public.notifications;
begin
  select * into n from public.notifications where id = p_notification_id;
  if not found or not (
    private.is_family_adult(n.family_id)
    or exists (select 1 from private.my_device() d
               where d.family_id = n.family_id
                 and (n.audience = 'family' or (n.audience = 'member' and (d.scope = 'home' or d.member_id = n.member_id))))
  ) then
    perform private.raise_domain('NOT_FOUND', 'notification');
  end if;
  insert into public.notification_receipts (notification_id, family_id, recipient, read_at, acknowledged_at)
  values (n.id, n.family_id, private.my_recipient(), now(), now())
  on conflict (notification_id, recipient) do update set acknowledged_at = coalesce(
    public.notification_receipts.acknowledged_at, now());
end;
$$;

create or replace function private.save_push_subscription(
  p_family_id uuid, p_endpoint text, p_p256dh text, p_auth text, p_user_agent text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_device uuid;
  v_id uuid;
begin
  if auth.uid() is null then
    perform private.raise_domain('SESSION_REQUIRED');
  end if;
  select d.id into v_device from private.my_device() d where d.family_id = p_family_id;
  if v_device is null and not private.is_family_adult(p_family_id) then
    perform private.raise_domain('FORBIDDEN');
  end if;
  insert into public.push_subscriptions (family_id, owner_user_id, device_id, endpoint, p256dh, auth_key, user_agent)
  values (p_family_id, auth.uid(), v_device, p_endpoint, p_p256dh, p_auth, left(p_user_agent, 300))
  on conflict (endpoint) do update set
    family_id = excluded.family_id, owner_user_id = excluded.owner_user_id, device_id = excluded.device_id,
    p256dh = excluded.p256dh, auth_key = excluded.auth_key, user_agent = excluded.user_agent,
    revoked_at = null, failure_count = 0
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function private.delete_push_subscription(p_endpoint text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.push_subscriptions set revoked_at = now()
  where endpoint = p_endpoint and owner_user_id = (select auth.uid());
$$;

create or replace function private.save_automation_rule(
  p_family_id uuid, p_rule_id uuid, p_kind text, p_name text, p_enabled boolean, p_evening_time time,
  p_morning_time time, p_prep_minutes_before integer, p_task_title text, p_task_member_ids uuid[],
  p_task_points integer, p_notify_audience text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    perform private.raise_domain('SESSION_REQUIRED');
  end if;
  if not private.is_family_adult(p_family_id) then
    perform private.raise_domain('FORBIDDEN');
  end if;
  if coalesce(cardinality(p_task_member_ids), 0) > 0 then
    perform private.assert_child_members(p_family_id, p_task_member_ids);
  end if;
  if p_rule_id is null then
    insert into public.automation_rules (family_id, kind, name, enabled, evening_time, morning_time,
      prep_minutes_before, task_title, task_member_ids, task_points, notify_audience, created_by)
    values (p_family_id, p_kind, btrim(p_name), p_enabled, p_evening_time, p_morning_time, p_prep_minutes_before,
      nullif(btrim(p_task_title), ''), coalesce(p_task_member_ids, '{}'), p_task_points, p_notify_audience, auth.uid())
    returning id into v_id;
  else
    update public.automation_rules set kind = p_kind, name = btrim(p_name), enabled = p_enabled,
      evening_time = p_evening_time, morning_time = p_morning_time, prep_minutes_before = p_prep_minutes_before,
      task_title = nullif(btrim(p_task_title), ''), task_member_ids = coalesce(p_task_member_ids, '{}'),
      task_points = p_task_points, notify_audience = p_notify_audience
    where id = p_rule_id and family_id = p_family_id
    returning id into v_id;
    if v_id is null then
      perform private.raise_domain('NOT_FOUND', 'rule');
    end if;
    -- Reaplicar a los eventos futuros que usan la regla.
    perform private.sync_event_side_effects(a.event_id)
    from public.event_automations a
    join public.calendar_events e on e.id = a.event_id
    where a.rule_id = v_id and e.local_end_date >= private.family_today(p_family_id);
  end if;
  perform private.audit(p_family_id, 'automation_rule.saved', 'automation_rule', v_id);
  return v_id;
end;
$$;

create or replace function private.reminders_health(p_family_id uuid)
returns table (last_completed_at timestamptz, overdue_pending integer, failed_7d integer, push_failed_7d integer,
               push_sent_7d integer, subscriptions integer)
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select max(completed_at) from public.reminder_jobs where family_id = p_family_id and status = 'completed'),
    (select count(*)::int from public.reminder_jobs where family_id = p_family_id
       and status in ('pending', 'retry', 'claimed') and coalesce(next_attempt_at, due_at) < now() - interval '3 minutes'),
    (select count(*)::int from public.reminder_jobs where family_id = p_family_id and status = 'failed'
       and updated_at > now() - interval '7 days'),
    (select count(*)::int from public.notification_deliveries where family_id = p_family_id
       and status in ('failed', 'gone') and updated_at > now() - interval '7 days'),
    (select count(*)::int from public.notification_deliveries where family_id = p_family_id
       and status = 'sent' and updated_at > now() - interval '7 days'),
    (select count(*)::int from public.push_subscriptions where family_id = p_family_id and revoked_at is null)
  where private.is_family_adult(p_family_id);
$$;

-- -----------------------------------------------------------------------------
-- RLS y privilegios
-- -----------------------------------------------------------------------------

alter table public.automation_rules enable row level security;
alter table public.event_automations enable row level security;
alter table public.reminder_jobs enable row level security;
alter table public.notifications enable row level security;
alter table public.notification_receipts enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.notification_deliveries enable row level security;

create policy automation_rules_select on public.automation_rules for select to authenticated
  using (family_id in (select private.my_adult_family_ids()));
create policy event_automations_select on public.event_automations for select to authenticated
  using (family_id in (select private.my_adult_family_ids()));
create policy reminder_jobs_select on public.reminder_jobs for select to authenticated
  using (family_id in (select private.my_adult_family_ids()));
create policy notification_deliveries_select on public.notification_deliveries for select to authenticated
  using (family_id in (select private.my_adult_family_ids()));

create policy notifications_select on public.notifications for select to authenticated using (
  family_id in (select private.my_adult_family_ids())
  or exists (
    select 1 from private.my_device() d
    where d.family_id = notifications.family_id
      and (notifications.audience = 'family'
           or (notifications.audience = 'member' and (d.scope = 'home' or d.member_id = notifications.member_id)))
  )
);

create policy notification_receipts_select on public.notification_receipts for select to authenticated using (
  family_id in (select private.my_adult_family_ids())
  or recipient = (select private.my_recipient())
);

create policy push_subscriptions_select on public.push_subscriptions for select to authenticated
  using (owner_user_id = (select auth.uid()));

revoke all on table public.automation_rules, public.event_automations, public.reminder_jobs, public.notifications,
  public.notification_receipts, public.push_subscriptions, public.notification_deliveries
from anon, authenticated;

grant select on public.automation_rules, public.event_automations, public.reminder_jobs, public.notifications,
  public.notification_receipts, public.notification_deliveries to authenticated;
grant select (id, family_id, endpoint, created_at, last_success_at, failure_count, revoked_at)
  on public.push_subscriptions to authenticated;

-- Avisos y entregas en tiempo real (solo invalidación).
create or replace function private.install_broadcast_c(p_table text)
returns void
language plpgsql
set search_path = ''
as $$
begin
  execute format('create trigger %I after insert on public.%I referencing new table as new_rows
                  for each statement execute function private.tg_broadcast_statement()', p_table || '_bc_ins', p_table);
  execute format('create trigger %I after update on public.%I referencing new table as new_rows old table as old_rows
                  for each statement execute function private.tg_broadcast_statement()', p_table || '_bc_upd', p_table);
end;
$$;
select private.install_broadcast_c('notifications');
select private.install_broadcast_c('notification_receipts');
drop function private.install_broadcast_c(text);

-- Canales que reciben los avisos según su audiencia.
create or replace function private.broadcast_topics(p_table text, p_rows jsonb)
returns setof text
language sql
stable
set search_path = ''
as $$
  with r as (select value as row from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)))
  select distinct topic from (
    select 'fam:' || coalesce(row ->> 'family_id', case when p_table = 'families' then row ->> 'id' end) || ':adults' as topic
    from r
    union all
    select 'fam:' || coalesce(row ->> 'family_id', case when p_table = 'families' then row ->> 'id' end) || ':screens'
    from r
    where p_table in ('families', 'family_members', 'event_categories', 'member_point_accounts', 'rewards',
                      'reward_members')
       or (p_table = 'calendar_events' and row ->> 'visibility' <> 'adults')
       or (p_table = 'task_occurrences' and row ->> 'visibility' = 'family')
       or (p_table = 'notifications' and row ->> 'audience' in ('family', 'member'))
       or p_table = 'notification_receipts'
    union all
    select 'member:' || coalesce(row ->> 'assignee_member_id', row ->> 'member_id')
    from r
    where p_table in ('task_occurrences', 'member_point_accounts', 'points_ledger', 'reward_redemptions', 'notifications')
      and coalesce(row ->> 'assignee_member_id', row ->> 'member_id') is not null
  ) t
  where topic is not null;
$$;

-- -----------------------------------------------------------------------------
-- Envoltorios públicos
-- -----------------------------------------------------------------------------

create or replace function public.acknowledge_notification(p_notification_id uuid)
returns void language sql security invoker set search_path = '' as $$
  select private.acknowledge_notification(p_notification_id);
$$;

create or replace function public.save_push_subscription(
  p_family_id uuid, p_endpoint text, p_p256dh text, p_auth text, p_user_agent text
)
returns uuid language sql security invoker set search_path = '' as $$
  select private.save_push_subscription(p_family_id, p_endpoint, p_p256dh, p_auth, p_user_agent);
$$;

create or replace function public.delete_push_subscription(p_endpoint text)
returns void language sql security invoker set search_path = '' as $$
  select private.delete_push_subscription(p_endpoint);
$$;

create or replace function public.save_automation_rule(
  p_family_id uuid, p_rule_id uuid, p_kind text, p_name text, p_enabled boolean, p_evening_time time,
  p_morning_time time, p_prep_minutes_before integer, p_task_title text, p_task_member_ids uuid[],
  p_task_points integer, p_notify_audience text
)
returns uuid language sql security invoker set search_path = '' as $$
  select private.save_automation_rule(p_family_id, p_rule_id, p_kind, p_name, p_enabled, p_evening_time,
    p_morning_time, p_prep_minutes_before, p_task_title, p_task_member_ids, p_task_points, p_notify_audience);
$$;

create or replace function public.reminders_health(p_family_id uuid)
returns table (last_completed_at timestamptz, overdue_pending integer, failed_7d integer, push_failed_7d integer,
               push_sent_7d integer, subscriptions integer)
language sql stable security invoker set search_path = '' as $$
  select * from private.reminders_health(p_family_id);
$$;

-- Solo la Edge Function (service_role) reclama y completa entregas.
create or replace function public.claim_push_deliveries(p_batch integer default 50)
returns table (delivery_id uuid, endpoint text, p256dh text, auth_key text, title text, body text, tag text, url text)
language sql security invoker set search_path = '' as $$
  select * from private.claim_push_deliveries(p_batch);
$$;

create or replace function public.complete_push_delivery(p_delivery_id uuid, p_status_code integer, p_error text)
returns void language sql security invoker set search_path = '' as $$
  select private.complete_push_delivery(p_delivery_id, p_status_code, p_error);
$$;

-- -----------------------------------------------------------------------------
-- Nuevas firmas de RPC de agenda: recordatorios y reglas aceptadas en la
-- MISMA transacción que el evento.
-- -----------------------------------------------------------------------------

drop function public.create_event(uuid, uuid, text, uuid, boolean, timestamptz, timestamptz, date, date,
                                  text, text, text, text, boolean, uuid[], text);
drop function public.update_event(uuid, integer, uuid, text, uuid, boolean, timestamptz, timestamptz, date, date,
                                  text, text, text, text, boolean, uuid[], text);

create or replace function private.set_event_automations(p_family_id uuid, p_event_id uuid, p_rule_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_rule_ids is null then
    return; -- sin cambios
  end if;
  if exists (select 1 from unnest(p_rule_ids) x(id)
             where not exists (select 1 from public.automation_rules r
                               where r.family_id = p_family_id and r.id = x.id and r.enabled)) then
    perform private.raise_domain('INVALID', 'rules');
  end if;
  delete from public.event_automations a
  where a.family_id = p_family_id and a.event_id = p_event_id and a.rule_id <> all (p_rule_ids);
  insert into public.event_automations (family_id, event_id, rule_id, accepted_by)
  select p_family_id, p_event_id, x.id, auth.uid() from (select distinct unnest(p_rule_ids) as id) x
  on conflict do nothing;
end;
$$;

create or replace function public.create_event(
  p_family_id uuid,
  p_command_id uuid,
  p_title text,
  p_category_id uuid,
  p_is_all_day boolean,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_start_date date,
  p_end_date date,
  p_location text,
  p_description text,
  p_visibility text,
  p_importance text,
  p_whole_family boolean,
  p_participant_ids uuid[],
  p_private_notes text default null,
  p_reminder_offsets integer[] default '{}',
  p_rule_ids uuid[] default null
)
returns public.calendar_events
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_event public.calendar_events;
  v_tz text;
begin
  if auth.uid() is null then
    perform private.raise_domain('SESSION_REQUIRED');
  end if;
  if not private.is_family_adult(p_family_id) then
    perform private.raise_domain('FORBIDDEN');
  end if;

  select * into v_event from public.calendar_events e
  where e.family_id = p_family_id and e.command_id = p_command_id;
  if found then
    return v_event;
  end if;

  perform private.assert_active_members(p_family_id, p_participant_ids);
  select f.timezone into v_tz from public.families f where f.id = p_family_id;

  insert into public.calendar_events (
    family_id, title, category_id, is_all_day, starts_at, ends_at, start_date, end_date,
    timezone, location, description, visibility, importance, whole_family, command_id, last_command_id,
    reminder_offsets
  ) values (
    p_family_id, btrim(p_title), p_category_id, p_is_all_day,
    case when p_is_all_day then null else p_starts_at end,
    case when p_is_all_day then null else p_ends_at end,
    case when p_is_all_day then p_start_date end,
    case when p_is_all_day then p_end_date end,
    v_tz, nullif(btrim(p_location), ''), nullif(btrim(p_description), ''),
    p_visibility, p_importance, p_whole_family, p_command_id, p_command_id,
    coalesce(p_reminder_offsets, '{}')
  )
  returning * into v_event;

  insert into public.event_participants (family_id, event_id, member_id)
  select p_family_id, v_event.id, x.member_id
  from (select distinct unnest(coalesce(p_participant_ids, '{}'::uuid[])) as member_id) x;

  if nullif(btrim(p_private_notes), '') is not null then
    insert into public.calendar_event_private_notes (event_id, family_id, notes)
    values (v_event.id, p_family_id, btrim(p_private_notes));
  end if;

  perform private.set_event_automations(p_family_id, v_event.id, p_rule_ids);
  perform private.audit(p_family_id, 'event.created', 'event', v_event.id);
  return v_event;
end;
$$;

create or replace function public.update_event(
  p_event_id uuid,
  p_expected_version integer,
  p_command_id uuid,
  p_title text,
  p_category_id uuid,
  p_is_all_day boolean,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_start_date date,
  p_end_date date,
  p_location text,
  p_description text,
  p_visibility text,
  p_importance text,
  p_whole_family boolean,
  p_participant_ids uuid[],
  p_private_notes text default null,
  p_reminder_offsets integer[] default null,
  p_rule_ids uuid[] default null
)
returns public.calendar_events
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_event public.calendar_events;
begin
  if auth.uid() is null then
    perform private.raise_domain('SESSION_REQUIRED');
  end if;

  select * into v_event from public.calendar_events e where e.id = p_event_id for update;
  if not found or not private.is_family_adult(v_event.family_id) then
    perform private.raise_domain('NOT_FOUND', 'event');
  end if;
  if v_event.last_command_id = p_command_id then
    return v_event;
  end if;
  if v_event.version <> p_expected_version then
    perform private.raise_domain('VERSION_CONFLICT', v_event.version::text);
  end if;

  perform private.assert_active_members(v_event.family_id, p_participant_ids);

  update public.calendar_events e set
    title = btrim(p_title),
    category_id = p_category_id,
    is_all_day = p_is_all_day,
    starts_at = case when p_is_all_day then null else p_starts_at end,
    ends_at = case when p_is_all_day then null else p_ends_at end,
    start_date = case when p_is_all_day then p_start_date end,
    end_date = case when p_is_all_day then p_end_date end,
    location = nullif(btrim(p_location), ''),
    description = nullif(btrim(p_description), ''),
    visibility = p_visibility,
    importance = p_importance,
    whole_family = p_whole_family,
    reminder_offsets = coalesce(p_reminder_offsets, e.reminder_offsets),
    last_command_id = p_command_id
  where e.id = p_event_id
  returning * into v_event;

  delete from public.event_participants ep
  where ep.event_id = p_event_id
    and ep.member_id <> all (coalesce(p_participant_ids, '{}'::uuid[]));

  insert into public.event_participants (family_id, event_id, member_id)
  select v_event.family_id, p_event_id, x.member_id
  from (select distinct unnest(coalesce(p_participant_ids, '{}'::uuid[])) as member_id) x
  on conflict (family_id, event_id, member_id) do nothing;

  if nullif(btrim(p_private_notes), '') is null then
    delete from public.calendar_event_private_notes n where n.event_id = p_event_id;
  else
    insert into public.calendar_event_private_notes (event_id, family_id, notes)
    values (p_event_id, v_event.family_id, btrim(p_private_notes))
    on conflict (event_id) do update set notes = excluded.notes;
  end if;

  perform private.set_event_automations(v_event.family_id, p_event_id, p_rule_ids);
  perform private.audit(v_event.family_id, 'event.updated', 'event', v_event.id);
  return v_event;
end;
$$;

grant update (reminder_offsets) on public.calendar_events to authenticated;
grant insert (reminder_offsets) on public.calendar_events to authenticated;

-- Las series copian sus recordatorios a cada ocurrencia.
create or replace function private.tg_series_occurrence_reminders()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.series_id is not null and tg_op = 'INSERT' then
    select s.reminder_offsets into new.reminder_offsets from public.event_series s where s.id = new.series_id;
  end if;
  return new;
end;
$$;

create trigger calendar_events_series_reminders
  before insert on public.calendar_events
  for each row execute function private.tg_series_occurrence_reminders();

-- -----------------------------------------------------------------------------
-- Privilegios de funciones
-- -----------------------------------------------------------------------------

revoke all on function
  private.format_local(timestamptz, text, text, boolean),
  private.sync_event_side_effects(uuid),
  private.tg_sync_event(),
  private.tg_sync_event_row(),
  private.tg_generated_task_exception(),
  private.notification_audiences(public.calendar_events, text),
  private.enqueue_push(public.notifications),
  private.process_one_reminder(public.reminder_jobs),
  private.process_reminder_jobs(integer),
  private.claim_push_deliveries(integer),
  private.complete_push_delivery(uuid, integer, text),
  private.dispatch_push(),
  private.my_recipient(),
  private.acknowledge_notification(uuid),
  private.save_push_subscription(uuid, text, text, text, text),
  private.delete_push_subscription(text),
  private.save_automation_rule(uuid, uuid, text, text, boolean, time, time, integer, text, uuid[], integer, text),
  private.reminders_health(uuid),
  private.set_event_automations(uuid, uuid, uuid[]),
  private.tg_series_occurrence_reminders()
from public, anon, authenticated;

grant execute on function
  private.my_recipient(),
  private.acknowledge_notification(uuid),
  private.save_push_subscription(uuid, text, text, text, text),
  private.delete_push_subscription(text),
  private.save_automation_rule(uuid, uuid, text, text, boolean, time, time, integer, text, uuid[], integer, text),
  private.reminders_health(uuid),
  private.set_event_automations(uuid, uuid, uuid[])
to authenticated;

grant execute on function
  private.claim_push_deliveries(integer),
  private.complete_push_delivery(uuid, integer, text)
to service_role;

revoke all on function
  public.acknowledge_notification(uuid),
  public.save_push_subscription(uuid, text, text, text, text),
  public.delete_push_subscription(text),
  public.save_automation_rule(uuid, uuid, text, text, boolean, time, time, integer, text, uuid[], integer, text),
  public.reminders_health(uuid),
  public.claim_push_deliveries(integer),
  public.complete_push_delivery(uuid, integer, text),
  public.create_event(uuid, uuid, text, uuid, boolean, timestamptz, timestamptz, date, date, text, text, text, text,
                      boolean, uuid[], text, integer[], uuid[]),
  public.update_event(uuid, integer, uuid, text, uuid, boolean, timestamptz, timestamptz, date, date, text, text,
                      text, text, boolean, uuid[], text, integer[], uuid[])
from public, anon;

grant execute on function
  public.acknowledge_notification(uuid),
  public.save_push_subscription(uuid, text, text, text, text),
  public.delete_push_subscription(text),
  public.save_automation_rule(uuid, uuid, text, text, boolean, time, time, integer, text, uuid[], integer, text),
  public.reminders_health(uuid),
  public.create_event(uuid, uuid, text, uuid, boolean, timestamptz, timestamptz, date, date, text, text, text, text,
                      boolean, uuid[], text, integer[], uuid[]),
  public.update_event(uuid, integer, uuid, text, uuid, boolean, timestamptz, timestamptz, date, date, text, text,
                      text, text, boolean, uuid[], text, integer[], uuid[])
to authenticated;

revoke all on function public.claim_push_deliveries(integer), public.complete_push_delivery(uuid, integer, text)
from authenticated;
grant execute on function public.claim_push_deliveries(integer), public.complete_push_delivery(uuid, integer, text)
to service_role;

-- -----------------------------------------------------------------------------
-- Trabajos programados
-- -----------------------------------------------------------------------------

select cron.schedule('cofi-process-reminders', '* * * * *', $$select private.process_reminder_jobs(200)$$);
select cron.schedule('cofi-dispatch-push', '* * * * *', $$select private.dispatch_push()$$);
