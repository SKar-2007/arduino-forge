<div align="center">
  <img src="public/favicon.ico" alt="Arduino Forge Logo" width="100"/>
  <h1>Arduino <strong>Forge</strong></h1>
  <p><strong>The Ultimate AI-Powered IDE & Circuit Generator for Makers</strong></p>
  
  [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
  [![Node.js](https://img.shields.io/badge/Node.js-18.x-green.svg)](https://nodejs.org)
  [![Express.js](https://img.shields.io/badge/Express.js-Backend-lightgrey.svg)](https://expressjs.com/)
  [![SQLite](https://img.shields.io/badge/Database-SQLite3-blue.svg)](https://sqlite.org/)
</div>

<br />

Arduino Forge is a next-generation, browser-based development environment that utilizes Large Language Models (LLMs) to automatically generate ready-to-flash C++ code, circuit wiring diagrams, and library dependencies based on natural language prompts.

> *“Blink an LED when the temperature exceeds 30°C”* -> Instant Code, Wiring, and Firmware.

---

## ✨ Features

- 🧠 **AI Code Generation**: Powered by the Gemini 2.0 Flash API to write accurate Arduino C++ code instantly.
- 🎨 **Premium Developer UI**: A beautiful, GitHub-inspired dark mode interface with glassmorphism interactions and syntax highlighting.
- ☁️ **Cloud Compilation**: Built-in headless `arduino-cli` compiler. Click a button to instantly download `.hex` and `.bin` binaries without opening the Arduino IDE.
- 📦 **Export as .ZIP**: Instantly bundles your generated `.ino` file and a formatted `README.md` with wiring instructions into a zipped sketch folder.
- 🔐 **User Accounts & Cloud Saves**: Built-in SQLite database with JWT authentication. Save your generated circuits and code to your account to load them anywhere.
- 📊 **Admin Metrics Board**: Track API usage, user growth, and generation activity natively via the admin dashboard.
- 🔌 **Vast Component Library**: Deep AI context for over 20+ sensors and actuators, including ESP32s, RTCs, MPU6050s, Steppers, and RFID Readers.

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v16+)
- An API Key from Google Gemini (`GEMINI_API_KEY`)
- *(Optional)* [arduino-cli](https://arduino.github.io/arduino-cli/) installed in `./bin` for the Cloud Compiler feature.

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/SKar-2007/arduino-forge.git
   cd arduino-forge
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment**
   Create a `.env` file in the root directory:
   ```env
   PORT=3000
   NODE_ENV=development
   GEMINI_API_KEY=your_google_gemini_api_key_here
   JWT_SECRET=super_secret_jwt_key_for_authentication
   ```

4. **Start the Development Server**
   ```bash
   npm run dev
   ```
   *The server will start at `http://localhost:3000` and the SQLite database (`forge.db`) will auto-initialize.*

---

## 🛠️ Technology Stack

- **Frontend:** Vanilla JavaScript (ES6+), semantic HTML5, custom CSS variables & Flexbox/Grid layouts.
- **Backend:** Node.js, Express.js (Modular ESM Routers).
- **Database:** `better-sqlite3` (Zero-config local database for Users and Projects).
- **Security:** `helmet`, `cors`, `bcrypt` for password hashing, `jsonwebtoken` for auth sessions, built-in memory rate limiters.
- **Tooling:** `jszip` for folder archiving, `arduino-cli` for host-side C++ compilation.

---

## 🗂️ Project Structure

```text
arduino-forge/
├── config/             # Database and environment configurations
├── public/             # Static Assets (HTML, CSS, Vanilla JS)
├── src/
│   ├── api/            # Express Routers (Auth, Compiler, Projects, Export, Metrics)
│   ├── core/           # Business Logic (Hardware constraints, AI prompts)
│   ├── generators/     # LLM integration (Gemini API calls)
│   ├── parsers/        # Markdown/JSON parsing logic from AI responses
│   └── validators/     # Backend request validation middlewares
├── bin/                # (Optional) arduino-cli installation for compilers
├── temp/               # Ephemeral storage for .hex firmware building
└── server.js           # Entry point
```

---

## 👨‍💻 Contributing

Contributions, issues, and feature requests are welcome!
Feel free to check out the [issues page](https://github.com/SKar-2007/arduino-forge/issues).

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

Distributed under the MIT License. See `LICENSE` for more information.
