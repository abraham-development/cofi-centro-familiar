# Arquitectura

## Visión general

COFI es un **monolito modular**: un solo proyecto con Next.js (App Router), TypeScript y Supabase. PostgreSQL es la fuente de verdad. La lógica que debe ser atómica vive en funciones SQL (RPC), y la interfaz consume siempre los mismos casos de uso.

```
Navegador ──► proxy.ts (refresca la sesión) ──► Server Components / Server Actions
                                                    │
                                                    ▼
                                    casos de uso (src/features/*/use-cases.ts)
                                                    │  supabase-js con la sesión del actor
                                                    ▼
                                    PostgREST ──► PostgreSQL (RLS + RPC + triggers)
```

## Capas

| Capa | Dónde | Responsabilidad |
| --- | --- | --- |
| Presentación | `src/app`, `src/features/*/components`, `src/components` | Pantallas, formularios y estados de carga, error, vacío y sin conexión |
| Aplicación | `src/features/*/actions.ts`, `use-cases.ts` | Validan con Zod, derivan actor y familia de la sesión, llaman al RPC y traducen errores |
| Dominio (TS) | `src/features/*/domain`, `src/lib/time` | Lógica pura y comprobada: franjas del día, radar, estado del reloj, urgencia de pendientes y fechas |
| Dominio (SQL) | `supabase/migrations` | Permisos, transacciones, idempotencia, versiones y fechas locales derivadas |
| Persistencia | Supabase PostgreSQL | Fuente de verdad |

Las **Server Actions** solo adaptan: validan la entrada con el mismo esquema Zod del formulario y llaman al caso de uso. Una futura propuesta de IA confirmada por un adulto llamará a esos mismos casos de uso. Ninguna regla vive en un componente o en un modal.

## Next.js 16 con Cache Components

- `cacheComponents` y `partialPrefetching` están activos, que son los valores por defecto de `create-next-app`. Las rutas privadas son *Partial Prerender*: solo se prerenderiza el «esqueleto» estático, y todo lo que lee la sesión se transmite por petición dentro de `<Suspense>`.
- **Nunca se usa `"use cache"` con datos familiares.** El cliente de servidor de Supabase llama a `connection()`, de modo que cualquier lectura de datos es dinámica y por usuario.
- `proxy.ts` (antes `middleware.ts`) solo refresca la sesión con `getClaims()`. No autoriza nada: cada página y cada acción vuelven a validar al actor (`src/lib/auth/session.ts`).
- Tras una mutación, la acción llama a `refresh()` (`next/cache`) para que el router vuelva a pedir los datos.

## Sesión y actor

- `getSessionUser()` valida el JWT con `supabase.auth.getClaims()`. Nunca se usa `getSession()` para autorizar.
- `getAdultContext()` carga las pertenencias activas y elige la **familia activa** con la cookie `cofi-family`. Esa cookie **siempre se valida contra las pertenencias reales**: cambiarla no amplía permisos (hay una prueba E2E que lo comprueba).
- Un adulto puede pertenecer a varias familias. El menú permite cambiar de familia.

## Fechas y horas

- Instantes en `timestamptz`. Los eventos guardan además la **zona IANA** con la que se crearon.
- Los eventos de día completo usan `start_date`/`end_date` (fin exclusivo): **nunca se convierten a medianoche UTC**.
- Un trigger deriva `local_start_date` y `local_end_date` en la zona del evento. Así las consultas por rango usan un índice y los eventos que cruzan medianoche pertenecen a ambas fechas.
- En TypeScript se usa `temporal-polyfill`. Las horas que no existen por el cambio de horario se resuelven con la misma política que PostgreSQL. Hay pruebas para Lima y para Nueva York (con DST).
- El texto visible (días, meses, AM/PM) se genera con tablas propias en español, sin `Intl`. Así servidor y navegador producen exactamente la misma cadena y no hay errores de hidratación.

## Reloj contextual

- El servidor envía su hora (`requestNow()`). El primer render del cliente usa ese mismo valor.
- `ClockProvider` avanza cada segundo **en el dispositivo**. Mide el desfase contra `/api/time` solo al montar, al volver de suspensión, al reconectar y cada 6 horas. Nunca hay tráfico por segundo.
- Al cambiar el día, o al volver tras más de un minuto oculto, recarga los datos.
- `computeClockStatus` decide qué está «Ahora», cuál es el próximo evento y la cuenta regresiva. Ignora los cancelados. Un evento sin hora de fin se considera «empezando» durante 15 minutos.

