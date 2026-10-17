# Prompt maestro: Centro de Organización Familiar Inteligente

**Documento preparado:** 17 de octubre de 2026.  
**Idioma del producto y de la comunicación:** español.  
**Decisión tecnológica confirmada:** Next.js con App Router + TypeScript + Supabase.  
**Objetivo inmediato:** construir una aplicación familiar funcional con entrada manual de información.  
**Decisión confirmada sobre IA:** incorporar primero interpretación de texto y después voz, cuando el núcleo funcione.

> Entrega este documento completo al agente que construirá el proyecto. El texto está escrito como instrucciones de trabajo para ese agente. Las funciones futuras se documentan para conservar la visión, pero no autorizan a adelantarse a su fase ni a exigir credenciales de IA para iniciar.

---

## 1. Tu misión y forma de trabajar

Actúa como desarrollador full stack y arquitecto responsable de implementar un **Centro de Organización Familiar Inteligente**, pensado como el centro operativo de la casa. Construye una aplicación real, mantenible y comprobable. El usuario está aprendiendo desarrollo de software: explica las decisiones importantes con claridad y documenta cómo ejecutar y continuar el proyecto.

Lee este documento completo antes de implementar. Inspecciona primero el repositorio y sus instrucciones, si existen. Reutiliza componentes y convenciones sanas del proyecto; no sobrescribas trabajo ajeno ni reinicies un proyecto existente sin necesidad.

Tu trabajo debe producir código, persistencia real, permisos y flujos completos. Una maqueta con botones sin acción, datos exclusivamente en memoria o pantallas bonitas sin guardar cambios no satisface el encargo.

Trabaja por hitos verticales: interfaz, lógica, base de datos, seguridad y verificación de una función antes de ampliar el alcance. Comunica avances breves, decisiones, bloqueos concretos y pruebas realizadas. No te detengas solamente en un plan si puedes implementar con el entorno disponible.

Resuelve decisiones rutinarias usando los valores predeterminados de este documento. Pregunta únicamente por información imprescindible que no puedas inferir. Si faltan servicios o credenciales, avanza con el entorno local y deja identificado qué falta para validar la integración real. No presentes una simulación como conexión comprobada.

## 2. Visión del producto

Cada familia dispone de un espacio privado, llamado provisionalmente **Mundo Familiar**. Allí conviven tres pilares:

1. **Organización y agenda familiar:** calendario compartido, línea del día, próximos siete días, citas, reuniones, visitas, vencimientos y pendientes domésticos.
2. **Responsabilidades y gamificación:** tareas y hábitos de los hijos, seguimiento de cumplimiento y atrasos, puntos y recompensas configuradas por los adultos.
3. **Captura rápida con IA:** en una fase posterior, introducir frases escritas y luego dictadas para convertirlas en eventos, tareas y recordatorios.

Los problemas centrales que debe resolver son la pérdida de noción de la hora y el olvido de fechas o pendientes. La familia debe comprender qué hora es, qué viene después y qué corresponde hacer sin depender de recordatorios verbales constantes de los padres.

Habrá pantallas encendidas en cocina, zonas comunes y cuartos, además de acceso desde los celulares de los padres. La información relevante debe comprenderse desde aproximadamente dos metros en las pantallas domésticas.

## 3. Decisiones confirmadas y valores propuestos

### 3.1 Decisiones confirmadas por el usuario

- Aplicación web adaptable a pantallas grandes, tablets y celulares.
- Next.js con **App Router**, React y TypeScript.
- Supabase para PostgreSQL, autenticación y sincronización.
- Aplicación funcional antes de integrar voz con IA.
- Agenda, organización del hogar y responsabilidades de los hijos conectadas entre sí.
- Información en tiempo real entre las pantallas conectadas.
- Diseño ultravisual con reloj contextual y colores por integrante.

### 3.2 Valores predeterminados propuestos para poder comenzar

Estos valores son decisiones de implementación reversibles; no los presentes como preferencias expresadas por el usuario:

| Tema | Valor inicial |
| --- | --- |
| Nombre visible | Centro Familiar, modificable |
| Idioma y formato regional | `es-PE` |
| Zona horaria familiar inicial | `America/Lima`, configurable por familia |
| Hora visible | Formato de 12 horas con AM/PM; permitir 24 horas en ajustes |
| Despliegue previsto | Vercel para Next.js y Supabase administrado |
| Interfaz | Tailwind CSS y componentes accesibles de shadcn/ui |
| Validación | Zod compartido entre contratos y formularios cuando corresponda |
| Formularios | React Hook Form si facilita la implementación |
| Gestión inicial de datos | SDK oficial de Supabase y migraciones SQL; un único camino coherente de acceso |
| Puntos de tareas infantiles | Configurables; sugerencia inicial de 10 por tarea, visible al crearla |
| Validación de tareas infantiles | Aprobación de adulto activada por defecto; configurable por plantilla |
| Penalizaciones por atraso | Desactivadas; mostrar seguimiento sin descontar puntos automáticamente |
| Tema visual | Claro, limpio, contrastado y cómodo para uso prolongado; modo nocturno configurable |
| IA y micrófono en la primera versión | Funciones desactivadas; no mostrar acciones que simulen una capacidad inexistente |

Usa versiones estables y compatibles de las dependencias al iniciar. Verifica la documentación oficial actual, fija las versiones instaladas mediante el archivo de bloqueo y registra los requisitos del entorno. No elijas versiones canary ni inventes números de versión.

## 4. Alcance y fases obligatorias

### Fase 1: organización familiar manual funcional

Implementa registro e inicio de sesión de adultos, creación de familia, integrantes, colores, agenda manual, vista de hoy, próximos siete días, reloj contextual y pendientes domésticos. Incluye desde esta fase aislamiento entre familias y persistencia real.

### Fase 2: responsabilidades, dispositivos y avisos

Añade tareas recurrentes, hábitos, pantallas de hijos, aprobación, puntos, recompensas, emparejamiento de dispositivos, Realtime, recordatorios persistentes y reglas domésticas deterministas. Completa la experiencia PWA, reconexión y consulta limitada sin conexión.

La salida de las fases 1 y 2 es la **primera versión funcional sin IA**. Debe poder usarse en una casa real.

### Fase 3: interpretación mediante texto con IA, posterior

Cuando se compruebe el núcleo, permite escribir frases naturales que produzcan borradores de eventos y tareas. Evalúa fechas, participantes, ambigüedades y confirmación antes de añadir audio.

### Fase 4: captura por voz con IA, posterior

Añade micrófono, transcripción, interpretación existente y confirmación visual; respuesta hablada breve como opción. El proveedor y los modelos se elegirán en esa fase con pruebas de español, latencia, privacidad y costo.

**No implementes las fases 3 y 4 como requisito para terminar las fases 1 y 2. No exijas una API key de IA para iniciar, ejecutar, probar o desplegar la versión manual.** Una prueba temprana y pequeña de compatibilidad del micrófono es opcional y no debe retrasar el núcleo.

No hace falta terminar estadísticas avanzadas, todos los premios o todos los detalles estéticos para comenzar posteriormente la fase 3. El umbral mínimo es crear manualmente un evento o tarea, verlo en otra pantalla y comprobar su recordatorio.

## 5. Arquitectura de aplicación

Usa un **monolito modular**: un solo proyecto y repositorio con módulos de negocio separados. La interfaz, las operaciones del servidor y los procesos programados deben compartir contratos y reglas donde sea razonable.

| Capa | Responsabilidad |
| --- | --- |
| Presentación | Pantallas, navegación, formularios y estados de carga/error |
| Aplicación | Casos de uso: crear evento, aprobar tarea, solicitar premio, etc. |
| Dominio | Reglas de fechas, recurrencias, permisos, puntos y transiciones de estado |
| Persistencia | Consultas y funciones transaccionales de PostgreSQL/Supabase |
| Integraciones | Auth, Realtime, Storage, notificaciones y futura IA |
| Procesos de fondo | Materializar recurrencias, procesar avisos y recuperar trabajos fallidos |

### 5.1 Next.js App Router

- Server Components para carga inicial y partes adecuadas de la interfaz.
- Client Components para reloj, cuentas regresivas, interacción, suscripciones y APIs del navegador.
- Server Actions para mutaciones ligadas a formularios cuando resulte apropiado.
- Route Handlers para endpoints HTTP explícitos, emparejamiento, notificaciones y futuras capturas de voz.
- Server Actions y Route Handlers llaman a los mismos casos de uso; evita reglas duplicadas.
- Las comprobaciones en layouts o en la navegación no sustituyen autorización en cada operación.
- Controla la caché de datos privados por usuario/familia. No compartas resultados de una familia con otra mediante cachés globales.
- Maneja errores, carga, acceso denegado y recursos inexistentes con interfaces útiles.
- Evita marcar toda la aplicación como cliente por comodidad.

