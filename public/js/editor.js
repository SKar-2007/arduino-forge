export function initEditor(containerId) {
  if (typeof require === "undefined") {
    return null;
  }

  require.config({
    paths: { vs: "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs" },
  });

  return new Promise((resolve) => {
    require(["vs/editor/editor.main"], () => {
      monaco.editor.defineTheme("forge-dark", {
        base: "vs-dark",
        inherit: true,
        rules: [
          { token: "comment", foreground: "525252", fontStyle: "italic" },
          { token: "keyword", foreground: "a3a3a3" },
          { token: "string", foreground: "d4d4d4" },
          { token: "number", foreground: "a3a3a3" },
          { token: "type", foreground: "d4d4d4" },
        ],
        colors: {
          "editor.background": "#0a0a0a",
          "editor.foreground": "#d4d4d4",
          "editorCursor.foreground": "#ffffff",
          "editor.selectionBackground": "#ffffff11",
          "editorLineNumber.foreground": "#404040",
          "editorLineNumber.activeForeground": "#737373",
          "editor.selectionHighlightBackground": "#ffffff08",
          "editorIndentGuide.background": "#1a1a1a",
          "editorIndentGuide.activeBackground": "#262626",
        },
      });

      monaco.editor.defineTheme("forge-light", {
        base: "vs",
        inherit: true,
        rules: [
          { token: "comment", foreground: "a3a3a3", fontStyle: "italic" },
          { token: "keyword", foreground: "525252" },
          { token: "string", foreground: "262626" },
          { token: "number", foreground: "525252" },
          { token: "type", foreground: "262626" },
        ],
        colors: {
          "editor.background": "#fafafa",
          "editor.foreground": "#262626",
          "editorCursor.foreground": "#000000",
          "editor.selectionBackground": "#00000011",
          "editorLineNumber.foreground": "#a3a3a3",
          "editorLineNumber.activeForeground": "#525252",
          "editor.selectionHighlightBackground": "#00000008",
          "editorIndentGuide.background": "#e5e5e5",
          "editorIndentGuide.activeBackground": "#d4d4d4",
        },
      });

      const isDark = document.documentElement.getAttribute("data-theme") !== "light";
      const editor = monaco.editor.create(document.getElementById(containerId), {
        language: "cpp",
        theme: isDark ? "forge-dark" : "forge-light",
        fontSize: 13,
        fontFamily: "JetBrains Mono, monospace",
        minimap: { enabled: false },
        automaticLayout: true,
        readOnly: false,
        scrollBeyondLastLine: false,
        padding: { top: 8 },
        lineNumbersMinChars: 2,
      });
      window.monacoEditor = editor;
      resolve(editor);
    });
  });
}

export function setEditorValue(code) {
  window.monacoEditor?.setValue(code || "");
}

export function getEditorValue() {
  return window.monacoEditor?.getValue() ?? "";
}

export function syncEditorTheme() {
  if (!window.monacoEditor) return;
  const isDark = document.documentElement.getAttribute("data-theme") !== "light";
  monaco.editor.setTheme(isDark ? "forge-dark" : "forge-light");
}
