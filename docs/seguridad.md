# Seguridad y privacidad

## Principios

1. **Cada familia está aislada en la base de datos**, no en la interfaz. Ocultar un botón o una ruta no protege nada.
2. **El actor y la familia se derivan de la sesión validada**, nunca de un `userId` o `familyId` que envíe el cliente.
3. **Privilegios mínimos.** A `anon` y `authenticated` se les revoca todo y se les concede solo lo necesario, incluso por columna.
4. **Una sola vía de acceso a los datos:** supabase-js con la sesión del actor, de modo que RLS siempre aplica. La clave `service_role` o secreta **no se usa** en la aplicación.

## RLS y privilegios

- Todas las tablas de `public` tienen RLS activo, con políticas **por operación** (select, insert, update y delete).
- Ninguna política se limita a «usuario autenticado». Todas comprueban pertenencia con `family_id in (select private.my_adult_family_ids())`, que se evalúa una vez por consulta.
- Las funciones auxiliares (`my_adult_family_ids`, `is_family_adult`, `is_family_owner`) son `SECURITY DEFINER` en el esquema **`private`**, que **no expone** la Data API. Usan `search_path = ''` y leen `auth.uid()` dentro de la función.
- Los RPC públicos son `SECURITY INVOKER`. Cuando hace falta privilegio (crear la familia, aceptar una invitación, cambiar estados), el RPC público llama a una función de `private` que vuelve a comprobar identidad y permisos.
- **Escrituras restringidas por columna.** `family_id`, `version`, `status`, `completed_*`, `token_hash` y las columnas de autoría no se pueden escribir directamente.
- `audit_log` no admite escrituras de clientes, y `token_hash` no se puede leer.
- Las sesiones anónimas (futuros dispositivos) tienen el rol `authenticated`. Sin un vínculo aprobado no ven nada: hay pruebas para ello.

## Comprobado con pruebas

`supabase/tests/database/01_core_rls.test.sql` (46 aserciones) y `02_family_delete.test.sql`:

- Un adulto de la familia A no lee ni modifica la B, tampoco por RPC o inserción directa.
- Un usuario autenticado sin pertenencia no ve nada, y una sesión anónima tampoco. `anon` no tiene acceso a tablas ni RPC.
- Las relaciones entre familias distintas y el cambio de `family_id` se rechazan.
- Las invitaciones vencidas, usadas o para otro correo se rechazan, y el nombre de la familia no se filtra a otro correo.
- No se puede dejar la familia sin propietario.

Las pruebas E2E (`tests/e2e/02-isolation.spec.ts`) verifican que otra familia no abre un evento por URL directa y que manipular la cookie de familia no amplía permisos. Además se verificó con JWT reales contra la Data API: cada familia ve solo lo suyo y sin sesión se responde `permission denied`.

## Pantallas vinculadas

- **Cómo se vinculan.**
  1. La opción principal permite iniciar sesión como adulto en el propio equipo, confirmar la familia y elegir nombre y alcance. El servidor valida la cuenta adulta y la identidad anónima del navegador mediante cookies independientes; no acepta una identidad de pantalla enviada por el formulario.
  2. Se reutiliza la solicitud de código y su aprobación, sin mostrar ni devolver ese código al cliente. Se guarda su hash SHA-256, con diez minutos de vigencia y un solo uso. La alternativa por código desde otro equipo conserva el mismo protocolo.
  3. Tras comprobar el vínculo, se cierra la sesión adulta local, se limpia su copia de consulta y se descarta su estado de navegación. Las otras pestañas adultas del navegador también salen de la administración. La sesión de pantalla conserva únicamente su identidad anónima y permisos autorizados. Ver [configuración de pantallas](pantallas.md).
  4. La finalización se puede reintentar sin crear otro vínculo. Un vínculo existente no se reemplaza desde este formulario; una identidad revocada se renueva conservando el historial.
- **Qué puede hacer cada una.**
  - La sesión anónima tiene el rol `authenticated`, pero eso no basta: cada política exige un vínculo **aprobado y no revocado** (`private.my_device()`).
  - Una pantalla de **casa** ve los eventos «familia» y los pendientes visibles para la familia, y puede marcarlos o reabrirlos. No puede crear, descartar, aprobar ni administrar.
  - Una pantalla del **cuarto de un hijo** ve solo lo «familia», lo suyo como participante, sus tareas, su saldo y sus premios. Puede entregar sus tareas y pedir o cancelar sus solicitudes. No puede aprobar, asignarse puntos ni actuar por otro hijo.
  - Una pantalla **no puede autorizarse sola**: no tiene INSERT sobre `paired_devices` y la aprobación exige un adulto que no sea anónimo.
