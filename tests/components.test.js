import { describe, it } from "node:test";
import assert from "node:assert";
import { COMPONENTS, getByCategory, getRequiredLibraries, getAllComponentIds } from "../src/core/components.js";

describe("Components", () => {
  it("has microcontrollers", () => {
    const mcus = getByCategory("microcontroller");
    assert.ok(mcus.length >= 4);
  });

  it("has sensors", () => {
    const sensors = getByCategory("sensor");
    assert.ok(sensors.length >= 5);
  });

  it("returns required libraries", () => {
    const libs = getRequiredLibraries(["dht11", "oled-128x64"]);
    assert.ok(libs.length >= 2);
  });

  it("all components have name", () => {
    for (const [id, comp] of Object.entries(COMPONENTS)) {
      assert.ok(comp.name, `Component ${id} missing name`);
      assert.ok(comp.category, `Component ${id} missing category`);
    }
  });

  it("getAllComponentIds returns all keys", () => {
    const ids = getAllComponentIds();
    assert.strictEqual(ids.length, Object.keys(COMPONENTS).length);
  });

  it("new boards are registered", () => {
    assert.ok(COMPONENTS["arduino-mega"]);
    assert.ok(COMPONENTS["rp2040"]);
    assert.ok(COMPONENTS["arduino-due"]);
  });

  it("new components are registered", () => {
    assert.ok(COMPONENTS["neo-pixel"]);
    assert.ok(COMPONENTS["tft-ili9341"]);
    assert.ok(COMPONENTS["gps-neo6m"]);
    assert.ok(COMPONENTS["fingerprint-r307"]);
  });
});
