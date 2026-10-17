-- Hito B: recurrencias, tareas infantiles, puntos y canjes.
begin;
create extension if not exists pgtap with schema extensions;
select plan(41);

-- ---------------------------------------------------------------------------
-- Motor de recurrencias (función pura)
-- ---------------------------------------------------------------------------
select results_eq(
  $$ select d from private.recurrence_dates('daily', 2, null, null, 'skip', '2026-10-01', null, '2026-10-01', '2026-10-07') d $$,
  $$ values ('2026-10-01'::date), ('2026-10-03'), ('2026-10-05'), ('2026-10-07') $$,
  'Diaria cada 2 días');

select results_eq(
  $$ select d from private.recurrence_dates('weekdays', 1, null, null, 'skip', '2026-10-15', null, '2026-10-15', '2026-10-20') d $$,
  $$ values ('2026-10-15'::date), ('2026-10-16'), ('2026-10-19'), ('2026-10-20') $$,
  'Días de semana excluye sábado y domingo');

select results_eq(
  $$ select d from private.recurrence_dates('weekly', 2, '{1,3}', null, 'skip', '2026-10-05', null, '2026-10-05', '2026-10-25') d $$,
  $$ values ('2026-10-05'::date), ('2026-10-07'), ('2026-10-19'), ('2026-10-21') $$,
  'Semanal lunes y miércoles cada 2 semanas');

select results_eq(
  $$ select d from private.recurrence_dates('monthly', 1, null, 31::smallint, 'skip', '2026-01-31', null, '2026-01-01', '2026-06-30') d $$,
  $$ values ('2026-01-31'::date), ('2026-03-31'), ('2026-05-31') $$,
  'Mensual el 31 con política «saltar»: no inventa fechas');

select results_eq(
  $$ select d from private.recurrence_dates('monthly', 1, null, 31::smallint, 'last_day', '2026-01-31', null, '2026-01-01', '2026-04-30') d $$,
  $$ values ('2026-01-31'::date), ('2026-02-28'), ('2026-03-31'), ('2026-04-30') $$,
  'Mensual el 31 con política «último día»');

select results_eq(
  $$ select d from private.recurrence_dates('monthly', 12, null, 29::smallint, 'skip', '2028-02-29', null, '2028-01-01', '2032-12-31') d $$,
  $$ values ('2028-02-29'::date), ('2032-02-29') $$,
  '29 de febrero anual solo en años bisiestos');

select is(
  (select count(*)::int from private.recurrence_dates('daily', 1, null, null, 'skip', '2026-10-01', '2026-10-03', '2026-10-01', '2026-12-31')),
  3, 'La fecha final de la serie se respeta');

select is(
  (select count(*)::int from private.recurrence_dates('once', 1, null, null, 'skip', '2026-10-10', null, '2026-10-01', '2026-10-31')),
  1, 'Una vez: una sola fecha');

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at, is_anonymous)
values
  ('a1000000-0000-4000-8000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated',
   'authenticated', 'resp.ana@cofi.invalid', '', now(), '{}', '{}', now(), now(), false),
  ('b1000000-0000-4000-8000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated',
   'authenticated', 'resp.bruno@cofi.invalid', '', now(), '{}', '{}', now(), now(), false);

create function pg_temp.login_as(p_uid uuid, p_email text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated',
    'email', p_email, 'is_anonymous', false)::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function pg_temp.logout() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;
grant execute on function pg_temp.login_as(uuid, text), pg_temp.logout() to authenticated;
create temp table ids (name text primary key, id uuid);
grant select, insert, update on ids to authenticated;
create function pg_temp.id(p text) returns uuid language sql stable as $$ select id from ids where name = p $$;
grant execute on function pg_temp.id(text) to authenticated;

select pg_temp.login_as('b1000000-0000-4000-8000-00000000000b', 'resp.bruno@cofi.invalid');
insert into ids values ('famB', public.create_family(gen_random_uuid(), 'Familia B', 'America/Lima', 'Bruno', '#2563EB'));
select pg_temp.logout();