### 5.2 Supabase

- PostgreSQL como fuente de verdad.
- Supabase Auth para identidades y sesiones.
- Cliente de servidor y navegador según las guías actuales de SSR; utiliza el paquete oficial vigente para gestionar cookies y refresco de sesión.
- Verifica la identidad con el método de validación recomendado actualmente por Supabase. No autorices acciones usando únicamente una sesión leída sin validar.
- RLS y privilegios mínimos en las tablas expuestas.
- Realtime para comunicar cambios; no como única copia de información importante.
- Storage privado solo cuando una función necesite archivos; en el primer hito bastan iniciales y avatares simples.
- Supabase Cron y SQL/Edge Functions para trabajos cortos de recordatorios y recurrencias. No añadas Trigger.dev, Redis, un backend independiente u otro proveedor sin una necesidad demostrada.
- Mantén los procesos de fondo reintentables y observables aunque al principio sean pequeños.

### 5.3 Organización sugerida del código

| Directorio o zona | Contenido |
| --- | --- |
| `src/app` | Rutas, layouts y adaptadores de Next.js |
| `src/features/families` | Integrantes, invitaciones y permisos |
| `src/features/calendar` | Eventos, participantes y recurrencias |
| `src/features/tasks` | Tareas, hábitos, ocurrencias y revisión |
| `src/features/rewards` | Puntos y canjes |
| `src/features/notifications` | Reglas, avisos y entregas |
| `src/features/devices` | Emparejamiento, perfiles de pantalla y revocación |
| `src/components` | Componentes visuales reutilizables |
| `src/lib` | Clientes, contratos, validadores y utilidades transversales pequeñas |
| `supabase/migrations` | Evolución reproducible de la base de datos |
| `supabase/functions` | Funciones de servidor de Supabase cuando correspondan |
| `supabase/tests` | Pruebas de permisos e integridad en base de datos |
| `tests` | Pruebas de dominio, integración y flujos críticos |
| `docs` | Arquitectura, decisiones, fases, operación y continuidad |

Puedes ajustar esta estructura si el repositorio ya tiene una equivalente. Evita crear un sistema de abstracciones genéricas más grande que el producto.

## 6. Identidades, familias y dispositivos

### 6.1 Separar persona familiar de identidad de acceso

Un integrante de la familia no tiene que ser necesariamente una cuenta de Auth. Un niño puede ser un perfil administrado por adultos sin correo ni contraseña. No obligues a crear cuentas de correo a los hijos.

Modela por separado:

- Familia.
- Integrante de la familia: nombre visible, color, avatar/iniciales y tipo de integrante.
- Identidad de adulto que inicia sesión y su pertenencia/rol en la familia.
- Dispositivo vinculado con alcance de pantalla común o de un hijo concreto.

No uses un único usuario con una contraseña compartida por todas las pantallas. Un PIN local puede facilitar el cambio de modo, pero no concede por sí solo permisos de adulto.

### 6.2 Roles y permisos

| Actor | Acciones permitidas |
| --- | --- |
| Adulto propietario | Gestionar su familia, otros adultos, dispositivos y todos los módulos; operaciones sensibles con verificación apropiada |
| Adulto administrador | Gestionar agenda, tareas, premios y dispositivos de la familia según permisos; no apropiarse de otra familia |
| Perfil infantil mediante dispositivo vinculado | Ver sus tareas, hábitos, puntos, premios permitidos y avisos familiares autorizados; marcar entregas y solicitar canjes |
| Pantalla común vinculada | Ver la información familiar autorizada para esa pantalla y registrar acciones expresamente habilitadas |
| Visitante sin sesión | Ver únicamente acceso, registro, información pública mínima y flujo de vinculación sin datos familiares |

Todo dato debe filtrarse por pertenencia, rol y visibilidad. Cambiar una URL o enviar otro identificador no debe ampliar permisos.

### 6.3 Registro e incorporación de adultos

- Registro e inicio de sesión por correo y contraseña con Supabase Auth.
- Recuperación de contraseña y cierre de sesión.
- Alta de familia y primer adulto propietario mediante una operación consistente.
- Invitación de otro adulto mediante enlace de un solo uso, con expiración y comprobación de destinatario/identidad.
- Los tokens de invitación no deben quedar almacenados en texto claro ni aparecer en logs.
- Para desarrollo, utiliza las herramientas locales de correo; para producción documenta la configuración real necesaria.
- No permitas dejar una familia sin ningún propietario activo.
- Modela la pertenencia para admitir que un adulto pertenezca a más de una familia, aunque la interfaz inicial priorice una familia activa.

### 6.4 Vinculación de pantallas y cuartos

Implementa un flujo seguro:

1. El dispositivo abre la pantalla de vinculación y solicita un código temporal.
2. Un adulto autenticado revisa y aprueba ese código desde su administración.
3. El adulto elige familia, nombre del dispositivo, modo y alcance; por ejemplo, cocina o cuarto de Mateo.
4. El dispositivo recibe una sesión identificable y revocable, nunca credenciales de adulto.
5. Cada nueva lectura o escritura comprueba que el vínculo siga activo.

La propuesta inicial es usar una identidad anónima de Supabase Auth para el dispositivo y un registro de autorización aprobado por el adulto. Verifica la guía actual antes de implementarlo. Una identidad anónima de Auth puede usar el rol PostgreSQL `authenticated`: ese rol por sí solo no autoriza acceso familiar.

Los códigos expiran, son de un solo uso y tienen protección frente a intentos repetidos. Un QR puede transportar una solicitud temporal; no una llave permanente de acceso.

Permite listar, renombrar y revocar dispositivos. La revocación debe bloquear nuevas operaciones y nuevas lecturas; los canales activos deben dejar de entregar contenido protegido. Al detectar revocación, limpia el estado y la caché local. Documenta que no se puede borrar remotamente información ya descargada por un dispositivo que permanece sin conexión.

## 7. Experiencia visual común

### 7.1 Reloj contextual

En las pantallas autenticadas debe existir una cabecera clara con:

- Hora actual grande y legible.
- Día de la semana y fecha actual calculados dinámicamente.
- Próximo evento autorizado y cuenta regresiva legible.
- Indicación de actividad en curso, cuando corresponda.
- Estado de conexión y última actualización cuando haya problemas.

Ejemplo de contenido, no texto fijo: **Jueves 22 de octubre — 10:30 AM · En 1 h 30 min: visita en casa**.

Reglas:

- Obtener una referencia de hora del servidor y actualizar el reloj localmente.
- No enviar tráfico al servidor cada segundo para mover el reloj.
- Recalcular al volver de suspensión, recuperar conexión o cambiar el día.
- Manejar correctamente un evento que empieza ahora, uno en curso y uno cancelado.
- Si no hay eventos próximos, mostrar un estado útil como “Sin eventos próximos”.
- La cabecera de un hijo solo muestra eventos que tiene permiso de ver.
- Evitar errores de hidratación por diferencias de hora o zona entre servidor y navegador.
- En celular, mantener la información esencial sin consumir toda la pantalla.

### 7.2 Colores e identificación

Cada integrante tiene color propio y todos los elementos incluyen nombre o iniciales; el color no es la única señal. Valores de demostración:

- Mamá: morado.
- Papá: azul.
- Hijo 1: verde.
- Hijo 2: naranja.
- Toda la casa: amarillo con texto oscuro y contraste suficiente.

Los colores son editables y no asignan tareas según género. Diferencia categoría mediante icono, etiqueta o borde: visita, colegio, salud, hogar, trabajo u otra categoría configurable. Para varios participantes muestra avatares/etiquetas sin convertir el bloque en una mezcla ilegible de colores.

### 7.3 Calidad visual y accesibilidad

- Tipografía grande, jerarquía clara, pocos elementos compitiendo y espacios amplios.
- Componentes legibles desde unos dos metros en el modo casa.
- Pantallas útiles en orientación horizontal y vertical.
- Botones táctiles de al menos unos 44 × 44 píxeles como referencia de diseño.
- Contraste adecuado, foco visible, etiquetas accesibles y navegación por teclado.
- Respeto por movimiento reducido; evita animaciones continuas y sonidos invasivos.
- Diseño infantil amable y apropiado sin tratar a los adultos como jugadores.
- Estados de carga, vacío, error, sin conexión, guardado y conflicto.
- Las confirmaciones importantes permanecen el tiempo necesario y no dependen solo de un aviso fugaz.
- Ninguna acción destructiva importante debe activarse por un toque accidental.
- Oculta opciones avanzadas en el modo de pantalla doméstica; la administración vive en su propia zona.

## 8. Pantalla principal de casa y cocina

Debe priorizar simultáneamente estos bloques:

