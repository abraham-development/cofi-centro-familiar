# Centro Familiar (COFI)

Centro de Organización Familiar Inteligente. Es una aplicación web para organizar la casa:

- agenda compartida;
- línea del día;
- radar de los próximos siete días;
- pendientes del hogar;
- más adelante, responsabilidades de los hijos con puntos y premios.

Está pensada para pantallas en la cocina y los cuartos, y para el celular de los adultos.

Prueba publicada en [Hostinger Web Apps](https://mediumturquoise-elephant-247172.hostingersite.com). Actualmente usa el backend de desarrollo. Configuración y cambio a las variables de producción en [`docs/despliegue.md`](docs/despliegue.md).

> La especificación completa del producto está en [`docs/Prompt_Centro_Organizacion_Familiar.md`](docs/Prompt_Centro_Organizacion_Familiar.md).
> El avance por hitos está en [`docs/roadmap.md`](docs/roadmap.md).

## Qué funciona hoy (Hito A)

- **Cuentas de adulto.** Registro, inicio de sesión y recuperación de contraseña. Confirmar el correo y recuperar la contraseña se hace con un **código de 8 dígitos** que llega desde `cofi@afcrtecnologia.com` (SMTP de Hostinger).
- **Familias.** Crear familia e integrantes con color, iniciales o emoji. Los hijos no necesitan cuenta. Hay roles de propietario y administrador, e invitaciones de un solo uso con enlace.
- **Agenda.**
  - Crear, editar y cancelar eventos.
  - Participantes o «toda la casa».
  - Visibilidad: familia, participantes o solo adultos.
  - Notas privadas de adultos.
  - Aviso de solapamientos.
  - Detección de cambios concurrentes.
  - Filtros por integrante y categoría, y vista mensual secundaria.
- **Pantalla de casa (`/casa`).**
  - Reloj contextual con fecha, actividad en curso y cuenta regresiva al próximo evento.
  - «Hoy paso a paso» por mañana, tarde y noche.
  - Pendientes de la casa.
  - Avisos importantes.
  - Radar de 7 días.
- **Pendientes del hogar.** Con o sin fecha u hora, responsables y prioridad. Se pueden completar y reabrir con registro de quién y cuándo. Nunca dan puntos.
- **Privacidad.** Cada familia está aislada en la base de datos (RLS) y se probó también con llamadas directas a la API.

## Qué funciona además (Hito B)

- **Responsabilidades y hábitos** de los hijos:
  - se repiten una vez, a diario, de lunes a viernes, en días elegidos o cada mes;
  - revisión de un adulto, corrección, exención y reapertura con motivo;
  - atrasos medidos por la entrega del hijo.
- **Puntos y premios.** Libro de movimientos, catálogo, canjes con descuento atómico y reembolsos sin duplicados.
- **Eventos repetidos.** Editar una ocurrencia, «esta y las siguientes» o terminar la serie.
- **Pantallas vinculadas.**
  - En el propio equipo: entrar como adulto, elegir pantalla familiar o de un hijo y activar. COFI cierra la sesión adulta y conserva el acceso de la pantalla. Ver [`docs/pantallas.md`](docs/pantallas.md).
  - Cocina o sala en modo casa; tablet del cuarto en modo hijo.
  - El código aprobado desde otro equipo sigue como alternativa. Las sesiones de adulto y pantalla son independientes; los dispositivos se pueden desvincular al instante.
- **Tiempo real.** Los cambios llegan a las demás pantallas en unos 1–2 segundos y se recuperan al reconectar.

Lo que falta (avisos programados, reglas de preparativos y PWA) está en [`docs/roadmap.md`](docs/roadmap.md).

## Requisitos

- Node.js 22.12 o superior (probado con 22.22) y npm.
- Un proyecto de Supabase (en la nube). Docker **no** es necesario.
- Supabase CLI: viene como dependencia de desarrollo; se usa con `npx supabase`.

## Puesta en marcha

```bash
npm install
cp .env.example .env.local      # completa URL y clave publicable de Supabase
npx supabase login              # una vez por equipo
npx supabase link --project-ref <ref-del-proyecto>
npm run db:push                 # aplica supabase/migrations al proyecto enlazado
npm run dev                     # http://localhost:3000
```

Para configurar los correos con código OTP (SMTP propio y plantillas en español):

```bash
npm run auth:configure -- --diff    # revisa qué cambiaría en Auth
npm run auth:configure -- --apply   # aplica (solo ajustes de Auth)
```

Las variables que usa el script están en `.env.example`. Si `SMTP_PASSWORD` está vacía, se conserva la contraseña SMTP que ya tenga el proyecto.

### Datos de demostración (solo desarrollo)

```bash
npm run seed:dev
```

Crea dos familias ficticias:

- **García:** Mamá, Papá, Mateo y Sofía.
- **Pérez:** sirve para comprobar el aislamiento entre familias.

Las fechas se calculan desde hoy. Las cuentas de prueba quedan en `.env.test.local`, que Git ignora. El script se niega a ejecutarse si el proyecto enlazado no coincide con `DEV_SEED_PROJECT_REF`. **Nunca lo apuntes a producción.**

## Comandos

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo |
| `npm run build` / `npm start` | Build de producción y servidor |
| `npm run typecheck` | Genera tipos de rutas y comprueba TypeScript |
| `npm run lint` | ESLint (incluye reglas del React Compiler) |
| `npm test` | Pruebas de dominio con Vitest (fechas, franjas, radar, reloj) |
| `npm run db:test` | Pruebas pgTAP contra el proyecto enlazado, cada archivo dentro de `BEGIN … ROLLBACK` |
| `npm run db:push` | Aplica las migraciones pendientes |
| `npm run db:advisors` | Asesores de seguridad y rendimiento de Supabase |
| `npm run types:gen` | Regenera `src/lib/supabase/database.types.ts` |
| `npm run seed:dev` | Borra/recrea las familias de demostración (solo desarrollo; pedir aprobación antes) |
| `npm run e2e` | Reinicia la demostración y ejecuta Playwright; requiere aprobación del borrado. Incluye celular, cocina y cuarto |
| `E2E_PORT=3001 E2E_PRODUCTION=1 npx playwright test <archivos>` | Pruebas seleccionadas sin semilla, contra un `npm run build` previo |
| `npm run auth:configure -- --diff\|--apply\|--verify` | Configuración de Auth: SMTP y códigos OTP |

Para probar una migración nueva **antes** de aplicarla, sin dejar cambios:

```bash
node scripts/db-test-remote.mjs --with supabase/migrations/<archivo>.sql
```

## Estructura

```
src/app/                 rutas (App Router) en español: /casa, /agenda, /pendientes, /configuracion…
src/features/<módulo>/   dominio, consultas, casos de uso, acciones y componentes de cada módulo
src/components/          componentes compartidos (reloj, chips de integrante, shadcn/ui)
src/lib/                 clientes de Supabase, sesión, tiempo, errores y validación
supabase/migrations/     esquema, RLS y funciones (fuente de verdad reproducible)
supabase/tests/database/ pruebas pgTAP de permisos e integridad
tests/unit/              Vitest
tests/e2e/               Playwright
scripts/                 configuración de Auth, semillas y ejecutor de pruebas remotas
docs/                    arquitectura, modelo de datos, seguridad, despliegue y hoja de ruta
```

## Documentación

- [Arquitectura](docs/arquitectura.md)
- [Modelo de datos](docs/modelo-datos.md)
- [Seguridad y privacidad](docs/seguridad.md)
- [PWA y consulta sin conexión](docs/pwa.md)
- [Despliegue](docs/despliegue.md)
- [Hoja de ruta y estado](docs/roadmap.md)
