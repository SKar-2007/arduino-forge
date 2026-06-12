import pino from "pino";
import { config } from "../../config/default.js";

export const logger = pino({
  level: config.logLevel,
  transport: config.isDev
    ? { target: "pino-pretty", options: { colorize: true } }
    : undefined,
});