1. **Reloj contextual y próximo evento.**
2. **Hoy paso a paso:** línea del día agrupada en mañana, tarde y noche.
3. **Radar de los próximos siete días:** eventos y fechas importantes con día, hora y participantes.
4. **Pendientes de la casa:** checklist operativo sin puntos.
5. **Avisos destacados:** preparativos, cambios y recordatorios que requieren atención.
6. **Resumen de hijos:** progreso de tareas con acceso al detalle permitido.

La vista mensual es secundaria. La pantalla inicial no debe quedar dominada por una cuadrícula mensual pequeña.

Propón inicialmente mañana antes de las 12:00, tarde de 12:00 a 19:00 y noche desde las 19:00, como agrupación visual configurable. Un evento que cruza medianoche debe seguir siendo comprensible y pertenecer a las fechas correctas.

En el radar semanal, resume cuando haya muchos eventos y permite abrir el detalle. La agenda completa no debe perder eventos porque la pantalla de resumen tenga espacio limitado.

Un adulto puede agregar manualmente un evento o pendiente mediante un formulario corto. En una pantalla común de acceso limitado, abrir la administración debe requerir una sesión de adulto válida.

En la primera versión, el botón de micrófono no debe simular escucha. Puedes reservar su espacio en el diseño o mostrar una indicación discreta de función futura, sin bloquear los formularios manuales.

## 9. Agenda y eventos

### 9.1 Información de un evento

- Título obligatorio.
- Categoría.
- Fecha y hora de inicio, o indicador de día completo.
- Fecha/hora final opcional, o duración visible y editable si se propone una predeterminada.
- Zona horaria efectiva, normalmente la de la familia.
- Participantes: uno, varios o toda la casa.
- Lugar y notas opcionales.
- Visibilidad: familia, participantes o solo adultos.
- Importancia para el radar semanal.
- Recordatorios asociados.
- Recurrencia cuando corresponda.
- Autor, fecha de creación, actualización y versión para detectar cambios concurrentes.
- Estado, como programado o cancelado.

### 9.2 Operaciones

- Crear, consultar, editar y cancelar eventos.
- Filtrar por integrante, categoría y rango de fechas.
- Vista del día, próximos siete días y calendario completo secundario.
- Edición que actualiza correctamente sus avisos y tareas vinculadas.
- Confirmación de cancelación y registro del cambio cuando afecte a otras personas.
- Advertencia informativa de posibles solapamientos; no prohibirlos automáticamente, pues dos integrantes pueden tener actividades simultáneas.
- Manejo de visibilidad real en servidor y base de datos, también para búsquedas y Realtime.

Incluye visitas, reuniones de padres, trabajo, citas médicas, actividades escolares, exámenes, vencimientos de recibos y llegada de técnicos. Son categorías de organización; no construyas una historia clínica ni pidas datos médicos innecesarios.

### 9.3 Fechas y recurrencias

- Guardar instantes con tipos adecuados, por ejemplo `timestamptz`, y conservar la zona IANA necesaria para interpretar recurrencias.
- Guardar fechas de día completo como fechas, con fin exclusivo si se usa un rango. No convertirlas ingenuamente a medianoche UTC.
- Los hábitos diarios y eventos semanales se definen por hora local y zona familiar; no mediante sumar siempre 24 horas UTC.
- Usar una biblioteca mantenida para las conversiones que `Intl` no resuelva; documentar la elección y comprobar sus casos límite.
- Para comenzar, admitir repeticiones diarias, días de semana, semanal por días y mensual con una política explícita para fechas inexistentes. No cambiar silenciosamente el 31 de febrero por otra fecha.
- Distinguir plantilla/serie y ocurrencia concreta. Editar una ocurrencia no debe alterar accidentalmente todas las demás.
- Ofrecer edición de esta ocurrencia o de las futuras cuando la recurrencia esté implementada.
- Materializar un horizonte acotado y ampliarlo periódicamente; no crear infinitas filas.
- Evitar duplicados mediante restricciones únicas por serie/plantilla y fecha de ocurrencia.
- Conservar excepciones y cancelaciones para que el generador no las resucite.

## 10. Pendientes domésticos de adultos

Construye una checklist operativa separada visualmente de las responsabilidades infantiles. Puede compartir componentes o infraestructura de tareas, pero conserva sus reglas propias.

Ejemplos: descongelar el pollo a las 10:00 AM, comprar gas, pagar un recibo y llamar al pediatra.

Cada pendiente admite título, responsable opcional, fecha/hora límite opcional, prioridad, notas, visibilidad y estado. Permite completar y reabrir, con registro de autor y momento. No entrega puntos ni genera penalizaciones de juego.

Los pendientes sin hora aparecen como pendientes del día, sin inventarles una cita con hora fija. Si vencen, siguen visibles según el filtro y muestran su atraso. Un recordatorio doméstico y una cita con hora fija no deben quedar confundidos como el mismo concepto en la interfaz.

Permite tareas de toda la casa. Si una tarea infantil se asigna a varios hijos y cada uno debe cumplirla, crea una ocurrencia por hijo; no una única casilla que el primero completa por todos.

## 11. Tareas, hábitos y seguimiento infantil

### 11.1 Plantillas y ocurrencias

Una plantilla define nombre, descripción breve, tipo, destinatario(s), recurrencia, hora límite local opcional, puntos y necesidad de revisión. Una ocurrencia representa lo que un hijo debe hacer en una fecha concreta.

Ejemplos: tender la cama, cepillarse los dientes, preparar la mochila, terminar deberes, ordenar el cuarto y alistar uniforme deportivo.

Los hábitos usan la misma infraestructura de recurrencias cuando sea razonable, diferenciándose por su propósito y forma de mostrar progreso. No construyas dos motores de repetición equivalentes.

### 11.2 Estados y transiciones

Define una máquina de estados explícita. Como propuesta inicial:

| Estado | Significado |
| --- | --- |
| Pendiente | Aún no entregada |
| En revisión | El hijo indicó que terminó y falta aprobación |
| Aprobada | Cumplida y validada; genera puntos si corresponde |
| Requiere corrección | El adulto solicita volver a realizarla o corregirla |
| Cancelada/exenta | La familia decidió que esa ocurrencia no aplica |

Si una plantilla no requiere revisión, la entrega válida pasa a cumplida con la autorización y reglas del servidor correspondientes. Un cambio de nombre visual de estado no debe alterar su significado.

Permite al adulto aprobar, solicitar corrección, eximir y corregir un registro con motivo. Los hijos no se asignan puntos, no aprueban su propia tarea cuando requiere revisión y no alteran fechas límite, recompensas o configuración familiar.

### 11.3 Atrasos

- Determina el vencimiento con hora del servidor y zona familiar.
- Guarda por separado el momento de entrega del hijo y el de aprobación del adulto.
- Evalúa puntualidad por el momento de entrega válido, no por cuánto demoró el padre en aprobar.
- Conserva historial de correcciones para evitar falsear cuándo se cumplió.
- Diferencia “pendiente vencida”, “entregada tarde” y “en revisión entregada a tiempo”.
- No conviertas un atraso en un bloqueo irreversible: debe poder completarse después.
- Muestra un resumen comprensible de cumplimiento y atrasos de los últimos días, sin rankings públicos humillantes ni castigos automáticos.
- Las exenciones no cuentan como incumplimiento. Define y documenta si interrumpen o pausan una racha.

### 11.4 Pantalla del hijo

Debe incluir nombre/avatar, reloj, siguiente actividad autorizada, tareas de hoy ordenadas, progreso diario, hábitos, avisos escolares/familiares relevantes, puntos y acceso a premios permitidos.

Las tareas muestran una acción clara, hora límite si existe y estado. Confirmar una entrega no debe desaparecer silenciosamente: el hijo debe comprender si quedó aprobada o esperando revisión.

Los avisos de una visita o examen deben destacarse sobre decoración. La información privada de los adultos no aparece por compartir una familia.

## 12. Puntos y recompensas

### 12.1 Registro de puntos

- Usa un libro de movimientos de puntos: créditos, débitos y ajustes justificados.
- Conserva el origen de cada movimiento: ocurrencia de tarea, aprobación de canje o ajuste del adulto.
- El saldo se deriva del libro o se mantiene como proyección consistente, nunca como número editable por el navegador.
- Una misma ocurrencia no puede entregar puntos dos veces, aunque haya doble toque, dos pantallas o reintento de red.
- Aprobar tarea y registrar su crédito debe ser una operación atómica.
- Los ajustes del adulto registran autor y motivo; no sustituyen silenciosamente el historial.
- Guarda la cantidad efectiva aplicada a cada ocurrencia para que cambiar una plantilla no reescriba premios históricos.
- Evita saldos negativos por canjes concurrentes.
- La versión inicial no descuenta puntos automáticamente por atrasos.

### 12.2 Catálogo y canjes

Los adultos crean premios con nombre, descripción, costo en puntos, disponibilidad, destinatarios y condiciones opcionales. Ejemplos ficticios: elegir película familiar, escoger postre o tiempo de una actividad acordada.

