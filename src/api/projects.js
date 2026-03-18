import express from "express";
import crypto from "node:crypto";
import db from "../../config/database.js";
import { requireAuth } from "./auth.js";

const router = express.Router();

// All project routes require auth
router.use(requireAuth);

// GET /api/projects
router.get("/", (req, res) => {
    try {
        const projects = db.prepare("SELECT id, name, board, created_at FROM projects WHERE user_id = ? ORDER BY created_at DESC").all(req.user.userId);
        res.json({ success: true, data: projects });
    } catch (err) {
        res.status(500).json({ error: "Failed to load projects" });
    }
});

// GET /api/projects/:id
router.get("/:id", (req, res) => {
    try {
        const project = db.prepare("SELECT * FROM projects WHERE id = ? AND user_id = ?").get(req.params.id, req.user.userId);
        if (!project) return res.status(404).json({ error: "Project not found" });

        // Auto-parse libraries
        if (project.libraries) project.libraries = JSON.parse(project.libraries);

        res.json({ success: true, data: project });
    } catch (err) {
        res.status(500).json({ error: "Error retrieving project" });
    }
});

// POST /api/projects
router.post("/", (req, res) => {
    const { name, prompt, board, code, wiring, libraries, notes } = req.body;
    if (!name || !code) return res.status(400).json({ error: "Project name and code are required" });

    try {
        const id = crypto.randomUUID();
        const save = db.prepare(`
      INSERT INTO projects (id, user_id, name, prompt, board, code, wiring, libraries, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

        save.run(
            id,
            req.user.userId,
            name,
            prompt || null,
            board || "Unknown",
            code,
            wiring || null,
            libraries ? JSON.stringify(libraries) : null,
            notes || null
        );

        res.json({ success: true, id });
    } catch (err) {
        console.error("[save project] error:", err);
        res.status(500).json({ error: "Failed to save project" });
    }
});

// DELETE /api/projects/:id
router.delete("/:id", (req, res) => {
    try {
        const del = db.prepare("DELETE FROM projects WHERE id = ? AND user_id = ?");
        const info = del.run(req.params.id, req.user.userId);
        if (info.changes === 0) return res.status(404).json({ error: "Project not found" });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Failed to delete project" });
    }
});

export default router;
