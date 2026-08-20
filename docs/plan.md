# Bot IA para WhatsApp + Instagram (SetterIA "Pablo Rojo") — v1

## Contexto

Enformix quiere reemplazar/complementar una herramienta externa (Skalex) que hoy conecta WhatsApp e Instagram a Claude para que la IA responda como "setter" (cualificador de leads) del programa Pablo Rojo (mujeres en menopausia/perimenopausia). El objetivo es tener su propia herramienta, sin depender de un tercero, y más adelante (fase 2, fuera de este plan) construir algo similar al panel de "Reportes" de Skalex para ir ajustando el comportamiento de la IA.

Decisiones ya acordadas con el cliente:
- **v1 es solo reactivo**: el bot responde a mensajes entrantes dentro de la ventana de 24h de Meta. NO inicia conversaciones nuevas (eso lo sigue haciendo la otra herramienta por ahora).
- Se usará un **número de WhatsApp Business nuevo** (no se puede reutilizar el actual porque ya está conectado a otra herramienta — un número solo admite un webhook activo a la vez).
- El **system prompt** de la IA se basará en el documento interno de tono/comportamiento de la setter de Pablo Rojo (skill `voz-pablo-rojo`), que se integrará como contenido del prompt (no se reescribe aquí).
- **Follow-ups dentro de la ventana de 24h**: si un lead no responde tras la respuesta de la IA, se puede reenganchar dentro de las 24h (ej. a las 17-18h) sin plantilla ni costo, porque sigue siendo un mensaje de sesión. Se implementa como un chequeo periódico (cron ligero), no como inicio de conversación.
- **Multi-programa**: cada programa (Pablo Rojo, y en el futuro Yago Rojo, Sara Pérez, etc.) es una **instancia separada** de este mismo proyecto — su propia base de datos, sus propias credenciales de Meta/Claude, su propio login. NO es una sola app compartida con los programas separados por una columna interna — se descartó esa opción explícitamente porque un fallo en el código de filtrado podría mezclar datos/prompts entre programas. Esto significa que el esquema y el backend actuales NO necesitan cambios para soportar multi-programa; "agregar un programa nuevo" es desplegar una copia nueva, no una migración.
- **Panel web**: se decidió NO construir el panel simple original. Terminamos primero el bot reactivo y desplegado, y luego sí construimos un dashboard real (login, pipeline por etapas, chat, pausar/reanudar, etiquetas manuales) — ver estado actual más abajo. Sigue pendiente el motor de reglas automáticas para etiquetas, la importación de CSV, y la vista de Conexiones con guardado seguro en base de datos.

## Enfoque técnico

**Stack**: Node.js + TypeScript, Express, Drizzle ORM + Postgres.

**Hosting real usado**: Render (plan free) + Neon (Postgres free) — $0/mes, sin tarjeta, como piloto antes de aprobar presupuesto. Trade-off aceptado: Render "duerme" tras 15 min sin tráfico (primera respuesta tras eso tarda 30-60s extra); Neon despierta en <1s. Cuando se apruebe presupuesto, considerar Railway (~$6-12/mes) para que quede siempre activo. `render.yaml` en la raíz del repo tiene la config lista.

**Por qué Drizzle sobre Prisma**: esquema como TypeScript plano, sin paso de generación de cliente, migraciones en SQL legible — más simple de mantener y de auditar cambios de esquema para un equipo pequeño.

## Estado del despliegue (actualizado 2026-08-04)

- Repo: `github.com/ritanaismoreno-tech/Pablo-Rojo-setter-IA-deply` (acceso vía deploy key, aislado del resto de repos de la cuenta).
- DB: Neon Postgres (Frankfurt/eu-central-1), proyecto `pablo-rojo-setter-ia`, migraciones aplicadas.
- App: Render Blueprint, servicio `pablo-rojo-setter-ia`, URL pública `https://pablo-rojo-setter-ia.onrender.com`.
- Dashboard real conectado en la raíz de esa URL: login por token, pipeline por etapas (manual), chat con historial real, pausar/reanudar IA, etiquetas manuales (crear/aplicar/quitar), vista de Conexiones con estado real (sin datos falsos).
- `ADMIN_BEARER_TOKEN` y `META_WEBHOOK_VERIFY_TOKEN` ya están configurados con valores reales generados (no son "pendiente" — son los definitivos, elegidos por nosotros, no dependen de Meta). Ambos viven como variables de entorno en Render.
- Pendientes reales (marcados "pendiente" en Render, no bloquean el resto): `META_APP_SECRET`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `ANTHROPIC_API_KEY` — se completan cuando se conecte el número de prueba de Meta y la key real de Anthropic (cuenta de Enformix, no personal).