Un hijo puede solicitar un premio disponible. Un adulto aprueba, rechaza o marca su entrega. Define estados coherentes: solicitado, aprobado, entregado, rechazado y cancelado.

Por defecto, descuenta puntos al aprobar el canje, con verificación atómica del saldo en ese momento. Una solicitud pendiente no garantiza que el saldo siga siendo suficiente después. Evita descuentos repetidos y reembolsos duplicados. Si se cancela un canje ya debitado, registra un movimiento compensatorio conforme a la regla documentada.

Los puntos son internos a la familia, sin valor monetario. No implementes compras, pagos ni control remoto de otros equipos como parte de los premios.

## 13. Conexión entre agenda, hogar y pantallas infantiles

Implementa primero reglas deterministas configuradas por adultos, sin IA.

### 13.1 Visitas y preparativos

Cuando un adulto crea una visita importante, puede activar una regla que:

- Genere un aviso la noche anterior.
- Genere un aviso en la mañana del día de la visita.
- Cree tareas de preparación para integrantes seleccionados.
- Establezca una fecha/hora límite anterior al inicio de la visita.
- Muestre una cuenta regresiva y una misión en las pantallas autorizadas.

Ejemplo: visita el jueves a las 5:00 PM; aviso el miércoles por la noche y tareas de ordenar sala/cuarto antes de las 4:00 PM del jueves.

### 13.2 Colegio y materiales

Un evento escolar puede incluir instrucciones de preparación y destinatarios. Ejemplo: examen el viernes a las 8:00 AM y llevar uniforme de deporte. La información aparece el jueves por la noche y el viernes temprano en las pantallas de los hijos involucrados.

### 13.3 Reglas de integridad

- Las reglas tienen dueño familiar, configuración, estado habilitado y destinatarios explícitos.
- No generes obligaciones infantiles por cualquier cita sin que un adulto haya configurado o aceptado la regla.
- Relaciona cada tarea/aviso generado con su evento y regla de origen.
- Evita duplicados al guardar, editar o ejecutar varias veces el generador.
- Si se reprograma o cancela el evento, actualiza o cancela los pendientes futuros vinculados.
- No borres silenciosamente tareas ya realizadas ni movimientos de puntos. Aplica una regla documentada y presenta los cambios relevantes.
- Si una tarea vinculada fue modificada manualmente, detecta la excepción y conserva o solicita resolver ese ajuste; no lo sobrescribas sin aviso.
- Las reglas de hora se calculan en zona familiar; convertir luego los instantes de ejecución.

## 14. Recordatorios y notificaciones

### 14.1 Responsabilidades separadas

1. **Persistencia:** el aviso pendiente queda guardado en base de datos.
2. **Programación:** un proceso de servidor identifica cuándo corresponde ejecutarlo.
3. **Entrega:** se crea la notificación interna y, si está habilitado, se intenta el canal externo.
4. **Presentación:** la pantalla decide cómo destacar el aviso autorizado.

Realtime mantiene actualizadas las pantallas abiertas. Web Push sirve para intentar avisar aunque la aplicación no esté al frente, cuando el navegador, sistema y permisos lo permitan. El proceso programado del servidor funciona aunque no haya una pantalla abierta.

### 14.2 Diseño de trabajos

- Crear/modificar el evento o tarea y registrar sus trabajos pendientes dentro de una misma transacción o con una estrategia de outbox equivalente.
- Propuesta inicial: una tabla de avisos pendientes y un trabajo de Supabase Cron que la revise por lotes; no crear un cron independiente por cada evento.
- Seleccionar trabajos vencidos y no procesados mediante reclamación atómica, bloqueo apropiado y vencimiento de la reclamación si el proceso se interrumpe.
- Registrar estados como pendiente, reclamado, completado, reintento, cancelado y fallido final.
- Conservar intentos, próximo intento, error normalizado y versión de origen.
- Aplicar reintentos con espera progresiva y límites; no ciclos infinitos inmediatos.
- Verificar que el evento siga vigente y que la versión programada siga siendo válida antes de entregar.
- Definir una ventana de relevancia: recuperar avisos útiles tras una caída y descartar los que ya no sirven, conservando trazabilidad.
- Utilizar claves únicas por ocurrencia, regla, destinatario y canal.
- Separar el estado de la notificación interna del resultado de cada entrega Push.
- Deduplicar también en el cliente. La ejecución reintentable no equivale a una garantía universal de entrega externa exactamente una vez.
- Autenticar el endpoint que ejecuta trabajos con el mecanismo oficial vigente. Ningún visitante puede disparar trabajos administrativos libremente.
- Guardar secretos del proceso de forma segura, por ejemplo mediante los mecanismos admitidos por Supabase/Vault; nunca enviarlos al navegador.
- Programar y documentar la conversión entre la zona familiar y el horario usado por Cron.

### 14.3 Preferencias y experiencia

- Permitir horarios silenciosos, canales y anticipación configurables por familia/dispositivo.
- Avisos visuales internos disponibles aunque el usuario no conceda permiso Push.
- Pedir permiso de notificaciones tras una acción explicativa, no al cargar una página sin contexto.
- Sonidos opcionales con activación explícita y respetando las restricciones de reproducción del navegador.
- Historial con leído/no leído o reconocido, y vencimiento cuando corresponda.
- En pantallas comunes, distinguir reconocimiento de una pantalla de confirmación de cada destinatario.
- Si falla un envío Push, no marcarlo como recibido; mostrar el estado técnico real donde resulte útil al administrador.
- No prometer alarmas exactas con el navegador cerrado ni entrega garantizada en un teléfono apagado.
- La puntualidad visual de una pantalla activa puede calcularse localmente con datos precargados; no debe depender solo del siguiente ciclo de Cron.

## 15. Tiempo real y múltiples pantallas

- Suscripciones privadas con autorización por familia y alcance del dispositivo.
- Usa Broadcast privado conforme a la guía actual de Supabase si encaja; Postgres Changes puede servir inicialmente si se documentan sus límites y se mantiene la autorización correcta.
- Transmite la mínima información de invalidación necesaria, por ejemplo tipo, identificador y versión; vuelve a consultar el contenido protegido con permisos vigentes.
- No difundas notas privadas o información de adultos a un canal general que también consumen niños.
- Publica después de que la transacción se confirme. Para evitar perder cambios entre persistencia y difusión, combina publicación fiable cuando sea posible con relectura al reconectar y reconciliación acotada.
- Recupera conexión con espera progresiva y evita crear suscripciones duplicadas al navegar.
- Relee al reconectar, volver a primer plano, renovar sesión o cambiar familia.
- Limpia suscripciones y datos de la familia anterior al cambiar de contexto.
- Usa versiones o marcas de actualización para descartar respuestas antiguas que llegan después de una nueva.
- Los mensajes perdidos no deben implicar pérdida del evento: PostgreSQL conserva la fuente de verdad.
- Las actualizaciones optimistas deben poder revertirse si el servidor rechaza la operación.
- Ante edición concurrente relevante, detecta el conflicto en vez de sobrescribir silenciosamente.
- Como objetivo medible inicial, los cambios deben aparecer en otra pantalla activa en unos pocos segundos bajo una conexión de prueba normal. Registra la medición; no prometas una latencia universal.

## 16. PWA y funcionamiento doméstico

### 16.1 Instalación y modo pantalla

- Manifest, iconos coherentes, nombre y modo instalable.
- HTTPS en los entornos donde lo requieren las APIs del navegador.
- Service worker con política de actualización comprensible y shell de aplicación apropiado.
- Modo de pantalla con navegación mínima, controles táctiles y salida segura.
- Botón para mantener pantalla encendida mediante Screen Wake Lock cuando esté disponible y el sistema lo permita.
- Reintentar Wake Lock al recuperar visibilidad cuando proceda, con estado y opción de desactivarlo.
- Tema y silencio nocturnos configurables; no asumir que las pantallas deben iluminar o sonar toda la madrugada.
- Documentar requisitos reales de Android/iOS y que instalación, Push, audio, pantalla completa y encendido permanente dependen del dispositivo.
- No afirmar que una web puede imponer un kiosco invulnerable, arrancar automáticamente cualquier equipo o impedir todas las salidas del navegador.

### 16.2 Sin conexión en la primera versión

- Permitir consultar una instantánea previamente descargada de la información autorizada del día y del radar semanal.
- Guardarla explícitamente por identidad, dispositivo y familia, con caducidad razonable y última sincronización visible. Propuesta inicial: máximo 24 horas, ajustable si se justifica.
- Guardar solo los campos necesarios para la pantalla, no datos privados de administración, tokens o audios.
- No usar una caché indiscriminada del service worker para respuestas autenticadas.
- Mantener reloj y cuentas regresivas locales, indicando que los datos podrían haber cambiado.
- Deshabilitar mutaciones sin conexión en la primera versión y explicar cómo reintentarlas cuando regrese la red.
- La cola de cambios offline con resolución de conflictos es una ampliación posterior, no un requisito oculto del primer hito.
- Limpiar la instantánea en cierre de sesión, cambio de familia, desvinculación detectada y expiración.
- Al reconectar, reemplazar o reconciliar con la fuente de verdad y volver a comprobar permisos.

