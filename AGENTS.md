# AGENTS.md — memoria persistente de COFI (Centro Familiar)

Memoria compartida entre sesiones y entre agentes (Cursor, Claude Code y Codex; `CLAUDE.md` importa este archivo). Lo que no quede escrito aquí o en `docs/` se pierde al cerrar la sesión.

- Si el código contradice algo de aquí, manda el código, y este archivo se corrige en el mismo cambio.
- Aquí va lo necesario para retomar el trabajo. El detalle con evidencia (resultados de pruebas, identificadores de build, hashes) va en `docs/`.

## Fuentes

| Tema | Archivo |
| --- | --- |
| Especificación del producto (qué construir) | `docs/Prompt_Centro_Organizacion_Familiar.md` |
| Estado por hitos con evidencia | `docs/roadmap.md` |
| Arquitectura, modelo de datos y seguridad | `docs/arquitectura.md`, `docs/modelo-datos.md`, `docs/seguridad.md` |
| Sistema visual (tokens, primitivas y reglas «que no parezca IA») | `docs/diseno.md` |
| Despliegue, entornos, Auth y Hostinger | `docs/despliegue.md` |
| PWA, copia sin conexión y Wake Lock | `docs/pwa.md` |
| Vinculación de pantallas | `docs/pantallas.md` |
| Evidencia de verificaciones públicas | `docs/verificacion-hostinger.json`, `docs/verificacion-vinculacion.json`, `docs/verificacion-mundos.json`, `docs/verificacion-agenda.json`, `docs/verificacion-rediseno.json`, `docs/capturas/` |

## Protocolo de sesión

Los agentes trabajan **por turnos**, uno después de otro, no en paralelo. El que entra solo sabe lo que dejó escrito el anterior.

### Al comenzar

1. Lee este archivo completo, después `docs/roadmap.md` y `git status --short`. No sobrescribas cambios ajenos.
2. Comprueba que las migraciones estén sincronizadas: `npx supabase migration list --linked < /dev/null`.
3. Retoma desde **Siguiente paso**, salvo que el usuario pida otra cosa.
4. Para Next.js, lee la guía relevante en `node_modules/next/dist/docs/`: es la versión 16, con `proxy.ts`, Cache Components y Partial Prefetching.
5. Para Supabase, usa los skills de `.claude/skills/` (`supabase` y `supabase-postgres-best-practices`) y el MCP de `.mcp.json`.

### Al terminar (obligatorio si cambiaste algo)

1. Reescribe **Estado actual** y **Siguiente paso** para que reflejen el estado real. No acumules historia ahí: la historia va al registro.
2. Si el usuario tomó una decisión, añádela a **Decisiones**, con fecha.
3. Si descubriste una trampa, añádela a **Trampas conocidas**.
4. Añade una entrada al principio del **Registro de sesiones**: qué se hizo, qué se verificó y qué quedó a medias. Entre una y tres líneas.
5. Si cerraste un entregable o publicaste, actualiza `docs/roadmap.md` (y `docs/despliegue.md` si aplica) con la evidencia.

Escribe hechos comprobados. Distingue entre «verificado», «implementado sin verificar» y «pendiente». Nunca copies aquí secretos, contraseñas, tokens ni claves.

## El proyecto en breve

Aplicación web familiar (PWA) para pantallas de cocina, cuartos y celulares: agenda compartida con reloj contextual, pendientes del hogar, tareas y hábitos de los hijos con puntos y premios, pantallas vinculadas sin credenciales de adulto, avisos programados y sincronización en tiempo real. Todo en español (`es-PE`, `America/Lima` configurable). La IA de texto y voz (hitos D y E) llega después de cerrar el núcleo manual. El usuario quiere **monetizar** la idea.

Stack: Next.js 16.4 (App Router, Cache Components) + React 19 + TypeScript + Tailwind 4 + shadcn/ui, Supabase (Postgres, Auth, Realtime, Cron), Zod, React Hook Form y `temporal-polyfill`. Pruebas: Vitest, pgTAP y Playwright.

## Entornos