## Estructura de carpetas

```
src/
  index.ts                      # bootstrap de Express, sirve /public como dashboard
  config/env.ts                 # validación de env vars (zod), falla rápido si faltan secretos
  webhooks/
    whatsapp.controller.ts      # GET verify + POST receive (WhatsApp)
    signature.middleware.ts     # verificación X-Hub-Signature-256 (compartida)
  adapters/
    types.ts                    # NormalizedInboundMessage / NormalizedOutboundMessage
    whatsapp.adapter.ts         # payload WA <-> formato normalizado
  services/
    claude.service.ts           # arma prompt+historial, llama a Anthropic API
    conversation.service.ts     # find-or-create contacto/conversación, pausa, etapa
    dedup.service.ts            # dedup de mensajes por platform_message_id
    systemPrompt.service.ts     # carga el prompt activo (DB + cache en memoria, TTL 60s)
    followUp.service.ts         # scheduler de seguimiento dentro de 24h
    tag.service.ts              # crear/aplicar/quitar etiquetas
  senders/
    whatsapp.sender.ts          # POST a Graph API /messages (WA)
  admin/
    conversation.controller.ts  # pause/resume/stage/tags
    systemPrompt.controller.ts  # ver/editar el prompt activo
    connections.controller.ts   # estado real de conexiones (sin exponer secretos)
    tag.controller.ts           # listar/crear etiquetas
    auth.middleware.ts          # bearer token compartido para endpoints internos
  db/
    schema.ts                   # esquema Drizzle
    client.ts                   # instancia de Drizzle
    migrations/
  lib/
    logger.ts                   # pino
    errors.ts
  types/meta.ts                 # tipos de payloads crudos de Meta
public/                         # dashboard estático (HTML/CSS/JS), servido por Express
```

Raíz: `package.json`, `tsconfig.json`, `drizzle.config.ts`, `.env.example`, `render.yaml`.

## Esquema de base de datos (Postgres, vía Drizzle)

- **`contacts`**: `id`, `platform` (whatsapp|instagram), `external_id` (wa_id o IGSID), `display_name`, `phone_number`, timestamps. Único por (`platform`, `external_id`).
- **`conversations`**: `id`, `contact_id` (fk), `platform`, `status` (active|paused|closed), `stage` (nuevos|conversacion|cualificados|agendados|perdidos — manual por ahora), `paused_at`, `paused_by`, `last_message_at`, `last_inbound_at`, `follow_ups_sent`, `system_prompt_version_id` (fk), timestamps.
- **`messages`**: `id`, `conversation_id` (fk), `role` (user|assistant|system_note), `content`, `platform_message_id`, `direction` (inbound|outbound), `raw_payload` (jsonb), `created_at`.
- **`processed_webhook_events`**: dedup por `platform_message_id` único.
- **`system_prompts`**: `id`, `version`, `content`, `is_active`, `created_at`, `created_by`.
- **`tags`**: `id`, `name`, `color`, `created_at`.
- **`conversation_tags`**: join table `conversation_id` + `tag_id`, único por par.

## Flujo de procesamiento (webhook → respuesta enviada)

1. Meta hace POST a `/webhooks/whatsapp`.
2. Middleware verifica `X-Hub-Signature-256` contra el body crudo usando `META_APP_SECRET`. Si no coincide → 401.
3. El adapter parsea el payload a `NormalizedInboundMessage`. Mensajes no-texto en v1: se registran pero no se procesan con Claude.
4. **Dedup**: insert en `processed_webhook_events`. Si ya existe (reintento de Meta) → responde 200 y corta ahí mismo.
5. Find-or-create de `contact` + `conversation`.
6. **Chequeo de pausa**: si `status === 'paused'`, se guarda el mensaje pero NO se llama a Claude.
7. Se persiste el mensaje entrante.
8. Se carga el system prompt activo (cacheado) + últimos 20 mensajes como historial.
9. Se llama a Claude (`claude-sonnet-5`, configurable por env var).
10. Se persiste y envía la respuesta.
11. Responde 200 a Meta.