## 17. Modelo de datos de referencia

Diseña el esquema con migraciones reproducibles. Los nombres siguientes son una propuesta concreta; puedes simplificar tablas equivalentes si conservas las reglas y explicas el cambio.

| Entidad propuesta | Contenido o responsabilidad |
| --- | --- |
| `families` | Nombre, zona horaria, ajustes y propietario lógico |
| `family_members` | Personas familiares, tipo, color, nombre visible y estado activo/archivado |
| `adult_memberships` | Relación de `auth.users` con familia, integrante y rol adulto autorizado |
| `family_invitations` | Destinatario, token protegido, expiración y aceptación |
| `device_pairing_requests` | Identidad solicitante, código protegido, expiración y aprobación |
| `paired_devices` | Identidad de dispositivo, familia, alcance, hijo opcional, aprobador y revocación |
| `event_series` | Regla local de repetición y metadatos de una serie cuando exista |
| `calendar_events` | Evento concreto/ocurrencia, horas o fechas de día completo, visibilidad y versión |
| `event_participants` | Integrantes de la misma familia vinculados a un evento |
| `task_templates` | Responsabilidad, hábito o pendiente recurrente, reglas y destinatarios |
| `task_occurrences` | Obligación concreta de una persona/fecha, estado, entrega y revisión |
| `task_reviews` | Historial de aprobación o solicitud de corrección cuando se necesite conservar varias revisiones |
| `points_ledger` | Créditos, débitos, compensaciones y ajustes trazables |
| `rewards` | Catálogo familiar de premios |
| `reward_redemptions` | Solicitudes, aprobación, entrega, rechazo y cancelación de canjes |
| `automation_rules` | Preparativos y avisos deterministas derivados de agenda |
| `reminder_jobs` | Trabajo pendiente, instante objetivo, versión, reclamación y reintentos |
| `notifications` | Avisos persistentes, destinatarios y reconocimiento |
| `notification_deliveries` | Intentos y resultado por canal/dispositivo |
| `push_subscriptions` | Suscripciones protegidas y revocables |
| `audit_log` | Acciones relevantes con contexto mínimo y sin secretos |

Una tarea doméstica puede representarse en las tablas de tareas con un tipo explícito, siempre que no herede puntos, revisión infantil o penalizaciones. No es obligatorio crear otra tabla solo para duplicar campos equivalentes.

### 17.1 Integridad y rendimiento

- UUID u otra identificación consistente y segura; no usar nombres como identificador de autorización.
- `family_id` en entidades familiares y restricciones que impidan relacionar filas de distintas familias.
- Para relaciones relevantes, considera claves foráneas compuestas por familia e identificador; no confíes únicamente en comprobarlo en formularios.
- Fechas de creación y modificación y versión donde existan escrituras concurrentes.
- Cantidades de puntos enteras, costos válidos y restricciones de estados.
- Índices para filtros por familia, fechas, integrante, estado, relaciones y trabajos pendientes. Justifica índices compuestos o parciales según las consultas reales.
- Paginación de historiales y consultas por rango: no descargar todos los eventos históricos para construir una semana.
- Restricciones únicas para ocurrencias, créditos de puntos, canjes, avisos y claves de idempotencia.
- Cantidades agregadas calculadas consistentemente; no confiar en totales enviados por el cliente.
- Archivo de integrantes/premios/plantillas cuando exista historial que conservar.
- Evitar eliminación en cascada de historial de puntos por borrar un elemento de catálogo.
- Eliminación completa de familia como operación sensible explícita y documentada, no como efecto secundario accidental.
- Los trabajos y notificaciones de un recurso cancelado no deben continuar ejecutándose como si siguiera activo.

### 17.2 Transacciones críticas

Resolver atómicamente, como mínimo:

1. Crear familia y pertenencia del primer propietario.
2. Consumir una invitación o solicitud de vinculación una sola vez.
3. Crear/editar evento y registrar sus avisos o su outbox.
4. Aprobar una ocurrencia y acreditar sus puntos.
5. Aprobar un canje y debitar el saldo disponible.
6. Aplicar una compensación sin duplicarla.
7. Reclamar un lote de trabajos sin que dos ejecutores lo entreguen de forma inconsistente.

Usa funciones SQL/RPC para las operaciones que deban ser una transacción real. Varias peticiones HTTP consecutivas desde el navegador no forman una transacción de PostgreSQL.

Prefiere ejecución con los permisos del solicitante cuando sea suficiente. Si una operación requiere una función elevada para proteger el libro de puntos o verificar relaciones, limita expresamente su interfaz, permisos y alcance. No utilices `SECURITY DEFINER` como arreglo genérico de un error de permisos; ubica la lógica privilegiada en un esquema no expuesto, fija `search_path`, revoca accesos amplios y comprueba identidad, pertenencia y parámetros. La aplicación no debe ofrecer una vía pública para ejecutar SQL arbitrario.

## 18. Seguridad y privacidad por diseño

### 18.1 Aislamiento entre familias

- Activa RLS en todas las tablas familiares expuestas por la Data API.
- Define privilegios y políticas por operación; RLS y permisos de tabla son controles distintos.
- Una política que solo diga “usuario autenticado” no implementa aislamiento familiar.
- Verifica pertenencia activa y alcance de dispositivo en cada lectura y escritura.
- No uses `user_metadata` editable por el usuario para decidir si es adulto o administrador.
- La identidad, familia autorizada y actor efectivo se derivan de la sesión y de relaciones verificadas, no de parámetros que el cliente pueda inventar.
- Nunca autorices solicitudes administrativas basándote en que un botón está oculto o en una ruta que parece privada.
- Prueba accesos directos a API/RPC/Data API, no solo navegación normal.
- Protege vistas y funciones igual que las tablas. En vistas expuestas, usa el comportamiento de permisos del invocador cuando sea adecuado; evita que una vista salte las políticas de sus tablas.
- Evita políticas recursivas sobre tablas de pertenencia. Si necesitas un helper privado, revisa sus privilegios y alcance.
- Para actualizaciones, comprueba la fila original y los valores nuevos; nadie puede mover un registro a otra familia.
- No permitas que un dispositivo se autorice a sí mismo escribiendo su propio vínculo o rol.

### 18.2 Claves, sesiones y endpoints

- La clave publicable de Supabase puede utilizarse según su diseño; las claves secretas o `service_role` permanecen exclusivamente en servidor cuando sean necesarias.
- No conviertas el acceso privilegiado del servidor en la forma habitual de evitar RLS.
- Nada secreto en variables `NEXT_PUBLIC_*`, bundles, URLs, commits o respuestas de error.
- Valida entrada y autorización dentro de cada Server Action y Route Handler.
- Cookies, redirecciones de Auth y manejo de CSRF/origen conforme a las guías vigentes.
- Limita intentos de acceso, invitación, vinculación y operaciones sensibles sin añadir infraestructura innecesaria.
- Los enlaces de retorno no permiten redirecciones abiertas a destinos arbitrarios.
- Las revocaciones de pertenencia o dispositivo deben comprobarse con estado vigente; no dependas únicamente de un JWT antiguo.
- Eliminar un usuario de Auth no debe considerarse por sí solo revocación instantánea de todos los tokens ya emitidos. Diseña la verificación necesaria para operaciones sensibles.

### 18.3 Datos de hijos y familia

- Recoge el mínimo: nombre visible o alias, color y responsabilidades. Fecha de nacimiento, documentos, colegio exacto y fotografías no son obligatorios.
- Notas privadas separadas de lo que se proyecta en cocina o cuartos.
- Usa datos ficticios de demostración.
- No publiques calendarios familiares ni conviertas una URL adivinable en un enlace público.
- Buckets privados y URLs temporales/autorizadas para archivos si llegaran a usarse.
- Logs con identificadores técnicos y mensajes normalizados; evita títulos privados, contenido de notas, contraseñas, tokens, códigos de vinculación y audio.
- Registra cambios sensibles con contexto mínimo: actor, familia, acción, objeto y momento.
- Documenta exportación y eliminación de datos. Una exportación familiar solo la inicia un adulto autorizado y se limita a su familia.
- Limpia datos locales cuando cambie la sesión, evitando que una cuenta vea la caché de otra.
- Explica de forma honesta qué datos procesa Supabase y qué procesaría un futuro proveedor de IA. No afirmes cifrado de extremo a extremo si no existe.
- La región de alojamiento se decide durante la configuración. Para usuarios en Perú, São Paulo es una opción a evaluar mediante latencia medida y requisitos del proyecto, sin prometer que todos los servicios procesen todo allí.