select pg_temp.login_as('a1000000-0000-4000-8000-00000000000a', 'resp.ana@cofi.invalid');
insert into ids values ('fam', public.create_family(gen_random_uuid(), 'Familia A', 'America/Lima', 'Ana', '#7C3AED'));
with x as (insert into public.family_members (family_id, display_name, kind, color)
           values (pg_temp.id('fam'), 'Mateo', 'child', '#16A34A') returning id)
insert into ids select 'mateo', id from x;
with x as (insert into public.family_members (family_id, display_name, kind, color)
           values (pg_temp.id('fam'), 'Sofía', 'child', '#EA580C') returning id)
insert into ids select 'sofia', id from x;

-- ---------------------------------------------------------------------------
-- Series de eventos
-- ---------------------------------------------------------------------------
insert into ids values ('series', public.create_event_series(
  pg_temp.id('fam'), gen_random_uuid(), 'Natación', null, false, '16:00', 60, null, null, 'family', 'normal',
  false, array[pg_temp.id('mateo')], 'weekly', 1, '{2,4}', null, 'skip', private.family_today(pg_temp.id('fam')), null));

select ok((select count(*) from public.calendar_events where series_id = pg_temp.id('series')) between 16 and 19,
  'La serie se materializa con horizonte acotado (~60 días)');
select is((select count(*)::int from public.calendar_events e
           where e.series_id = pg_temp.id('series')
             and extract(hour from e.starts_at at time zone 'America/Lima') <> 16),
  0, 'Cada ocurrencia conserva la hora local');
select is((select count(*)::int from public.event_participants p join public.calendar_events e on e.id = p.event_id
           where e.series_id = pg_temp.id('series')),
  (select count(*)::int from public.calendar_events where series_id = pg_temp.id('series')),
  'Cada ocurrencia hereda sus participantes');

-- Cancelar una ocurrencia y volver a materializar: no reaparece ni se duplica.
insert into ids select 'occ', id from public.calendar_events
  where series_id = pg_temp.id('series') order by occurrence_date offset 1 limit 1;
select public.cancel_event(pg_temp.id('occ'), 1, gen_random_uuid(), 'Feriado');
select pg_temp.logout();
update public.event_series set materialized_until = null where id = pg_temp.id('series');
select is(private.materialize_event_series(pg_temp.id('series'), (now() at time zone 'America/Lima')::date + 60),
  0, 'Volver a materializar no crea duplicados');
select is((select status from public.calendar_events where id = pg_temp.id('occ')), 'cancelled',
  'La excepción cancelada no resucita');
select ok((select is_exception from public.calendar_events where id = pg_temp.id('occ')),
  'La ocurrencia editada queda marcada como excepción');

select pg_temp.login_as('a1000000-0000-4000-8000-00000000000a', 'resp.ana@cofi.invalid');
select public.end_event_series(pg_temp.id('series'), private.family_today(pg_temp.id('fam')) + 14, false);
select is((select count(*)::int from public.calendar_events
           where series_id = pg_temp.id('series') and occurrence_date >= private.family_today(pg_temp.id('fam')) + 14
             and not is_exception),
  0, 'Terminar la serie quita las ocurrencias futuras sin cambios manuales');

-- ---------------------------------------------------------------------------
-- Plantillas y ocurrencias por hijo
-- ---------------------------------------------------------------------------
insert into ids values ('tpl', public.save_task_template(
  pg_temp.id('fam'), null, null, gen_random_uuid(), 'chore', 'Tender la cama', null, 10, true, '23:59',
  array[pg_temp.id('mateo'), pg_temp.id('sofia')], 'daily', 1, null, null, 'skip',
  private.family_today(pg_temp.id('fam')), null));

select is((select count(*)::int from public.task_occurrences where template_id = pg_temp.id('tpl')),
  30, 'Una ocurrencia por hijo y por día (2 × 15 días)');
select is((select count(distinct assignee_member_id)::int from public.task_occurrences
           where template_id = pg_temp.id('tpl') and due_date = private.family_today(pg_temp.id('fam'))),
  2, 'Una tarea para dos hijos genera seguimiento independiente');

insert into ids select 'tM', id from public.task_occurrences
  where template_id = pg_temp.id('tpl') and assignee_member_id = pg_temp.id('mateo')
    and due_date = private.family_today(pg_temp.id('fam'));
