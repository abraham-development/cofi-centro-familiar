# Despliegue y entornos

## Entornos

| Entorno | Supabase | App |
| --- | --- | --- |
| Desarrollo | Proyecto `COFI` (`gnnajgdfhbbziucqnewj`, us-east-2), con datos ficticios | `npm run dev` en `http://localhost:3000` |
| Pruebas públicas | El mismo Supabase de desarrollo | Hostinger Web Apps: `https://mediumturquoise-elephant-247172.hostingersite.com` |
| Producción | **Otro proyecto Supabase, por crear.** Nunca se le cargan semillas ni cuentas de prueba | Hostinger elegido por el usuario; separación de producción pendiente |

Los entornos de preview no deben apuntar a la base de producción.

## Aplicar el esquema en un proyecto nuevo

```bash
npx supabase login
npx supabase link --project-ref <ref>
npx supabase db push --linked          # aplica supabase/migrations en orden
npm run db:test                        # pgTAP dentro de BEGIN … ROLLBACK
npm run db:advisors                    # asesores de seguridad y rendimiento
```

Para revisar una migración nueva antes de aplicarla:

```bash
node scripts/db-test-remote.mjs --with supabase/migrations/<archivo>.sql
```

## Auth (SMTP y códigos OTP)

1. Crea el buzón remitente en Hostinger (hPanel → Correos). En COFI es `cofi@afcrtecnologia.com`.
2. Guarda la configuración SMTP de una de dos formas:
   - **Opción A:** en el panel de Supabase, en Authentication → Emails → SMTP Settings (`smtp.hostinger.com`, puerto 465).
   - **Opción B:** escribe `SMTP_PASSWORD` en `.env.local` y el script la envía.
3. Completa en `.env.local` las variables `AUTH_*` y `SMTP_*` (ver `.env.example`). `AUTH_PROJECT_REF` debe coincidir con el proyecto enlazado.
4. Revisa y aplica:

   ```bash
   npm run auth:configure -- --diff
   npm run auth:configure -- --apply
   npm run auth:configure -- --verify
   ```

   El script solo declara ajustes de Auth:
   - SMTP;
   - código de 8 dígitos que vence en 10 minutos;
   - plantillas en español;
   - contraseñas de 8 o más caracteres con letras y números.

   Rechaza cualquier cambio fuera de Auth.
5. En producción, `AUTH_SITE_URL` y `AUTH_REDIRECT_URLS` deben usar HTTPS y el dominio real.
6. Prueba un registro real: debe llegar el código desde el remitente configurado.

El dominio `afcrtecnologia.com` ya publica SPF (`include:_spf.mail.hostinger.com`), DKIM de Hostinger y DMARC (`p=none`). Conviene endurecer DMARC más adelante.

## Hostinger Web Apps

El usuario pidió este destino el 17 de octubre de 2026, reemplazando la previsión de Vercel. Se usa un sitio nuevo con subdominio gratuito dentro del plan Business existente; no se contrató una suscripción. El destino reutilizable está en `.hostinger/site.json`. La conexión OAuth del MCP está autorizada; sus credenciales permanecen fuera del repositorio.

Configuración del sitio:

