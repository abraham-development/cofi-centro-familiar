-- Pruebas del núcleo (Hito A): aislamiento familiar, privilegios, integridad,
-- idempotencia y fechas. Se ejecutan dentro de una transacción que se revierte.
-- Local: `npx supabase test db`. Remoto (dev): `npm run db:test`.
begin;
create extension if not exists pgtap with schema extensions;

select plan(46);

-- ---------------------------------------------------------------------------
-- Fixtures: usuarios de prueba (se revierten al final)
-- ---------------------------------------------------------------------------
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
                        created_at, updated_at, is_anonymous)
values
  ('a0000000-0000-4000-8000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated',
   'authenticated', 'ana.test@cofi.invalid', '', now(), '{}', '{}', now(), now(), false),
  ('b0000000-0000-4000-8000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated',
   'authenticated', 'bruno.test@cofi.invalid', '', now(), '{}', '{}', now(), now(), false),
  ('c0000000-0000-4000-8000-00000000000c', '00000000-0000-0000-0000-000000000000', 'authenticated',
   'authenticated', 'carla.test@cofi.invalid', '', now(), '{}', '{}', now(), now(), false),
  ('d0000000-0000-4000-8000-00000000000d', '00000000-0000-0000-0000-000000000000', 'authenticated',
   'authenticated', 'diego.test@cofi.invalid', '', now(), '{}', '{}', now(), now(), false);

create function pg_temp.login_as(p_uid uuid, p_email text, p_anonymous boolean default false)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object(
    'sub', p_uid, 'role', 'authenticated', 'email', p_email,
    'is_anonymous', p_anonymous)::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

create function pg_temp.logout() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;

-- Ejecuta una sentencia y devuelve cuántas filas afectó (bajo el rol actual).
create function pg_temp.affected(p_sql text) returns integer language plpgsql as $$
declare v_count integer;
begin
  execute p_sql;
  get diagnostics v_count = row_count;
  return v_count;
end $$;

grant execute on function pg_temp.login_as(uuid, text, boolean), pg_temp.logout(),
  pg_temp.affected(text) to authenticated, anon;

create temp table ids (name text primary key, id uuid);
grant select, insert, update on ids to authenticated, anon;

-- Familia A (Ana) y familia B (Bruno)
select pg_temp.login_as('a0000000-0000-4000-8000-00000000000a', 'ana.test@cofi.invalid');
insert into ids values ('famA', public.create_family(
  'f0000000-0000-4000-8000-0000000000a1', 'Familia A', 'America/Lima', 'Ana', '#7C3AED'));
with x as (
  insert into public.family_members (family_id, display_name, kind, color)
  select id, 'Mateo', 'child', '#16A34A' from ids where name = 'famA'
  returning id)
insert into ids select 'memA_child', id from x;
select pg_temp.logout();

select pg_temp.login_as('b0000000-0000-4000-8000-00000000000b', 'bruno.test@cofi.invalid');
insert into ids values ('famB', public.create_family(
  'f0000000-0000-4000-8000-0000000000b1', 'Familia B', 'America/New_York', 'Bruno', '#2563EB'));
with x as (
  insert into public.family_members (family_id, display_name, kind, color)
  select id, 'Sofía', 'child', '#EA580C' from ids where name = 'famB'
  returning id)
insert into ids select 'memB_child', id from x;
insert into ids select 'evtB', (public.create_event(
  (select id from ids where name = 'famB'), 'e0000000-0000-4000-8000-0000000000b1',
  'Evento privado de B', null, false, '2026-11-02 15:00-05', '2026-11-02 16:00-05',
  null, null, null, null, 'family', 'normal', false, '{}', 'nota secreta de B')).id;
select pg_temp.logout();

-- ---------------------------------------------------------------------------
-- Aislamiento entre familias
-- ---------------------------------------------------------------------------
select pg_temp.login_as('a0000000-0000-4000-8000-00000000000a', 'ana.test@cofi.invalid');

select results_eq(
  $$ select name from public.families $$,
  $$ values ('Familia A'::text) $$,
  'Ana solo ve su familia');

select is((select count(*)::int from public.family_members where family_id = (select id from ids where name = 'famB')),
  0, 'Ana no ve integrantes de la familia B');

select is((select count(*)::int from public.calendar_events where id = (select id from ids where name = 'evtB')),
  0, 'Ana no ve eventos de la familia B');

