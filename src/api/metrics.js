import express from "express";
import db from "../../config/database.js";
import { requireAuth } from "./auth.js";
import { logger } from "../utils/logger.js";

const router = express.Router();

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
}

router.get("/", requireAuth, requireAdmin, (req, res) => {
  try {
    const usersCount = db.prepare("SELECT COUNT(*) as count FROM users").get().count;
    const projectsCount = db.prepare("SELECT COUNT(*) as count FROM projects").get().count;
    const totalGenerations = db.prepare("SELECT COUNT(*) as count FROM metrics WHERE endpoint = '/api/generate'").get().count;

    const recentMetrics = db.prepare(`
      SELECT endpoint, method, status_code, duration_ms, created_at
      FROM metrics
      ORDER BY created_at DESC
      LIMIT 10
    `).all();

    res.json({
      success: true,
      stats: {
        totalUsers: usersCount,
        totalProjectsSaved: projectsCount,
        totalCodeGenerations: totalGenerations,
      },
      recentActivity: recentMetrics,
    });
  } catch (err) {
    logger.error({ err }, "Failed to fetch metrics");
    res.status(500).json({ error: "Failed to fetch metrics" });
  }
});

setInterval(() => {
  try {
    db.prepare("DELETE FROM metrics WHERE created_at < datetime('now', '-30 days')").run();
  } catch (e) {
    logger.warn({ err: e }, "Metrics pruning failed");
  }
}, 60 * 60 * 1000);

export function metricsMiddleware(req, res, next) {
  const start = Date.now();

  res.on("finish", () => {
    if (req.originalUrl.startsWith("/api/")) {
      const duration = Date.now() - start;
      try {
        db.prepare(
          "INSERT INTO metrics (endpoint, method, user_id, duration_ms, status_code) VALUES (?, ?, ?, ?, ?)"
        ).run(req.originalUrl, req.method, req.user?.userId || null, duration, res.statusCode);
      } catch (e) {
        logger.error({ err: e }, "Failed to log metric");
      }
    }
  });

  next();
}

export default router;