## Idempotencia y concurrencia

- Cada mutación repetible lleva un `command_id` que genera el cliente (`useCommandId`). El RPC devuelve el resultado existente si el comando ya se aplicó.
- Las ediciones envían `expected_version`. Si otra persona cambió el registro, el RPC responde `VERSION_CONFLICT` y la interfaz pide recargar en lugar de sobrescribir.

## Errores

La base de datos lanza `COFI:<CÓDIGO>` (`private.raise_domain`). `src/lib/errors.ts` lo traduce a mensajes en español: sesión requerida, acceso denegado, dato inválido, no encontrado, conflicto de versión, etc. Los errores SQL crudos nunca llegan al usuario.

## Dos sesiones en un mismo navegador (adulto y pantalla)

- La sesión de **pantalla** usa la cookie `cofi-device`, con `createDeviceClient` en el servidor y en el navegador. La de **adulto** usa la cookie estándar de Supabase.
- `proxy.ts` refresca ambas.
- `getDeviceContext()` valida la sesión anónima con `getClaims()` y consulta el vínculo en la base de datos en cada petición.
- Las acciones que pueden ejecutar los dos actores (marcar un pendiente, entregar una tarea, pedir un premio) reciben `as: "adult" | "device"`. Eso **solo elige qué sesión usar**: los permisos los decide la base de datos.
- `/pantalla` muestra la vista de casa o la del hijo según el alcance del vínculo. `/vincular` ofrece configuración en el propio equipo como principal y código desde otro equipo como alternativa. `/configuracion/dispositivos/esta-pantalla` confirma el alcance; el servidor usa ambas sesiones para vincular internamente con las RPC existentes. La finalización verifica el vínculo y cierra al adulto; el cliente limpia su copia, notifica a otras pestañas y hace una navegación completa. Ver [pantallas](pantallas.md).

## Mundos: padres, hijos y casa

Cada pantalla dice quién la usa y en qué mundo está. Lo hace con `IdentityBadge` (`src/components/app-shell/identity-badge.tsx`), situado a la izquierda de «En vivo» y marcado con `data-world`.

| Mundo | Dónde | Muestra |
| --- | --- | --- |
| Padres | Cabecera de `(app)` | Avatar y nombre del adulto conectado, con la etiqueta «Padres». El rol (Propietario o Administrador) va en el título emergente y en el menú. |
| Hijos | `/pantalla` con alcance `child` | Avatar y nombre del hijo, con la etiqueta «Hijos» y una franja de su color sobre la barra |
| Casa | `/pantalla` con alcance `home` | Nombre de la pantalla (p. ej., «Cocina»), con la etiqueta «Casa» |

- La identidad sale de la sesión ya validada. `getAdultContext()` incluye `membership.me` (nombre, color, iniciales y emoji) embebiendo `family_members` en la misma consulta de pertenencias. No hay peticiones nuevas ni cambios de esquema o permisos.
- En el celular, el indicador de la cabecera se oculta para no desbordar. El avatar del adulto pasa a ser el botón del menú («Menú de Mamá · Familia …»), y un texto accesible indica el mundo.
- Cuando un adulto abre `/hijos/[id]`, un aviso con el color del hijo indica que está viendo el mundo del hijo y que lo que marque queda a su nombre de adulto. Enlaza al seguimiento del hijo.

## Seguimiento por hijo en Tareas y Premios

`ChildrenSidebar` (`src/features/children/components/children-sidebar.tsx`) muestra «Todos» y luego cada hijo, con un dato breve y un aviso.

- **El estado vive en la URL** (`?hijo=<id>`): se puede compartir, se renderiza en el servidor y se lee dentro de `<Suspense>`. `resolveSelectedKid` lo valida contra los hijos activos de la familia; un valor desconocido muestra «Todos».
- **Formato:** columna fija en `lg` y fila desplazable de chips en el celular.
- **Accesibilidad:** `<nav aria-label="Hijos">` con `aria-current` en el elegido.
- **Tareas** (`/responsabilidades?hijo=`):
  - progreso de hoy y lo que tiene por revisar;
  - sus tareas de hoy;
  - lo que hizo, agrupado por día con resumen de puntualidad (`ChildTaskHistory`). Son 7 días, o 30 con `&dias=30`; no se aceptan otros valores;
  - las plantillas que lo incluyen.
