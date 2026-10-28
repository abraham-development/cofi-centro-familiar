begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at, is_anonymous)
values ('a8000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'appearance@cofi.invalid', '', now(), '{}', '{}', now(), now(), false);
insert into auth.users (id, instance_id, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, is_anonymous)
select ('c8000000-0000-4000-8000-00000000000' || n)::uuid, '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', '{}', '{}', now(), now(), true from generate_series(1, 4) n;

create function pg_temp.login(p_uid uuid, p_anon boolean default true) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated', 'is_anonymous', p_anon)::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function pg_temp.logout() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;
grant execute on function pg_temp.login(uuid, boolean), pg_temp.logout() to authenticated;
create temp table ids (name text primary key, id uuid);
grant select, insert on ids to authenticated;
create function pg_temp.id(p text) returns uuid language sql stable as $$ select id from ids where name = p $$;
grant execute on function pg_temp.id(text) to authenticated;

select pg_temp.login('a8000000-0000-4000-8000-000000000001', false);
insert into ids values ('fam', public.create_family(gen_random_uuid(), 'Apariencia', 'America/Lima', 'Ana', '#7C3AED'));
with m as (insert into public.family_members (family_id, display_name, kind, color) values
  (pg_temp.id('fam'), 'Mateo', 'child', '#16A34A') returning id)
insert into ids select 'mateo', id from m;
with m as (insert into public.family_members (family_id, display_name, kind, color) values
  (pg_temp.id('fam'), 'Sofía', 'child', '#EA580C') returning id)
insert into ids select 'sofia', id from m;
select throws_ok($$ select public.save_child_appearance('#2563EB', 'cat') $$,
  'P0001', 'COFI:FORBIDDEN', 'La sesión adulta no se hace pasar por un vínculo infantil');
select pg_temp.logout();

insert into public.paired_devices (family_id, auth_user_id, name, scope, member_id)
values
  (pg_temp.id('fam'), 'c8000000-0000-4000-8000-000000000001', 'Mateo 1', 'child', pg_temp.id('mateo')),
  (pg_temp.id('fam'), 'c8000000-0000-4000-8000-000000000002', 'Mateo 2', 'child', pg_temp.id('mateo')),
  (pg_temp.id('fam'), 'c8000000-0000-4000-8000-000000000003', 'Cocina', 'home', null);

select pg_temp.login('c8000000-0000-4000-8000-000000000004');
select throws_ok($$ select public.save_child_appearance('#2563EB', 'cat') $$,
  'P0001', 'COFI:FORBIDDEN', 'Sin vínculo no se guarda apariencia');
select pg_temp.logout();
select pg_temp.login('c8000000-0000-4000-8000-000000000003');
select throws_ok($$ select public.save_child_appearance('#2563EB', 'cat') $$,
  'P0001', 'COFI:FORBIDDEN', 'La pantalla común no personaliza a un hijo');
select pg_temp.logout();

select pg_temp.login('c8000000-0000-4000-8000-000000000001');
select is((select accent_color from public.save_child_appearance('#db2777', 'cat')), '#DB2777', 'Guarda y normaliza el color');
select is((select child_avatar_key from public.family_members where id = pg_temp.id('mateo')), 'cat', 'Guarda el avatar propio');
select is((select child_avatar_key from public.family_members where id = pg_temp.id('sofia')), null, 'No modifica a su hermana');
select is((select color from public.family_members where id = pg_temp.id('mateo')), '#16A34A', 'Conserva el color familiar');
select throws_ok($$ select public.save_child_appearance('red', 'cat') $$, 'P0001', 'COFI:INVALID', 'Rechaza color inválido');
select throws_ok($$ select public.save_child_appearance('#2563EB', '<img>') $$, 'P0001', 'COFI:INVALID', 'Rechaza avatares ajenos al catálogo');
select throws_ok($$ update public.family_members set child_accent_color = '#2563EB' $$, '42501', null, 'No permite DML directo de apariencia');
update public.family_members set display_name = 'Hack' where id = pg_temp.id('mateo');
select is((select display_name from public.family_members where id = pg_temp.id('mateo')), 'Mateo', 'No permite editar el nombre mediante RLS');
select pg_temp.logout();

select pg_temp.login('c8000000-0000-4000-8000-000000000002');
select is((select child_accent_color from public.family_members where id = pg_temp.id('mateo')), '#DB2777', 'Otra pantalla del mismo hijo lee la apariencia');
select lives_ok($$ select public.save_child_appearance(null, null) $$, 'Permite recuperar la apariencia familiar');
select is((select child_avatar_key from public.family_members where id = pg_temp.id('mateo')), null, 'Recuperar no borra el perfil');
select pg_temp.logout();
update public.paired_devices set revoked_at = now() where auth_user_id = 'c8000000-0000-4000-8000-000000000002';
select pg_temp.login('c8000000-0000-4000-8000-000000000002');
select throws_ok($$ select public.save_child_appearance('#2563EB', 'dog') $$, 'P0001', 'COFI:FORBIDDEN', 'Un vínculo revocado no escribe');
select pg_temp.logout();
update public.family_members set archived_at = now() where id = pg_temp.id('mateo');
select pg_temp.login('c8000000-0000-4000-8000-000000000001');
select throws_ok($$ select public.save_child_appearance('#2563EB', 'dog') $$, 'P0001', 'COFI:FORBIDDEN', 'Un hijo archivado no se personaliza');
select pg_temp.logout();
set local role anon;
select throws_ok($$ select public.save_child_appearance('#2563EB', 'cat') $$, '42501', null, 'Sin autenticar no se ejecuta la RPC');
reset role;
select is((select count(*)::int from private.broadcast_topics('family_members',
  jsonb_build_array(jsonb_build_object('family_id', pg_temp.id('fam')))) where broadcast_topics like '%:screens'),
  1, 'El cambio de integrante usa el canal de pantallas existente');

select * from finish();
rollback;
