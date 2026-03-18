/**
 * Arduino Forge — Configuration
 *
 * Single source of truth for all environment-driven settings.
 * Import this module instead of reading process.env directly.
 *
 * Usage:
 *   import { config } from "../../config/default.js";
 *   console.log(config.port);
 */

import "dotenv/config";

export const config = Object.freeze({
  /** Server port */
  port: parseInt(process.env.PORT, 10) || 3000,

  /** Gemini AI */
  gemini: Object.freeze({
    apiKey: process.env.GEMINI_API_KEY || "",
    model: process.env.GEMINI_MODEL || "gemini-1.5-flash",
  }),

  /** Rate limiting */
  rateLimit: Object.freeze({
    points: parseInt(process.env.RATE_LIMIT_POINTS, 10) || 20,
    duration: parseInt(process.env.RATE_LIMIT_DURATION, 10) || 3600, // seconds
  }),

  /** CORS */
  allowedOrigin: process.env.ALLOWED_ORIGIN || "*",

  /** Environment */
  nodeEnv: process.env.NODE_ENV || "development",
  isDev: (process.env.NODE_ENV || "development") === "development",
});
