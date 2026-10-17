-- Borrar una familia elimina todo su contenido (operación sensible y explícita).
begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at, is_anonymous)
values ('a0000000-0000-4000-8000-0000000000fa', '00000000-0000-0000-0000-000000000000', 'authenticated',
        'authenticated', 'borrar.test@cofi.invalid', '', now(), '{}', '{}', now(), now(), false);

select set_config('request.jwt.claims', json_build_object('sub', 'a0000000-0000-4000-8000-0000000000fa',
  'role', 'authenticated', 'email', 'borrar.test@cofi.invalid', 'is_anonymous', false)::text, true);
select set_config('role', 'authenticated', true);

create temp table f as
  select public.create_family(gen_random_uuid(), 'Familia a borrar', 'America/Lima', 'Ana', '#7C3AED') as id;
create temp table kid (id uuid);
with x as (insert into public.family_members (family_id, display_name, kind, color)
           select id, 'Niño', 'child', '#16A34A' from f returning id)
insert into kid select id from x;
select public.create_event((select id from f), gen_random_uuid(), 'Evento',
  (select c.id from public.event_categories c where c.family_id = (select id from f) and c.key = 'visita'),
  false, now(), null, null, null, null, null, 'family', 'normal', false, array[(select id from kid)], 'nota');
select public.create_household_task((select id from f), gen_random_uuid(), 'Tarea', null, (select id from kid),
  current_date, null, 'normal', 'family');

select set_config('role', 'postgres', true);
select set_config('request.jwt.claims', '', true);

select lives_ok($$ delete from public.families where id = (select id from f) $$,
  'Se puede borrar una familia completa');
select is((select count(*)::int from public.family_members where family_id = (select id from f)), 0,
  'Se borran sus integrantes');
select is((select count(*)::int from public.calendar_events where family_id = (select id from f)), 0,
  'Se borran sus eventos y participantes');
select is((select count(*)::int from public.task_occurrences where family_id = (select id from f)), 0,
  'Se borran sus pendientes');

select * from finish();
rollback;
