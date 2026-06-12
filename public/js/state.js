export const STATES = {
  IDLE: "idle",
  LOADING: "loading",
  RESULT: "result",
  ERROR: "error",
};

let currentState = STATES.IDLE;
let lastResult = null;
let lastPrompt = "";

export function getState() {
  return currentState;
}

export function setState(s) {
  currentState = s;
}

export function getLastResult() {
  return lastResult;
}

export function setLastResult(r) {
  lastResult = r;
}

export function getLastPrompt() {
  return lastPrompt;
}

export function setLastPrompt(p) {
  lastPrompt = p;
}

export const LOADING_MESSAGES = [
  "Analyzing architecture...",
  "Matching component specs...",
  "Building schematic...",
  "Synthesizing C++ code...",
  "Resolving dependencies...",
];
