import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { RateLimiterMemory } from "rate-limiter-flexible";
import db from "../../config/database.js";
import { config } from "../../config/default.js";
import { logger } from "../utils/logger.js";

const router = express.Router();
const JWT_SECRET = config.jwtSecret;

const authLimiter = new RateLimiterMemory({ points: 10, duration: 60 });

async function authRateLimit(req, res, next) {
  try {
    await authLimiter.consume(req.ip);
    next();
  } catch {
    res.status(429).json({ error: "Too many attempts. Wait 60 seconds." });
  }
}

function signToken(userId, username) {
  return jwt.sign({ userId, username }, JWT_SECRET, { expiresIn: "7d" });
}

function setTokenCookie(res, token) {
  res.cookie("forge_token", token, {
    httpOnly: true,
    secure: config.nodeEnv === "production",
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

router.post("/register", authRateLimit, async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password || password.length < 6) {
    return res.status(400).json({ error: "Invalid username or password (min 6 chars)" });
  }

  try {
    const hash = await bcrypt.hash(password, 10);
    const stmt = db.prepare("INSERT INTO users (username, password_hash) VALUES (?, ?)");
    const info = stmt.run(username, hash);

    const token = signToken(info.lastInsertRowid, username);
    setTokenCookie(res, token);
    res.json({ success: true, username });
  } catch (err) {
    if (err.code === "SQLITE_CONSTRAINT_UNIQUE") {
      return res.status(409).json({ error: "Username already exists" });
    }
    logger.error({ err }, "Registration failed");
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/login", authRateLimit, async (req, res) => {
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

    const token = signToken(user.id, user.username);
    setTokenCookie(res, token);
    res.json({ success: true, username: user.username });
  } catch (err) {
    logger.error({ err }, "Login failed");
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/refresh", (req, res) => {
  const token = req.cookies?.forge_token;
  if (!token) return res.status(401).json({ error: "No token" });

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const newToken = signToken(payload.userId, payload.username);
    setTokenCookie(res, newToken);
    res.json({ success: true });
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
});

router.post("/logout", (req, res) => {
  res.clearCookie("forge_token", { httpOnly: true, sameSite: "strict" });
  res.json({ success: true });
});

export function requireAuth(req, res, next) {
  const token = req.cookies?.forge_token || req.headers.authorization?.split(" ")[1];
  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

export default router;
