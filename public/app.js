const STAGES = [
  { key: "nuevos", label: "Nuevos" },
  { key: "conversacion", label: "Conversación" },
  { key: "cualificados", label: "Cualificados" },
  { key: "agendados", label: "Agendados" },
  { key: "perdidos", label: "Perdidos" },
];

const TAG_COLORS = ["#5c7285", "#7a5c85", "#5c8577", "#85705c", "#85615c", "#5c7085"];

const state = {
  token: localStorage.getItem("setteria_token") || "",
  conversations: [],
  tags: [],
  selectedConversationId: null,
  selectedColor: TAG_COLORS[0],
};

const $ = (sel) => document.querySelector(sel);

async function api(path, options = {}) {
  const res = await fetch(`/admin${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${state.token}`,
      ...(options.headers || {}),
    },
  });
  if (res.status === 401) {
    logout();
    throw new Error("No autorizado");
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Error ${res.status}`);
  }
  return res.status === 204 ? null : res.json();
}

function logout() {
  state.token = "";
  localStorage.removeItem("setteria_token");
  $("#app").hidden = true;
  $("#login-screen").hidden = false;
}

async function login(token) {
  state.token = token;
  try {
    await loadAll();
    localStorage.setItem("setteria_token", token);
    $("#login-screen").hidden = true;
    $("#app").hidden = false;
  } catch (err) {
    $("#login-error").hidden = false;
  }
}

async function loadAll() {
  const [convRes, tagsRes, configRes] = await Promise.all([
    api("/conversations"),
    api("/tags"),
    api("/onboarding/config"),
  ]);
  state.conversations = convRes.conversations;
  state.tags = tagsRes.tags;
  renderPipeline();
  updateBrandSub(configRes.config);
}

function updateBrandSub(config) {
  const nombre = config?.producto?.nombrePrograma;
  $("#brand-sub").textContent = nombre && nombre.trim() ? nombre : "Sin configurar";
}

function renderPipeline() {
  const container = $("#pipeline-columns");
  container.innerHTML = "";

  for (const stage of STAGES) {
    const col = document.createElement("div");
    col.className = "pipeline-column";

    const leads = state.conversations.filter((c) => c.stage === stage.key);

    col.innerHTML = `
      <div class="pipeline-column-header">
        <span>${stage.label}</span>
        <span class="pipeline-column-count">${leads.length}</span>
      </div>
      <div class="pipeline-cards"></div>
    `;

    const cardsEl = col.querySelector(".pipeline-cards");
    if (leads.length === 0) {
      cardsEl.innerHTML = `<div class="empty-hint">Sin conversaciones</div>`;
    }

    for (const lead of leads) {
      const card = document.createElement("div");
      card.className = `lead-card${lead.status === "paused" ? " paused" : ""}`;
      card.innerHTML = `
        <div class="lead-card-top">
          <span class="lead-card-name">${escapeHtml(lead.contact.displayName || lead.contact.phoneNumber || lead.contact.externalId)}</span>
          <span class="lead-card-platform">${lead.platform === "whatsapp" ? "WhatsApp" : "Instagram"}</span>
        </div>
        <div class="lead-card-snippet">${lead.status === "paused" ? "⏸ IA pausada" : "Toca para ver la conversación"}</div>
        <div class="lead-card-tags">
          ${lead.tags.map((t) => tagChipHtml(t)).join("")}
        </div>
      `;
      card.addEventListener("click", () => openChat(lead.id));
      cardsEl.appendChild(card);
    }

    container.appendChild(col);
  }
}

function tagChipHtml(tag, removable = false) {
  return `<span class="tag-chip${removable ? " removable" : ""}" data-tag-id="${tag.id}" style="background:${tag.color}">${escapeHtml(tag.name)}</span>`;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

async function openChat(conversationId) {
  state.selectedConversationId = conversationId;
  const lead = state.conversations.find((c) => c.id === conversationId);
  if (!lead) return;

  const displayName = lead.contact.displayName || lead.contact.phoneNumber || lead.contact.externalId;

  $("#chat-backdrop").hidden = false;
  $("#chat-panel").hidden = false;
  $("#chat-avatar").textContent = displayName.trim().slice(0, 1) || "?";
  $("#chat-contact-name").textContent = displayName;
  $("#chat-contact-meta").textContent = `${lead.platform === "whatsapp" ? "WhatsApp" : "Instagram"} · ${lead.contact.phoneNumber || lead.contact.externalId}`;
  $("#chat-stage-select").value = lead.stage;
  $("#chat-pause-btn").textContent = lead.status === "paused" ? "Reanudar IA" : "Pausar IA";
  $("#chat-pause-btn").dataset.paused = lead.status === "paused" ? "1" : "0";

  renderChatTags(lead.tags);
  renderTagSelect();

  const { messages } = await api(`/conversations/${conversationId}/messages`);
  const messagesEl = $("#chat-messages");
  messagesEl.innerHTML = messages
    .map((m) => {
      const bubbleClass = m.role === "assistant" ? "msg-assistant" : "msg-user";
      const time = new Date(m.createdAt).toLocaleString("es-ES", { hour: "2-digit", minute: "2-digit" });
      return `<div class="msg-bubble ${bubbleClass}"><div class="msg-body"><span class="msg-text">${escapeHtml(m.content)}</span><span class="msg-time">${time}</span></div></div>`;
    })
    .join("");
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function closeChat() {
  $("#chat-panel").hidden = true;
  $("#chat-backdrop").hidden = true;
  state.selectedConversationId = null;
}

function renderChatTags(tags) {
  $("#chat-tags").innerHTML = tags.map((t) => tagChipHtml(t, true)).join("");
  $("#chat-tags").querySelectorAll(".tag-chip").forEach((el) => {
    el.addEventListener("click", async () => {
      await api(`/conversations/${state.selectedConversationId}/tags/${el.dataset.tagId}`, { method: "DELETE" });
      await loadAll();
      openChat(state.selectedConversationId);
    });
  });
}

function renderTagSelect() {
  const select = $("#chat-tag-select");
  select.innerHTML = state.tags.map((t) => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join("");
}

function renderConnections(connections) {
  const container = $("#connections-list");
  container.innerHTML = connections
    .map((c) => {
      const fieldsHtml = (c.fields || [])
        .map(
          (f) => `
        <div class="form-field">
          <label for="conn-${c.provider}-${f.key}">${escapeHtml(f.label)}</label>
          <input
            type="${f.secret ? "password" : "text"}"
            id="conn-${c.provider}-${f.key}"
            placeholder="${f.hasValue ? `Ya configurado (${escapeHtml(f.value)}) — deja en blanco para no cambiarlo` : "Sin configurar"}"
          />
          ${f.key === "webhookVerifyToken" ? `<button type="button" class="btn btn-ghost btn-small conn-gen-token-btn" data-target="conn-${c.provider}-${f.key}">Generar aleatorio</button>` : ""}
        </div>`,
        )
        .join("");

      return `
        <div class="connection-card">
          <div class="connection-card-top">
            <span class="connection-name">${escapeHtml(c.name)}</span>
          </div>
          <div class="connection-status">
            <span class="status-dot ${c.configured ? "on" : "off"}"></span>
            ${c.configured ? "Conectado" : "Pendiente de configurar"}
          </div>
          ${c.note ? `<div class="connection-note">${escapeHtml(c.note)}</div>` : ""}
          ${fieldsHtml ? `<form class="conn-form" data-provider="${c.provider}">${fieldsHtml}
            <div class="form-actions">
              <button type="submit" class="btn btn-primary btn-small">Guardar</button>
              <span class="save-status conn-save-status">Guardado</span>
            </div>
          </form>` : ""}
        </div>
      `;
    })
    .join("");

  container.querySelectorAll(".conn-gen-token-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const input = document.getElementById(btn.dataset.target);
      input.type = "text";
      input.value = Array.from({ length: 24 }, () => Math.floor(Math.random() * 36).toString(36)).join("");
    });
  });

  container.querySelectorAll(".conn-form").forEach((form) => {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const provider = form.dataset.provider;
      const inputs = form.querySelectorAll("input");
      const body = {};
      inputs.forEach((input) => {
        const key = input.id.replace(`conn-${provider}-`, "");
        if (input.value.trim()) body[key] = input.value.trim();
      });

      await api(`/connections/${provider}`, { method: "PUT", body: JSON.stringify(body) });
      const status = form.querySelector(".conn-save-status");
      status.classList.add("show");
      setTimeout(() => status.classList.remove("show"), 1800);

      const { connections } = await api("/connections");
      renderConnections(connections);
    });
  });
}

function setupTabs() {
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const tab = btn.dataset.tab;
      $("#tab-pipeline").hidden = tab !== "pipeline";
      $("#tab-configuracion").hidden = tab !== "configuracion";
      $("#tab-conexiones").hidden = tab !== "conexiones";
      if (tab === "conexiones") {
        const { connections } = await api("/connections");
        renderConnections(connections);
      }
      if (tab === "configuracion") {
        await initOnboarding();
      }
    });
  });
}

function setupEvents() {
  $("#login-btn").addEventListener("click", () => {
    $("#login-error").hidden = true;
    const token = $("#token-input").value.trim();
    if (token) login(token);
  });
  $("#token-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") $("#login-btn").click();
  });
  $("#logout-btn").addEventListener("click", logout);
  $("#chat-close-btn").addEventListener("click", closeChat);
  $("#chat-backdrop").addEventListener("click", closeChat);

  $("#chat-pause-btn").addEventListener("click", async () => {
    const isPaused = $("#chat-pause-btn").dataset.paused === "1";
    const action = isPaused ? "resume" : "pause";
    await api(`/conversations/${state.selectedConversationId}/${action}`, { method: "PATCH" });
    await loadAll();
    openChat(state.selectedConversationId);
  });

  $("#chat-stage-select").addEventListener("change", async (e) => {
    await api(`/conversations/${state.selectedConversationId}/stage`, {
      method: "PATCH",
      body: JSON.stringify({ stage: e.target.value }),
    });
    await loadAll();
  });

  $("#chat-tag-add-btn").addEventListener("click", async () => {
    const tagId = $("#chat-tag-select").value;
    if (!tagId) return;
    await api(`/conversations/${state.selectedConversationId}/tags`, {
      method: "POST",
      body: JSON.stringify({ tagId }),
    });
    await loadAll();
    openChat(state.selectedConversationId);
  });

  $("#chat-tag-new-btn").addEventListener("click", openTagModal);
  $("#tag-modal-cancel").addEventListener("click", closeTagModal);
  $("#tag-modal-save").addEventListener("click", saveNewTag);
}

function openTagModal() {
  $("#tag-name-input").value = "";
  state.selectedColor = TAG_COLORS[0];
  const swatches = $("#color-swatches");
  swatches.innerHTML = TAG_COLORS.map(
    (c, i) => `<div class="color-swatch${i === 0 ? " selected" : ""}" data-color="${c}" style="background:${c}"></div>`,
  ).join("");
  swatches.querySelectorAll(".color-swatch").forEach((el) => {
    el.addEventListener("click", () => {
      swatches.querySelectorAll(".color-swatch").forEach((s) => s.classList.remove("selected"));
      el.classList.add("selected");
      state.selectedColor = el.dataset.color;
    });
  });
  $("#tag-modal").hidden = false;
}

function closeTagModal() {
  $("#tag-modal").hidden = true;
}

async function saveNewTag() {
  const name = $("#tag-name-input").value.trim();
  if (!name) return;
  await api("/tags", { method: "POST", body: JSON.stringify({ name, color: state.selectedColor }) });
  closeTagModal();
  const tagsRes = await api("/tags");
  state.tags = tagsRes.tags;
  renderTagSelect();
}

// ---------------------------------------------------------------------------
// Onboarding: configuración del programa + conversaciones reales de entrenamiento
// ---------------------------------------------------------------------------

const ONBOARDING_SECTIONS = [
  {
    key: "producto",
    title: "Producto / Programa",
    hint: "Qué vendes y a quién.",
    fields: [
      { key: "nombrePrograma", label: "Nombre oficial del programa", type: "text" },
      { key: "queEs", label: "Qué es el programa (2-3 frases)", type: "textarea" },
      { key: "queIncluye", label: "Qué incluye exactamente (sesiones, módulos, duración, formato)", type: "textarea" },
      { key: "icpEdad", label: "Perfil de cliente ideal — rango de edad", type: "text" },
      { key: "icpSituacion", label: "Perfil de cliente ideal — situación / problema actual", type: "textarea" },
      { key: "icpMotivacion", label: "Perfil de cliente ideal — motivación principal", type: "textarea" },
      { key: "transformacionAntes", label: "Transformación — situación ANTES", type: "textarea" },
      { key: "transformacionDespues", label: "Transformación — situación DESPUÉS", type: "textarea" },
      { key: "autoridad", label: "Autoridad (credenciales, logros, números concretos)", type: "textarea" },
      { key: "exclusiones", label: "Quién NO es apto (edad, salud, perfil)", type: "textarea" },
    ],
  },
  {
    key: "objetivoIa",
    title: "Objetivo de la IA",
    hint: "Qué debe lograr la IA en cada conversación.",
    fields: [
      { key: "objetivoUnico", label: "Objetivo único de la IA al responder a un lead", type: "textarea" },
      { key: "sistemaCualificacion", label: "Sistema de cualificación (edad, situación, disposición económica)", type: "textarea" },
      { key: "precioRango", label: "Precio del programa (rango, para cualificación económica)", type: "text" },
      { key: "preguntasDiagnostico", label: "Preguntas de diagnóstico que hace la IA", type: "textarea" },
    ],
  },
  {
    key: "links",
    title: "Links / Cierre",
    fields: [
      { key: "linkAgenda", label: "Link de agenda (Calendly u otro)", type: "text" },
      { key: "otrosLinks", label: "Otros links relevantes (VSL, comunidad, etc.)", type: "textarea" },
      { key: "mensajePropuestaLlamada", label: "Mensaje de propuesta de videollamada", type: "textarea" },
      { key: "mensajeEnvioLink", label: "Mensaje de envío del link", type: "textarea" },
      { key: "queHaceTrasConfirmar", label: "Qué hace la IA justo después de que el lead confirma agendado", type: "textarea" },
    ],
  },
  {
    key: "personalidad",
    title: "Personalidad",
    fields: [
      { key: "hablaComo", label: "La IA habla como (en nombre propio del dueño / equipo genérico)", type: "text" },
      { key: "tonoGeneral", label: "Tono general (adjetivos concretos)", type: "textarea" },
      { key: "registro", label: "Registro (tuteo/usted, longitud típica de mensajes, uso de emojis)", type: "textarea" },
      { key: "vocabularioMarca", label: "Vocabulario de marca (una expresión por línea, con contexto de uso)", type: "textarea" },
      { key: "expresionesProhibidas", label: "Expresiones prohibidas (y qué usar en su lugar)", type: "textarea" },
      { key: "respuestaSiEsBot", label: "Respuesta exacta si el lead pregunta si es un bot/IA", type: "textarea" },
    ],
  },
  {
    key: "objeciones",
    title: "Objeciones",
    fields: [
      { key: "protocoloSaludLegal", label: 'Protocolo especial (salud, legal...) o "No aplica"', type: "textarea" },
      { key: "manejoObjecionesFrecuentes", label: "Manejo de objeciones frecuentes (precio, tiempo, dudas)", type: "textarea" },
    ],
  },
  {
    key: "clientes",
    title: "Clientes existentes",
    fields: [
      { key: "comoIdentificar", label: "Cómo identificar si el lead ya es cliente", type: "textarea" },
      { key: "queHaceConClienteActual", label: "Qué hace la IA con un cliente actual que escribe", type: "textarea" },
      { key: "tratamientoExClientes", label: "Tratamiento de ex-clientes / clientes de otros programas", type: "textarea" },
    ],
  },
  {
    key: "equipo",
    title: "Equipo",
    fields: [
      { key: "nombreCierre", label: "Nombre de quien hace las videollamadas de cierre", type: "text" },
      { key: "comoSePresenta", label: "Cómo la presenta la IA al lead", type: "textarea" },
      { key: "tiempoContacto", label: "En cuánto tiempo contacta el equipo tras agendar", type: "text" },
    ],
  },
  {
    key: "testimonios",
    title: "Testimonios",
    fields: [
      { key: "testimonios", label: "3-6 testimonios reales (uno por línea: nombre — resultado concreto)", type: "textarea" },
    ],
  },
  {
    key: "formato",
    title: "Ajustes de formato",
    fields: [
      { key: "personaGramatical", label: "Persona gramatical, uso de signos (¿¡, dos puntos, rayas)", type: "textarea" },
      { key: "tuteoUsted", label: "Tuteo / usted", type: "text" },
      { key: "emojis", label: "Uso de emojis", type: "text" },
      { key: "canales", label: "Canales (WhatsApp / Instagram / ambos)", type: "text" },
    ],
  },
  {
    key: "followUps",
    title: "Follow-ups",
    hint: "Dentro de la ventana de 24h — sin plantilla, sin costo.",
    fields: [
      { key: "cantidad", label: "¿Cuántos follow-ups en total?", type: "text" },
      { key: "tiempoPrimerFollowUp", label: "Tiempo desde el último mensaje de la IA sin respuesta", type: "text" },
      { key: "mensajeFollowUp", label: "Mensaje del follow-up (tono recordatorio amistoso)", type: "textarea" },
      { key: "queHaceSiExpira", label: "Qué hace la IA si expira la ventana de 24h sin respuesta", type: "textarea" },
    ],
  },
];

const OUTCOME_LABELS = {
  ignored: "Ignorar (no usar)",
  reached_call: "Llegó a llamada",
  not_scheduled: "No llegó a agendar",
};

const onboardingState = {
  config: null,
  currentStep: "producto",
  currentBatch: null, // { batch, distinctStages, stageSelections }
};

async function initOnboarding() {
  const { config } = await api("/onboarding/config");
  onboardingState.config = config;
  updateBrandSub(config);
  renderOnboardingSteps();
  renderOnboardingContent();
}

function isSectionFilled(sectionKey) {
  const data = onboardingState.config?.[sectionKey];
  if (!data) return false;
  return Object.values(data).some((v) => typeof v === "string" && v.trim().length > 0);
}

function renderOnboardingSteps() {
  const nav = $("#onboarding-steps");
  const stepDefs = [
    ...ONBOARDING_SECTIONS.map((s) => ({ key: s.key, title: s.title, done: isSectionFilled(s.key) })),
    { key: "conversaciones", title: "Conversaciones reales", done: false },
    { key: "prompt", title: "Generar y activar", done: false },
  ];

  nav.innerHTML = stepDefs
    .map(
      (s) => `
      <button class="onboarding-step-btn${s.key === onboardingState.currentStep ? " active" : ""}" data-step="${s.key}">
        <span class="onboarding-step-dot${s.done ? " done" : ""}">${s.done ? "✓" : ""}</span>
        ${escapeHtml(s.title)}
      </button>`,
    )
    .join("");

  nav.querySelectorAll(".onboarding-step-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      onboardingState.currentStep = btn.dataset.step;
      renderOnboardingSteps();
      renderOnboardingContent();
    });
  });
}

function renderOnboardingContent() {
  const step = onboardingState.currentStep;
  if (step === "conversaciones") return renderConversationsStep();
  if (step === "prompt") return renderPromptStep();
  return renderSectionStep(step);
}

function renderSectionStep(sectionKey) {
  const section = ONBOARDING_SECTIONS.find((s) => s.key === sectionKey);
  const content = $("#onboarding-content");
  const data = onboardingState.config?.[sectionKey] || {};

  content.innerHTML = `
    <h2>${escapeHtml(section.title)}</h2>
    ${section.hint ? `<p class="section-hint">${escapeHtml(section.hint)}</p>` : ""}
    <form id="onboarding-form">
      ${section.fields
        .map(
          (f) => `
        <div class="form-field">
          <label for="field-${f.key}">${escapeHtml(f.label)}</label>
          ${
            f.type === "textarea"
              ? `<textarea id="field-${f.key}" name="${f.key}">${escapeHtml(data[f.key] || "")}</textarea>`
              : `<input type="text" id="field-${f.key}" name="${f.key}" value="${escapeHtml(data[f.key] || "")}" />`
          }
        </div>`,
        )
        .join("")}
      <div class="form-actions">
        <button type="submit" class="btn btn-primary">Guardar sección</button>
        <span class="save-status" id="save-status">Guardado</span>
      </div>
    </form>
  `;

  $("#onboarding-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const formData = {};
    for (const f of section.fields) {
      formData[f.key] = $(`#field-${f.key}`).value;
    }
    const { config } = await api(`/onboarding/config/${sectionKey}`, {
      method: "PUT",
      body: JSON.stringify(formData),
    });
    onboardingState.config = config;
    const status = $("#save-status");
    status.classList.add("show");
    setTimeout(() => status.classList.remove("show"), 1800);
    renderOnboardingSteps();
  });
}

