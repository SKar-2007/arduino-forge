import express from "express";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { promises as fs } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const execAsync = promisify(exec);
const router = express.Router();

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI_PATH = join(__dirname, "../../bin/arduino-cli");

// Map our frontend board IDs to arduino-cli FQBNs
const BOARD_MAP = {
    "arduino-uno": "arduino:avr:uno",
    "arduino-nano": "arduino:avr:nano",
    "esp32": "esp32:esp32:esp32",
    "esp8266": "esp8266:esp8266:generic"
};

/**
 * POST /api/compile
 * Body: { code, board }
 */
router.post("/", async (req, res) => {
    const { code, board } = req.body;
    if (!code) return res.status(400).json({ error: "Code is required" });

    // Default to Uno if not provided or recognized
    const fqbn = BOARD_MAP[board] || BOARD_MAP["arduino-uno"];
    const isEsp = fqbn.startsWith("esp");

    // Create highly unique temp dir
    const tmpId = Date.now() + "_" + Math.floor(Math.random() * 100000);
    const tmpDir = join(__dirname, `../../temp/build_${tmpId}`);
    const sketchPath = join(tmpDir, `build_${tmpId}.ino`);
    const buildDir = join(tmpDir, "build");

    try {
        await fs.mkdir(buildDir, { recursive: true });
        await fs.writeFile(sketchPath, code);

        // Run arduino-cli compile
        // Note: This assumes cores are already installed on the host.
        const cmd = `"${CLI_PATH}" compile --fqbn ${fqbn} --output-dir "${buildDir}" "${tmpDir}"`;

        try {
            await execAsync(cmd, { timeout: 30000 }); // 30s timeout
        } catch (execErr) {
            console.error("[compiler] Compile failed:", execErr.stderr || execErr.stdout);
            throw new Error("Compilation failed: " + (execErr.stderr || execErr.message).slice(0, 500));
        }

        // Find the generated binary
        // AVR outputs .hex, ESP outputs .bin
        const ext = isEsp ? ".bin" : ".hex";
        const binFileName = `build_${tmpId}.ino${ext}`;
        const binFilePath = join(buildDir, binFileName);

        const binBuffer = await fs.readFile(binFilePath);

        // Send the binary
        res.set("Content-Type", "application/octet-stream");
        res.set("Content-Disposition", `attachment; filename="firmware_${board || "uno"}${ext}"`);
        res.set("Content-Length", binBuffer.length);
        res.send(binBuffer);

    } catch (err) {
        console.error("[compiler] Error processing request:", err);
        res.status(500).json({ error: err.message || "Compiler error" });
    } finally {
        // Cleanup temp directory silently
        fs.rm(tmpDir, { recursive: true, force: true }).catch(() => { });
    }
});

export default router;
