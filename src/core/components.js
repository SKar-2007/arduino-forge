/**
 * Arduino Forge — Component Registry
 *
 * Single source of truth for all supported components.
 * Each entry includes: pins, libraries, voltage levels,
 * wiring notes, and code snippets for the generator.
 *
 * To add a new component: follow the schema below and
 * append to COMPONENTS. The AI generator reads this at
 * prompt-build time to give accurate pin/library info.
 */

export const COMPONENTS = {

    // ── Microcontrollers ───────────────────────────────────────────
    "arduino-uno": {
        name: "Arduino Uno (ATmega328P)",
        category: "microcontroller",
        voltage: 5,
        digitalPins: 14,
        analogPins: 6,
        pwmPins: [3, 5, 6, 9, 10, 11],
        i2cPins: { sda: "A4", scl: "A5" },
        spiPins: { mosi: 11, miso: 12, sck: 13, ss: 10 },
        uartPins: { tx: 1, rx: 0 },
        flashKB: 32,
        ramBytes: 2048,
        clockMHz: 16,
        notes: "5V logic — use voltage divider for 3.3V sensors",
    },

    "arduino-nano": {
        name: "Arduino Nano (ATmega328P)",
        category: "microcontroller",
        voltage: 5,
        digitalPins: 14,
        analogPins: 8,
        pwmPins: [3, 5, 6, 9, 10, 11],
        i2cPins: { sda: "A4", scl: "A5" },
        spiPins: { mosi: 11, miso: 12, sck: 13, ss: 10 },
        uartPins: { tx: 1, rx: 0 },
        flashKB: 32,
        ramBytes: 2048,
        clockMHz: 16,
        notes: "Compact form factor — same pinout as Uno for most purposes",
    },

    "esp32": {
        name: "ESP32 (Dual-core Xtensa LX6)",
        category: "microcontroller",
        voltage: 3.3,
        digitalPins: 34,
        analogPins: 18,
        pwmPins: "any digital pin (LEDC peripheral)",
        i2cPins: { sda: 21, scl: 22 },
        spiPins: { mosi: 23, miso: 19, sck: 18, ss: 5 },
        uartPins: { tx: 1, rx: 3 },
        wifi: true,
        bluetooth: true,
        flashMB: 4,
        ramKB: 520,
        clockMHz: 240,
        notes: "3.3V logic — DO NOT connect 5V directly to GPIO. Built-in WiFi/BT.",
    },

    "esp8266": {
        name: "ESP8266 (NodeMCU)",
        category: "microcontroller",
        voltage: 3.3,
        digitalPins: 11,
        analogPins: 1,
        i2cPins: { sda: "D2 (GPIO4)", scl: "D1 (GPIO5)" },
        wifi: true,
        flashMB: 4,
        ramKB: 80,
        clockMHz: 80,
        notes: "3.3V logic only. Great for simple WiFi projects. Only 1 analog pin.",
    },

    // ── Sensors ───────────────────────────────────────────────────
    "dht11": {
        name: "DHT11 Temperature & Humidity Sensor",
        category: "sensor",
        type: "environmental",
        voltage: "3.3V–5V",
        protocol: "single-wire",
        library: "DHT sensor library by Adafruit",
        libraryInstall: "DHT sensor library",
        pins: {
            vcc: "3.3V or 5V",
            gnd: "GND",
            data: "any digital pin (use 10kΩ pull-up resistor)",
        },
        range: { temp: "0–50°C ±2°C", humidity: "20–80% ±5%" },
        sampleRate: "1 reading per second",
        notes: "Always use a 10kΩ pull-up resistor on the data line. DHT22 is more accurate.",
        codeHint: "DHT dht(PIN, DHT11); dht.readTemperature(); dht.readHumidity();",
    },

    "dht22": {
        name: "DHT22 Temperature & Humidity Sensor",
        category: "sensor",
        type: "environmental",
        voltage: "3.3V–5V",
        protocol: "single-wire",
        library: "DHT sensor library by Adafruit",
        libraryInstall: "DHT sensor library",
        pins: {
            vcc: "3.3V or 5V",
            gnd: "GND",
            data: "any digital pin (use 10kΩ pull-up resistor)",
        },
        range: { temp: "-40–80°C ±0.5°C", humidity: "0–100% ±2–5%" },
        sampleRate: "1 reading per 2 seconds",
        notes: "More accurate than DHT11. Same wiring. Use DHT22 type in code.",
        codeHint: "DHT dht(PIN, DHT22); dht.readTemperature(); dht.readHumidity();",
    },

    "hc-sr04": {
        name: "HC-SR04 Ultrasonic Distance Sensor",
        category: "sensor",
        type: "distance",
        voltage: "5V",
        protocol: "trigger/echo pulse",
        library: "NewPing (optional) or pulseIn()",
        pins: {
            vcc: "5V",
            gnd: "GND",
            trigger: "any digital output pin",
            echo: "any digital input pin (use voltage divider for ESP32/3.3V boards)",
        },
        range: "2cm – 400cm ±3mm",
        notes: "Echo pin outputs 5V — use a voltage divider (1kΩ + 2kΩ) for ESP32.",
        codeHint: "digitalWrite(trigPin, HIGH); delayMicroseconds(10); duration = pulseIn(echoPin, HIGH); distance = duration * 0.034 / 2;",
    },

    "pir": {
        name: "HC-SR501 PIR Motion Sensor",
        category: "sensor",
        type: "motion",
        voltage: "5V–12V (outputs 3.3V or 5V signal)",
        protocol: "digital output",
        pins: {
            vcc: "5V",
            gnd: "GND",
            output: "any digital input pin",
        },
        adjustments: "two onboard potentiometers: sensitivity (distance) and delay time",
        notes: "Has 2-3 second warm-up time on power-on. Output HIGH when motion detected.",
        codeHint: "if (digitalRead(pirPin) == HIGH) { /* motion detected */ }",
    },

    "ldr": {
        name: "LDR (Light Dependent Resistor / Photoresistor)",
        category: "sensor",
        type: "light",
        voltage: "3.3V–5V",
        protocol: "analog",
        pins: {
            leg1: "VCC through 10kΩ resistor to analog pin",
            leg2: "GND",
        },
        notes: "Use as voltage divider with 10kΩ resistor. Higher value = darker. Lower = brighter.",
        codeHint: "int lightVal = analogRead(A0); // 0=dark, 1023=bright (Uno) or 4095 (ESP32)",
    },

    "mq2": {
        name: "MQ-2 Gas / Smoke Sensor",
        category: "sensor",
        type: "gas",
        voltage: "5V",
        protocol: "analog + digital",
        pins: {
            vcc: "5V",
            gnd: "GND",
            aout: "analog pin (continuous reading)",
            dout: "digital pin (threshold trigger)",
        },
        warmup: "20 seconds minimum, 24 hours for accurate calibration",
        notes: "Detects LPG, smoke, alcohol, propane, hydrogen. Needs 24h burn-in for accuracy.",
        codeHint: "int gasVal = analogRead(A0); if (gasVal > threshold) { /* alert */ }",
    },

    "soil-moisture": {
        name: "Soil Moisture Sensor (Capacitive or Resistive)",
        category: "sensor",
        type: "moisture",
        voltage: "3.3V–5V",
        protocol: "analog",
        pins: {
            vcc: "3.3V or 5V",
            gnd: "GND",
            aout: "analog pin",
        },
        notes: "Resistive type corrodes over time — prefer capacitive for longevity.",
        codeHint: "int moisture = analogRead(A0); int percent = map(moisture, 0, 1023, 100, 0);",
    },

    "bmp280": {
        name: "BMP280 Barometric Pressure & Temperature Sensor",
        category: "sensor",
        type: "environmental",
        voltage: "3.3V",
        protocol: "I2C or SPI",
        library: "Adafruit BMP280 Library",
        libraryInstall: "Adafruit BMP280",
        pins: {
            vcc: "3.3V",
            gnd: "GND",
            sda: "I2C SDA pin",
            scl: "I2C SCL pin",
        },
        i2cAddress: "0x76 (SDO to GND) or 0x77 (SDO to VCC)",
        notes: "3.3V only — do not connect to 5V directly.",
        codeHint: "bmp.readTemperature(); bmp.readPressure(); bmp.readAltitude(1013.25);",
    },

    "mpu6050": {
        name: "MPU-6050 Accelerometer + Gyroscope (6-DOF IMU)",
        category: "sensor",
        type: "motion/imu",
        voltage: "3.3V–5V (has onboard regulator)",
        protocol: "I2C",
        library: "MPU6050 by Electronic Cats or Adafruit MPU6050",
        libraryInstall: "Adafruit MPU6050",
        pins: {
            vcc: "3.3V or 5V",
            gnd: "GND",
            sda: "I2C SDA",
            scl: "I2C SCL",
            int: "optional interrupt pin",
        },
        i2cAddress: "0x68 (AD0 low) or 0x69 (AD0 high)",
        notes: "Provides raw accel (m/s²) and gyro (°/s) data. Needs calibration for accuracy.",
        codeHint: "mpu.getAccelerometerSensor()->getEvent(&a); mpu.getGyroSensor()->getEvent(&g);",
    },

    // ── Displays ──────────────────────────────────────────────────
    "oled-128x64": {
        name: "OLED Display 128×64 (SSD1306)",
        category: "display",
        voltage: "3.3V–5V",
        protocol: "I2C or SPI",
        library: "Adafruit SSD1306 + Adafruit GFX Library",
        libraryInstall: "Adafruit SSD1306",
        pins: {
            vcc: "3.3V or 5V",
            gnd: "GND",
            sda: "I2C SDA",
            scl: "I2C SCL",
        },
        i2cAddress: "0x3C (most common) or 0x3D",
        resolution: "128×64 pixels",
        notes: "Very power efficient. Great for small data displays. Use Adafruit GFX for drawing.",
        codeHint: "display.clearDisplay(); display.setTextSize(1); display.setCursor(0,0); display.println(\"Hello\"); display.display();",
    },

    "lcd-16x2": {
        name: "LCD 16×2 (HD44780) with I2C Backpack",
        category: "display",
        voltage: "5V",
        protocol: "I2C (with backpack) or parallel (4/8 bit)",
        library: "LiquidCrystal I2C",
        libraryInstall: "LiquidCrystal I2C",
        pins: {
            vcc: "5V",
            gnd: "GND",
            sda: "I2C SDA (with I2C backpack)",
            scl: "I2C SCL (with I2C backpack)",
        },
        i2cAddress: "0x27 (most common) or 0x3F",
        notes: "Always use I2C backpack — saves 6 pins. Adjust contrast with onboard potentiometer.",
        codeHint: "lcd.init(); lcd.backlight(); lcd.setCursor(0,0); lcd.print(\"Hello World\");",
    },

    // ── Actuators ─────────────────────────────────────────────────
    "servo": {
        name: "Servo Motor (SG90 / MG996R)",
        category: "actuator",
        type: "motor",
        voltage: "5V (power supply — not from Arduino 5V pin for multiple servos)",
        protocol: "PWM signal",
        library: "Servo (built-in Arduino library)",
        pins: {
            vcc: "5V (external supply for multiple servos)",
            gnd: "GND (shared with Arduino)",
            signal: "any PWM-capable digital pin",
        },
        range: "0–180 degrees",
        notes: "Never power multiple servos from Arduino 5V pin — use external 5V supply. Share GND.",
        codeHint: "myServo.attach(9); myServo.write(90); // move to 90 degrees",
    },

    "dc-motor": {
        name: "DC Motor with L298N Motor Driver",
        category: "actuator",
        type: "motor",
        voltage: "Motor: 5V–35V, Logic: 5V",
        protocol: "PWM + direction pins",
        library: "none (direct GPIO)",
        pins: {
            ena: "PWM pin (speed control motor A)",
            in1: "digital pin (direction)",
            in2: "digital pin (direction)",
            in3: "digital pin (direction motor B)",
            in4: "digital pin (direction motor B)",
            enb: "PWM pin (speed control motor B)",
            vcc: "5V (logic power)",
            gnd: "GND",
            vmot: "motor power supply (separate)",
        },
        notes: "L298N can drive 2 DC motors or 1 stepper. Keep motor power supply separate from logic.",
        codeHint: "digitalWrite(in1, HIGH); digitalWrite(in2, LOW); analogWrite(ena, 200);",
    },

    "relay": {
        name: "5V Relay Module",
        category: "actuator",
        type: "switch",
        voltage: "5V coil, switches up to 250VAC/30VDC",
        protocol: "digital",
        pins: {
            vcc: "5V",
            gnd: "GND",
            in: "digital pin (LOW = ON for most modules)",
        },
        notes: "Most relay modules are ACTIVE LOW — LOW signal turns relay ON. Add flyback diode protection.",
        codeHint: "digitalWrite(relayPin, LOW);  // turn ON (active low)\ndigitalWrite(relayPin, HIGH); // turn OFF",
    },

    // ── Communication ─────────────────────────────────────────────
    "hc-05": {
        name: "HC-05 Bluetooth Module",
        category: "communication",
        voltage: "3.3V–5V (onboard regulator), TX/RX: 3.3V",
        protocol: "UART",
        pins: {
            vcc: "5V",
            gnd: "GND",
            tx: "connect to Arduino RX (use voltage divider 1kΩ+2kΩ for 3.3V TX)",
            rx: "connect to Arduino TX",
        },
        defaultBaud: 9600,
        notes: "HC-05 TX is 3.3V — safe for Arduino. Arduino TX is 5V — use divider to HC-05 RX.",
        codeHint: "SoftwareSerial bt(10, 11); bt.begin(9600); bt.println(\"Hello\");",
    },

    "nrf24l01": {
        name: "nRF24L01+ 2.4GHz Wireless Transceiver",
        category: "communication",
        voltage: "3.3V only (damage occurs at 5V)",
        protocol: "SPI",
        library: "RF24 by TMRh20",
        libraryInstall: "RF24",
        pins: {
            vcc: "3.3V ONLY",
            gnd: "GND",
            ce: "any digital pin",
            csn: "any digital pin",
            sck: "SPI SCK",
            mosi: "SPI MOSI",
            miso: "SPI MISO",
        },
        notes: "3.3V STRICTLY — 5V will destroy the module. Add 10µF capacitor across VCC/GND for stability.",
        codeHint: "RF24 radio(7, 8); radio.begin(); radio.openWritingPipe(address); radio.write(&data, sizeof(data));",
    },
};

/**
 * Returns components filtered by category.
 * @param {string} category - "sensor" | "actuator" | "display" | "communication" | "microcontroller"
 */
export function getByCategory(category) {
    return Object.entries(COMPONENTS)
        .filter(([, v]) => v.category === category)
        .map(([id, v]) => ({ id, ...v }));
}

/**
 * Returns all library names needed for a given set of component IDs.
 */
export function getRequiredLibraries(componentIds) {
    return [...new Set(
        componentIds
            .map(id => COMPONENTS[id]?.library)
            .filter(Boolean)
    )];
}

/**
 * Returns all component IDs as a flat list (for prompt context).
 */
export function getAllComponentIds() {
    return Object.keys(COMPONENTS);
}
