import "./state.js";
import API from "./api.js";
import { els, setStateUI, stopLoadingCycle, switchTab, showToast, renderComponentCard, initThemeToggle, updateCharCount, updateAuthUI } from "./ui.js";
import { STATES, getLastResult, setLastResult, setLastPrompt } from "./state.js";
import { initAuth } from "./auth.js";
import { initEditor } from "./editor.js";
import { openProjectsModal, handleSaveProject, refreshProjectsCount } from "./projects.js";
import { escapeHtml, copyToClipboard } from "./utils.js";

async function handleGenerate() {
  const prompt = els.prompt.value.trim();
  if (!prompt) {
    els.prompt.focus();
    return;
  }

  stopLoadingCycle();
  setStateUI(STATES.LOADING);
  els.warningsBox.hidden = true;

  try {
    const payload = {
      prompt,
      board: els.boardSelect.value || undefined,
      difficulty: els.diffSelect.value,
    };

    const result = await API.generate(payload);
    stopLoadingCycle();
    setLastResult(result);
    setLastPrompt(prompt);
    setStateUI(STATES.RESULT, result);

    if (window.innerWidth <= 900) {
      els.resultMeta.scrollIntoView({ behavior: "smooth" });
    }
  } catch (err) {
    stopLoadingCycle();
    setStateUI(STATES.ERROR, { message: err.message });
  }
}

async function handleDownloadZip() {
  const lastResult = getLastResult();
  if (!lastResult || !lastResult.data.code) return;

  const originalHtml = els.downloadZipBtn.innerHTML;
  els.downloadZipBtn.innerHTML = "Zipping...";
  els.downloadZipBtn.disabled = true;

  try {
    const payload = {
      prompt: els.prompt.value.trim(),
      code: lastResult.data.code,
      wiring: lastResult.data.wiring,
      libraries: lastResult.data.libraries,
      notes: lastResult.data.notes,
    };

    const res = await API.exportZip(payload);
    let filename = "ArduinoForge_Project.zip";
    const disposition = res.headers.get("Content-Disposition");
    if (disposition?.includes("filename=")) {
      filename = disposition.split("filename=")[1].replace(/"/g, "");
    }

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.style.display = "none";
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  } catch (err) {
    showToast("Download failed: " + err.message, "error");
  } finally {
    els.downloadZipBtn.innerHTML = "Downloaded!";
    setTimeout(() => {
      els.downloadZipBtn.innerHTML = originalHtml;
      els.downloadZipBtn.disabled = false;
    }, 2000);
  }
}

async function handleCompile() {
  const lastResult = getLastResult();
  if (!lastResult || !lastResult.data.code) return;

  const originalHtml = els.compileActionBtn.innerHTML;
  els.compileActionBtn.innerHTML = "Compiling...";
  els.compileActionBtn.disabled = true;

  try {
    const code = window.monacoEditor?.getValue() || lastResult.data.code;

    const res = await API.compile({
      code,
      board: lastResult.meta?.board || "arduino-uno",
    });

    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || "Compilation failed");
    }

    let filename = "firmware.hex";
    const disposition = res.headers.get("Content-Disposition");
    if (disposition?.includes("filename=")) {
      filename = disposition.split("filename=")[1].replace(/"/g, "");
    }

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.style.display = "none";
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

    showToast("Compilation succeeded! Firmware downloaded.", "success");
  } catch (err) {
    showToast("Compilation failed: " + err.message, "error");
  } finally {
    els.compileActionBtn.innerHTML = "Compiled!";
    setTimeout(() => {
      els.compileActionBtn.innerHTML = originalHtml;
      els.compileActionBtn.disabled = false;
    }, 2000);
  }
}

async function handleRefine() {
  const instruction = els.refineInput.value.trim();
  const lastResult = getLastResult();
  if (!instruction || !lastResult?.data?.code) return;

  els.refineBtn.disabled = true;
  els.refineBtn.textContent = "Refining...";

  try {
    const result = await API.refine({
      originalCode: lastResult.data.code,
      instruction,
    });

    if (result.success && result.data?.code) {
      lastResult.data.code = result.data.code;
      if (window.monacoEditor) {
        window.monacoEditor.setValue(result.data.code);
      } else {
        els.codeOutput.textContent = result.data.code;
      }
      showToast("Code refined!", "success");
      els.refineInput.value = "";
    }
  } catch (err) {
    showToast("Refinement failed: " + err.message, "error");
  } finally {
    els.refineBtn.disabled = false;
    els.refineBtn.textContent = "Refine";
  }
}

