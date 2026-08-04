const STAGES = [
  { id: "nuevos", label: "Nuevos leads", color: "var(--stage-sand)" },
  { id: "conversacion", label: "En conversación", color: "var(--stage-dusk)" },
  { id: "cualificados", label: "Cualificados", color: "var(--stage-cual)" },
  { id: "agendados", label: "Agendados", color: "var(--stage-sage)" },
  { id: "perdidos", label: "Perdidos / sin respuesta", color: "var(--text-tertiary)" },
];

function applyClockTheme() {
  const hour = new Date().getHours();
  const isDay = hour >= 7 && hour < 19;
  document.documentElement.setAttribute("data-theme", isDay ? "light" : "dark");
}
applyClockTheme();
setInterval(applyClockTheme, 60000);

const TAG_COLORS = ["#6fb17a", "#d16a63", "#cf9457", "#d0b64f", "#63b79a", "#5aa3ad", "#7091c9", "#9884c9", "#c887ac", "#8a8f97"];

const TOKEN_KEY = "setteria_admin_token";
let token = localStorage.getItem(TOKEN_KEY);
let conversationsCache = [];
let tagsCache = [];
let currentDrawerId = null;
let selectedNewTagColor = TAG_COLORS[0];

const loginScreen = document.getElementById("login-screen");
const appScreen = document.getElementById("app-screen");
const loginToken = document.getElementById("login-token");
const loginBtn = document.getElementById("login-btn");
const loginError = document.getElementById("login-error");

async function api(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: "Bearer " + token,
    },
  });
  if (res.status === 401) {
    token = null;
    localStorage.removeItem(TOKEN_KEY);
    showLogin();
    throw new Error("unauthorized");
  }
  return res;
}

function showLogin() {
  loginScreen.classList.remove("hidden");
  appScreen.classList.add("hidden");
}

function showApp() {
  loginScreen.classList.add("hidden");
  appScreen.classList.remove("hidden");
  loadBoard();
  loadTags();
}

async function tryLogin(candidateToken) {
  token = candidateToken;
  try {
    const res = await api("/admin/conversations");
    if (!res.ok) throw new Error("bad token");
    localStorage.setItem(TOKEN_KEY, token);
    loginError.style.display = "none";
    showApp();
  } catch (e) {
    token = null;
    loginError.style.display = "block";
  }
}

loginBtn.addEventListener("click", () => {
  const val = loginToken.value.trim();
  if (val) tryLogin(val);
});
loginToken.addEventListener("keydown", (e) => {
  if (e.key === "Enter") loginBtn.click();
});

document.getElementById("logout-btn").addEventListener("click", () => {
  token = null;
  localStorage.removeItem(TOKEN_KEY);
  showLogin();
});
document.getElementById("refresh-btn").addEventListener("click", loadBoard);

function timeAgo(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now - d;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "ahora";
  if (diffMin < 60) return diffMin + " min";
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return diffH + " h";
  const diffD = Math.floor(diffH / 24);
  return diffD + " d";
}

