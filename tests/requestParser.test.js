import { describe, it } from "node:test";
import assert from "node:assert";
import { parseUserRequest } from "../src/parsers/requestParser.js";

describe("parseUserRequest", () => {
  it("detects Arduino Uno as default", () => {
    const result = parseUserRequest("Blink an LED");
    assert.strictEqual(result.board, "arduino-uno");
  });

  it("detects ESP32", () => {
    const result = parseUserRequest("Read temperature on ESP32");
    assert.strictEqual(result.board, "esp32");
  });

  it("detects DHT22 component", () => {
    const result = parseUserRequest("Read temperature with DHT22 sensor");
    assert.ok(result.components.includes("dht22"));
  });

  it("detects difficulty level", () => {
    const result = parseUserRequest("Simple blink for beginners");
    assert.strictEqual(result.difficulty, "beginner");
  });

  it("detects advanced difficulty", () => {
    const result = parseUserRequest("Advanced interrupt-driven motor controller");
    assert.strictEqual(result.difficulty, "advanced");
  });

  it("detects multiple components", () => {
    const result = parseUserRequest("Read DHT22 on ESP32 and show on OLED display");
    assert.ok(result.components.includes("dht22"));
    assert.ok(result.components.includes("oled-128x64"));
  });

  it("detects extras like wifi", () => {
    const result = parseUserRequest("Upload sensor data to MQTT broker via WiFi");
    assert.ok(result.extras.length > 0);
  });
});
