#!/usr/bin/env node
/**
 * Configura Supabase Auth del proyecto enlazado: SMTP propio (Hostinger) y
 * correos con código OTP de 8 dígitos para confirmar la cuenta, recuperar la
 * contraseña y cambiar el correo. Lee los secretos de .env.local sin imprimirlos.
 *
 *   node scripts/configure-auth.mjs --check   # valida variables, sin tocar nada
 *   node scripts/configure-auth.mjs --diff    # muestra qué cambiaría
 *   node scripts/configure-auth.mjs --apply   # aplica (solo ajustes de Auth)
 *   node scripts/configure-auth.mjs --verify  # comprueba que no quedan diferencias
 *
 * Genera un config.toml temporal que solo declara Auth: no toca base de datos,
 * API ni Storage, y nunca escribe la contraseña SMTP en el repositorio.
 * Si SMTP_PASSWORD está vacía, no se declara la sección SMTP: se conserva la
 * configuración SMTP del proyecto (por ejemplo, la guardada desde el panel).
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import nextEnv from "@next/env";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
nextEnv.loadEnvConfig(root, true, { info() {}, error() {} });

const mode = process.argv[2] ?? "--diff";
if (!["--check", "--diff", "--apply", "--verify"].includes(mode)) {
  console.error("Usa --check, --diff, --apply o --verify.");
  process.exit(1);
}

const required = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "AUTH_PROJECT_REF",
  "AUTH_SITE_URL",
  "AUTH_REDIRECT_URLS",
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USER",
  "AUTH_EMAIL_FROM",
  "AUTH_EMAIL_SENDER_NAME",
];
const missing = required.filter((name) => !process.env[name]?.trim());
if (missing.length) {
  console.error(`Completa en .env.local: ${missing.join(", ")}`);
  process.exit(1);
}

// El proyecto destino debe coincidir en tres lugares: la URL pública, el
// enlace de la CLI y la variable explícita AUTH_PROJECT_REF.
const ref = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
const linked = readFileSync(path.join(root, "supabase/.temp/project-ref"), "utf8").trim();
if (ref !== process.env.AUTH_PROJECT_REF.trim() || linked !== ref) {
  console.error("El proyecto enlazado, la URL y AUTH_PROJECT_REF no coinciden. No se aplica nada.");
  process.exit(1);
}

const port = Number(process.env.SMTP_PORT);
if (![465, 587].includes(port)) {
  console.error("SMTP_PORT debe ser 465 (SSL) o 587 (STARTTLS).");
  process.exit(1);
}
const redirects = process.env.AUTH_REDIRECT_URLS.split(",").map((v) => v.trim()).filter(Boolean);
for (const value of [process.env.AUTH_SITE_URL, ...redirects]) {
  const url = new URL(value.replace("/**", "/"));
  const local = ["localhost", "127.0.0.1"].includes(url.hostname);
  if (url.protocol !== "https:" && !(local && url.protocol === "http:")) {
    console.error("Las URLs deben usar HTTPS; HTTP solo se permite en desarrollo local.");
    process.exit(1);
  }
}

const smtpPassword = process.env.SMTP_PASSWORD?.trim() ?? "";
const keepRemotePassword = smtpPassword === "";

if (mode === "--check") {
  console.log(`Configuración lista para ${ref}: SMTP ${process.env.SMTP_HOST}:${port} como ${process.env.AUTH_EMAIL_FROM}.`);
  if (keepRemotePassword) console.log("SMTP_PASSWORD vacía: se conservará la contraseña guardada en el proyecto.");
  process.exit(0);
}

const OTP_LENGTH = 8;
const OTP_EXPIRY_SECONDS = 600;

/** Textos de cada correo. Todos muestran solo el código: no hay enlaces que abrir. */
const EMAILS = {
  confirmation: {
    subject: "Tu código para activar Centro Familiar",
    title: "Confirma tu correo",
    body: "Escribe este código en Centro Familiar para activar tu cuenta.",
  },
  recovery: {
    subject: "Tu código para crear una nueva contraseña",
    title: "Recupera tu acceso",
    body: "Escribe este código en Centro Familiar para crear una nueva contraseña.",
  },
  email_change: {
    subject: "Tu código para confirmar el nuevo correo",
    title: "Confirma tu nuevo correo",
    body: "Escribe este código en Centro Familiar para confirmar el cambio de correo.",
  },
  reauthentication: {
    subject: "Tu código de verificación",
    title: "Confirma que eres tú",
    body: "Escribe este código para confirmar una operación sensible en tu cuenta.",
  },
  magic_link: {
    subject: "Tu código para entrar a Centro Familiar",
    title: "Tu código de acceso",
    body: "Escribe este código en Centro Familiar para iniciar sesión.",
  },
};

const escape = (value) =>
  value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

function template({ title, body }) {
  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escape(title)}</title>
  </head>
  <body style="margin:0;background:#faf8f3;color:#2a2520;font-family:Arial,Helvetica,sans-serif;padding:32px 16px">
    <div style="max-width:480px;margin:0 auto;background:#ffffff;border:1px solid #e7e2d8;border-radius:20px;padding:28px">
      <p style="margin:0 0 16px;font-size:15px;font-weight:bold;color:#6b5f52">🏠 Centro Familiar</p>
      <h1 style="margin:0 0 12px;font-size:24px">${escape(title)}</h1>
      <p style="margin:0 0 20px;font-size:16px;line-height:1.5">${escape(body)}</p>
      <p style="margin:0 0 20px;padding:18px 0;text-align:center;font-family:'Courier New',monospace;font-size:36px;font-weight:bold;letter-spacing:8px;background:#fdf3c4;border-radius:14px">{{ .Token }}</p>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.5">El código vence en 10 minutos.</p>
      <p style="margin:0;font-size:14px;line-height:1.5;color:#6b5f52">Si no lo pediste, ignora este correo. Nadie de Centro Familiar te pedirá este código por teléfono ni por mensaje.</p>
    </div>
  </body>
