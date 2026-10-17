-- Hito B: pantallas vinculadas (sesiones anónimas aprobadas por un adulto).
begin;
create extension if not exists pgtap with schema extensions;
select plan(37);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at, is_anonymous)
values
  ('a2000000-0000-4000-8000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated',
   'authenticated', 'dev.ana@cofi.invalid', '', now(), '{}', '{}', now(), now(), false),
  ('b2000000-0000-4000-8000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated',
   'authenticated', 'dev.bruno@cofi.invalid', '', now(), '{}', '{}', now(), now(), false),
  ('c2000000-0000-4000-8000-0000000000c1', '00000000-0000-0000-0000-000000000000', 'authenticated',
   'authenticated', null, '', null, '{}', '{}', now(), now(), true),
  ('c2000000-0000-4000-8000-0000000000c2', '00000000-0000-0000-0000-000000000000', 'authenticated',
   'authenticated', null, '', null, '{}', '{}', now(), now(), true);

create function pg_temp.login_as(p_uid uuid, p_email text, p_anon boolean default false) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated',
    'email', p_email, 'is_anonymous', p_anon)::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function pg_temp.logout() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;
create function pg_temp.ana() returns void language sql as $$
  select pg_temp.login_as('a2000000-0000-4000-8000-00000000000a', 'dev.ana@cofi.invalid') $$;
create function pg_temp.kitchen() returns void language sql as $$
  select pg_temp.login_as('c2000000-0000-4000-8000-0000000000c1', null, true) $$;
create function pg_temp.room() returns void language sql as $$
  select pg_temp.login_as('c2000000-0000-4000-8000-0000000000c2', null, true) $$;
grant execute on function pg_temp.login_as(uuid, text, boolean), pg_temp.logout(), pg_temp.ana(),
  pg_temp.kitchen(), pg_temp.room() to authenticated;

create temp table ids (name text primary key, id uuid, txt text);
grant select, insert, update on ids to authenticated;
create function pg_temp.id(p text) returns uuid language sql stable as $$ select id from ids where name = p $$;
create function pg_temp.txt(p text) returns text language sql stable as $$ select txt from ids where name = p $$;
grant execute on function pg_temp.id(text), pg_temp.txt(text) to authenticated;

-- Familia de Ana con dos hijos, eventos de distinta visibilidad, tareas y un premio.
select pg_temp.ana();
insert into ids (name, id) values ('fam', public.create_family(gen_random_uuid(), 'Familia Dev', 'America/Lima', 'Ana', '#7C3AED'));
with x as (insert into public.family_members (family_id, display_name, kind, color)
           values (pg_temp.id('fam'), 'Mateo', 'child', '#16A34A') returning id)
insert into ids (name, id) select 'mateo', id from x;
with x as (insert into public.family_members (family_id, display_name, kind, color)
           values (pg_temp.id('fam'), 'Sofía', 'child', '#EA580C') returning id)
insert into ids (name, id) select 'sofia', id from x;

insert into ids (name, id) select 'evFamily', (public.create_event(pg_temp.id('fam'), gen_random_uuid(), 'Visita',
  null, false, now() + interval '1 day', null, null, null, null, 'Ordenar la sala', 'family', 'high', true, '{}',
  'nota privada')).id;
insert into ids (name, id) select 'evAdults', (public.create_event(pg_temp.id('fam'), gen_random_uuid(), 'Banco',
  null, false, now() + interval '1 day', null, null, null, null, null, 'adults', 'normal', false, '{}')).id;
insert into ids (name, id) select 'evMateo', (public.create_event(pg_temp.id('fam'), gen_random_uuid(), 'Dentista Mateo',
  null, false, now() + interval '2 day', null, null, null, null, null, 'participants', 'normal', false,
  array[pg_temp.id('mateo')])).id;
insert into ids (name, id) select 'evSofia', (public.create_event(pg_temp.id('fam'), gen_random_uuid(), 'Ballet Sofía',
  null, false, now() + interval '2 day', null, null, null, null, null, 'participants', 'normal', false,
  array[pg_temp.id('sofia')])).id;
insert into ids (name, id) select 'hhFamily', (public.create_household_task(pg_temp.id('fam'), gen_random_uuid(),
  'Comprar gas', null, null, current_date, null, 'normal', 'family')).id;
insert into ids (name, id) select 'hhAdults', (public.create_household_task(pg_temp.id('fam'), gen_random_uuid(),
  'Pagar tarjeta', null, null, current_date, null, 'normal', 'adults')).id;
select public.save_task_template(pg_temp.id('fam'), null, null, gen_random_uuid(), 'chore', 'Ordenar cuarto', null,
  10, true, null, array[pg_temp.id('mateo'), pg_temp.id('sofia')], 'once', 1, null, null, 'skip',
  private.family_today(pg_temp.id('fam')), null);
