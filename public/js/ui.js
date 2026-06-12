import { STATES, LOADING_MESSAGES } from "./state.js";
import { escapeHtml, friendlyError, getCategoryIcon } from "./utils.js";

const $ = id => document.getElementById(id);

export const els = {
  prompt: $("prompt"),
  charCount: $("charCount"),
  boardSelect: $("boardSelect"),
  diffSelect: $("difficultySelect"),
  generateBtn: $("generateBtn"),
  warningsBox: $("warningsBox"),
  warningsList: $("warningsList"),

  emptyState: $("emptyState"),
  loadingState: $("loadingState"),
  loadingText: $("loadingText"),
  resultState: $("resultState"),
  errorState: $("errorState"),
  errorMessage: $("errorMessage"),

  resultMeta: $("resultMeta"),
  codeOutput: $("codeOutput"),
  codeEditorContainer: $("codeEditorContainer"),
  wiringOutput: $("wiringOutput"),
  librariesOutput: $("librariesOutput"),
  notesOutput: $("notesOutput"),
  summaryBar: $("summaryBar"),

  copyCodeBtn: $("copyCodeBtn"),
  copyWiringBtn: $("copyWiringBtn"),
  downloadZipBtn: $("downloadZipBtn"),
  saveProjectBtn: $("saveProjectBtn"),
  compileActionBtn: $("compileActionBtn"),
  retryBtn: $("retryBtn"),
  wokwiBtn: $("wokwiBtn"),

  authNavGuest: $("authNavGuest"),
  authNavUser: $("authNavUser"),
  btnOpenLogin: $("btnOpenLogin"),
  btnOpenRegister: $("btnOpenRegister"),
  btnLogout: $("btnLogout"),
  btnMyProjects: $("btnMyProjects"),
  projectsCount: $("projectsCount"),

  authModal: $("authModal"),
  authModalTitle: $("authModalTitle"),
  btnCloseAuthModal: $("btnCloseAuthModal"),
  authUsername: $("authUsername"),
  authPassword: $("authPassword"),
  btnSubmitAuth: $("btnSubmitAuth"),
  authError: $("authError"),

  projectsModal: $("projectsModal"),
  btnCloseProjectsModal: $("btnCloseProjectsModal"),
  projectsList: $("projectsList"),

  adminModal: $("adminModal"),
  btnCloseAdminModal: $("btnCloseAdminModal"),
  statUsers: $("statUsers"),
  statProjects: $("statProjects"),
  statGenerations: $("statGenerations"),
  adminActivityList: $("adminActivityList"),

  refineSection: $("refineSection"),
  refineInput: $("refineInput"),
  refineBtn: $("refineBtn"),
  toastContainer: $("toastContainer"),

  componentBrowser: $("componentBrowser"),
  componentList: $("componentList"),
};

let loadingTimer = null;

export function setStateUI(state, data = null) {
  els.emptyState.hidden = true;
  els.loadingState.hidden = true;
  els.resultState.hidden = true;
  els.errorState.hidden = true;

  switch (state) {
    case STATES.IDLE:
      els.emptyState.hidden = false;
      els.generateBtn.disabled = false;
      els.generateBtn.textContent = "Generate Code";
      break;

    case STATES.LOADING:
      els.loadingState.hidden = false;
      els.generateBtn.disabled = true;
      els.generateBtn.textContent = "Processing...";
      startLoadingCycle();
      break;

    case STATES.RESULT:
      els.resultState.hidden = false;
      els.generateBtn.disabled = false;
      els.generateBtn.textContent = "Generate Code";
      if (data) renderResult(data);
      break;

    case STATES.ERROR:
      els.errorState.hidden = false;
      els.generateBtn.disabled = false;
      els.generateBtn.textContent = "Generate Code";
      if (data) els.errorMessage.textContent = friendlyError(data);
      break;
  }
}

function startLoadingCycle() {
  let i = 0;
  els.loadingText.textContent = LOADING_MESSAGES[0];
  loadingTimer = setInterval(() => {
    i = (i + 1) % LOADING_MESSAGES.length;
    els.loadingText.textContent = LOADING_MESSAGES[i];
  }, 2000);
}

export function stopLoadingCycle() {
  if (loadingTimer) { clearInterval(loadingTimer); loadingTimer = null; }
}

const WIRE_COLORS = {
  red: "#e74c3c", black: "#2c3e50", blue: "#3498db",
  green: "#27ae60", yellow: "#f1c40f", orange: "#e67e22",
  white: "#ecf0f1", brown: "#795548", purple: "#9b59b6",
};