insert into ids select 'tS', id from public.task_occurrences
  where template_id = pg_temp.id('tpl') and assignee_member_id = pg_temp.id('sofia')
    and due_date = private.family_today(pg_temp.id('fam'));

-- Entrega a tiempo; aprobación posterior
select is((public.submit_task(pg_temp.id('tM'), gen_random_uuid())).status, 'in_review',
  'Con revisión: la entrega queda en revisión');
select is((select status from public.task_occurrences where id = pg_temp.id('tS')), 'pending',
  'Entregar la de Mateo no completa la de Sofía');
select pg_temp.logout();
-- Simular que el adulto aprueba cuando el límite ya pasó (due_at se deriva por trigger).
update public.task_occurrences set due_date = due_date - 1 where id = pg_temp.id('tM');
select pg_temp.login_as('a1000000-0000-4000-8000-00000000000a', 'resp.ana@cofi.invalid');

insert into ids values ('cmd', gen_random_uuid());
select is((public.review_task(pg_temp.id('tM'),
  (select version from public.task_occurrences where id = pg_temp.id('tM')), pg_temp.id('cmd'), 'approve', null)).status,
  'done', 'El adulto aprueba');
select is((select submitted_late from public.task_occurrences where id = pg_temp.id('tM')), false,
  'La aprobación tardía no convierte en atraso una entrega puntual');
select is((select balance from public.member_point_accounts where member_id = pg_temp.id('mateo')), 10,
  'La aprobación acredita los puntos');

-- Repetir la aprobación (mismo comando y comando distinto): un solo crédito
select public.review_task(pg_temp.id('tM'), 1, pg_temp.id('cmd'), 'approve', null);
select public.review_task(pg_temp.id('tM'), 1, gen_random_uuid(), 'approve', null);
select is((select count(*)::int from public.points_ledger where source_id = pg_temp.id('tM')), 1,
  'Aprobaciones repetidas generan un solo crédito');

-- Entrega tardía
select pg_temp.logout();
update public.task_occurrences set due_date = due_date - 1 where id = pg_temp.id('tS');
select pg_temp.login_as('a1000000-0000-4000-8000-00000000000a', 'resp.ana@cofi.invalid');
select public.submit_task(pg_temp.id('tS'), gen_random_uuid());
select is((select submitted_late from public.task_occurrences where id = pg_temp.id('tS')), true,
  'Una entrega después del límite queda como tardía');

-- Exención: no cuenta ni acredita
insert into ids select 'tM2', id from public.task_occurrences
  where template_id = pg_temp.id('tpl') and assignee_member_id = pg_temp.id('mateo')
    and due_date = private.family_today(pg_temp.id('fam')) + 1;
select is((public.adjust_task(pg_temp.id('tM2'), gen_random_uuid(), 'exempt', 'Está enfermo')).status, 'exempt',
  'Eximir una ocurrencia');
select is((select count(*)::int from public.points_ledger where source_id = pg_temp.id('tM2')), 0,
  'Eximir no crea créditos');
select throws_ok(
  format($$ select public.adjust_task(%L, gen_random_uuid(), 'exempt', '  ') $$, pg_temp.id('tM2')),
  'P0001', null, 'Corregir un registro exige motivo');

-- Reabrir una tarea cumplida revierte sus puntos una sola vez
select public.adjust_task(pg_temp.id('tM'), gen_random_uuid(), 'reopen', 'Revisé y no estaba hecha');
select is((select balance from public.member_point_accounts where member_id = pg_temp.id('mateo')), 0,
  'Reabrir compensa el crédito');
select public.adjust_task(pg_temp.id('tM'), gen_random_uuid(), 'reopen', 'Otra vez');
select is((select count(*)::int from public.points_ledger where source_id = pg_temp.id('tM') and kind = 'task_reversal'), 1,
  'La compensación no se aplica dos veces');

-- Volver a aprobar acredita de nuevo (nuevo ciclo, clave distinta)
select public.review_task(pg_temp.id('tM'), (select version from public.task_occurrences where id = pg_temp.id('tM')),
  gen_random_uuid(), 'approve', null);