select is((select count(*)::int from public.calendar_event_private_notes), 0,
  'Ana no ve notas privadas de otra familia');

select throws_ok(
  $$ insert into public.family_members (family_id, display_name, kind, color)
     select id, 'Intruso', 'child', '#000000' from ids where name = 'famB' $$,
  '42501', null, 'Ana no puede insertar integrantes en la familia B');

select is(pg_temp.affected(format(
  $$ update public.families set name = 'Hackeada' where id = %L $$, (select id from ids where name = 'famB'))),
  0, 'Ana no puede modificar la familia B');

select throws_ok(
  format($$ select public.create_event(%L, gen_random_uuid(), 'x', null, false, now(), null,
            null, null, null, null, 'family', 'normal', false, '{}') $$,
         (select id from ids where name = 'famB')),
  'P0001', 'COFI:FORBIDDEN', 'Ana no puede crear eventos en la familia B');

select throws_ok(
  format($$ select public.create_event(%L, gen_random_uuid(), 'x', null, false, now(), null,
            null, null, null, null, 'family', 'normal', false, array[%L]::uuid[]) $$,
         (select id from ids where name = 'famA'), (select id from ids where name = 'memB_child')),
  'P0001', 'COFI:INVALID', 'No se puede usar como participante a un integrante de otra familia');

insert into ids select 'evtA', (public.create_event(
  (select id from ids where name = 'famA'), 'e0000000-0000-4000-8000-0000000000a1',
  'Dentista de Mateo', null, false, '2026-11-03 15:00-05', '2026-11-03 16:00-05',
  null, null, 'Consultorio', null, 'participants', 'high', false,
  array[(select id from ids where name = 'memA_child')], 'pagar copago')).id;

select throws_ok(
  format($$ insert into public.event_participants (family_id, event_id, member_id)
            values (%L, %L, %L) $$,
         (select id from ids where name = 'famA'), (select id from ids where name = 'evtA'),
         (select id from ids where name = 'memB_child')),
  '23503', null, 'La FK compuesta impide relacionar un evento con un integrante de otra familia');

select throws_ok(
  format($$ update public.calendar_events set family_id = %L where id = %L $$,
         (select id from ids where name = 'famB'), (select id from ids where name = 'evtA')),
  '42501', null, 'family_id no es actualizable por clientes');

select throws_ok(
  $$ select token_hash from public.family_invitations $$,
  '42501', null, 'token_hash de invitaciones no es legible');

select throws_ok(
  $$ insert into public.audit_log (family_id, action, object_type) select id, 'fake.action', 'x' from ids where name = 'famA' $$,
  '42501', null, 'El registro de auditoría no admite escrituras directas');

select pg_temp.logout();

-- Usuario autenticado sin familia
select pg_temp.login_as('c0000000-0000-4000-8000-00000000000c', 'carla.test@cofi.invalid');
select is((select count(*)::int from public.families), 0, 'Un usuario sin pertenencia no ve familias');
select is((select count(*)::int from public.family_members), 0, 'Un usuario sin pertenencia no ve integrantes');
select is((select count(*)::int from public.calendar_events), 0, 'Un usuario sin pertenencia no ve eventos');
select is((select count(*)::int from public.task_occurrences), 0, 'Un usuario sin pertenencia no ve pendientes');
select pg_temp.logout();

-- Sesión anónima (futuro dispositivo sin aprobar)
select pg_temp.login_as('d0000000-0000-4000-8000-00000000000d', 'diego.test@cofi.invalid', true);
select is((select count(*)::int from public.families), 0, 'Una sesión anónima sin vínculo no ve familias');
select throws_ok(
  $$ select public.create_family(gen_random_uuid(), 'Anon', 'America/Lima', 'X', '#000000') $$,
  'P0001', 'COFI:FORBIDDEN', 'Una sesión anónima no puede crear familias');
select pg_temp.logout();

-- Rol anon (sin sesión): sin privilegios sobre tablas
select set_config('role', 'anon', true);
select throws_ok($$ select * from public.families $$, '42501', null, 'anon no tiene acceso a families');
select throws_ok($$ select public.server_now() $$, '42501', null, 'anon no ejecuta RPC');
select pg_temp.logout();

-- ---------------------------------------------------------------------------
-- Idempotencia y concurrencia
-- ---------------------------------------------------------------------------
select pg_temp.login_as('a0000000-0000-4000-8000-00000000000a', 'ana.test@cofi.invalid');

