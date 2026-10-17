#!/usr/bin/env node
/**
 * Ejecuta las pruebas pgTAP de supabase/tests/database contra el proyecto
 * Supabase ENLAZADO (desarrollo), cada archivo dentro de BEGIN … ROLLBACK:
 * no deja datos ni cambios.
 *
 * Uso:
 *   node scripts/db-test-remote.mjs                 # pruebas sobre el esquema remoto actual
 *   node scripts/db-test-remote.mjs --with <migr.sql> [--with <otra.sql>]
 *        # ensayo: aplica esas migraciones dentro de la misma transacción antes de probar
 *
 * Requiere `npx supabase login` y `npx supabase link --project-ref <ref>`.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const testsDir = join(root, "supabase/tests/database");
const args = process.argv.slice(2);
const withFiles = [];
const only = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--with") withFiles.push(resolve(args[++i]));
  else only.push(args[i]);
}

const ref = readFileSync(join(root, "supabase/.temp/project-ref"), "utf8").trim();
console.log(`Proyecto enlazado: ${ref}`);
if (withFiles.length) console.log(`Ensayo con migraciones: ${withFiles.map((f) => f.split("/").pop()).join(", ")}`);

const prelude = withFiles.map((f) => readFileSync(f, "utf8")).join("\n;\n");
const files = readdirSync(testsDir)
  .filter((f) => f.endsWith(".test.sql"))
  .filter((f) => only.length === 0 || only.some((o) => f.includes(o)))
  .sort();

const work = mkdtempSync(join(tmpdir(), "cofi-dbtest-"));
let failed = 0;
let total = 0;

for (const file of files) {
  let body = readFileSync(join(testsDir, file), "utf8");
  body = body.replace(/^\s*begin\s*;/im, "");
  body = body.replace(/select\s+\*\s+from\s+finish\(\)\s*;\s*rollback\s*;\s*$/i, "");
  // pgTAP devuelve cada resultado como una fila; la consulta remota solo
  // conserva el último conjunto, así que cada aserción se registra en una tabla.
  body = body.replace(
    /^select\s+(results_eq|is|isnt|throws_ok|lives_ok|ok|has_table|policies_are)\(/gim,
    "insert into pg_temp.__cofi_tap (line) select $1(",
  );
  const sql = `begin;\n${prelude}\n;
create temp table __cofi_tap (n serial primary key, line text);
grant insert, select on pg_temp.__cofi_tap to public;
grant usage on sequence pg_temp.__cofi_tap_n_seq to public;
${body}\n;
select pg_catalog.set_config('role', 'postgres', true);
select json_build_object(
  'planned', (select value from __tcache__ where label = 'plan' limit 1),
  'lines', (select coalesce(json_agg(line order by n), '[]'::json) from pg_temp.__cofi_tap)
) as tap;
rollback;\n`;
  const path = join(work, file);
  writeFileSync(path, sql);
  const run = spawnSync("npx", ["supabase", "db", "query", "--linked", "-f", path], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  const out = `${run.stdout ?? ""}`;
  const start = out.indexOf("{");
  let parsed;
  try {
    parsed = JSON.parse(out.slice(start));
  } catch {
    console.error(`\n✗ ${file}: no se pudo leer la salida\n${out}\n${run.stderr ?? ""}`);
    failed++;
    continue;
  }
  if (parsed._tag === "Error" || !parsed.rows) {
    console.error(`\n✗ ${file}: error de ejecución\n${JSON.stringify(parsed.error ?? parsed, null, 2)}`);
    failed++;
    continue;
  }
  const tap = parsed.rows[0].tap;
  const results = (tap.lines ?? []).map((line) => ({ ok: !line.startsWith("not ok"), line }));
  const planned = Number(tap.planned ?? results.length);
  const bad = results.filter((r) => !r.ok);
  total += results.length;
  console.log(`\n${bad.length === 0 && results.length === planned ? "✓" : "✗"} ${file}: ${results.length - bad.length}/${planned} correctas`);
  for (const r of results) console.log(`  ${r.line.replace(/\n/g, "\n      ")}`);
  if (results.length !== planned) {
    console.log(`  ! se planearon ${planned} y se ejecutaron ${results.length}`);
    failed++;
  }
  failed += bad.length;
}

rmSync(work, { recursive: true, force: true });
console.log(`\n${failed === 0 ? "Todas las pruebas pasaron" : `${failed} problema(s)`} (${total} aserciones).`);
process.exit(failed === 0 ? 0 : 1);
