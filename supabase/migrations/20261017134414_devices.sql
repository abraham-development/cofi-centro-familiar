-- =============================================================================
-- COFI · Hito B · Pantallas vinculadas (cocina, cuartos).
--
-- Flujo: la pantalla inicia una sesión ANÓNIMA de Supabase Auth y solicita un
-- código temporal; un adulto lo aprueba eligiendo familia, nombre y alcance.
-- La sesión anónima tiene el rol `authenticated`, que por sí solo no autoriza
-- nada: cada lectura y escritura comprueba un vínculo aprobado y no revocado.
-- El dispositivo nunca recibe credenciales de adulto.
-- =============================================================================

create table public.paired_devices (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  -- Se anula si se borra la identidad anónima; la fila queda como historial.
  auth_user_id uuid unique references auth.users (id) on delete set null,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  scope text not null check (scope in ('home', 'child')),
  member_id uuid,
  approved_by uuid,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid,
  version integer not null default 1,
  constraint paired_devices_family_id_id_key unique (family_id, id),
  constraint paired_devices_member_fk
    foreign key (family_id, member_id) references public.family_members (family_id, id) on delete cascade,
  constraint paired_devices_scope_member check ((scope = 'child') = (member_id is not null))
);

create index paired_devices_family_idx on public.paired_devices (family_id, revoked_at);
create index paired_devices_member_idx on public.paired_devices (family_id, member_id);

comment on table public.paired_devices is
  'Pantallas vinculadas. Una sesión anónima solo accede a datos mientras su vínculo esté activo.';

-- Solicitudes de vinculación: en el esquema privado (no expuesto por la API).
create table private.device_pairing_requests (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null references auth.users (id) on delete cascade,
  code_hash bytea not null unique,
  expires_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'cancelled')),
  device_id uuid,
  created_at timestamptz not null default now()
);

create index device_pairing_requests_user_idx on private.device_pairing_requests (auth_user_id, created_at desc);

create table private.pairing_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  succeeded boolean not null,
  created_at timestamptz not null default now()
);

create index pairing_attempts_user_idx on private.pairing_attempts (user_id, created_at desc);

alter table private.device_pairing_requests enable row level security;
alter table private.pairing_attempts enable row level security;
revoke all on private.device_pairing_requests, private.pairing_attempts from public, anon, authenticated;

alter table public.audit_log add column actor_device_id uuid;

-- -----------------------------------------------------------------------------
-- Actor dispositivo
-- -----------------------------------------------------------------------------

