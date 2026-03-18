/**
 * Arduino Forge — Frontend Application
 *
 * Pure vanilla JS. No framework. No build step.
 * Modules: UI state machine, API client, renderer.
 */

// ── API Client ─────────────────────────────────────────────────
const API = {
    async generate(payload) {
        const res = await fetch("/api/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
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
};

// ── State machine ──────────────────────────────────────────────
const STATES = { IDLE: "idle", LOADING: "loading", RESULT: "result", ERROR: "error" };
let currentState = STATES.IDLE;
let lastResult = null;

const LOADING_MESSAGES = [
    "Analyzing your request...",
    "Matching component specs...",
    "Building pin diagrams...",
    "Generating C++ code...",
    "Verifying wiring...",
    "Formatting output...",
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
    retryBtn: $("retryBtn"),
    componentsGrid: $("componentsGrid"),
};

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
            els.generateBtn.querySelector(".btn-generate__text").textContent = "Generate Code";
            break;

        case STATES.LOADING:
            els.loadingState.hidden = false;
            els.generateBtn.disabled = true;
            els.generateBtn.querySelector(".btn-generate__text").textContent = "Generating...";
            startLoadingCycle();
            break;

        case STATES.RESULT:
            els.resultState.hidden = false;
            els.generateBtn.disabled = false;
            els.generateBtn.querySelector(".btn-generate__text").textContent = "Generate Code";
            if (data) renderResult(data);
            break;

        case STATES.ERROR:
            els.errorState.hidden = false;
            els.generateBtn.disabled = false;
            els.generateBtn.querySelector(".btn-generate__text").textContent = "Generate Code";
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
    }, 2200);
}

function stopLoadingCycle() {
    if (loadingTimer) { clearInterval(loadingTimer); loadingTimer = null; }
}

// ── Result renderer ────────────────────────────────────────────
function renderResult(response) {
    const { data, meta } = response;
    lastResult = response;

    // Meta bar
    const metaTags = [
        meta.board ? `<span class="meta-tag meta-tag--board">${meta.board}</span>` : "",
        meta.difficulty ? `<span class="meta-tag">${meta.difficulty}</span>` : "",
        meta.generationTimeMs ? `<span class="meta-tag meta-tag--time">${(meta.generationTimeMs / 1000).toFixed(1)}s</span>` : "",
        (meta.warnings?.length > 0) ? `<span class="meta-tag meta-tag--warning">⚠ ${meta.warnings.length} warning${meta.warnings.length > 1 ? "s" : ""}</span>` : "",
    ].filter(Boolean).join("");
    els.resultMeta.innerHTML = metaTags;

    // Code pane
    els.codeOutput.textContent = data.code || "// No code generated";
    if (window.hljs) hljs.highlightElement(els.codeOutput);

    // Wiring pane
    els.wiringOutput.textContent = data.wiring || "No wiring diagram available.";

    // Libraries pane
    if (data.libraries?.length > 0) {
        els.librariesOutput.innerHTML = data.libraries.map((lib, i) => `
      <div class="library-item">
        <span class="library-number">${String(i + 1).padStart(2, "0")}</span>
        <div>
          <div class="library-name">${escapeHtml(lib)}</div>
          <div class="library-hint">Install via Arduino IDE → Tools → Manage Libraries → search "${escapeHtml(lib)}"</div>
        </div>
      </div>
    `).join("");
    } else {
        els.librariesOutput.innerHTML = `<div class="no-libraries">No external libraries required — uses built-in Arduino functions only.</div>`;
    }

    // Notes pane
    els.notesOutput.textContent = data.notes || "No additional notes.";

    // Summary bar
    els.summaryBar.textContent = data.summary || "";

    // Show warnings inline
    if (meta.warnings?.length > 0) {
        els.warningsList.innerHTML = meta.warnings.map(w => `<li>${escapeHtml(w)}</li>`).join("");
        els.warningsBox.hidden = false;
    }

    // Reset to code tab
    switchTab("code");
}

// ── Tab switching ──────────────────────────────────────────────
function switchTab(name) {
    document.querySelectorAll(".tab").forEach(t => {
        t.classList.toggle("tab--active", t.dataset.tab === name);
    });
    document.querySelectorAll(".tab-pane").forEach(p => {
        p.classList.toggle("tab-pane--active", p.id === `pane-${name}`);
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
        setState(STATES.RESULT, result);

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
        btn.classList.add("copied");
        setTimeout(() => {
            btn.textContent = original;
            btn.classList.remove("copied");
        }, 2000);
    });
}

// ── Components grid ────────────────────────────────────────────
async function loadComponents() {
    try {
        const { data } = await API.components();
        if (!data || !els.componentsGrid) return;

        const categoryLabel = {
            microcontrollers: "MCU",
            sensors: "Sensor",
            displays: "Display",
            actuators: "Actuator",
            communication: "Comms",
        };

        const allItems = Object.entries(data).flatMap(([cat, items]) =>
            items.map(item => ({ ...item, catLabel: categoryLabel[cat] ?? cat }))
        );

        els.componentsGrid.innerHTML = allItems.map(item => `
      <div class="component-card" data-name="${escapeHtml(item.name)}" tabindex="0" role="button">
        <div class="component-card__category">${escapeHtml(item.catLabel)}</div>
        <div class="component-card__name">${escapeHtml(item.name)}</div>
        <div class="component-card__voltage">${escapeHtml(String(item.voltage ?? ""))}</div>
      </div>
    `).join("");

        // Click a component card → insert name into prompt
        els.componentsGrid.addEventListener("click", e => {
            const card = e.target.closest(".component-card");
            if (!card) return;
            const name = card.dataset.name;
            const current = els.prompt.value;
            if (current && !current.includes(name)) {
                els.prompt.value = current.trimEnd() + (current.endsWith(",") ? " " : ", ") + name;
            } else if (!current) {
                els.prompt.value = `Use ${name} with Arduino Uno`;
            }
            els.prompt.focus();
            updateCharCount();
        });

    } catch (err) {
        console.warn("Could not load components:", err.message);
    }
}

// ── Char counter ───────────────────────────────────────────────
function updateCharCount() {
    const len = els.prompt.value.length;
    els.charCount.textContent = `${len} / 2000`;
    els.charCount.style.color = len > 1800 ? "var(--yellow)" : "";
}

// ── Utilities ──────────────────────────────────────────────────
function escapeHtml(str) {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

// ── Event listeners ────────────────────────────────────────────
function init() {
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

    // Copy buttons
    els.copyCodeBtn?.addEventListener("click", () => copyText("codeOutput", els.copyCodeBtn));
    els.copyWiringBtn?.addEventListener("click", () => copyText("wiringOutput", els.copyWiringBtn));

    // Retry button
    els.retryBtn?.addEventListener("click", () => {
        setState(STATES.IDLE);
        els.prompt.focus();
    });

    // Example chips
    document.querySelectorAll(".example-chip").forEach(chip => {
        chip.addEventListener("click", () => {
            els.prompt.value = chip.dataset.prompt;
            updateCharCount();
            els.prompt.focus();
            // Auto-scroll to generator on mobile
            els.prompt.scrollIntoView({ behavior: "smooth", block: "center" });
        });
    });

    // Load components grid
    loadComponents();

    // Initial state
    setState(STATES.IDLE);
}

document.addEventListener("DOMContentLoaded", init);
