/**
 * Arduino Forge — Frontend Application
 *
 * Professional GitHub-inspired UI logic.
 */

// ── API Client ─────────────────────────────────────────────────

// Helper to inject Auth token
function getAuthHeaders() {
    const token = localStorage.getItem("forge_token");
    return {
        "Content-Type": "application/json",
        ...(token && { "Authorization": `Bearer ${token}` })
    };
}

const API = {
    async generate(payload) {
        const res = await fetch("/api/generate", {
            method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || data.error || "Generation failed");
        return data;
    },

    async components() {
        const res = await fetch("/api/components");
        return res.json();
    },

    async auth(endpoint, username, password) {
        const res = await fetch(`/api/auth/${endpoint}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Auth failed");
        return data;
    },

    async getProjects() {
        const res = await fetch("/api/projects", { headers: getAuthHeaders() });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        return data.data;
    },

    async saveProject(payload) {
        const res = await fetch("/api/projects", {
            method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        return data;
    },

    async getProjectDetails(id) {
        const res = await fetch(`/api/projects/${id}`, { headers: getAuthHeaders() });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        return data.data;
    }
};

// ── State machine ──────────────────────────────────────────────
const STATES = { IDLE: "idle", LOADING: "loading", RESULT: "result", ERROR: "error" };
let currentState = STATES.IDLE;

const LOADING_MESSAGES = [
    "Analyzing architecture...",
    "Matching component specs...",
    "Building schematic...",
    "Synthesizing C++ code...",
    "Resolving dependencies...",
];

// ── DOM references ─────────────────────────────────────────────
const $ = id => document.getElementById(id);

const els = {
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

    // Auth & Modals
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

    btnAdminStats: $("btnAdminStats"),
    adminModal: $("adminModal"),
    btnCloseAdminModal: $("btnCloseAdminModal"),
    statUsers: $("statUsers"),
    statProjects: $("statProjects"),
    statGenerations: $("statGenerations"),
    adminActivityList: $("adminActivityList")
};

let currentUser = localStorage.getItem("forge_username") || null;
let pendingAuthAction = "login"; // "login" or "register"

// ── UI State transitions ───────────────────────────────────────
function setState(state, data = null) {
    currentState = state;

    // Hide all state containers
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
            if (data) els.errorMessage.textContent = data;
            break;
    }
}

let loadingTimer = null;
function startLoadingCycle() {
    let i = 0;
    els.loadingText.textContent = LOADING_MESSAGES[0];
    loadingTimer = setInterval(() => {
        i = (i + 1) % LOADING_MESSAGES.length;
        els.loadingText.textContent = LOADING_MESSAGES[i];
    }, 2000);
}

function stopLoadingCycle() {
    if (loadingTimer) { clearInterval(loadingTimer); loadingTimer = null; }
}

// ── Result renderer ────────────────────────────────────────────
function renderResult(response) {
    const { data, meta } = response;

    // Meta bar
    const metaTags = [
        meta.board ? `<span>${escapeHtml(meta.board)}</span>` : "",
        meta.difficulty ? `<span>Level: ${escapeHtml(meta.difficulty)}</span>` : "",
        meta.generationTimeMs ? `<span class="muted">${(meta.generationTimeMs / 1000).toFixed(1)}s</span>` : "",
        (meta.warnings?.length > 0) ? `<span class="text-red">⚠ ${meta.warnings.length} warning(s)</span>` : "",
    ].filter(Boolean).join(`<span class="muted">|</span>`);

    els.resultMeta.innerHTML = metaTags;

    // Code pane
    els.codeOutput.textContent = data.code || "// No code generated";
    if (window.hljs) hljs.highlightElement(els.codeOutput);

    // Wiring pane
    els.wiringOutput.textContent = data.wiring || "No wiring diagram available.";

    // Libraries pane
    if (data.libraries?.length > 0) {
        els.librariesOutput.innerHTML = `<ul style="list-style-position: inside;">` +
            data.libraries.map((lib) => `
        <li style="margin-bottom: 8px;">
          <strong>${escapeHtml(lib)}</strong>
          <div class="muted" style="margin-left: 18px; font-size: 12px;">Install via Library Manager</div>
        </li>
      `).join("") + `</ul>`;
    } else {
        els.librariesOutput.innerHTML = `<div class="muted">No external libraries required. Uses built-in standard libraries.</div>`;
    }

    // Notes pane
    els.notesOutput.textContent = data.notes || "No additional documentation.";

    // Summary bar
    els.summaryBar.textContent = data.summary || "System synthesized successfully.";

    // Show warnings inline on the left panel
    if (meta.warnings?.length > 0) {
        els.warningsList.innerHTML = meta.warnings.map(w => `<li>${escapeHtml(w)}</li>`).join("");
        els.warningsBox.hidden = false;
    }

    // Toggle save button
    els.saveProjectBtn.style.display = currentUser ? "inline-flex" : "none";

    // Reset to code tab
    switchTab("code");
}

// ── Tab switching ──────────────────────────────────────────────
function switchTab(name) {
    document.querySelectorAll(".tab").forEach(t => {
        t.classList.toggle("active", t.dataset.tab === name);
    });
    document.querySelectorAll(".tab-pane").forEach(p => {
        p.classList.toggle("active", p.id === `pane-${name}`);
    });
}

// ── Generation flow ────────────────────────────────────────────
async function handleGenerate() {
    const prompt = els.prompt.value.trim();
    if (!prompt) {
        els.prompt.focus();
        return;
    }

    stopLoadingCycle();
    setState(STATES.LOADING);
    els.warningsBox.hidden = true;

    try {
        const payload = {
            prompt,
            board: els.boardSelect.value || undefined,
            difficulty: els.diffSelect.value,
        };

        const result = await API.generate(payload);
        stopLoadingCycle();
        lastResult = result;
        setState(STATES.RESULT, result);

        // Auto-scroll to results on mobile
        if (window.innerWidth <= 900) {
            els.resultMeta.scrollIntoView({ behavior: 'smooth' });
        }

    } catch (err) {
        stopLoadingCycle();
        setState(STATES.ERROR, err.message);
    }
}

// ── Copy to clipboard ──────────────────────────────────────────
function copyText(targetId, btn) {
    const el = document.getElementById(targetId);
    if (!el) return;

    navigator.clipboard.writeText(el.textContent).then(() => {
        const original = btn.textContent;
        btn.textContent = "Copied!";
        setTimeout(() => {
            btn.textContent = original;
        }, 2000);
    });
}

// ── Char counter ───────────────────────────────────────────────
function updateCharCount() {
    const len = els.prompt.value.length;
    els.charCount.textContent = `${len} / 2000`;
    els.charCount.style.color = len > 1800 ? "var(--accent-red)" : "";
}

// ── Utilities ──────────────────────────────────────────────────
function escapeHtml(str) {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

// ── Download ZIP ───────────────────────────────────────────────
async function handleDownloadZip() {
    if (!lastResult || !lastResult.data.code) return;

    const originalHtml = els.downloadZipBtn.innerHTML;
    els.downloadZipBtn.innerHTML = "Zipping...";
    els.downloadZipBtn.disabled = true;

    try {
        const payload = {
            prompt: els.prompt.value.trim(),
            code: lastResult.data.code,
            wiring: lastResult.data.wiring,
            libraries: lastResult.data.libraries,
            notes: lastResult.data.notes
        };

        const res = await fetch("/api/export", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error("Export failed");

        // Extract filename from headers if possible
        let filename = "ArduinoForge_Project.zip";
        const disposition = res.headers.get("Content-Disposition");
        if (disposition && disposition.includes("filename=")) {
            filename = disposition.split("filename=")[1].replace(/"/g, "");
        }

        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);

        // Create an invisible anchor to trigger browser download
        const a = document.createElement("a");
        a.style.display = "none";
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();

        // Cleanup
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

    } catch (err) {
        console.error("Download error:", err);
        alert("Failed to download ZIP: " + err.message);
    } finally {
        els.downloadZipBtn.innerHTML = "Downloaded!";
        setTimeout(() => {
            els.downloadZipBtn.innerHTML = originalHtml;
            els.downloadZipBtn.disabled = false;
        }, 2000);
    }
}

// ── Compile Flow ───────────────────────────────────────────────
async function handleCompile() {
    if (!lastResult || !lastResult.data.code) return;

    const originalHtml = els.compileActionBtn.innerHTML;
    els.compileActionBtn.innerHTML = "Compiling...";
    els.compileActionBtn.disabled = true;

    try {
        const payload = {
            code: lastResult.data.code,
            board: lastResult.meta?.board || "arduino-uno"
        };

        const res = await fetch("/api/compile", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.error || "Compilation failed");
        }

        // Handle binary blob
        let filename = "firmware.hex";
        const disposition = res.headers.get("Content-Disposition");
        if (disposition && disposition.includes("filename=")) {
            filename = disposition.split("filename=")[1].replace(/"/g, "");
        }

        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);

        // Trigger download
        const a = document.createElement("a");
        a.style.display = "none";
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();

        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

    } catch (err) {
        console.error("Compile error:", err);
        alert("Compilation failed:\n" + err.message);
    } finally {
        els.compileActionBtn.innerHTML = "Compiled!";
        setTimeout(() => {
            els.compileActionBtn.innerHTML = originalHtml;
            els.compileActionBtn.disabled = false;
        }, 2000);
    }
}

// ── Auth & Cloud Savings ───────────────────────────────────────
function updateAuthUI() {
    if (currentUser) {
        els.authNavGuest.hidden = true;
        els.authNavUser.hidden = false;
        refreshProjectsCount();
        // Show save button if we have a result
        if (window.lastResult) els.saveProjectBtn.style.display = "inline-flex";
    } else {
        els.authNavGuest.hidden = false;
        els.authNavUser.hidden = true;
        els.saveProjectBtn.style.display = "none";
    }
}

function stopAuthLoading(originalHtml) {
    els.btnSubmitAuth.innerHTML = originalHtml;
    els.btnSubmitAuth.disabled = false;
}

async function handleAuthSubmit() {
    const username = els.authUsername.value.trim();
    const password = els.authPassword.value.trim();
    if (!username || !password) return;

    const originalHtml = els.btnSubmitAuth.innerHTML;
    els.btnSubmitAuth.innerHTML = "Processing...";
    els.btnSubmitAuth.disabled = true;
    els.authError.hidden = true;

    try {
        const data = await API.auth(pendingAuthAction, username, password);
        localStorage.setItem("forge_token", data.token);
        localStorage.setItem("forge_username", data.username);
        currentUser = data.username;

        updateAuthUI();
        els.authModal.hidden = true;
    } catch (err) {
        els.authError.textContent = err.message;
        els.authError.hidden = false;
    } finally {
        stopAuthLoading(originalHtml);
    }
}

function handleLogout() {
    localStorage.removeItem("forge_token");
    localStorage.removeItem("forge_username");
    currentUser = null;
    updateAuthUI();
}

async function handleSaveProject() {
    if (!lastResult || !currentUser) return;
    const originalHtml = els.saveProjectBtn.innerHTML;
    els.saveProjectBtn.innerHTML = "Saving...";
    els.saveProjectBtn.disabled = true;

    try {
        await API.saveProject({
            name: "Generated Circuit " + new Date().toLocaleTimeString(),
            prompt: els.prompt.value.trim(),
            code: lastResult.data.code,
            wiring: lastResult.data.wiring,
            libraries: lastResult.data.libraries,
            notes: lastResult.data.notes
        });

        els.saveProjectBtn.innerHTML = "Saved!";
        refreshProjectsCount();
    } catch (err) {
        alert("Failed to save: " + err.message);
        els.saveProjectBtn.innerHTML = "Error";
    }

    setTimeout(() => {
        els.saveProjectBtn.innerHTML = originalHtml;
        els.saveProjectBtn.disabled = false;
    }, 2000);
}

async function refreshProjectsCount() {
    if (!currentUser) return;
    try {
        const projects = await API.getProjects();
        els.projectsCount.textContent = projects.length;
    } catch (e) { }
}

async function openProjectsModal() {
    els.projectsModal.hidden = false;
    els.projectsList.innerHTML = `<div class="muted">Loading projects...</div>`;

    try {
        const projects = await API.getProjects();
        if (projects.length === 0) {
            els.projectsList.innerHTML = `<div class="muted">You have no saved projects yet.</div>`;
            return;
        }

        els.projectsList.innerHTML = projects.map(p => `
      <div class="project-item" data-id="${p.id}">
        <div>
          <div class="project-name">${escapeHtml(p.name)}</div>
          <div class="project-date">${new Date(p.created_at).toLocaleString()}</div>
        </div>
        <button class="btn btn-primary btn-sm btn-load" data-id="${p.id}">Load</button>
      </div>
    `).join("");

        document.querySelectorAll(".btn-load").forEach(btn => {
            btn.addEventListener("click", async (e) => {
                e.stopPropagation();
                const id = e.target.dataset.id;
                els.projectsModal.hidden = true;
                try {
                    const det = await API.getProjectDetails(id);
                    els.prompt.value = det.prompt || "";

                    window.lastResult = {
                        data: { code: det.code, wiring: det.wiring, libraries: det.libraries, notes: det.notes },
                        meta: { board: det.board, warnings: [] } // simulate meta
                    };
                    renderResult(window.lastResult);
                } catch (err) { alert("Failed to load project"); }
            });
        });

    } catch (err) {
        els.projectsList.innerHTML = `<div class="text-red">Failed to load projects.</div>`;
    }
}

// ── Event listeners ────────────────────────────────────────────
function init() {
    updateAuthUI();

    // Generate button
    els.generateBtn.addEventListener("click", handleGenerate);

    // Keyboard shortcut: Ctrl+Enter / Cmd+Enter
    els.prompt.addEventListener("keydown", e => {
        if ((e.ctrlKey || e.metaKey) && e.key === "Enter") handleGenerate();
    });

    // Character counter
    els.prompt.addEventListener("input", updateCharCount);

    // Tabs
    document.querySelectorAll(".tab").forEach(tab => {
        tab.addEventListener("click", () => switchTab(tab.dataset.tab));
    });

    // Action buttons
    els.copyCodeBtn?.addEventListener("click", () => copyText("codeOutput", els.copyCodeBtn));
    els.copyWiringBtn?.addEventListener("click", () => copyText("wiringOutput", els.copyWiringBtn));
    els.downloadZipBtn?.addEventListener("click", handleDownloadZip);
    els.saveProjectBtn?.addEventListener("click", handleSaveProject);
    els.compileActionBtn?.addEventListener("click", handleCompile);

    // Retry button
    els.retryBtn?.addEventListener("click", () => {
        setState(STATES.IDLE);
        els.prompt.focus();
    });

    // Example chips
    document.querySelectorAll(".chip").forEach(chip => {
        chip.addEventListener("click", () => {
            els.prompt.value = chip.dataset.prompt;
            updateCharCount();
            els.prompt.focus();
        });
    });

    // Auth Event Listeners
    els.btnOpenLogin?.addEventListener("click", () => {
        pendingAuthAction = "login";
        els.authModalTitle.textContent = "Sign In";
        els.btnSubmitAuth.textContent = "Sign In";
        els.authError.hidden = true;
        els.authModal.hidden = false;
        els.authUsername.focus();
    });

    els.btnOpenRegister?.addEventListener("click", () => {
        pendingAuthAction = "register";
        els.authModalTitle.textContent = "Create Account";
        els.btnSubmitAuth.textContent = "Sign Up";
        els.authError.hidden = true;
        els.authModal.hidden = false;
        els.authUsername.focus();
    });

    els.btnCloseAuthModal?.addEventListener("click", () => els.authModal.hidden = true);
    els.btnSubmitAuth?.addEventListener("click", handleAuthSubmit);

    els.btnLogout?.addEventListener("click", handleLogout);

    // Project Modals
    els.btnMyProjects?.addEventListener("click", openProjectsModal);
    els.btnCloseProjectsModal?.addEventListener("click", () => els.projectsModal.hidden = true);

    // Admin Modals
    els.btnAdminStats?.addEventListener("click", async () => {
        els.adminModal.hidden = false;
        try {
            const res = await fetch("/api/metrics");
            const data = await res.json();
            if (data.success) {
                els.statUsers.textContent = data.stats.totalUsers;
                els.statProjects.textContent = data.stats.totalProjectsSaved;
                els.statGenerations.textContent = data.stats.totalCodeGenerations;

                els.adminActivityList.innerHTML = data.recentActivity.map(a => `
            <tr>
              <td style="padding:8px; border-bottom:1px solid var(--border-default);">${escapeHtml(a.endpoint)}</td>
              <td style="padding:8px; border-bottom:1px solid var(--border-default);"><span class="${a.status_code >= 400 ? 'text-red' : ''}">${a.status_code}</span></td>
              <td style="padding:8px; border-bottom:1px solid var(--border-default);">${a.duration_ms}ms</td>
            </tr>
          `).join("");
            }
        } catch (err) {
            els.adminActivityList.innerHTML = `<tr><td colspan="3" class="text-red">Failed to load metrics.</td></tr>`;
        }
    });
    els.btnCloseAdminModal?.addEventListener("click", () => els.adminModal.hidden = true);

    // Initial state
    setState(STATES.IDLE);
}

document.addEventListener("DOMContentLoaded", init);