function initials(name) {
  if (!name) return "?";
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

async function loadBoard() {
  try {
    const res = await api("/admin/conversations");
    conversationsCache = await res.json();
    renderStats();
    renderBoard();
  } catch (e) {
    // handled by api() (redirects to login on 401); otherwise show nothing
  }
}

function renderStats() {
  const total = conversationsCache.length;
  const active = conversationsCache.filter((c) => c.status === "active").length;
  const paused = conversationsCache.filter((c) => c.status === "paused").length;
  const agendados = conversationsCache.filter((c) => c.stage === "agendados").length;

  const stats = [
    { value: total, label: "Conversaciones totales" },
    { value: active, label: "IA activa" },
    { value: paused, label: "IA pausada (humano)" },
    { value: agendados, label: "Agendados" },
  ];

  document.getElementById("stats").innerHTML = stats
    .map((s) => `<div class="stat"><div class="stat-value">${s.value}</div><div class="stat-label">${s.label}</div></div>`)
    .join("");
}

function renderBoard() {
  const board = document.getElementById("board");

  if (conversationsCache.length === 0) {
    board.innerHTML = "";
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.style.width = "100%";
    empty.innerHTML = `<h2>Todavía no hay conversaciones</h2><p>En cuanto llegue el primer mensaje por WhatsApp, aparecerá aquí automáticamente.</p>`;
    board.appendChild(empty);
    return;
  }

  board.innerHTML = "";
  STAGES.forEach((stage) => {
    const items = conversationsCache.filter((c) => c.stage === stage.id);
    const col = document.createElement("div");
    col.className = "column";
    col.innerHTML = `<div class="column-head"><span class="stage-dot" style="background:${stage.color}"></span><span class="column-title">${stage.label}</span><span class="column-count">${items.length}</span></div><div class="cards"></div>`;
    const cardsWrap = col.querySelector(".cards");

    if (items.length === 0) {
      cardsWrap.innerHTML = `<div class="empty-col">Sin conversaciones</div>`;
    } else {
      items.forEach((c) => {
        const card = document.createElement("button");
        card.className = "lead-card";
        const name = c.contactDisplayName || c.contactExternalId;
        const tagChips = (c.tags || [])
          .map((t) => `<span class="tag-chip" style="background:${t.color}">${escapeHtml(t.name)}</span>`)
          .join("");
        card.innerHTML = `
          <div class="lead-top">
            <span class="lead-name">${name}</span>
            <span class="lead-time">${timeAgo(c.lastMessageAt)}</span>
          </div>
          <div class="lead-meta">
            <span class="pill ${c.status === "paused" ? "paused" : "active"}"><span class="pill-dot"></span>${c.status === "paused" ? "IA pausada" : "IA activa"}</span>
            <span class="dot ${c.platform}"></span>
          </div>
          ${tagChips ? `<div class="tag-list">${tagChips}</div>` : ""}`;
        card.addEventListener("click", () => openDrawer(c.id));
        cardsWrap.appendChild(card);
      });
    }
    board.appendChild(col);
  });
}

const drawer = document.getElementById("drawer");
const overlay = document.getElementById("overlay");

async function openDrawer(id) {
  currentDrawerId = id;
  const conv = conversationsCache.find((c) => c.id === id);
  if (!conv) return;

  const name = conv.contactDisplayName || conv.contactExternalId;
  document.getElementById("d-avatar").textContent = initials(name);
  document.getElementById("d-name").textContent = name;
  document.getElementById("d-subtitle").textContent = conv.platform === "whatsapp" ? "WhatsApp" : "Instagram";
  document.getElementById("d-channel").textContent = (conv.platform === "whatsapp" ? "WhatsApp · " : "Instagram · ") + conv.contactExternalId;
  document.getElementById("d-last").textContent = timeAgo(conv.lastMessageAt);
  document.getElementById("d-stage").value = conv.stage;
  renderDrawerTags(conv);

  const isActive = conv.status !== "paused";
  document.getElementById("d-status-dot").className = "status-dot " + (isActive ? "on" : "off");
  document.getElementById("d-status-label").textContent = isActive ? "IA activa" : "IA pausada · humano";
  document.getElementById("d-switch").className = "switch " + (isActive ? "on" : "");

  document.getElementById("d-thread").innerHTML = `<div class="loading-note">Cargando mensajes…</div>`;
  drawer.classList.add("open");
  overlay.classList.add("open");
  drawer.setAttribute("aria-hidden", "false");

  const res = await api(`/admin/conversations/${id}/messages`);
  const msgs = await res.json();
  const thread = document.getElementById("d-thread");
  if (msgs.length === 0) {
    thread.innerHTML = `<div class="loading-note">Sin mensajes todavía.</div>`;
  } else {
    thread.innerHTML = msgs
      .map(
        (m) => `<div class="msg ${m.direction}"><div class="bubble">${escapeHtml(m.content)}</div><span class="msg-time">${new Date(m.createdAt).toLocaleString("es-ES", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span></div>`,
      )
      .join("");
    thread.scrollTop = thread.scrollHeight;
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function closeDrawer() {
  drawer.classList.remove("open");
  overlay.classList.remove("open");
  drawer.setAttribute("aria-hidden", "true");
  currentDrawerId = null;
}
document.getElementById("d-close").addEventListener("click", closeDrawer);
overlay.addEventListener("click", closeDrawer);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeDrawer();
});

document.getElementById("d-switch").addEventListener("click", async function () {
  if (!currentDrawerId) return;
  const willBeActive = !this.classList.contains("on");
  const endpoint = willBeActive ? "resume" : "pause";
  await api(`/admin/conversations/${currentDrawerId}/${endpoint}`, { method: "PATCH" });
  this.classList.toggle("on", willBeActive);
  document.getElementById("d-status-dot").className = "status-dot " + (willBeActive ? "on" : "off");
  document.getElementById("d-status-label").textContent = willBeActive ? "IA activa" : "IA pausada · humano";
  loadBoard();
});

document.getElementById("d-stage").addEventListener("change", async function () {
  if (!currentDrawerId) return;
  await api(`/admin/conversations/${currentDrawerId}/stage`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ stage: this.value }),
  });
  loadBoard();
});