select is((select balance from public.member_point_accounts where member_id = pg_temp.id('mateo')), 10,
  'Una nueva aprobación vuelve a acreditar');

-- Editar la plantilla regenera solo lo futuro sin entregar; conserva puntos históricos
select public.save_task_template(pg_temp.id('fam'), pg_temp.id('tpl'),
  (select version from public.task_templates where id = pg_temp.id('tpl')), gen_random_uuid(), 'chore', 'Tender la cama',
  null, 25, true, '23:59', array[pg_temp.id('mateo'), pg_temp.id('sofia')], 'daily', 1, null, null, 'skip',
  private.family_today(pg_temp.id('fam')), null);
select is((select points from public.task_occurrences where id = pg_temp.id('tM')), 10,
  'Cambiar la plantilla no reescribe una ocurrencia ya cumplida');
select is((select points from public.task_occurrences where template_id = pg_temp.id('tpl')
           and assignee_member_id = pg_temp.id('sofia') and due_date = private.family_today(pg_temp.id('fam')) + 3),
  25, 'Las ocurrencias futuras usan los nuevos puntos');

-- ---------------------------------------------------------------------------
-- Premios y canjes
-- ---------------------------------------------------------------------------
insert into ids values ('reward', public.save_reward(pg_temp.id('fam'), null, gen_random_uuid(), 'Elegir película',
  null, 8, true, null, '{}'));
insert into ids select 'r1', (public.request_redemption(pg_temp.id('reward'), pg_temp.id('mateo'), gen_random_uuid())).id;
insert into ids select 'r2', (public.request_redemption(pg_temp.id('reward'), pg_temp.id('mateo'), gen_random_uuid())).id;
select is((public.decide_redemption(pg_temp.id('r1'), 'approve', null)).status, 'approved', 'Aprobar el primer canje');
select is((select balance from public.member_point_accounts where member_id = pg_temp.id('mateo')), 2,
  'Aprobar descuenta el costo');
select throws_ok(format($$ select public.decide_redemption(%L, 'approve', null) $$, pg_temp.id('r2')),
  'P0001', 'COFI:INSUFFICIENT_BALANCE', 'Dos canjes no gastan más saldo que el disponible');
select throws_ok(
  format($$ select public.request_redemption(%L, %L, gen_random_uuid()) $$, pg_temp.id('reward'), pg_temp.id('mateo')),
  'P0001', 'COFI:INSUFFICIENT_BALANCE', 'No se puede solicitar sin saldo suficiente');
select public.decide_redemption(pg_temp.id('r1'), 'cancel', 'Cambio de planes');
select public.decide_redemption(pg_temp.id('r1'), 'cancel', 'Repetido');
select is((select balance from public.member_point_accounts where member_id = pg_temp.id('mateo')), 10,
  'Cancelar un canje aprobado reembolsa una sola vez');
select throws_ok(
  format($$ select public.adjust_points(%L, %L, -50, 'Prueba', gen_random_uuid()) $$, pg_temp.id('fam'), pg_temp.id('mateo')),
  'P0001', 'COFI:INSUFFICIENT_BALANCE', 'Un ajuste no deja saldo negativo');
select pg_temp.logout();

-- ---------------------------------------------------------------------------
-- Aislamiento
-- ---------------------------------------------------------------------------
select pg_temp.login_as('b1000000-0000-4000-8000-00000000000b', 'resp.bruno@cofi.invalid');
select throws_ok(format($$ select public.review_task(%L, 1, gen_random_uuid(), 'approve', null) $$, pg_temp.id('tS')),
  'P0001', 'COFI:NOT_FOUND', 'Otra familia no puede aprobar tareas ajenas');
select is((select count(*)::int from public.points_ledger), 0, 'Otra familia no ve el libro de puntos');
select throws_ok($$ insert into public.points_ledger (family_id, member_id, amount, kind, source_type, idempotency_key)
                    values (gen_random_uuid(), gen_random_uuid(), 100, 'adjustment', 'adjustment', 'x-hack') $$,
  '42501', null, 'Nadie escribe el libro de puntos directamente');
select pg_temp.logout();

select * from finish();
rollback;
