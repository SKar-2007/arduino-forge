import { describe, it } from "node:test";
import assert from "node:assert";
import { validateGenerateRequest } from "../src/validators/requestValidator.js";

describe("validateGenerateRequest", () => {
  it("rejects missing prompt", () => {
    assert.strictEqual(validateGenerateRequest({}).valid, false);
  });

  it("rejects non-object body", () => {
    assert.strictEqual(validateGenerateRequest(null).valid, false);
  });

  it("rejects prompt too short", () => {
    assert.strictEqual(validateGenerateRequest({ prompt: "hi" }).valid, false);
  });

  it("rejects prompt too long", () => {
    const long = "x".repeat(2001);
    assert.strictEqual(validateGenerateRequest({ prompt: long }).valid, false);
  });

  it("accepts valid request", () => {
    const result = validateGenerateRequest({ prompt: "Blink an LED every second on Arduino Uno" });
    assert.strictEqual(result.valid, true);
  });

  it("rejects invalid board", () => {
    const result = validateGenerateRequest({ prompt: "Blink LED for 15 chars ok", board: "raspberry-pi" });
    assert.strictEqual(result.valid, false);
  });

  it("accepts valid board", () => {
    const result = validateGenerateRequest({ prompt: "Blink LED for 15 chars ok", board: "esp32" });
    assert.strictEqual(result.valid, true);
  });

  it("rejects invalid difficulty", () => {
    const result = validateGenerateRequest({ prompt: "Blink LED for 15 chars ok", difficulty: "expert" });
    assert.strictEqual(result.valid, false);
  });

  it("accepts valid difficulty", () => {
    const result = validateGenerateRequest({ prompt: "Blink LED for 15 chars ok", difficulty: "advanced" });
    assert.strictEqual(result.valid, true);
  });

  it("rejects invalid language", () => {
    const result = validateGenerateRequest({ prompt: "Blink LED for 15 chars ok", language: "rust" });
    assert.strictEqual(result.valid, false);
  });

  it("accepts valid language", () => {
    const result = validateGenerateRequest({ prompt: "Blink LED for 15 chars ok", language: "micropython" });
    assert.strictEqual(result.valid, true);
  });
});
