# Hoja de ruta y estado

Leyenda: ✅ hecho y verificado · 🔶 parcial · ⏳ pendiente

## Hito A: base verificable (Fase 1) ✅

| Entregable | Estado | Evidencia |
| --- | --- | --- |
| Next.js 16 (App Router, Cache Components) + TypeScript + Tailwind 4 + shadcn/ui | ✅ | `npm run build` correcto |
| Supabase en la nube (desarrollo), migraciones versionadas | ✅ | 2 migraciones aplicadas; `migration list` sincronizado |
| Registro, acceso y recuperación con código OTP de 8 dígitos por SMTP de Hostinger | ✅ | Auth configurado y verificado con `auth:configure --verify`; falta confirmar con un correo real (ver «Pendiente») |
| Familia, integrantes, colores, roles e invitaciones de adultos | ✅ | pgTAP + E2E |
| Agenda: crear, editar y cancelar, participantes, visibilidad, notas privadas, solapamientos, conflictos de versión | ✅ | E2E «crear, editar y cancelar» |
| Pantalla de casa: reloj contextual, hoy por franjas, radar de 7 días, pendientes, importantes | ✅ | E2E + capturas en `docs/capturas/` |
| Pendientes del hogar sin puntos | ✅ | pgTAP + E2E |
| Aislamiento entre familias (interfaz, URL, RPC, Data API) | ✅ | 46 aserciones pgTAP, E2E y prueba con JWT reales |
| Fechas: medianoche, día completo, cambio de año, bisiesto, DST | ✅ | Vitest (19) + pgTAP |

**Resultados al cerrar el Hito A (17 oct 2026):**

- Vitest: 19/19.
- pgTAP: 50/50.
- Playwright: 10/10, en móvil, tablet vertical y horizontal, y pantalla de 1920 px.
- `typecheck` y `lint` limpios.
- Asesores de Supabase: solo el aviso de contraseñas filtradas, que requiere plan de pago.

## Hito B: responsabilidades, dispositivos y sincronización ✅

| Entregable | Estado | Evidencia |
| --- | --- | --- |
| Motor único de recurrencias en SQL: una vez, diario, días de semana, semanal y mensual con política explícita para el 31 | ✅ | pgTAP (incluye bisiesto, «saltar» y «último día») |
| Series de eventos: horizonte de 60 días, excepciones conservadas, «esta y las siguientes» en una transacción, terminar serie | ✅ | `03_responsibilities`, `06_series_split` |
| Plantillas de tareas y hábitos con una ocurrencia por hijo y fecha; horizonte de 14 días; cron nocturno que amplía | ✅ | pgTAP + job `cofi-extend-horizons` |
| Entrega, revisión, corrección, exención y reapertura con motivo; atraso según la entrega del hijo | ✅ | pgTAP + E2E |
| Libro de puntos con saldo bloqueado por fila, sin duplicados ni negativos; premios y canjes; reembolso único | ✅ | pgTAP (concurrencia simulada) + E2E |
| Vinculación desde la cuenta adulta en el propio equipo; código de 8 caracteres como alternativa, de un solo uso y 10 min; modos familiar e hijo | ✅ | `04_devices` (37 aserciones), 11 nuevas unitarias y `07-current-device`; ver [pantallas](pantallas.md) |
| Revocación inmediata (RLS) con aviso dirigido y limpieza de la sesión local | ✅ | E2E: 1,1–1,2 s |
| Sesión de adulto temporal en pantallas compartidas (se cierra tras 5 min sin uso) | ✅ | `KioskAdultGuard` |
| Realtime: Broadcast privado con invalidaciones mínimas, canales por familia, pantallas, hijo y dispositivo; relectura al reconectar | ✅ | `05_realtime` + E2E |

**Latencia medida** en E2E, desde la acción de un navegador hasta que se ve en el otro (incluye la acción del servidor y la relectura):

| Recorrido | Latencia |
| --- | --- |
| Evento del celular a la cocina | 1,9–2,4 s |
| Pendiente de la cocina al celular | 1,4 s |
| Aprobación del celular al cuarto | 1,5–2,0 s |
| Revocación | 1,1 s |

Se registra en `test-results/latencias.txt`. No es una garantía universal: depende de la red.

**Resultados (17 oct 2026):**

- pgTAP: 147/147.
- Vitest: 25/25.
- Playwright: 17/17.
- Build, tipos y lint limpios.
- Asesores: solo los avisos informativos de sesiones anónimas (cubiertos por las políticas) y de contraseñas filtradas (plan de pago).

## Hito C: avisos, automatizaciones y PWA 🔶 (en curso)