select is((public.create_event(
  (select id from ids where name = 'famA'), 'e0000000-0000-4000-8000-0000000000a1',
  'Dentista de Mateo (repetido)', null, false, '2026-11-03 15:00-05', null,
  null, null, null, null, 'family', 'normal', false, '{}')).id,
  (select id from ids where name = 'evtA'),
  'Repetir el mismo comando devuelve el mismo evento');

select is((select count(*)::int from public.calendar_events where family_id = (select id from ids where name = 'famA')),
  1, 'Repetir el comando no duplica el evento');

select is((select count(*)::int from public.event_participants where event_id = (select id from ids where name = 'evtA')),
  1, 'Los participantes se guardaron con el evento');

select throws_ok(
  format($$ select public.update_event(%L, 99, gen_random_uuid(), 'x', null, false, now(), null,
            null, null, null, null, 'family', 'normal', false, '{}') $$,
         (select id from ids where name = 'evtA')),
  'P0001', 'COFI:VERSION_CONFLICT', 'Una versión antigua produce conflicto');

select is((public.update_event((select id from ids where name = 'evtA'), 1,
  'c1000000-0000-4000-8000-000000000001', 'Dentista de Mateo', null, false,
  '2026-11-03 16:00-05', '2026-11-03 17:00-05', null, null, null, null,
  'participants', 'high', false, array[(select id from ids where name = 'memA_child')])).version,
  2, 'Una edición con la versión correcta incrementa la versión');

select is((public.update_event((select id from ids where name = 'evtA'), 1,
  'c1000000-0000-4000-8000-000000000001', 'Dentista de Mateo', null, false,
  '2026-11-03 16:00-05', '2026-11-03 17:00-05', null, null, null, null,
  'participants', 'high', false, array[(select id from ids where name = 'memA_child')])).version,
  2, 'Reintentar la misma edición no aplica cambios dos veces');

select is((select count(*)::int from public.calendar_event_private_notes), 0,
  'Editar sin notas privadas las elimina');

select is((public.cancel_event((select id from ids where name = 'evtA'), 2, gen_random_uuid(), 'Se reprogramó')).status,
  'cancelled', 'Un adulto puede cancelar un evento');

-- Último propietario (la comprobación es diferida: se fuerza inmediata para probarla)
set constraints public.adult_memberships_keep_owner immediate;
select throws_ok(
  format($$ select public.update_adult_membership(
            (select id from public.adult_memberships where family_id = %L), null, true) $$,
         (select id from ids where name = 'famA')),
  'P0001', 'COFI:LAST_OWNER', 'No se puede dejar la familia sin propietario activo');

-- ---------------------------------------------------------------------------
-- Pendientes del hogar
-- ---------------------------------------------------------------------------
insert into ids select 'taskA', (public.create_household_task(
  (select id from ids where name = 'famA'), '7a000000-0000-4000-8000-0000000000a1',
  'Comprar gas', null, null, null, null, 'normal', 'family')).id;

select is((select points from public.task_occurrences where id = (select id from ids where name = 'taskA')),
  0, 'Un pendiente doméstico tiene cero puntos');

select throws_ok(
  format($$ update public.task_occurrences set status = 'done' where id = %L $$, (select id from ids where name = 'taskA')),
  '42501', null, 'El estado no se cambia con un UPDATE directo');

select throws_ok(
  format($$ insert into public.task_occurrences (family_id, kind, title, timezone, assignee_member_id, due_date)
            values (%L, 'chore', 'Tarea falsa', 'America/Lima', %L, current_date) $$,
         (select id from ids where name = 'famA'), (select id from ids where name = 'memA_child')),
  '42501', null, 'Un adulto no crea responsabilidades infantiles por inserción directa');

select is((public.set_household_task_status((select id from ids where name = 'taskA'), 'done', gen_random_uuid())).status,
  'done', 'Completar un pendiente');

select isnt((select completed_at from public.task_occurrences where id = (select id from ids where name = 'taskA')),
  null, 'Completar registra el momento');

select is((public.set_household_task_status((select id from ids where name = 'taskA'), 'pending', gen_random_uuid())).completed_at,
  null, 'Reabrir limpia el momento de cumplimiento');

-- ---------------------------------------------------------------------------
-- Invitaciones
-- ---------------------------------------------------------------------------
create temp table inv as
  select * from public.create_invitation((select id from ids where name = 'famA'), 'Carla.Test@cofi.invalid');
