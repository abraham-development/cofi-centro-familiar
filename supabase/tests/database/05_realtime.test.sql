-- Hito B: canales de tiempo real (autorización y contenido mínimo).
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at, is_anonymous)
values
  ('a3000000-0000-4000-8000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated',
   'authenticated', 'rt.ana@cofi.invalid', '', now(), '{}', '{}', now(), now(), false),
  ('b3000000-0000-4000-8000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated',
   'authenticated', 'rt.bruno@cofi.invalid', '', now(), '{}', '{}', now(), now(), false),
  ('c3000000-0000-4000-8000-0000000000c1', '00000000-0000-0000-0000-000000000000', 'authenticated',
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
grant execute on function pg_temp.login_as(uuid, text, boolean), pg_temp.logout() to authenticated;
create temp table ids (name text primary key, id uuid, txt text);
grant select, insert on ids to authenticated;
create function pg_temp.id(p text) returns uuid language sql stable as $$ select id from ids where name = p $$;
grant execute on function pg_temp.id(text) to authenticated;

select pg_temp.login_as('b3000000-0000-4000-8000-00000000000b', 'rt.bruno@cofi.invalid');
insert into ids (name, id) values ('famB', public.create_family(gen_random_uuid(), 'B', 'America/Lima', 'Bruno', '#2563EB'));
select pg_temp.logout();

select pg_temp.login_as('a3000000-0000-4000-8000-00000000000a', 'rt.ana@cofi.invalid');
insert into ids (name, id) values ('fam', public.create_family(gen_random_uuid(), 'A', 'America/Lima', 'Ana', '#7C3AED'));
with x as (insert into public.family_members (family_id, display_name, kind, color)
           values (pg_temp.id('fam'), 'Mateo', 'child', '#16A34A') returning id)
insert into ids (name, id) select 'mateo', id from x;
select pg_temp.logout();

select pg_temp.login_as('c3000000-0000-4000-8000-0000000000c1', null, true);
insert into ids (name, txt) select 'code', code from public.request_device_pairing();
select pg_temp.logout();
select pg_temp.login_as('a3000000-0000-4000-8000-00000000000a', 'rt.ana@cofi.invalid');
select public.approve_device_pairing((select txt from ids where name = 'code'), pg_temp.id('fam'), 'Cocina', 'home', null);
insert into ids (name, id) select 'dev', id from public.paired_devices where family_id = pg_temp.id('fam');

-- Autorización por canal
select ok(private.can_read_topic('fam:' || pg_temp.id('fam') || ':adults'), 'El adulto lee el canal de adultos');
select ok(not private.can_read_topic('fam:' || pg_temp.id('famB') || ':adults'), 'El adulto no lee canales de otra familia');
select ok(not private.can_read_topic('fam:not-a-uuid:adults'), 'Un canal mal formado se rechaza');
select pg_temp.logout();

select pg_temp.login_as('c3000000-0000-4000-8000-0000000000c1', null, true);
select ok(private.can_read_topic('fam:' || pg_temp.id('fam') || ':screens'), 'La pantalla lee el canal de pantallas');
select ok(not private.can_read_topic('fam:' || pg_temp.id('fam') || ':adults'), 'La pantalla no lee el canal de adultos');
select ok(private.can_read_topic('device:' || pg_temp.id('dev')), 'La pantalla lee su canal propio');
select ok(not private.can_read_topic('fam:' || pg_temp.id('famB') || ':screens'), 'La pantalla no lee otras familias');
select pg_temp.logout();

select pg_temp.login_as('b3000000-0000-4000-8000-00000000000b', 'rt.bruno@cofi.invalid');
select ok(not private.can_read_topic('member:' || pg_temp.id('mateo')), 'Otra familia no lee el canal de un hijo ajeno');
select ok(not private.can_read_topic('device:' || pg_temp.id('dev')), 'Otro usuario no lee el canal de una pantalla');
select pg_temp.logout();

-- Canales que recibe cada cambio (los mensajes solo llevan tabla, operación y hora).
-- Nota: realtime.messages se particiona por día y las particiones las crea el
-- servicio Realtime; la entrega real se verifica en las pruebas E2E.
select results_eq(
  format($$ select private.broadcast_topics('calendar_events', jsonb_build_array(jsonb_build_object(
           'family_id', %L, 'visibility', 'adults'))) order by 1 $$, pg_temp.id('fam')),
  format($$ values ('fam:%s:adults'::text) $$, pg_temp.id('fam')),
  'Un evento solo de adultos no avisa a las pantallas');
select results_eq(
  format($$ select private.broadcast_topics('task_occurrences', jsonb_build_array(jsonb_build_object(
           'family_id', %L, 'visibility', 'family', 'assignee_member_id', %L))) order by 1 $$,
         pg_temp.id('fam'), pg_temp.id('mateo')),
  format($$ values ('fam:%1$s:adults'::text), ('fam:%1$s:screens'), ('member:%2$s') $$, pg_temp.id('fam'), pg_temp.id('mateo')),
  'Una tarea de un hijo avisa a adultos, pantallas y al canal del hijo');
select ok(
  (select bool_and(tgenabled <> 'D') from pg_trigger
   where tgrelid = 'public.calendar_events'::regclass and tgname like 'calendar_events_bc_%') is true,
  'Los triggers de difusión están activos');
select ok(exists (select 1 from pg_trigger where tgrelid = 'public.paired_devices'::regclass
                  and tgname = 'paired_devices_broadcast'),
  'Revocar una pantalla dispara un aviso dirigido');

select pg_temp.login_as('a3000000-0000-4000-8000-00000000000a', 'rt.ana@cofi.invalid');
select public.update_device(pg_temp.id('dev'), null, true);
select pg_temp.logout();

select pg_temp.login_as('c3000000-0000-4000-8000-0000000000c1', null, true);
select ok(not private.can_read_topic('fam:' || pg_temp.id('fam') || ':screens'),
  'Una pantalla revocada deja de estar autorizada en el canal de pantallas');
select pg_temp.logout();

select * from finish();
rollback;
