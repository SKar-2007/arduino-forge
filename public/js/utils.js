export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function debounce(fn, ms = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

export async function copyToClipboard(text, btn) {
  try {
    await navigator.clipboard.writeText(text);
    const original = btn.textContent;
    btn.textContent = "Copied!";
    setTimeout(() => { btn.textContent = original; }, 2000);
  } catch { }
}

export function friendlyError(err) {
  const msg = err.message || "";
  if (msg.includes("429") || msg.includes("Rate limit")) return "Rate limit reached. Try again in a moment.";
  if (msg.includes("503") || msg.includes("unavailable")) return "AI service is busy. Please retry in a few seconds.";
  if (msg.includes("400")) return "Invalid request — check your prompt and try again.";
  return "Something went wrong. Please try again.";
}

export function getCategoryIcon(category) {
  const icons = {
    microcontroller: "🧠",
    sensor: "📡",
    display: "🖥️",
    actuator: "⚙️",
    communication: "📶",
  };
  return icons[category] || "🔌";
}
