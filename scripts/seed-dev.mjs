#!/usr/bin/env node
/**
 * Datos de demostración SOLO para el proyecto de desarrollo.
 *
 *   node scripts/seed-dev.mjs
 *
 * - Se niega a ejecutarse si el proyecto enlazado no coincide con
 *   DEV_SEED_PROJECT_REF (nunca debe apuntar a producción).
 * - Crea/actualiza cuentas de prueba ya confirmadas con contraseñas aleatorias
 *   guardadas en .env.test.local (ignorado por Git) y no las imprime.
 * - Rehace las familias de demostración de esas cuentas con fechas relativas a
 *   HOY en la zona de cada familia, así el panel nunca queda vacío.
 * - Los datos se crean con los mismos RPC y políticas que usa la aplicación.
 */
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import nextEnv from "@next/env";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
nextEnv.loadEnvConfig(root, true, { info() {}, error() {} });

const allowed = process.env.DEV_SEED_PROJECT_REF?.trim();
const linked = readFileSync(path.join(root, "supabase/.temp/project-ref"), "utf8").trim();
const urlRef = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
if (!allowed || allowed !== linked || allowed !== urlRef) {
  console.error("DEV_SEED_PROJECT_REF no coincide con el proyecto enlazado y la URL. No se siembra nada.");
  process.exit(1);
}

const ACCOUNTS = [
  { key: "MAMA", id: "de000000-0000-4000-8000-0000000000a1", email: "mama.demo@cofi.test" },
  { key: "PAPA", id: "de000000-0000-4000-8000-0000000000a2", email: "papa.demo@cofi.test" },
  { key: "ROSA", id: "de000000-0000-4000-8000-0000000000b1", email: "rosa.demo@cofi.test" },
];

// Contraseñas: se reutilizan si ya existen en .env.test.local.
const envTestPath = path.join(root, ".env.test.local");
const existing = existsSync(envTestPath) ? readFileSync(envTestPath, "utf8") : "";
const lines = ["# Cuentas de demostración del proyecto de DESARROLLO (generado por scripts/seed-dev.mjs)."];
for (const a of ACCOUNTS) {
  const match = new RegExp(`^DEMO_${a.key}_PASSWORD=(.+)$`, "m").exec(existing);
  a.password = match?.[1]?.trim() || `Demo${randomBytes(9).toString("base64url")}9`;
  lines.push(`DEMO_${a.key}_EMAIL=${a.email}`, `DEMO_${a.key}_PASSWORD=${a.password}`);
}
writeFileSync(envTestPath, `${lines.join("\n")}\n`, { mode: 0o600 });

const q = (v) => `'${String(v).replace(/'/g, "''")}'`;
const [mama, papa, rosa] = ACCOUNTS;

const sql = `
begin;

-- Cuentas confirmadas (solo desarrollo)
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at, is_anonymous,
                        confirmation_token, recovery_token, email_change_token_new, email_change,
                        email_change_token_current, phone_change, phone_change_token, reauthentication_token)
values
${ACCOUNTS.map(
  (a) => `  (${q(a.id)}, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', ${q(a.email)},
   extensions.crypt(${q(a.password)}, extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{}', now(), now(), false, '', '', '', '', '', '', '', '')`,
).join(",\n")}
on conflict (id) do update set
  encrypted_password = excluded.encrypted_password,
  email_confirmed_at = coalesce(auth.users.email_confirmed_at, now()),
  updated_at = now();

insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values
${ACCOUNTS.map(
  (a) =>
    `  (${q(a.id)}, ${q(a.id)}, jsonb_build_object('sub', ${q(a.id)}, 'email', ${q(a.email)}, 'email_verified', true), 'email', now(), now(), now())`,
).join(",\n")}
on conflict (provider_id, provider) do nothing;

-- Rehacer familias de demostración (solo las creadas por estas cuentas)
delete from public.families where created_by in (${ACCOUNTS.map((a) => q(a.id)).join(", ")});

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

create temp table s (name text primary key, id uuid);
grant select, insert on s to authenticated;

-- Hora local de referencia
create function pg_temp.at(p_days int, p_time time, p_tz text default 'America/Lima') returns timestamptz
language sql stable as $$
  select (((now() at time zone p_tz)::date + p_days) + p_time) at time zone p_tz
$$;
create function pg_temp.d(p_days int, p_tz text default 'America/Lima') returns date
language sql stable as $$ select (now() at time zone p_tz)::date + p_days $$;
grant execute on function pg_temp.at(int, time, text), pg_temp.d(int, text) to authenticated;

