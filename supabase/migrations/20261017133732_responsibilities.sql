-- =============================================================================
-- COFI · Hito B · Recurrencias, responsabilidades infantiles, puntos y premios.
--
-- * Un único motor de recurrencias (private.recurrence_dates) para series de
--   eventos y plantillas de tareas/hábitos.
-- * Materialización idempotente con horizonte acotado; excepciones y
--   cancelaciones se conservan (restricción única serie/plantilla + fecha).
-- * Máquina de estados de tareas en funciones privadas: la entrega, la revisión
--   y el crédito de puntos son atómicos e idempotentes.
-- * Libro de puntos con saldo proyectado en una fila por integrante que se
--   bloquea (FOR UPDATE) para evitar saldos negativos por concurrencia.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Motor de recurrencias
-- -----------------------------------------------------------------------------

create or replace function private.recurrence_dates(
  p_freq text,
  p_interval integer,
  p_by_weekday smallint[],
  p_month_day smallint,
  p_missing text,
  p_starts_on date,
  p_until date,
  p_from date,
  p_to date
)
returns setof date
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_from date := greatest(p_starts_on, p_from);
  v_to date := least(coalesce(p_until, p_to), p_to);
  v_interval integer := greatest(coalesce(p_interval, 1), 1);
  v_month date;
  v_day integer;
  v_last integer;
  v_idx integer;
begin
  if v_from is null or v_to is null or v_from > v_to then
    return;
  end if;

  if p_freq = 'once' then
    if p_starts_on between v_from and v_to then
      return next p_starts_on;
    end if;
  elsif p_freq = 'daily' then
    return query
      select d::date from generate_series(v_from, v_to, interval '1 day') as g(d)
      where ((d::date - p_starts_on) % v_interval) = 0;
  elsif p_freq = 'weekdays' then
    return query
      select d::date from generate_series(v_from, v_to, interval '1 day') as g(d)
      where extract(isodow from d) between 1 and 5;
  elsif p_freq = 'weekly' then
    -- Semana n contada desde el lunes de la semana de inicio.
    return query
      select d::date from generate_series(v_from, v_to, interval '1 day') as g(d)
      where extract(isodow from d)::smallint = any (p_by_weekday)
        and ((((d::date - (extract(isodow from d)::integer - 1))
              - (p_starts_on - (extract(isodow from p_starts_on)::integer - 1))) / 7) % v_interval) = 0;
  elsif p_freq = 'monthly' then
    for v_month in
      select m::date from generate_series(date_trunc('month', v_from), date_trunc('month', v_to), interval '1 month') as g(m)
    loop
      v_idx := (extract(year from v_month)::integer * 12 + extract(month from v_month)::integer)
             - (extract(year from p_starts_on)::integer * 12 + extract(month from p_starts_on)::integer);
      continue when v_idx % v_interval <> 0;
      v_last := extract(day from (v_month + interval '1 month' - interval '1 day'))::integer;
      v_day := coalesce(p_month_day, extract(day from p_starts_on)::integer);
      if v_day > v_last then
        -- Política explícita: nunca se cambia silenciosamente el 31 por otra fecha.
        continue when p_missing = 'skip';
        v_day := v_last;
      end if;
      if (v_month + (v_day - 1)) between v_from and v_to then
        return next (v_month + (v_day - 1));
      end if;
    end loop;
  else
    perform private.raise_domain('INVALID', 'freq');
  end if;
end;
$$;

/** Fecha local de "hoy" en la zona de una familia. */
create or replace function private.family_today(p_family_id uuid)
returns date
language sql
stable
security definer
set search_path = ''
as $$
  select (now() at time zone f.timezone)::date from public.families f where f.id = p_family_id;
$$;

-- -----------------------------------------------------------------------------
-- Series de eventos
-- -----------------------------------------------------------------------------

create table public.event_series (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  category_id uuid,
  is_all_day boolean not null default false,
  start_time time,
  duration_minutes integer check (duration_minutes between 1 and 1440),
  timezone text not null,
  location text check (char_length(location) <= 200),
  description text check (char_length(description) <= 2000),
  visibility text not null default 'family' check (visibility in ('family', 'participants', 'adults')),
  importance text not null default 'normal' check (importance in ('normal', 'high')),
  whole_family boolean not null default false,
  freq text not null check (freq in ('daily', 'weekdays', 'weekly', 'monthly')),
  interval_count integer not null default 1 check (interval_count between 1 and 12),
  by_weekday smallint[] check (by_weekday <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[]),
  month_day smallint check (month_day between 1 and 31),
  missing_day_policy text not null default 'skip' check (missing_day_policy in ('skip', 'last_day')),
  starts_on date not null,
  until_on date,
  materialized_until date,
  status text not null default 'active' check (status in ('active', 'ended')),
  command_id uuid,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  constraint event_series_family_id_id_key unique (family_id, id),
  constraint event_series_command_key unique (family_id, command_id),
  constraint event_series_category_fk
    foreign key (family_id, category_id) references public.event_categories (family_id, id) on delete set null (category_id),
  constraint event_series_time_shape check (
    (is_all_day and start_time is null) or (not is_all_day and start_time is not null)),
  constraint event_series_weekly_days check (freq <> 'weekly' or cardinality(by_weekday) > 0),
  constraint event_series_until check (until_on is null or until_on >= starts_on)
);

create index event_series_family_idx on public.event_series (family_id, status);
create index event_series_category_idx on public.event_series (family_id, category_id);

create table public.event_series_participants (
  family_id uuid not null,
  series_id uuid not null,
  member_id uuid not null,
  primary key (family_id, series_id, member_id),
  constraint event_series_participants_series_fk
    foreign key (family_id, series_id) references public.event_series (family_id, id) on delete cascade,
  constraint event_series_participants_member_fk
    foreign key (family_id, member_id) references public.family_members (family_id, id) on delete cascade
);

create index event_series_participants_member_idx on public.event_series_participants (family_id, member_id);

alter table public.calendar_events
  add column series_id uuid,
  add column occurrence_date date,
  add column is_exception boolean not null default false,
  add constraint calendar_events_series_fk
    foreign key (family_id, series_id) references public.event_series (family_id, id) on delete cascade,
  add constraint calendar_events_series_occurrence_key unique (series_id, occurrence_date),
  add constraint calendar_events_series_shape check ((series_id is null) = (occurrence_date is null));

create index calendar_events_series_idx on public.calendar_events (family_id, series_id, occurrence_date);

-- Materializa las ocurrencias de una serie hasta `p_upto` (incluido), sin
-- generar fechas pasadas ni duplicados; excepciones y cancelaciones se respetan
-- porque la fila ya existe para esa fecha.
create or replace function private.materialize_event_series(p_series_id uuid, p_upto date)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.event_series;
  v_date date;
  v_event_id uuid;
  v_count integer := 0;
  v_today date;