select pg_temp.logout();

select pg_temp.login_as('b0000000-0000-4000-8000-00000000000b', 'bruno.test@cofi.invalid');
select throws_ok(
  format($$ select public.accept_invitation(%L) $$, (select token from inv)),
  'P0001', 'COFI:FORBIDDEN', 'Otro correo no puede aceptar la invitación');
select is((select status from public.get_invitation_preview((select token from inv))),
  'email_mismatch', 'La vista previa no revela la familia a otro correo');
select pg_temp.logout();

select pg_temp.login_as('c0000000-0000-4000-8000-00000000000c', 'carla.test@cofi.invalid');
select is((select family_name from public.get_invitation_preview((select token from inv))),
  'Familia A', 'La destinataria ve el nombre de la familia');
select is(public.accept_invitation((select token from inv), 'Carla', '#DB2777'),
  (select id from ids where name = 'famA'), 'La destinataria acepta la invitación');
select is((select count(*)::int from public.families), 1, 'Tras aceptar, Carla ve la familia A');
select pg_temp.logout();

select pg_temp.login_as('d0000000-0000-4000-8000-00000000000d', 'diego.test@cofi.invalid');
select throws_ok(
  format($$ select public.accept_invitation(%L) $$, (select token from inv)),
  'P0001', null, 'Una invitación usada no sirve para otra persona');
select pg_temp.logout();

-- ---------------------------------------------------------------------------
-- Fechas locales (derivadas por trigger)
-- ---------------------------------------------------------------------------
select pg_temp.login_as('a0000000-0000-4000-8000-00000000000a', 'ana.test@cofi.invalid');

select results_eq(
  format($$ select local_start_date, local_end_date from public.create_event(%L, gen_random_uuid(),
            'Fin de año', null, true, null, null, '2026-12-31', '2027-01-01', null, null,
            'family', 'normal', true, '{}') $$, (select id from ids where name = 'famA')),
  $$ values ('2026-12-31'::date, '2026-12-31'::date) $$,
  'Día completo: el fin es exclusivo y no se convierte a UTC');

select results_eq(
  format($$ select local_start_date, local_end_date from public.create_event(%L, gen_random_uuid(),
            'Bisiesto', null, true, null, null, '2028-02-28', '2028-03-01', null, null,
            'family', 'normal', true, '{}') $$, (select id from ids where name = 'famA')),
  $$ values ('2028-02-28'::date, '2028-02-29'::date) $$,
  'Día completo en año bisiesto incluye el 29 de febrero');

select results_eq(
  format($$ select local_start_date, local_end_date from public.create_event(%L, gen_random_uuid(),
            'Fiesta', null, false, '2026-11-06 22:00-05', '2026-11-07 01:00-05', null, null, null, null,
            'family', 'normal', true, '{}') $$, (select id from ids where name = 'famA')),
  $$ values ('2026-11-06'::date, '2026-11-07'::date) $$,
  'Un evento que cruza medianoche pertenece a ambas fechas locales');

select results_eq(
  format($$ select local_start_date, local_end_date from public.create_event(%L, gen_random_uuid(),
            'Hasta medianoche', null, false, '2026-11-06 22:00-05', '2026-11-07 00:00-05', null, null, null, null,
            'family', 'normal', true, '{}') $$, (select id from ids where name = 'famA')),
  $$ values ('2026-11-06'::date, '2026-11-06'::date) $$,
  'Terminar exactamente a medianoche no toca el día siguiente');
select pg_temp.logout();

-- Zona con cambio de horario (familia B en America/New_York): la hora local se conserva.
select pg_temp.login_as('b0000000-0000-4000-8000-00000000000b', 'bruno.test@cofi.invalid');
select results_eq(
  format($$ select (public.create_household_task(%1$L, gen_random_uuid(), 'Antes DST', null, null,
              '2026-03-07', '08:00', 'normal', 'family')).due_at
            union all
            select (public.create_household_task(%1$L, gen_random_uuid(), 'Después DST', null, null,
              '2026-03-09', '08:00', 'normal', 'family')).due_at $$,
         (select id from ids where name = 'famB')),
  $$ values ('2026-03-07 13:00+00'::timestamptz), ('2026-03-09 12:00+00'::timestamptz) $$,
  'Las 08:00 locales se convierten con el horario vigente de cada fecha (DST)');
select pg_temp.logout();

select * from finish();
rollback;
