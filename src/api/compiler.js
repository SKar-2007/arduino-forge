import express from "express";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { existsSync } from "node:fs";
import { promises as fs } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { logger } from "../utils/logger.js";

const execAsync = promisify(exec);
const router = express.Router();

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI_PATH = join(__dirname, "../../bin/arduino-cli");

const BOARD_MAP = {
  "arduino-uno": "arduino:avr:uno",
  "arduino-nano": "arduino:avr:nano",
  "arduino-mega": "arduino:avr:mega",
  "esp32": "esp32:esp32:esp32",
  "esp8266": "esp8266:esp8266:generic",
  "rp2040": "rp2040:rp2040:rpipico",
};

router.post("/", async (req, res) => {
  if (!existsSync(CLI_PATH)) {
    return res.status(503).json({
      error: "Compiler unavailable",
      message: "arduino-cli is not installed on this server. Download it to ./bin/arduino-cli and restart.",
    });
  }

  const { code, board } = req.body;
  if (!code) return res.status(400).json({ error: "Code is required" });

  if (typeof code !== "string" || code.length > 100_000) {
    return res.status(400).json({ error: "Code must be a string under 100KB" });
  }

  const fqbn = BOARD_MAP[board] || BOARD_MAP["arduino-uno"];
  const isEsp = fqbn.startsWith("esp");

  const tmpId = Date.now() + "_" + Math.floor(Math.random() * 100000);
  const tmpDir = join(__dirname, `../../temp/build_${tmpId}`);
  const sketchPath = join(tmpDir, `build_${tmpId}.ino`);
  const buildDir = join(tmpDir, "build");

  try {
    await fs.mkdir(buildDir, { recursive: true });
    await fs.writeFile(sketchPath, code);

    const cmd = `"${CLI_PATH}" compile --fqbn ${fqbn} --output-dir "${buildDir}" "${tmpDir}"`;

    try {
      await execAsync(cmd, { timeout: 30000 });
    } catch (execErr) {
      logger.error({ err: execErr.stderr || execErr.stdout }, "Compile failed");
      throw new Error("Compilation failed: " + (execErr.stderr || execErr.message).slice(0, 500));
    }

    const ext = isEsp ? ".bin" : ".hex";
    const binFileName = `build_${tmpId}.ino${ext}`;
    const binFilePath = join(buildDir, binFileName);

    const binBuffer = await fs.readFile(binFilePath);

    res.set("Content-Type", "application/octet-stream");
    res.set("Content-Disposition", `attachment; filename="firmware_${board || "uno"}${ext}"`);
    res.set("Content-Length", binBuffer.length);
    res.send(binBuffer);
  } catch (err) {
    logger.error({ err }, "Compiler error");
    res.status(500).json({ error: err.message || "Compiler error" });
  } finally {
    fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
});

export default router;
