# PWA y consulta sin conexión

## Implementado

- `src/app/manifest.ts`: nombre COFI, modo independiente e iconos PNG de 192/512 px, máscara e icono de inicio de Apple. Los iconos derivan de la casa que ya usa la marca.
- `public/sw.js`: precarga únicamente `offline.html`, `offline.js`, `offline.css` e iconos. No guarda páginas privadas, respuestas RSC, API, cookies ni peticiones a Supabase. Las navegaciones intentan la red y usan la página pública de respaldo si falla.
- El registro se hace con `updateViaCache: "none"`. Una versión nueva espera; el usuario pulsa **Actualizar aplicación** cuando haya guardado sus cambios. No se fuerza una recarga mientras edita.
- El respaldo incluye CSP en el propio HTML, además de la cabecera de Next. Hostinger sirve los archivos públicos directamente y no aplica allí `next.config.js`; la política viaja también en la copia sin conexión.
- `/casa` y `/pantalla` producen una proyección autorizada para consulta: títulos y fechas de eventos, nombres de participantes y títulos/estados de tareas. No incluye notas, descripciones, direcciones, datos de administración ni credenciales. El cuarto de un hijo usa el mismo filtrado de permisos que su vista conectada; un evento visible para toda la familia puede mencionar a otros integrantes.
- La copia se guarda en `localStorage`, con versión, identidad validada, familia, hora de sincronización y vencimiento a las **24 horas**. Adulto y dispositivo tienen claves separadas; no se conserva un archivo de familias anteriores.
- Se limpia al cerrar sesión, cambiar de usuario o familia, detectar una revocación, entrar a vincular o caducar. Una pestaña con contexto anterior oculta sus datos cuando otra pestaña cambia la copia, sin borrar la nueva. Si el almacenamiento está bloqueado o lleno, la app conectada sigue funcionando.
- Sin red, un aviso bloquea envíos y botones de mutación; el enlace **Consultar copia descargada** abre la vista de lectura. Una recarga también abre esa vista. El reloj y la cuenta regresiva siguen en el dispositivo. Al reconectar se vuelve al servidor para comprobar permisos y descargar datos vigentes.
- `/pantalla` tiene activación explícita de Wake Lock desde **Ajustes de mi pantalla** y muestra el resultado real. Libera el bloqueo al desactivarlo/salir y lo vuelve a solicitar al recuperar visibilidad. Cambiar de pestaña dentro del mundo del hijo no lo libera: el proveedor permanece montado. El sistema puede rechazarlo o liberarlo.
- **Noche automática** es opcional por pantalla y usa los límites de silencio de la familia, en su zona horaria. Fuerza oscuro en esa franja y fuera de ella respeta el tema elegido en el equipo. Al salir restaura el tema previo. Los límites iguales desactivan la franja. No se activan sonidos.

El límite de 24 horas se comprueba con la hora del dispositivo. Una pantalla apagada o desconectada conserva lo que ya descargó hasta detectar revocación o vencimiento; la revocación remota no puede borrar físicamente un equipo sin red. No hay cola de escrituras sin conexión.

Al cambiar los archivos públicos del respaldo, incrementar la versión `SHELL` en `sw.js` para instalar la nueva copia sin alterar la que sigue activa mientras el usuario decide actualizar.

## Instalación y actualización

En Chromium/Android se utiliza la opción de instalación del navegador cuando está disponible. En iPhone/iPad se agrega desde **Compartir → Agregar a inicio**. Se requiere HTTPS fuera de localhost para las APIs protegidas. La instalación y el encendido dependen del navegador y del sistema; COFI no impone un kiosco ni arranca automáticamente el equipo.

Referencias: [guía PWA de Next.js](https://nextjs.org/docs/app/guides/progressive-web-apps), [ciclo de vida del service worker](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers) y [Screen Wake Lock](https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API).

## Web Push: pendiente de cerrar

Existe la persistencia SQL de suscripciones y entregas, cron y RPC de reclamación/resultado. El permiso se pide tras pulsar el botón; los fallos de registro o baja se comunican al usuario. El service worker recibe notificaciones genéricas, silenciosas y deduplicadas por identificador, sin detalles privados en la pantalla de bloqueo y con destino interno fijo.

**No hay aún un emisor de servidor implementado ni desplegado.** `NEXT_PUBLIC_VAPID_PUBLIC_KEY` está documentada pero permanece opcional; no se generaron claves ni se guardaron secretos. Con la configuración actual el panel explica que Push está sin configurar y los avisos visuales siguen disponibles.

Antes de activar Push hay que implementar y probar el emisor autenticado, configurar sus secretos en el servidor/Vault y comprobar entregas reales, permisos, revocación/cierre de sesión y cambios de familia. La reclamación debe volver a validar destinatarios, suscripciones y vigencia antes de enviar; las pruebas actuales de SQL cubren la creación y los reintentos, pero no sustituyen esa comprobación. Revisar costos y pedir autorización antes de cualquier recurso o activación que pueda cobrarse. Nunca poner una clave VAPID privada o de servicio en `NEXT_PUBLIC_*`.

## Verificación

Las pruebas de `tests/e2e/05-pwa.spec.ts` cubren instalación declarada, iconos, caché pública, recarga sin conexión, caducidad abierta y limpieza del DOM, texto sin interpretar HTML, cierre de sesión, separación de actores/pestañas, alcance infantil, recuperación de Wake Lock y revocación tras reconectar. Wake Lock está **simulado** en E2E; batería, suspensión, instalación y Push en Android/iOS reales siguen pendientes.

Para comprobar el build de producción sin reiniciar la demostración:

```sh
npm run build
E2E_PORT=3001 E2E_PRODUCTION=1 npx playwright test tests/e2e/05-pwa.spec.ts tests/e2e/06-reminders-automations.spec.ts
```

Las cuentas ficticias deben existir previamente en `.env.test.local`. `npm run e2e` vuelve a sembrar y **borra/recrea** sus familias y todos sus datos asociados; requiere autorización previa del usuario. Las pruebas anteriores no ejecutan esa semilla, aunque crean eventos/reglas y vinculan una pantalla ficticia que luego revocan.
