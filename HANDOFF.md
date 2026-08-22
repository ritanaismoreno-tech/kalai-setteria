# Estado del proyecto — para retomar en otra sesión de Claude

## Qué es esto
Backend + panel de administración de SetterIA: producto genérico (no atado a
ningún programa) que conecta WhatsApp (y próximamente Instagram) a Claude
para que la IA responda y cualifique leads. Cada cliente configura su propia
IA desde cero mediante un onboarding dentro de la propia web, y carga sus
propias credenciales de Meta/Anthropic desde la pestaña Conexiones — la app
no lleva contenido ni credenciales de ningún cliente precargadas. El piloto
(Pablo Rojo / Enformix) es solo el primer cliente de prueba, no la base del
producto.

## Estado actual (2026-08-22)
- **URL definitiva de producción**: https://altiora-setteria.onrender.com
  (servicio de Render llamado "altiora.setteria" — el nombre interno lleva
  el punto que pidió Rita, pero la URL pública lo sanea a guion porque un
  punto en `onrender.com` implicaría un subdominio de verdad, que Render no
  permite crear sobre su propio dominio compartido).
- **El servicio dejó de ser Blueprint-managed**: Render bloquea el
  renombrado de servicios ligados a un Blueprint (confirmado — ni la
  automatización ni un clic manual de Rita conseguían que el botón "Save
  changes" hiciera nada, cero peticiones de red). La única forma de
  renombrar de verdad fue crear un servicio nuevo desde cero con
  "New Web Service" (no vía Blueprint), apuntando al mismo repo/rama y a la
  misma base de datos de Neon (mismas `DATABASE_URL`, `ADMIN_BEARER_TOKEN`,
  `CREDENTIALS_ENCRYPTION_KEY` — el login y los datos no cambiaron para
  Rita). Se verificó que el nuevo servicio funcionaba antes de borrar el
  viejo. `render.yaml` queda como referencia de la config pero ya no
  gestiona el deploy real (ver nota dentro del archivo).
- Los servicios viejos (`pablo-rojo-setter-ia` original y un paso
  intermedio llamado `setteria`) se borraron una vez confirmado que
  `altiora-setteria` funcionaba — ya no existen en Render.

## Estado anterior (2026-08-20)
- **Conexiones self-serve**: la pestaña "Conexiones" dejó de ser de solo
  lectura de variables de entorno. Ahora es un formulario real por
  proveedor (WhatsApp Cloud API, Meta App, Anthropic) que cada cliente
  rellena desde su propia web. Las credenciales se cifran en reposo
  (AES-256-GCM, `src/lib/crypto.ts`) con una clave `CREDENTIALS_ENCRYPTION_KEY`
  que sí sigue siendo una variable de entorno (una por instancia, generada al
  desplegar, no la ve el cliente). Guardar es un merge parcial: dejar un
  campo en blanco conserva el valor ya guardado. `env.ts` ya no exige
  `META_APP_SECRET` / `WHATSAPP_ACCESS_TOKEN` / `WHATSAPP_PHONE_NUMBER_ID` /
  `ANTHROPIC_API_KEY` / `META_WEBHOOK_VERIFY_TOKEN` — el servidor arranca sin
  ellas y cada llamada (webhook, envío de WhatsApp, Claude) las busca en la
  base de datos en el momento, devolviendo un error controlado si el cliente
  todavía no las configuró.
- **`render.yaml` actualizado** a la nueva lista de env vars (solo infra:
  `DATABASE_URL`, `ADMIN_BEARER_TOKEN`, `CREDENTIALS_ENCRYPTION_KEY`,
  `CLAUDE_MODEL`).
- **Verificado end-to-end en local**: guardar credenciales de WhatsApp/Meta/
  Anthropic desde la API y desde el navegador, merge parcial (actualizar un
  campo sin perder los demás), verify challenge y firma HMAC del webhook
  usando el secreto guardado en base de datos (ya no env var), botón
  "Generar aleatorio" para el verify token, estado "Conectado"/"Pendiente"
  correcto por proveedor, `npm run build` sin errores.

## Estado anterior (2026-08-18) — onboarding genérico
- **Pestaña "Configuración"**: las 10 secciones del formulario de programa
  (Producto, Objetivo de la IA, Links, Personalidad, Objeciones, Clientes,
  Equipo, Testimonios, Formato, Follow-ups) + un paso final opcional para
  subir conversaciones reales de los setters actuales del cliente (CSV
  formato "pipeline generator": Lead Name, Pipeline Stage, Direction, Sent
  By, Message Date, Message Text). El resultado (llegó a llamada / no llegó
  a agendar) se detecta mapeando las etapas del pipeline del cliente una
  sola vez, sin etiquetar conversación por conversación.
- **Generación de system prompt**: el paso "Generar y activar" llama a
  Claude para destilar las respuestas del formulario + hasta 40
  conversaciones reales por categoría en un system prompt final propuesto,
  editable antes de activarlo (reutiliza `PATCH /admin/system-prompt`).
- **Branding neutro**: se quitó "Pablo Rojo" hardcodeado del dashboard; el
  nombre en el header sale de `producto.nombrePrograma`.

## Estado anterior (2026-08-16) — reconstrucción del código
La carpeta llegó con `docs/`, `HANDOFF.md`, `render.yaml` y las migraciones
SQL, pero sin el código fuente. Se reconstruyó todo siguiendo `docs/plan.md`,
usando el esquema de las migraciones existentes como fuente de verdad (así
encajó sin fricción con la base de datos de Neon ya en producción).

## Desplegado (2026-08-20)
Repo reconectado (`gh` ya estaba autenticado como `ritanaismoreno-tech` en
esta máquina, no hizo falta la llave SSH de despliegue de la sesión
original). Se clonó el repo, se sincronizó el código local encima
(preservando el historial de git — commit normal, sin force push), y se
subió a `main`. Render tenía auto-deploy activo: el primer intento falló
porque faltaba `CREDENTIALS_ENCRYPTION_KEY` (esperado, ver validación en
`env.ts`); se añadió la variable en el dashboard de Render, se limpiaron las
env vars viejas que ya no se usan (`META_APP_SECRET`, `WHATSAPP_ACCESS_TOKEN`,
`WHATSAPP_PHONE_NUMBER_ID`, `ANTHROPIC_API_KEY`, `META_WEBHOOK_VERIFY_TOKEN`),
y el redeploy manual quedó **live**. Verificado desde fuera:
`/health` respondía `{"ok":true}` (la respuesta del código nuevo) y
`/admin/onboarding/config` exigía token correctamente. Este servicio
(`pablo-rojo-setter-ia`) ya no existe — ver "Estado actual" arriba, se
migró a `altiora-setteria`. Las migraciones (incluidas `program_config`,
`training_conversation_batches`, `training_messages`, `credentials`) se
aplicaron solas contra la Neon de producción como parte del `startCommand`
de `render.yaml`.

**Nota de diseño pendiente**: el repo de GitHub tenía una versión del
dashboard visualmente más pulida (tipografía propia Fraunces/Karla, paleta
más refinada, ver `public/fonts/` que sigue en el repo aunque hoy no se usa)
de la sesión original — se priorizó subir la funcionalidad nueva (onboarding
+ conexiones self-serve) sobre ese pulido visual. Pendiente si se quiere
retomar: portar el diseño visual viejo sobre la funcionalidad nueva.

## Pendiente real (actualizado 2026-08-20)
1. Instagram (Fase B) — no construido aún, solo WhatsApp.
2. Motor de reglas automáticas para etiquetas (ahora son 100% manuales).
3. Autenticación por cuenta — hoy admin es un token compartido único
   (`ADMIN_BEARER_TOKEN`) por instancia, no hay login por cliente.
4. Meta App como "Tech Provider" (una app gestionando varias WABA de
   clientes distintos) para no repetir el proceso de verificación de Meta
   con cada cliente nuevo.
5. Onboarding sin trabajo manual por cliente — hoy cada instancia nueva
   todavía implica crear a mano repo GitHub + Neon + Render; las
   credenciales de negocio ya son self-serve, pero el aprovisionamiento de
   infraestructura no.
6. Pulido visual del dashboard (ver nota de diseño arriba).

## Dónde está todo
- Código: este repo, remoto en
  `github.com/ritanaismoreno-tech/Pablo-Rojo-setter-IA-deply` (rama `main`),
  ya reconectado y al día en esta máquina.
- Base de datos: Neon (proyecto `pablo-rojo-setter-ia`, región Frankfurt),
  con el esquema al día (migraciones 0000-0004 aplicadas en producción).
- Hosting: Render, servicio "altiora.setteria" (creado manualmente, no vía
  Blueprint), **live** en https://altiora-setteria.onrender.com con el
  código actual.
- Plan técnico completo: `docs/plan.md`.
- Local: Postgres embebido (`npm run dev:db`) + servidor (`npm run dev`),
  puerto 3101 en esta máquina (el 3000 lo usa otro proyecto local).

## Credenciales
- `ADMIN_BEARER_TOKEN`: token de acceso al panel, uno por instancia/cliente.
- `CREDENTIALS_ENCRYPTION_KEY` de producción: configurada en Render (no
  reproducida aquí en texto plano). Si se pierde, las credenciales de
  WhatsApp/Meta/Anthropic guardadas quedan ilegibles y hay que recargarlas.
- `CREDENTIALS_ENCRYPTION_KEY`: clave de cifrado de las credenciales de
  negocio (WhatsApp/Meta/Anthropic), una por instancia. Generar con
  `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`.
- Las credenciales de WhatsApp/Meta/Anthropic ya NO son variables de
  entorno — se cargan desde la pestaña Conexiones de cada instancia y
  quedan cifradas en su base de datos.
