-- =============================================================================
-- COFI · Hito B · Sincronización en tiempo real (Broadcast privado).
--
-- * Los triggers publican solo invalidaciones mínimas: tabla, operación y hora
--   de envío. Nunca títulos, notas ni datos: la pantalla vuelve a consultar con
--   sus permisos vigentes (RLS).
-- * realtime.send inserta en realtime.messages dentro de la transacción: el
--   mensaje se entrega solo si la transacción se confirma.
-- * Un trigger por sentencia (con tablas de transición) envía un mensaje por
--   canal y no uno por fila, aunque se materialicen decenas de ocurrencias.
--
-- Canales (topic):
--   fam:<familia>:adults   todo cambio de la familia (adultos)
--   fam:<familia>:screens  cambios visibles para pantallas (sin «solo adultos»)
--   member:<integrante>    tareas, saldo y canjes de un hijo
--   device:<pantalla>      aviso de revocación para esa pantalla
-- =============================================================================

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
    union all
    select 'member:' || coalesce(row ->> 'assignee_member_id', row ->> 'member_id')
    from r
    where p_table in ('task_occurrences', 'member_point_accounts', 'points_ledger', 'reward_redemptions')
      and coalesce(row ->> 'assignee_member_id', row ->> 'member_id') is not null
  ) t
  where topic is not null;
$$;

create or replace function private.tg_broadcast_statement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rows jsonb;
  v_topic text;
  v_payload jsonb;
begin
  if tg_op = 'INSERT' then
    select coalesce(jsonb_agg(to_jsonb(n)), '[]'::jsonb) into v_rows from new_rows n;
  elsif tg_op = 'DELETE' then
    select coalesce(jsonb_agg(to_jsonb(o)), '[]'::jsonb) into v_rows from old_rows o;
  else
    -- En una edición se avisa a quienes veían la fila antes o la ven después.
    select coalesce(jsonb_agg(x), '[]'::jsonb) into v_rows
    from (select to_jsonb(n) as x from new_rows n union all select to_jsonb(o) from old_rows o) s;
  end if;
  if jsonb_array_length(v_rows) = 0 then
    return null;
  end if;

  v_payload := jsonb_build_object(
    't', tg_table_name,
    'op', lower(tg_op),
    'ts', (extract(epoch from clock_timestamp()) * 1000)::bigint
  );
  for v_topic in select private.broadcast_topics(tg_table_name, v_rows) loop
    perform realtime.send(v_payload, 'change', v_topic, true);
  end loop;
  return null;
end;
$$;

-- Crea los tres triggers por sentencia (insert, update, delete) de una tabla.
create or replace function private.install_broadcast(p_table text)
returns void
language plpgsql
set search_path = ''
as $$
begin
  execute format('create trigger %I after insert on public.%I referencing new table as new_rows
                  for each statement execute function private.tg_broadcast_statement()', p_table || '_bc_ins', p_table);
  execute format('create trigger %I after update on public.%I referencing new table as new_rows old table as old_rows
                  for each statement execute function private.tg_broadcast_statement()', p_table || '_bc_upd', p_table);
  execute format('create trigger %I after delete on public.%I referencing old table as old_rows
                  for each statement execute function private.tg_broadcast_statement()', p_table || '_bc_del', p_table);
end;
$$;

select private.install_broadcast(t) from unnest(array[
  'families', 'family_members', 'event_categories', 'calendar_events', 'task_occurrences',
  'member_point_accounts', 'points_ledger', 'rewards', 'reward_members', 'reward_redemptions'
]) as t;

drop function private.install_broadcast(text);

-- Revocación de una pantalla: aviso dirigido a esa pantalla.
create or replace function private.tg_device_revoked()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.revoked_at is not null and old.revoked_at is null then
    perform realtime.send(
      jsonb_build_object('t', 'paired_devices', 'op', 'revoked', 'ts', (extract(epoch from clock_timestamp()) * 1000)::bigint),
      'revoked', 'device:' || new.id, true);
  end if;
  perform realtime.send(
    jsonb_build_object('t', 'paired_devices', 'op', 'update', 'ts', (extract(epoch from clock_timestamp()) * 1000)::bigint),
    'change', 'fam:' || new.family_id || ':adults', true);
  return null;
end;
$$;

create trigger paired_devices_broadcast
  after update on public.paired_devices
  for each row execute function private.tg_device_revoked();

-- -----------------------------------------------------------------------------
-- Autorización de canales privados
-- -----------------------------------------------------------------------------

create or replace function private.can_read_topic(p_topic text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_kind text := split_part(p_topic, ':', 1);
  v_id text := split_part(p_topic, ':', 2);
  v_sub text := split_part(p_topic, ':', 3);
  v_uuid uuid;
begin
  if auth.uid() is null
     or v_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  v_uuid := v_id::uuid;

  if v_kind = 'fam' and v_sub = 'adults' then
    return private.is_family_adult(v_uuid);
  elsif v_kind = 'fam' and v_sub = 'screens' then
    return private.is_family_adult(v_uuid) or v_uuid in (select private.my_device_family_ids());
  elsif v_kind = 'member' and v_sub = '' then
    return exists (
      select 1 from public.family_members m
      where m.id = v_uuid
        and (private.is_family_adult(m.family_id)
             or exists (select 1 from private.my_device() d
                        where d.family_id = m.family_id and (d.scope = 'home' or d.member_id = v_uuid))));
  elsif v_kind = 'device' and v_sub = '' then
    -- La propia pantalla, incluso revocada (para recibir el aviso).
    return exists (select 1 from public.paired_devices d where d.id = v_uuid and d.auth_user_id = auth.uid());
  end if;
  return false;
end;
$$;

revoke all on function
  private.broadcast_topics(text, jsonb),
  private.tg_broadcast_statement(),
  private.tg_device_revoked(),
  private.can_read_topic(text)
from public, anon, authenticated;
grant execute on function private.can_read_topic(text) to authenticated;

-- Solo lectura de broadcasts autorizados. Sin política de inserción: los
-- clientes no pueden emitir mensajes; solo la base de datos.
create policy cofi_receive_broadcasts on realtime.messages
  for select to authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and (select private.can_read_topic((select realtime.topic())))
  );