create function pg_temp.cat(p_key text) returns uuid language sql stable as $$
  select c.id from public.event_categories c
  where c.family_id = (select id from s where name = 'fam') and c.key = p_key
$$;
create function pg_temp.m(p_name text) returns uuid language sql stable as $$
  select id from s where name = p_name
$$;
grant execute on function pg_temp.cat(text), pg_temp.m(text) to authenticated;

-- ===== Familia García (Mamá y Papá, Mateo y Sofía) =====
select pg_temp.login_as(${q(mama.id)}, ${q(mama.email)});
insert into s values ('fam', public.create_family(gen_random_uuid(), 'Familia García', 'America/Lima', 'Mamá', '#7C3AED'));
insert into s select 'mama', member_id from public.adult_memberships where family_id = pg_temp.m('fam');
with x as (
  insert into public.family_members (family_id, display_name, kind, color, initials, sort_order)
  values (pg_temp.m('fam'), 'Papá', 'adult', '#2563EB', 'PA', 1) returning id)
insert into s select 'papa', id from x;
with x as (
  insert into public.family_members (family_id, display_name, kind, color, avatar_emoji, sort_order)
  values (pg_temp.m('fam'), 'Mateo', 'child', '#16A34A', '🦖', 2) returning id)
insert into s select 'mateo', id from x;
with x as (
  insert into public.family_members (family_id, display_name, kind, color, avatar_emoji, sort_order)
  values (pg_temp.m('fam'), 'Sofía', 'child', '#EA580C', '🦄', 3) returning id)
insert into s select 'sofia', id from x;

select public.create_event(pg_temp.m('fam'), gen_random_uuid(), 'Salida al colegio', pg_temp.cat('colegio'), false,
  pg_temp.at(0, '07:15'), pg_temp.at(0, '07:45'), null, null, null, 'Revisar loncheras', 'family', 'normal', false,
  array[pg_temp.m('mateo'), pg_temp.m('sofia')]);
select public.create_event(pg_temp.m('fam'), gen_random_uuid(), 'Llega el técnico de internet', pg_temp.cat('hogar'), false,
  pg_temp.at(0, '16:00'), null, null, null, null, null, 'family', 'normal', false, array[pg_temp.m('mama')]);
select public.create_event(pg_temp.m('fam'), gen_random_uuid(), 'Reunión de padres (virtual)', pg_temp.cat('colegio'), false,
  pg_temp.at(0, '19:30'), pg_temp.at(0, '20:30'), null, null, null, null, 'adults', 'normal', false,
  array[pg_temp.m('mama'), pg_temp.m('papa')], 'Preguntar por el viaje de estudios');
select public.create_event(pg_temp.m('fam'), gen_random_uuid(), 'Dentista de Mateo', pg_temp.cat('salud'), false,
  pg_temp.at(1, '15:00'), pg_temp.at(1, '16:00'), null, null, 'Consultorio Sonrisas', null, 'participants', 'high', false,
  array[pg_temp.m('mateo'), pg_temp.m('mama')], 'Llevar el carné del seguro');
select public.create_event(pg_temp.m('fam'), gen_random_uuid(), 'Visita de la tía Carmen', pg_temp.cat('visita'), false,
  pg_temp.at(2, '17:00'), pg_temp.at(2, '19:00'), null, null, 'Casa', 'Ordenar la sala y los cuartos antes de las 4:00 PM',
  'family', 'high', true, '{}');
select public.create_event(pg_temp.m('fam'), gen_random_uuid(), 'Examen de Matemáticas', pg_temp.cat('colegio'), false,
  pg_temp.at(3, '08:00'), pg_temp.at(3, '10:00'), null, null, null, 'Llevar uniforme de deporte',
  'family', 'high', false, array[pg_temp.m('mateo'), pg_temp.m('sofia')]);
select public.create_event(pg_temp.m('fam'), gen_random_uuid(), 'Vence el recibo de luz', pg_temp.cat('pagos'), true,
  null, null, pg_temp.d(4), pg_temp.d(5), null, null, 'adults', 'normal', false, array[pg_temp.m('papa')]);
select public.create_event(pg_temp.m('fam'), gen_random_uuid(), 'Campamento de Sofía', pg_temp.cat('otro'), true,
  null, null, pg_temp.d(5), pg_temp.d(7), 'Lurín', 'Bolsa de dormir y linterna', 'family', 'normal', false,
  array[pg_temp.m('sofia')]);
