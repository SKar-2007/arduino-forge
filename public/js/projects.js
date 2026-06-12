import API from "./api.js";
import { els, showToast, setStateUI } from "./ui.js";
import { STATES, getLastResult, setLastResult } from "./state.js";
import { escapeHtml } from "./utils.js";
import { currentUser } from "./auth.js";

export async function refreshProjectsCount() {
  if (!currentUser) return;
  try {
    const res = await API.getProjects(1, 1);
    els.projectsCount.textContent = res.meta?.total ?? 0;
  } catch { }
}

export async function openProjectsModal() {
  els.projectsModal.hidden = false;
  els.projectsList.innerHTML = `<div class="muted">Loading projects...</div>`;

  try {
    const res = await API.getProjects(1, 50);
    const projects = res.data || [];

    if (projects.length === 0) {
      els.projectsList.innerHTML = `<div class="muted">You have no saved projects yet.</div>`;
      return;
    }

    els.projectsList.innerHTML = projects.map(p => `
      <div class="project-item" data-id="${p.id}">
        <div>
          <div class="project-name">${escapeHtml(p.name)}</div>
          <div class="project-date">${new Date(p.created_at).toLocaleString()}</div>
        </div>
        <div class="project-actions">
          <button class="btn btn-primary btn-sm btn-load" data-id="${p.id}">Load</button>
          <button class="btn btn-ghost btn-sm btn-delete" data-id="${p.id}">Del</button>
        </div>
      </div>
    `).join("");

    document.querySelectorAll(".btn-load").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const id = e.target.dataset.id;
        els.projectsModal.hidden = true;
        try {
          const det = await API.getProjectDetails(id);
          els.prompt.value = det.prompt || "";
          const charCount = document.getElementById("charCount");
          if (charCount) {
            const len = els.prompt.value.length;
            charCount.textContent = `${len} / 2000`;
          }
          const result = {
            data: { code: det.code, wiring: det.wiring, libraries: det.libraries, notes: det.notes },
            meta: { board: det.board, warnings: [] },
          };
          setLastResult(result);
          setStateUI(STATES.RESULT, result);
          showToast("Project loaded", "success");
        } catch { showToast("Failed to load project", "error"); }
      });
    });

    document.querySelectorAll(".btn-delete").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        if (!confirm("Delete this project?")) return;
        try {
          await API.deleteProject(e.target.dataset.id);
          openProjectsModal();
          refreshProjectsCount();
          showToast("Project deleted", "info");
        } catch { showToast("Failed to delete", "error"); }
      });
    });
  } catch {
    els.projectsList.innerHTML = `<div class="text-red">Failed to load projects.</div>`;
  }
}

export async function handleSaveProject() {
  const lastResult = getLastResult();
  if (!lastResult || !currentUser) return;
  const originalHtml = els.saveProjectBtn.innerHTML;
  els.saveProjectBtn.innerHTML = "Saving...";
  els.saveProjectBtn.disabled = true;

  try {
    await API.saveProject({
      name: "Generated Circuit " + new Date().toLocaleTimeString(),
      prompt: els.prompt.value.trim(),
      board: lastResult.meta?.board,
      code: lastResult.data.code,
      wiring: lastResult.data.wiring,
      libraries: lastResult.data.libraries,
      notes: lastResult.data.notes,
    });

    els.saveProjectBtn.innerHTML = "Saved!";
    refreshProjectsCount();
    showToast("Project saved!", "success");
  } catch (err) {
    showToast("Failed to save: " + err.message, "error");
    els.saveProjectBtn.innerHTML = "Error";
  }

  setTimeout(() => {
    els.saveProjectBtn.innerHTML = originalHtml;
    els.saveProjectBtn.disabled = false;
  }, 2000);
}