async function renderConversationsStep() {
  const content = $("#onboarding-content");
  content.innerHTML = `
    <h2>Conversaciones reales</h2>
    <p class="section-hint">Opcional, pero es el paso más importante si quieres que la IA responda tal cual lo haría tu equipo actual.</p>
    <div class="warning-callout">
      Este paso es opcional. Sin conversaciones reales, la IA seguirá las instrucciones que escribiste en las secciones anteriores, pero no habrá visto a tu equipo de setters trabajando de verdad — puede que no replique exactamente su forma de responder.
    </div>
    <div class="upload-box">
      <p><strong>Sube un CSV</strong> con columnas: Lead Name, Pipeline Stage, Direction, Sent By, Message Date, Message Text.</p>
      <input type="file" id="csv-file-input" accept=".csv,text/csv" />
    </div>
    <div id="stage-mapping-area"></div>
    <h2 style="margin-top:28px;">Lotes subidos</h2>
    <div id="batches-list"></div>
  `;

  $("#csv-file-input").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const csvText = await file.text();
    const result = await api("/onboarding/conversations", {
      method: "POST",
      body: JSON.stringify({ fileName: file.name, csvText }),
    });
    onboardingState.currentBatch = {
      batch: result.batch,
      distinctStages: result.distinctStages,
      stageSelections: Object.fromEntries(result.distinctStages.map((s) => [s, "ignored"])),
    };
    renderStageMapping();
    await renderBatchesList();
  });

  await renderBatchesList();
}

