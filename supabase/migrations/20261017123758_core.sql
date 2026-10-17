-- =============================================================================
-- COFI · Hito A · Núcleo: familias, integrantes, adultos, invitaciones,
-- categorías, agenda, pendientes del hogar y auditoría.
--
-- Principios:
--   * RLS activo en todas las tablas expuestas; políticas por operación.
--   * Privilegios mínimos: se revoca todo a anon/authenticated y se concede
--     explícitamente lo necesario (incluso por columna).
--   * La lógica privilegiada vive en el esquema `private` (no expuesto por la
--     Data API), con SECURITY DEFINER, search_path vacío y comprobación
--     explícita del actor. Los RPC públicos son SECURITY INVOKER.
--   * Claves foráneas compuestas (family_id, id) impiden mezclar familias.
--   * Los errores de dominio usan el prefijo 'COFI:' en el mensaje.
-- =============================================================================

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;
-- Las funciones nuevas de `private` no se conceden a nadie por defecto.
alter default privileges in schema private revoke execute on functions from public;
alter default privileges in schema private revoke execute on functions from anon, authenticated;

-- -----------------------------------------------------------------------------
-- Utilidades
-- -----------------------------------------------------------------------------

create or replace function private.raise_domain(p_code text, p_detail text default null)
returns void
language plpgsql
set search_path = ''
as $$
begin
  raise exception using
    errcode = 'P0001',
    message = 'COFI:' || p_code,
    detail = coalesce(p_detail, '');
end;
$$;

create or replace function private.is_valid_timezone(p_tz text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select p_tz is not null
    and (p_tz = 'UTC' or p_tz like '%/%')
    and p_tz not like 'posix/%'
    and p_tz not like 'right/%'
    and exists (select 1 from pg_catalog.pg_timezone_names t where t.name = p_tz);
$$;

create or replace function private.assert_timezone(p_tz text)
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if not private.is_valid_timezone(p_tz) then
    perform private.raise_domain('INVALID', 'timezone');
  end if;
end;
$$;

create or replace function private.initials(p_name text)
returns text
language sql
immutable
set search_path = ''
as $$
  select upper(
    left(coalesce(split_part(btrim(p_name), ' ', 1), ''), 1) ||
    left(coalesce(nullif(split_part(btrim(p_name), ' ', 2), ''), ''), 1)
  );
$$;

create or replace function private.is_anonymous_session()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false);
$$;

-- -----------------------------------------------------------------------------
-- Tablas
-- -----------------------------------------------------------------------------

create table public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  timezone text not null default 'America/Lima',
  locale text not null default 'es-PE' check (locale ~ '^es(-[A-Z]{2})?$'),
  time_format text not null default '12h' check (time_format in ('12h', '24h')),
  morning_ends time not null default '12:00',
  afternoon_ends time not null default '19:00',
  home_color text not null default '#FACC15' check (home_color ~ '^#[0-9A-Fa-f]{6}$'),
  created_by uuid,
  command_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  constraint families_day_parts_order check (morning_ends < afternoon_ends),
  constraint families_command_unique unique (created_by, command_id)
);

comment on table public.families is 'Espacio privado de cada familia («Mundo Familiar»).';

create table public.family_members (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 40),
  kind text not null check (kind in ('adult', 'child', 'other')),
  color text not null check (color ~ '^#[0-9A-Fa-f]{6}$'),
  initials text not null check (char_length(initials) between 1 and 3),
  avatar_emoji text check (char_length(avatar_emoji) <= 16),
  sort_order integer not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  constraint family_members_family_id_id_key unique (family_id, id)
);

comment on table public.family_members is
  'Personas de la familia. No son cuentas: un hijo puede no tener correo ni contraseña.';

create index family_members_family_active_idx
  on public.family_members (family_id, sort_order)
  where archived_at is null;