## 19. Casos de uso y contratos reutilizables

Define contratos tipados y validados para los casos de uso. Como mínimo:

| Caso de uso | Reglas centrales |
| --- | --- |
| Crear/editar/cancelar evento | Actor autorizado, fechas válidas, participantes de la familia, visibilidad y actualización de avisos |
| Crear/completar/reabrir pendiente doméstico | Alcance familiar, estado permitido y cero puntos |
| Crear/editar plantilla de tarea o hábito | Adulto autorizado, recurrencia y destinatarios válidos |
| Generar ocurrencias | Idempotencia, fecha local, excepciones y horizonte acotado |
| Entregar tarea | Hijo/dispositivo autorizado o adulto, instante del servidor y transición válida |
| Revisar tarea | Adulto autorizado, control de versión y crédito de puntos atómico |
| Solicitar/aprobar/cancelar canje | Visibilidad del premio, estado, saldo y movimientos únicos |
| Aprobar/revocar dispositivo | Adulto de la familia, solicitud vigente y alcance explícito |
| Procesar recordatorios | Ejecutor autorizado, reclamación, vigencia y entregas deduplicadas |

Devuelve errores de dominio comprensibles: sesión requerida, acceso denegado, dato inválido, recurso inexistente, conflicto de versión, acción ya aplicada o saldo insuficiente. No entregues errores SQL crudos al usuario.

Incluye un identificador de comando/idempotencia en las mutaciones que podrían repetirse. El mismo comando reintentado no debe duplicar efectos. La identidad autorizada no se toma de un `userId` arbitrario del cuerpo.

Las funciones de negocio deben poder ser llamadas tanto desde un formulario como desde una futura propuesta de IA. No acoples crear un evento al componente de un modal ni a una API de un proveedor de modelos.

## 20. Preparación de IA y voz sin implementarlas todavía

### 20.1 Frontera arquitectónica

Reserva una integración desacoplada que, en el futuro, transforme una entrada en propuestas de comandos. No construyas un framework de agentes antes de tener casos de uso reales.

La aplicación conserva la responsabilidad de autenticar, autorizar, validar y ejecutar. Un modelo no recibe permisos administrativos ni acceso para generar y ejecutar SQL arbitrario.

En la versión manual:

- Mantén los contratos y operaciones reutilizables.
- Documenta el diseño futuro y usa un indicador de función desactivada si hace falta.
- No importes SDKs de IA ni añadas dependencias/credenciales obligatorias sin usarlas.
- No crees tablas futuras vacías, endpoints ficticios o cobros de IA como requisito de arranque.

### 20.2 Fase futura de texto con IA

La entrada recibe texto, fecha/hora de referencia, zona familiar y un contexto mínimo de integrantes autorizados. El contexto de familia y actor lo obtiene el servidor.

El resultado es uno o varios borradores estructurados con tipo de acción, título, fecha/hora o fecha completa, participantes, categoría, recordatorios solicitados, información faltante y necesidad de aclaración.

Flujo:

1. Recibir la frase y validar tamaño/identidad.
2. Interpretar con el proveedor elegido mediante salida estructurada o herramientas definidas.
3. Comprobar el esquema y luego la validez semántica en el backend.
4. Resolver nombres contra integrantes realmente accesibles.
5. Pedir aclaración cuando falte una hora, haya dos personas con el mismo nombre o una fecha sea ambigua.
6. Mostrar una confirmación legible y editable con fecha absoluta, día y hora.
7. Ejecutar los casos de uso existentes con idempotencia.
8. Mostrar los resultados reales y permitir corregirlos/cancelarlos según las reglas.

Una frase puede contener varios comandos. Define si se confirman juntos y qué ocurre si alguno no es válido; evita creaciones parciales invisibles.

Ejemplos que debe soportar esta fase:

- “Mañana tengo una reunión a las cuatro de la tarde”.
- “El jueves viene la tía Carmen a las cinco”.
- “Mañana Mateo tiene dentista a las tres de la tarde”.
- “El viernes a las ocho de la mañana los niños tienen examen y deben llevar uniforme de deporte”.
- “En dos horas recuérdame comprar gas”.
- Una misma frase con reunión y visita en fechas distintas.

No inventes que la madre acompaña al niño al dentista. Sugiere o pregunta quién acompaña cuando esa información sea necesaria. “Este jueves” y “a las cuatro” requieren una política explícita y aclaración cuando exista ambigüedad.

El contenido dictado es información de usuario, no instrucciones de sistema. No puede cambiar permisos, revelar datos de otra familia ni modificar las reglas internas del asistente.

### 20.3 Fase futura de voz

- Botón grande y fijo de micrófono en las vistas adecuadas, especialmente casa y celular de adultos.
- Activación inicial por toque; estado de escucha, detener, cancelar, procesar y resultado visibles.
- Solicitar acceso al micrófono con explicación clara y manejar permiso denegado, falta de dispositivo y captura vacía.
- Capturar audio en un formato admitido por el navegador y el proveedor; comprobar compatibilidad real.
- Transcribir y reutilizar el mismo flujo de interpretación de texto.
- Permitir revisar o corregir la transcripción.
- Evaluar ruido doméstico, nombres propios, acento peruano y varias instrucciones en una frase.
- Confirmar en pantalla qué se guardó y en qué fecha/hora; respuesta hablada breve configurable.
- Actualizar las demás pantallas mediante el mecanismo de sincronización existente.
- Mantener la entrada manual disponible si falla la transcripción, el proveedor o la conexión.
- Procesar el mínimo contexto; no enviar el historial familiar completo para crear un evento sencillo.
- No conservar audio por defecto. Si alguna función futura lo requiere, definir finalidad, permiso, acceso y expiración antes de habilitarla.
- Medir latencia desde que termina la frase hasta que aparece el resultado. El deseo de respuesta en menos de dos segundos es un objetivo a evaluar, no una garantía técnica previa a las pruebas.
- Escucha continua y activación por palabra son ampliaciones posteriores: requieren evaluar compatibilidad, batería, privacidad y consentimiento explícito. No actives un micrófono permanente en silencio.

La selección de proveedor, modelos, precios y credenciales de IA queda para esas fases. Consulta sus condiciones actuales de tratamiento/retención de datos. La aplicación manual debe seguir funcionando sin esa integración.

## 21. Rutas y navegación propuestas

Los nombres pueden ajustarse, conservando acceso simple y autorización independiente del nombre de ruta.

| Ruta conceptual | Función |
| --- | --- |
| `/` | Resolver entrada a acceso, onboarding o familia activa |
| `/acceso` | Inicio de sesión |
| `/registro` | Registro de adulto |
| `/recuperar` | Recuperación de cuenta |
| `/onboarding` | Crear familia y primeros integrantes |
| `/invitacion/[token]` | Aceptar invitación válida sin filtrar datos ajenos |
| `/casa` | Panel común ultravisual |
| `/agenda` | Agenda con filtros y vistas secundarias |
| `/pendientes` | Checklist del hogar |
| `/hijos/[memberId]` | Vista infantil limitada al alcance del actor |
| `/responsabilidades` | Administración de tareas y hábitos |
| `/premios` | Catálogo e historial según rol |
| `/avisos` | Historial y pendientes de notificaciones |
| `/vincular` | Solicitud de emparejamiento de dispositivo |
| `/configuracion` | Familia, integrantes, colores, zona y preferencias |
| `/configuracion/dispositivos` | Aprobar, configurar y revocar pantallas |

Los flujos de acceso no exponen datos familiares antes de validar al actor. El primer uso debe guiar a crear una familia, agregar integrantes y crear un primer evento o pendiente, sin formularios innecesariamente largos.

## 22. Datos de demostración y entorno local

- Usa datos ficticios y una forma reproducible de cargarlos solo en desarrollo/pruebas.
- Incluye una familia con dos adultos y dos hijos para probar colores y participantes.
- Incluye una segunda familia separada para verificar aislamiento.
- Personas como Mamá, Papá, Mateo, Sofía y tía Carmen son ejemplos ficticios editables, no datos reales que debas buscar.
- Crea ejemplos de hoy y de la semana próxima calculados según la zona familiar: visita, cita, reunión escolar, recibo, técnico, pendiente sin hora y evento de día completo.
- Incluye tareas a tiempo, una vencida, una en revisión y un canje de ejemplo sin alterar saldos de forma inconsistente.
- No dependas de fechas fijas que dejen el panel vacío al ejecutar el proyecto meses después.
- No cargues semillas ni cuentas de prueba en producción.
- No mantengas una puerta trasera de acceso ni credenciales universales de demostración en el despliegue real.
- Si Docker/Supabase local no están disponibles, comprueba el entorno y explica qué integraciones no pudieron ejecutarse; no inventes resultados.

