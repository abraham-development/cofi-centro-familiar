# Configurar tablets y celulares como pantallas

## Desde el propio equipo (opción principal)

1. Abre COFI en la tablet o celular.
2. En «Vincular esta pantalla», pulsa **Entrar como adulto y configurar** e inicia sesión. Si ya tienes la cuenta abierta, entra a **Ajustes → Pantallas vinculadas → Configurar este dispositivo como pantalla**.
3. Revisa la familia activa. Puedes cambiarla desde el menú familiar antes de confirmar.
4. Elige **Pantalla familiar** o **Pantalla de un hijo**. En el segundo caso, selecciona al hijo. El nombre sugerido se puede editar.
5. Pulsa **Activar pantalla**. La sesión del adulto se cierra en ese navegador, se limpia su copia local de consulta y se abre `/pantalla` con los permisos elegidos. Las otras pestañas adultas del mismo navegador también abandonan la administración.

Al volver a abrir COFI en ese navegador, aparece la pantalla vinculada. Para administrar, usa **Administrar** e inicia sesión como adulto. En una pantalla vinculada, esa sesión temporal también dispone del cierre por inactividad ya existente.

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

Se mantienen dos sesiones de Supabase independientes: adulto y `cofi-device`. El cliente prepara la identidad anónima, y la acción del servidor verifica ambas identidades y la familia confirmada. Genera y aprueba un código internamente mediante las RPC existentes; el código no se devuelve a la interfaz ni se registra. El cierre se verifica por separado con el vínculo real del navegador. No se añaden tablas, RPC ni políticas RLS.

El acceso adulto realiza una navegación completa después de autenticar para evitar reutilizar una ruta protegida precargada sin sesión. La salida también hace una navegación completa, elimina la copia adulta y notifica a las otras pestañas.

`tests/unit/current-device-setup.test.ts` comprueba autorización, cambio de familia, identidades separadas, idempotencia y cierre condicionado a un vínculo válido. `tests/e2e/07-current-device.spec.ts` cubre ambos modos, login dirigido, cierre, vuelta atrás, otras pestañas, reintento tras un fallo de red, revocación/reactivación y la alternativa por código. Se ejecutan con las cuentas ficticias ya existentes, sin lanzar la semilla.
