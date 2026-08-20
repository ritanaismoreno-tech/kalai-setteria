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

## Estado actual (2026-08-20)
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
encajó sin fricción con la base de datos de Neon ya en producción). Backend
desplegado previamente en https://pablo-rojo-setter-ia.onrender.com (Render
free + Neon free) — ese despliegue quedó con el código viejo (Pablo Rojo
hardcodeado, credenciales en env vars); **hace falta un nuevo deploy para
que refleje todo lo construido desde entonces**.

## Pendiente real (actualizado 2026-08-20)
1. **Reconectar este repo con GitHub y desplegar** — el repo local no tiene
   remoto de git configurado (la deploy key vivía en la otra máquina), y el
   despliegue en Render sigue teniendo el código de antes del pivote a
   producto genérico. Sin este paso nada de lo construido en las últimas
   sesiones está en producción.
2. Instagram (Fase B) — no construido aún, solo WhatsApp.
3. Motor de reglas automáticas para etiquetas (ahora son 100% manuales).
4. Autenticación por cuenta — hoy admin es un token compartido único
   (`ADMIN_BEARER_TOKEN`) por instancia, no hay login por cliente.
5. Meta App como "Tech Provider" (una app gestionando varias WABA de
   clientes distintos) para no repetir el proceso de verificación de Meta
   con cada cliente nuevo.
6. Onboarding sin trabajo manual por cliente — hoy cada instancia nueva
   todavía implica crear a mano repo GitHub + Neon + Render; las
   credenciales de negocio ya son self-serve, pero el aprovisionamiento de
   infraestructura no.

## Dónde está todo
- Código: este repo. Remoto anterior en
  `github.com/ritanaismoreno-tech/Pablo-Rojo-setter-IA-deply` — no
  reconectado todavía en esta máquina (ver pendiente #1).
- Base de datos: Neon (proyecto `pablo-rojo-setter-ia`, región Frankfurt) —
  tiene el esquema viejo (sin las tablas de onboarding/credentials); hace
  falta correr `npm run db:migrate` contra ella para ponerla al día.
- Hosting: Render (Blueprint desde `render.yaml`, ya actualizado).
- Plan técnico completo: `docs/plan.md`.
- Local: Postgres embebido (`npm run dev:db`) + servidor (`npm run dev`),
  puerto 3101 en esta máquina (el 3000 lo usa otro proyecto local).

## Credenciales
- `ADMIN_BEARER_TOKEN`: token de acceso al panel, uno por instancia/cliente.
- `CREDENTIALS_ENCRYPTION_KEY`: clave de cifrado de las credenciales de
  negocio (WhatsApp/Meta/Anthropic), una por instancia. Generar con
  `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`.
- Las credenciales de WhatsApp/Meta/Anthropic ya NO son variables de
  entorno — se cargan desde la pestaña Conexiones de cada instancia y
  quedan cifradas en su base de datos.