## 23. Verificación y criterios de aceptación

Usa herramientas adecuadas como Vitest para dominio, pruebas SQL/pgTAP o equivalentes para base de datos y Playwright para flujos. Selecciona una combinación razonable y documenta cómo ejecutarla. Prioriza riesgos reales; no escribas pruebas triviales que solo repitan constantes o estructura de componentes.

### 23.1 Acceso y privacidad

- Un adulto de familia A no puede leer ni modificar registros de familia B mediante interfaz, URL, RPC o Data API.
- Un usuario autenticado sin pertenencia no obtiene acceso por tener rol `authenticated`.
- Un dispositivo pendiente de aprobación no accede a una agenda.
- Una pantalla de un hijo no puede consultar información privada de adultos, aprobar tareas, modificar puntos o autorizarse a sí misma.
- Un dispositivo revocado no obtiene información nueva y limpia datos al detectar la revocación.
- Invitaciones/códigos expirados, reutilizados o ajenos son rechazados.
- Las claves secretas no aparecen en el bundle, la salida de build ni logs públicos.
- Las políticas impiden insertar relaciones cruzadas entre familias o cambiar el `family_id` de un registro para apropiárselo.

### 23.2 Agenda, reloj y recurrencias

- Crear manualmente un evento, recargar y comprobar persistencia.
- Editar/cancelar y verificar su efecto en el panel y recordatorios.
- Ver hoy y próximos siete días sin perder eventos fuera de pantalla.
- Día de semana y fecha coinciden; no hardcodear ejemplos.
- Día completo, eventos cruzando medianoche, mes/año nuevo y año bisiesto se interpretan correctamente.
- Recurrencias mantienen la hora local y no duplican ocurrencias al ejecutarse dos veces.
- Prueba una zona con cambio de horario además de Lima para evitar un diseño dependiente de UTC-5 fijo.
- Una excepción cancelada no vuelve a aparecer por el generador.
- Suspender/reabrir una pantalla actualiza reloj, cuenta regresiva y agenda del nuevo día.

### 23.3 Tareas, puntos y premios

- Un hijo entrega una tarea y el adulto ve su estado real.
- La aprobación tardía del adulto no convierte una entrega puntual del hijo en atraso.
- Dos aprobaciones simultáneas o reintentos generan un solo crédito.
- Un pendiente doméstico nunca entrega puntos.
- Una tarea para dos hijos genera seguimiento independiente cuando ambos deben realizarla.
- Cancelar/eximir no cuenta como incumplimiento ni crea créditos inesperados.
- Dos canjes simultáneos no gastan más saldo que el disponible.
- Una compensación no se aplica dos veces y conserva trazabilidad.

### 23.4 Avisos, reglas y sincronización

- La visita genera los avisos y tareas configurados una sola vez.
- Reprogramarla invalida trabajos anteriores y crea los correctos.
- Cancelarla evita futuros avisos inválidos.
- El proceso de fondo funciona sin ninguna pantalla abierta.
- Un trabajo interrumpido puede reclamarse/reintentarse sin duplicar la notificación interna.
- Fallo de Push no equivale a entrega confirmada.
- Un cambio se refleja en dos sesiones/pantallas autorizadas y se recupera tras una desconexión.
- Al cambiar de familia no permanecen suscripciones o datos de la anterior.
- Una pantalla infantil recibe el aviso escolar autorizado la noche anterior y en la mañana según configuración.
- Una edición concurrente relevante presenta conflicto o aplica una política explícita comprobada.

### 23.5 Interfaz y PWA

- Comprobar como mínimo una vista móvil, tablet y escritorio/pantalla doméstica.
- Revisar horizontal/vertical, foco de teclado, contraste y botones táctiles.
- La pantalla de casa permite identificar hora, siguiente evento y pendientes sin abrir administración.
- Los estados vacíos, carga, permiso denegado y fallo de red permiten recuperarse.
- La PWA puede instalarse en dispositivos compatibles y muestra instrucciones apropiadas donde el flujo difiere.
- Sin conexión muestra solo la instantánea autorizada, identifica su antigüedad y bloquea mutaciones no soportadas.
- Al cerrar sesión/cambiar familia desaparece la información anterior de la caché de aplicación.
- El producto funciona de principio a fin con las funciones de IA desactivadas y sin credenciales de IA.

### 23.6 Calidad técnica

- Compilación de producción satisfactoria, comprobación de tipos y lint coherente con el proyecto.
- Migraciones aplicables desde una base vacía y semillas reproducibles.
- Pruebas críticas de autorización, fechas e idempotencia ejecutadas con evidencia.
- Revisar asesores de seguridad de Supabase disponibles y resolver hallazgos relevantes.
- Validar las consultas principales con datos de prueba razonables y revisar planes cuando haya dudas de rendimiento.
- Distinguir siempre: ejecutado y aprobado, ejecutado con fallos, no ejecutado por limitación del entorno y pendiente.
- No ocultar errores deshabilitando RLS, comprobaciones de tipos o validaciones.

## 24. Configuración, operación y despliegue

### 24.1 Entornos

- Entornos separados para desarrollo y producción; staging/preview cuando resulte útil.
- Migraciones y configuración versionadas; secretos fuera del repositorio.
- Proporciona `.env.example` con nombres y descripciones, sin valores reales.
- Variables iniciales para URL y clave publicable de Supabase; otras claves solo cuando un componente real las necesite.
- Ninguna credencial de IA obligatoria en la primera versión.
- Revisa la documentación vigente para los nombres concretos de variables y claves de Supabase antes de implementarlas.
- Los entornos de preview no deben acceder por defecto a los datos familiares de producción.

### 24.2 Despliegue previsto

- Next.js en Vercel; proyecto Supabase elegido expresamente para ese entorno.
- Configurar callbacks/redirecciones de Auth, dominio, HTTPS y variables.
- Aplicar migraciones mediante un procedimiento reproducible y revisar cambios que afecten datos existentes.
- Configurar Cron y funciones necesarias; documentar cómo verificar ejecuciones.
- Si se habilita Web Push, documentar claves, suscripciones y prueba por dispositivo.
- Configurar correo de autenticación para uso real cuando se pase de pruebas.
- Comprobar límites y condiciones actuales de los planes. Vercel Hobby está destinado a uso personal no comercial; para comercializar se debe elegir un plan apropiado.
- Los planes gratuitos sirven para comenzar dentro de sus límites; no presentarlos como disponibilidad garantizada ni costos ilimitados.
- No contratar servicios o modificar recursos de producción fuera del alcance autorizado del entorno de trabajo. Si el despliegue no puede hacerse, entregar la aplicación ejecutable y los pasos precisos pendientes.

### 24.3 Observabilidad y mantenimiento

- Logs estructurados con identificador de solicitud/comando y redacción de contenido privado.
- Identificar fallos de Auth, procesos programados, reintentos y suscripciones sin registrar secretos.
- Indicadores básicos: último trabajo correcto, trabajos fallidos, entrega de avisos y estado de conexión de pantallas.
- Procedimiento para recuperar avisos pendientes tras una caída.
- Copias de seguridad/restauración según capacidades del plan y exportaciones autorizadas.
- No asumir que una copia de seguridad elimina inmediatamente datos ya solicitados para borrado; documentar el comportamiento del proveedor.
- No generar consultas cada segundo ni mensajes Realtime para actualizar el reloj: ese cálculo es local.
- Medir uso de conexiones, mensajes, funciones y almacenamiento antes de escalar o añadir servicios.

## 25. Hitos de implementación y orden de entrega

### Hito A: base verificable

1. Inspeccionar repositorio y entorno.
2. Registrar un plan breve y decisiones iniciales.
3. Crear/adaptar Next.js App Router con TypeScript y diseño base.
4. Preparar Supabase local o el entorno de desarrollo disponible.
5. Implementar Auth de adultos, familia, integrantes, pertenencia y RLS.
6. Crear el primer evento manual y mostrarlo en casa con reloj y radar semanal.
7. Probar persistencia y aislamiento con dos familias.

**Salida:** un adulto puede iniciar sesión, crear su familia e integrantes y gestionar una agenda privada real.

### Hito B: responsabilidades y funcionamiento compartido

1. Checklist del hogar.
2. Plantillas y ocurrencias de tareas/hábitos.
3. Entrega, aprobación y seguimiento de atrasos.
4. Libro de puntos, premios y canjes.
5. Emparejamiento y revocación de pantallas, con vista infantil limitada.
6. Sincronización entre dispositivos y recuperación de conexión.

**Salida:** adultos e hijos usan las pantallas con permisos correctos y sin duplicar puntos.

### Hito C: avisos, automatizaciones y PWA

