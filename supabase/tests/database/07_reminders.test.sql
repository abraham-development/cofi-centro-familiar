-- Hito C: avisos persistentes, reglas de preparativos y entregas Push.
begin;
create extension if not exists pgtap with schema extensions;
-- La sincronización evento → trabajos es diferida (al confirmar). En la prueba,
-- que nunca confirma, se fuerza a ejecutarse al final de cada sentencia.
set constraints all immediate;
select plan(33);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at, is_anonymous)
values
  ('a5000000-0000-4000-8000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated',
   'authenticated', 'rem.ana@cofi.invalid', '', now(), '{}', '{}', now(), now(), false),
  ('b5000000-0000-4000-8000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated',
   'authenticated', 'rem.bruno@cofi.invalid', '', now(), '{}', '{}', now(), now(), false);

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
grant execute on function pg_temp.login_as(uuid, text), pg_temp.logout() to authenticated, service_role;
create temp table ids (name text primary key, id uuid);
grant select, insert on ids to authenticated, service_role;
create function pg_temp.id(p text) returns uuid language sql stable as $$ select id from ids where name = p $$;
create function pg_temp.at(p_days int, p_time time) returns timestamptz language sql stable as $$
  select (((now() at time zone 'America/Lima')::date + p_days) + p_time) at time zone 'America/Lima' $$;
grant execute on function pg_temp.id(text), pg_temp.at(int, time) to authenticated, service_role;
-- Vence un trabajo ya (simula el paso del tiempo).
create function pg_temp.make_due(p_job uuid) returns void language sql as $$
  update public.reminder_jobs set due_at = now() - interval '1 minute' where id = p_job $$;

select pg_temp.login_as('a5000000-0000-4000-8000-00000000000a', 'rem.ana@cofi.invalid');
insert into ids values ('fam', public.create_family(gen_random_uuid(), 'Avisos', 'America/Lima', 'Ana', '#7C3AED'));
with x as (insert into public.family_members (family_id, display_name, kind, color)
           values (pg_temp.id('fam'), 'Mateo', 'child', '#16A34A') returning id)
insert into ids select 'mateo', id from x;

-- ---------------------------------------------------------------------------
-- Recordatorios del evento (outbox en la misma transacción)
-- ---------------------------------------------------------------------------
insert into ids select 'ev', (public.create_event(pg_temp.id('fam'), gen_random_uuid(), 'Visita de la tía Carmen',
  null, false, pg_temp.at(3, '17:00'), pg_temp.at(3, '19:00'), null, null, 'Casa', 'Ordenar la sala', 'family',
  'high', true, '{}', null, '{60,1440}')).id;

select is((select count(*)::int from public.reminder_jobs where source_id = pg_temp.id('ev') and status = 'pending'),
  2, 'Crear el evento registra sus recordatorios en la misma transacción');
select is((select due_at from public.reminder_jobs where source_id = pg_temp.id('ev') and offset_minutes = 60),
  pg_temp.at(3, '16:00'), 'El recordatorio de 1 hora antes queda a las 16:00 locales');

-- Reprogramar: se mueven los trabajos, sin duplicados
select public.update_event(pg_temp.id('ev'), 1, gen_random_uuid(), 'Visita de la tía Carmen', null, false,
  pg_temp.at(3, '18:00'), pg_temp.at(3, '20:00'), null, null, 'Casa', 'Ordenar la sala', 'family', 'high', true,
  '{}', null, '{60,1440}');
select is((select count(*)::int from public.reminder_jobs where source_id = pg_temp.id('ev')), 2,
  'Reprogramar no duplica trabajos');
select is((select due_at from public.reminder_jobs where source_id = pg_temp.id('ev') and offset_minutes = 60),
  pg_temp.at(3, '17:00'), 'Reprogramar mueve el recordatorio a la nueva hora');
select is((select source_version from public.reminder_jobs where source_id = pg_temp.id('ev') and offset_minutes = 60),
  2, 'El trabajo apunta a la versión vigente del evento');

-- Quitar un recordatorio lo anula
select public.update_event(pg_temp.id('ev'), 2, gen_random_uuid(), 'Visita de la tía Carmen', null, false,
  pg_temp.at(3, '18:00'), pg_temp.at(3, '20:00'), null, null, 'Casa', 'Ordenar la sala', 'family', 'high', true,
  '{}', null, '{60}');