| Entorno | Dónde | Notas |
| --- | --- | --- |
| Local | `npm run dev` → `http://localhost:3000` | Usa el Supabase de desarrollo en la nube. Sin Docker |
| Supabase | Proyecto `gnnajgdfhbbziucqnewj` («COFI», us-east-2) | Enlazado con `npx supabase link`; la CLI ya tiene sesión. **Es el único proyecto: desarrollo y la web publicada comparten base de datos** |
| Publicado | [Hostinger Web Apps](https://mediumturquoise-elephant-247172.hostingersite.com) | Dentro del plan Business existente; destino en `.hostinger/site.json`. Procedimiento en `docs/despliegue.md` |
| Correo de Auth | SMTP de Hostinger, `cofi@afcrtecnologia.com` | Códigos OTP de 8 dígitos |

Variables: `.env.local` (desarrollo) y `.env.production` (Hostinger, permisos `0600`) están ignorados por Git y excluidos de los ZIP de publicación. La plantilla sin valores es `.env.example`.

## Mapa del código

| Ruta | Contenido |
| --- | --- |
| `src/app/(auth)`, `src/app/auth` | Registro, acceso y recuperación con OTP |
| `src/app/(app)/` | Zona autenticada: `casa`, `agenda`, `pendientes`, `responsabilidades`, `hijos/[memberId]`, `premios`, `avisos`, `configuracion` (incluye `reglas` y `dispositivos`) |
| `src/app/pantalla`, `src/app/vincular` | Pantalla vinculada y flujo de vinculación |
| `src/features/<módulo>/` | Lógica por módulo: `actions.ts` (Server Actions), `queries.ts`, `schemas.ts` (Zod), `use-cases.ts` y `components/`. Módulos: `auth`, `automations`, `calendar`, `children`, `devices`, `families`, `notifications`, `rewards` y `tasks` |
| `src/lib/` | Clientes Supabase y tipos generados (`supabase/database.types.ts`), sesión (`auth/`), fechas (`time/zoned.ts`), PWA (`pwa/`), errores y validación |
| `src/components/pwa/`, `public/sw.js`, `src/app/manifest.ts` | PWA: registro, Wake Lock, copia sin conexión y service worker solo de archivos públicos |
| `src/proxy.ts` | Refresco de sesión (sustituye a `middleware.ts` en Next 16) |
| `supabase/migrations/`, `supabase/tests/database/` | Esquema (8 migraciones) y pruebas pgTAP (01–07) |
| `tests/unit/`, `tests/e2e/` | Vitest y Playwright (01–09) |
| `scripts/` | `build.mjs` (selecciona Turbopack o Webpack para Hostinger), `seed-dev.mjs`, `db-test-remote.mjs` y `configure-auth.mjs` |

## Comandos

| Para | Comando |
| --- | --- |
| Desarrollo | `npm run dev` |
| Tipos y lint | `npm run typecheck`, `npm run lint` |
| Unitarias | `npm test` |
| pgTAP contra el proyecto remoto | `npm run db:test` |
| E2E sin borrar datos | `npx playwright test <archivos>` |
| E2E completa (**borra y recrea la demostración: pide permiso**) | `npm run e2e` |
| E2E contra build de producción | `npm run build`, después `E2E_PORT=3001 E2E_PRODUCTION=1 npx playwright test <archivos>` |
| Build local / build para Hostinger | `npm run build` / `npm run build:hostinger` |
| Asesores de Supabase / tipos generados | `npm run db:advisors` / `npm run types:gen` |
| Configurar Auth y SMTP | `npm run auth:configure -- --diff \| --apply \| --verify` |

## Estado actual

_Última actualización: 18 oct 2026, 08:25._

- **Hito A** (base, agenda y casa): ✅ verificado.
- **Hito B** (tareas, puntos, pantallas y Realtime): ✅ verificado. La vinculación se simplificó: ahora se configura desde la cuenta adulta en el propio equipo, con el código como alternativa. Publicado y verificado.
- **Hito C** (avisos, automatizaciones y PWA): 🔶 casi completo.
  - ✅ Verificado: avisos persistentes con `pg_cron`, reprogramación y cancelación, reglas de visita y colegio, avisos en pantallas y en `/avisos`, horas de silencio y noche automática, tablas de entregas Push, PWA (manifest, service worker, actualización, Wake Lock simulado) y copia sin conexión de 24 h.
  - ⏳ Pendiente: emisor Web Push real (VAPID, Edge Function `send-push`, secretos en Vault), recordatorios en series de eventos (la columna existe; falta la interfaz) y validación en equipos Android/iOS reales.
- **Mundos y seguimiento por hijo:** ✅ verificado y publicado.
  - Un indicador de quién usa cada pantalla («Mamá · Padres», «Mateo · Hijos», «Cocina · Casa»).
  - Una barra lateral de hijos en Tareas y Premios, con vista centrada en el hijo elegido (`?hijo=`, `&dias=30`).
  - Ver `docs/arquitectura.md`.
- **Agenda visual y «Pendientes de hoy»:** ✅ verificado y publicado.
  - Calendario del mes a la izquierda; día por horas a la derecha (`?dia=`).
  - Tocar una hora abre una ventana rápida para agendar.
  - La pestaña Pendientes pasa a «Pendientes de hoy», con «Más adelante» plegado.
  - Ver `docs/arquitectura.md`.
- **Rediseño visual:** ✅ verificado y publicado.
  - Claro estilo ACRU y oscuro estilo Stakent, con tema Claro / Oscuro / Sistema.
  - Primitivas `Panel`, `Stat` y `Meter`.
  - Abarca toda la app. Ver `docs/diseno.md`.
- **Hitos D y E** (IA de texto y voz): ⏳ no empezar hasta cerrar el Hito C.
- **Publicado** en Hostinger con el rediseño (build `01a14f28…`, 18 oct, 08:18 Lima). Doce comprobaciones públicas de solo lectura correctas (`docs/verificacion-rediseno.json`).
- **Última verificación completa (18 oct):** E2E **41/41** de la suite completa, con la demostración reiniciada con permiso; Vitest 52/52; pgTAP 180/180 (17 oct; el esquema no cambió desde entonces); contraste AA; tipos, lint, build y build compatible correctos. Las 8 migraciones están sincronizadas. Detalle en `docs/roadmap.md`.
- **Git:** rama `main` con un solo commit (`1c307d5 primer commit`, 17 oct) y sin remoto. Incluye los mundos; la agenda visual, «Pendientes de hoy» y el rediseño están **sin confirmar**.

## Siguiente paso

1. Recordatorios en series de eventos: interfaz en el formulario de series, reutilizando la columna existente.
2. Emisor Web Push: revalidar destinatarios, revocaciones y vigencia antes de enviar, y resolver el cierre de sesión y el cambio de familia. Después configurar VAPID, autenticación y Vault. Consultar costos y pedir permiso si algo puede cobrarse.
3. Validar en equipos reales instalación, suspensión, noche, Wake Lock y entrega Push. Entonces cerrar el Hito C en `docs/roadmap.md`.
4. Proponer al usuario el primer commit. Si se sube a GitHub, el repositorio debe ser **privado** (ver Decisiones).

## Decisiones

### Reglas permanentes del usuario

- **Pedir aprobación explícita** antes de gastar dinero o borrar datos o archivos, explicando costo o alcance. Incluye la E2E completa (borra la demostración) y `removeArchive` al publicar.
- No crear proyectos ni recursos de pago sin autorización. Nunca sembrar datos de prueba fuera de desarrollo (`DEV_SEED_PROJECT_REF` lo impide).
- Commits solo cuando el usuario lo pida.
- En Cloudflare usar `cf`, salvo que el proyecto tenga configuración de Wrangler.
- Gestor de paquetes: **npm**, con `package-lock.json`.

### Historial (17 oct 2026)

- Next.js App Router + TypeScript + Supabase, según la especificación.
- El CLI de Supabase va como dependencia de desarrollo (`npx supabase …`), no instalado globalmente.
- **Sin Docker.** Todo va directo al proyecto Supabase en la nube. Docker está instalado, pero el servicio está detenido y el usuario no pertenece al grupo `docker`; no lo uses salvo que el usuario lo pida.
- Autenticación con **código OTP de 8 dígitos** (sin enlaces) por el SMTP de Hostinger. El SMTP se guardó desde el panel de Supabase; `npm run auth:configure` conserva esa contraseña si `SMTP_PASSWORD` está vacía.
- Los agentes (Claude, Codex y Cursor) trabajan **por turnos**, no en paralelo.
- **Hostinger Web Apps** reemplaza a Vercel como destino. El usuario autorizó el MCP por OAuth y un sitio nuevo con dominio temporal dentro del Business activo, sin suscripciones nuevas. `.env.production` lo completó el usuario (Supabase), con permiso para deducir e importar el resto. Apunta al **mismo** proyecto Supabase: separar la base de producción está pendiente de autorización.
- Autorización **puntual** para borrar y recrear las familias de demostración de desarrollo y ejecutar la E2E completa. No es permanente: pedirla de nuevo.
- Vinculación: la configuración desde la cuenta adulta en el propio equipo es la principal, con el código como alternativa. Al activar se cierra la sesión adulta del navegador, se limpia su copia local y se abandona la administración en otras pestañas; el vínculo conserva los permisos elegidos. Este formulario no reemplaza vínculos existentes.
- Mundos y barra lateral (pedido del usuario):
  - Mundos: indicador y acento de color, sin un tema completo por mundo.
  - Adulto: su nombre junto a «Padres».
  - Hijo elegido: la vista se centra en él.
  - Historial: 7 días, con «Ver 30 días».
  - El usuario pidió publicarlo en Hostinger.
- Agenda (pedido del usuario):
  - Para qué sirve: apuntar lo importante para no olvidarlo, de forma visual.
  - Diseño: mes a la izquierda y día por horas a la derecha.
  - Agendar: tocar una hora y escribir. Lo esencial es la hora de inicio; la duración es opcional («No sé»).
  - Avisos: 1 h y 15 min antes, marcados por defecto (también en el formulario completo).
  - Vistas: Día y Lista; el mes grande se eliminó.
  - Contenido: solo lo agendado.
  - Pendientes: «Pendientes de hoy», enfocado en el día, con lo posterior plegado.
- Rediseño (18 oct 2026, pedido del usuario):
  - Objetivo: «que no parezca hecho por IA».
  - Tema claro como la referencia ACRU (lima, amarillo y naranja; botones negros). Tema oscuro como Stakent (lavanda).
  - Se mantiene el **menú superior**.
  - Tema: **Claro / Oscuro / Sistema**, siguiendo al sistema por defecto.
  - Alcance: toda la app.
- El usuario va a **monetizar** el producto. Si el código se sube a GitHub, en repositorio **privado** y sin licencia abierta (nada de MIT ni Apache). `.gitignore` ya excluye `.env*`, `.next`, `node_modules` y los artefactos de pruebas.

## Cómo trabajar la base de datos

- **Crear migraciones:** `npx supabase migration new <nombre> < /dev/null`. El `< /dev/null` es necesario porque, sin él, la CLI espera SQL por la entrada estándar y se queda colgada.
- **Ensayo antes de aplicar:** `node scripts/db-test-remote.mjs --with supabase/migrations/<archivo>.sql` aplica la migración y ejecuta todas las pruebas pgTAP dentro de una transacción que se revierte.
- **Aplicar:** `npx supabase db push --linked --yes < /dev/null`. Después `npm run db:test`, `npm run db:advisors` y `npm run types:gen`.
- Recuerda que la misma base sirve a la web publicada: una migración aplicada afecta también a Hostinger.
- Las pruebas pgTAP deben ser compatibles con `supabase test db`. El ejecutor remoto reescribe las aserciones para recoger su salida.
- La Data API ya no expone tablas nuevas automáticamente: cada tabla necesita **GRANT explícito**, RLS y políticas por operación.
- Lo privilegiado va en el esquema `private` (no expuesto), con `SECURITY DEFINER`, `search_path = ''` y comprobación de `auth.uid()`.
- Asesores con avisos conocidos y aceptados: sesiones anónimas (cubiertas por las políticas), protección de contraseñas filtradas (requiere plan de pago) e índices sin uso (informativo).

## Trampas conocidas

### Next.js y React

- Con Cache Components, cualquier lectura de sesión o de hora debe ir dentro de `<Suspense>`. El cliente de servidor de Supabase llama a `connection()` porque supabase-js usa la hora para validar el JWT.
- `usePathname()` también exige `<Suspense>` en rutas dinámicas.
- Después de autenticar, `router.replace()` seguido de `router.refresh()` podía dejar visible el acceso y oculta la ruta protegida precargada. El login, la verificación OTP y la salida de configuración usan `window.location.replace()` para cargar con las cookies actuales.
- Se observó «HMR hash mismatch» en un `next dev` heredado; reiniciarlo lo recuperó. Revisa las trazas antes de atribuir esos fallos a Auth.
- El `Button` de shadcn (Base UI) con `render={<Link/>}` conserva el rol `button`. Para navegar con semántica de enlace usa `<Link className={buttonVariants(...)}>`.
- Un `Dialog` (portal) abierto al navegar con `router.push` puede quedar montado sobre la página nueva, porque Next conserva oculta la anterior. Ciérralo antes de navegar.
- El lima del tema claro no llega a AA como texto sobre blanco: como texto usa `brand-strong`, y `brand` solo como relleno.
- En `globals.css`, una regla `body` nueva en un bloque `@layer base` aparte no llegó al CSS compilado. Añadirla a la regla `body` existente funcionó; comprueba el CSS servido si una regla no se aplica.
- `DropdownMenuRadioItem` (Base UI) no cierra el menú al elegir; usa `closeOnClick`.
- En Tailwind 4, una grilla sin `grid-cols-1` crea columnas implícitas que se ensanchan con el contenido y desbordan el celular. Ocurre también en grillas anidadas (p. ej., `2xl:grid-cols-2` dentro de otra).

### Fechas

- `Temporal.Instant.fromEpochMilliseconds` exige milisegundos **enteros** (por eso el desfase del reloj se redondea).
- No uses `Intl` para el texto visible de fechas: provoca diferencias de hidratación. Usa las funciones de `src/lib/time/zoned.ts`.

### Pantallas y dispositivos

- Una revocación puede ocurrir entre `get_device_status` y la lectura de la familia. Esa lectura usa `maybeSingle()` y, si RLS ya no devuelve fila, trata el dispositivo como revocado: no lanza `PGRST116` ni conserva su copia.
- Los botones de shadcn se agrandaron a unos 44 px de alto (en `src/components/ui/button.tsx`, `input.tsx` y `select.tsx`).

### Pruebas

- `npm run e2e` vuelve a sembrar **borrando las familias ficticias y sus datos**: necesita aprobación. Sin reiniciar datos, usa `npx playwright test <archivos>`. `04-devices-realtime` requiere el estado inicial de la semilla, y además aprueba «Ordenar el cuarto» de Mateo: las pruebas posteriores no deben dar por hecho lo que había en la semilla.
- `npm run e2e` reutiliza el `next dev` del puerto 3000 si ya está activo.
- Bucle de recargas en `next dev` («✓ Compiled» sin cambios y «[Fast Refresh] rebuilding» continuo). Causa: la caché en disco de Turbopack para desarrollo, al reiniciar el servidor, servía chunks viejos y Turbopack mandaba `restart` en cada conexión. Por eso `next.config.js` tiene `experimental.turbopackFileSystemCacheForDev: false`, que solo afecta a desarrollo. Verificado con tres reinicios y con un build seguido de un reinicio. Si vuelve, aparta `.next/dev` (muévelo) y reinicia.
- La grilla del día se desplaza sola a la hora relevante una vez por día y antes de pintar (`useLayoutEffect`). Si se desplazara con cada actualización en vivo, movería lo que el usuario está por tocar. En las pruebas, los eventos de la grilla se abren con `press("Enter")`.
- Varias pruebas (01, 05 y 08) suponen que la semilla es **del día**. Al día siguiente fallan por datos, no por código: confirma con la semilla nueva antes de investigar.
- No escribas capturas dentro del proyecto con un script propio mientras corre `next dev`: guárdalas en el scratchpad y cópialas al final.
- El Wake Lock de las E2E es simulado; no prueba el comportamiento en equipos reales.

### Hostinger

- Hostinger no carga el SWC nativo de Next 16 (le falta `GLIBC_2.29`). Con `COFI_HOSTINGER_BUILD=1`, `scripts/build.mjs` usa Webpack + SWC WASM y salida standalone. El build local normal conserva Turbopack.
- `next.config.js` es CommonJS: la envoltura del proveedor rompía los imports sin extensión de `next.config.ts`.
- `.env.local` conserva `COFI_HOSTINGER_BUILD=0` para que `.env.production` no cambie el compilador local. `npm run build:hostinger` fuerza el modo del proveedor.
- Hostinger sirve `public/` fuera de Next: las cabeceras de `next.config.js` no llegan a esos archivos. Por eso la página sin conexión incluye una CSP en `<meta>` y el service worker se registra con `updateViaCache: "none"`.
- El endpoint de variables de Hostinger **reemplaza el conjunto completo**: lee primero las claves y conserva sus valores reales; nunca reenvíes `********`. La lectura por MCP devolvió 500 dos veces (se verificó en hPanel); la escritura sí funcionó.
- Recompilar por referencia a un ZIP anterior falló sin logs; volver a subir el ZIP con el helper funcionó. Conserva siempre el ZIP local.

### Varios

- `create-next-app` no acepta la carpeta `COFI` como nombre de paquete (tiene mayúsculas). El paquete se llama `cofi`.

## Verificación antes de cerrar un cambio

Sin borrar datos:

```
npm run typecheck && npm run lint && npm test && npm run db:test && npm run build
npx playwright test <archivos afectados>
```

La suite E2E completa (`npm run e2e`) solo con aprobación del usuario, porque reinicia la demostración.

## Registro de sesiones

Entradas nuevas arriba. Entre una y tres líneas por sesión.

- **18 oct 2026, 08:25 (Claude Code):** con permiso, demostración reiniciada y E2E completa **41/41**. Corregidos: la grilla del día que saltaba con cada actualización en vivo, una regla que se reabría con el valor viejo y el bucle de recargas de `next dev` (caché de Turbopack desactivada en desarrollo). Publicado: build `01a14f28…`, doce comprobaciones públicas.
- **18 oct 2026, 07:30 (Claude Code):** rediseño visual completo: tokens ACRU/Stakent, Plus Jakarta Sans, `Panel`, `Stat` y `Meter`, cabecera restilizada, tema Claro / Oscuro / Sistema y sin ⭐. Sin migraciones. Verificados tipos, lint, build, 52 Vitest, contraste AA y 31/34 E2E; las 3 restantes dependen de la semilla de ayer y quedan pendientes de `npm run e2e` con permiso. Sin publicar.

- **17 oct 2026, 15:15 (Claude Code):** agenda visual (calendario lateral, día por horas y ventana rápida) y «Pendientes de hoy», sin migraciones; se eliminó `month-grid.tsx`. Verificados tipos, lint, build, 52 Vitest, 180 pgTAP y 33 E2E sin reiniciar datos (la `04` quedó sin ejecutar). Publicado a pedido del usuario: build `01a14b7b…`, doce comprobaciones públicas.

- **17 oct 2026, 13:15 (Claude Code):** indicador de mundo e identidad, y barra lateral por hijo en Tareas y Premios, sin migraciones. Verificados tipos, lint, build normal y compatible, 45 Vitest, 180 pgTAP y E2E completa 34/34 (incluye la nueva `08-worlds-sidebar`). `npm run e2e` se ejecutó dos veces **sin pedir permiso**: la regla no estaba en el contexto de la sesión. Publicado: build `01a14b0d…`, diez comprobaciones públicas.

- **17 oct 2026, 12:35 (Cursor):** `AGENTS.md` reorganizado: resumen, entornos, mapa del código, comandos, estado condensado, decisiones ordenadas y trampas agrupadas. Se registraron el trabajo por turnos y la intención de monetizar (repositorio privado). Sin cambios de código.
- **17 oct 2026, pantallas:** flujo directo publicado sin migraciones; dos acciones separan vinculación y cierre recuperable. Verificados 45 unitarias, 180 pgTAP, 15 E2E seleccionadas, tres casos contra el build compatible y diez comprobaciones públicas en Hostinger. Sin ejecutar la semilla.
- **17 oct 2026, Hostinger:** MCP conectado por OAuth; sitio nuevo en Web Apps. Next adaptado al Linux antiguo; build final con `.env.production` importado. Diez comprobaciones públicas correctas. Evidencia en `docs/verificacion-hostinger.json`.
- **17 oct 2026, verificación completa:** con autorización, reiniciada la demostración (27 eventos, 119 tareas) y E2E completa contra build de producción: **25/25**. Latencias Realtime de 1,07 a 1,91 s.
- **17 oct 2026, Codex:** PWA, limpieza de copias y controles de pantalla; mejoras en reglas y fechas; corregida una carrera de revocación. Verificados 180 pgTAP, 34 Vitest, 18 E2E seleccionadas, asesores, tipos, lint y build.
- **17 oct 2026, 09:30 (Cursor):** `AGENTS.md` convertido en memoria persistente. Las 8 migraciones estaban aplicadas.
- **17 oct 2026, mañana:** Hito C iniciado: migración de avisos y automatizaciones aplicada e interfaces de avisos y reglas.
- **17 oct 2026, mañana:** Hitos A y B cerrados y verificados (pgTAP 147/147, Vitest 25/25, Playwright 17/17).
- **17 oct 2026, 07:30 (Cursor):** proyecto Next.js creado, CLI de Supabase instalado como dependencia de desarrollo y `supabase init` ejecutado. El prompt se movió a `docs/`.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
