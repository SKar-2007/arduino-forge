import API from "./api.js";
import { els, updateAuthUI, showToast } from "./ui.js";

export let currentUser = null;

export async function checkAuth() {
  try {
    const res = await fetch("/api/auth/refresh", {
      method: "POST",
      credentials: "same-origin",
    });
    if (res.ok) {
      currentUser = "user";
      window.currentUser = "user";
      updateAuthUI();
    }
  } catch { }
}

function switchAuthTab(tab) {
  document.querySelectorAll(".auth-tab").forEach(t =>
    t.classList.toggle("active", t.dataset.authTab === tab)
  );
  document.querySelectorAll(".auth-form").forEach(f =>
    f.classList.toggle("active", f.id === `auth-form-${tab}`)
  );
  els.authError.hidden = true;
  els.authRegHint.innerHTML = "";
}

function getActiveFields() {
  const isRegister = document.querySelector("#auth-form-register.active");
  if (isRegister) {
    return {
      isRegister: true,
      username: els.authRegUsername,
      email: els.authEmail,
      password: els.authRegPassword,
      confirm: els.authConfirm,
      submitBtn: els.btnSubmitReg,
    };
  }
  return {
    isRegister: false,
    username: els.authUsername,
    email: null,
    password: els.authPassword,
    confirm: null,
    submitBtn: els.btnSubmitAuth,
  };
}

function validatePassword(password) {
  const errors = [];
  if (password.length < 8) errors.push("at least 8 characters");
  if (!/[A-Z]/.test(password)) errors.push("one uppercase letter");
  if (!/[0-9]/.test(password)) errors.push("one number");
  return errors;
}

async function handleGoogleCredential(response) {
  try {
    const data = await API.auth("google", { credential: response.credential });
    currentUser = data.username;
    window.currentUser = data.username;
    updateAuthUI();
    els.authModal.hidden = true;
    showToast(`Signed in as ${data.username}`, "success");
  } catch (err) {
    showToast(err.message, "error");
  }
}

async function initGoogleButton() {
  try {
    const res = await fetch("/api/config");
    const cfg = await res.json();
    if (!cfg.googleClientId) {
      els.btnGoogleAuth.style.display = "none";
      return;
    }
    if (typeof google === "undefined" || !google.accounts) return;
    google.accounts.id.initialize({
      client_id: cfg.googleClientId,
      callback: handleGoogleCredential,
      cancel_on_tap_outside: false,
    });
    els.btnGoogleAuth.addEventListener("click", () => {
      google.accounts.id.prompt();
    });
  } catch {
    els.btnGoogleAuth.style.display = "none";
  }
}

export function initAuth() {
  checkAuth();
  initGoogleButton();

  els.btnOpenLogin?.addEventListener("click", () => {
    openModal("login");
  });

  els.btnOpenRegister?.addEventListener("click", () => {
    openModal("register");
  });

  els.btnCloseAuthModal?.addEventListener("click", () => { els.authModal.hidden = true; });

  els.btnSubmitAuth?.addEventListener("click", handleAuthSubmit);
  els.btnSubmitReg?.addEventListener("click", handleAuthSubmit);

  els.btnLogout?.addEventListener("click", handleLogout);

  document.querySelectorAll(".auth-tab").forEach(tab => {
    tab.addEventListener("click", () => switchAuthTab(tab.dataset.authTab));
  });

  els.authRegPassword?.addEventListener("input", () => {
    const errors = validatePassword(els.authRegPassword.value);
    if (els.authRegPassword.value.length === 0) {
      els.authRegHint.innerHTML = "";
    } else if (errors.length > 0) {
      els.authRegHint.innerHTML = "Need " + errors.join(", ");
    } else {
      els.authRegHint.innerHTML = "";
    }
  });

  els.authUsername?.addEventListener("keydown", e => {
    if (e.key === "Enter") els.authPassword.focus();
  });
  els.authPassword?.addEventListener("keydown", e => {
    if (e.key === "Enter") handleAuthSubmit();
  });
  els.authRegUsername?.addEventListener("keydown", e => {
    if (e.key === "Enter") els.authEmail.focus();
  });
  els.authEmail?.addEventListener("keydown", e => {
    if (e.key === "Enter") els.authRegPassword.focus();
  });
  els.authRegPassword?.addEventListener("keydown", e => {
    if (e.key === "Enter") els.authConfirm.focus();
  });
  els.authConfirm?.addEventListener("keydown", e => {
    if (e.key === "Enter") handleAuthSubmit();
  });
}

function openModal(tab) {
  els.authModal.hidden = false;
  switchAuthTab(tab);
  els.authUsername.value = "";
  els.authPassword.value = "";
  els.authRegUsername.value = "";
  els.authRegPassword.value = "";
  els.authConfirm.value = "";
  els.authEmail.value = "";
  els.authRegHint.innerHTML = "";
  els.authError.hidden = true;
  const field = tab === "login" ? els.authUsername : els.authRegUsername;
  setTimeout(() => field.focus(), 100);
}

async function handleAuthSubmit(e) {
  const btn = e?.currentTarget;
  const f = getActiveFields();
  if ((btn && btn !== f.submitBtn) || !f.username) return;

  const username = f.username.value.trim();
  const password = f.password.value;
  if (!username || !password) return;

  if (f.isRegister) {
    const pwErrors = validatePassword(password);
    if (pwErrors.length > 0) {
      els.authError.textContent = "Password needs " + pwErrors.join(", ");
      els.authError.hidden = false;
      return;
    }
    if (password !== f.confirm.value) {
      els.authError.textContent = "Passwords do not match";
      els.authError.hidden = false;
      return;
    }
  }

  f.submitBtn.disabled = true;
  f.submitBtn.textContent = "Please wait\u2026";
  els.authError.hidden = true;

  try {
    const endpoint = f.isRegister ? "register" : "login";
    const body = { username, password };
    if (f.isRegister && f.email.value.trim()) body.email = f.email.value.trim();

    const data = await API.auth(endpoint, body);
    currentUser = data.username;
    window.currentUser = data.username;
    updateAuthUI();
    els.authModal.hidden = true;
    showToast(`Signed in as ${data.username}`, "success");
  } catch (err) {
    els.authError.textContent = err.message;
    els.authError.hidden = false;
  } finally {
    f.submitBtn.disabled = false;
    f.submitBtn.textContent = f.isRegister ? "Create account" : "Sign in";
  }
}

async function handleLogout() {
  await API.logout();
  currentUser = null;
  window.currentUser = null;
  updateAuthUI();
  showToast("Signed out", "info");
}