function renderDrawerTags(conv) {
  const wrap = document.getElementById("d-tags");
  const appliedIds = new Set((conv.tags || []).map((t) => t.id));

  wrap.innerHTML = (conv.tags || []).length
    ? conv.tags
        .map(
          (t) =>
            `<span class="tag-chip" style="background:${t.color}">${escapeHtml(t.name)}<button data-tag-id="${t.id}" title="Quitar">✕</button></span>`,
        )
        .join("")
    : `<span class="tag-empty">Sin etiquetas</span>`;

  wrap.querySelectorAll("button[data-tag-id]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await api(`/admin/conversations/${currentDrawerId}/tags/${btn.getAttribute("data-tag-id")}`, {
        method: "DELETE",
      });
      await loadBoard();
      const updated = conversationsCache.find((c) => c.id === currentDrawerId);
      if (updated) renderDrawerTags(updated);
    });
  });

  const addSelect = document.getElementById("d-tag-add");
  const available = tagsCache.filter((t) => !appliedIds.has(t.id));
  addSelect.innerHTML =
    `<option value="">+ Agregar etiqueta…</option>` +
    available.map((t) => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join("");
}

document.getElementById("d-tag-add").addEventListener("change", async function () {
  if (!currentDrawerId || !this.value) return;
  await api(`/admin/conversations/${currentDrawerId}/tags`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tagId: this.value }),
  });
  this.value = "";
  await loadBoard();
  const updated = conversationsCache.find((c) => c.id === currentDrawerId);
  if (updated) renderDrawerTags(updated);
});

async function loadTags() {
  const res = await api("/admin/tags");
  tagsCache = await res.json();
  renderTagGrid();
}

function renderTagGrid() {
  const grid = document.getElementById("tag-grid");
  grid.innerHTML = tagsCache.length
    ? tagsCache
        .map(
          (t) =>
            `<div class="tag-card"><span class="tag-swatch" style="background:${t.color}"></span><span class="tag-card-name">${escapeHtml(t.name)}</span></div>`,
        )
        .join("")
    : `<div class="tag-empty">Aún no has creado ninguna etiqueta.</div>`;
}

function renderNewTagSwatches() {
  const wrap = document.getElementById("new-tag-swatches");
  wrap.innerHTML = TAG_COLORS.map(
    (c) => `<div class="swatch ${c === selectedNewTagColor ? "selected" : ""}" data-color="${c}" style="background:${c}"></div>`,
  ).join("");
  wrap.querySelectorAll(".swatch").forEach((sw) => {
    sw.addEventListener("click", () => {
      selectedNewTagColor = sw.getAttribute("data-color");
      renderNewTagSwatches();
    });
  });
}
renderNewTagSwatches();

document.getElementById("new-tag-submit").addEventListener("click", async () => {
  const input = document.getElementById("new-tag-name");
  const name = input.value.trim();
  if (!name) return;
  await api("/admin/tags", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, color: selectedNewTagColor }),
  });
  input.value = "";
  await loadTags();
});

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((t) => t.setAttribute("aria-selected", "false"));
    tab.setAttribute("aria-selected", "true");
    const view = tab.getAttribute("data-view");
    document.getElementById("board-view").classList.toggle("hidden", view !== "board");
    document.getElementById("stats").classList.toggle("hidden", view !== "board");
    document.getElementById("tags-view").classList.toggle("hidden", view !== "tags");
    document.getElementById("connections-view").classList.toggle("hidden", view !== "connections");
    if (view === "connections") loadConnections();
    if (view === "tags") loadTags();
  });
});

const CONNECTION_LABELS = {
  whatsapp: { name: "WhatsApp Business", detail: "Cloud API" },
  instagram: { name: "Instagram Messaging", detail: "DMs" },
  claude: { name: "API de Claude", detail: "Generación de respuestas" },
  webhook: { name: "Webhook de Meta", detail: "Recepción de mensajes" },
  calendly: { name: "Calendly", detail: "Agenda automática" },
  facebookMessenger: { name: "Facebook Messenger", detail: "Página de Facebook" },
};

async function loadConnections() {
  const wrap = document.getElementById("connections-list");
  try {
    const res = await api("/admin/connections");
    const data = await res.json();
    wrap.innerHTML = Object.entries(CONNECTION_LABELS)
      .map(([key, meta]) => {
        const info = data[key] || { connected: false, available: false };
        let statusClass = "missing";
        let statusText = "Pendiente";
        if (!info.available) {
          statusClass = "soon";
          statusText = "Próximamente";
        } else if (info.connected) {
          statusClass = "connected";
          statusText = "Conectado";
        }
        const extra = key === "claude" && info.connected ? ` · ${info.model}` : "";
        return `<div class="conn-card">
          <div class="conn-icon">${meta.name[0]}</div>
          <div class="conn-body"><div class="conn-name">${meta.name}</div><div class="conn-detail">${meta.detail}${extra}</div></div>
          <div class="conn-status ${statusClass}"><span class="pill-dot"></span>${statusText}</div>
        </div>`;
      })
      .join("");
  } catch (e) {
    // 401 already redirected to login by api()
  }
}

if (token) {
  tryLogin(token);
} else {
  showLogin();
}
