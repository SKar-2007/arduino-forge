/**
 * Arduino Forge — Request Parser
 *
 * Detects board type, components, difficulty level, and
 * extra features from a natural language user description.
 *
 * This runs BEFORE the AI call so the prompt builder can
 * inject accurate component specs.
 */

import { COMPONENTS, getAllComponentIds } from "../core/components.js";

// ── Board detection keywords ───────────────────────────────────
const BOARD_KEYWORDS = {
    "esp32": ["esp32", "esp-32", "espressif"],
    "esp8266": ["esp8266", "esp-8266", "nodemcu", "d1 mini"],
    "arduino-nano": ["nano", "arduino nano"],
    "arduino-uno": ["uno", "arduino uno", "arduino"],  // fallback last
};

// ── Component detection keywords ─────────────────────────────
const COMPONENT_KEYWORDS = {
    "dht11": ["dht11", "dht 11", "temperature humidity", "temp humid"],
    "dht22": ["dht22", "dht 22", "am2302"],
    "hc-sr04": ["hc-sr04", "hcsr04", "ultrasonic", "distance sensor", "sonar"],
    "pir": ["pir", "motion sensor", "motion detect", "hc-sr501"],
    "ldr": ["ldr", "light sensor", "photoresistor", "light dependent"],
    "mq2": ["mq2", "mq-2", "gas sensor", "smoke sensor"],
    "soil-moisture": ["soil", "moisture sensor", "soil moisture", "plant water"],
    "bmp280": ["bmp280", "bmp 280", "pressure sensor", "barometric", "altitude"],
    "mpu6050": ["mpu6050", "mpu 6050", "accelerometer", "gyroscope", "imu", "tilt"],
    "oled-128x64": ["oled", "ssd1306", "oled display", "128x64"],
    "lcd-16x2": ["lcd", "16x2", "lcd display", "liquid crystal"],
    "servo": ["servo", "sg90", "mg996", "servo motor"],
    "dc-motor": ["dc motor", "l298n", "motor driver", "dc drive"],
    "relay": ["relay", "relay module", "switch load", "mains"],
    "hc-05": ["hc-05", "hc05", "bluetooth", "bt module"],
    "nrf24l01": ["nrf24", "nrf24l01", "wireless", "2.4ghz radio"],
};

// ── Difficulty detection ──────────────────────────────────────
const DIFFICULTY_KEYWORDS = {
    beginner: ["beginner", "simple", "basic", "easy", "first time", "new to", "learning"],
    intermediate: ["intermediate", "moderate", "some experience", "familiar"],
    advanced: ["advanced", "expert", "optimized", "efficient", "interrupt", "rtos", "professional"],
};

// ── Extra feature detection ───────────────────────────────────
const EXTRA_KEYWORDS = {
    "Add serial monitor debug output (Serial.println) for all key values": ["serial", "debug", "monitor", "print"],
    "Store readings to EEPROM for persistence across power cycles": ["eeprom", "save data", "persist", "store"],
    "Include deep sleep / low power mode": ["sleep", "low power", "battery", "power saving"],
    "Add WiFi data upload to a server or MQTT broker": ["wifi", "upload", "mqtt", "server", "iot", "cloud"],
    "Use interrupts instead of polling where possible": ["interrupt", "isr", "non-blocking"],
    "Include watchdog timer for reliability": ["watchdog", "wdt", "reliable", "reset"],
    "Use millis() for non-blocking timing (no delay())": ["non-blocking", "millis", "concurrent", "parallel"],
};

/**
 * Parses a natural language request into a structured object.
 *
 * @param {string} userText - raw user input
 * @returns {object} { description, board, components, difficulty, extras, warnings }
 */
export function parseUserRequest(userText) {
    const lower = userText.toLowerCase();

    // ── Detect board ────────────────────────────────────────────
    let board = "arduino-uno"; // default
    for (const [id, keywords] of Object.entries(BOARD_KEYWORDS)) {
        if (keywords.some(k => lower.includes(k))) {
            board = id;
            break;
        }
    }

    // ── Detect components ───────────────────────────────────────
    const components = [];
    for (const [id, keywords] of Object.entries(COMPONENT_KEYWORDS)) {
        if (keywords.some(k => lower.includes(k))) {
            components.push(id);
        }
    }

    // ── Detect difficulty ───────────────────────────────────────
    let difficulty = "beginner"; // default
    for (const [level, keywords] of Object.entries(DIFFICULTY_KEYWORDS)) {
        if (keywords.some(k => lower.includes(k))) {
            difficulty = level;
            break;
        }
    }

    // ── Detect extras ───────────────────────────────────────────
    const extras = [];
    for (const [feature, keywords] of Object.entries(EXTRA_KEYWORDS)) {
        if (keywords.some(k => lower.includes(k))) {
            extras.push(feature);
        }
    }

    // ── Generate warnings ───────────────────────────────────────
    const warnings = generateWarnings(board, components);

    return {
        description: userText.trim(),
        board,
        components,
        difficulty,
        extras,
        warnings,
        // metadata for UI display
        detectedBoard: COMPONENTS[board]?.name ?? board,
        detectedComponents: components.map(id => COMPONENTS[id]?.name ?? id),
    };
}

/**
 * Generates safety/compatibility warnings before code generation.
 */
function generateWarnings(board, components) {
    const warnings = [];
    const boardSpec = COMPONENTS[board];
    if (!boardSpec) return warnings;

    const boardVoltage = boardSpec.voltage;

    for (const compId of components) {
        const comp = COMPONENTS[compId];
        if (!comp) continue;

        // 5V component on 3.3V board
        if (boardVoltage === 3.3) {
            if (compId === "hc-sr04") {
                warnings.push("HC-SR04 ECHO pin outputs 5V — add a voltage divider (1kΩ + 2kΩ) before connecting to ESP32.");
            }
            if (compId === "lcd-16x2") {
                warnings.push("LCD 16×2 runs on 5V — use a level shifter or I2C backpack with voltage translation.");
            }
            if (compId === "hc-05") {
                warnings.push("HC-05 RX pin is 3.3V max — use a voltage divider on the TX line from ESP32.");
            }
        }

        // nRF24 voltage check
        if (compId === "nrf24l01") {
            warnings.push("nRF24L01+ MUST be powered at 3.3V. Connecting to 5V WILL destroy the module.");
        }

        // Relay and mains voltage
        if (compId === "relay") {
            warnings.push("⚡ SAFETY: Relay can switch MAINS voltage (230V AC). Never touch live connections. Use insulated enclosure.");
        }

        // Multiple servos
        if (compId === "servo" && board === "arduino-uno") {
            warnings.push("Powering multiple servos from Arduino 5V pin can reset the board. Use an external 5V supply.");
        }
    }

    return warnings;
}
