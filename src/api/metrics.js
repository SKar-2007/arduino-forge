/**
 * Arduino Forge — Admin Metrics API
 *
 * Provides aggregated statistics on API usage, users, and saved projects.
 * In a real application, this would be protected by admin middleware.
 */

import express from "express";
import db from "../../config/database.js";

const router = express.Router();

/**
 * GET /api/metrics
 */
router.get("/", (req, res) => {
    try {
        // Basic aggregations
        const usersCount = db.prepare("SELECT COUNT(*) as count FROM users").get().count;
        const projectsCount = db.prepare("SELECT COUNT(*) as count FROM projects").get().count;

        // Recent generations (from metrics table)
        const totalGenerations = db.prepare("SELECT COUNT(*) as count FROM metrics WHERE endpoint = '/api/generate'").get().count;

        const recentMetrics = db.prepare(`
      SELECT endpoint, status_code, duration_ms, created_at 
      FROM metrics 
      ORDER BY created_at DESC 
      LIMIT 10
    `).all();

        res.json({
            success: true,
            stats: {
                totalUsers: usersCount,
                totalProjectsSaved: projectsCount,
                totalCodeGenerations: totalGenerations
            },
            recentActivity: recentMetrics
        });
    } catch (err) {
        console.error("[metrics] Error:", err);
        res.status(500).json({ error: "Failed to fetch metrics" });
    }
});

/**
 * Middleware to log requests to the database
 */
export function metricsMiddleware(req, res, next) {
    const start = Date.now();

    // Wait for request to finish to log status code and duration
    res.on("finish", () => {
        // Only log API routes
        if (req.originalUrl.startsWith("/api/")) {
            const duration = Date.now() - start;
            try {
                const stmt = db.prepare("INSERT INTO metrics (endpoint, duration_ms, status_code) VALUES (?, ?, ?)");
                stmt.run(req.originalUrl, duration, res.statusCode);
            } catch (e) {
                console.error("Failed to log metric:", e);
            }
        }
    });

    next();
}

export default router;
