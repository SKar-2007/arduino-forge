import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import db from "../../config/database.js";
import { config } from "../../config/default.js";

const router = express.Router();

const JWT_SECRET = config.jwtSecret || "super-secret-forge-key-fallback";

// POST /api/auth/register
router.post("/register", async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password || password.length < 6) {
        return res.status(400).json({ error: "Invalid username or password (min 6 chars)" });
    }

    try {
        const hash = await bcrypt.hash(password, 10);
        const stmt = db.prepare("INSERT INTO users (username, password_hash) VALUES (?, ?)");
        const info = stmt.run(username, hash);

        const token = jwt.sign({ userId: info.lastInsertRowid, username }, JWT_SECRET, { expiresIn: "7d" });
        res.json({ success: true, token, username });
    } catch (err) {
        if (err.code === "SQLITE_CONSTRAINT_UNIQUE") {
            return res.status(409).json({ error: "Username already exists" });
        }
        console.error(err);
        res.status(500).json({ error: "Server error" });
    }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
    const { username, password } = req.body;

    try {
        const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username);
        if (!user) {
            return res.status(401).json({ error: "Invalid credentials" });
        }

        const match = await bcrypt.compare(password, user.password_hash);
        if (!match) {
            return res.status(401).json({ error: "Invalid credentials" });
        }

        const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: "7d" });
        res.json({ success: true, token, username: user.username });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server error" });
    }
});

/**
 * Middleware to protect routes mapping Authorization header
 */
export function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    const token = authHeader.split(" ")[1];
    try {
        const payload = jwt.verify(token, JWT_SECRET);
        req.user = payload; // { userId, username }
        next();
    } catch (err) {
        return res.status(401).json({ error: "Invalid token" });
    }
}

export default router;