| Entregable | Estado | Evidencia |
| --- | --- | --- |
| Avisos persistentes (`reminder_jobs` → `notifications`) en la misma transacción que el evento; `pg_cron` cada minuto, reclamación con `SKIP LOCKED`, reintentos con espera creciente, ventana de relevancia y deduplicación | ✅ | `07_reminders` (33 aserciones); jobs `cofi-process-reminders` y `cofi-dispatch-push` activos |
| Reprogramar o cancelar actualiza o anula los trabajos y tareas futuras; se respeta lo hecho y lo editado a mano | ✅ | pgTAP |
| Reglas de visita y colegio aceptadas por evento: avisos la noche anterior y en la mañana, y tareas de preparación | ✅ | pgTAP; E2E de creación/edición de regla, evento y preparativos del hijo |
| Recordatorios por evento en el formulario; avisos en `/casa`, `/pantalla` y la vista del hijo con «Entendido» por pantalla; centro `/avisos` con estado del sistema | ✅ | RPC/aislamiento pgTAP; E2E de persistencia de recordatorios y página `/avisos` |
| Horas de silencio por familia y noche automática opcional por pantalla | ✅ | pgTAP; Vitest para intervalos, medianoche y DST; controles implementados |
| Entregas Push: tablas, reclamación y resultado solo para `service_role`, error 410 que desactiva la suscripción | ✅ | pgTAP |
| Envío real de Push: claves VAPID, Edge Function `send-push`, secretos en Vault (`cofi_push_function_url`, `cofi_cron_secret`) | ⏳ | Sin la configuración, `/avisos` lo indica y los avisos visuales siguen funcionando |
| PWA: manifest/iconos, service worker exclusivamente público, registro y actualización elegida por usuario, Wake Lock e instrucciones | ✅ | `05-pwa`: iconos, allowlist de caché, recuperación/liberación de Wake Lock simulado; ver `docs/pwa.md` |
| Instantánea mínima autorizada (localStorage, 24 h), con limpieza al cerrar sesión, cambiar de contexto, revocar o caducar | ✅ | E2E: recarga sin red, limpieza del DOM al vencer, texto sin interpretar HTML, actores/pestañas y revocación tras reconectar; captura `docs/capturas/pwa-sin-conexion.png` |
| Instalación, batería, suspensión y Push en equipos Android/iOS reales; control opcional de pantalla completa | ⏳ | El Wake Lock de E2E es simulado. No se ha hecho validación física |
| Recordatorios en series de eventos (columna lista; falta la interfaz) | ⏳ | — |

**Verificación de esta sesión (17 oct 2026):**

- Ocho migraciones locales/remotas sincronizadas hasta `20261017141953`; cuatro trabajos cron activos.
- pgTAP: **180/180**, en transacciones revertidas. Tipos regenerados.
- Vitest: **34/34**, incluida la carrera entre validar el vínculo y perder acceso RLS al revocarse. Tipos, lint y build de producción correctos.
- Playwright: **25/25 de la suite completa**, contra el build de producción, después de que el usuario autorizó reiniciar los datos ficticios de desarrollo. Comando: `E2E_PORT=3001 E2E_PRODUCTION=1 npm run e2e`. Duración: 1,5 min; semilla inicial de 27 eventos y 119 tareas.
- Repetición final de PWA y reglas tras corregir la carrera de revocación: **8/8**.
- `04-devices-realtime`: **7/7**, con tres navegadores. Latencias medidas: evento celular→cocina **1,913 s**, pendiente cocina→celular **1,409 s**, aprobación celular→cuarto **1,407 s** y revocación **1,074 s**. No son garantías universales; registro en `test-results/latencias.txt`.
- Asesores: las mismas categorías de avisos de sesiones anónimas y protección de contraseñas filtradas. Rendimiento: solo índices sin uso (informativo); no se modificó el esquema.

No se crearon recursos de producción ni se activaron servicios con costo. Web Push externo y recordatorios de series siguen pendientes.

## Publicación en Hostinger Web Apps (17 oct 2026)