- **Revocación.**
  - Es inmediata para lecturas y escrituras, porque RLS consulta `revoked_at` en cada petición.
  - Realtime avisa por `device:<id>`. La pantalla cierra su sesión, borra lo local y vuelve a `/vincular`.
  - Si estaba **sin conexión**, conserva lo ya descargado hasta que vuelva la red: no se puede borrar a distancia un dispositivo apagado.
- **Límites.**
  - 6 códigos por hora y por pantalla.
  - 10 códigos erróneos cada 15 minutos por adulto.
  - Las sesiones anónimas abandonadas se limpian a los 2 días.
  - Supabase limita los registros anónimos por IP (30 por hora por defecto).
  - **Pendiente:** CAPTCHA (Turnstile), recomendado por Supabase para producción.
- **Adulto en una pantalla compartida.** Su sesión usa otra cookie y se cierra tras 5 minutos sin uso, sin tocar el vínculo de la pantalla.
- **Aviso de los asesores `auth_allow_anonymous_sign_ins`.** Es informativo: señala las políticas `TO authenticated`, que las sesiones anónimas también cumplen. En COFI todas exigen pertenencia de adulto o vínculo aprobado, y las pruebas `04_devices` lo verifican.

## Tiempo real

- Broadcast **privado**. `realtime.messages` tiene una sola política de lectura (`private.can_read_topic`) y **ninguna de escritura**: solo la base de datos emite, desde triggers posteriores al commit.
- **Canales:**
  - `fam:<id>:adults` (solo adultos);
  - `fam:<id>:screens` (adultos y pantallas de esa familia);
  - `member:<id>` (adultos, pantalla de casa y el cuarto de ese hijo);
  - `device:<id>` (solo esa pantalla).
- Los mensajes **no contienen datos** (tabla, operación y hora). Las pantallas vuelven a consultar con sus permisos vigentes. Lo «solo adultos» nunca dispara avisos en canales de pantallas.
- Realtime guarda en caché la autorización de un canal hasta que llega un JWT nuevo. Por eso un mensaje nunca lleva contenido protegido y la revocación también se aplica en cada relectura.

## Claves y secretos

- En el navegador solo están `NEXT_PUBLIC_SUPABASE_URL` y la **clave publicable** (`sb_publishable_…`), que es pública por diseño.
- La contraseña SMTP, si se usa localmente, va en `.env.local` (ignorado por Git) sin prefijo `NEXT_PUBLIC_`. El script de configuración la oculta en su salida. Supabase la guarda en el proyecto y la API nunca la devuelve.
- Las contraseñas de las cuentas de demostración están en `.env.test.local` (ignorado) y solo existen en el proyecto de desarrollo.
- Los tokens de invitación se generan con 256 bits aleatorios, se guardan como **hash SHA-256** y solo se muestran una vez al adulto que invita.

## Autenticación

- Correo y contraseña de al menos 8 caracteres, con letras y números.
- Confirmación de correo obligatoria con **código de 8 dígitos** que vence en 10 minutos y tiene reenvío limitado a 1 por minuto.
- Recuperación también por código. El mensaje es el mismo exista o no la cuenta, para no revelar qué correos están registrados.
- `getClaims()` valida la firma del JWT en cada petición del servidor.
- Las redirecciones solo aceptan rutas internas (`safeNextPath`): no hay redirecciones abiertas.
- **Pendiente:** la protección contra contraseñas filtradas (HaveIBeenPwned) requiere un plan de pago de Supabase. Es el único aviso de los asesores.

## Caché y datos locales

- Ninguna lectura de datos familiares usa `"use cache"`. Todo se resuelve por petición (`connection()`).
- Las respuestas que fijan cookies de sesión llevan cabeceras `no-store` (las aplica `@supabase/ssr`).
- El service worker solo guarda recursos públicos de la página de respaldo, nunca páginas autenticadas, RSC ni respuestas de API.
- La copia de consulta usa una proyección mínima autorizada, separada por adulto/dispositivo, identidad y familia, con vencimiento a las 24 horas. Se limpia al cerrar sesión, cambiar de contexto o detectar una revocación; el contenido abierto también desaparece al vencer. Ver [PWA](pwa.md).
- Sin conexión se bloquean las mutaciones. Al reconectar se consulta otra vez al servidor para validar el alcance. Un equipo desconectado no puede recibir una revocación hasta volver a la red.

## Datos de hijos

Solo se pide nombre o alias, color, y opcionalmente iniciales y emoji. No se piden fecha de nacimiento, colegio, documentos ni fotos. Las notas privadas de adultos están en una tabla separada que nunca se proyecta en pantallas.

## Registros

Los errores inesperados se registran solo con un código técnico, sin títulos, notas, tokens ni datos personales. `audit_log` guarda actor, familia, acción, objeto y momento.
