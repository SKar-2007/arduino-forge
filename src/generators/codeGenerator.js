import { config } from "../../config/default.js";
import { SYSTEM_PROMPT, buildUserPrompt } from "../core/promptBuilder.js";
import { logger } from "../utils/logger.js";

const API_BASE = `https://generativelanguage.googleapis.com/v1beta/models/${config.gemini.model}`;
const API_URL = `${API_BASE}:generateContent`;
const STREAM_URL = `${API_BASE}:streamGenerateContent?alt=sse`;

const cache = new Map();
const MAX_CACHE = 100;

function cacheKey(parsed) {
  return `${parsed.board}::${parsed.difficulty}::${parsed.description.toLowerCase().trim()}`;
}

async function withRetry(fn, maxRetries = 3, delayMs = 1000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const isRetryable = err.message.includes("503") || err.message.includes("429") || err.message.includes("timeout") || err.message.includes("500");
      if (!isRetryable || attempt === maxRetries) throw err;
      logger.warn({ attempt, err: err.message }, "Gemini call failed, retrying...");
      await new Promise(r => setTimeout(r, delayMs * attempt));
    }
  }
}

function buildRequestBody(userPrompt) {
  return {
    system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [{
      role: "user",
      parts: [{ text: userPrompt }],
    }],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 8192,
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
}

async function _doGenerate(parsed) {
  if (!config.gemini.apiKey) {
    throw new Error("GEMINI_API_KEY not set in environment.");
  }

  const userPrompt = buildUserPrompt(parsed);
  const body = buildRequestBody(userPrompt);

  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": config.gemini.apiKey,
    },
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

export async function generateArduinoCode(parsed) {
  const key = cacheKey(parsed);
  if (cache.has(key)) return cache.get(key);

  const result = await withRetry(() => _doGenerate(parsed));

  if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value);
  cache.set(key, result);
  return result;
}

export async function streamGeminiResponse(userPrompt) {
  if (!config.gemini.apiKey) {
    throw new Error("GEMINI_API_KEY not set in environment.");
  }

  const body = buildRequestBody(userPrompt);

  const res = await fetch(STREAM_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": config.gemini.apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini stream error (${res.status}): ${err.slice(0, 500)}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  return {
    [Symbol.asyncIterator]() {
      return {
        async next() {
          while (true) {
            const { done, value } = await reader.read();
            if (done) return { done: true, value: null };

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              if (line.startsWith("data: ")) {
                const json = line.slice(6).trim();
                if (json === "[DONE]") return { done: true, value: null };
                try {
                  return { done: false, value: JSON.parse(json) };
                } catch { }
              }
            }
          }
        },
      };
    },
  };
}

function parseGeneratorResponse(raw) {
  const sections = {
    summary: extractSection(raw, "SUMMARY"),
    libraries: parseLibraries(extractSection(raw, "LIBRARIES")),
    wiring: extractCodeBlock(raw, "WIRING"),
    code: extractCodeBlock(raw, "CODE"),
    notes: extractSection(raw, "NOTES"),
    raw,
  };

  if (!sections.code) {
    const fallback = raw.match(/```cpp([\s\S]*?)```/);
    sections.code = fallback ? fallback[1].trim() : raw;
  }

  return sections;
}

function extractSection(text, label) {
  const regex = new RegExp(
    `${label}:\\s*([\\s\\S]*?)(?=\\n(?:SUMMARY|LIBRARIES|WIRING|CODE|NOTES):|$)`,
    "i"
  );
  const match = text.match(regex);
  if (!match) return "";

  return match[1]
    .replace(/```[\s\S]*?```/g, "")
    .trim();
}

function extractCodeBlock(text, label) {
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

function parseLibraries(raw) {
  if (!raw) return [];
  return raw
    .split(/[,\n]/)
    .map(l => l.replace(/^[-*•]\s*/, "").trim())
    .filter(l => l.length > 0 && !l.toLowerCase().includes("none"));
}