function renderStageMapping() {
  const area = $("#stage-mapping-area");
  const current = onboardingState.currentBatch;
  if (!current) {
    area.innerHTML = "";
    return;
  }

  area.innerHTML = `
    <h2 style="margin-top:20px;">Etapas encontradas en "${escapeHtml(current.batch.fileName || "archivo")}"</h2>
    <p class="section-hint">${current.batch.distinctLeadCount} conversaciones, ${current.batch.totalRows} mensajes. Indica qué significa cada etapa de tu pipeline.</p>
    ${current.distinctStages
      .map(
        (stage) => `
      <div class="stage-map-row">
        <span>${escapeHtml(stage)}</span>
        <select class="select stage-select" data-stage="${escapeHtml(stage)}">
          ${Object.entries(OUTCOME_LABELS)
            .map(([value, label]) => `<option value="${value}">${label}</option>`)
            .join("")}
        </select>
      </div>`,
      )
      .join("")}
    <div class="form-actions">
      <button id="save-stage-map-btn" class="btn btn-primary">Guardar mapeo</button>
    </div>
  `;

  area.querySelectorAll(".stage-select").forEach((sel) => {
    sel.addEventListener("change", () => {
      current.stageSelections[sel.dataset.stage] = sel.value;
    });
  });

  $("#save-stage-map-btn").addEventListener("click", async () => {
    const stageMap = Object.fromEntries(
      Object.entries(current.stageSelections).filter(([, v]) => v !== "ignored"),
    );
    await api(`/onboarding/conversations/${current.batch.id}/map`, {
      method: "POST",
      body: JSON.stringify({ stageMap: current.stageSelections }),
    });
    onboardingState.currentBatch = null;
    $("#stage-mapping-area").innerHTML = "";
    await renderBatchesList();
  });
}

