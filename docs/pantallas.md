# Configurar tablets y celulares como pantallas

## Desde el propio equipo (opción principal)

1. Abre COFI en la tablet o celular.
2. En «Vincular esta pantalla», pulsa **Entrar como adulto y configurar** e inicia sesión. Si ya tienes la cuenta abierta, entra a **Ajustes → Pantallas vinculadas → Configurar este dispositivo como pantalla**.
3. Revisa la familia activa. Puedes cambiarla desde el menú familiar antes de confirmar.
4. Elige **Pantalla familiar** o **Pantalla de un hijo**. En el segundo caso, selecciona al hijo. El nombre sugerido se puede editar.
5. Pulsa **Activar pantalla**. La sesión del adulto se cierra en ese navegador, se limpia su copia local de consulta y se abre `/pantalla` con los permisos elegidos. Las otras pestañas adultas del mismo navegador también abandonan la administración.

Al volver a abrir COFI en ese navegador, aparece la pantalla vinculada. La tuerca abre **Ajustes de mi pantalla**, sin pedir credenciales. Para administrar la familia, usa **Acceso para adultos** dentro de esos ajustes e inicia sesión. Esa sesión temporal conserva el cierre por inactividad.

La vinculación pertenece al navegador y perfil utilizados. Para el celular personal de un adulto, el acceso habitual es **Iniciar sesión**; activar el modo pantalla es una decisión explícita.

## Mediante otro equipo (alternativa por código)

En la pantalla, elige **Vincular mediante código desde otro equipo → Generar código**. Desde otro celular o computadora con sesión adulta, abre **Ajustes → Pantallas vinculadas**, escribe el código, elige alcance y nombre, y pulsa **Vincular pantalla**. El código vence en diez minutos y es de un solo uso. Su tamaño se adapta al ancho del celular.

## Recuperación y permisos

- La pantalla familiar ve la agenda y los pendientes permitidos para ese modo; los datos «solo adultos» conservan sus restricciones. La pantalla infantil ve las tareas, puntos y avisos autorizados para ese hijo.
- Si la vinculación se completó y falla el cierre de sesión, **Terminar activación** reintenta ese cierre sin crear otro vínculo. La preparación se considera terminada al abrir la vista de pantalla.
- Un navegador ya vinculado muestra su configuración y permite **Usar esta pantalla y cerrar sesión adulta**. Este formulario conserva el vínculo existente.
- Una identidad revocada se renueva al configurar otra vez el dispositivo. El registro anterior permanece en el historial. La revocación remota se sigue gestionando desde Pantallas vinculadas.
- Cancelar antes de activar conserva la sesión adulta. Durante la activación, el formulario evita envíos duplicados y oculta la cancelación.

## Implementación y pruebas

### Mundo del hijo y ajustes

La pantalla infantil tiene navegación superior **Inicio / Tareas / Premios / Ajustes**. Inicio reúne reloj, próxima actividad autorizada, progreso, saldo y avisos. Tareas conserva hábitos, rachas, entregas y correcciones; Premios conserva catálogo permitido y pedidos. La vista elegida vive en `/pantalla?vista=inicio|tareas|premios|ajustes`; atrás, adelante y recarga la conservan. Un valor desconocido abre Inicio. La pantalla familiar ofrece Inicio y Ajustes.

En Ajustes, el hijo elige un color y un avatar SVG del catálogo (o sus iniciales). **Guardar apariencia** confirma la escritura real; una actualización en vivo no pisa el borrador. La apariencia se sincroniza entre sus equipos y se ve en la vista previa adulta, sin cambiar el color familiar de agenda. **Usar apariencia familiar** prepara esa elección para guardarla; no modifica tareas, puntos ni permisos.

Tema **Claro / Oscuro / Según el equipo**, encendido y noche automática son locales al equipo. `ScreenPreferencesProvider` mantiene los efectos fuera de las pestañas: navegar no libera Wake Lock. El horario nocturno es el de la familia; fuera de él se recupera el tema elegido. Se conservan las preferencias existentes de encendido/noche.

La migración `20261018235417_child_world_appearance` añade dos campos opcionales a `family_members` y la RPC `save_child_appearance`. El servidor y la RPC validan el vínculo infantil; su destino se deduce de `auth.uid()`. Se bloquea el vínculo frente a revocación y se rechazan perfiles archivados. No se conceden escrituras directas sobre los campos nuevos. El Broadcast de integrantes existente comunica el cambio.

`08_child_appearance.test.sql` cubre permisos y persistencia; `10-child-world.spec.ts` cubre navegación, sincronización entre dos equipos, aislamiento de la hermana, borradores, controles locales, vista previa adulta y tamaños de celular/tablet/escritorio. Las pantallas de prueba se revocan al terminar y se restaura la apariencia previa. No se ejecuta la semilla.

### Vinculación

Se mantienen dos sesiones de Supabase independientes: adulto y `cofi-device`. El cliente prepara la identidad anónima, y la acción del servidor verifica ambas identidades y la familia confirmada. Genera y aprueba un código internamente mediante las RPC existentes; el código no se devuelve a la interfaz ni se registra. El cierre se verifica por separado con el vínculo real del navegador. La vinculación directa no añade tablas, RPC ni políticas RLS. Antes de consultar el estado desde `/vincular` se comprueba que exista sesión de pantalla, evitando consultas 401 en visitas nuevas o recién revocadas.

El acceso adulto realiza una navegación completa después de autenticar para evitar reutilizar una ruta protegida precargada sin sesión. La salida también hace una navegación completa, elimina la copia adulta y notifica a las otras pestañas.

`tests/unit/current-device-setup.test.ts` comprueba autorización, cambio de familia, identidades separadas, idempotencia y cierre condicionado a un vínculo válido. `tests/e2e/07-current-device.spec.ts` cubre ambos modos, login dirigido, cierre, vuelta atrás, otras pestañas, reintento tras un fallo de red, revocación/reactivación y la alternativa por código. Se ejecutan con las cuentas ficticias ya existentes, sin lanzar la semilla.