- **Premios** (`/premios?hijo=`):
  - saldo con ajuste;
  - pedidos pendientes;
  - premios a su alcance («Le faltan N»);
  - historial de canjes en todos los estados;
  - movimientos de puntos.
- «Todos» conserva la vista general de antes.
- Las grillas anidadas usan `grid-cols-1`. Sin eso, las columnas implícitas se ensanchan con el contenido y desbordan el celular.

## Recurrencias

- `private.recurrence_dates(...)` es el **único motor**: devuelve fechas locales.
- Los materializadores insertan con `ON CONFLICT DO NOTHING` sobre `(serie, fecha)` o `(plantilla, hijo, fecha)`. Volver a ejecutarlos no duplica nada, y una ocurrencia cancelada o editada nunca se recrea.
- La hora local se convierte en instante con la zona IANA de la familia (`(fecha + hora) AT TIME ZONE zona`), así que el cambio de horario no desplaza la hora.
- Horizonte: 60 días para eventos y 14 para tareas. `pg_cron` lo amplía cada noche, sin depender de pantallas abiertas.

## Tiempo real

- Triggers **por sentencia** con tablas de transición llaman a `realtime.send`: un mensaje por canal y sentencia, no por fila.
- `LiveSync` (cliente) se suscribe a canales privados y, ante cada aviso, ejecuta `router.refresh()` con una espera de 350 ms para agrupar cambios.
- Vuelve a leer al reconectar y al terminar una navegación si llegó un aviso durante ella. Al renovar el token actualiza `realtime.setAuth`.
- Muestra el estado («En vivo» / «Reconectando…») y la latencia del último aviso.
- Si se pierde un mensaje no se pierde el dato: PostgreSQL es la fuente de verdad y la relectura lo recupera.

## Autenticación por código (OTP)

- El registro y la recuperación de contraseña usan un **código de 8 dígitos** que vence en 10 minutos (`verifyOtp`), sin enlaces.
- Los correos salen por el SMTP de Hostinger (`cofi@afcrtecnologia.com`), con plantillas en español generadas por `scripts/configure-auth.mjs`.
- `/auth/confirm` existe solo como respaldo para enlaces y redirige únicamente a rutas internas.

## Avisos y PWA

El Hito C añade una outbox transaccional de recordatorios y reglas de preparativos aceptadas por adultos. `pg_cron` procesa los trabajos por lotes; avisos internos y entregas Push llevan estados separados. `/avisos` presenta reconocimiento por destinatario y salud del procesamiento. La migración y sus 33 aserciones específicas están verificadas; el emisor externo de Push continúa pendiente.

La PWA mantiene el service worker limitado a recursos públicos y guarda una proyección de consulta con caducidad por identidad y familia. No cachea respuestas autenticadas ni implementa escrituras sin red. Ver [política y pruebas de PWA](pwa.md).

## Decisiones registradas

| Decisión | Motivo |
| --- | --- |
| Supabase en la nube, sin Docker | Pedido del usuario. Las pruebas pgTAP corren en remoto dentro de `BEGIN … ROLLBACK` (`scripts/db-test-remote.mjs`). |
| npm (no pnpm) | El esqueleto inicial ya venía con `package-lock.json` y es la convención de sus otros proyectos. |
| Idempotencia en columnas (`command_id`, `last_command_id`) en lugar de una tabla `command_log` | Más simple y transaccional. El plan inicial proponía una tabla. |
| RPC `SECURITY INVOKER` para agenda y pendientes; `SECURITY DEFINER` solo en `private` | Se aplica RLS siempre que es suficiente. |
| Columnas de autoría sin FK a `auth.users` | Son informativas y así se evitan índices y bloqueos al borrar usuarios. |
| Un solo motor de recurrencias (Hito B) en SQL | Lo usan los RPC y `pg_cron` sin depender de pantallas abiertas. |
