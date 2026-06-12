import { describe, it } from "node:test";
import assert from "node:assert";
import { buildUserPrompt, SYSTEM_PROMPT } from "../src/core/promptBuilder.js";

describe("promptBuilder", () => {
  it("SYSTEM_PROMPT is defined", () => {
    assert.ok(SYSTEM_PROMPT.length > 100);
  });

  it("builds a basic user prompt", () => {
    const prompt = buildUserPrompt({
      description: "Blink an LED",
      board: "arduino-uno",
      components: [],
      difficulty: "beginner",
      extras: [],
    });
    assert.ok(prompt.includes("Blink an LED"));
    assert.ok(prompt.includes("TARGET BOARD"));
    assert.ok(prompt.includes("CODE LEVEL"));
  });

  it("includes component specs when components provided", () => {
    const prompt = buildUserPrompt({
      description: "Read DHT22",
      board: "arduino-uno",
      components: ["dht22"],
      difficulty: "beginner",
      extras: [],
    });
    assert.ok(prompt.includes("COMPONENT SPECIFICATIONS"));
    assert.ok(prompt.includes("DHT22"));
  });

  it("includes extras when provided", () => {
    const prompt = buildUserPrompt({
      description: "Read sensor",
      board: "arduino-uno",
      components: [],
      difficulty: "beginner",
      extras: ["Add WiFi data upload"],
    });
    assert.ok(prompt.includes("ADDITIONAL REQUIREMENTS"));
  });
});