select is((select status from public.reminder_jobs where source_id = pg_temp.id('ev') and offset_minutes = 1440),
  'cancelled', 'Quitar un recordatorio anula su trabajo');
select pg_temp.logout();

-- ---------------------------------------------------------------------------
-- Procesamiento (como el cron: sin sesión)
-- ---------------------------------------------------------------------------
insert into ids select 'job60', id from public.reminder_jobs where source_id = pg_temp.id('ev') and offset_minutes = 60;
select pg_temp.make_due(pg_temp.id('job60'));
select private.process_reminder_jobs(50);
select is((select status from public.reminder_jobs where id = pg_temp.id('job60')), 'completed',
  'El proceso de servidor completa el trabajo sin pantallas abiertas');
select results_eq($$ select audience, title from public.notifications where source_id = (select id from ids where name = 'ev') $$,
  $$ values ('family'::text, 'Visita de la tía Carmen'::text) $$, 'Se crea un aviso interno para la familia');
select ok((select body from public.notifications where source_id = pg_temp.id('ev')) like 'Empieza %',
  'El texto del aviso indica cuándo empieza');

-- Reintento del mismo trabajo (p. ej., reclamación vencida): no duplica el aviso
update public.reminder_jobs set status = 'claimed', claimed_at = now() - interval '10 minutes' where id = pg_temp.id('job60');
select private.process_reminder_jobs(50);
select is((select count(*)::int from public.notifications where source_id = pg_temp.id('ev')), 1,
  'Una reclamación vencida se recupera sin duplicar el aviso');

-- Ventana de relevancia y versión superada
insert into public.reminder_jobs (family_id, job_key, kind, source_type, source_id, source_version, due_at, relevant_until)
values (pg_temp.id('fam'), 'test:stale', 'event_reminder', 'event', pg_temp.id('ev'), 3, now() - interval '2 hours',
        now() - interval '1 hour'),
       (pg_temp.id('fam'), 'test:old-version', 'event_reminder', 'event', pg_temp.id('ev'), 1, now() - interval '1 minute',
        now() + interval '1 hour');
select private.process_reminder_jobs(50);
select is((select status || ':' || last_error from public.reminder_jobs where job_key = 'test:stale'),
  'cancelled:fuera de la ventana de relevancia', 'Un aviso que ya no sirve se descarta con trazabilidad');
select is((select status || ':' || last_error from public.reminder_jobs where job_key = 'test:old-version'),
  'cancelled:versión superada', 'Un trabajo de una versión anterior no se entrega');

-- Cancelar el evento anula lo pendiente
select pg_temp.login_as('a5000000-0000-4000-8000-00000000000a', 'rem.ana@cofi.invalid');
insert into ids select 'ev2', (public.create_event(pg_temp.id('fam'), gen_random_uuid(), 'Técnico', null, false,
  pg_temp.at(4, '10:00'), null, null, null, null, null, 'family', 'normal', false, '{}', null, '{30}')).id;
select public.cancel_event(pg_temp.id('ev2'), 1, gen_random_uuid(), 'Ya no viene');
select is((select status from public.reminder_jobs where source_id = pg_temp.id('ev2')), 'cancelled',
  'Cancelar el evento evita futuros avisos');

-- ---------------------------------------------------------------------------
-- Reglas de preparativos (aceptadas por un adulto)
-- ---------------------------------------------------------------------------
insert into ids values ('rule', public.save_automation_rule(pg_temp.id('fam'), null, 'visit_prep', 'Preparar visita', true,
  '20:00', '07:00', 60, 'Ordenar la sala', array[pg_temp.id('mateo')], 10, 'family'));
insert into ids select 'ev3', (public.create_event(pg_temp.id('fam'), gen_random_uuid(), 'Visita de los abuelos', null,
  false, pg_temp.at(3, '17:00'), pg_temp.at(3, '19:00'), null, null, null, null, 'family', 'high', true, '{}', null,
  '{}', array[pg_temp.id('rule')])).id;

select is((select count(*)::int from public.reminder_jobs where source_id = pg_temp.id('ev3') and rule_id is not null),
  2, 'La regla genera aviso la noche anterior y la mañana del día');
