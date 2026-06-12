import "dotenv/config";

function required(name) {
  throw new Error(`${name} env var is required`);
}

export const config = Object.freeze({
  port: parseInt(process.env.PORT, 10) || 3000,

  jwtSecret: process.env.JWT_SECRET || required("JWT_SECRET"),

  googleClientId: process.env.GOOGLE_CLIENT_ID || "",

  gemini: Object.freeze({
    apiKey: process.env.GEMINI_API_KEY || "",
    model: process.env.GEMINI_MODEL || "gemini-1.5-flash",
  }),

  rateLimit: Object.freeze({
    points: parseInt(process.env.RATE_LIMIT_POINTS, 10) || 20,
    duration: parseInt(process.env.RATE_LIMIT_DURATION, 10) || 3600,
  }),

  allowedOrigin: process.env.ALLOWED_ORIGIN || "*",

  nodeEnv: process.env.NODE_ENV || "development",
  isDev: (process.env.NODE_ENV || "development") === "development",

  logLevel: process.env.LOG_LEVEL || "info",
});
