-- Partir una serie («esta y las siguientes») en una sola transacción.
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at, is_anonymous)
values ('a4000000-0000-4000-8000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated',
        'authenticated', 'split.ana@cofi.invalid', '', now(), '{}', '{}', now(), now(), false);
select set_config('request.jwt.claims', json_build_object('sub', 'a4000000-0000-4000-8000-00000000000a',
  'role', 'authenticated', 'email', 'split.ana@cofi.invalid', 'is_anonymous', false)::text, true);
select set_config('role', 'authenticated', true);

create temp table ids (name text primary key, id uuid);
insert into ids values ('fam', public.create_family(gen_random_uuid(), 'Split', 'America/Lima', 'Ana', '#7C3AED'));
create function pg_temp.id(p text) returns uuid language sql stable as $$ select id from ids where name = p $$;
create function pg_temp.today() returns date language sql stable as $$ select private.family_today(pg_temp.id('fam')) $$;

insert into ids values ('s1', public.create_event_series(pg_temp.id('fam'), gen_random_uuid(), 'Fútbol', null, false,
  '17:00', 60, null, null, 'family', 'normal', true, '{}', 'daily', 1, null, null, 'skip', pg_temp.today(), null));
-- Editar a mano la ocurrencia de dentro de 10 días (excepción)
select public.update_event((select id from public.calendar_events where series_id = pg_temp.id('s1')
  and occurrence_date = pg_temp.today() + 10), 1, gen_random_uuid(), 'Fútbol (amistoso)', null, false,
  ((pg_temp.today() + 10) + time '10:00') at time zone 'America/Lima', null, null, null, null, null,
  'family', 'normal', true, '{}');

insert into ids values ('cmd', gen_random_uuid());
insert into ids values ('s2', public.split_event_series(pg_temp.id('s1'), pg_temp.today() + 5, pg_temp.id('cmd'), 'Fútbol',
  null, false, '18:30', 90, null, null, 'family', 'normal', true, '{}', 'daily', 1, null, null, 'skip', null));

select is((select count(*)::int from public.calendar_events where series_id = pg_temp.id('s1') and not is_exception),
  5, 'La serie original conserva solo las fechas anteriores');
select is((select title from public.calendar_events where series_id = pg_temp.id('s1') and is_exception),
  'Fútbol (amistoso)', 'La excepción editada a mano se conserva');
select ok((select bool_and(extract(hour from starts_at at time zone 'America/Lima') = 18)
           from public.calendar_events where series_id = pg_temp.id('s2')), 'La nueva serie usa la nueva hora');
select is((select count(*)::int from public.calendar_events e
           where e.family_id = pg_temp.id('fam') and e.occurrence_date = pg_temp.today() + 7),
  1, 'No hay duplicados en una misma fecha');
select is(public.split_event_series(pg_temp.id('s1'), pg_temp.today() + 5, pg_temp.id('cmd'), 'Fútbol', null, false,
  '18:30', 90, null, null, 'family', 'normal', true, '{}', 'daily', 1, null, null, 'skip', null),
  pg_temp.id('s2'), 'Repetir el comando no crea otra serie');

select * from finish();
rollback;