insert into ids (name, id) select 'choreMateo', id from public.task_occurrences
  where family_id = pg_temp.id('fam') and assignee_member_id = pg_temp.id('mateo');
insert into ids (name, id) select 'choreSofia', id from public.task_occurrences
  where family_id = pg_temp.id('fam') and assignee_member_id = pg_temp.id('sofia');
insert into ids (name, id) values ('reward', public.save_reward(pg_temp.id('fam'), null, gen_random_uuid(),
  'Postre', null, 5, true, null, '{}'));
select public.adjust_points(pg_temp.id('fam'), pg_temp.id('mateo'), 20, 'Inicio', gen_random_uuid());
select pg_temp.logout();

-- ---------------------------------------------------------------------------
-- Solicitud y aprobación
-- ---------------------------------------------------------------------------
select pg_temp.kitchen();
insert into ids (name, txt) select 'codeK', code from public.request_device_pairing();
select is((select status from public.get_device_status()), 'pending', 'La pantalla queda pendiente');
select is((select count(*)::int from public.families), 0, 'Una pantalla pendiente no ve familias');
select is((select count(*)::int from public.calendar_events), 0, 'Una pantalla pendiente no ve la agenda');
select throws_ok(format($$ select public.approve_device_pairing(%L, %L, 'Yo', 'home', null) $$,
  pg_temp.txt('codeK'), pg_temp.id('fam')), 'P0001', 'COFI:SESSION_REQUIRED', 'Una pantalla no puede aprobarse a sí misma');
select pg_temp.logout();

select pg_temp.room();
insert into ids (name, txt) select 'codeR', code from public.request_device_pairing();
select pg_temp.logout();

select pg_temp.ana();
select is((select error_code from public.approve_device_pairing('ZZZZ-ZZZZ', pg_temp.id('fam'), 'Cocina', 'home', null)),
  'INVALID_CODE', 'Un código inexistente se rechaza');
select is((select ok from public.approve_device_pairing(lower(pg_temp.txt('codeK')), pg_temp.id('fam'), 'Cocina', 'home', null)),
  true, 'Un adulto aprueba la pantalla de la cocina (el código no distingue mayúsculas)');
select is((select error_code from public.approve_device_pairing(pg_temp.txt('codeK'), pg_temp.id('fam'), 'Otra', 'home', null)),
  'INVALID_CODE', 'El código es de un solo uso');
select is((select ok from public.approve_device_pairing(pg_temp.txt('codeR'), pg_temp.id('fam'), 'Cuarto de Mateo', 'child',
  pg_temp.id('mateo'))), true, 'Un adulto aprueba la pantalla del cuarto de Mateo');
select pg_temp.logout();

-- ---------------------------------------------------------------------------
-- Pantalla común (cocina)
-- ---------------------------------------------------------------------------
select pg_temp.kitchen();
select is((select status from public.get_device_status()), 'paired', 'La cocina queda vinculada');
select results_eq($$ select title from public.calendar_events order by title $$,
  $$ values ('Visita'::text) $$, 'La cocina solo ve eventos de toda la familia');
select is((select count(*)::int from public.calendar_event_private_notes), 0, 'La cocina no ve notas privadas');
select results_eq($$ select title from public.task_occurrences where kind = 'household' $$,
  $$ values ('Comprar gas'::text) $$, 'La cocina no ve pendientes solo de adultos');
select is((public.set_household_task_status(pg_temp.id('hhFamily'), 'done', gen_random_uuid())).status, 'done',
  'La cocina puede marcar un pendiente de la casa');
select throws_ok(format($$ select public.set_household_task_status(%L, 'cancelled', gen_random_uuid()) $$, pg_temp.id('hhFamily')),
  'P0001', 'COFI:NOT_FOUND', 'La cocina no puede descartar pendientes');
select throws_ok(format($$ select public.create_event(%L, gen_random_uuid(), 'x', null, false, now(), null, null, null,
  null, null, 'family', 'normal', false, '{}') $$, pg_temp.id('fam')),
  'P0001', 'COFI:FORBIDDEN', 'La cocina no crea eventos');
select throws_ok(format($$ select public.review_task(%L, 1, gen_random_uuid(), 'approve', null) $$, pg_temp.id('choreMateo')),
  'P0001', 'COFI:NOT_FOUND', 'La cocina no aprueba tareas');
select throws_ok(format($$ select public.approve_device_pairing('AAAA-AAAA', %L, 'x', 'home', null) $$, pg_temp.id('fam')),
  'P0001', 'COFI:SESSION_REQUIRED', 'La cocina no vincula otras pantallas');
select pg_temp.logout();

