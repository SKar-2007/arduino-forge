# Arduino Forge — Improvement Blueprint
> **Full-stack enhancement roadmap** · Generated from live source analysis of `SKar-2007/arduino-forge`  
> Stack: Node.js ESM · Express · better-sqlite3 · Gemini API · Vanilla JS/CSS  
> Use this file as your instruction set inside **opencode**.

---

## Table of Contents

1. [Critical Security Fixes](#1-critical-security-fixes) ← Do these first
2. [Backend Architecture](#2-backend-architecture)
3. [Error Handling & Observability](#3-error-handling--observability)
4. [AI / Generation Logic](#4-ai--generation-logic)
5. [Frontend Overhaul](#5-frontend-overhaul)
6. [Database & Data Layer](#6-database--data-layer)
7. [Performance & Caching](#7-performance--caching)
8. [New Features (Prioritised)](#8-new-features-prioritised)
9. [DevOps & Developer Experience](#9-devops--developer-experience)
10. [Dependency Audit](#10-dependency-audit)
11. [File-by-File Checklist](#11-file-by-file-checklist)

---

## 1. Critical Security Fixes

These are vulnerabilities in the current code that must be fixed before anything else.

### 1.1 Hardcoded JWT Fallback Secret — `src/api/auth.js` line 7

**Current (BROKEN):**
```js
const JWT_SECRET = config.jwtSecret || "super-secret-forge-key-fallback";
```
Any attacker who knows this fallback string can mint valid JWTs for any user.

**Fix:**
```js
// In config/default.js
jwtSecret: process.env.JWT_SECRET || (() => { throw new Error("JWT_SECRET env var is required") })(),
```
Add `JWT_SECRET=<generate with: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))">` to `.env.example`.

---

### 1.2 Gemini API Key Leaking in Server Logs — `src/generators/codeGenerator.js`

**Current (BROKEN):**
```js
const res = await fetch(`${API_URL}?key=${encodeURIComponent(config.gemini.apiKey)}`, ...);
```
The full URL including the API key is logged by Node's default HTTP layer and any reverse proxy access log.

**Fix — use the `x-goog-api-key` header instead:**
```js
const res = await fetch(API_URL, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-goog-api-key": config.gemini.apiKey,
  },
  body: JSON.stringify(body),
});
```
Remove `?key=...` from `API_URL` entirely.

---

### 1.3 Metrics Endpoint Completely Unprotected — `src/api/metrics.js`

**Current (BROKEN):**
```js
router.get("/", (req, res) => { /* returns all users/projects counts to anyone */ });
```
Anyone who hits `GET /api/metrics` sees total user counts and full request logs.

**Fix — add admin middleware:**
```js
// In src/api/metrics.js
import { requireAuth } from "./auth.js";

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
}

router.get("/", requireAuth, requireAdmin, (req, res) => { ... });
```
Also add a `role TEXT DEFAULT 'user'` column to the `users` table and a way to promote admins (env-based seed or CLI script).

---

### 1.4 No Rate Limiting on Auth Routes — `src/api/auth.js`

**Current (BROKEN):** Login and register have zero rate limiting — unlimited brute force attempts.

**Fix:**
```js
import { RateLimiterMemory } from "rate-limiter-flexible";

const authLimiter = new RateLimiterMemory({ points: 10, duration: 60 }); // 10 tries/min

async function authRateLimit(req, res, next) {
  try {
    await authLimiter.consume(req.ip);
    next();
  } catch {
    res.status(429).json({ error: "Too many attempts. Wait 60 seconds." });
  }
}

router.post("/login", authRateLimit, async (req, res) => { ... });
router.post("/register", authRateLimit, async (req, res) => { ... });
```

---

### 1.5 JWT Stored in localStorage (XSS Vulnerable) — `public/js/app.js`

**Current (BROKEN):**
```js
localStorage.setItem("forge_token", data.token);
// ...
const token = localStorage.getItem("forge_token");
```
Any injected script can steal the token. Use `httpOnly` cookies instead.

**Backend fix — send token as a Set-Cookie header:**
```js
// In auth.js login/register handlers
res.cookie("forge_token", token, {
  httpOnly: true,
  secure: config.nodeEnv === "production",
  sameSite: "strict",
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
});
res.json({ success: true, username });
```

**Frontend fix — remove all localStorage token logic:**
```js
// In app.js: remove getAuthHeaders() Authorization header injection
// Cookies are sent automatically by the browser
// Just use: fetch("/api/protected", { credentials: "same-origin" })
```

**Backend middleware fix — read token from cookie:**
```js
import cookieParser from "cookie-parser";
app.use(cookieParser());

// In requireAuth():
const token = req.cookies.forge_token || req.headers.authorization?.split(" ")[1];
```
Add `cookie-parser` to dependencies: `npm install cookie-parser`.

---

### 1.6 SQLite WAL Files Committed to Repo

`forge.db-shm` and `forge.db-wal` contain live database data and are tracked by git.

**Fix — add to `.gitignore`:**
```
forge.db
forge.db-shm
forge.db-wal
temp/
```
Then run: `git rm --cached forge.db-shm forge.db-wal`

---

### 1.7 JSZip in devDependencies but Used in Production

**Current (package.json):**
```json
"devDependencies": {
  "jszip": "^3.10.1"
}
```
This means `npm install --production` (used in Docker/CI) won't install JSZip and export will crash.

**Fix:**
```json
"dependencies": {
  "jszip": "^3.10.1"
}
```

---

## 2. Backend Architecture

### 2.1 Move `server.js` Entry Point to Repo Root

**Current:** `package.json` says `"main": "src/api/server.js"` but `scripts.start` also points there. The conventional place for the entry point is the project root.

**Fix:** Create `server.js` at root that imports from `src/`:
```js
// server.js (root)
import "./src/api/server.js";
```
Update `package.json`:
```json
"main": "server.js",
"scripts": {
  "start": "node server.js",
  "dev": "node --watch server.js"
}
```

---

### 2.2 Add Graceful Shutdown

**Current:** No SIGTERM/SIGINT handling — DB writes can corrupt on container stop.

**Fix — append to `src/api/server.js`:**
```js
import db from "../../config/database.js";

const server = app.listen(config.port, () => { /* ... */ });

function shutdown(signal) {
  console.log(`\n[shutdown] Received ${signal}, closing gracefully...`);
  server.close(() => {
    db.close();
    console.log("[shutdown] Database closed. Exiting.");
    process.exit(0);
  });
  // Force kill after 10s
  setTimeout(() => process.exit(1), 10_000);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT",  () => shutdown("SIGINT"));
```

---

### 2.3 Add Request ID Middleware

Every request should carry a unique ID for tracing errors across logs.

**Install:** `npm install uuid`

**Add to `src/api/server.js`:**
```js
import { v4 as uuidv4 } from "uuid";

app.use((req, res, next) => {
  req.id = uuidv4();
  res.setHeader("X-Request-ID", req.id);
  next();
});
```
Log `req.id` in all `console.error` calls.

---

### 2.4 Add Token Refresh Endpoint

**Current:** 7-day token with no refresh mechanism — users get logged out silently.

**Add to `src/api/auth.js`:**
```js
// POST /api/auth/refresh
router.post("/refresh", requireAuth, (req, res) => {
  const newToken = jwt.sign(
    { userId: req.user.userId, username: req.user.username },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
  res.cookie("forge_token", newToken, { httpOnly: true, ... });
  res.json({ success: true });
});
```
Call this on the frontend when a 401 is received.

---

### 2.5 Add Project Update (PATCH) Endpoint

**Current:** Projects can only be created, read, and deleted — no editing.

**Add to `src/api/projects.js`:**
```js
// PATCH /api/projects/:id
router.patch("/:id", (req, res) => {
  const { name, notes } = req.body;
  try {
    const info = db.prepare(
      "UPDATE projects SET name = COALESCE(?, name), notes = COALESCE(?, notes), updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?"
    ).run(name ?? null, notes ?? null, req.params.id, req.user.userId);

    if (info.changes === 0) return res.status(404).json({ error: "Project not found" });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to update project" });
  }
});
```

---

### 2.6 Add Pagination to Projects List

**Current:** `SELECT * FROM projects WHERE user_id = ?` — returns everything. Will break with many projects.

**Fix:**
```js
router.get("/", (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(50, parseInt(req.query.limit) || 20);
  const offset = (page - 1) * limit;

  const projects = db.prepare(
    "SELECT id, name, board, created_at FROM projects WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?"
  ).all(req.user.userId, limit, offset);

  const total = db.prepare("SELECT COUNT(*) as c FROM projects WHERE user_id = ?").get(req.user.userId).c;

  res.json({ success: true, data: projects, meta: { page, limit, total, pages: Math.ceil(total / limit) } });
});
```

---

### 2.7 Startup Temp Directory Cleanup

**Current:** Crashed compilations leave orphan `temp/build_*` directories forever.

**Add to `src/api/server.js` startup:**
```js
import { promises as fs } from "node:fs";
import { join, dirname } from "node:path";

const TEMP_DIR = join(__dirname, "../../temp");

async function cleanupTemp() {
  try {
    const entries = await fs.readdir(TEMP_DIR);
    await Promise.all(entries.map(e => fs.rm(join(TEMP_DIR, e), { recursive: true, force: true })));
    console.log(`[startup] Cleaned ${entries.length} stale temp dirs`);
  } catch { /* temp dir may not exist yet */ }
}

cleanupTemp();
```

---

### 2.8 Compiler: Validate arduino-cli Exists Before Accepting Requests

**Add to `src/api/compiler.js`:**
```js
import { existsSync } from "node:fs";

router.post("/", async (req, res) => {
  if (!existsSync(CLI_PATH)) {
    return res.status(503).json({
      error: "Compiler unavailable",
      message: "arduino-cli is not installed on this server. Download it to ./bin/arduino-cli and restart.",
    });
  }
  // ... rest of handler
});
```

---

## 3. Error Handling & Observability

### 3.1 Replace console.log/error with a Structured Logger

**Install:** `npm install pino pino-pretty`

**Create `src/utils/logger.js`:**
```js
import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  transport: process.env.NODE_ENV !== "production"
    ? { target: "pino-pretty", options: { colorize: true } }
    : undefined,
});
```

Replace all `console.error("[generate] Error:", err.message)` with:
```js
logger.error({ err, requestId: req.id }, "Generation failed");
```

---

### 3.2 Global Unhandled Rejection Handler

**Add to `src/api/server.js`:**
```js
process.on("unhandledRejection", (reason, promise) => {
  logger.error({ reason, promise }, "Unhandled promise rejection");
});

process.on("uncaughtException", (err) => {
  logger.fatal({ err }, "Uncaught exception — shutting down");
  process.exit(1);
});
```

---

### 3.3 Better Frontend Error Display

**Current:** Raw `err.message` is shown directly to the user, potentially exposing internals.

**Fix in `public/js/app.js`:**
```js
function friendlyError(err) {
  const msg = err.message || "";
  if (msg.includes("429") || msg.includes("Rate limit")) return "⏳ Rate limit reached. Try again in a moment.";
  if (msg.includes("503") || msg.includes("unavailable")) return "🔧 AI service is busy. Please retry in a few seconds.";
  if (msg.includes("400")) return "⚠️ Invalid request — check your prompt and try again.";
  return "❌ Something went wrong. Please try again.";
}
```

---

### 3.4 Metrics Table Pruning (Prevent Unbounded Growth)

**Current:** `metrics` table grows forever — will fill disk on a busy server.

**Add a cleanup job in `src/api/metrics.js`:**
```js
// Run every hour, keep only last 30 days of metrics
setInterval(() => {
  try {
    db.prepare("DELETE FROM metrics WHERE created_at < datetime('now', '-30 days')").run();
  } catch (e) {
    logger.warn({ err: e }, "Metrics pruning failed");
  }
}, 60 * 60 * 1000);
```

---

### 3.5 Validate Code Compilation Input More Strictly

**Current:** The compiler accepts any string as `code`. An attacker could inject shell metacharacters through code content (low risk with exec + shell escape, but worth hardening).

**Add to compiler route:**
```js
if (typeof code !== "string" || code.length > 100_000) {
  return res.status(400).json({ error: "Code must be a string under 100KB" });
}
// Sanitize board input already done via BOARD_MAP lookup — good.
```

---

## 4. AI / Generation Logic

### 4.1 Add Streaming Support for Generation

**Current:** User waits 5-15 seconds with no feedback until the full response arrives.

**How:** Use Gemini's `streamGenerateContent` endpoint and pipe Server-Sent Events (SSE) to the frontend.

**Backend — `src/api/server.js`:**
```js
app.post("/api/generate/stream", rateLimit, async (req, res) => {
  const validation = validateGenerateRequest(req.body);
  if (!validation.valid) return res.status(400).json({ error: validation.error });

  const parsed = parseUserRequest(req.body.prompt);
  const userPrompt = buildUserPrompt(parsed);

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const stream = await streamGeminiResponse(userPrompt); // new function in codeGenerator.js

  for await (const chunk of stream) {
    const text = chunk?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    if (text) res.write(`data: ${JSON.stringify({ text })}\n\n`);
  }

  res.write("data: [DONE]\n\n");
  res.end();
});
```

**Frontend:**
```js
const evtSource = new EventSource("/api/generate/stream?" + new URLSearchParams({ prompt, board }));
evtSource.onmessage = (e) => {
  if (e.data === "[DONE]") { evtSource.close(); finalizeOutput(); return; }
  const { text } = JSON.parse(e.data);
  appendToCodeOutput(text); // stream into textarea in real-time
};
```

---

### 4.2 Add Retry Logic for Transient Gemini Failures

**Current:** One failure = one error shown to user, even for 503/429 that resolve instantly.

**Add to `src/generators/codeGenerator.js`:**
```js
async function withRetry(fn, maxRetries = 3, delayMs = 1000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const isRetryable = err.message.includes("503") || err.message.includes("429") || err.message.includes("timeout");
      if (!isRetryable || attempt === maxRetries) throw err;
      logger.warn({ attempt, err: err.message }, "Gemini call failed, retrying...");
      await new Promise(r => setTimeout(r, delayMs * attempt)); // exponential backoff
    }
  }
}

// Wrap the fetch call:
export async function generateArduinoCode(parsed) {
  return withRetry(() => _doGenerate(parsed));
}
```

---

### 4.3 Improve Component Detection — Fuzzy Matching

**Current:** Only exact substring matching. "temperature sensor" doesn't match DHT11 if user types "temp sensor".

**Install:** `npm install fuse.js`

**Replace the detection loop in `src/parsers/requestParser.js`:**
```js
import Fuse from "fuse.js";

// Build a searchable index from COMPONENT_KEYWORDS
const componentIndex = Object.entries(COMPONENT_KEYWORDS).flatMap(([id, keywords]) =>
  keywords.map(k => ({ id, keyword: k }))
);

const fuse = new Fuse(componentIndex, { keys: ["keyword"], threshold: 0.35 });

function detectComponents(lower) {
  const results = fuse.search(lower); // fuzzy search the whole prompt
  return [...new Set(results.map(r => r.item.id))];
}
```

---

### 4.4 Prompt Caching for Identical Requests

**Current:** Every identical prompt hits Gemini and charges tokens.

**Add an in-memory LRU cache in `src/generators/codeGenerator.js`:**
```js
// Simple LRU (or npm install lru-cache)
const cache = new Map();
const MAX_CACHE = 100;

function cacheKey(parsed) {
  return `${parsed.board}::${parsed.difficulty}::${parsed.description.toLowerCase().trim()}`;
}

export async function generateArduinoCode(parsed) {
  const key = cacheKey(parsed);
  if (cache.has(key)) return cache.get(key);

  const result = await withRetry(() => _doGenerate(parsed));

  if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value); // evict oldest
  cache.set(key, result);
  return result;
}
```

---

### 4.5 Add Conversational Follow-Up ("Modify My Code")

**Current:** Every generation is stateless — users can't ask the AI to tweak the output.

**Add a `/api/generate/refine` endpoint:**
```js
app.post("/api/generate/refine", rateLimit, async (req, res) => {
  const { originalCode, instruction } = req.body;
  if (!originalCode || !instruction) return res.status(400).json({ error: "originalCode and instruction are required" });

  const prompt = `
You previously generated this Arduino code:
\`\`\`cpp
${originalCode}
\`\`\`

The user wants to modify it: "${instruction}"

Apply ONLY the requested change. Keep all other parts identical.
Return the full updated code in a CODE: block using the same format as before.
  `;

  // Call Gemini with this prompt and return updated code
  // ...
});
```
Frontend: add a "Refine" textarea below the code output.

---

### 4.6 Expand Board Support

**Current:** Only 4 boards in `BOARD_MAP` and `COMPONENTS`. Add:

```js
// In src/core/components.js
"arduino-mega": {
  name: "Arduino Mega 2560",
  category: "microcontroller",
  voltage: 5,
  digitalPins: 54,
  analogPins: 16,
  pwmPins: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
  i2cPins: { sda: 20, scl: 21 },
  // ...
},
"rp2040": {
  name: "Raspberry Pi Pico (RP2040)",
  category: "microcontroller",
  voltage: 3.3,
  // ...
},
"stm32": { ... },
```

```js
// In src/api/compiler.js
const BOARD_MAP = {
  "arduino-mega": "arduino:avr:mega",
  "rp2040": "rp2040:rp2040:rpipico",
  // ...
};
```

Also update `src/validators/requestValidator.js` `VALID_BOARDS` array.

---

## 5. Frontend Overhaul

### 5.1 Replace Vanilla JS with a Module System

**Current:** All ~500+ lines in one `public/js/app.js` global file — unmaintainable.

**Recommended approach:** Use native ES modules (no bundler required, works with the existing static file server).

```
public/js/
├── app.js          ← entry point, imports everything
├── api.js          ← all fetch calls (already partially done)
├── state.js        ← state machine (IDLE/LOADING/RESULT/ERROR)
├── ui.js           ← DOM manipulation helpers
├── auth.js         ← auth modal logic
├── projects.js     ← project list/save/load logic
├── editor.js       ← code editor setup
└── utils.js        ← debounce, copyToClipboard, etc.
```

**Update `index.html`:**
```html
<script type="module" src="/js/app.js"></script>
```

---

### 5.2 Replace `<textarea>` Code Output with Monaco Editor

**Current:** Code output is a raw `<textarea>` with no syntax highlighting for editing.

**Add to `index.html`:**
```html
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs/editor/editor.main.min.css">
<script src="https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs/loader.min.js"></script>
```

**In `public/js/editor.js`:**
```js
let monacoEditor;

export function initEditor(containerId) {
  require.config({ paths: { vs: "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs" } });
  require(["vs/editor/editor.main"], () => {
    monacoEditor = monaco.editor.create(document.getElementById(containerId), {
      language: "cpp",
      theme: "vs-dark",
      fontSize: 13,
      fontFamily: "JetBrains Mono, monospace",
      minimap: { enabled: false },
      automaticLayout: true,
      readOnly: false, // Let users edit the generated code
    });
  });
}

export function setEditorValue(code) { monacoEditor?.setValue(code); }
export function getEditorValue() { return monacoEditor?.getValue() ?? ""; }
```

---

### 5.3 Add Light/Dark Mode Toggle

**Current:** Only dark mode is supported via CSS — no toggle.

**Add a CSS variable swap in `public/css/main.css`:**
```css
[data-theme="light"] {
  --bg-canvas: #ffffff;
  --bg-surface: #f6f8fa;
  --bg-inset: #f0f2f5;
  --border-subtle: #d0d7de;
  --text-primary: #1f2328;
  --text-secondary: #57606a;
  --accent-blue: #0969da;
}
```

**In `public/js/ui.js`:**
```js
export function initThemeToggle() {
  const saved = localStorage.getItem("forge_theme") || "dark";
  document.documentElement.setAttribute("data-theme", saved);

  document.getElementById("themeToggle").addEventListener("click", () => {
    const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("forge_theme", next);
  });
}
```

---

### 5.4 Add Keyboard Shortcuts

```js
// In public/js/app.js
document.addEventListener("keydown", (e) => {
  // Ctrl/Cmd + Enter = Generate
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
    e.preventDefault();
    if (currentState !== STATES.LOADING) handleGenerate();
  }
  // Ctrl/Cmd + K = Focus prompt
  if ((e.ctrlKey || e.metaKey) && e.key === "k") {
    e.preventDefault();
    els.prompt.focus();
  }
  // Ctrl/Cmd + S = Save project (when logged in and result shown)
  if ((e.ctrlKey || e.metaKey) && e.key === "s" && currentState === STATES.RESULT) {
    e.preventDefault();
    handleSaveProject();
  }
  // Escape = Close modals
  if (e.key === "Escape") closeAllModals();
});
```
Show hints in the UI: `Ctrl+Enter to generate · Ctrl+K to focus · Ctrl+S to save`

---

### 5.5 Add Wiring Diagram Visualizer

**Current:** Wiring is plain ASCII text in a code block — hard to read.

**Option A (simple):** Parse the ASCII wiring table and render it as a styled HTML table with color-coded wire colors.

**In `public/js/ui.js`:**
```js
export function renderWiringTable(wiringText) {
  const lines = wiringText.trim().split("\n").filter(l => l.includes("|"));
  // Parse columns: Component Pin | Wire Color | Board Pin | Notes
  const rows = lines.map(line => line.split("|").map(c => c.trim()).filter(Boolean));

  const WIRE_COLORS = {
    "red": "#e74c3c", "black": "#2c3e50", "blue": "#3498db",
    "green": "#27ae60", "yellow": "#f1c40f", "orange": "#e67e22",
    "white": "#ecf0f1", "brown": "#795548", "purple": "#9b59b6",
  };

  return `<table class="wiring-table">
    <thead><tr><th>Component Pin</th><th>Wire Color</th><th>Board Pin</th><th>Notes</th></tr></thead>
    <tbody>${rows.slice(1).map(row => `<tr>
      <td>${row[0] ?? ""}</td>
      <td><span class="wire-swatch" style="background:${WIRE_COLORS[row[1]?.toLowerCase()] ?? "#666"}"></span>${row[1] ?? ""}</td>
      <td><code>${row[2] ?? ""}</code></td>
      <td class="notes-col">${row[3] ?? ""}</td>
    </tr>`).join("")}</tbody>
  </table>`;
}
```

**Option B (advanced):** Integrate with [Wokwi Elements](https://github.com/wokwi/wokwi-elements) for a proper interactive circuit diagram.

---

### 5.6 Improve Mobile Responsiveness

**Current CSS** uses a two-column `.app-layout` grid with no breakpoint for narrow screens.

**Add to `public/css/main.css`:**
```css
@media (max-width: 768px) {
  .app-layout {
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr;
  }

  .input-panel {
    max-height: 40vh;
    overflow-y: auto;
  }

  .output-panel {
    min-height: 60vh;
  }

  .site-header .header-nav {
    display: none; /* Replace with hamburger menu */
  }

  .panel-tabs {
    overflow-x: auto;
    white-space: nowrap;
  }
}
```

---

### 5.7 Add Offline Detection & Retry UI

```js
// public/js/app.js
window.addEventListener("offline", () => {
  showToast("⚠️ No internet connection — saves and generation will fail.", "warning");
});

window.addEventListener("online", () => {
  showToast("✅ Connection restored.", "success");
});

function showToast(message, type = "info") {
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.getElementById("toastContainer").appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}
```
Add `#toastContainer` to `index.html` and style it as a fixed bottom-right container.

---

### 5.8 Component Browser Improvement

**Current:** The component dropdown just lists IDs. Make it a searchable visual gallery.

**In `public/js/app.js` `loadComponents()`:**
```js
function renderComponent(id, spec) {
  return `<div class="comp-card" data-id="${id}" role="button" tabindex="0">
    <div class="comp-icon">${getCategoryIcon(spec.category)}</div>
    <div class="comp-info">
      <span class="comp-name">${spec.name}</span>
      <span class="comp-category badge">${spec.category}</span>
      ${spec.voltage ? `<span class="comp-voltage">${spec.voltage}V</span>` : ""}
    </div>
  </div>`;
}
```
Clicking a component card appends it to the prompt textarea.

---

## 6. Database & Data Layer

### 6.1 Add `updated_at` and `tags` to Projects Table

```sql
-- Add to config/database.js initSql
ALTER TABLE projects ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE projects ADD COLUMN tags TEXT; -- JSON array of strings
ALTER TABLE projects ADD COLUMN is_public INTEGER DEFAULT 0; -- 0 = private, 1 = public
```

Run via a migration helper:
```js
// config/database.js — add after db.exec(initSql)
const migrations = [
  "ALTER TABLE projects ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP",
  "ALTER TABLE projects ADD COLUMN tags TEXT",
  "ALTER TABLE projects ADD COLUMN is_public INTEGER DEFAULT 0",
  "ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user'",
  "ALTER TABLE users ADD COLUMN email TEXT",
  "CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id)",
  "CREATE INDEX IF NOT EXISTS idx_metrics_endpoint ON metrics(endpoint)",
];

for (const sql of migrations) {
  try { db.exec(sql); } catch { /* column already exists */ }
}
```

---

### 6.2 Add a Simple Migration System

**Install:** `npm install @litejs/better-sqlite3-migrate` or write a simple custom one.

**Create `config/migrations/` directory** with numbered SQL files:
```
config/migrations/
├── 001_initial.sql
├── 002_add_updated_at.sql
├── 003_add_public_projects.sql
```

---

### 6.3 Public Project Sharing

Add a `GET /api/projects/public/:id` endpoint that returns a project without requiring auth (only if `is_public = 1`):

```js
router.get("/public/:id", (req, res) => {
  const project = db.prepare(
    "SELECT id, name, board, code, wiring, libraries, notes, created_at FROM projects WHERE id = ? AND is_public = 1"
  ).get(req.params.id);

  if (!project) return res.status(404).json({ error: "Project not found or not public" });
  if (project.libraries) project.libraries = JSON.parse(project.libraries);
  res.json({ success: true, data: project });
});
```

Frontend: add a "Share" button that toggles `is_public` and copies a shareable URL to clipboard.

---

## 7. Performance & Caching

### 7.1 Add ETags / Cache Headers for Static Assets

**In `src/api/server.js`:**
```js
app.use(express.static(PUBLIC_DIR, {
  maxAge: process.env.NODE_ENV === "production" ? "1d" : 0,
  etag: true,
  lastModified: true,
}));
```

---

### 7.2 Add `compression` for API Responses Too

**Current:** `compression()` is applied but Helmet's CSP may block some compressed responses. Verify it's working:
```js
// Test: curl -H "Accept-Encoding: gzip" http://localhost:3000/api/components -v
// Look for: Content-Encoding: gzip
```

---

### 7.3 Persistent Disk Cache for AI Responses (Optional)

For a production deployment with many identical prompts:
```js
// src/generators/cache.js
import db from "../../config/database.js";

// Add to initSql: CREATE TABLE IF NOT EXISTS prompt_cache (key TEXT PRIMARY KEY, response TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);

export function getCachedResponse(key) {
  const row = db.prepare("SELECT response FROM prompt_cache WHERE key = ? AND created_at > datetime('now', '-1 day')").get(key);
  return row ? JSON.parse(row.response) : null;
}

export function setCachedResponse(key, value) {
  db.prepare("INSERT OR REPLACE INTO prompt_cache (key, response) VALUES (?, ?)").run(key, JSON.stringify(value));
}
```

---

## 8. New Features (Prioritised)

### Priority 1 — High Impact, Low Effort

**P1.1 — Real-Time Generation Progress (SSE)**  
See section 4.1. Single most impactful UX improvement.

**P1.2 — Code Editing in Monaco**  
See section 5.2. Let users edit generated code before exporting.

**P1.3 — Wokwi Simulator Link**  
After generation, add a button: "Simulate in Wokwi"  
```js
// Wokwi supports URL-encoded sketches
const wokwiUrl = `https://wokwi.com/projects/new?template=${encodeURIComponent(generatedCode)}`;
window.open(wokwiUrl, "_blank");
```

**P1.4 — Project Tags & Search**  
Let users tag projects (e.g. "temperature", "ESP32", "motor") and search/filter them.

---

### Priority 2 — Medium Impact

**P2.1 — Export to PlatformIO**  
The ZIP export currently creates an Arduino IDE `.ino` structure. Add an option to export as a PlatformIO project:
```
ProjectName/
├── src/
│   └── main.cpp     (same code, renamed)
├── platformio.ini   (generated from board)
└── README.md
```

**`platformio.ini` template:**
```ini
[env:uno]
platform = atmelavr
board = uno
framework = arduino
lib_deps =
  ${detected_libraries}
```

**P2.2 — Multi-Board Code Generation**  
Let users generate for multiple boards at once: "Generate for both Uno and ESP32" → returns two code tabs.

**P2.3 — Community Template Gallery**  
A read-only page listing curated public projects (e.g., "Weather Station", "Smart Plant Watering"). Users click → loads into editor → can generate variations.

**P2.4 — Serial Monitor Emulator**  
A static mock that shows what typical `Serial.print()` output would look like, parsed from the generated code's comments.

---

### Priority 3 — Advanced / Optional

**P3.1 — MicroPython Mode**  
Add a `language` field to the generate request: `"cpp"` (default) or `"micropython"`. Adjust the system prompt and code block parser accordingly.

**P3.2 — Circuit Diagram Generation (SVG)**  
Use a library like `elkjs` or call a dedicated circuit-drawing API (Fritzing API, Circuit.js) to render an actual schematic from the wiring data.

**P3.3 — GitHub Gist Export**  
Add "Export to Gist" button that uses the GitHub API (with OAuth or PAT) to create a public gist with the `.ino` file.

**P3.4 — VS Code Extension**  
Package the API call into a VS Code extension that lets users trigger generation from inside their IDE.

---

## 9. DevOps & Developer Experience

### 9.1 Add a Dockerfile

```dockerfile
# Dockerfile
FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

FROM base AS final
COPY . .
EXPOSE 3000
ENV NODE_ENV=production

# Download arduino-cli (optional)
RUN apk add --no-cache curl && \
    curl -fsSL https://raw.githubusercontent.com/arduino/arduino-cli/master/install.sh | sh && \
    mv bin/arduino-cli /app/bin/arduino-cli && \
    /app/bin/arduino-cli core install arduino:avr esp32:esp32

CMD ["node", "server.js"]
```

```yaml
# docker-compose.yml
services:
  forge:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - ./forge.db:/app/forge.db
    environment:
      - GEMINI_API_KEY=${GEMINI_API_KEY}
      - JWT_SECRET=${JWT_SECRET}
      - NODE_ENV=production
    restart: unless-stopped
```

---

### 9.2 Add GitHub Actions CI/CD

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npm test
      - run: npm run lint
```

---

### 9.3 Write Tests

**Current:** `npm test` is defined but no test files exist.

**Create `tests/` directory:**
```
tests/
├── validators.test.js      ← unit test requestValidator
├── requestParser.test.js   ← unit test component/board detection
├── auth.test.js            ← integration test register/login
├── generate.test.js        ← integration test (mock Gemini)
└── helpers/
    └── mockGemini.js       ← intercept Gemini fetch calls
```

**Example test (Node's built-in test runner):**
```js
// tests/validators.test.js
import { describe, it } from "node:test";
import assert from "node:assert";
import { validateGenerateRequest } from "../src/validators/requestValidator.js";

describe("validateGenerateRequest", () => {
  it("rejects missing prompt", () => {
    assert.strictEqual(validateGenerateRequest({}).valid, false);
  });

  it("rejects prompt too short", () => {
    assert.strictEqual(validateGenerateRequest({ prompt: "hi" }).valid, false);
  });

  it("accepts valid request", () => {
    assert.strictEqual(validateGenerateRequest({ prompt: "Blink an LED every second on Arduino Uno" }).valid, true);
  });

  it("rejects invalid board", () => {
    assert.strictEqual(validateGenerateRequest({ prompt: "Blink LED for 15 chars ok", board: "raspberry-pi" }).valid, false);
  });
});
```

---

### 9.4 Add ESLint Config

**Current:** `eslint` is in devDependencies but no `.eslintrc` file exists.

**Create `.eslintrc.json`:**
```json
{
  "env": { "node": true, "es2022": true },
  "parserOptions": { "ecmaVersion": "latest", "sourceType": "module" },
  "rules": {
    "no-unused-vars": "warn",
    "no-console": "off",
    "prefer-const": "error",
    "no-var": "error",
    "eqeqeq": ["error", "always"]
  }
}
```

---

### 9.5 Update `package.json` Scripts

```json
"scripts": {
  "start":    "node server.js",
  "dev":      "node --watch --env-file=.env server.js",
  "test":     "node --test tests/**/*.test.js",
  "lint":     "eslint src/ public/js/ --ext .js",
  "lint:fix": "eslint src/ public/js/ --ext .js --fix",
  "db:reset": "node -e \"import('./config/database.js')\"",
  "docker:build": "docker build -t arduino-forge .",
  "docker:run": "docker run -p 3000:3000 --env-file .env arduino-forge"
}
```

---

### 9.6 Expand `.env.example`

```bash
# Server
PORT=3000
NODE_ENV=development

# Required: Google Gemini API Key
GEMINI_API_KEY=your_google_gemini_api_key_here

# Required: Generate with: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_SECRET=

# Optional: Gemini model override
GEMINI_MODEL=gemini-2.0-flash

# Optional: Rate limiting (requests per window)
RATE_LIMIT_POINTS=20
RATE_LIMIT_DURATION=3600

# Optional: CORS (set to your domain in production)
ALLOWED_ORIGIN=*

# Optional: Logging level (trace, debug, info, warn, error, fatal)
LOG_LEVEL=info
```

---

## 10. Dependency Audit

| Package | Current | Recommendation |
|---------|---------|---------------|
| `better-sqlite3` | ^12.8.0 | ✅ Keep — excellent sync SQLite driver |
| `bcrypt` | ^6.0.0 | ✅ Keep — but consider `argon2` for stronger hashing |
| `jsonwebtoken` | ^9.0.3 | ✅ Keep |
| `rate-limiter-flexible` | ^4.0.1 | ✅ Keep |
| `helmet` | ^7.1.0 | ✅ Keep |
| `compression` | ^1.7.4 | ✅ Keep |
| `marked` | ^9.1.0 | ⚠️ Not used in current source — remove if unused |
| `highlight.js` | ^11.9.0 | ⚠️ Loaded via CDN in HTML — remove from dependencies if only via CDN |
| `jszip` | ^3.10.1 | 🔴 Move from `devDependencies` to `dependencies` |
| `eslint` | devDep | ✅ Keep, add config |
| — | — | ➕ Add `pino` + `pino-pretty` for logging |
| — | — | ➕ Add `cookie-parser` for httpOnly JWT |
| — | — | ➕ Add `fuse.js` for fuzzy component matching |
| — | — | ➕ Add `uuid` for request IDs (or use `crypto.randomUUID()` — built-in Node 19+) |

---

## 11. File-by-File Checklist

Use this as your opencode task list. Check off each item as completed.

### `config/database.js`
- [ ] Add migration runner for new columns
- [ ] Add `updated_at`, `tags`, `is_public` to projects
- [ ] Add `role`, `email` to users
- [ ] Add `prompt_cache` table for AI response caching
- [ ] Add DB indexes on `projects(user_id)` and `metrics(endpoint)`
- [ ] Add `forge.db*` to `.gitignore`, run `git rm --cached`

### `config/default.js`
- [ ] Throw if `JWT_SECRET` is missing (not fallback)
- [ ] Add `jwtSecret`, `logLevel`, `cookieSecret` fields

### `src/api/server.js`
- [ ] Add `cookie-parser` middleware
- [ ] Add request ID middleware
- [ ] Add graceful shutdown (SIGTERM/SIGINT)
- [ ] Add temp dir cleanup on startup
- [ ] Replace `console.log` with `logger`
- [ ] Add `unhandledRejection` / `uncaughtException` handlers
- [ ] Add `/api/generate/stream` SSE endpoint
- [ ] Add `/api/generate/refine` endpoint

### `src/api/auth.js`
- [ ] Remove hardcoded JWT fallback secret
- [ ] Add rate limiting to `/login` and `/register`
- [ ] Switch from `res.json({ token })` to `res.cookie(httpOnly)`
- [ ] Update `requireAuth` to read from cookie first, then header
- [ ] Add `/refresh` token endpoint
- [ ] Add email field to register

### `src/api/projects.js`
- [ ] Add `PATCH /:id` for editing project name/notes/tags
- [ ] Add pagination to `GET /`
- [ ] Add `GET /public/:id` for shared projects
- [ ] Add `PATCH /:id/visibility` to toggle public/private

### `src/api/metrics.js`
- [ ] Add `requireAuth` + `requireAdmin` to `GET /`
- [ ] Add pruning job (delete records older than 30 days)
- [ ] Add `method` and `user_id` columns to metrics logging

### `src/api/compiler.js`
- [ ] Check `arduino-cli` exists before accepting requests
- [ ] Add 100KB code size limit check
- [ ] Add more FQBNs for Mega, Pico, STM32

### `src/api/export.js`
- [ ] Add PlatformIO export option (`?format=platformio`)
- [ ] Include library list in `platformio.ini`

### `src/generators/codeGenerator.js`
- [ ] Move API key to `x-goog-api-key` header (remove from URL)
- [ ] Add `withRetry` exponential backoff wrapper
- [ ] Add in-memory LRU cache
- [ ] Add `streamGeminiResponse` generator function for SSE

### `src/parsers/requestParser.js`
- [ ] Replace substring matching with Fuse.js fuzzy search
- [ ] Add `arduino-mega`, `rp2040` board keywords
- [ ] Add more component keywords (NeoPixel, TFT display, GPS, fingerprint)

### `src/core/components.js`
- [ ] Add `arduino-mega`, `rp2040`, `arduino-due` boards
- [ ] Add `neo-pixel`, `tft-ili9341`, `gps-neo6m`, `fingerprint-r307` components

### `src/validators/requestValidator.js`
- [ ] Update `VALID_BOARDS` to match `COMPONENTS` keys
- [ ] Add `language` field validation (`cpp` | `micropython`)

### `public/js/app.js`
- [ ] Split into modules: `api.js`, `state.js`, `ui.js`, `auth.js`, `projects.js`, `editor.js`, `utils.js`
- [ ] Remove localStorage JWT — use httpOnly cookies
- [ ] Add keyboard shortcuts (Ctrl+Enter, Ctrl+K, Ctrl+S, Escape)
- [ ] Add offline/online detection with toasts
- [ ] Add `friendlyError()` mapper for user-facing errors
- [ ] Add streaming output support for SSE endpoint
- [ ] Add "Refine" follow-up prompt UI

### `public/js/editor.js` ← New file
- [ ] Initialize Monaco Editor for code output
- [ ] Wire `getEditorValue()` to Export/Compile/Save actions

### `public/css/main.css`
- [ ] Add `[data-theme="light"]` CSS variable overrides
- [ ] Add `@media (max-width: 768px)` responsive breakpoints
- [ ] Add `.toast` and `#toastContainer` styles
- [ ] Add `.wiring-table` styles with wire color swatches
- [ ] Add `.comp-card` styles for component browser

### `public/index.html`
- [ ] Add Monaco Editor CDN links
- [ ] Add `#toastContainer` div
- [ ] Add theme toggle button to header
- [ ] Add keyboard shortcut hints to generate button
- [ ] Change `<script src=...>` to `<script type="module" src=...>`
- [ ] Add `<meta name="theme-color">` for PWA support

### Root / Config files
- [ ] `.gitignore` — add `forge.db*`, `temp/`, `node_modules/`, `.env`
- [ ] `.env.example` — add all missing variables (see section 9.6)
- [ ] `Dockerfile` + `docker-compose.yml` — add (see section 9.1)
- [ ] `.github/workflows/ci.yml` — add (see section 9.2)
- [ ] `.eslintrc.json` — add (see section 9.4)
- [ ] `package.json` — fix `jszip` to `dependencies`, update scripts

---

## Quick Start for opencode

When opening this project in opencode, start with this prompt sequence:

**Round 1 — Security (critical):**
> "Fix all items in Section 1 of BLUEPRINT.md: hardcoded JWT fallback, API key URL leak, unprotected metrics endpoint, auth brute force, localStorage JWT, gitignore for db files, jszip devDependency."

**Round 2 — Backend stability:**
> "Implement Section 2: graceful shutdown, request ID middleware, token refresh endpoint, project PATCH route, pagination, startup temp cleanup, compiler arduino-cli check."

**Round 3 — Frontend:**
> "Implement Section 5: split app.js into ES modules, add Monaco editor, light/dark toggle, keyboard shortcuts, mobile responsive CSS, toast notification system."

**Round 4 — AI improvements:**
> "Implement Section 4: streaming SSE generation endpoint + frontend SSE consumer, retry logic with exponential backoff, Fuse.js fuzzy component detection, in-memory LRU cache."

**Round 5 — New features:**
> "Implement the Priority 1 items from Section 8: Wokwi simulator link, project tags, PlatformIO export option."

---

*Blueprint generated by analysis of commit `main` · Arduino Forge v1.0.0*