select public.create_event(pg_temp.m('fam'), gen_random_uuid(), 'Presentación de trabajo', pg_temp.cat('trabajo'), false,
  pg_temp.at(6, '10:00'), pg_temp.at(6, '11:30'), null, null, null, null, 'adults', 'normal', false,
  array[pg_temp.m('papa')]);

select public.create_household_task(pg_temp.m('fam'), gen_random_uuid(), 'Descongelar el pollo', null,
  pg_temp.m('mama'), pg_temp.d(0), '10:00', 'normal', 'family');
select public.create_household_task(pg_temp.m('fam'), gen_random_uuid(), 'Comprar gas', null,
  null, pg_temp.d(0), null, 'high', 'family');
select public.create_household_task(pg_temp.m('fam'), gen_random_uuid(), 'Llamar al pediatra', 'Pedir cita de control',
  pg_temp.m('mama'), null, null, 'normal', 'adults');
select public.create_household_task(pg_temp.m('fam'), gen_random_uuid(), 'Pagar el internet', null,
  pg_temp.m('papa'), pg_temp.d(-1), null, 'high', 'adults');
select public.set_household_task_status(
  (public.create_household_task(pg_temp.m('fam'), gen_random_uuid(), 'Regar las plantas', null,
    null, pg_temp.d(0), null, 'low', 'family')).id, 'done', gen_random_uuid());

-- Serie semanal (martes y jueves) solo visible para participantes
select public.create_event_series(pg_temp.m('fam'), gen_random_uuid(), 'Natación de Mateo', pg_temp.cat('otro'), false,
  '16:00', 60, 'Club', 'Llevar gorro y lentes', 'participants', 'normal', false, array[pg_temp.m('mateo')],
  'weekly', 1, '{2,4}', null, 'skip', pg_temp.d(0), null);

-- Responsabilidades y hábitos
insert into s select 'tplCama', public.save_task_template(pg_temp.m('fam'), null, null, gen_random_uuid(), 'chore',
  'Tender la cama', null, 10, true, null, array[pg_temp.m('mateo'), pg_temp.m('sofia')], 'daily', 1, null, null,
  'skip', pg_temp.d(0), null);
insert into s select 'tplMochila', public.save_task_template(pg_temp.m('fam'), null, null, gen_random_uuid(), 'chore',
  'Preparar la mochila', 'Revisar horario y tareas', 10, true, '20:00', array[pg_temp.m('mateo'), pg_temp.m('sofia')],
  'weekdays', 1, null, null, 'skip', pg_temp.d(0), null);
insert into s select 'tplDientes', public.save_task_template(pg_temp.m('fam'), null, null, gen_random_uuid(), 'habit',
  'Cepillarse los dientes', null, 5, false, '21:00', array[pg_temp.m('mateo'), pg_temp.m('sofia')], 'daily', 1, null,
  null, 'skip', pg_temp.d(0), null);
insert into s select 'tplUniforme', public.save_task_template(pg_temp.m('fam'), null, null, gen_random_uuid(), 'chore',
  'Alistar el uniforme de deporte', 'Para el examen de Matemáticas', 15, true, '21:00',
  array[pg_temp.m('mateo'), pg_temp.m('sofia')], 'once', 1, null, null, 'skip', pg_temp.d(2), null);

-- Mateo: cama aprobada (a tiempo); cuarto entregado (en revisión)
select public.submit_task((select id from public.task_occurrences where template_id = pg_temp.m('tplCama')
  and assignee_member_id = pg_temp.m('mateo') and due_date = pg_temp.d(0)), gen_random_uuid());
select public.review_task(o.id, o.version, gen_random_uuid(), 'approve', '¡Muy bien!')
  from public.task_occurrences o where o.template_id = pg_temp.m('tplCama')
  and o.assignee_member_id = pg_temp.m('mateo') and o.due_date = pg_temp.d(0);
insert into s select 'tplCuarto', public.save_task_template(pg_temp.m('fam'), null, null, gen_random_uuid(), 'chore',
  'Ordenar el cuarto', null, 10, true, null, array[pg_temp.m('mateo'), pg_temp.m('sofia')], 'daily', 1, null, null,
  'skip', pg_temp.d(0), null);
select public.submit_task(o.id, gen_random_uuid()) from public.task_occurrences o
  where o.template_id = pg_temp.m('tplCuarto') and o.assignee_member_id = pg_temp.m('mateo')
  and o.due_date = pg_temp.d(0);