export function renderWiringTable(wiringText) {
  const lines = wiringText.trim().split("\n").filter(l => l.includes("|"));
  const rows = lines.map(line => line.split("|").map(c => c.trim()).filter(Boolean));
  if (rows.length < 2) return null;

  return `<table class="wiring-table">
    <thead><tr><th>Component Pin</th><th>Wire Color</th><th>Board Pin</th><th>Notes</th></tr></thead>
    <tbody>${rows.slice(1).map(row => `<tr>
      <td>${row[0] ?? ""}</td>
      <td><span class="wire-swatch" style="background:${WIRE_COLORS[row[1]?.toLowerCase()] || "#666"}"></span>${row[1] ?? ""}</td>
      <td><code>${row[2] ?? ""}</code></td>
      <td class="notes-col">${row[3] ?? ""}</td>
    </tr>`).join("")}</tbody>
  </table>`;
}

export function renderResult(response) {
  const { data, meta } = response;

  const metaTags = [
    meta.board ? `<span>${escapeHtml(meta.board)}</span>` : "",
    meta.difficulty ? `<span>Level: ${escapeHtml(meta.difficulty)}</span>` : "",
    meta.generationTimeMs ? `<span class="muted">${(meta.generationTimeMs / 1000).toFixed(1)}s</span>` : "",
    (meta.warnings?.length > 0) ? `<span class="text-red">⚠ ${meta.warnings.length} warning(s)</span>` : "",
  ].filter(Boolean).join(`<span class="muted">|</span>`);

  els.resultMeta.innerHTML = metaTags;

  if (window.monacoEditor) {
    window.monacoEditor.setValue(data.code || "// No code generated");
  } else {
    els.codeOutput.textContent = data.code || "// No code generated";
    if (window.hljs) hljs.highlightElement(els.codeOutput);
  }

  const wiringHtml = renderWiringTable(data.wiring || "");
  if (wiringHtml) {
    els.wiringOutput.innerHTML = wiringHtml;
  } else {
    els.wiringOutput.textContent = data.wiring || "No wiring diagram available.";
  }

  if (data.libraries?.length > 0) {
    els.librariesOutput.innerHTML = `<ul style="list-style-position: inside;">${
      data.libraries.map(lib => `
        <li style="margin-bottom: 8px;">
          <strong>${escapeHtml(lib)}</strong>
          <div class="muted" style="margin-left: 18px; font-size: 12px;">Install via Library Manager</div>
        </li>
      `).join("")
    }</ul>`;
  } else {
    els.librariesOutput.innerHTML = `<div class="muted">No external libraries required.</div>`;
  }

  els.notesOutput.textContent = data.notes || "No additional documentation.";
  els.summaryBar.textContent = data.summary || "System synthesized successfully.";

  if (meta.warnings?.length > 0) {
    els.warningsList.innerHTML = meta.warnings.map(w => `<li>${escapeHtml(w)}</li>`).join("");
    els.warningsBox.hidden = false;
  } else {
    els.warningsBox.hidden = true;
  }

  const token = document.cookie.includes("forge_token");
  els.saveProjectBtn.style.display = token ? "inline-flex" : "none";
  els.refineSection.hidden = false;

  switchTab("code");
}

export function switchTab(name) {
  document.querySelectorAll(".tab").forEach(t => {
    t.classList.toggle("active", t.dataset.tab === name);
  });
  document.querySelectorAll(".tab-pane").forEach(p => {
    p.classList.toggle("active", p.id === `pane-${name}`);
  });
}

export function showToast(message, type = "info") {
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  els.toastContainer.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

export function renderComponentCard(id, spec) {
  return `<div class="comp-card" data-id="${id}" role="button" tabindex="0">
    <div class="comp-icon">${getCategoryIcon(spec.category)}</div>
    <div class="comp-info">
      <span class="comp-name">${escapeHtml(spec.name)}</span>
      <span class="comp-category badge">${spec.category}</span>
      ${spec.voltage ? `<span class="comp-voltage">${typeof spec.voltage === 'number' ? spec.voltage + 'V' : spec.voltage}</span>` : ""}
    </div>
  </div>`;
}

export function initThemeToggle() {
  const saved = localStorage.getItem("forge_theme") || "dark";
  document.documentElement.setAttribute("data-theme", saved);

  const toggle = document.getElementById("themeToggle");
  if (toggle) {
    toggle.addEventListener("click", () => {
      const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      localStorage.setItem("forge_theme", next);
    });
  }
}

export function updateCharCount() {
  const len = els.prompt.value.length;
  els.charCount.textContent = `${len} / 2000`;
  els.charCount.style.color = len > 1800 ? "var(--accent-red)" : "";
}

export function updateAuthUI() {
  const token = document.cookie.includes("forge_token");
  if (token && window.currentUser) {
    els.authNavGuest.hidden = true;
    els.authNavUser.hidden = false;
  } else {
    els.authNavGuest.hidden = false;
    els.authNavUser.hidden = true;
    els.saveProjectBtn.style.display = "none";
  }
}