-- ---------------------------------------------------------------------------
-- Pantalla del hijo (cuarto de Mateo)
-- ---------------------------------------------------------------------------
select pg_temp.room();
select results_eq($$ select title from public.calendar_events order by title $$,
  $$ values ('Dentista Mateo'::text), ('Visita') $$,
  'El cuarto de Mateo ve lo familiar y lo suyo, no lo de Sofía ni lo de adultos');
select results_eq($$ select assignee_member_id from public.task_occurrences $$,
  format($$ values (%L::uuid) $$, pg_temp.id('mateo')), 'El hijo solo ve sus tareas');
select is((public.submit_task(pg_temp.id('choreMateo'), gen_random_uuid())).status, 'in_review',
  'El hijo entrega su tarea');
select throws_ok(format($$ select public.submit_task(%L, gen_random_uuid()) $$, pg_temp.id('choreSofia')),
  'P0001', 'COFI:NOT_FOUND', 'El hijo no entrega tareas de su hermana');
select throws_ok(format($$ select public.review_task(%L, 2, gen_random_uuid(), 'approve', null) $$, pg_temp.id('choreMateo')),
  'P0001', 'COFI:NOT_FOUND', 'El hijo no aprueba su propia tarea');
select throws_ok(format($$ select public.adjust_points(%L, %L, 100, 'Trampa', gen_random_uuid()) $$,
  pg_temp.id('fam'), pg_temp.id('mateo')), 'P0001', 'COFI:FORBIDDEN', 'El hijo no se asigna puntos');
select is((select count(*)::int from public.member_point_accounts), 1, 'El hijo solo ve su saldo');
select is((public.request_redemption(pg_temp.id('reward'), pg_temp.id('mateo'), gen_random_uuid())).status, 'requested',
  'El hijo solicita un premio');
select throws_ok(format($$ select public.request_redemption(%L, %L, gen_random_uuid()) $$,
  pg_temp.id('reward'), pg_temp.id('sofia')), 'P0001', 'COFI:NOT_FOUND', 'No pide premios en nombre de otro');
select throws_ok(format($$ select public.decide_redemption((select id from public.reward_redemptions limit 1), 'approve', null) $$),
  'P0001', 'COFI:NOT_FOUND', 'El hijo no aprueba canjes');
select is((select count(*)::int from public.paired_devices), 1, 'Una pantalla solo ve su propio vínculo');
select throws_ok($$ insert into public.paired_devices (family_id, auth_user_id, name, scope) values
  ((select family_id from public.paired_devices limit 1), auth.uid(), 'Hack', 'home') $$,
  '42501', null, 'Una pantalla no puede autorizarse escribiendo su vínculo');
select throws_ok(format($$ select public.approve_device_pairing('ABCD-EFGH', %L, 'x', 'home', null) $$, pg_temp.id('fam')),
  'P0001', 'COFI:SESSION_REQUIRED', 'Una pantalla no aprueba vinculaciones');
select throws_ok(format($$ select public.update_device((select id from public.paired_devices limit 1), 'Renombre', false) $$),
  'P0001', 'COFI:NOT_FOUND', 'Una pantalla no se renombra ni se revoca a sí misma');
select pg_temp.logout();

-- ---------------------------------------------------------------------------
-- Aislamiento y revocación
-- ---------------------------------------------------------------------------
select pg_temp.login_as('b2000000-0000-4000-8000-00000000000b', 'dev.bruno@cofi.invalid');
select throws_ok(format($$ select public.update_device((select id from public.paired_devices limit 1), null, true) $$),
  'P0001', 'COFI:NOT_FOUND', 'Otra familia no puede revocar pantallas ajenas');
select pg_temp.logout();

select pg_temp.ana();
select is((select count(*)::int from public.paired_devices where revoked_at is null), 2, 'El adulto ve sus pantallas');
select public.update_device((select id from public.paired_devices where scope = 'child'), null, true);
select pg_temp.logout();

select pg_temp.room();
select is((select status from public.get_device_status()), 'revoked', 'La pantalla detecta su revocación');
select is((select count(*)::int from public.calendar_events), 0, 'Una pantalla revocada no obtiene información nueva');
select throws_ok(format($$ select public.submit_task(%L, gen_random_uuid()) $$, pg_temp.id('choreMateo')),
  'P0001', 'COFI:NOT_FOUND', 'Una pantalla revocada no puede operar');
select pg_temp.logout();

-- Límite de intentos fallidos
select pg_temp.ana();
select public.approve_device_pairing('XXXX-' || i, pg_temp.id('fam'), 'x', 'home', null) from generate_series(1000, 1010) i;
select is((select error_code from public.approve_device_pairing('YYYY-YYYY', pg_temp.id('fam'), 'x', 'home', null)),
  'RATE_LIMITED', 'Demasiados códigos erróneos bloquean temporalmente');
select pg_temp.logout();

select * from finish();
rollback;
