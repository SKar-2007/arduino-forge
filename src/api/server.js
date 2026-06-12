import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import cookieParser from "cookie-parser";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { promises as fs } from "node:fs";
import { RateLimiterMemory } from "rate-limiter-flexible";
import crypto from "node:crypto";
import db from "../../config/database.js";
import { config } from "../../config/default.js";
import { logger } from "../utils/logger.js";
import { parseUserRequest } from "../parsers/requestParser.js";
import { generateArduinoCode, streamGeminiResponse } from "../generators/codeGenerator.js";
import { getByCategory } from "../core/components.js";
import { validateGenerateRequest } from "../validators/requestValidator.js";
import { buildUserPrompt } from "../core/promptBuilder.js";

import exportRouter from "./export.js";
import authRouter from "./auth.js";
import projectsRouter from "./projects.js";
import compilerRouter from "./compiler.js";
import metricsRouter, { metricsMiddleware } from "./metrics.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PUBLIC_DIR = join(__dirname, "../../public");
const TEMP_DIR = join(__dirname, "../../temp");

const app = express();

async function cleanupTemp() {
  try {
    const entries = await fs.readdir(TEMP_DIR);
    await Promise.all(entries.map(e => fs.rm(join(TEMP_DIR, e), { recursive: true, force: true })));
    logger.info(`Cleaned ${entries.length} stale temp dirs`);
  } catch { }
}

cleanupTemp();

app.use(metricsMiddleware);
app.use(compression());
app.use(cookieParser());
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "cdnjs.cloudflare.com", "accounts.google.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "fonts.googleapis.com", "cdnjs.cloudflare.com"],
      fontSrc: ["'self'", "fonts.gstatic.com"],
      connectSrc: ["'self'"],
      imgSrc: ["'self'", "https://*.googleusercontent.com"],
      frameSrc: ["'self'", "https://accounts.google.com"],
    },
  },
}));
app.use(cors({ origin: config.allowedOrigin }));
app.use(express.json({ limit: "16kb" }));
app.use(express.static(PUBLIC_DIR, {
  maxAge: config.nodeEnv === "production" ? "1d" : 0,
  etag: true,
  lastModified: true,
}));

app.use((req, res, next) => {
  req.id = crypto.randomUUID();
  res.setHeader("X-Request-ID", req.id);
  next();
});

app.use("/api/export", exportRouter);
app.use("/api/auth", authRouter);
app.use("/api/projects", projectsRouter);
app.use("/api/compile", compilerRouter);
app.use("/api/metrics", metricsRouter);

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

app.post("/api/generate", rateLimit, async (req, res) => {
  const startTime = Date.now();
  const validation = validateGenerateRequest(req.body);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }

  try {
    const parsed = parseUserRequest(req.body.prompt);
    if (req.body.board) parsed.board = req.body.board;
    if (req.body.difficulty) parsed.difficulty = req.body.difficulty;

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
    logger.error({ err, requestId: req.id }, "Generation failed");

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

app.post("/api/generate/stream", rateLimit, async (req, res) => {
  const validation = validateGenerateRequest(req.body);
  if (!validation.valid) return res.status(400).json({ error: validation.error });

  const parsed = parseUserRequest(req.body.prompt);
  if (req.body.board) parsed.board = req.body.board;
  if (req.body.difficulty) parsed.difficulty = req.body.difficulty;

  const userPrompt = buildUserPrompt(parsed);

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  try {
    const stream = await streamGeminiResponse(userPrompt);
    for await (const chunk of stream) {
      const text = chunk?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      if (text) res.write(`data: ${JSON.stringify({ text })}\n\n`);
    }
    res.write("data: [DONE]\n\n");
  } catch (err) {
    logger.error({ err, requestId: req.id }, "Stream generation failed");
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
  }
  res.end();
});

app.post("/api/generate/refine", rateLimit, async (req, res) => {
  const { originalCode, instruction } = req.body;
  if (!originalCode || !instruction) {
    return res.status(400).json({ error: "originalCode and instruction are required" });
  }

  try {
    const prompt = `You previously generated this Arduino code:
\`\`\`cpp
${originalCode}
\`\`\`

The user wants to modify it: "${instruction}"

Apply ONLY the requested change. Keep all other parts identical.
Return the full updated code in a CODE: block using the same format as before.`;

    const result = await generateArduinoCode({ description: prompt, board: "arduino-uno", components: [], difficulty: "intermediate", extras: [] });
    res.json({ success: true, data: { code: result.code } });
  } catch (err) {
    logger.error({ err, requestId: req.id }, "Refinement failed");
    res.status(500).json({ error: "Refinement failed: " + err.message });
  }
});

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

app.get("/api/config", (req, res) => {
  res.json({
    googleClientId: config.googleClientId || null,
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    geminiKey: !!config.gemini.apiKey,
  });
});

app.use((req, res) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ error: "Route not found" });
  }
  res.sendFile("index.html", { root: PUBLIC_DIR });
});

app.use((err, req, res, _next) => { // eslint-disable-line no-unused-vars
  logger.error({ err, requestId: req.id }, "Unhandled error");
  res.status(500).json({ error: "Internal server error" });
});

const server = app.listen(config.port, () => {
  logger.info({ port: config.port }, "Arduino Forge started");
});

function shutdown(signal) {
  logger.info({ signal }, "Shutting down gracefully...");
  server.close(() => {
    db.close();
    logger.info("Database closed. Exiting.");
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

process.on("unhandledRejection", (reason, promise) => {
  logger.error({ reason, promise }, "Unhandled promise rejection");
});

process.on("uncaughtException", (err) => {
  logger.fatal({ err }, "Uncaught exception — shutting down");
  process.exit(1);
});

export default app;