Errores tras el dedup: se loguean pero igual se responde 200.

## Procesamiento síncrono (sin cola)

Para este volumen (~20 conversaciones/día) se procesa todo dentro del mismo request del webhook — sin BullMQ/Redis. Revisitar solo si el volumen crece un orden de magnitud.

## Checklist de configuración en Meta (lo hace el cliente, self-serve)

Actualizado 2026-08-20: ya no es Rita quien completa variables de entorno en
Render — cada cliente hace esto desde la pestaña Conexiones de su propia
instancia (`PUT /admin/connections/:provider`, credenciales cifradas en
`credentials` con `src/lib/crypto.ts`).

1. Confirmar/crear cuenta de Meta Business Manager.
2. Crear App en Meta for Developers (tipo Business), agregar productos WhatsApp e Instagram.
3. Dar de alta el **número nuevo** de WhatsApp Business, verificarlo.
4. Generar token de acceso permanente (System User); anotar `phone_number_id` y `WABA ID`.
5. Confirmar que la cuenta de Instagram sea Business/Creator, vinculada a una Página de Facebook.
6. Solicitar permiso `instagram_manage_messages` vía App Review — iniciar temprano, puede tardar días.
7. Obtener el App Secret (App Settings → Basic).
8. En la pestaña Conexiones de su instancia, el cliente carga: WhatsApp
   (`phoneNumberId`, `accessToken`, `wabaId`), Meta (`appSecret` y un
   `webhookVerifyToken` que él mismo elige o genera con el botón "Generar
   aleatorio"), y Anthropic (`apiKey`, `model` opcional).
9. Configurar el webhook en Meta apuntando a `https://<su-instancia>.onrender.com/webhooks/whatsapp`,
   con el mismo `webhookVerifyToken` que cargó en el paso 8.

Lo único que sigue siendo variable de entorno (infraestructura, no del
cliente): `DATABASE_URL`, `ADMIN_BEARER_TOKEN`, `CREDENTIALS_ENCRYPTION_KEY`,
`CLAUDE_MODEL` (default, sobreescribible por el cliente en Conexiones).

## Pendiente / próximos pasos

- ~~Conexiones self-serve~~ — resuelto 2026-08-20: pestaña Conexiones
  editable, credenciales cifradas en base de datos, sin variables de entorno
  por cliente.
- Reconectar el repo con GitHub y desplegar — el despliegue en Render
  todavía tiene el código de antes del pivote a producto genérico.
- Conectar número de prueba de Meta (gratis, sin riesgo) para validar con mensajes reales.
- Instagram (Fase B): mismo patrón que WhatsApp gracias a la capa de adapters, adapter/sender/controller nuevos.
- Motor de reglas automáticas para etiquetas (ahora mismo son 100% manuales).
- Importación de leads por CSV + envío individual de plantilla (para iniciar conversaciones, no confundir con el CSV de conversaciones de entrenamiento del onboarding).
- Selección múltiple en el pipeline (exportar/mover/seguimiento en lote).
- Autenticación por cuenta (hoy es un token compartido por instancia).
- Meta App como "Tech Provider" para no repetir verificación de Meta por cliente.
- Onboarding sin trabajo manual de infraestructura por cliente (hoy crear una instancia nueva sigue implicando GitHub + Neon + Render a mano).

## Verificación

- Probar el challenge de verificación (`GET /webhooks/whatsapp` con `hub.verify_token`).
- Enviar un mensaje real desde el número de prueba de Meta → confirmar que llega, se guarda, la IA responde, y aparece en el dashboard.
- Reenviar el mismo webhook (simulando un reintento) → confirmar que el dedup evita una segunda respuesta.
- Pausar una conversación desde el dashboard y confirmar que un nuevo mensaje entrante no genera respuesta automática.
