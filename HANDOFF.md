# Estado del proyecto — para retomar en otra sesión de Claude

## Qué es esto
Backend + panel de administración para SetterIA (Pablo Rojo): conecta WhatsApp
(y próximamente Instagram) a Claude para que la IA responda y cualifique leads.

## Estado actual (2026-08-04)
- **Backend construido y desplegado**: https://pablo-rojo-setter-ia.onrender.com
  (Render free + Neon Postgres free — ver `render.yaml` y el plan técnico).
- **Dashboard real conectado**: login por token, pipeline por etapas, chat,
  pausar/reanudar IA, etiquetas manuales. Todo funcional, sin datos falsos.
- **Pendiente real**:
  1. Credenciales de Meta (WhatsApp Business API, Instagram) — checklist en
     el plan técnico. Ahora mismo están en "pendiente" en las variables de
     entorno de Render.
  2. API key real de Anthropic (cuenta de Enformix, no la personal).
  3. Contenido real del system prompt — brief en Google Docs
     ("Brief de contenido — SetterIA evergreen (Pablo Rojo)"), todavía sin
     rellenar.
  4. Instagram (Fase B) — no construido aún, solo WhatsApp.
  5. Motor de reglas automáticas para etiquetas (ahora son 100% manuales).

## Dónde está todo
- Código: este repo, remoto en `github.com/ritanaismoreno-tech/Pablo-Rojo-setter-IA-deply`
- Base de datos: Neon (proyecto `pablo-rojo-setter-ia`, región Frankfurt)
- Hosting: Render (Blueprint desde `render.yaml`)
- Plan técnico completo: pídele a Claude que lo relea desde
  `~/.claude/plans/` o pide un resumen — ahí está el detalle de arquitectura,
  decisiones tomadas (multi-programa = instancias separadas, no multi-tenant)
  y checklist de Meta.

## Credenciales generadas (ya reales, no cambian)
`ADMIN_BEARER_TOKEN` y `META_WEBHOOK_VERIFY_TOKEN` están configuradas en
Render — no hace falta regenerarlas, solo consultarlas ahí si se necesitan.