1. Avisos persistentes y procesamiento de servidor.
2. Reprogramación, cancelación, reintentos y deduplicación.
3. Preparativos de visitas y colegio configurados por adultos.
4. PWA, modo pantalla, preferencias, instantánea sin conexión y actualización segura.
5. Notificaciones Push cuando el entorno lo permita, con fallback visual.
6. Verificación funcional, seguridad y documentación de despliegue.

**Salida:** primera versión familiar completa sin IA, lista para una prueba doméstica.

### Hito D: texto con IA, solo después del núcleo

Definir proveedor y credenciales en ese momento, implementar propuestas estructuradas, validación semántica, aclaraciones y confirmación. Probar frases en español contra los mismos casos de uso manuales.

### Hito E: voz, solo después de validar texto

Añadir captura, transcripción y respuesta opcional reutilizando el hito D. Medir ruido, precisión y latencia en dispositivos reales.

Mantén un registro de tareas pendientes y decisiones para continuar entre sesiones. Si el entorno permite completar A, B y C, continúa con esos hitos sin desviarte a IA. Si existe una limitación real, entrega un hito coherente y detalla con precisión lo que falta.

## 26. Entregables del agente

Además del código funcional, entrega:

- `README.md`: qué hace el producto, requisitos, instalación, ejecución, configuración y comandos reales.
- `.env.example`: variables necesarias sin secretos.
- Migraciones, políticas y datos de demostración reproducibles.
- Pruebas críticas y sus comandos.
- `docs/arquitectura.md`: módulos, flujos, permisos, fechas y decisiones relevantes.
- `docs/modelo-datos.md`: entidades, relaciones, transacciones e integridad.
- `docs/seguridad.md`: permisos de adultos/dispositivos, RLS, secretos y límites de caché.
- `docs/despliegue.md`: configuración de Vercel/Supabase, Auth, trabajos y verificación.
- `docs/roadmap.md`: hitos completados, pendientes y fases de texto/voz.
- Evidencia de las comprobaciones ejecutadas; capturas de las vistas principales si el entorno permite tomarlas sin exponer datos reales.

Estos son archivos del proyecto futuro, no archivos que deban existir antes de iniciar. Puedes consolidar documentación cuando evite duplicación, siempre que el contenido siga siendo fácil de encontrar.

Al reportar una entrega indica qué funciona, cómo probarlo, qué pruebas pasaron y qué falta. No describas como terminado un flujo que utiliza datos ficticios sin persistencia real o una integración que no se pudo ejecutar.

## 27. Definición de primera versión funcional

La versión manual se considera lista para prueba doméstica cuando:

- [ ] Un adulto crea su familia, integrantes y colores y puede invitar a otro adulto.
- [ ] La agenda guarda, edita y cancela eventos reales con participantes y visibilidad.
- [ ] Se ve hora, día, fecha, siguiente evento y cuenta regresiva correcta.
- [ ] La pantalla común muestra hoy, próximos siete días y checklist del hogar.
- [ ] Un adulto crea tareas/hábitos recurrentes y revisa entregas de los hijos.
- [ ] Los atrasos distinguen entrega del hijo de aprobación del adulto.
- [ ] Puntos y canjes funcionan con historial y sin duplicados concurrentes.
- [ ] Una pantalla puede vincularse a casa o a un hijo sin compartir credenciales de adulto.
- [ ] Un dispositivo puede revocarse y no obtiene información nueva.
- [ ] Dos pantallas autorizadas se actualizan y recuperan los cambios tras reconectarse.
- [ ] Los avisos se guardan y el servidor los procesa aunque nadie tenga la web abierta.
- [ ] Visitas y colegio pueden generar preparativos según reglas aceptadas por adultos.
- [ ] La cancelación o reprogramación actualiza trabajos futuros.
- [ ] La PWA permite consulta limitada de datos descargados con antigüedad visible.
- [ ] Familia A no accede a familia B, tampoco por llamadas directas.
- [ ] Las claves privilegiadas y los datos privados no se filtran al cliente o a logs.
- [ ] La interfaz es utilizable en móvil, tablet y pantalla doméstica.
- [ ] Las comprobaciones técnicas y de negocio críticas tienen resultados reportados.
- [ ] Existe una guía reproducible para ejecutar y desplegar.
- [ ] Toda la versión funciona sin transcripción, modelos de IA ni claves de esos servicios.

## 28. Correspondencia con la visión original

| Necesidad del proyecto | Secciones que la convierten en requisitos |
| --- | --- |
| Los tres pilares del Mundo Familiar | 2, 4 y 20 |
| Hora, día, fecha y siguiente evento visibles | 7 y 8 |
| Lectura desde dos metros y colores por integrante/categoría | 7 |
| Línea de hoy y radar de siete días | 8 y 9 |
| Gestión de visitas, reuniones, salud, recibos y técnicos | 9 y 10 |
| Checklist doméstica sin puntos | 10 y 12 |
| Deberes, hábitos, atrasos y premios de hijos | 11 y 12 |
| Avisos la noche anterior y en la mañana | 13 y 14 |
| Calendario que alimenta pantallas de cuartos | 13 y 15 |
| Misiones de orden antes de una visita | 13 |
| Examen y preparación de uniforme/materiales | 13 |
| Voz desde casa o celular y varias instrucciones por frase | 20 |
| Interpretación de fechas relativas y participantes | 20 |
| Confirmación grande y respuesta hablada opcional | 20 |
| Pantallas sincronizadas | 15 |
| Construir primero una aplicación funcional sin IA | 3, 4, 20, 25 y 27 |
| Datos privados de cada familia y permisos de hijos | 6 y 18 |
| Next.js App Router + Supabase | 3, 5 y 24 |

## 29. Fuentes oficiales para verificar durante la implementación

Estas referencias se revisaron para preparar el encargo. Son documentación viva: comprueba las APIs, versiones, condiciones y limitaciones vigentes al implementar. La especificación del producto procede de este documento y de las decisiones del usuario, no de ejemplos de una biblioteca.

| Tema | Documentación oficial |
| --- | --- |
| Next.js App Router | <https://nextjs.org/docs/app> |
| Server y Client Components | <https://nextjs.org/docs/app/getting-started/server-and-client-components> |
| Route Handlers | <https://nextjs.org/docs/app/getting-started/route-handlers> |
| PWA y Web Push con Next.js | <https://nextjs.org/docs/app/guides/progressive-web-apps> |
| Auth de Supabase | <https://supabase.com/docs/guides/auth> |
| Cliente SSR y Next.js | <https://supabase.com/docs/guides/auth/server-side/nextjs> |
| Identidades anónimas de Auth | <https://supabase.com/docs/guides/auth/auth-anonymous> |
| RLS y privilegios | <https://supabase.com/docs/guides/database/postgres/row-level-security> |
| Realtime y cambios de base de datos | <https://supabase.com/docs/guides/realtime/subscribing-to-database-changes> |
| Supabase Cron | <https://supabase.com/docs/guides/cron> |
| Regiones de Supabase | <https://supabase.com/docs/guides/platform/regions> |
| Seguridad de Supabase | <https://supabase.com/security> |
| Despliegue Next.js en Vercel | <https://vercel.com/docs/frameworks/full-stack/nextjs> |
| Condiciones de Vercel Hobby | <https://vercel.com/docs/plans/hobby> |
| Límites y precios de Supabase | <https://supabase.com/pricing> |
| Wake Lock | <https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API> |
| Push API | <https://developer.mozilla.org/en-US/docs/Web/API/Push_API> |
| Restricciones de audio automático | <https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay> |
| Futura transcripción con OpenAI, si se elige ese proveedor | <https://developers.openai.com/api/docs/guides/speech-to-text> |
| Futura ejecución mediante funciones con OpenAI, si se elige ese proveedor | <https://developers.openai.com/api/docs/guides/function-calling> |

No fijes ahora un proveedor de IA por aparecer en las referencias. Esa decisión sigue pendiente de la fase correspondiente.

## 30. Instrucción de arranque para el agente

Empieza inspeccionando el repositorio y el entorno. Resume brevemente lo encontrado, registra un plan por hitos y comienza a implementar el **hito A** con persistencia y permisos reales. Usa los valores propuestos cuando no exista una decisión previa que los contradiga. Consulta documentación oficial para las APIs que vayas a utilizar.

Conserva como restricciones de trabajo: Next.js con App Router y TypeScript, Supabase como backend de datos, aislamiento familiar desde el inicio, procesos de servidor para avisos, lógica reutilizable y voz/IA posterior. Construye primero el flujo manual completo y verifica su funcionamiento. Continúa con los hitos B y C conforme avance la implementación y deja evidencia clara de cada entrega.

**Resultado esperado:** una familia puede organizar su día desde la cocina y los celulares, los hijos ven sus responsabilidades en sus pantallas, los cambios se sincronizan y los avisos se ejecutan; todo ello funciona antes de añadir IA o micrófono.


