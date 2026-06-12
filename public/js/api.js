const API = {
  async generate(payload) {
    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || data.error || "Generation failed");
    return data;
  },

  async components() {
    const res = await fetch("/api/components");
    return res.json();
  },

  async auth(endpoint, username, password) {
    const res = await fetch(`/api/auth/${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Auth failed");
    return data;
  },

  async logout() {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "same-origin",
    });
  },

  async getProjects(page = 1, limit = 50) {
    const res = await fetch(`/api/projects?page=${page}&limit=${limit}`, {
      credentials: "same-origin",
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async saveProject(payload) {
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async getProjectDetails(id) {
    const res = await fetch(`/api/projects/${id}`, { credentials: "same-origin" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data.data;
  },

  async deleteProject(id) {
    const res = await fetch(`/api/projects/${id}`, {
      method: "DELETE",
      credentials: "same-origin",
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async updateProject(id, payload) {
    const res = await fetch(`/api/projects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async toggleProjectVisibility(id, isPublic) {
    const res = await fetch(`/api/projects/${id}/visibility`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ is_public: isPublic }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  async exportZip(payload) {
    const res = await fetch("/api/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Export failed");
    return res;
  },

  async compile(payload) {
    const res = await fetch("/api/compile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return res;
  },

  async refine(payload) {
    const res = await fetch("/api/generate/refine", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Refinement failed");
    return data;
  },
};

export default API;