select is((select due_at from public.reminder_jobs where source_id = pg_temp.id('ev3') and kind = 'prep_evening'),
  pg_temp.at(2, '20:00'), 'El aviso de la noche anterior es a las 20:00 locales');
select is((select due_at from public.task_occurrences where source_event_id = pg_temp.id('ev3')),
  pg_temp.at(3, '16:00'), 'La tarea de preparación vence 1 hora antes de la visita');
select is((select count(*)::int from public.task_occurrences where source_event_id = pg_temp.id('ev3')), 1,
  'Una tarea por integrante seleccionado');

-- Volver a guardar sin cambios no duplica nada
select public.update_event(pg_temp.id('ev3'), 1, gen_random_uuid(), 'Visita de los abuelos', null, false,
  pg_temp.at(3, '17:00'), pg_temp.at(3, '19:00'), null, null, null, null, 'family', 'high', true, '{}', null, null, null);
select is((select count(*)::int from public.task_occurrences where source_event_id = pg_temp.id('ev3')), 1,
  'Ejecutar el generador varias veces no duplica tareas');

-- Reprogramar mueve la tarea pendiente
select public.update_event(pg_temp.id('ev3'), 2, gen_random_uuid(), 'Visita de los abuelos', null, false,
  pg_temp.at(3, '18:00'), pg_temp.at(3, '20:00'), null, null, null, null, 'family', 'high', true, '{}', null, null, null);
select is((select due_at from public.task_occurrences where source_event_id = pg_temp.id('ev3')),
  pg_temp.at(3, '17:00'), 'Reprogramar actualiza la hora límite de la tarea pendiente');
select ok(not (select is_exception from public.task_occurrences where source_event_id = pg_temp.id('ev3')),
  'Los cambios de la sincronización no cuentan como ajuste manual');

-- Una tarea ya entregada no se toca al reprogramar ni al cancelar
insert into ids select 'prepTask', id from public.task_occurrences where source_event_id = pg_temp.id('ev3');
select public.submit_task(pg_temp.id('prepTask'), gen_random_uuid());
select public.update_event(pg_temp.id('ev3'), 3, gen_random_uuid(), 'Visita de los abuelos', null, false,
  pg_temp.at(3, '19:00'), pg_temp.at(3, '21:00'), null, null, null, null, 'family', 'high', true, '{}', null, null, null);
select is((select due_at from public.task_occurrences where id = pg_temp.id('prepTask')),
  pg_temp.at(3, '17:00'), 'Una tarea entregada conserva su hora límite');
select public.cancel_event(pg_temp.id('ev3'), 4, gen_random_uuid(), 'Se suspendió');
select is((select status from public.task_occurrences where id = pg_temp.id('prepTask')), 'in_review',
  'Cancelar el evento no borra tareas ya realizadas');
select is((select count(*)::int from public.reminder_jobs where source_id = pg_temp.id('ev3') and status = 'pending'),
  0, 'Cancelar el evento anula sus avisos de preparación');

-- Aviso de la noche anterior: texto con preparativos
insert into ids select 'ev4', (public.create_event(pg_temp.id('fam'), gen_random_uuid(), 'Examen de Matemáticas', null,
  false, pg_temp.at(3, '08:00'), null, null, null, null, 'Llevar uniforme de deporte', 'family', 'high', false,
  array[pg_temp.id('mateo')], null, '{}', array[pg_temp.id('rule')])).id;

-- ---------------------------------------------------------------------------
-- Suscripción Push y entregas
-- ---------------------------------------------------------------------------
select public.save_push_subscription(pg_temp.id('fam'), 'https://push.example.invalid/sub/abc',
  'BN0123456789abcdefghijklmnopqrstuvwxyz', 'auth123456', 'Prueba');
select pg_temp.logout();

insert into ids select 'jobEve', id from public.reminder_jobs where source_id = pg_temp.id('ev4') and kind = 'prep_evening';
select pg_temp.make_due(pg_temp.id('jobEve'));
-- Familia sin horas de silencio para esta parte
update public.families set quiet_start = '00:00', quiet_end = '00:00' where id = pg_temp.id('fam');
select private.process_reminder_jobs(50);
select ok((select title from public.notifications where job_id = pg_temp.id('jobEve') limit 1) like 'Mañana: Examen de Matemáticas%',
  'El aviso de la noche anterior anticipa el evento');
