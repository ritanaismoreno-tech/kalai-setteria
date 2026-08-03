# Pablo Rojo — SetterIA (v1, reactivo)

Backend que conecta WhatsApp Cloud API (y próximamente Instagram Messaging API)
con Claude para responder a leads del programa Pablo Rojo. Ver el plan completo
en `docs/` y el brief de contenido en [docs/system-prompt-brief.md](docs/system-prompt-brief.md).

## Desarrollo local

```bash
cp .env.example .env   # completar con credenciales reales
npm install
npm run dev:db          # levanta un Postgres local temporal (sin Docker/Homebrew)
```

En otra terminal, usando el `DATABASE_URL` que imprime `dev:db`:

```bash
npm run db:generate     # genera migraciones a partir de src/db/schema.ts
npm run db:migrate      # las aplica
npm run dev              # arranca el servidor (tsx, con recarga en caliente)
```

Para exponer el webhook a Meta durante desarrollo, usar `ngrok http 3000` (o el
puerto configurado) y apuntar el webhook de la App de Meta a esa URL.

## Producción

Pensado para desplegarse en Railway (Node + addon de Postgres gestionado):

```bash
npm run build
npm start
```

## Endpoints admin

Todos requieren `Authorization: Bearer $ADMIN_BEARER_TOKEN`.

- `GET /admin/conversations` — lista conversaciones
- `GET /admin/conversations/:id/messages` — historial de una conversación
- `PATCH /admin/conversations/:id/pause` / `/resume` — handoff humano
- `GET /admin/system-prompt` / `PATCH /admin/system-prompt` — ver/editar el prompt activo