begin
  select * into s from public.event_series where id = p_series_id for update;
  if not found or s.status <> 'active' then
    return 0;
  end if;
  v_today := (now() at time zone s.timezone)::date;

  for v_date in
    select d from private.recurrence_dates(
      s.freq, s.interval_count, s.by_weekday, s.month_day, s.missing_day_policy,
      s.starts_on, s.until_on, greatest(v_today, coalesce(s.materialized_until + 1, s.starts_on)), p_upto) as d
  loop
    insert into public.calendar_events (
      family_id, series_id, occurrence_date, title, category_id, is_all_day, starts_at, ends_at,
      start_date, end_date, timezone, location, description, visibility, importance, whole_family
    ) values (
      s.family_id, s.id, v_date, s.title, s.category_id, s.is_all_day,
      case when s.is_all_day then null else (v_date + s.start_time) at time zone s.timezone end,
      case when s.is_all_day or s.duration_minutes is null then null
           else ((v_date + s.start_time) at time zone s.timezone) + make_interval(mins => s.duration_minutes) end,
      case when s.is_all_day then v_date end,
      case when s.is_all_day then v_date + 1 end,
      s.timezone, s.location, s.description, s.visibility, s.importance, s.whole_family
    )
    on conflict (series_id, occurrence_date) do nothing
    returning id into v_event_id;

    if v_event_id is not null then
      insert into public.event_participants (family_id, event_id, member_id)
      select s.family_id, v_event_id, p.member_id
      from public.event_series_participants p
      where p.family_id = s.family_id and p.series_id = s.id;
      v_count := v_count + 1;
    end if;
  end loop;

  update public.event_series
  set materialized_until = greatest(coalesce(materialized_until, p_upto), p_upto)
  where id = s.id;
  return v_count;
end;
$$;

-- -----------------------------------------------------------------------------
-- Plantillas de responsabilidades y hábitos
-- -----------------------------------------------------------------------------

create table public.task_templates (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  kind text not null check (kind in ('chore', 'habit')),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  description text check (char_length(description) <= 500),
  points integer not null default 10 check (points between 0 and 1000),
  requires_review boolean not null default true,
  due_time time,
  timezone text not null,
  freq text not null check (freq in ('once', 'daily', 'weekdays', 'weekly', 'monthly')),
  interval_count integer not null default 1 check (interval_count between 1 and 12),
  by_weekday smallint[] check (by_weekday <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[]),
  month_day smallint check (month_day between 1 and 31),
  missing_day_policy text not null default 'skip' check (missing_day_policy in ('skip', 'last_day')),
  starts_on date not null,
  until_on date,
  materialized_until date,
  status text not null default 'active' check (status in ('active', 'paused', 'archived')),
  command_id uuid,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  constraint task_templates_family_id_id_key unique (family_id, id),
  constraint task_templates_command_key unique (family_id, command_id),
  constraint task_templates_weekly_days check (freq <> 'weekly' or cardinality(by_weekday) > 0),
  constraint task_templates_until check (until_on is null or until_on >= starts_on)
);

create index task_templates_family_idx on public.task_templates (family_id, status);

create table public.task_template_assignees (
  family_id uuid not null,
  template_id uuid not null,
  member_id uuid not null,
  primary key (family_id, template_id, member_id),
  constraint task_template_assignees_template_fk
    foreign key (family_id, template_id) references public.task_templates (family_id, id) on delete cascade,
  constraint task_template_assignees_member_fk
    foreign key (family_id, member_id) references public.family_members (family_id, id) on delete cascade
);

create index task_template_assignees_member_idx on public.task_template_assignees (family_id, member_id);

alter table public.task_occurrences
  add column template_id uuid,
  add column submitted_at timestamptz,
  add column submitted_by uuid,
  add column submitted_late boolean,
  add column reviewed_at timestamptz,
  add column reviewed_by uuid,
  add column review_note text check (char_length(review_note) <= 500),
  add column is_exception boolean not null default false,
  add constraint task_occurrences_template_fk
    foreign key (family_id, template_id) references public.task_templates (family_id, id) on delete cascade,
  add constraint task_occurrences_template_occurrence_key unique (template_id, assignee_member_id, due_date);

create index task_occurrences_template_idx on public.task_occurrences (family_id, template_id, due_date);

-- Una ocurrencia por hijo y fecha; nunca una casilla compartida.
create or replace function private.materialize_task_template(p_template_id uuid, p_upto date)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  t public.task_templates;
  v_count integer;
  v_today date;
begin
  select * into t from public.task_templates where id = p_template_id for update;
  if not found or t.status <> 'active' then
    return 0;
  end if;
  v_today := (now() at time zone t.timezone)::date;

  with dates as (
    select d from private.recurrence_dates(
      t.freq, t.interval_count, t.by_weekday, t.month_day, t.missing_day_policy,
      t.starts_on, t.until_on, greatest(v_today, coalesce(t.materialized_until + 1, t.starts_on)), p_upto) as d
  ), ins as (
    insert into public.task_occurrences (
      family_id, kind, template_id, title, notes, assignee_member_id, due_date, due_time, timezone,
      points, requires_review, visibility, status
    )
    select t.family_id, t.kind, t.id, t.title, t.description, a.member_id, dates.d, t.due_time, t.timezone,
           t.points, t.requires_review, 'family', 'pending'
    from dates
    cross join public.task_template_assignees a
    join public.family_members fm on fm.family_id = a.family_id and fm.id = a.member_id and fm.archived_at is null
    where a.family_id = t.family_id and a.template_id = t.id
    on conflict (template_id, assignee_member_id, due_date) do nothing
    returning 1
  )
  select count(*) into v_count from ins;

  update public.task_templates
  set materialized_until = greatest(coalesce(materialized_until, p_upto), p_upto)
  where id = t.id;
  return v_count;
end;
$$;

-- -----------------------------------------------------------------------------
-- Historial de revisión, puntos y premios
-- -----------------------------------------------------------------------------

create table public.task_reviews (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null,
  task_id uuid not null,
  action text not null check (action in ('submitted', 'approved', 'needs_correction', 'exempted', 'reopened', 'completed')),
  actor_user_id uuid,
  note text check (char_length(note) <= 500),
  points_delta integer not null default 0,
  created_at timestamptz not null default now(),
  constraint task_reviews_task_fk
    foreign key (family_id, task_id) references public.task_occurrences (family_id, id) on delete cascade
);

create index task_reviews_task_idx on public.task_reviews (family_id, task_id, created_at);

create table public.member_point_accounts (
  family_id uuid not null,
  member_id uuid not null,
  balance integer not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now(),
  primary key (family_id, member_id),
  constraint member_point_accounts_member_fk
    foreign key (family_id, member_id) references public.family_members (family_id, id) on delete cascade
);

create table public.points_ledger (
  id bigint generated always as identity primary key,
  family_id uuid not null,
  member_id uuid not null,
  amount integer not null check (amount <> 0 and amount between -100000 and 100000),
  kind text not null check (kind in ('task_credit', 'task_reversal', 'redemption_debit', 'redemption_refund', 'adjustment')),
  source_type text not null check (source_type in ('task', 'redemption', 'adjustment')),
  source_id uuid,
  idempotency_key text not null check (char_length(idempotency_key) between 3 and 200),
  reason text check (char_length(reason) <= 300),
  actor_user_id uuid,
  created_at timestamptz not null default now(),
  constraint points_ledger_idempotency_key unique (family_id, idempotency_key),
  constraint points_ledger_member_fk
    foreign key (family_id, member_id) references public.family_members (family_id, id) on delete cascade
);

create index points_ledger_member_idx on public.points_ledger (family_id, member_id, created_at desc);

create table public.rewards (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 80),
  description text check (char_length(description) <= 300),
  cost integer not null check (cost between 1 and 100000),
  is_available boolean not null default true,
  conditions text check (char_length(conditions) <= 300),
  archived_at timestamptz,
  command_id uuid,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  constraint rewards_family_id_id_key unique (family_id, id),
  constraint rewards_command_key unique (family_id, command_id)
);

