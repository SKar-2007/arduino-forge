import express from "express";
import crypto from "node:crypto";
import db from "../../config/database.js";
import { requireAuth } from "./auth.js";
import { logger } from "../utils/logger.js";

const router = express.Router();

router.use(requireAuth);

router.get("/", (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 20);
    const offset = (page - 1) * limit;

    const projects = db.prepare(
      "SELECT id, name, board, created_at, updated_at FROM projects WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?"
    ).all(req.user.userId, limit, offset);

    const total = db.prepare("SELECT COUNT(*) as c FROM projects WHERE user_id = ?").get(req.user.userId).c;

    res.json({
      success: true,
      data: projects,
      meta: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    logger.error({ err }, "Failed to list projects");
    res.status(500).json({ error: "Failed to load projects" });
  }
});

router.get("/:id", (req, res) => {
  try {
    const project = db.prepare("SELECT * FROM projects WHERE id = ? AND user_id = ?").get(req.params.id, req.user.userId);
    if (!project) return res.status(404).json({ error: "Project not found" });

    if (project.libraries) project.libraries = JSON.parse(project.libraries);
    if (project.tags) project.tags = JSON.parse(project.tags);

    res.json({ success: true, data: project });
  } catch (err) {
    logger.error({ err }, "Error retrieving project");
    res.status(500).json({ error: "Error retrieving project" });
  }
});

router.patch("/:id", (req, res) => {
  const { name, notes, tags } = req.body;
  try {
    const info = db.prepare(
      "UPDATE projects SET name = COALESCE(?, name), notes = COALESCE(?, notes), tags = COALESCE(?, tags), updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?"
    ).run(
      name ?? null,
      notes ?? null,
      tags ? JSON.stringify(tags) : null,
      req.params.id,
      req.user.userId
    );

    if (info.changes === 0) return res.status(404).json({ error: "Project not found" });
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "Failed to update project");
    res.status(500).json({ error: "Failed to update project" });
  }
});

router.patch("/:id/visibility", (req, res) => {
  const { is_public } = req.body;
  try {
    const info = db.prepare(
      "UPDATE projects SET is_public = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?"
    ).run(is_public ? 1 : 0, req.params.id, req.user.userId);

    if (info.changes === 0) return res.status(404).json({ error: "Project not found" });
    res.json({ success: true, is_public: !!is_public });
  } catch (err) {
    logger.error({ err }, "Failed to update visibility");
    res.status(500).json({ error: "Failed to update visibility" });
  }
});

router.post("/", (req, res) => {
  const { name, prompt, board, code, wiring, libraries, notes, tags } = req.body;
  if (!name || !code) return res.status(400).json({ error: "Project name and code are required" });

  try {
    const id = crypto.randomUUID();
    db.prepare(`
      INSERT INTO projects (id, user_id, name, prompt, board, code, wiring, libraries, notes, tags)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, req.user.userId, name, prompt || null, board || "Unknown",
      code, wiring || null, libraries ? JSON.stringify(libraries) : null,
      notes || null, tags ? JSON.stringify(tags) : null
    );

    res.json({ success: true, id });
  } catch (err) {
    logger.error({ err }, "Failed to save project");
    res.status(500).json({ error: "Failed to save project" });
  }
});

router.delete("/:id", (req, res) => {
  try {
    const del = db.prepare("DELETE FROM projects WHERE id = ? AND user_id = ?");
    const info = del.run(req.params.id, req.user.userId);
    if (info.changes === 0) return res.status(404).json({ error: "Project not found" });
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "Failed to delete project");
    res.status(500).json({ error: "Failed to delete project" });
  }
});

router.get("/public/:id", (req, res) => {
  try {
    const project = db.prepare(
      "SELECT id, name, board, code, wiring, libraries, notes, created_at FROM projects WHERE id = ? AND is_public = 1"
    ).get(req.params.id);

    if (!project) return res.status(404).json({ error: "Project not found or not public" });
    if (project.libraries) project.libraries = JSON.parse(project.libraries);
    res.json({ success: true, data: project });
  } catch (err) {
    logger.error({ err }, "Failed to fetch public project");
    res.status(500).json({ error: "Error fetching project" });
  }
});

export default router;
