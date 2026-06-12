import API from "./api.js";
import { els, updateAuthUI, showToast } from "./ui.js";

export let currentUser = null;
let pendingAuthAction = "login";

export async function checkAuth() {
  try {
    const res = await fetch("/api/auth/refresh", {
      method: "POST",
      credentials: "same-origin",
    });
    if (res.ok) {
      currentUser = "user";
      updateAuthUI();
    }
  } catch { }
}

export function initAuth() {
  checkAuth();

  els.btnOpenLogin?.addEventListener("click", () => {
    pendingAuthAction = "login";
    els.authModalTitle.textContent = "Sign In";
    els.btnSubmitAuth.textContent = "Sign In";
    els.authError.hidden = true;
    els.authModal.hidden = false;
    els.authUsername.focus();
  });

  els.btnOpenRegister?.addEventListener("click", () => {
    pendingAuthAction = "register";
    els.authModalTitle.textContent = "Create Account";
    els.btnSubmitAuth.textContent = "Sign Up";
    els.authError.hidden = true;
    els.authModal.hidden = false;
    els.authUsername.focus();
  });

  els.btnCloseAuthModal?.addEventListener("click", () => { els.authModal.hidden = true; });
  els.btnSubmitAuth?.addEventListener("click", handleAuthSubmit);

  els.btnLogout?.addEventListener("click", handleLogout);

  els.authPassword?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleAuthSubmit();
  });
}

async function handleAuthSubmit() {
  const username = els.authUsername.value.trim();
  const password = els.authPassword.value.trim();
  if (!username || !password) return;

  const originalHtml = els.btnSubmitAuth.innerHTML;
  els.btnSubmitAuth.innerHTML = "Processing...";
  els.btnSubmitAuth.disabled = true;
  els.authError.hidden = true;

  try {
    const data = await API.auth(pendingAuthAction, username, password);
    currentUser = data.username;
    updateAuthUI();
    els.authModal.hidden = true;
    showToast(`Signed in as ${data.username}`, "success");
  } catch (err) {
    els.authError.textContent = err.message;
    els.authError.hidden = false;
  } finally {
    els.btnSubmitAuth.innerHTML = originalHtml;
    els.btnSubmitAuth.disabled = false;
  }
}

async function handleLogout() {
  await API.logout();
  currentUser = null;
  updateAuthUI();
  showToast("Signed out", "info");
}