create index rewards_family_idx on public.rewards (family_id) where archived_at is null;

-- Sin filas: el premio está disponible para todos los hijos.
create table public.reward_members (
  family_id uuid not null,
  reward_id uuid not null,
  member_id uuid not null,
  primary key (family_id, reward_id, member_id),
  constraint reward_members_reward_fk
    foreign key (family_id, reward_id) references public.rewards (family_id, id) on delete cascade,
  constraint reward_members_member_fk
    foreign key (family_id, member_id) references public.family_members (family_id, id) on delete cascade
);

create index reward_members_member_idx on public.reward_members (family_id, member_id);

create table public.reward_redemptions (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null,
  reward_id uuid not null,
  member_id uuid not null,
  reward_title text not null,
  cost integer not null check (cost > 0),
  status text not null default 'requested'
    check (status in ('requested', 'approved', 'delivered', 'rejected', 'cancelled')),
  requested_at timestamptz not null default now(),
  requested_by uuid,
  decided_at timestamptz,
  decided_by uuid,
  delivered_at timestamptz,
  cancelled_at timestamptz,
  note text check (char_length(note) <= 300),
  command_id uuid,
  version integer not null default 1,
  constraint reward_redemptions_family_id_id_key unique (family_id, id),
  constraint reward_redemptions_command_key unique (family_id, command_id),
  constraint reward_redemptions_reward_fk
    foreign key (family_id, reward_id) references public.rewards (family_id, id) on delete cascade,
  constraint reward_redemptions_member_fk
    foreign key (family_id, member_id) references public.family_members (family_id, id) on delete cascade
);

create index reward_redemptions_member_idx on public.reward_redemptions (family_id, member_id, requested_at desc);
create index reward_redemptions_open_idx on public.reward_redemptions (family_id, status)
  where status in ('requested', 'approved');
create index reward_redemptions_reward_idx on public.reward_redemptions (family_id, reward_id);

