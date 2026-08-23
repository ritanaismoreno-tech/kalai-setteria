# Kalai Setteria

Backend + panel de administración que conecta WhatsApp Cloud API (y
próximamente Instagram Messaging API) con Claude para responder a leads y
cualificarlos como un setter humano. Producto genérico: no lleva contenido
de ningún programa precargado — cada cliente configura su propia IA desde
la pestaña "Configuración" del panel, y carga sus propias credenciales de
Meta/Anthropic desde la pestaña "Conexiones". Ver `docs/plan.md` para el
detalle de arquitectura.

## Desarrollo local

```bash
cp .env.example .env   # completar PORT, DATABASE_URL, ADMIN_BEARER_TOKEN, CREDENTIALS_ENCRYPTION_KEY
npm install
npm run dev:db          # levanta un Postgres local temporal (sin Docker/Homebrew)
```

En otra terminal, usando el `DATABASE_URL` que imprime `dev:db`:

```bash
npm run db:generate     # genera migraciones a partir de src/db/schema.ts
npm run db:migrate      # las aplica
npm run dev              # arranca el servidor (tsx, con recarga en caliente)
```

Las credenciales de WhatsApp/Meta/Anthropic NO son variables de entorno —
se cargan desde la pestaña Conexiones del propio panel (`/admin`) una vez el
servidor está corriendo, y quedan cifradas en base de datos.

Para exponer el webhook a Meta durante desarrollo, usar `ngrok http 3000` (o el
puerto configurado) y apuntar el webhook de la App de Meta a esa URL.

## Producción

Pensado para desplegarse en Render (Blueprint desde `render.yaml`) + Postgres
gestionado (Neon):

```bash
npm run build
npm run db:migrate
npm start
```

Variables de entorno requeridas: `DATABASE_URL`, `ADMIN_BEARER_TOKEN`,
`CREDENTIALS_ENCRYPTION_KEY` (clave de cifrado de las credenciales de
negocio, generar con
`node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`).
`CLAUDE_MODEL` es opcional (default por instancia, sobreescribible por
cliente en Conexiones).

## Endpoints admin

Todos requieren `Authorization: Bearer $ADMIN_BEARER_TOKEN`.

- `GET /admin/conversations` — lista conversaciones
- `GET /admin/conversations/:id/messages` — historial de una conversación
- `PATCH /admin/conversations/:id/pause` / `/resume` — handoff humano
- `PATCH /admin/conversations/:id/stage` — mover de etapa en el pipeline
- `GET /admin/tags` / `POST /admin/tags` — etiquetas
- `GET|PUT /admin/onboarding/config/:section` — formulario de configuración del programa
- `POST /admin/onboarding/conversations` — subir CSV de conversaciones reales
- `POST /admin/onboarding/conversations/:batchId/map` — mapear etapas del pipeline a resultado
- `POST /admin/onboarding/generate-prompt` — generar propuesta de system prompt
- `GET /admin/system-prompt` / `PATCH /admin/system-prompt` — ver/editar el prompt activo
- `GET /admin/connections` / `PUT /admin/connections/:provider` — credenciales de WhatsApp/Meta/Anthropic