create or replace function private.my_device()
returns table (id uuid, family_id uuid, scope text, member_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select d.id, d.family_id, d.scope, d.member_id
  from public.paired_devices d
  where d.auth_user_id = (select auth.uid()) and d.revoked_at is null;
$$;

create or replace function private.my_device_family_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select d.family_id from public.paired_devices d
  where d.auth_user_id = (select auth.uid()) and d.revoked_at is null;
$$;

/** Visibilidad de eventos para pantallas: casa = «familia»; hijo = «familia» o participante. */
create or replace function private.device_can_see_event(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.calendar_events e
    join public.paired_devices d
      on d.family_id = e.family_id and d.auth_user_id = (select auth.uid()) and d.revoked_at is null
    where e.id = p_event_id
      and (
        e.visibility = 'family'
        or (d.scope = 'child' and e.visibility = 'participants'
            and (e.whole_family or exists (
              select 1 from public.event_participants p
              where p.family_id = e.family_id and p.event_id = e.id and p.member_id = d.member_id)))
      )
  );
$$;

-- Ampliaciones de funciones del núcleo para reconocer al dispositivo.

create or replace function private.can_act_for_member(p_family_id uuid, p_member_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_family_adult(p_family_id)
      or exists (select 1 from private.my_device() d
                 where d.family_id = p_family_id and d.scope = 'child' and d.member_id = p_member_id);
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
declare
  v_device uuid;
begin
  select d.id into v_device from private.my_device() d where d.family_id = p_family_id;
  if auth.uid() is not null and not private.is_family_adult(p_family_id) and v_device is null then
    perform private.raise_domain('FORBIDDEN', 'audit');
  end if;
  insert into public.audit_log (family_id, actor_user_id, actor_device_id, action, object_type, object_id, meta)
  values (p_family_id, case when v_device is null then auth.uid() end, v_device, p_action, p_object_type,
          p_object_id, coalesce(p_meta, '{}'::jsonb));
end;
$$;

-- La pantalla común puede marcar o reabrir pendientes del hogar visibles para
-- la familia (acción expresamente habilitada); nunca descartarlos.
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
  v_is_adult boolean;
begin
  if auth.uid() is null then
    perform private.raise_domain('SESSION_REQUIRED');
  end if;
  if p_status not in ('pending', 'done', 'cancelled') then
    perform private.raise_domain('INVALID', 'status');
  end if;

  select * into v_task from public.task_occurrences t
  where t.id = p_task_id and t.kind = 'household' for update;
  if not found then
    perform private.raise_domain('NOT_FOUND', 'task');
  end if;
  v_is_adult := private.is_family_adult(v_task.family_id);
  if not v_is_adult and not (
    p_status in ('pending', 'done')
    and v_task.visibility = 'family'
    and exists (select 1 from private.my_device() d where d.family_id = v_task.family_id and d.scope = 'home')
  ) then
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

-- -----------------------------------------------------------------------------
-- Políticas para pantallas (solo lectura; las acciones van por RPC)
-- -----------------------------------------------------------------------------

create policy families_select_devices on public.families
  for select to authenticated using (id in (select private.my_device_family_ids()));

create policy family_members_select_devices on public.family_members
  for select to authenticated using (family_id in (select private.my_device_family_ids()));

create policy event_categories_select_devices on public.event_categories
  for select to authenticated using (family_id in (select private.my_device_family_ids()));

create policy calendar_events_select_devices on public.calendar_events
  for select to authenticated using (
    family_id in (select private.my_device_family_ids()) and private.device_can_see_event(id));

create policy event_participants_select_devices on public.event_participants
  for select to authenticated using (
    family_id in (select private.my_device_family_ids()) and private.device_can_see_event(event_id));

create policy task_occurrences_select_devices on public.task_occurrences
  for select to authenticated using (
    exists (
      select 1 from private.my_device() d
      where d.family_id = task_occurrences.family_id
        and (
          (d.scope = 'home' and task_occurrences.visibility = 'family')
          or (d.scope = 'child' and task_occurrences.kind <> 'household'
              and task_occurrences.assignee_member_id = d.member_id)
        )
    ));

create policy member_point_accounts_select_devices on public.member_point_accounts
  for select to authenticated using (
    exists (
      select 1 from private.my_device() d
      where d.family_id = member_point_accounts.family_id
        and (d.scope = 'home' or d.member_id = member_point_accounts.member_id)
    ));

create policy points_ledger_select_child_device on public.points_ledger
  for select to authenticated using (
    exists (select 1 from private.my_device() d
            where d.family_id = points_ledger.family_id and d.scope = 'child' and d.member_id = points_ledger.member_id));

create policy rewards_select_child_device on public.rewards
  for select to authenticated using (
    archived_at is null
    and exists (select 1 from private.my_device() d where d.family_id = rewards.family_id and d.scope = 'child'));

create policy reward_members_select_child_device on public.reward_members
  for select to authenticated using (
    exists (select 1 from private.my_device() d
            where d.family_id = reward_members.family_id and d.scope = 'child' and d.member_id = reward_members.member_id));

create policy reward_redemptions_select_child_device on public.reward_redemptions
  for select to authenticated using (
    exists (select 1 from private.my_device() d
            where d.family_id = reward_redemptions.family_id and d.scope = 'child'
              and d.member_id = reward_redemptions.member_id));

alter table public.paired_devices enable row level security;

create policy paired_devices_select_adults on public.paired_devices
  for select to authenticated using (family_id in (select private.my_adult_family_ids()));
create policy paired_devices_select_self on public.paired_devices
  for select to authenticated using (auth_user_id = (select auth.uid()));

revoke all on public.paired_devices from anon, authenticated;
grant select (id, family_id, name, scope, member_id, created_at, last_seen_at, revoked_at, version)
  on public.paired_devices to authenticated;

-- -----------------------------------------------------------------------------
-- RPC de vinculación
-- -----------------------------------------------------------------------------

create or replace function private.normalize_pairing_code(p_code text)
returns text
language sql
immutable
set search_path = ''
as $$
  select upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
$$;

-- La pantalla (sesión anónima) pide un código. Caduca a los 10 minutos.
create or replace function private.request_device_pairing()
returns table (code text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_bytes bytea;
  v_code text := '';
  v_expires timestamptz := now() + interval '10 minutes';
  i integer;
begin
  if auth.uid() is null then
    perform private.raise_domain('SESSION_REQUIRED');
  end if;
  if not private.is_anonymous_session() then
    perform private.raise_domain('FORBIDDEN', 'adult_session');
  end if;
  if exists (select 1 from public.paired_devices d where d.auth_user_id = auth.uid() and d.revoked_at is null) then
    perform private.raise_domain('ALREADY_APPLIED', 'paired');
  end if;
  if (select count(*) from private.device_pairing_requests r
      where r.auth_user_id = auth.uid() and r.created_at > now() - interval '1 hour') >= 6 then
    perform private.raise_domain('RATE_LIMITED', 'pairing');
  end if;

  update private.device_pairing_requests set status = 'cancelled'
  where auth_user_id = auth.uid() and status = 'pending';

  v_bytes := extensions.gen_random_bytes(8);
  for i in 0..7 loop
    v_code := v_code || substr(v_alphabet, (get_byte(v_bytes, i) % 32) + 1, 1);
  end loop;

  insert into private.device_pairing_requests (auth_user_id, code_hash, expires_at)
  values (auth.uid(), extensions.digest(v_code, 'sha256'), v_expires);

  return query select substr(v_code, 1, 4) || '-' || substr(v_code, 5, 4), v_expires;
end;
$$;

-- Estado para la propia pantalla: emparejada, pendiente, revocada o sin solicitud.
create or replace function private.get_device_status()
returns table (
  status text,
  device_id uuid,
  family_id uuid,
  family_name text,
  device_name text,
  scope text,
  member_id uuid,
  expires_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  d public.paired_devices;
  v_expires timestamptz;
begin
  if auth.uid() is null then
    return query select 'none'::text, null::uuid, null::uuid, null::text, null::text, null::text, null::uuid, null::timestamptz;
    return;
  end if;
  select * into d from public.paired_devices x where x.auth_user_id = auth.uid();
  if found then
    if d.revoked_at is not null then
      return query select 'revoked'::text, d.id, null::uuid, null::text, null::text, null::text, null::uuid, null::timestamptz;
    else
      return query select 'paired'::text, d.id, d.family_id, f.name, d.name, d.scope, d.member_id, null::timestamptz
        from public.families f where f.id = d.family_id;
    end if;
    return;
  end if;
  select r.expires_at into v_expires from private.device_pairing_requests r
  where r.auth_user_id = auth.uid() and r.status = 'pending' and r.expires_at > now()
  order by r.created_at desc limit 1;
  if v_expires is not null then
    return query select 'pending'::text, null::uuid, null::uuid, null::text, null::text, null::text, null::uuid, v_expires;
  else
    return query select 'none'::text, null::uuid, null::uuid, null::text, null::text, null::text, null::uuid, null::timestamptz;
  end if;
end;
$$;

-- Un adulto aprueba el código. Los intentos fallidos se registran (y cuentan
-- para el límite) sin abortar la transacción: por eso devuelve un estado.
create or replace function private.approve_device_pairing(
  p_code text,
  p_family_id uuid,
  p_name text,
  p_scope text,
  p_member_id uuid
)
returns table (ok boolean, error_code text, device_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_req private.device_pairing_requests;
  v_device uuid;
begin
  if auth.uid() is null or private.is_anonymous_session() then
    perform private.raise_domain('SESSION_REQUIRED');
  end if;
  if not private.is_family_adult(p_family_id) then
    perform private.raise_domain('FORBIDDEN');
  end if;
  if (select count(*) from private.pairing_attempts a
      where a.user_id = auth.uid() and not a.succeeded and a.created_at > now() - interval '15 minutes') >= 10 then
    return query select false, 'RATE_LIMITED'::text, null::uuid;
    return;
  end if;
  if p_scope not in ('home', 'child') or nullif(btrim(p_name), '') is null
     or (p_scope = 'child' and not exists (
           select 1 from public.family_members fm
           where fm.family_id = p_family_id and fm.id = p_member_id and fm.kind = 'child' and fm.archived_at is null))
  then
    return query select false, 'INVALID'::text, null::uuid;
    return;
  end if;

  select * into v_req from private.device_pairing_requests r
  where r.code_hash = extensions.digest(private.normalize_pairing_code(p_code), 'sha256')
  for update;

  if not found or v_req.status <> 'pending' or v_req.expires_at <= now() then
    insert into private.pairing_attempts (user_id, succeeded) values (auth.uid(), false);
    return query select false, 'INVALID_CODE'::text, null::uuid;
    return;
  end if;
  if exists (select 1 from public.paired_devices d where d.auth_user_id = v_req.auth_user_id) then
    update private.device_pairing_requests set status = 'cancelled' where id = v_req.id;
    insert into private.pairing_attempts (user_id, succeeded) values (auth.uid(), false);
    return query select false, 'INVALID_CODE'::text, null::uuid;
    return;
  end if;

  insert into public.paired_devices (family_id, auth_user_id, name, scope, member_id, approved_by)
  values (p_family_id, v_req.auth_user_id, btrim(p_name), p_scope,
          case when p_scope = 'child' then p_member_id end, auth.uid())
  returning id into v_device;

  update private.device_pairing_requests set status = 'approved', device_id = v_device where id = v_req.id;
  insert into private.pairing_attempts (user_id, succeeded) values (auth.uid(), true);
  perform private.audit(p_family_id, 'device.paired', 'device', v_device, jsonb_build_object('scope', p_scope));
  return query select true, null::text, v_device;
end;
$$;

create or replace function private.update_device(p_device_id uuid, p_name text, p_revoke boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.paired_devices;
begin
  select * into d from public.paired_devices where id = p_device_id for update;
  if not found or not private.is_family_adult(d.family_id) then
    perform private.raise_domain('NOT_FOUND', 'device');
  end if;
  if p_revoke then
    if d.revoked_at is null then
      update public.paired_devices set revoked_at = now(), revoked_by = auth.uid(), version = version + 1
      where id = d.id;
      perform private.audit(d.family_id, 'device.revoked', 'device', d.id);
    end if;
  elsif nullif(btrim(p_name), '') is not null then
    update public.paired_devices set name = left(btrim(p_name), 40), version = version + 1 where id = d.id;
  end if;
end;
$$;

-- La pantalla informa que sigue activa (como máximo una escritura cada 5 min).
create or replace function private.device_heartbeat()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.paired_devices set last_seen_at = now()
  where auth_user_id = (select auth.uid()) and revoked_at is null
    and (last_seen_at is null or last_seen_at < now() - interval '5 minutes');
$$;

-- Limpieza: identidades anónimas sin vínculo activo, con más de 2 días.
create or replace function private.cleanup_anonymous_users()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  with gone as (
    delete from auth.users u
    where u.is_anonymous
      and u.created_at < now() - interval '2 days'
      and not exists (
        select 1 from public.paired_devices d where d.auth_user_id = u.id and d.revoked_at is null)
    returning 1
  )
  select count(*) into v_count from gone;
  delete from private.pairing_attempts where created_at < now() - interval '7 days';
  return v_count;
end;
$$;

select cron.schedule('cofi-cleanup-anonymous', '40 5 * * *', $$select private.cleanup_anonymous_users()$$);

-- -----------------------------------------------------------------------------
-- Envoltorios públicos y privilegios
-- -----------------------------------------------------------------------------

create or replace function public.request_device_pairing()
returns table (code text, expires_at timestamptz)
language sql security invoker set search_path = '' as $$
  select * from private.request_device_pairing();
$$;

create or replace function public.get_device_status()
returns table (status text, device_id uuid, family_id uuid, family_name text, device_name text, scope text,
               member_id uuid, expires_at timestamptz)
language sql stable security invoker set search_path = '' as $$
  select * from private.get_device_status();
$$;

create or replace function public.approve_device_pairing(
  p_code text, p_family_id uuid, p_name text, p_scope text, p_member_id uuid
)
returns table (ok boolean, error_code text, device_id uuid)
language sql security invoker set search_path = '' as $$
  select * from private.approve_device_pairing(p_code, p_family_id, p_name, p_scope, p_member_id);
$$;

create or replace function public.update_device(p_device_id uuid, p_name text, p_revoke boolean)
returns void language sql security invoker set search_path = '' as $$
  select private.update_device(p_device_id, p_name, p_revoke);
$$;

create or replace function public.device_heartbeat()
returns void language sql security invoker set search_path = '' as $$
  select private.device_heartbeat();
$$;

revoke all on function
  private.my_device(),
  private.my_device_family_ids(),
  private.device_can_see_event(uuid),
  private.normalize_pairing_code(text),
  private.request_device_pairing(),
  private.get_device_status(),
  private.approve_device_pairing(text, uuid, text, text, uuid),
  private.update_device(uuid, text, boolean),
  private.device_heartbeat(),
  private.cleanup_anonymous_users()
from public, anon, authenticated;

grant execute on function
  private.my_device(),
  private.my_device_family_ids(),
  private.device_can_see_event(uuid),
  private.normalize_pairing_code(text),
  private.request_device_pairing(),
  private.get_device_status(),
  private.approve_device_pairing(text, uuid, text, text, uuid),
  private.update_device(uuid, text, boolean),
  private.device_heartbeat()
to authenticated;

revoke all on function
  public.request_device_pairing(),
  public.get_device_status(),
  public.approve_device_pairing(text, uuid, text, text, uuid),
  public.update_device(uuid, text, boolean),
  public.device_heartbeat()
from public, anon;

grant execute on function
  public.request_device_pairing(),
  public.get_device_status(),
  public.approve_device_pairing(text, uuid, text, text, uuid),
  public.update_device(uuid, text, boolean),
  public.device_heartbeat()
to authenticated;