-- Mueve puntos de forma atómica e idempotente. Devuelve false si la clave ya
-- se había aplicado. Bloquea la cuenta del integrante para evitar carreras.
create or replace function private.ledger_apply(
  p_family_id uuid,
  p_member_id uuid,
  p_amount integer,
  p_kind text,
  p_source_type text,
  p_source_id uuid,
  p_key text,
  p_reason text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_balance integer;
  v_id bigint;
begin
  insert into public.member_point_accounts (family_id, member_id)
  values (p_family_id, p_member_id)
  on conflict (family_id, member_id) do nothing;

  select balance into v_balance from public.member_point_accounts
  where family_id = p_family_id and member_id = p_member_id
  for update;

  if exists (select 1 from public.points_ledger l where l.family_id = p_family_id and l.idempotency_key = p_key) then
    return false;
  end if;
  if v_balance + p_amount < 0 then
    perform private.raise_domain('INSUFFICIENT_BALANCE', v_balance::text);
  end if;

  insert into public.points_ledger (family_id, member_id, amount, kind, source_type, source_id,
                                    idempotency_key, reason, actor_user_id)
  values (p_family_id, p_member_id, p_amount, p_kind, p_source_type, p_source_id, p_key, p_reason, auth.uid())
  returning id into v_id;

  update public.member_point_accounts
  set balance = balance + p_amount, updated_at = now()
  where family_id = p_family_id and member_id = p_member_id;
  return true;
end;
$$;

-- -----------------------------------------------------------------------------
-- Actores autorizados (el Hito B2 amplía estas funciones con dispositivos)
-- -----------------------------------------------------------------------------

/** ¿Puede el actor entregar tareas o pedir premios por este integrante? */
create or replace function private.can_act_for_member(p_family_id uuid, p_member_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_family_adult(p_family_id);
$$;

-- -----------------------------------------------------------------------------
-- Triggers: versión y actor en las tablas nuevas
-- -----------------------------------------------------------------------------

create or replace function private.tg_versioned_biu()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if new.family_id <> old.family_id then
      perform private.raise_domain('FORBIDDEN', 'family_id');
    end if;
    new.version := old.version + 1;
    if to_jsonb(new) ? 'updated_at' then
      new := jsonb_populate_record(new, jsonb_build_object('updated_at', now()));
    end if;
  else
    new.version := 1;
  end if;
  return new;
end;
$$;

create trigger event_series_biu before insert or update on public.event_series
  for each row execute function private.tg_versioned_biu();
create trigger task_templates_biu before insert or update on public.task_templates
  for each row execute function private.tg_versioned_biu();
create trigger rewards_biu before insert or update on public.rewards
  for each row execute function private.tg_versioned_biu();
create trigger reward_redemptions_biu before insert or update on public.reward_redemptions
  for each row execute function private.tg_versioned_biu();

-- -----------------------------------------------------------------------------
-- RLS (adultos). Las escrituras van por RPC privados.
-- -----------------------------------------------------------------------------

alter table public.event_series enable row level security;
alter table public.event_series_participants enable row level security;
alter table public.task_templates enable row level security;
alter table public.task_template_assignees enable row level security;
alter table public.task_reviews enable row level security;
alter table public.member_point_accounts enable row level security;
alter table public.points_ledger enable row level security;
alter table public.rewards enable row level security;
alter table public.reward_members enable row level security;
alter table public.reward_redemptions enable row level security;

create policy event_series_select_adults on public.event_series
  for select to authenticated using (family_id in (select private.my_adult_family_ids()));
create policy event_series_participants_select_adults on public.event_series_participants
  for select to authenticated using (family_id in (select private.my_adult_family_ids()));
create policy task_templates_select_adults on public.task_templates
  for select to authenticated using (family_id in (select private.my_adult_family_ids()));
create policy task_template_assignees_select_adults on public.task_template_assignees
  for select to authenticated using (family_id in (select private.my_adult_family_ids()));
create policy task_reviews_select_adults on public.task_reviews
  for select to authenticated using (family_id in (select private.my_adult_family_ids()));
create policy member_point_accounts_select_adults on public.member_point_accounts
  for select to authenticated using (family_id in (select private.my_adult_family_ids()));
create policy points_ledger_select_adults on public.points_ledger
  for select to authenticated using (family_id in (select private.my_adult_family_ids()));
create policy rewards_select_adults on public.rewards
  for select to authenticated using (family_id in (select private.my_adult_family_ids()));
create policy reward_members_select_adults on public.reward_members
  for select to authenticated using (family_id in (select private.my_adult_family_ids()));
create policy reward_redemptions_select_adults on public.reward_redemptions
  for select to authenticated using (family_id in (select private.my_adult_family_ids()));

revoke all on table
  public.event_series, public.event_series_participants, public.task_templates,
  public.task_template_assignees, public.task_reviews, public.member_point_accounts,
  public.points_ledger, public.rewards, public.reward_members, public.reward_redemptions
from anon, authenticated;

grant select on
  public.event_series, public.event_series_participants, public.task_templates,
  public.task_template_assignees, public.task_reviews, public.member_point_accounts,
  public.points_ledger, public.rewards, public.reward_members, public.reward_redemptions
to authenticated;

-- Una ocurrencia de una serie que se edita o cancela pasa a ser excepción:
-- el generador nunca la sobrescribe ni la resucita.
create or replace function private.tg_calendar_events_series_exception()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.series_id is not null then
    new.is_exception := true;
  end if;
  return new;
end;
$$;

create trigger calendar_events_series_exception
  before update on public.calendar_events
  for each row execute function private.tg_calendar_events_series_exception();

-- -----------------------------------------------------------------------------
-- RPC: series de eventos
-- -----------------------------------------------------------------------------

create or replace function private.assert_rule(
  p_freq text, p_interval integer, p_by_weekday smallint[], p_month_day smallint, p_missing text,
  p_starts_on date, p_until date
)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_freq not in ('once', 'daily', 'weekdays', 'weekly', 'monthly')
     or coalesce(p_interval, 1) not between 1 and 12
     or (p_freq = 'weekly' and coalesce(cardinality(p_by_weekday), 0) = 0)
     or (p_month_day is not null and p_month_day not between 1 and 31)
     or coalesce(p_missing, 'skip') not in ('skip', 'last_day')
     or p_starts_on is null
     or (p_until is not null and p_until < p_starts_on) then
    perform private.raise_domain('INVALID', 'recurrence');
  end if;
end;
$$;

create or replace function private.create_event_series(
  p_family_id uuid,
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
  p_starts_on date,
  p_until date
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_tz text;
begin
  if auth.uid() is null then
    perform private.raise_domain('SESSION_REQUIRED');
  end if;
  if not private.is_family_adult(p_family_id) then
    perform private.raise_domain('FORBIDDEN');
  end if;
  if p_freq = 'once' then
    perform private.raise_domain('INVALID', 'freq');
  end if;
  perform private.assert_rule(p_freq, p_interval, p_by_weekday, p_month_day, p_missing, p_starts_on, p_until);

  select s.id into v_id from public.event_series s where s.family_id = p_family_id and s.command_id = p_command_id;
  if found then
    return v_id;
  end if;

  perform private.assert_active_members(p_family_id, p_participant_ids);
  select f.timezone into v_tz from public.families f where f.id = p_family_id;

  insert into public.event_series (
    family_id, title, category_id, is_all_day, start_time, duration_minutes, timezone, location, description,
    visibility, importance, whole_family, freq, interval_count, by_weekday, month_day, missing_day_policy,
    starts_on, until_on, command_id, created_by, updated_by
  ) values (
    p_family_id, btrim(p_title), p_category_id, p_is_all_day,
    case when p_is_all_day then null else p_start_time end,
    case when p_is_all_day then null else p_duration_minutes end,
    v_tz, nullif(btrim(p_location), ''), nullif(btrim(p_description), ''),
    p_visibility, p_importance, p_whole_family, p_freq, coalesce(p_interval, 1), p_by_weekday,
    p_month_day, coalesce(p_missing, 'skip'), p_starts_on, p_until, p_command_id, auth.uid(), auth.uid()
  )
  returning id into v_id;

  insert into public.event_series_participants (family_id, series_id, member_id)
  select p_family_id, v_id, x.member_id
  from (select distinct unnest(coalesce(p_participant_ids, '{}'::uuid[])) as member_id) x
  where not p_whole_family;

  perform private.materialize_event_series(v_id, (now() at time zone v_tz)::date + 60);
  perform private.audit(p_family_id, 'event_series.created', 'event_series', v_id);
  return v_id;
end;
$$;

-- Termina una serie desde una fecha: las ocurrencias futuras sin cambios
-- manuales se eliminan (o se cancelan si así se pide); las excepciones quedan.
create or replace function private.end_event_series(
  p_series_id uuid,
  p_from date,
  p_cancel_future boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.event_series;
begin
  select * into s from public.event_series where id = p_series_id for update;
  if not found or not private.is_family_adult(s.family_id) then
    perform private.raise_domain('NOT_FOUND', 'series');
  end if;

  if p_from <= s.starts_on then
    update public.event_series set status = 'ended', updated_by = auth.uid() where id = s.id;
  else
    update public.event_series
    set until_on = least(coalesce(until_on, p_from - 1), p_from - 1), updated_by = auth.uid()
    where id = s.id;
  end if;

  if p_cancel_future then
    update public.calendar_events e
    set status = 'cancelled', cancel_reason = 'Serie terminada'
    where e.series_id = s.id and e.occurrence_date >= p_from and not e.is_exception and e.status = 'scheduled';
  else
    delete from public.calendar_events e
    where e.series_id = s.id and e.occurrence_date >= p_from and not e.is_exception and e.status = 'scheduled';
  end if;
  perform private.audit(s.family_id, 'event_series.ended', 'event_series', s.id);
end;
$$;

-- -----------------------------------------------------------------------------
-- RPC: plantillas de tareas
-- -----------------------------------------------------------------------------

create or replace function private.assert_child_members(p_family_id uuid, p_member_ids uuid[])
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if coalesce(cardinality(p_member_ids), 0) = 0 or exists (
    select 1 from unnest(p_member_ids) as x(member_id)
    where not exists (
      select 1 from public.family_members fm
      where fm.family_id = p_family_id and fm.id = x.member_id and fm.archived_at is null and fm.kind = 'child'
    )
  ) then
    perform private.raise_domain('INVALID', 'assignees');
  end if;
end;
$$;

create or replace function private.save_task_template(
  p_family_id uuid,
  p_template_id uuid,
  p_expected_version integer,
  p_command_id uuid,
  p_kind text,
  p_title text,
  p_description text,
  p_points integer,
  p_requires_review boolean,
  p_due_time time,
  p_assignee_ids uuid[],
  p_freq text,
  p_interval integer,
  p_by_weekday smallint[],
  p_month_day smallint,
  p_missing text,
  p_starts_on date,
  p_until date
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  t public.task_templates;
  v_id uuid;
  v_tz text;
  v_today date;
begin
  if auth.uid() is null then
    perform private.raise_domain('SESSION_REQUIRED');
  end if;
  if not private.is_family_adult(p_family_id) then
    perform private.raise_domain('FORBIDDEN');
  end if;
  if p_kind not in ('chore', 'habit') then
    perform private.raise_domain('INVALID', 'kind');
  end if;
  perform private.assert_rule(p_freq, p_interval, p_by_weekday, p_month_day, p_missing, p_starts_on, p_until);
  perform private.assert_child_members(p_family_id, p_assignee_ids);
  select f.timezone into v_tz from public.families f where f.id = p_family_id;
  v_today := (now() at time zone v_tz)::date;

  if p_template_id is null then
    select x.id into v_id from public.task_templates x where x.family_id = p_family_id and x.command_id = p_command_id;
    if found then
      return v_id;
    end if;
    insert into public.task_templates (
      family_id, kind, title, description, points, requires_review, due_time, timezone, freq, interval_count,
      by_weekday, month_day, missing_day_policy, starts_on, until_on, command_id, created_by, updated_by
    ) values (
      p_family_id, p_kind, btrim(p_title), nullif(btrim(p_description), ''), p_points, p_requires_review,
      p_due_time, v_tz, p_freq, coalesce(p_interval, 1), p_by_weekday, p_month_day, coalesce(p_missing, 'skip'),
      p_starts_on, p_until, p_command_id, auth.uid(), auth.uid()
    ) returning id into v_id;
    perform private.audit(p_family_id, 'task_template.created', 'task_template', v_id);
  else
    select * into t from public.task_templates where id = p_template_id and family_id = p_family_id for update;
    if not found then
      perform private.raise_domain('NOT_FOUND', 'template');
    end if;
    if t.version <> p_expected_version then
      perform private.raise_domain('VERSION_CONFLICT', t.version::text);
    end if;
    update public.task_templates set
      kind = p_kind, title = btrim(p_title), description = nullif(btrim(p_description), ''),
      points = p_points, requires_review = p_requires_review, due_time = p_due_time,
      freq = p_freq, interval_count = coalesce(p_interval, 1), by_weekday = p_by_weekday,
      month_day = p_month_day, missing_day_policy = coalesce(p_missing, 'skip'),
      starts_on = p_starts_on, until_on = p_until, materialized_until = null, updated_by = auth.uid()
    where id = t.id;
    v_id := t.id;
    -- Las ocurrencias futuras aún no entregadas y sin ajustes manuales se
    -- regeneran con la nueva definición. Lo entregado o revisado se conserva.
    delete from public.task_occurrences o
    where o.template_id = v_id and o.due_date >= v_today and o.status = 'pending'
      and not o.is_exception and o.submitted_at is null;
    delete from public.task_template_assignees a where a.template_id = v_id;
    perform private.audit(p_family_id, 'task_template.updated', 'task_template', v_id);
  end if;

  insert into public.task_template_assignees (family_id, template_id, member_id)
  select p_family_id, v_id, x.member_id from (select distinct unnest(p_assignee_ids) as member_id) x
  on conflict do nothing;

  perform private.materialize_task_template(v_id, v_today + 14);
  return v_id;
end;
$$;

create or replace function private.set_task_template_status(p_template_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  t public.task_templates;
  v_today date;
begin
  select * into t from public.task_templates where id = p_template_id for update;
  if not found or not private.is_family_adult(t.family_id) then
    perform private.raise_domain('NOT_FOUND', 'template');
  end if;
  if p_status not in ('active', 'paused', 'archived') then
    perform private.raise_domain('INVALID', 'status');
  end if;
  v_today := (now() at time zone t.timezone)::date;
  update public.task_templates set status = p_status, updated_by = auth.uid(),
    materialized_until = case when p_status = 'active' then null else materialized_until end
  where id = t.id;
  if p_status = 'active' then
    perform private.materialize_task_template(t.id, v_today + 14);
  else
    -- Se mantiene lo de hoy; se quitan las ocurrencias futuras sin entregar.
    delete from public.task_occurrences o
    where o.template_id = t.id and o.due_date > v_today and o.status = 'pending'
      and not o.is_exception and o.submitted_at is null;
  end if;
  perform private.audit(t.family_id, 'task_template.' || p_status, 'task_template', t.id);
end;
$$;

-- Tarea puntual para un hijo (sin repetición), con la misma infraestructura.
-- Se representa como plantilla 'once' para conservar un único motor.

-- -----------------------------------------------------------------------------
-- RPC: máquina de estados de tareas infantiles
-- -----------------------------------------------------------------------------

create or replace function private.lock_child_task(p_task_id uuid)
returns public.task_occurrences
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_task public.task_occurrences;
begin
  select * into v_task from public.task_occurrences
  where id = p_task_id and kind in ('chore', 'habit')
  for update;
  if not found then
    perform private.raise_domain('NOT_FOUND', 'task');
  end if;
  return v_task;
end;
$$;

create or replace function private.submit_task(p_task_id uuid, p_command_id uuid)
returns public.task_occurrences
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_task public.task_occurrences;
  v_now timestamptz := now();
  v_late boolean;
  v_review_id uuid;
begin
  if auth.uid() is null then
    perform private.raise_domain('SESSION_REQUIRED');
  end if;
  v_task := private.lock_child_task(p_task_id);
  if not private.can_act_for_member(v_task.family_id, v_task.assignee_member_id) then
    perform private.raise_domain('NOT_FOUND', 'task');
  end if;
  if v_task.last_command_id = p_command_id or v_task.status in ('in_review', 'done') then
    return v_task; -- reintento o doble toque: sin efectos nuevos
  end if;
  if v_task.status not in ('pending', 'needs_correction') then
    perform private.raise_domain('INVALID', 'status');
  end if;

  -- Puntualidad: hora del servidor frente al límite en la zona familiar.
  v_late := case
    when v_task.due_at is not null then v_now > v_task.due_at
    else (v_now at time zone v_task.timezone)::date > v_task.due_date
  end;

  insert into public.task_reviews (family_id, task_id, action, actor_user_id)
  values (v_task.family_id, v_task.id, case when v_task.requires_review then 'submitted' else 'completed' end, auth.uid())
  returning id into v_review_id;

  update public.task_occurrences set
    status = case when v_task.requires_review then 'in_review' else 'done' end,
    submitted_at = v_now,
    submitted_by = auth.uid(),
    submitted_late = v_late,
    completed_at = case when v_task.requires_review then null else v_now end,
    review_note = null,
    last_command_id = p_command_id
  where id = v_task.id
  returning * into v_task;

  if not v_task.requires_review and v_task.points > 0 then
    perform private.ledger_apply(v_task.family_id, v_task.assignee_member_id, v_task.points, 'task_credit',
                                 'task', v_task.id, 'task-credit:' || v_review_id, v_task.title);
    update public.task_reviews set points_delta = v_task.points where id = v_review_id;
  end if;
  return v_task;
end;
$$;

create or replace function private.review_task(
  p_task_id uuid,
  p_expected_version integer,
  p_command_id uuid,
  p_decision text,
  p_note text
)
returns public.task_occurrences
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_task public.task_occurrences;
  v_now timestamptz := now();
  v_review_id uuid;
begin
  if auth.uid() is null then
    perform private.raise_domain('SESSION_REQUIRED');
  end if;
  v_task := private.lock_child_task(p_task_id);
  if not private.is_family_adult(v_task.family_id) then
    perform private.raise_domain('NOT_FOUND', 'task');
  end if;
  if v_task.last_command_id = p_command_id then
    return v_task;
  end if;
  if p_decision = 'approve' and v_task.status = 'done' then
    return v_task; -- aprobación simultánea o repetida: un solo crédito
  end if;
  if v_task.version <> p_expected_version then
    perform private.raise_domain('VERSION_CONFLICT', v_task.version::text);
  end if;
  if p_decision not in ('approve', 'needs_correction') then
    perform private.raise_domain('INVALID', 'decision');
  end if;
  if v_task.status not in ('in_review', 'pending', 'needs_correction') then
    perform private.raise_domain('INVALID', 'status');
  end if;

  insert into public.task_reviews (family_id, task_id, action, actor_user_id, note)
  values (v_task.family_id, v_task.id,
          case when p_decision = 'approve' then 'approved' else 'needs_correction' end,
          auth.uid(), nullif(btrim(p_note), ''))
  returning id into v_review_id;

  if p_decision = 'approve' then
    update public.task_occurrences set
      status = 'done',
      -- Si el adulto la marca sin entrega previa, cuenta desde ahora.
      submitted_at = coalesce(submitted_at, v_now),
      submitted_late = coalesce(submitted_late, case
        when due_at is not null then v_now > due_at
        else (v_now at time zone timezone)::date > due_date end),
      completed_at = v_now,
      reviewed_at = v_now,
      reviewed_by = auth.uid(),
      review_note = nullif(btrim(p_note), ''),
      last_command_id = p_command_id
    where id = v_task.id
    returning * into v_task;
    if v_task.points > 0 then
      perform private.ledger_apply(v_task.family_id, v_task.assignee_member_id, v_task.points, 'task_credit',
                                   'task', v_task.id, 'task-credit:' || v_review_id, v_task.title);
      update public.task_reviews set points_delta = v_task.points where id = v_review_id;
    end if;
  else
    update public.task_occurrences set
      status = 'needs_correction',
      reviewed_at = v_now,
      reviewed_by = auth.uid(),
      review_note = nullif(btrim(p_note), ''),
      last_command_id = p_command_id
    where id = v_task.id
    returning * into v_task;
  end if;
  perform private.audit(v_task.family_id, 'task.' || p_decision, 'task', v_task.id);
  return v_task;
end;
$$;

-- Eximir (no cuenta como incumplimiento) o reabrir/corregir un registro con
-- motivo. Reabrir una tarea cumplida revierte sus puntos con un movimiento
-- compensatorio único.
create or replace function private.adjust_task(
  p_task_id uuid,
  p_command_id uuid,
  p_action text,
  p_reason text
)
returns public.task_occurrences
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_task public.task_occurrences;
  v_review_id uuid;
  v_credit record;
begin
  if auth.uid() is null then
    perform private.raise_domain('SESSION_REQUIRED');
  end if;
  v_task := private.lock_child_task(p_task_id);
  if not private.is_family_adult(v_task.family_id) then
    perform private.raise_domain('NOT_FOUND', 'task');
  end if;
  if v_task.last_command_id = p_command_id then
    return v_task;
  end if;
  if nullif(btrim(p_reason), '') is null then
    perform private.raise_domain('INVALID', 'reason');
  end if;

  if p_action = 'exempt' then
    if v_task.status in ('done', 'exempt') then
      return v_task;
    end if;
    insert into public.task_reviews (family_id, task_id, action, actor_user_id, note)
    values (v_task.family_id, v_task.id, 'exempted', auth.uid(), btrim(p_reason));
    update public.task_occurrences set status = 'exempt', review_note = btrim(p_reason),
      reviewed_at = now(), reviewed_by = auth.uid(), last_command_id = p_command_id
    where id = v_task.id returning * into v_task;
  elsif p_action = 'reopen' then
    if v_task.status not in ('done', 'exempt', 'in_review') then
      return v_task;
    end if;
    insert into public.task_reviews (family_id, task_id, action, actor_user_id, note)
    values (v_task.family_id, v_task.id, 'reopened', auth.uid(), btrim(p_reason))
    returning id into v_review_id;
    -- Revertir los créditos aún no revertidos de esta ocurrencia.
    for v_credit in
      select l.id, l.amount from public.points_ledger l
      where l.family_id = v_task.family_id and l.source_type = 'task' and l.source_id = v_task.id
        and l.kind = 'task_credit'
        and not exists (
          select 1 from public.points_ledger r
          where r.family_id = l.family_id and r.idempotency_key = 'task-reversal:' || l.id
        )
    loop
      perform private.ledger_apply(v_task.family_id, v_task.assignee_member_id, -v_credit.amount, 'task_reversal',
                                   'task', v_task.id, 'task-reversal:' || v_credit.id, btrim(p_reason));
      update public.task_reviews set points_delta = points_delta - v_credit.amount where id = v_review_id;
    end loop;
    update public.task_occurrences set status = 'pending', completed_at = null, submitted_at = null,
      submitted_by = null, submitted_late = null, reviewed_at = null, reviewed_by = null,
      review_note = btrim(p_reason), last_command_id = p_command_id
    where id = v_task.id returning * into v_task;
  else
    perform private.raise_domain('INVALID', 'action');
  end if;
  perform private.audit(v_task.family_id, 'task.' || p_action, 'task', v_task.id);
  return v_task;
end;
$$;

-- -----------------------------------------------------------------------------
-- RPC: premios y canjes
-- -----------------------------------------------------------------------------

create or replace function private.save_reward(
  p_family_id uuid,
  p_reward_id uuid,
  p_command_id uuid,
  p_title text,
  p_description text,
  p_cost integer,
  p_is_available boolean,
  p_conditions text,
  p_member_ids uuid[]
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
  if coalesce(cardinality(p_member_ids), 0) > 0 then
    perform private.assert_child_members(p_family_id, p_member_ids);
  end if;

  if p_reward_id is null then
    select r.id into v_id from public.rewards r where r.family_id = p_family_id and r.command_id = p_command_id;
    if found then
      return v_id;
    end if;
    insert into public.rewards (family_id, title, description, cost, is_available, conditions, command_id, created_by)
    values (p_family_id, btrim(p_title), nullif(btrim(p_description), ''), p_cost, p_is_available,
            nullif(btrim(p_conditions), ''), p_command_id, auth.uid())
    returning id into v_id;
  else
    update public.rewards set title = btrim(p_title), description = nullif(btrim(p_description), ''),
      cost = p_cost, is_available = p_is_available, conditions = nullif(btrim(p_conditions), '')
    where id = p_reward_id and family_id = p_family_id
    returning id into v_id;
    if v_id is null then
      perform private.raise_domain('NOT_FOUND', 'reward');
    end if;
    delete from public.reward_members where reward_id = v_id and family_id = p_family_id;
  end if;

  insert into public.reward_members (family_id, reward_id, member_id)
  select p_family_id, v_id, x.member_id from (select distinct unnest(coalesce(p_member_ids, '{}'::uuid[])) as member_id) x;
  perform private.audit(p_family_id, 'reward.saved', 'reward', v_id);
  return v_id;
end;
$$;

create or replace function private.archive_reward(p_reward_id uuid, p_archived boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_family uuid;
begin
  select family_id into v_family from public.rewards where id = p_reward_id;
  if v_family is null or not private.is_family_adult(v_family) then
    perform private.raise_domain('NOT_FOUND', 'reward');
  end if;
  update public.rewards set archived_at = case when p_archived then now() end where id = p_reward_id;
end;
$$;

create or replace function private.request_redemption(p_reward_id uuid, p_member_id uuid, p_command_id uuid)
returns public.reward_redemptions
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.rewards;
  v_red public.reward_redemptions;
  v_balance integer;
begin
  if auth.uid() is null then
    perform private.raise_domain('SESSION_REQUIRED');
  end if;
  select * into r from public.rewards where id = p_reward_id;
  if not found or not private.can_act_for_member(r.family_id, p_member_id) then
    perform private.raise_domain('NOT_FOUND', 'reward');
  end if;

  select * into v_red from public.reward_redemptions x where x.family_id = r.family_id and x.command_id = p_command_id;
  if found then
    return v_red;
  end if;
  if not r.is_available or r.archived_at is not null
     or not exists (select 1 from public.family_members fm
                    where fm.family_id = r.family_id and fm.id = p_member_id and fm.kind = 'child' and fm.archived_at is null)
     or (exists (select 1 from public.reward_members rm where rm.reward_id = r.id)
         and not exists (select 1 from public.reward_members rm where rm.reward_id = r.id and rm.member_id = p_member_id)) then
    perform private.raise_domain('INVALID', 'reward_unavailable');
  end if;

  select coalesce((select balance from public.member_point_accounts a
                   where a.family_id = r.family_id and a.member_id = p_member_id), 0) into v_balance;
  if v_balance < r.cost then
    perform private.raise_domain('INSUFFICIENT_BALANCE', v_balance::text);
  end if;

  insert into public.reward_redemptions (family_id, reward_id, member_id, reward_title, cost, requested_by, command_id)
  values (r.family_id, r.id, p_member_id, r.title, r.cost, auth.uid(), p_command_id)
  returning * into v_red;
  perform private.audit(r.family_id, 'redemption.requested', 'redemption', v_red.id);
  return v_red;
end;
$$;

-- Aprobar descuenta el saldo con verificación atómica; cancelar algo ya
-- descontado registra un reembolso único.
create or replace function private.decide_redemption(p_redemption_id uuid, p_action text, p_note text)
returns public.reward_redemptions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_red public.reward_redemptions;
begin
  if auth.uid() is null then
    perform private.raise_domain('SESSION_REQUIRED');
  end if;
  select * into v_red from public.reward_redemptions where id = p_redemption_id for update;
  if not found then
    perform private.raise_domain('NOT_FOUND', 'redemption');
  end if;

  if p_action = 'cancel' then
    -- El hijo (o un adulto) puede cancelar una solicitud; solo un adulto
    -- puede cancelar un canje ya aprobado o entregado.
    if not private.can_act_for_member(v_red.family_id, v_red.member_id) then
      perform private.raise_domain('NOT_FOUND', 'redemption');
    end if;
    if v_red.status = 'cancelled' or v_red.status = 'rejected' then
      return v_red;
    end if;
    if v_red.status in ('approved', 'delivered') then
      if not private.is_family_adult(v_red.family_id) then
        perform private.raise_domain('FORBIDDEN');
      end if;
      perform private.ledger_apply(v_red.family_id, v_red.member_id, v_red.cost, 'redemption_refund',
                                   'redemption', v_red.id, 'redemption-refund:' || v_red.id, nullif(btrim(p_note), ''));
    end if;
    update public.reward_redemptions set status = 'cancelled', cancelled_at = now(), note = nullif(btrim(p_note), '')
    where id = v_red.id returning * into v_red;
  else
    if not private.is_family_adult(v_red.family_id) then
      perform private.raise_domain('NOT_FOUND', 'redemption');
    end if;
    if p_action = 'approve' then
      if v_red.status in ('approved', 'delivered') then
        return v_red;
      end if;
      if v_red.status <> 'requested' then
        perform private.raise_domain('INVALID', 'status');
      end if;
      perform private.ledger_apply(v_red.family_id, v_red.member_id, -v_red.cost, 'redemption_debit',
                                   'redemption', v_red.id, 'redemption-debit:' || v_red.id, v_red.reward_title);
      update public.reward_redemptions set status = 'approved', decided_at = now(), decided_by = auth.uid(),
        note = nullif(btrim(p_note), '')
      where id = v_red.id returning * into v_red;
    elsif p_action = 'reject' then
      if v_red.status = 'rejected' then
        return v_red;
      end if;
      if v_red.status <> 'requested' then
        perform private.raise_domain('INVALID', 'status');
      end if;
      update public.reward_redemptions set status = 'rejected', decided_at = now(), decided_by = auth.uid(),
        note = nullif(btrim(p_note), '')
      where id = v_red.id returning * into v_red;
    elsif p_action = 'deliver' then
      if v_red.status = 'delivered' then
        return v_red;
      end if;
      if v_red.status <> 'approved' then
        perform private.raise_domain('INVALID', 'status');
      end if;
      update public.reward_redemptions set status = 'delivered', delivered_at = now()
      where id = v_red.id returning * into v_red;
    else
      perform private.raise_domain('INVALID', 'action');
    end if;
  end if;
  perform private.audit(v_red.family_id, 'redemption.' || p_action, 'redemption', v_red.id);
  return v_red;
end;
$$;

create or replace function private.adjust_points(
  p_family_id uuid,
  p_member_id uuid,
  p_amount integer,
  p_reason text,
  p_command_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    perform private.raise_domain('SESSION_REQUIRED');
  end if;
  if not private.is_family_adult(p_family_id) then
    perform private.raise_domain('FORBIDDEN');
  end if;
  if p_amount = 0 or nullif(btrim(p_reason), '') is null then
    perform private.raise_domain('INVALID', 'adjustment');
  end if;
  perform private.assert_child_members(p_family_id, array[p_member_id]);
  perform private.ledger_apply(p_family_id, p_member_id, p_amount, 'adjustment', 'adjustment', null,
                               'adjustment:' || p_command_id, btrim(p_reason));
  perform private.audit(p_family_id, 'points.adjusted', 'member', p_member_id,
                        jsonb_build_object('amount', p_amount));
end;
$$;

-- -----------------------------------------------------------------------------
-- Horizonte: ampliación periódica (sin pantallas abiertas)
-- -----------------------------------------------------------------------------

create or replace function private.extend_horizons()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_series integer := 0;
  v_tasks integer := 0;
  v_row record;
begin
  for v_row in select s.id, s.timezone from public.event_series s where s.status = 'active' loop
    v_series := v_series + private.materialize_event_series(v_row.id, (now() at time zone v_row.timezone)::date + 60);
  end loop;
  for v_row in select t.id, t.timezone from public.task_templates t where t.status = 'active' loop
    v_tasks := v_tasks + private.materialize_task_template(v_row.id, (now() at time zone v_row.timezone)::date + 14);
  end loop;
  return jsonb_build_object('events', v_series, 'tasks', v_tasks);
end;
$$;

create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;

-- 05:20 UTC (00:20 en Lima). cron.schedule por nombre es idempotente.
select cron.schedule('cofi-extend-horizons', '20 5 * * *', $$select private.extend_horizons()$$);

-- -----------------------------------------------------------------------------
-- Envoltorios públicos (SECURITY INVOKER) y privilegios
-- -----------------------------------------------------------------------------

create or replace function public.create_event_series(
  p_family_id uuid, p_command_id uuid, p_title text, p_category_id uuid, p_is_all_day boolean,
  p_start_time time, p_duration_minutes integer, p_location text, p_description text, p_visibility text,
  p_importance text, p_whole_family boolean, p_participant_ids uuid[], p_freq text, p_interval integer,
  p_by_weekday smallint[], p_month_day smallint, p_missing text, p_starts_on date, p_until date
)
returns uuid language sql security invoker set search_path = '' as $$
  select private.create_event_series(p_family_id, p_command_id, p_title, p_category_id, p_is_all_day, p_start_time,
    p_duration_minutes, p_location, p_description, p_visibility, p_importance, p_whole_family, p_participant_ids,
    p_freq, p_interval, p_by_weekday, p_month_day, p_missing, p_starts_on, p_until);
$$;

create or replace function public.end_event_series(p_series_id uuid, p_from date, p_cancel_future boolean)
returns void language sql security invoker set search_path = '' as $$
  select private.end_event_series(p_series_id, p_from, p_cancel_future);
$$;

create or replace function public.save_task_template(
  p_family_id uuid, p_template_id uuid, p_expected_version integer, p_command_id uuid, p_kind text,
  p_title text, p_description text, p_points integer, p_requires_review boolean, p_due_time time,
  p_assignee_ids uuid[], p_freq text, p_interval integer, p_by_weekday smallint[], p_month_day smallint,
  p_missing text, p_starts_on date, p_until date
)
returns uuid language sql security invoker set search_path = '' as $$
  select private.save_task_template(p_family_id, p_template_id, p_expected_version, p_command_id, p_kind, p_title,
    p_description, p_points, p_requires_review, p_due_time, p_assignee_ids, p_freq, p_interval, p_by_weekday,
    p_month_day, p_missing, p_starts_on, p_until);
$$;

create or replace function public.set_task_template_status(p_template_id uuid, p_status text)
returns void language sql security invoker set search_path = '' as $$
  select private.set_task_template_status(p_template_id, p_status);
$$;

create or replace function public.submit_task(p_task_id uuid, p_command_id uuid)
returns public.task_occurrences language sql security invoker set search_path = '' as $$
  select * from private.submit_task(p_task_id, p_command_id);
$$;

create or replace function public.review_task(
  p_task_id uuid, p_expected_version integer, p_command_id uuid, p_decision text, p_note text
)
returns public.task_occurrences language sql security invoker set search_path = '' as $$
  select * from private.review_task(p_task_id, p_expected_version, p_command_id, p_decision, p_note);
$$;

create or replace function public.adjust_task(p_task_id uuid, p_command_id uuid, p_action text, p_reason text)
returns public.task_occurrences language sql security invoker set search_path = '' as $$
  select * from private.adjust_task(p_task_id, p_command_id, p_action, p_reason);
$$;

create or replace function public.save_reward(
  p_family_id uuid, p_reward_id uuid, p_command_id uuid, p_title text, p_description text, p_cost integer,
  p_is_available boolean, p_conditions text, p_member_ids uuid[]
)
returns uuid language sql security invoker set search_path = '' as $$
  select private.save_reward(p_family_id, p_reward_id, p_command_id, p_title, p_description, p_cost,
    p_is_available, p_conditions, p_member_ids);
$$;

create or replace function public.archive_reward(p_reward_id uuid, p_archived boolean)
returns void language sql security invoker set search_path = '' as $$
  select private.archive_reward(p_reward_id, p_archived);
$$;

create or replace function public.request_redemption(p_reward_id uuid, p_member_id uuid, p_command_id uuid)
returns public.reward_redemptions language sql security invoker set search_path = '' as $$
  select * from private.request_redemption(p_reward_id, p_member_id, p_command_id);
$$;

create or replace function public.decide_redemption(p_redemption_id uuid, p_action text, p_note text)
returns public.reward_redemptions language sql security invoker set search_path = '' as $$
  select * from private.decide_redemption(p_redemption_id, p_action, p_note);
$$;

create or replace function public.adjust_points(
  p_family_id uuid, p_member_id uuid, p_amount integer, p_reason text, p_command_id uuid
)
returns void language sql security invoker set search_path = '' as $$
  select private.adjust_points(p_family_id, p_member_id, p_amount, p_reason, p_command_id);
$$;

-- Privilegios: lo privado solo lo ejecuta authenticated (vía envoltorios);
-- materializadores y horizonte no se conceden a clientes.
revoke all on function
  private.recurrence_dates(text, integer, smallint[], smallint, text, date, date, date, date),
  private.family_today(uuid),
  private.materialize_event_series(uuid, date),
  private.materialize_task_template(uuid, date),
  private.ledger_apply(uuid, uuid, integer, text, text, uuid, text, text),
  private.extend_horizons(),
  private.can_act_for_member(uuid, uuid),
  private.tg_versioned_biu(),
  private.tg_calendar_events_series_exception(),
  private.assert_rule(text, integer, smallint[], smallint, text, date, date),
  private.assert_child_members(uuid, uuid[]),
  private.lock_child_task(uuid),
  private.create_event_series(uuid, uuid, text, uuid, boolean, time, integer, text, text, text, text, boolean,
                              uuid[], text, integer, smallint[], smallint, text, date, date),
  private.end_event_series(uuid, date, boolean),
  private.save_task_template(uuid, uuid, integer, uuid, text, text, text, integer, boolean, time, uuid[], text,
                             integer, smallint[], smallint, text, date, date),
  private.set_task_template_status(uuid, text),
  private.submit_task(uuid, uuid),
  private.review_task(uuid, integer, uuid, text, text),
  private.adjust_task(uuid, uuid, text, text),
  private.save_reward(uuid, uuid, uuid, text, text, integer, boolean, text, uuid[]),
  private.archive_reward(uuid, boolean),
  private.request_redemption(uuid, uuid, uuid),
  private.decide_redemption(uuid, text, text),
  private.adjust_points(uuid, uuid, integer, text, uuid)
from public, anon, authenticated;

grant execute on function
  private.create_event_series(uuid, uuid, text, uuid, boolean, time, integer, text, text, text, text, boolean,
                              uuid[], text, integer, smallint[], smallint, text, date, date),
  private.end_event_series(uuid, date, boolean),
  private.save_task_template(uuid, uuid, integer, uuid, text, text, text, integer, boolean, time, uuid[], text,
                             integer, smallint[], smallint, text, date, date),
  private.set_task_template_status(uuid, text),
  private.submit_task(uuid, uuid),
  private.review_task(uuid, integer, uuid, text, text),
  private.adjust_task(uuid, uuid, text, text),
  private.save_reward(uuid, uuid, uuid, text, text, integer, boolean, text, uuid[]),
  private.archive_reward(uuid, boolean),
  private.request_redemption(uuid, uuid, uuid),
  private.decide_redemption(uuid, text, text),
  private.adjust_points(uuid, uuid, integer, text, uuid),
  private.family_today(uuid),
  private.can_act_for_member(uuid, uuid)
to authenticated;

revoke all on function
  public.create_event_series(uuid, uuid, text, uuid, boolean, time, integer, text, text, text, text, boolean,
                             uuid[], text, integer, smallint[], smallint, text, date, date),
  public.end_event_series(uuid, date, boolean),
  public.save_task_template(uuid, uuid, integer, uuid, text, text, text, integer, boolean, time, uuid[], text,
                            integer, smallint[], smallint, text, date, date),
  public.set_task_template_status(uuid, text),
  public.submit_task(uuid, uuid),
  public.review_task(uuid, integer, uuid, text, text),
  public.adjust_task(uuid, uuid, text, text),
  public.save_reward(uuid, uuid, uuid, text, text, integer, boolean, text, uuid[]),
  public.archive_reward(uuid, boolean),
  public.request_redemption(uuid, uuid, uuid),
  public.decide_redemption(uuid, text, text),
  public.adjust_points(uuid, uuid, integer, text, uuid)
from public, anon;

grant execute on function
  public.create_event_series(uuid, uuid, text, uuid, boolean, time, integer, text, text, text, text, boolean,
                             uuid[], text, integer, smallint[], smallint, text, date, date),
  public.end_event_series(uuid, date, boolean),
  public.save_task_template(uuid, uuid, integer, uuid, text, text, text, integer, boolean, time, uuid[], text,
                            integer, smallint[], smallint, text, date, date),
  public.set_task_template_status(uuid, text),
  public.submit_task(uuid, uuid),
  public.review_task(uuid, integer, uuid, text, text),
  public.adjust_task(uuid, uuid, text, text),
  public.save_reward(uuid, uuid, uuid, text, text, integer, boolean, text, uuid[]),
  public.archive_reward(uuid, boolean),
  public.request_redemption(uuid, uuid, uuid),
  public.decide_redemption(uuid, text, text),
  public.adjust_points(uuid, uuid, integer, text, uuid)
to authenticated;
