# ⚡ Arduino Forge

**AI-powered Arduino & ESP32 code generator.** Describe your project in plain English — get working C++ code with accurate wiring diagrams, library lists, and component pinouts. Free, always.

---

## What it does

- Generates complete, commented Arduino/ESP32 C++ from a natural language description
- Produces ASCII wiring diagrams with exact pin numbers
- Lists every required library with installation instructions
- Detects voltage mismatches and flags safety warnings before you fry your board
- Supports 20+ components out of the box (sensors, displays, actuators, comms)

## Quick start

```bash
# 1. Clone
git clone https://github.com/yourusername/arduino-forge
cd arduino-forge

# 2. Install dependencies
npm install

# 3. Set up environment
cp .env.example .env
# Edit .env and add your GEMINI_API_KEY

# 4. Run
npm start

# Open http://localhost:3000
```

## Supported boards

| Board | Voltage | WiFi | Notes |
|-------|---------|------|-------|
| Arduino Uno | 5V | ✗ | ATmega328P, 32KB flash |
| Arduino Nano | 5V | ✗ | Compact, same pins as Uno |
| ESP32 | 3.3V | ✓ | 240MHz, 520KB RAM, BT |
| ESP8266 | 3.3V | ✓ | Simple WiFi projects |

## Supported components

**Sensors:** DHT11, DHT22, HC-SR04 Ultrasonic, PIR Motion, LDR, MQ-2 Gas, Soil Moisture, BMP280, MPU-6050

**Displays:** OLED 128×64 (SSD1306), LCD 16×2

**Actuators:** Servo Motor, DC Motor + L298N, Relay Module

**Communication:** HC-05 Bluetooth, nRF24L01 Wireless

## API

```
POST /api/generate
Body: { "prompt": "string", "board"?: "arduino-uno|esp32|...", "difficulty"?: "beginner|intermediate|advanced" }

GET  /api/components   — list all supported components
GET  /api/health       — service status
```

Rate limit: 20 requests/hour per IP.

## Project structure

```
arduino-forge/
├── src/
│   ├── api/
│   │   └── server.js              Express server, routes, rate limiter
│   ├── core/
│   │   ├── components.js          Component database (pinouts, libraries, notes)
│   │   └── promptBuilder.js       Builds AI prompts from parsed requests
│   ├── generators/
│   │   └── codeGenerator.js       Calls Gemini API, parses response
│   ├── parsers/
│   │   └── requestParser.js       Detects board/components from natural language
│   └── validators/
│       └── requestValidator.js    Input validation
├── public/
│   ├── index.html                 Frontend SPA
│   ├── css/main.css               Styles (IBM Plex, industrial dark theme)
│   └── js/app.js                  Frontend JS (vanilla, no framework)
├── docs/                          Extended documentation
├── examples/                      Example prompts and outputs
├── tests/                         Unit tests
├── config/                        Config files
├── .env.example                   Environment variable template
└── package.json
```

## Adding new components

Open `src/core/components.js` and add an entry:

```js
"your-sensor": {
  name:        "Your Sensor Full Name",
  category:    "sensor",       // sensor | actuator | display | communication
  voltage:     "3.3V-5V",
  protocol:    "I2C",
  library:     "Sensor Library Name",
  libraryInstall: "Library Name in Arduino Library Manager",
  pins: {
    vcc:  "3.3V or 5V",
    gnd:  "GND",
    sda:  "I2C SDA pin",
    scl:  "I2C SCL pin",
  },
  i2cAddress: "0x42",
  notes:      "Any important caveats",
  codeHint:   "sensor.read();",
},
```

The AI generator automatically picks up the new component — no other changes needed.

## Philosophy

- **Free model:** 20 generations/hour per IP. No accounts. No paywalls. No tracking.
- **No hallucinations:** Component pinouts are database-driven, not AI-generated.
- **Education first:** Code is written for B.Tech/hobbyist level — verbose comments, clear structure.
- **Open source:** Fork it, extend it, deploy your own instance.

## Deploy (free options)

**Railway:**
```bash
railway login && railway deploy
```

**Render:**
Connect GitHub repo → set GEMINI_API_KEY env var → deploy.

**Self-hosted:**
```bash
PORT=3000 GEMINI_API_KEY=your_key node src/api/server.js
```

## License

MIT — use it, fork it, deploy it, teach with it.