async function renderBatchesList() {
  const { batches } = await api("/onboarding/conversations");
  const list = $("#batches-list");
  if (!list) return;

  if (batches.length === 0) {
    list.innerHTML = `<div class="empty-hint">Todavía no se ha subido ningún lote</div>`;
    return;
  }

  list.innerHTML = batches
    .map(
      (b) => `
    <div class="batch-card">
      <div class="batch-card-top">
        <span>${escapeHtml(b.fileName || "Archivo sin nombre")}</span>
        <span>${b.status === "mapped" ? "Mapeado" : "Sin mapear"}</span>
      </div>
      <div class="batch-counts">
        <span>Llegaron a llamada: ${b.summary.counts.reached_call}</span>
        <span>No agendaron: ${b.summary.counts.not_scheduled}</span>
        <span>Total conversaciones: ${b.summary.leadCount}</span>
      </div>
    </div>`,
    )
    .join("");
}

function renderPromptStep() {
  const content = $("#onboarding-content");
  content.innerHTML = `
    <h2>Generar y activar el system prompt</h2>
    <p class="section-hint">
      Combina lo que escribiste en las secciones anteriores con las conversaciones reales que hayas subido y mapeado,
      y propone el system prompt final. Revísalo y edítalo antes de activarlo — se puede volver a generar cuando quieras.
    </p>
    <div class="form-actions" style="margin-bottom: 16px;">
      <button id="generate-prompt-btn" class="btn btn-primary">Generar propuesta</button>
      <span id="generate-status" class="save-status"></span>
    </div>
    <textarea id="draft-textarea" class="draft-textarea" placeholder="Aquí aparecerá el system prompt propuesto..."></textarea>
    <div class="form-actions" style="margin-top: 14px;">
      <button id="activate-prompt-btn" class="btn btn-secondary">Activar este prompt</button>
      <span id="activate-status" class="save-status"></span>
    </div>
  `;

  $("#generate-prompt-btn").addEventListener("click", async () => {
    const btn = $("#generate-prompt-btn");
    const status = $("#generate-status");
    btn.disabled = true;
    status.textContent = "Generando… puede tardar unos segundos";
    status.classList.add("show");
    try {
      const { draft } = await api("/onboarding/generate-prompt", { method: "POST" });
      $("#draft-textarea").value = draft;
      status.textContent = "Propuesta generada, revísala abajo";
    } catch (err) {
      status.textContent = `Error: ${err.message}`;
    } finally {
      btn.disabled = false;
      setTimeout(() => status.classList.remove("show"), 4000);
    }
  });

  $("#activate-prompt-btn").addEventListener("click", async () => {
    const content = $("#draft-textarea").value.trim();
    const status = $("#activate-status");
    if (!content) {
      status.textContent = "Escribe o genera un prompt primero";
      status.classList.add("show");
      return;
    }
    await api("/system-prompt", { method: "PATCH", body: JSON.stringify({ content }) });
    status.textContent = "Activado ✓";
    status.classList.add("show");
    setTimeout(() => status.classList.remove("show"), 3000);
  });
}

setupTabs();
setupEvents();

if (state.token) {
  login(state.token);
} else {
  $("#login-screen").hidden = false;
}

// Refresco periódico ligero del pipeline (sin recargar la conversación abierta).
setInterval(() => {
  if (state.token) loadAll().catch(() => {});
}, 20000);
