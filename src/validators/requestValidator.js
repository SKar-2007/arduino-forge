/**
 * Arduino Forge — Request Validator
 * Clean validation with helpful error messages.
 */

const MAX_PROMPT_LENGTH = 2000;
const MIN_PROMPT_LENGTH = 10;

const VALID_BOARDS = [
    "arduino-uno", "arduino-nano", "esp32", "esp8266",
];

const VALID_DIFFICULTIES = ["beginner", "intermediate", "advanced"];

export function validateGenerateRequest(body) {
    if (!body || typeof body !== "object") {
        return { valid: false, error: "Request body must be JSON." };
    }

    const { prompt, board, difficulty } = body;

    if (!prompt || typeof prompt !== "string") {
        return { valid: false, error: "Field 'prompt' is required and must be a string." };
    }

    if (prompt.trim().length < MIN_PROMPT_LENGTH) {
        return { valid: false, error: `Prompt too short — describe what you want to build (min ${MIN_PROMPT_LENGTH} characters).` };
    }

    if (prompt.length > MAX_PROMPT_LENGTH) {
        return { valid: false, error: `Prompt too long — max ${MAX_PROMPT_LENGTH} characters.` };
    }

    if (board && !VALID_BOARDS.includes(board)) {
        return { valid: false, error: `Invalid board '${board}'. Valid options: ${VALID_BOARDS.join(", ")}.` };
    }

    if (difficulty && !VALID_DIFFICULTIES.includes(difficulty)) {
        return { valid: false, error: `Invalid difficulty '${difficulty}'. Valid options: ${VALID_DIFFICULTIES.join(", ")}.` };
    }

    return { valid: true };
}