select ok((select body from public.notifications where job_id = pg_temp.id('jobEve') limit 1) like '%Ordenar la sala antes de las%',
  'El aviso incluye los preparativos y su hora límite');
select is((select count(*)::int from public.notification_deliveries d
           join public.notifications n on n.id = d.notification_id where n.job_id = pg_temp.id('jobEve')),
  (select count(*)::int from public.notifications where job_id = pg_temp.id('jobEve')),
  'Cada aviso genera una entrega Push por suscripción');

-- La Edge Function (service_role) reclama y completa
select set_config('role', 'service_role', true);
create temp table claimed as select * from public.claim_push_deliveries(10);
select pg_temp.logout();
select ok((select count(*) from claimed) >= 1, 'La función de envío reclama entregas pendientes');
select set_config('role', 'service_role', true);
select public.complete_push_delivery((select delivery_id from claimed limit 1), 201, null);
select pg_temp.logout();
select is((select status from public.notification_deliveries where id = (select delivery_id from claimed limit 1)),
  'sent', 'Un 201 marca la entrega como enviada');

-- Un fallo no equivale a entrega confirmada; 410 desactiva la suscripción
select set_config('role', 'service_role', true);
select public.complete_push_delivery((select delivery_id from claimed offset 1 limit 1), 500, 'error del servidor')
where (select count(*) from claimed) > 1;
select pg_temp.logout();
insert into public.notification_deliveries (family_id, notification_id, subscription_id)
select n.family_id, n.id, s.id from public.notifications n, public.push_subscriptions s
where n.source_id = pg_temp.id('ev') and s.family_id = pg_temp.id('fam') limit 1;
select set_config('role', 'service_role', true);
create temp table claimed2 as select * from public.claim_push_deliveries(10);
select public.complete_push_delivery((select delivery_id from claimed2 limit 1), 500, 'error temporal');
select pg_temp.logout();
select is((select status from public.notification_deliveries where id = (select delivery_id from claimed2 limit 1)),
  'retry', 'Un error del servicio Push se reintenta (no se marca como recibido)');
select set_config('role', 'service_role', true);
select public.complete_push_delivery((select delivery_id from claimed2 limit 1), 410, 'gone');
select pg_temp.logout();
select ok((select revoked_at is not null from public.push_subscriptions where endpoint = 'https://push.example.invalid/sub/abc'),
  'Una suscripción caducada (410) se desactiva');

-- Horas de silencio: un aviso normal de noche se difiere hasta el final del silencio
update public.push_subscriptions set revoked_at = null where endpoint = 'https://push.example.invalid/sub/abc';
update public.families set
  quiet_start = ((now() at time zone 'America/Lima') - interval '1 hour')::time,
  quiet_end = ((now() at time zone 'America/Lima') + interval '1 hour')::time
where id = pg_temp.id('fam');
select pg_temp.login_as('a5000000-0000-4000-8000-00000000000a', 'rem.ana@cofi.invalid');
insert into ids select 'ev5', (public.create_event(pg_temp.id('fam'), gen_random_uuid(), 'Recoger ropa', null, false,
  now() + interval '3 hours', null, null, null, null, null, 'family', 'normal', false, '{}', null, '{10}')).id;
select pg_temp.logout();
select pg_temp.make_due(id) from public.reminder_jobs where source_id = pg_temp.id('ev5');
select private.process_reminder_jobs(50);
select ok((select d.not_before > now() + interval '30 minutes' from public.notification_deliveries d
           join public.notifications n on n.id = d.notification_id where n.source_id = pg_temp.id('ev5') limit 1),
  'En horas de silencio la entrega Push se difiere (el aviso visual existe igual)');

-- Clientes no pueden reclamar entregas
select pg_temp.login_as('a5000000-0000-4000-8000-00000000000a', 'rem.ana@cofi.invalid');
select throws_ok($$ select * from public.claim_push_deliveries(1) $$, '42501', null,
  'Solo el servicio de envío reclama entregas');
select pg_temp.logout();

-- Aislamiento
select pg_temp.login_as('b5000000-0000-4000-8000-00000000000b', 'rem.bruno@cofi.invalid');
select is((select count(*)::int from public.notifications), 0, 'Otra familia no ve los avisos');
select pg_temp.logout();

select * from finish();
rollback;