async function loadComponents() {
  try {
    const res = await API.components();
    if (!res.success) return;

    const all = [
      ...(res.data.microcontrollers || []),
      ...(res.data.sensors || []),
      ...(res.data.displays || []),
      ...(res.data.actuators || []),
      ...(res.data.communication || []),
    ];

    if (els.componentList) {
      els.componentList.innerHTML = all
        .map(c => renderComponentCard(c.id, c))
        .join("");

      els.componentList.querySelectorAll(".comp-card").forEach(card => {
        card.addEventListener("click", () => {
          const name = card.querySelector(".comp-name")?.textContent || "";
          els.prompt.value += (els.prompt.value ? " " : "") + name;
          updateCharCount();
          els.prompt.focus();
        });
      });
    }
  } catch { }
}

function openWokwiLink() {
  const lastResult = getLastResult();
  if (!lastResult?.data?.code) return;
  const encoded = encodeURIComponent(lastResult.data.code);
  window.open(`https://wokwi.com/projects/new?template=${encoded}`, "_blank");
}

async function openAdminModal() {
  els.adminModal.hidden = false;
  try {
    const res = await fetch("/api/metrics", { credentials: "same-origin" });
    const data = await res.json();
    if (data.success) {
      els.statUsers.textContent = data.stats.totalUsers;
      els.statProjects.textContent = data.stats.totalProjectsSaved;
      els.statGenerations.textContent = data.stats.totalCodeGenerations;

      els.adminActivityList.innerHTML = (data.recentActivity || []).map(a => `
        <tr>
          <td style="padding:8px; border-bottom:1px solid var(--border-default);">${escapeHtml(a.endpoint)}</td>
          <td style="padding:8px; border-bottom:1px solid var(--border-default);"><span class="${a.status_code >= 400 ? "text-red" : ""}">${a.status_code}</span></td>
          <td style="padding:8px; border-bottom:1px solid var(--border-default);">${a.duration_ms}ms</td>
        </tr>
      `).join("");
    }
  } catch {
    els.adminActivityList.innerHTML = `<tr><td colspan="3" class="text-red">Failed to load metrics.</td></tr>`;
  }
}

function init() {
  initThemeToggle();
  initAuth();

  els.generateBtn.addEventListener("click", handleGenerate);

  els.prompt.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") handleGenerate();
  });

  els.prompt.addEventListener("input", updateCharCount);

  document.querySelectorAll(".tab").forEach(tab => {
    tab.addEventListener("click", () => switchTab(tab.dataset.tab));
  });

  els.copyCodeBtn?.addEventListener("click", () => {
    const text = window.monacoEditor?.getValue() || els.codeOutput.textContent;
    copyToClipboard(text, els.copyCodeBtn);
  });
  els.copyWiringBtn?.addEventListener("click", () => copyToClipboard(els.wiringOutput.textContent, els.copyWiringBtn));
  els.downloadZipBtn?.addEventListener("click", handleDownloadZip);
  els.saveProjectBtn?.addEventListener("click", handleSaveProject);
  els.compileActionBtn?.addEventListener("click", handleCompile);

  els.retryBtn?.addEventListener("click", () => {
    setStateUI(STATES.IDLE);
    els.prompt.focus();
  });

  document.querySelectorAll(".chip").forEach(chip => {
    chip.addEventListener("click", () => {
      els.prompt.value = chip.dataset.prompt;
      updateCharCount();
      els.prompt.focus();
    });
  });

  els.btnMyProjects?.addEventListener("click", openProjectsModal);
  els.btnCloseProjectsModal?.addEventListener("click", () => { els.projectsModal.hidden = true; });

  els.btnAdminStats?.addEventListener("click", openAdminModal);
  els.btnCloseAdminModal?.addEventListener("click", () => { els.adminModal.hidden = true; });

  els.refineBtn?.addEventListener("click", handleRefine);
  els.refineInput?.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") handleRefine();
  });

  if (els.wokwiBtn) {
    els.wokwiBtn.addEventListener("click", openWokwiLink);
  }

  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "k") {
      e.preventDefault();
      els.prompt.focus();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === "s" && getLastResult()) {
      e.preventDefault();
      handleSaveProject();
    }
    if (e.key === "Escape") {
      els.authModal.hidden = true;
      els.projectsModal.hidden = true;
      els.adminModal.hidden = true;
    }
  });

  window.addEventListener("offline", () => showToast("No internet connection — saves and generation will fail.", "warning"));
  window.addEventListener("online", () => showToast("Connection restored.", "success"));

  if (els.componentBrowser && els.componentList) {
    loadComponents();
  }

  initEditor("codeEditorContainer").catch(() => {});

  setStateUI(STATES.IDLE);
  updateAuthUI();
  refreshProjectsCount();
}

document.addEventListener("DOMContentLoaded", init);
