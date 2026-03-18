/**
 * Arduino Forge — Frontend Application
 *
 * Professional GitHub-inspired UI logic.
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
    retryBtn: $("retryBtn"),
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
    document.querySelectorAll(".chip").forEach(chip => {
        chip.addEventListener("click", () => {
            els.prompt.value = chip.dataset.prompt;
            updateCharCount();
            els.prompt.focus();
        });
    });

    // Initial state
    setState(STATES.IDLE);
}

document.addEventListener("DOMContentLoaded", init);
