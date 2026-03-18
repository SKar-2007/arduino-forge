/**
 * Arduino Forge — Prompt Builder
 *
 * Constructs the system + user prompt sent to the AI.
 * Injects relevant component specs, pin tables, and
 * library names so the AI never hallucinates pinouts.
 *
 * Separation of concerns: this module ONLY builds strings.
 * The API layer calls the AI. The generator parses output.
 */

import { COMPONENTS, getRequiredLibraries } from "./components.js";

// ── System prompt (constant across all requests) ───────────────
export const SYSTEM_PROMPT = `You are ArduinoForge — a precise, expert embedded systems engineer and educator.
You generate production-quality Arduino/ESP32 C++ code for students and hobbyists.

Your absolute rules:
1. NEVER hallucinate pin numbers — use only the pin data provided in the component specs below.
2. ALWAYS include every required #include and library name.
3. ALWAYS add a wiring diagram as an ASCII table in a code block labeled "WIRING".
4. ALWAYS add inline comments explaining EVERY non-obvious line of code.
5. Structure code with: includes → constants → globals → setup() → loop() → helper functions.
6. Flag safety warnings (voltage mismatches, current limits, heat, high voltage) prominently.
7. If the request is ambiguous, state your assumptions clearly before the code.
8. Never use delay() for timing-critical applications — prefer millis().
9. Always validate sensor readings (check for NaN, out-of-range values).
10. Write code a B.Tech CSE student can understand, modify, and extend.

Output format — respond with EXACTLY these sections in order:
SUMMARY: [2-3 sentence plain English description of what this code does]
LIBRARIES: [comma-separated list of Arduino library names to install via Library Manager]
WIRING:
\`\`\`
[ASCII wiring table: Component Pin | Wire Color | Board Pin | Notes]
\`\`\`
CODE:
\`\`\`cpp
[full, complete, commented Arduino/ESP32 code]
\`\`\`
NOTES: [important caveats, safety warnings, extension ideas — bullet points]`;


// ── User prompt builder ────────────────────────────────────────

/**
 * Builds the full user prompt from the parsed request.
 *
 * @param {object} parsed - output of parseUserRequest()
 * @param {string} parsed.description  - what the user wants to build
 * @param {string} parsed.board        - detected board (e.g. "arduino-uno")
 * @param {string[]} parsed.components - detected component IDs
 * @param {string} parsed.difficulty   - "beginner" | "intermediate" | "advanced"
 * @param {string[]} parsed.extras     - extra features requested
 * @returns {string} full prompt string
 */
export function buildUserPrompt(parsed) {
    const {
        description,
        board = "arduino-uno",
        components = [],
        difficulty = "beginner",
        extras = [],
    } = parsed;

    const boardSpec = COMPONENTS[board];
    const componentSpecs = components
        .filter(id => COMPONENTS[id])
        .map(id => formatComponentSpec(id, COMPONENTS[id]));

    const libraries = getRequiredLibraries(components);

    const sections = [];

    // ── Board context ──────────────────────────────────────────
    sections.push(`=== TARGET BOARD ===
Board: ${boardSpec?.name ?? board}
Voltage: ${boardSpec?.voltage ?? "5V"}V logic
Key pins — I2C: SDA=${boardSpec?.i2cPins?.sda ?? "A4"}, SCL=${boardSpec?.i2cPins?.scl ?? "A5"}
PWM pins: ${Array.isArray(boardSpec?.pwmPins) ? boardSpec.pwmPins.join(", ") : boardSpec?.pwmPins ?? "3,5,6,9,10,11"}
${boardSpec?.wifi ? "WiFi: YES (built-in)" : ""}
${boardSpec?.notes ? `Board note: ${boardSpec.notes}` : ""}`);

    // ── Component specs ────────────────────────────────────────
    if (componentSpecs.length > 0) {
        sections.push(`=== COMPONENT SPECIFICATIONS ===
Use ONLY the pin numbers and libraries listed below. Do not invent alternatives.

${componentSpecs.join("\n\n")}`);
    }

    // ── Known libraries ────────────────────────────────────────
    if (libraries.length > 0) {
        sections.push(`=== REQUIRED LIBRARIES (install via Arduino Library Manager) ===
${libraries.map(l => `- ${l}`).join("\n")}`);
    }

    // ── The actual request ────────────────────────────────────
    sections.push(`=== WHAT TO BUILD ===
${description}`);

    // ── Difficulty calibration ────────────────────────────────
    const difficultyMap = {
        beginner: "Code for a beginner — verbose comments, explain every concept, avoid advanced patterns.",
        intermediate: "Code for an intermediate student — clean comments, use standard patterns, brief explanations.",
        advanced: "Code for an advanced student — efficient, use interrupts/timers where appropriate, minimal obvious comments.",
    };
    sections.push(`=== CODE LEVEL ===
${difficultyMap[difficulty] ?? difficultyMap.beginner}`);

    // ── Extra features ────────────────────────────────────────
    if (extras.length > 0) {
        sections.push(`=== ADDITIONAL REQUIREMENTS ===
${extras.map(e => `- ${e}`).join("\n")}`);
    }

    return sections.join("\n\n");
}

// ── Helpers ────────────────────────────────────────────────────

function formatComponentSpec(id, spec) {
    const lines = [`[${id}] ${spec.name}`];
    lines.push(`  Voltage: ${spec.voltage}`);
    lines.push(`  Protocol: ${spec.protocol ?? "—"}`);

    if (spec.pins) {
        lines.push("  Pins:");
        Object.entries(spec.pins).forEach(([pin, desc]) => {
            lines.push(`    ${pin.toUpperCase()}: ${desc}`);
        });
    }

    if (spec.library) {
        lines.push(`  Library: "${spec.library}" (install as: "${spec.libraryInstall ?? spec.library}")`);
    }

    if (spec.i2cAddress) lines.push(`  I2C Address: ${spec.i2cAddress}`);
    if (spec.notes) lines.push(`  ⚠️  Note: ${spec.notes}`);
    if (spec.codeHint) lines.push(`  Code hint: ${spec.codeHint}`);

    return lines.join("\n");
}