create table public.adult_memberships (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  member_id uuid not null,
  role text not null check (role in ('owner', 'admin')),
  status text not null default 'active' check (status in ('active', 'removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint adult_memberships_family_user_key unique (family_id, user_id),
  constraint adult_memberships_family_member_key unique (family_id, member_id),
  constraint adult_memberships_member_fk
    foreign key (family_id, member_id) references public.family_members (family_id, id)
);

comment on table public.adult_memberships is
  'Relación entre una identidad de Auth (adulto) y una familia, con su rol.';

create index adult_memberships_user_idx
  on public.adult_memberships (user_id, family_id);

create table public.family_invitations (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  email text not null check (email = lower(btrim(email)) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  role text not null default 'admin' check (role in ('owner', 'admin')),
  member_id uuid,
  token_hash bytea not null unique,
  expires_at timestamptz not null,
  created_by uuid,
  accepted_by uuid,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint family_invitations_member_fk
    foreign key (family_id, member_id) references public.family_members (family_id, id)
);

comment on column public.family_invitations.token_hash is
  'SHA-256 del token de un solo uso. El token en claro nunca se guarda.';

create index family_invitations_family_idx
  on public.family_invitations (family_id, created_at desc);
create index family_invitations_member_idx on public.family_invitations (family_id, member_id);

create table public.event_categories (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  key text not null check (key ~ '^[a-z0-9_-]{1,32}$'),
  label text not null check (char_length(btrim(label)) between 1 and 40),
  icon text not null default 'tag' check (icon ~ '^[a-z0-9-]{1,40}$'),
  sort_order integer not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  constraint event_categories_family_key_key unique (family_id, key),
  constraint event_categories_family_id_id_key unique (family_id, id)
);

create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  category_id uuid,
  is_all_day boolean not null default false,
  starts_at timestamptz,
  ends_at timestamptz,
  start_date date,
  end_date date,
  timezone text not null,
  local_start_date date not null,
  local_end_date date not null,
  location text check (char_length(location) <= 200),
  description text check (char_length(description) <= 2000),
  visibility text not null default 'family' check (visibility in ('family', 'participants', 'adults')),
  importance text not null default 'normal' check (importance in ('normal', 'high')),
  whole_family boolean not null default false,
  status text not null default 'scheduled' check (status in ('scheduled', 'cancelled')),
  cancel_reason text check (char_length(cancel_reason) <= 300),
  cancelled_at timestamptz,
  cancelled_by uuid,
  command_id uuid,
  last_command_id uuid,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  constraint calendar_events_family_id_id_key unique (family_id, id),
  constraint calendar_events_command_key unique (family_id, command_id),
  constraint calendar_events_category_fk
    foreign key (family_id, category_id) references public.event_categories (family_id, id),
  constraint calendar_events_time_shape check (
    (is_all_day
      and start_date is not null and end_date is not null and end_date > start_date
      and starts_at is null and ends_at is null)
    or
    (not is_all_day
      and starts_at is not null and start_date is null and end_date is null
      and (ends_at is null or ends_at > starts_at))
  ),
  -- Un evento abarca como máximo 62 días locales: permite consultar rangos con
  -- el índice por fecha de inicio sin escanear todo el historial.
  constraint calendar_events_max_span check (local_end_date >= local_start_date
    and local_end_date - local_start_date <= 62)
);

comment on column public.calendar_events.end_date is
  'Fin exclusivo para eventos de día completo (fecha local, sin hora).';
comment on column public.calendar_events.local_start_date is
  'Fecha local de inicio en la zona del evento; derivada por trigger.';
comment on column public.calendar_events.local_end_date is
  'Última fecha local (inclusive) que toca el evento; derivada por trigger.';

create index calendar_events_family_range_idx
  on public.calendar_events (family_id, local_start_date, local_end_date);
create index calendar_events_category_idx on public.calendar_events (family_id, category_id);

create table public.event_participants (
  family_id uuid not null,
  event_id uuid not null,
  member_id uuid not null,
  primary key (family_id, event_id, member_id),
  constraint event_participants_event_fk
    foreign key (family_id, event_id) references public.calendar_events (family_id, id) on delete cascade,
  constraint event_participants_member_fk
    foreign key (family_id, member_id) references public.family_members (family_id, id)
);

create index event_participants_member_idx on public.event_participants (family_id, member_id);

create table public.calendar_event_private_notes (
  event_id uuid primary key,
  family_id uuid not null,
  notes text not null check (char_length(notes) between 1 and 4000),
  updated_by uuid,
  updated_at timestamptz not null default now(),
  constraint calendar_event_private_notes_event_fk
    foreign key (family_id, event_id) references public.calendar_events (family_id, id) on delete cascade
);

create index calendar_event_private_notes_family_idx
  on public.calendar_event_private_notes (family_id, event_id);

comment on table public.calendar_event_private_notes is
  'Notas solo para adultos. Nunca se proyectan en pantallas comunes ni de hijos.';

create table public.task_occurrences (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  kind text not null check (kind in ('household', 'chore', 'habit')),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  notes text check (char_length(notes) <= 1000),
  assignee_member_id uuid,
  due_date date,
  due_time time,
  due_at timestamptz,
  timezone text not null,
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high')),
  visibility text not null default 'family' check (visibility in ('family', 'adults')),
  status text not null default 'pending',
  points integer not null default 0 check (points between 0 and 1000),
  requires_review boolean not null default false,
  completed_at timestamptz,
  completed_by uuid,
  command_id uuid,
  last_command_id uuid,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  constraint task_occurrences_family_id_id_key unique (family_id, id),
  constraint task_occurrences_command_key unique (family_id, command_id),
  constraint task_occurrences_assignee_fk
    foreign key (family_id, assignee_member_id) references public.family_members (family_id, id),
  -- Un pendiente doméstico nunca entrega puntos ni requiere revisión infantil.
  constraint task_occurrences_household_rules check (
    kind <> 'household'
    or (points = 0 and requires_review = false and status in ('pending', 'done', 'cancelled'))
  ),
  constraint task_occurrences_child_rules check (
    kind = 'household'
    or (assignee_member_id is not null and due_date is not null
        and status in ('pending', 'in_review', 'done', 'needs_correction', 'exempt', 'cancelled'))
  ),
  constraint task_occurrences_due_shape check (
    (due_time is null or due_date is not null) and ((due_time is null) = (due_at is null))
  )
);

comment on table public.task_occurrences is
  'Obligación concreta: pendiente del hogar (sin puntos) o responsabilidad/hábito de un hijo en una fecha.';

create index task_occurrences_family_due_idx
  on public.task_occurrences (family_id, kind, due_date);
create index task_occurrences_open_idx
  on public.task_occurrences (family_id, kind)
  where status in ('pending', 'in_review', 'needs_correction');
create index task_occurrences_assignee_idx
  on public.task_occurrences (family_id, assignee_member_id, due_date);

create table public.audit_log (
  id bigint generated always as identity primary key,
  family_id uuid not null references public.families (id) on delete cascade,
  actor_user_id uuid,
  action text not null check (action ~ '^[a-z_.]{3,64}$'),
  object_type text not null,
  object_id uuid,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.audit_log is
  'Acciones relevantes con contexto mínimo. Sin títulos privados, notas, tokens ni códigos.';

create index audit_log_family_created_idx on public.audit_log (family_id, created_at desc);

-- -----------------------------------------------------------------------------
-- Funciones auxiliares de autorización (sin recursión: leen como definer)
-- -----------------------------------------------------------------------------

create or replace function private.my_adult_family_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.family_id
  from public.adult_memberships m
  where m.user_id = (select auth.uid())
    and m.status = 'active';
$$;

create or replace function private.is_family_adult(p_family_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.adult_memberships m
    where m.family_id = p_family_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
  );
$$;

create or replace function private.is_family_owner(p_family_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.adult_memberships m
    where m.family_id = p_family_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and m.role = 'owner'
  );
$$;

create or replace function private.audit(
  p_family_id uuid,
  p_action text,
  p_object_type text,
  p_object_id uuid,
  p_meta jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Solo se audita en nombre de un actor con acceso a esa familia
  -- (o de un proceso de servidor sin sesión, p. ej. semillas/cron).
  if auth.uid() is not null and not private.is_family_adult(p_family_id) then
    perform private.raise_domain('FORBIDDEN', 'audit');
  end if;
  insert into public.audit_log (family_id, actor_user_id, action, object_type, object_id, meta)
  values (p_family_id, auth.uid(), p_action, p_object_type, p_object_id, coalesce(p_meta, '{}'::jsonb));
end;
$$;

-- -----------------------------------------------------------------------------
-- Triggers de integridad
-- -----------------------------------------------------------------------------

create or replace function private.tg_families_biu()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform private.assert_timezone(new.timezone);
  if tg_op = 'UPDATE' then
    new.id := old.id;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
    new.command_id := old.command_id;
    new.version := old.version + 1;
    new.updated_at := now();
  end if;
  return new;
end;
$$;

create trigger families_biu
  before insert or update on public.families
  for each row execute function private.tg_families_biu();

create or replace function private.tg_family_members_biu()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.initials is null or btrim(new.initials) = '' then
    new.initials := private.initials(new.display_name);
  end if;
  new.initials := upper(btrim(new.initials));
  new.display_name := btrim(new.display_name);
  if tg_op = 'UPDATE' then
    if new.family_id <> old.family_id then
      perform private.raise_domain('FORBIDDEN', 'family_id');
    end if;
    -- Un integrante vinculado a un adulto activo no puede dejar de ser adulto
    -- ni archivarse sin retirar antes su acceso.
    if (new.kind <> 'adult' or new.archived_at is not null)
       and exists (
         select 1 from public.adult_memberships m
         where m.family_id = new.family_id and m.member_id = new.id and m.status = 'active'
       ) then
      perform private.raise_domain('MEMBER_HAS_ACCOUNT');
    end if;
    new.created_at := old.created_at;
    new.version := old.version + 1;
    new.updated_at := now();
  end if;
  return new;
end;
$$;

create trigger family_members_biu
  before insert or update on public.family_members
  for each row execute function private.tg_family_members_biu();

create or replace function private.tg_adult_memberships_bu()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.family_id <> old.family_id or new.user_id <> old.user_id then
    perform private.raise_domain('FORBIDDEN', 'membership');
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger adult_memberships_bu
  before update on public.adult_memberships
  for each row execute function private.tg_adult_memberships_bu();

-- Nunca dejar una familia sin propietario activo (se evalúa al confirmar).
create or replace function private.tg_ensure_family_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.families f where f.id = old.family_id)
     and not exists (
       select 1 from public.adult_memberships m
       where m.family_id = old.family_id and m.role = 'owner' and m.status = 'active'
     ) then
    perform private.raise_domain('LAST_OWNER');
  end if;
  return null;
end;
$$;

create constraint trigger adult_memberships_keep_owner
  after update or delete on public.adult_memberships
  deferrable initially deferred
  for each row execute function private.tg_ensure_family_owner();

create or replace function private.tg_family_scoped_bu()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.family_id <> old.family_id then
    perform private.raise_domain('FORBIDDEN', 'family_id');
  end if;
  return new;
end;
$$;

create trigger event_categories_bu
  before update on public.event_categories
  for each row execute function private.tg_family_scoped_bu();

create trigger family_invitations_bu
  before update on public.family_invitations
  for each row execute function private.tg_family_scoped_bu();

create trigger event_participants_bu
  before update on public.event_participants
  for each row execute function private.tg_family_scoped_bu();

create or replace function private.tg_private_notes_biu()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.family_id <> old.family_id then
    perform private.raise_domain('FORBIDDEN', 'family_id');
  end if;
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  new.updated_at := now();
  return new;
end;
$$;

create trigger calendar_event_private_notes_biu
  before insert or update on public.calendar_event_private_notes
  for each row execute function private.tg_private_notes_biu();

create or replace function private.tg_calendar_events_biu()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if new.family_id <> old.family_id then
      perform private.raise_domain('FORBIDDEN', 'family_id');
    end if;
    new.id := old.id;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
    new.command_id := old.command_id;
    new.version := old.version + 1;
    new.updated_at := now();
    new.updated_by := coalesce(auth.uid(), new.updated_by);
  else
    new.created_by := coalesce(auth.uid(), new.created_by);
    new.updated_by := new.created_by;
    new.version := 1;
    new.created_at := now();
    new.updated_at := now();
  end if;

  perform private.assert_timezone(new.timezone);

  if new.is_all_day then
    new.local_start_date := new.start_date;
    new.local_end_date := new.end_date - 1;
  else
    new.local_start_date := (new.starts_at at time zone new.timezone)::date;
    if new.ends_at is null or new.ends_at <= new.starts_at then
      new.local_end_date := new.local_start_date;
    else
      -- Un evento que termina exactamente a medianoche no toca el día siguiente.
      new.local_end_date := greatest(
        new.local_start_date,
        ((new.ends_at - interval '1 microsecond') at time zone new.timezone)::date
      );
    end if;
  end if;

  if new.status = 'cancelled' then
    if tg_op = 'INSERT' or old.status <> 'cancelled' then
      new.cancelled_at := now();
      new.cancelled_by := auth.uid();
    end if;
  else
    new.cancelled_at := null;
    new.cancelled_by := null;
    new.cancel_reason := null;
  end if;
  return new;
end;
$$;

create trigger calendar_events_biu
  before insert or update on public.calendar_events
  for each row execute function private.tg_calendar_events_biu();

create or replace function private.tg_task_occurrences_biu()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if new.family_id <> old.family_id or new.kind <> old.kind then
      perform private.raise_domain('FORBIDDEN', 'family_id');
    end if;
    new.id := old.id;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
    new.command_id := old.command_id;
    new.version := old.version + 1;
    new.updated_at := now();
    new.updated_by := coalesce(auth.uid(), new.updated_by);
  else
    new.created_by := coalesce(auth.uid(), new.created_by);
    new.updated_by := new.created_by;
    new.version := 1;
    new.created_at := now();
    new.updated_at := now();
  end if;

  perform private.assert_timezone(new.timezone);

  if new.due_time is not null and new.due_date is not null then
    -- Hora local en la zona familiar → instante (respeta cambios de horario).
    new.due_at := (new.due_date + new.due_time) at time zone new.timezone;
  else
    new.due_at := null;
  end if;
  return new;
end;
$$;

create trigger task_occurrences_biu
  before insert or update on public.task_occurrences
  for each row execute function private.tg_task_occurrences_biu();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------

alter table public.families enable row level security;
alter table public.family_members enable row level security;
alter table public.adult_memberships enable row level security;
alter table public.family_invitations enable row level security;
alter table public.event_categories enable row level security;
alter table public.calendar_events enable row level security;
alter table public.event_participants enable row level security;
alter table public.calendar_event_private_notes enable row level security;
alter table public.task_occurrences enable row level security;
alter table public.audit_log enable row level security;

-- families
create policy families_select_adults on public.families
  for select to authenticated
  using (id in (select private.my_adult_family_ids()));
create policy families_update_adults on public.families
  for update to authenticated
  using (id in (select private.my_adult_family_ids()))
  with check (id in (select private.my_adult_family_ids()));

-- family_members
create policy family_members_select_adults on public.family_members
  for select to authenticated
  using (family_id in (select private.my_adult_family_ids()));
create policy family_members_insert_adults on public.family_members
  for insert to authenticated
  with check (family_id in (select private.my_adult_family_ids()));
create policy family_members_update_adults on public.family_members
  for update to authenticated
  using (family_id in (select private.my_adult_family_ids()))
  with check (family_id in (select private.my_adult_family_ids()));

-- adult_memberships (escrituras solo por RPC)
create policy adult_memberships_select_adults on public.adult_memberships
  for select to authenticated
  using (family_id in (select private.my_adult_family_ids()));

-- family_invitations (escrituras solo por RPC; token_hash no se concede)
create policy family_invitations_select_adults on public.family_invitations
  for select to authenticated
  using (family_id in (select private.my_adult_family_ids()));

-- event_categories
create policy event_categories_select_adults on public.event_categories
  for select to authenticated
  using (family_id in (select private.my_adult_family_ids()));
create policy event_categories_insert_adults on public.event_categories
  for insert to authenticated
  with check (family_id in (select private.my_adult_family_ids()));
create policy event_categories_update_adults on public.event_categories
  for update to authenticated
  using (family_id in (select private.my_adult_family_ids()))
  with check (family_id in (select private.my_adult_family_ids()));

-- calendar_events (sin borrado: se cancelan)
create policy calendar_events_select_adults on public.calendar_events
  for select to authenticated
  using (family_id in (select private.my_adult_family_ids()));
create policy calendar_events_insert_adults on public.calendar_events
  for insert to authenticated
  with check (family_id in (select private.my_adult_family_ids()));
create policy calendar_events_update_adults on public.calendar_events
  for update to authenticated
  using (family_id in (select private.my_adult_family_ids()))
  with check (family_id in (select private.my_adult_family_ids()));

-- event_participants
create policy event_participants_select_adults on public.event_participants
  for select to authenticated
  using (family_id in (select private.my_adult_family_ids()));
create policy event_participants_insert_adults on public.event_participants
  for insert to authenticated
  with check (family_id in (select private.my_adult_family_ids()));
create policy event_participants_delete_adults on public.event_participants
  for delete to authenticated
  using (family_id in (select private.my_adult_family_ids()));

-- calendar_event_private_notes (solo adultos)
create policy private_notes_select_adults on public.calendar_event_private_notes
  for select to authenticated
  using (family_id in (select private.my_adult_family_ids()));
create policy private_notes_insert_adults on public.calendar_event_private_notes
  for insert to authenticated
  with check (family_id in (select private.my_adult_family_ids()));
create policy private_notes_update_adults on public.calendar_event_private_notes
  for update to authenticated
  using (family_id in (select private.my_adult_family_ids()))
  with check (family_id in (select private.my_adult_family_ids()));
create policy private_notes_delete_adults on public.calendar_event_private_notes
  for delete to authenticated
  using (family_id in (select private.my_adult_family_ids()));

-- task_occurrences (los adultos crean directamente solo pendientes del hogar;
-- los cambios de estado van por RPC)
create policy task_occurrences_select_adults on public.task_occurrences
  for select to authenticated
  using (family_id in (select private.my_adult_family_ids()));
create policy task_occurrences_insert_household on public.task_occurrences
  for insert to authenticated
  with check (
    family_id in (select private.my_adult_family_ids())
    and kind = 'household'
    and status = 'pending'
  );
create policy task_occurrences_update_adults on public.task_occurrences
  for update to authenticated
  using (family_id in (select private.my_adult_family_ids()))
  with check (family_id in (select private.my_adult_family_ids()));

-- audit_log (lectura para adultos; escritura solo por private.audit)
create policy audit_log_select_adults on public.audit_log
  for select to authenticated
  using (family_id in (select private.my_adult_family_ids()));

-- -----------------------------------------------------------------------------
-- Privilegios mínimos
-- -----------------------------------------------------------------------------

revoke all on table
  public.families, public.family_members, public.adult_memberships,
  public.family_invitations, public.event_categories, public.calendar_events,
  public.event_participants, public.calendar_event_private_notes,
  public.task_occurrences, public.audit_log
from anon, authenticated;

grant select on public.families to authenticated;
grant update (name, timezone, time_format, morning_ends, afternoon_ends, home_color)
  on public.families to authenticated;

grant select on public.family_members to authenticated;
grant insert (family_id, display_name, kind, color, initials, avatar_emoji, sort_order)
  on public.family_members to authenticated;
grant update (display_name, kind, color, initials, avatar_emoji, sort_order, archived_at)
  on public.family_members to authenticated;

grant select on public.adult_memberships to authenticated;

grant select (id, family_id, email, role, member_id, expires_at, created_by,
              accepted_by, accepted_at, revoked_at, created_at)
  on public.family_invitations to authenticated;

grant select on public.event_categories to authenticated;
grant insert (family_id, key, label, icon, sort_order) on public.event_categories to authenticated;
grant update (label, icon, sort_order, archived_at) on public.event_categories to authenticated;

grant select on public.calendar_events to authenticated;
grant insert (family_id, title, category_id, is_all_day, starts_at, ends_at, start_date, end_date,
              timezone, location, description, visibility, importance, whole_family, status,
              command_id, last_command_id)
  on public.calendar_events to authenticated;
grant update (title, category_id, is_all_day, starts_at, ends_at, start_date, end_date,
              location, description, visibility, importance, whole_family, status,
              cancel_reason, last_command_id)
  on public.calendar_events to authenticated;

grant select, insert, delete on public.event_participants to authenticated;

grant select, insert, delete on public.calendar_event_private_notes to authenticated;
grant update (notes) on public.calendar_event_private_notes to authenticated;

grant select on public.task_occurrences to authenticated;
grant insert (family_id, kind, title, notes, assignee_member_id, due_date, due_time, timezone,
              priority, visibility, command_id, last_command_id)
  on public.task_occurrences to authenticated;
grant update (title, notes, assignee_member_id, due_date, due_time, priority, visibility,
              last_command_id)
  on public.task_occurrences to authenticated;

grant select on public.audit_log to authenticated;

-- Funciones privadas: nadie las ejecuta salvo lo concedido explícitamente.
revoke all on all functions in schema private from public, anon;
grant execute on function
  private.raise_domain(text, text),
  private.is_valid_timezone(text),
  private.assert_timezone(text),
  private.initials(text),
  private.is_anonymous_session(),
  private.my_adult_family_ids(),
  private.is_family_adult(uuid),
  private.is_family_owner(uuid),
  private.audit(uuid, text, text, uuid, jsonb)
to authenticated;

-- -----------------------------------------------------------------------------
-- Casos de uso transaccionales
-- -----------------------------------------------------------------------------

-- Crear familia + integrante adulto + pertenencia de propietario + categorías.
create or replace function private.create_family(
  p_command_id uuid,
  p_name text,
  p_timezone text,
  p_owner_display_name text,
  p_owner_color text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_family_id uuid;
  v_member_id uuid;
begin
  if v_uid is null then
    perform private.raise_domain('SESSION_REQUIRED');
  end if;
  if private.is_anonymous_session() then
    perform private.raise_domain('FORBIDDEN', 'anonymous');
  end if;

  select f.id into v_family_id
  from public.families f
  where f.created_by = v_uid and f.command_id = p_command_id;
  if found then
    return v_family_id; -- comando repetido: sin efectos nuevos
  end if;

  if (select count(*) from public.adult_memberships m
      where m.user_id = v_uid and m.role = 'owner' and m.status = 'active') >= 5 then
    perform private.raise_domain('LIMIT_REACHED', 'families');
  end if;

  insert into public.families (name, timezone, created_by, command_id)
  values (btrim(p_name), p_timezone, v_uid, p_command_id)
  returning id into v_family_id;

  insert into public.family_members (family_id, display_name, kind, color, initials)
  values (v_family_id, btrim(p_owner_display_name), 'adult', p_owner_color,
          private.initials(p_owner_display_name))
  returning id into v_member_id;

  insert into public.adult_memberships (family_id, user_id, member_id, role)
  values (v_family_id, v_uid, v_member_id, 'owner');

  insert into public.event_categories (family_id, key, label, icon, sort_order)
  values
    (v_family_id, 'visita', 'Visita', 'door-open', 10),
    (v_family_id, 'colegio', 'Colegio', 'school', 20),
    (v_family_id, 'salud', 'Salud', 'stethoscope', 30),
    (v_family_id, 'hogar', 'Hogar', 'house', 40),
    (v_family_id, 'trabajo', 'Trabajo', 'briefcase', 50),
    (v_family_id, 'pagos', 'Pagos y trámites', 'receipt', 60),
    (v_family_id, 'otro', 'Otro', 'tag', 90);

  perform private.audit(v_family_id, 'family.created', 'family', v_family_id);
  return v_family_id;
end;
$$;

create or replace function public.create_family(
  p_command_id uuid,
  p_name text,
  p_timezone text,
  p_owner_display_name text,
  p_owner_color text
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.create_family(p_command_id, p_name, p_timezone, p_owner_display_name, p_owner_color);
$$;

-- Invitaciones de adultos (solo propietarios).
create or replace function private.create_invitation(
  p_family_id uuid,
  p_email text,
  p_role text default 'admin',
  p_member_id uuid default null
)
returns table (invitation_id uuid, token text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(p_email));
  v_token text;
  v_id uuid;
  v_expires timestamptz := now() + interval '7 days';
begin
  if auth.uid() is null then
    perform private.raise_domain('SESSION_REQUIRED');
  end if;
  if not private.is_family_owner(p_family_id) then
    perform private.raise_domain('FORBIDDEN', 'owner_required');
  end if;
  if p_role not in ('owner', 'admin') then
    perform private.raise_domain('INVALID', 'role');
  end if;
  if p_member_id is not null and not exists (
    select 1 from public.family_members fm
    where fm.family_id = p_family_id and fm.id = p_member_id
      and fm.kind = 'adult' and fm.archived_at is null
      and not exists (
        select 1 from public.adult_memberships am
        where am.family_id = p_family_id and am.member_id = fm.id and am.status = 'active'
      )
  ) then
    perform private.raise_domain('INVALID', 'member');
  end if;
  if exists (
    select 1 from public.adult_memberships am
    join auth.users u on u.id = am.user_id
    where am.family_id = p_family_id and am.status = 'active' and lower(u.email) = v_email
  ) then
    perform private.raise_domain('ALREADY_APPLIED', 'already_member');
  end if;
  if (select count(*) from public.family_invitations i
      where i.family_id = p_family_id and i.created_at > now() - interval '1 day') >= 20 then
    perform private.raise_domain('RATE_LIMITED', 'invitations');
  end if;

  -- Una sola invitación vigente por destinatario.
  update public.family_invitations i
  set revoked_at = now()
  where i.family_id = p_family_id and i.email = v_email
    and i.accepted_at is null and i.revoked_at is null;

  v_token := rtrim(translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/', '-_'), '=');

  insert into public.family_invitations (family_id, email, role, member_id, token_hash, expires_at, created_by)
  values (p_family_id, v_email, p_role, p_member_id, extensions.digest(v_token, 'sha256'), v_expires, auth.uid())
  returning id into v_id;

  perform private.audit(p_family_id, 'invitation.created', 'invitation', v_id,
                        jsonb_build_object('role', p_role));

  return query select v_id, v_token, v_expires;
end;
$$;

create or replace function public.create_invitation(
  p_family_id uuid,
  p_email text,
  p_role text default 'admin',
  p_member_id uuid default null
)
returns table (invitation_id uuid, token text, expires_at timestamptz)
language sql
security invoker
set search_path = ''
as $$
  select * from private.create_invitation(p_family_id, p_email, p_role, p_member_id);
$$;

-- Vista previa sin filtrar datos: el nombre de la familia solo se revela al
-- destinatario correcto con sesión iniciada.
create or replace function private.get_invitation_preview(p_token text)
returns table (status text, family_name text, invited_email text, role text, expires_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_inv public.family_invitations;
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if auth.uid() is null or private.is_anonymous_session() then
    return query select 'session_required'::text, null::text, null::text, null::text, null::timestamptz;
    return;
  end if;

  select * into v_inv from public.family_invitations i
  where i.token_hash = extensions.digest(coalesce(p_token, ''), 'sha256');

  if not found then
    return query select 'not_found'::text, null::text, null::text, null::text, null::timestamptz;
  elsif v_inv.email <> v_email then
    return query select 'email_mismatch'::text, null::text, null::text, null::text, null::timestamptz;
  elsif v_inv.revoked_at is not null then
    return query select 'revoked'::text, null::text, v_inv.email, v_inv.role, v_inv.expires_at;
  elsif v_inv.accepted_at is not null then
    return query select 'used'::text, null::text, v_inv.email, v_inv.role, v_inv.expires_at;
  elsif v_inv.expires_at <= now() then
    return query select 'expired'::text, null::text, v_inv.email, v_inv.role, v_inv.expires_at;
  else
    return query
      select 'valid'::text, f.name, v_inv.email, v_inv.role, v_inv.expires_at
      from public.families f where f.id = v_inv.family_id;
  end if;
end;
$$;

create or replace function public.get_invitation_preview(p_token text)
returns table (status text, family_name text, invited_email text, role text, expires_at timestamptz)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.get_invitation_preview(p_token);
$$;

create or replace function private.accept_invitation(
  p_token text,
  p_display_name text default null,
  p_color text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_inv public.family_invitations;
  v_user_email text;
  v_confirmed timestamptz;
  v_member_id uuid;
  v_existing public.adult_memberships;
  v_name text;
begin
  if v_uid is null then
    perform private.raise_domain('SESSION_REQUIRED');
  end if;
  if private.is_anonymous_session() then
    perform private.raise_domain('FORBIDDEN', 'anonymous');
  end if;

  select * into v_inv from public.family_invitations i
  where i.token_hash = extensions.digest(coalesce(p_token, ''), 'sha256')
  for update;
  if not found then
    perform private.raise_domain('NOT_FOUND', 'invitation');
  end if;

  select lower(u.email), u.email_confirmed_at into v_user_email, v_confirmed
  from auth.users u where u.id = v_uid;

  if v_user_email is distinct from v_inv.email then
    perform private.raise_domain('FORBIDDEN', 'email_mismatch');
  end if;
  if v_confirmed is null then
    perform private.raise_domain('FORBIDDEN', 'email_unconfirmed');
  end if;

  select * into v_existing from public.adult_memberships m
  where m.family_id = v_inv.family_id and m.user_id = v_uid;

  if v_inv.accepted_at is not null then
    if v_inv.accepted_by = v_uid and v_existing.status = 'active' then
      return v_inv.family_id; -- reintento del mismo destinatario
    end if;
    perform private.raise_domain('ALREADY_APPLIED', 'invitation_used');
  end if;
  if v_inv.revoked_at is not null then
    perform private.raise_domain('INVALID', 'invitation_revoked');
  end if;
  if v_inv.expires_at <= now() then
    perform private.raise_domain('INVALID', 'invitation_expired');
  end if;

  if v_existing.id is not null and v_existing.status = 'active' then
    update public.family_invitations
    set accepted_at = now(), accepted_by = v_uid
    where id = v_inv.id;
    return v_inv.family_id;
  end if;

  if v_existing.id is not null then
    v_member_id := v_existing.member_id;
    update public.family_members set archived_at = null where id = v_member_id;
    update public.adult_memberships
    set status = 'active', role = v_inv.role
    where id = v_existing.id;
  else
    if v_inv.member_id is not null then
      v_member_id := v_inv.member_id;
      if exists (select 1 from public.adult_memberships am
                 where am.family_id = v_inv.family_id and am.member_id = v_member_id) then
        perform private.raise_domain('CONFLICT', 'member_taken');
      end if;
    else
      v_name := coalesce(nullif(btrim(p_display_name), ''), split_part(v_user_email, '@', 1));
      insert into public.family_members (family_id, display_name, kind, color, initials)
      values (v_inv.family_id, left(v_name, 40), 'adult',
              coalesce(p_color, '#2563EB'), private.initials(v_name))
      returning id into v_member_id;
    end if;

    insert into public.adult_memberships (family_id, user_id, member_id, role)
    values (v_inv.family_id, v_uid, v_member_id, v_inv.role);
  end if;

  update public.family_invitations
  set accepted_at = now(), accepted_by = v_uid
  where id = v_inv.id;

  insert into public.audit_log (family_id, actor_user_id, action, object_type, object_id, meta)
  values (v_inv.family_id, v_uid, 'invitation.accepted', 'invitation', v_inv.id,
          jsonb_build_object('role', v_inv.role));

  return v_inv.family_id;
end;
$$;

create or replace function public.accept_invitation(
  p_token text,
  p_display_name text default null,
  p_color text default null
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.accept_invitation(p_token, p_display_name, p_color);
$$;

create or replace function private.revoke_invitation(p_invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_family_id uuid;
begin
  select i.family_id into v_family_id from public.family_invitations i where i.id = p_invitation_id;
  if v_family_id is null or not private.is_family_owner(v_family_id) then
    perform private.raise_domain('NOT_FOUND', 'invitation');
  end if;
  update public.family_invitations
  set revoked_at = coalesce(revoked_at, now())
  where id = p_invitation_id and accepted_at is null;
  perform private.audit(v_family_id, 'invitation.revoked', 'invitation', p_invitation_id);
end;
$$;

create or replace function public.revoke_invitation(p_invitation_id uuid)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.revoke_invitation(p_invitation_id);
$$;

-- Gestión de adultos (solo propietarios). Retirarse uno mismo también se permite.
create or replace function private.update_adult_membership(
  p_membership_id uuid,
  p_role text default null,
  p_remove boolean default false
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_m public.adult_memberships;
begin
  select * into v_m from public.adult_memberships m where m.id = p_membership_id for update;
  if not found or not private.is_family_adult(v_m.family_id) then
    perform private.raise_domain('NOT_FOUND', 'membership');
  end if;
  if not private.is_family_owner(v_m.family_id)
     and not (p_remove and v_m.user_id = auth.uid() and p_role is null) then
    perform private.raise_domain('FORBIDDEN', 'owner_required');
  end if;

  if p_remove then
    update public.adult_memberships set status = 'removed' where id = v_m.id;
    perform private.audit(v_m.family_id, 'membership.removed', 'membership', v_m.id);
  elsif p_role is not null then
    if p_role not in ('owner', 'admin') then
      perform private.raise_domain('INVALID', 'role');
    end if;
    update public.adult_memberships set role = p_role where id = v_m.id;
    perform private.audit(v_m.family_id, 'membership.role_changed', 'membership', v_m.id,
                          jsonb_build_object('role', p_role));
  end if;
end;
$$;

create or replace function public.update_adult_membership(
  p_membership_id uuid,
  p_role text default null,
  p_remove boolean default false
)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.update_adult_membership(p_membership_id, p_role, p_remove);
$$;

-- -----------------------------------------------------------------------------
-- Agenda (SECURITY INVOKER: RLS y privilegios del adulto aplican)
-- -----------------------------------------------------------------------------

create or replace function private.assert_active_members(p_family_id uuid, p_member_ids uuid[])
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if exists (
    select 1 from unnest(coalesce(p_member_ids, '{}'::uuid[])) as x(member_id)
    where not exists (
      select 1 from public.family_members fm
      where fm.family_id = p_family_id and fm.id = x.member_id and fm.archived_at is null
    )
  ) then
    perform private.raise_domain('INVALID', 'participants');
  end if;
end;
$$;

grant execute on function private.assert_active_members(uuid, uuid[]) to authenticated;

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
  p_private_notes text default null
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
    timezone, location, description, visibility, importance, whole_family, command_id, last_command_id
  ) values (
    p_family_id, btrim(p_title), p_category_id, p_is_all_day,
    case when p_is_all_day then null else p_starts_at end,
    case when p_is_all_day then null else p_ends_at end,
    case when p_is_all_day then p_start_date end,
    case when p_is_all_day then p_end_date end,
    v_tz, nullif(btrim(p_location), ''), nullif(btrim(p_description), ''),
    p_visibility, p_importance, p_whole_family, p_command_id, p_command_id
  )
  returning * into v_event;

  insert into public.event_participants (family_id, event_id, member_id)
  select p_family_id, v_event.id, x.member_id
  from (select distinct unnest(coalesce(p_participant_ids, '{}'::uuid[])) as member_id) x;

  if nullif(btrim(p_private_notes), '') is not null then
    insert into public.calendar_event_private_notes (event_id, family_id, notes)
    values (v_event.id, p_family_id, btrim(p_private_notes));
  end if;

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
  p_private_notes text default null
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
    return v_event; -- reintento del mismo comando
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

  perform private.audit(v_event.family_id, 'event.updated', 'event', v_event.id);
  return v_event;
end;
$$;

create or replace function public.cancel_event(
  p_event_id uuid,
  p_expected_version integer,
  p_command_id uuid,
  p_reason text default null
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
  if v_event.last_command_id = p_command_id or v_event.status = 'cancelled' then
    return v_event;
  end if;
  if v_event.version <> p_expected_version then
    perform private.raise_domain('VERSION_CONFLICT', v_event.version::text);
  end if;

  update public.calendar_events e set
    status = 'cancelled',
    cancel_reason = nullif(btrim(p_reason), ''),
    last_command_id = p_command_id
  where e.id = p_event_id
  returning * into v_event;

  perform private.audit(v_event.family_id, 'event.cancelled', 'event', v_event.id);
  return v_event;
end;
$$;

-- -----------------------------------------------------------------------------
-- Pendientes del hogar
-- -----------------------------------------------------------------------------

create or replace function public.create_household_task(
  p_family_id uuid,
  p_command_id uuid,
  p_title text,
  p_notes text,
  p_assignee_member_id uuid,
  p_due_date date,
  p_due_time time,
  p_priority text,
  p_visibility text
)
returns public.task_occurrences
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_task public.task_occurrences;
begin
  if auth.uid() is null then
    perform private.raise_domain('SESSION_REQUIRED');
  end if;
  if not private.is_family_adult(p_family_id) then
    perform private.raise_domain('FORBIDDEN');
  end if;

  select * into v_task from public.task_occurrences t
  where t.family_id = p_family_id and t.command_id = p_command_id;
  if found then
    return v_task;
  end if;

  if p_assignee_member_id is not null then
    perform private.assert_active_members(p_family_id, array[p_assignee_member_id]);
  end if;

  insert into public.task_occurrences (
    family_id, kind, title, notes, assignee_member_id, due_date, due_time, timezone,
    priority, visibility, command_id, last_command_id
  )
  select p_family_id, 'household', btrim(p_title), nullif(btrim(p_notes), ''), p_assignee_member_id,
         p_due_date, p_due_time, f.timezone, p_priority, p_visibility, p_command_id, p_command_id
  from public.families f where f.id = p_family_id
  returning * into v_task;

  perform private.audit(p_family_id, 'household_task.created', 'task', v_task.id);
  return v_task;
end;
$$;

create or replace function public.update_household_task(
  p_task_id uuid,
  p_expected_version integer,
  p_command_id uuid,
  p_title text,
  p_notes text,
  p_assignee_member_id uuid,
  p_due_date date,
  p_due_time time,
  p_priority text,
  p_visibility text
)
returns public.task_occurrences
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_task public.task_occurrences;
begin
  if auth.uid() is null then
    perform private.raise_domain('SESSION_REQUIRED');
  end if;

  select * into v_task from public.task_occurrences t
  where t.id = p_task_id and t.kind = 'household' for update;
  if not found or not private.is_family_adult(v_task.family_id) then
    perform private.raise_domain('NOT_FOUND', 'task');
  end if;
  if v_task.last_command_id = p_command_id then
    return v_task;
  end if;
  if v_task.version <> p_expected_version then
    perform private.raise_domain('VERSION_CONFLICT', v_task.version::text);
  end if;
  if p_assignee_member_id is not null then
    perform private.assert_active_members(v_task.family_id, array[p_assignee_member_id]);
  end if;

  update public.task_occurrences t set
    title = btrim(p_title),
    notes = nullif(btrim(p_notes), ''),
    assignee_member_id = p_assignee_member_id,
    due_date = p_due_date,
    due_time = p_due_time,
    priority = p_priority,
    visibility = p_visibility,
    last_command_id = p_command_id
  where t.id = p_task_id
  returning * into v_task;

  return v_task;
end;
$$;

-- Cambiar estado (completar, reabrir, cancelar). Las columnas de estado no se
-- conceden a los clientes: solo esta función las escribe, con hora del servidor.
create or replace function private.set_household_task_status(
  p_task_id uuid,
  p_status text,
  p_command_id uuid
)
returns public.task_occurrences
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_task public.task_occurrences;
begin
  if auth.uid() is null then
    perform private.raise_domain('SESSION_REQUIRED');
  end if;
  if p_status not in ('pending', 'done', 'cancelled') then
    perform private.raise_domain('INVALID', 'status');
  end if;

  select * into v_task from public.task_occurrences t
  where t.id = p_task_id and t.kind = 'household' for update;
  if not found or not private.is_family_adult(v_task.family_id) then
    perform private.raise_domain('NOT_FOUND', 'task');
  end if;
  if v_task.last_command_id = p_command_id or v_task.status = p_status then
    return v_task;
  end if;

  update public.task_occurrences t set
    status = p_status,
    completed_at = case when p_status = 'done' then now() end,
    completed_by = case when p_status = 'done' then auth.uid() end,
    last_command_id = p_command_id
  where t.id = p_task_id
  returning * into v_task;

  perform private.audit(v_task.family_id, 'household_task.' || p_status, 'task', v_task.id);
  return v_task;
end;
$$;

create or replace function public.set_household_task_status(
  p_task_id uuid,
  p_status text,
  p_command_id uuid
)
returns public.task_occurrences
language sql
security invoker
set search_path = ''
as $$
  select * from private.set_household_task_status(p_task_id, p_status, p_command_id);
$$;

-- Hora del servidor: referencia para el reloj contextual (sin datos familiares).
create or replace function public.server_now()
returns timestamptz
language sql
stable
security invoker
set search_path = ''
as $$
  select now();
$$;

-- -----------------------------------------------------------------------------
-- Privilegios de funciones
-- -----------------------------------------------------------------------------

revoke all on function
  private.create_family(uuid, text, text, text, text),
  private.create_invitation(uuid, text, text, uuid),
  private.get_invitation_preview(text),
  private.accept_invitation(text, text, text),
  private.revoke_invitation(uuid),
  private.update_adult_membership(uuid, text, boolean),
  private.set_household_task_status(uuid, text, uuid)
from public, anon;

grant execute on function
  private.create_family(uuid, text, text, text, text),
  private.create_invitation(uuid, text, text, uuid),
  private.get_invitation_preview(text),
  private.accept_invitation(text, text, text),
  private.revoke_invitation(uuid),
  private.update_adult_membership(uuid, text, boolean),
  private.set_household_task_status(uuid, text, uuid)
to authenticated;

revoke all on function
  public.create_family(uuid, text, text, text, text),
  public.create_invitation(uuid, text, text, uuid),
  public.get_invitation_preview(text),
  public.accept_invitation(text, text, text),
  public.revoke_invitation(uuid),
  public.update_adult_membership(uuid, text, boolean),
  public.create_event(uuid, uuid, text, uuid, boolean, timestamptz, timestamptz, date, date,
                      text, text, text, text, boolean, uuid[], text),
  public.update_event(uuid, integer, uuid, text, uuid, boolean, timestamptz, timestamptz, date, date,
                      text, text, text, text, boolean, uuid[], text),
  public.cancel_event(uuid, integer, uuid, text),
  public.create_household_task(uuid, uuid, text, text, uuid, date, time, text, text),
  public.update_household_task(uuid, integer, uuid, text, text, uuid, date, time, text, text),
  public.set_household_task_status(uuid, text, uuid),
  public.server_now()
from public, anon;

grant execute on function
  public.create_family(uuid, text, text, text, text),
  public.create_invitation(uuid, text, text, uuid),
  public.get_invitation_preview(text),
  public.accept_invitation(text, text, text),
  public.revoke_invitation(uuid),
  public.update_adult_membership(uuid, text, boolean),
  public.create_event(uuid, uuid, text, uuid, boolean, timestamptz, timestamptz, date, date,
                      text, text, text, text, boolean, uuid[], text),
  public.update_event(uuid, integer, uuid, text, uuid, boolean, timestamptz, timestamptz, date, date,
                      text, text, text, text, boolean, uuid[], text),
  public.cancel_event(uuid, integer, uuid, text),
  public.create_household_task(uuid, uuid, text, text, uuid, date, time, text, text),
  public.update_household_task(uuid, integer, uuid, text, text, uuid, date, time, text, text),
  public.set_household_task_status(uuid, text, uuid),
  public.server_now()
to authenticated;
