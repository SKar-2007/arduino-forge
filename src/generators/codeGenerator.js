/**
 * Arduino Forge — AI Generator
 *
 * Calls the Gemini API with the built prompt and parses
 * the structured response into clean sections.
 *
 * Supports: Gemini (default), extensible to others.
 */

import { config } from "../../config/default.js";
import { SYSTEM_PROMPT, buildUserPrompt } from "../core/promptBuilder.js";

const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${config.gemini.model}:generateContent`;

/**
 * Main generation function.
 *
 * @param {object} parsed - output from parseUserRequest()
 * @returns {object} { summary, libraries, wiring, code, notes, raw }
 */
export async function generateArduinoCode(parsed) {
    if (!config.gemini.apiKey) {
        throw new Error("GEMINI_API_KEY not set in environment.");
    }

    const userPrompt = buildUserPrompt(parsed);

    const body = {
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{
            role: "user",
            parts: [{ text: userPrompt }],
        }],
        generationConfig: {
            temperature: 0.2,   // Low temp = consistent, accurate code
            maxOutputTokens: 8192,  // Full programs can be long
            topP: 0.95,
            topK: 40,
        },
        safetySettings: [
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
        ],
    };

    const res = await fetch(`${API_URL}?key=${encodeURIComponent(config.gemini.apiKey)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Gemini API error (${res.status}): ${err.slice(0, 500)}`);
    }

    const data = await res.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawText) {
        const reason = data?.candidates?.[0]?.finishReason ?? "unknown";
        throw new Error(`Gemini returned no content. Finish reason: ${reason}`);
    }

    return parseGeneratorResponse(rawText);
}

// ── Response parser ────────────────────────────────────────────

/**
 * Parses the structured AI response into clean sections.
 * Robust against minor formatting variations.
 */
function parseGeneratorResponse(raw) {
    const sections = {
        summary: extractSection(raw, "SUMMARY"),
        libraries: parseLibraries(extractSection(raw, "LIBRARIES")),
        wiring: extractCodeBlock(raw, "WIRING"),
        code: extractCodeBlock(raw, "CODE"),
        notes: extractSection(raw, "NOTES"),
        raw,
    };

    // Fallback: if code block extraction failed, try to find any ```cpp block
    if (!sections.code) {
        const fallback = raw.match(/```cpp([\s\S]*?)```/);
        sections.code = fallback ? fallback[1].trim() : raw;
    }

    return sections;
}

/**
 * Extracts a plain-text section between a label and the next label.
 */
function extractSection(text, label) {
    const regex = new RegExp(
        `${label}:\\s*([\\s\\S]*?)(?=\\n(?:SUMMARY|LIBRARIES|WIRING|CODE|NOTES):|$)`,
        "i"
    );
    const match = text.match(regex);
    if (!match) return "";

    // Remove any code blocks from plain text sections
    return match[1]
        .replace(/```[\s\S]*?```/g, "")
        .trim();
}

/**
 * Extracts the code block following a section label.
 * Handles both labeled (WIRING: ``` ... ```) and inline formats.
 */
function extractCodeBlock(text, label) {
    // Match label followed by optional whitespace then a code block
    const regex = new RegExp(
        `${label}:[\\s\\S]*?` +
        "```(?:cpp|c|arduino|text|)?" +
        "([\\s\\S]*?)" +
        "```",
        "i"
    );
    const match = text.match(regex);
    return match ? match[1].trim() : "";
}

/**
 * Parses the LIBRARIES section into a clean array.
 */
function parseLibraries(raw) {
    if (!raw) return [];
    return raw
        .split(/[,\n]/)
        .map(l => l.replace(/^[-*•]\s*/, "").trim())
        .filter(l => l.length > 0 && !l.toLowerCase().includes("none"));
}