-- Sofía: hábito sin revisión cumplido
select public.submit_task(o.id, gen_random_uuid()) from public.task_occurrences o
  where o.template_id = pg_temp.m('tplDientes') and o.assignee_member_id = pg_temp.m('sofia')
  and o.due_date = pg_temp.d(0);

-- Premios y saldos
select public.save_reward(pg_temp.m('fam'), null, gen_random_uuid(), 'Elegir la película del viernes', null, 30, true,
  'Solo viernes', '{}');
insert into s select 'postre', public.save_reward(pg_temp.m('fam'), null, gen_random_uuid(), 'Escoger el postre', null,
  20, true, null, '{}');
select public.save_reward(pg_temp.m('fam'), null, gen_random_uuid(), '30 minutos de videojuego', null, 40, true,
  'Después de las tareas', '{}');
select public.adjust_points(pg_temp.m('fam'), pg_temp.m('mateo'), 25, 'Puntos de bienvenida', gen_random_uuid());
select public.adjust_points(pg_temp.m('fam'), pg_temp.m('sofia'), 15, 'Puntos de bienvenida', gen_random_uuid());
select public.request_redemption(pg_temp.m('postre'), pg_temp.m('mateo'), gen_random_uuid());
select pg_temp.logout();

-- Una tarea de ayer sin entregar (vencida) para Sofía. Ayer no lo genera el
-- materializador (nunca crea fechas pasadas), así que se inserta como dato demo.
insert into public.task_occurrences (family_id, kind, template_id, title, assignee_member_id, due_date, timezone,
                                     points, requires_review, visibility, status)
values (pg_temp.m('fam'), 'chore', pg_temp.m('tplCama'), 'Tender la cama', pg_temp.m('sofia'), pg_temp.d(-1),
        'America/Lima', 10, true, 'family', 'pending');

-- Papá con su propia cuenta (administrador)
insert into public.adult_memberships (family_id, user_id, member_id, role)
values (pg_temp.m('fam'), ${q(papa.id)}, pg_temp.m('papa'), 'admin');

-- ===== Familia Pérez (otra familia, para comprobar aislamiento) =====
delete from s;
select pg_temp.login_as(${q(rosa.id)}, ${q(rosa.email)});
insert into s values ('fam', public.create_family(gen_random_uuid(), 'Familia Pérez', 'America/Lima', 'Rosa', '#DB2777'));
select public.create_event(pg_temp.m('fam'), gen_random_uuid(), 'Cumpleaños del abuelo (Pérez)', pg_temp.cat('visita'), false,
  pg_temp.at(1, '18:00'), pg_temp.at(1, '21:00'), null, null, null, null, 'family', 'high', true, '{}');
select public.create_household_task(pg_temp.m('fam'), gen_random_uuid(), 'Comprar torta (Pérez)', null,
  null, pg_temp.d(1), null, 'normal', 'family');
select pg_temp.logout();

select json_build_object(
  'families', (select json_agg(name order by name) from public.families
               where created_by in (${ACCOUNTS.map((a) => q(a.id)).join(", ")})),
  'events', (select count(*) from public.calendar_events e join public.families f on f.id = e.family_id
             where f.created_by in (${ACCOUNTS.map((a) => q(a.id)).join(", ")})),
  'tasks', (select count(*) from public.task_occurrences t join public.families f on f.id = t.family_id
            where f.created_by in (${ACCOUNTS.map((a) => q(a.id)).join(", ")}))
) as seeded;
commit;
`;

const work = mkdtempSync(path.join(tmpdir(), "cofi-seed-"));
const file = path.join(work, "seed.sql");
writeFileSync(file, sql, { mode: 0o600 });
const run = spawnSync(path.join(root, "node_modules/.bin/supabase"), ["db", "query", "--linked", "-f", file], {
  cwd: root,
  encoding: "utf8",
  maxBuffer: 16 * 1024 * 1024,
});
rmSync(work, { recursive: true, force: true });

const redact = (s) => ACCOUNTS.reduce((acc, a) => acc.split(a.password).join("[oculto]"), s ?? "");
const out = redact(run.stdout);
const start = out.indexOf("{");
try {
  const parsed = JSON.parse(out.slice(start));
  if (parsed._tag === "Error") throw new Error(parsed.error?.message ?? "error");
  console.log("Demostración lista:", JSON.stringify(parsed.rows?.[0]?.seeded));
  console.log(`Cuentas: ${ACCOUNTS.map((a) => a.email).join(", ")} (contraseñas en .env.test.local)`);
} catch (error) {
  console.error("No se pudo sembrar:", redact(error.message), redact(run.stderr).slice(0, 2000));
  process.exit(1);
}