- El usuario eligió Hostinger, autorizó OAuth y pidió desplegar la aplicación. Sitio nuevo dentro del Business existente: [COFI](https://mediumturquoise-elephant-247172.hostingersite.com). No se contrató otro plan ni se modificaron los otros cuatro sitios.
- Adaptación comprobada de Next 16.4.2 al Linux del proveedor: configuración CommonJS, Webpack + SWC WASM y salida standalone. Cache Components y Partial Prefetching siguen activos; el build local normal conserva Turbopack.
- Verificados tipos, lint, **34/34 Vitest**, build normal y build compatible; **5/5 E2E PWA** en ambos modos, sin reiniciar ni sembrar datos.
- Verificación pública con cuentas ficticias existentes: acceso protegido, inicio de sesión, casa, agenda, avisos, reglas, `no-store` en datos privados y cierre de sesión por Server Action. También SW v2, caché exclusivamente pública, recarga sin conexión con copia autorizada y CSP, reconexión; sin errores JavaScript.
- `.env.production` se preparó vacío; el usuario completó Supabase y autorizó completar URL pública/selector de build e importar. Importación aplicada, manteniendo cinco claves remotas y sin mostrar sus valores. Build posterior `01a14aad-a7e9-71c1-b081-aab397defa72` **completado**; diez comprobaciones públicas correctas a las 11:27 Lima, registradas en [`verificacion-hostinger.json`](verificacion-hostinger.json). La VAPID pública sigue vacía hasta completar el emisor Push.
- El backend sigue siendo el mismo proyecto `gnnajgdfhbbziucqnewj`; no hay base de producción separada. No se cambió el esquema ni se cargaron semillas.

**Actualización de vinculación directa (17 oct, mediodía):**

- Implementada configuración desde el equipo, manteniendo código alternativo. Las RPC, sesiones separadas y RLS existentes se reutilizan; sin migraciones.
- Tipos y lint correctos; **45/45 Vitest** y **180/180 pgTAP**. Asesores: las mismas categorías de avisos de sesiones anónimas y protección de contraseñas filtradas.
- **15/15 E2E seleccionadas** contra build de producción: aislamiento, cuatro tamaños, PWA y el nuevo flujo. Los tres casos de vinculación se verificaron también contra el build Webpack/WASM; el caso familiar incluye renovación de una identidad revocada y conservación del historial.
- Comprobados cierre adulto, copia local, otras pestañas y vuelta atrás; reintento tras fallo de red sin duplicados y alternativa por código a 360 px. El login fuerza navegación completa para evitar el acceso precargado sin sesión.
- Sin ejecutar semillas ni borrar familias. **Publicado** en Hostinger: build `01a14ae0-18ff-7374-8223-6fd497974ad4`. Diez comprobaciones públicas correctas a las 12:22 Lima: acceso dirigido, activación familiar e infantil, cierre en otra pestaña, permisos administrativos bloqueados, regreso persistente y revocación en vivo. Evidencia en [`verificacion-vinculacion.json`](verificacion-vinculacion.json) y [captura de la nueva entrada](capturas/vincular-sencillo.png).

## Mundos y seguimiento por hijo (17 oct 2026) ✅

Pedido del usuario. Decisiones tomadas:

- Indicador y acento de color.
- El nombre del adulto junto a «Padres».
- Vista centrada en el hijo.
- Historial de 7 días, con «Ver 30 días».

Detalle en [arquitectura](arquitectura.md#mundos-padres-hijos-y-casa).

| Entregable | Estado | Evidencia |
| --- | --- | --- |
| Indicador de quién usa cada pantalla, a la izquierda de «En vivo»: «Mamá · Padres», «Mateo · Hijos», «Cocina · Casa» | ✅ | E2E `08-worlds-sidebar` (posición, contenido y pantallas vinculadas de hijo y de casa) |
| Aviso «Estás viendo el mundo de Mateo como Mamá» en la vista del hijo desde un adulto | ✅ | E2E |
| Barra lateral de hijos en Tareas: hoy, por revisar, lo que hizo (7/30 días), sus responsabilidades | ✅ | E2E sin datos de otro hijo; capturas `capturas/tareas-hijo-escritorio.png` y `capturas/tareas-hijo-movil.png` |
| Barra lateral de hijos en Premios: saldo, pedidos, premios a su alcance, canjes y movimientos | ✅ | E2E; captura `capturas/premios-hijo-escritorio.png` |
| Celular a 390 px sin desbordes; el avatar del adulto es el botón del menú | ✅ | E2E |

**Verificación:**

- Tipos, lint y build de producción correctos.
- Vitest: **45/45**.
- Playwright: **34/34 de la suite completa**, con semilla de desarrollo (`npm run e2e`, servidor de desarrollo).
- Sin migraciones ni cambios de permisos.
- **No publicado todavía en Hostinger.**

## Hitos D y E: IA de texto y voz ⏳ (después del núcleo)

No se implementan hasta validar A, B y C. La aplicación funciona sin claves de IA.

## Pendiente o a decidir

- Probar un registro real: debe llegar el código de 8 dígitos desde `cofi@afcrtecnologia.com`.
- El nombre del remitente es «cofi», tal como se configuró en el panel. Para mostrar «Centro Familiar», cámbialo allí o guarda `SMTP_PASSWORD` en `.env.local` y ejecuta `auth:configure -- --apply`.
- Protección de contraseñas filtradas: requiere plan de pago de Supabase.
- Separar Supabase de producción del desarrollo cuando se autorice. El destino de la app cambió a Hostinger por decisión del usuario; las variables proporcionadas actualmente apuntan al proyecto existente.