</html>
`;
}

const temporary = mkdtempSync(path.join(tmpdir(), "cofi-auth-config-"));
const cliEnv = { ...process.env };
// Un SUPABASE_ACCESS_TOKEN vacío no debe ocultar la sesión de `supabase login`.
if (!cliEnv.SUPABASE_ACCESS_TOKEN?.trim()) delete cliEnv.SUPABASE_ACCESS_TOKEN;
const secrets = [smtpPassword, cliEnv.SUPABASE_ACCESS_TOKEN].filter(Boolean);

function redact(value) {
  let result = value;
  for (const secret of secrets) {
    result = result.split(secret).join("[oculto]");
    result = result.split(JSON.stringify(secret).slice(1, -1)).join("[oculto]");
  }
  return result;
}

try {
  mkdirSync(path.join(temporary, "supabase"));
  const config = [
    'project_id = "cofi-auth"',
    "[auth]",
    "enabled = true",
    `site_url = ${JSON.stringify(process.env.AUTH_SITE_URL)}`,
    `additional_redirect_urls = ${JSON.stringify(redirects)}`,
    "minimum_password_length = 8",
    // Pantallas vinculadas: sesión anónima aprobada por un adulto (límite por IP de Supabase).
    "enable_anonymous_sign_ins = true",
    'password_requirements = "letters_digits"',
    "[auth.email]",
    "enable_signup = true",
    "enable_confirmations = true",
    "secure_password_change = true",
    'max_frequency = "1m0s"',
    `otp_length = ${OTP_LENGTH}`,
    `otp_expiry = ${OTP_EXPIRY_SECONDS}`,
    // Sin contraseña local no se declara la sección SMTP: se conserva la del proyecto.
    ...(keepRemotePassword
      ? []
      : [
          "[auth.email.smtp]",
          "enabled = true",
          'host = "env(SMTP_HOST)"',
          `port = ${port}`,
          'user = "env(SMTP_USER)"',
          'pass = "env(SMTP_PASSWORD)"',
          'admin_email = "env(AUTH_EMAIL_FROM)"',
          'sender_name = "env(AUTH_EMAIL_SENDER_NAME)"',
        ]),
  ];
  for (const [name, copy] of Object.entries(EMAILS)) {
    writeFileSync(path.join(temporary, `${name}.html`), template(copy));
    config.push(
      `[auth.email.template.${name}]`,
      `subject = ${JSON.stringify(copy.subject)}`,
      `content_path = "./${name}.html"`,
    );
  }
  writeFileSync(path.join(temporary, "supabase/config.toml"), `${config.join("\n")}\n`);

  const bin = path.join(root, "node_modules/.bin/supabase");
  const base = ["--project-ref", ref, "--workdir", temporary, "--output-format", "json"];
  const run = (args, print = true) => {
    const result = spawnSync(bin, args, { cwd: root, env: cliEnv, encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });
    if (print && result.stdout) console.log(redact(result.stdout).trim());
    if (print && result.stderr) console.error(redact(result.stderr).trim());
    if (result.error || result.status !== 0) {
      if (!print) console.error(redact(`${result.stdout ?? ""}\n${result.stderr ?? ""}`).trim());
      throw new Error("La CLI no pudo completar la operación.");
    }
    return result.stdout;
  };
  const declaredChanges = (stdout) => {
    const diff = JSON.parse(stdout.slice(stdout.indexOf("{")));
    if (!Array.isArray(diff.changes) || diff.target?.project_ref !== ref) {
      throw new Error("La CLI devolvió una comparación inesperada.");
    }
    return diff.changes.filter((change) => change.declared === true);
  };

  if (mode === "--apply") {
    const changes = declaredChanges(run(["config", "diff", ...base], false));
    if (changes.some((change) => change.path[0] !== "auth")) throw new Error("Se rechazó un cambio fuera de Auth.");
    console.log(`Aplicando ${changes.length} ajustes de Auth en ${ref}…`);
    run(["config", "push", ...base, "--yes"]);
  } else if (mode === "--verify") {
    const changes = declaredChanges(run(["config", "diff", ...base], false));
    if (changes.length) throw new Error(`Quedan ${changes.length} ajustes por sincronizar.`);
    console.log("Auth verificado. La API oculta la contraseña SMTP: el envío real se prueba aparte.");
  } else {
    const changes = declaredChanges(run(["config", "diff", ...base], false));
    for (const c of changes) {
      const show = (v) => (c.path.includes("pass") ? "[oculto]" : JSON.stringify(v)?.slice(0, 120));
      console.log(`${c.path.join(".")}: ${show(c.remote)} → ${show(c.local)}`);
    }
    console.log(`${changes.length} ajustes de Auth cambiarían.`);
  }
} catch (issue) {
  console.error(redact(issue.message));
  process.exitCode = 1;
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
