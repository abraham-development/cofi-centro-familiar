# Modelo de datos

Migraciones en `supabase/migrations/` (aplicadas en orden):

| Migración | Contenido |
| --- | --- |
| `20261017123758_core.sql` | Núcleo del Hito A: familias, integrantes, adultos, invitaciones, categorías, agenda, pendientes del hogar, auditoría, RLS y RPC |
| `20261017132546_family_delete_cascades.sql` | Cascadas que permiten borrar una familia completa |
| `20261017133732_responsibilities.sql` | Recurrencias, series, plantillas, revisión, puntos, premios, canjes y cron de horizonte |
| `20261017134414_devices.sql` | Pantallas vinculadas, códigos de vinculación, políticas para dispositivos y limpieza de sesiones anónimas |
| `20261017134645_realtime.sql` | Difusión de invalidaciones (Broadcast privado) y autorización de canales |
| `20261017140132_event_series_split.sql` | «Cambiar esta y las siguientes» en una transacción |
| `20261017141509_merge_select_policies.sql` | Una política SELECT por tabla (adultos o pantallas) |

## Entidades (Hito A)

| Tabla | Para qué |
| --- | --- |
| `families` | Nombre, zona IANA, formato de hora (12/24 h), franjas del día (mañana, tarde, noche) y color de «Toda la casa» |
| `family_members` | Personas de la casa: nombre o alias, tipo (`adult`, `child`, `other`), color, iniciales, emoji. **No son cuentas.** Se archivan (`archived_at`), no se borran |
| `adult_memberships` | Relación entre una cuenta de Auth y una familia, con su integrante y rol (`owner`, `admin`). Un adulto puede estar en varias familias |
| `family_invitations` | Invitación de un adulto: correo, rol, integrante opcional, **hash SHA-256 del token**, vencimiento a los 7 días, aceptación o anulación |
| `event_categories` | Categorías configurables por familia: visita, colegio, salud, hogar, trabajo, pagos, otro |
| `calendar_events` | Evento: título, horas (`starts_at`/`ends_at`) o fechas de día completo (`start_date`/`end_date` exclusivo), zona, fechas locales derivadas, visibilidad, importancia, «toda la casa», estado y versión |
| `event_participants` | Integrantes de la misma familia que participan en un evento |
| `calendar_event_private_notes` | Notas solo para adultos, separadas de lo que se proyecta |
| `task_occurrences` | Obligación concreta. En el Hito A solo hay `kind = 'household'` (pendiente doméstico). En el B se suman `chore` y `habit` para los hijos |
| `audit_log` | Acciones relevantes con contexto mínimo: actor, familia, acción, objeto y momento |

## Integridad

- **Aislamiento estructural.** Las tablas hijas referencian `(family_id, id)` mediante claves foráneas compuestas. Un evento no puede tener como participante a un integrante de otra familia, aunque alguien lo intente directamente por la API (hay una prueba).
- **`family_id` inmutable.** Los triggers rechazan cambiarlo y los clientes no tienen privilegio de UPDATE sobre esa columna.
- **Propietario obligatorio.** Un trigger diferido impide que una familia se quede sin propietario activo.
- **Pendientes del hogar.** Un CHECK garantiza `points = 0`, sin revisión, y estados limitados a `pending`, `done` y `cancelled`.
- **Fechas.** Un CHECK exige la forma correcta: con hora o de día completo, nunca ambas. Un evento dura como máximo 62 días, lo que permite consultar rangos con índice.
- **Versiones.** `version` se incrementa por trigger en cada cambio. `created_by`, `updated_by`, `created_at` y `updated_at` los fija el servidor.
- **Borrado de familia.** Borra en cascada todo su contenido. Los integrantes y las categorías no se borran por separado desde la app: se archivan.

## Transacciones (RPC)