- Aplicación `next`, Node.js 22, npm, script `build`, salida `.next`, raíz del proyecto.
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SITE_URL` con el dominio HTTPS.
- `COFI_HOSTINGER_BUILD=1`: `npm run build` selecciona Webpack y la salida standalone. En local, `npm run build:hostinger` reproduce ese modo. El build normal conserva Turbopack.
- `NODE_OPTIONS=--experimental-strip-types`, configurada en Hostinger. La configuración final es CommonJS (`next.config.js`), por lo que ya no depende de transformar TypeScript.

La imagen Linux de Hostinger no tiene `GLIBC_2.29`, requerida por SWC nativo de Next 16. Se fija `@next/swc-wasm-nodejs` a la misma versión de Next y se usa Webpack. Tailwind usa PostCSS con Webpack y su loader propio con Turbopack. No se rebajó Next ni se desactivaron Cache Components o Partial Prefetching. La configuración CommonJS evita también que la envoltura de configuración del proveedor genere imports ESM sin extensión.

El `.env.local` del equipo conserva `COFI_HOSTINGER_BUILD=0` para mantener Turbopack en el build local habitual: Next da prioridad a ese archivo sobre `.env.production`. La variable explícita del comando `build:hostinger` fuerza el modo compatible. Ninguno de esos archivos se incluye en el ZIP.

Para publicar:

1. Revisa el destino de `.hostinger/site.json`. No sobrescribas otros sitios.
2. Crea un ZIP con `src/`, `public/`, `package.json`, `package-lock.json`, `next.config.js`, `postcss.config.mjs`, `tsconfig.json` y `scripts/build.mjs` en su raíz. Excluye `.env*`, `node_modules`, `.next`, credenciales, pruebas, datos y configuración privada.
3. Configura las variables antes del build. El endpoint de variables reemplaza el conjunto completo: lee primero las claves y conserva sus valores reales; no reenvíes `********`.
4. Ejecuta `hosting_deploy-js-application` con el dominio y la ruta absoluta del ZIP. Usa `removeArchive: false`: la regla del usuario requiere aprobación antes de borrar archivos.
5. Sigue `hosting_nodejs_list-builds` y los logs hasta `completed`; comprueba contenido real, acceso autenticado, acciones del servidor y recursos PWA por HTTPS.

Supabase Auth usa esta URL como `site_url` y la admite en `additional_redirect_urls`, conservando ambos redirects de localhost. Solo cambiaron esos dos ajustes; SMTP, plantillas y demás configuración se conservaron. `.env.local` refleja esas URLs para que `auth:configure` no las revierta. El `supabase/config.toml` base sigue describiendo el desarrollo local: no ejecutes un `config push` general sin revisar el diff.

El usuario pidió preparar `.env.production` **sin valores**. Después completó URL/clave publicable de Supabase y autorizó deducir el resto e importar. Se completaron URL pública y selector de build; VAPID quedó vacía porque aún no hay emisor Push. Se importaron los valores no vacíos, conservando las cinco claves remotas, incluido `NODE_OPTIONS`. El archivo está ignorado por Git, con permisos `0600`, y excluido de los ZIP. Nunca copiar claves secretas o `service_role` a variables públicas.

La clave proporcionada fue validada contra Auth (200); el acceso anónimo a `families` se rechaza con 401/42501, como corresponde a sus permisos. **Los valores del archivo apuntan al proyecto Supabase actual**: el nombre `.env.production` no crea aislamiento de base de datos. No se creó otro proyecto ni se cargaron datos de prueba durante el despliegue.

Verificado por HTTPS: inicio de sesión con una cuenta ficticia existente, `/casa`, `/agenda`, `/avisos`, `/configuracion/reglas`, cierre de sesión mediante Server Action y `Cache-Control: private, no-cache, no-store…` en datos privados. Ningún error de ejecución JavaScript. También SW v2, caché solo pública, recarga sin red con copia autorizada y CSP en HTML, reconexión y cierre de sesión. Archivo `COFI_20261017_111504.zip`, SHA-256 `f5b392d548e7bd733363d87cdf9374de3f363c65737252137f1750fcd587cac6`, 201 archivos sin credenciales.

**Recompilación posterior a la importación completada:** `01a14aad-a7e9-71c1-b081-aab397defa72`, 17 oct 2026, 11:26 Lima. Diez comprobaciones funcionales públicas correctas a las 11:27, sin reiniciar datos. Informe en [`verificacion-hostinger.json`](verificacion-hostinger.json) y [captura del acceso](capturas/hostinger-acceso.png). El intento de reutilizar directamente el ZIP anterior falló sin logs; reponerlo mediante el helper resolvió la publicación. La lectura de variables por MCP dio 500, por lo que sus cinco claves se comprobaron en hPanel antes de escribir; la importación por MCP sí se completó.

## Actualización de vinculación directa, 17 oct 2026

Build `01a14ae0-18ff-7374-8223-6fd497974ad4` completado en el mismo Web App, sin cambiar variables ni crear recursos. Archivo `COFI_20261017_121846.zip`, 203 archivos y SHA-256 `04846004af70a87618b911a3bd8b169ffd7047497fd32f4f40c79968866395cd`; excluye credenciales y artefactos de build. Se conservó el ZIP local.

Verificados por HTTPS ambos modos de configuración desde el propio equipo, acceso dirigido, cierre adulto en ese navegador y otra pestaña, permisos, regreso automático y revocación. Informe en [`verificacion-vinculacion.json`](verificacion-vinculacion.json), instrucciones en [pantallas](pantallas.md). No se aplicaron migraciones ni se ejecutaron semillas.

## Hito C: cron y PWA

- La migración `20261017141953_reminders_automations.sql` está aplicada en desarrollo. Se verificaron activos `cofi-process-reminders` y `cofi-dispatch-push` (cada minuto), `cofi-extend-horizons` y `cofi-cleanup-anonymous`.
- `/avisos` muestra último procesamiento, atrasados y resultados de entregas. El procesamiento de recordatorios ocurre en PostgreSQL aunque nadie tenga abierta la app. El despacho Push no envía mientras no se configure el emisor y sus secretos.
- Manifest, iconos y service worker están implementados. La consulta sin conexión y las opciones de pantalla se describen en [PWA](pwa.md). El despliegue de pruebas en Hostinger usa el backend de desarrollo; la base de producción sigue pendiente.
- Para probar contra el build: `npm run build` y después `E2E_PORT=3001 E2E_PRODUCTION=1 npx playwright test <archivos>`. La suite puede usar desarrollo o producción según esa variable.
- **Pendiente:** emisor de Web Push con VAPID, autenticación del proceso, secretos en Vault y prueba real de envío. Revisar costos y solicitar autorización antes de activar recursos que puedan cobrarse.
