/**
 * Arduino Forge — API Server
 *
 * Express server exposing:
 *   POST /api/generate  — main code generation endpoint
 *   GET  /api/components — list all known components
 *   GET  /api/health     — health check
 *
 * Rate limiting: 20 requests / hour per IP (free model — generous but protected).
 * No auth required. No user data stored.
 */

import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { RateLimiterMemory } from "rate-limiter-flexible";
import { config } from "../../config/default.js";
import { parseUserRequest } from "../parsers/requestParser.js";
import { generateArduinoCode } from "../generators/codeGenerator.js";
import { COMPONENTS, getByCategory } from "../core/components.js";
import { validateGenerateRequest } from "../validators/requestValidator.js";

// -- Import new routers --
import exportRouter from "./export.js";
import authRouter from "./auth.js";
import projectsRouter from "./projects.js";
import compilerRouter from "./compiler.js";

// ── Path helpers (ESM doesn't have __dirname) ──────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PUBLIC_DIR = join(__dirname, "../../public");

const app = express();

// ── Middleware ─────────────────────────────────────────────────
app.use(compression());
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "cdnjs.cloudflare.com"],
            styleSrc: ["'self'", "'unsafe-inline'", "fonts.googleapis.com", "cdnjs.cloudflare.com"],
            fontSrc: ["'self'", "fonts.gstatic.com"],
            connectSrc: ["'self'"],
        },
    },
}));
app.use(cors({ origin: config.allowedOrigin }));
app.use(express.json({ limit: "16kb" }));
app.use(express.static(PUBLIC_DIR));

// Mount routes
app.use("/api/export", exportRouter);
app.use("/api/auth", authRouter);
app.use("/api/projects", projectsRouter);
app.use("/api/compile", compilerRouter);

// ── Rate limiter — configurable via config ─────────────────────
const rateLimiter = new RateLimiterMemory({
    points: config.rateLimit.points,
    duration: config.rateLimit.duration,
});

async function rateLimit(req, res, next) {
    try {
        await rateLimiter.consume(req.ip);
        next();
    } catch (rej) {
        const retryAfter = Math.ceil(rej.msBeforeNext / 1000 / 60);
        res.status(429).json({
            error: "Rate limit reached",
            message: `You've used your ${config.rateLimit.points} free generations for this hour. Try again in ${retryAfter} minutes.`,
            retryAfterMinutes: retryAfter,
        });
    }
}

// ── Routes ─────────────────────────────────────────────────────

/**
 * POST /api/generate
 * Body: { prompt: string, board?: string, difficulty?: string }
 *
 * Returns: { summary, libraries, wiring, code, notes, meta }
 */
app.post("/api/generate", rateLimit, async (req, res) => {
    const startTime = Date.now();

    // Validate input
    const validation = validateGenerateRequest(req.body);
    if (!validation.valid) {
        return res.status(400).json({ error: validation.error });
    }

    try {
        // Parse natural language → structured request
        const parsed = parseUserRequest(req.body.prompt);

        // Allow manual overrides from the UI
        if (req.body.board) parsed.board = req.body.board;
        if (req.body.difficulty) parsed.difficulty = req.body.difficulty;

        // Generate code via AI
        const result = await generateArduinoCode(parsed);

        const elapsed = Date.now() - startTime;

        return res.json({
            success: true,
            data: {
                summary: result.summary,
                libraries: result.libraries,
                wiring: result.wiring,
                code: result.code,
                notes: result.notes,
            },
            meta: {
                board: parsed.detectedBoard,
                components: parsed.detectedComponents,
                difficulty: parsed.difficulty,
                warnings: parsed.warnings,
                generationTimeMs: elapsed,
                model: config.gemini.model,
            },
        });

    } catch (err) {
        console.error("[generate] Error:", err.message);

        // Gemini quota errors
        if (err.message.includes("429") || err.message.includes("quota")) {
            return res.status(503).json({
                error: "AI service temporarily unavailable",
                message: "The AI service is at capacity. Please try again in a moment.",
            });
        }

        return res.status(500).json({
            error: "Generation failed",
            message: err.message,
        });
    }
});

/**
 * GET /api/components
 * Returns all known components grouped by category.
 */
app.get("/api/components", (req, res) => {
    const grouped = {
        microcontrollers: getByCategory("microcontroller"),
        sensors: getByCategory("sensor"),
        displays: getByCategory("display"),
        actuators: getByCategory("actuator"),
        communication: getByCategory("communication"),
    };
    res.json({ success: true, data: grouped });
});

/**
 * GET /api/health
 */
app.get("/api/health", (req, res) => {
    res.json({
        status: "ok",
        version: "1.0.0",
        timestamp: new Date().toISOString(),
        geminiKey: !!config.gemini.apiKey,
    });
});

// ── 404 handler ────────────────────────────────────────────────
app.use((req, res) => {
    // API routes return JSON 404
    if (req.path.startsWith("/api/")) {
        return res.status(404).json({ error: "Route not found" });
    }
    // All other routes serve the SPA
    res.sendFile("index.html", { root: PUBLIC_DIR });
});

// ── Error handler ──────────────────────────────────────────────
app.use((err, req, res, _next) => {
    console.error("[unhandled]", err);
    res.status(500).json({ error: "Internal server error" });
});

// ── Start ──────────────────────────────────────────────────────
app.listen(config.port, () => {
    console.log(`\n  ⚡ Arduino Forge running at http://localhost:${config.port}`);
    console.log(`  Gemini key: ${config.gemini.apiKey ? "✓ loaded" : "✗ missing"}`);
    console.log(`  Model:      ${config.gemini.model}`);
    console.log(`  Environment: ${config.nodeEnv}\n`);
});

export default app;