| RPC | Garantía |
| --- | --- |
| `create_family` | Familia + integrante adulto + pertenencia de propietario + categorías en una transacción. Idempotente por `command_id` |
| `create_invitation` / `accept_invitation` / `revoke_invitation` | El token se consume una sola vez. El correo de la cuenta debe coincidir y estar confirmado |
| `update_adult_membership` | Cambio de rol o retiro, siempre con al menos un propietario activo |
| `create_event` / `update_event` / `cancel_event` | Evento + participantes + notas privadas juntos. Idempotentes y con control de versión |
| `create_household_task` / `update_household_task` / `set_household_task_status` | El estado solo cambia por RPC, con la hora del servidor y el actor |
| `get_invitation_preview` | Solo revela el nombre de la familia al destinatario correcto con sesión |
| `server_now` | Hora del servidor (sin datos familiares) |

## Índices principales

- `calendar_events (family_id, local_start_date, local_end_date)`: radar, día y agenda por rango.
- `task_occurrences (family_id, kind, due_date)` y un índice parcial de abiertos.
- `adult_memberships (user_id, family_id)`: lo usan las políticas RLS en cada consulta.
- Índices para todas las FK compuestas, recomendados por los asesores de Supabase.

## Entidades del Hito B

| Tabla | Para qué |
| --- | --- |
| `event_series` + `event_series_participants` | Regla de repetición (hora local, duración, zona), horizonte materializado |
| `calendar_events.series_id / occurrence_date / is_exception` | Cada ocurrencia de una serie; editar o cancelar una la marca como excepción y el generador no la toca |
| `task_templates` + `task_template_assignees` | Responsabilidad o hábito: puntos, revisión, hora límite, regla y destinatarios (solo hijos) |
| `task_occurrences` (`chore`, `habit`) | Una por hijo y fecha (`UNIQUE(template, hijo, fecha)`). Guarda `submitted_at`, `submitted_late`, revisión y los **puntos efectivos** |
| `task_reviews` | Historial: entregada, aprobada, por corregir, exenta, reabierta (con motivo y puntos) |
| `points_ledger` | Libro de movimientos: crédito, reversión, débito, reembolso y ajuste. `UNIQUE(familia, clave de idempotencia)` |
| `member_point_accounts` | Saldo proyectado (`CHECK balance >= 0`). Se bloquea con `FOR UPDATE` al mover puntos |
| `rewards` + `reward_members` | Catálogo; sin filas en `reward_members` el premio es para todos los hijos |
| `reward_redemptions` | Solicitado → aprobado → entregado; rechazado; cancelado. Guarda título y costo del momento |
| `paired_devices` | Pantalla vinculada: familia, nombre, alcance (`home` o `child` + hijo), aprobó, última actividad, revocación |
| `private.device_pairing_requests` | Código de vinculación (hash), vencimiento y estado. No está expuesta por la API |
| `private.pairing_attempts` | Intentos de aprobación, para limitar la fuerza bruta |

### Reglas clave

- **Motor único.** `private.recurrence_dates` alimenta las series de eventos y las plantillas de tareas.
- **Sin fechas pasadas.** La materialización empieza en «hoy» de la familia. Los cron no recrean el pasado.
- **Editar una plantilla** regenera solo las ocurrencias futuras **no entregadas y sin ajustes**. Lo cumplido conserva sus puntos.
- **Puntualidad** = entrega del hijo frente a la hora límite en la zona familiar. Aprobar tarde no la cambia.
- **Racha de hábitos.** Un día exento **pausa** la racha, no la rompe. Hoy pendiente tampoco la rompe.
- **Canjes.** Se descuentan al **aprobar**, verificando el saldo bajo bloqueo. Cancelar uno ya cobrado reembolsa una sola vez.

## Trabajos programados (pg_cron)

| Job | Cuándo (UTC) | Qué hace |
| --- | --- | --- |
| `cofi-extend-horizons` | 05:20 todos los días | Amplía series (+60 días) y plantillas (+14 días) |
| `cofi-cleanup-anonymous` | 05:40 todos los días | Borra identidades anónimas sin vínculo activo con más de 2 días |

Historial de ejecución: `select * from cron.job_run_details order by start_time desc limit 20;`

## Próximas entidades (Hito C)

`automation_rules`, `reminder_jobs`, `notifications`, `notification_deliveries`, `push_subscriptions`. Ver [roadmap](roadmap.md).
