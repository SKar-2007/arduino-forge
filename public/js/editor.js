export function initEditor(containerId) {
  if (typeof require === "undefined") {
    console.warn("Monaco Editor not loaded — falling back to textarea");
    return null;
  }

  require.config({
    paths: { vs: "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs" },
  });

  return new Promise((resolve) => {
    require(["vs/editor/editor.main"], () => {
      const editor = monaco.editor.create(document.getElementById(containerId), {
        language: "cpp",
        theme: "vs-dark",
        fontSize: 13,
        fontFamily: "JetBrains Mono, monospace",
        minimap: { enabled: false },
        automaticLayout: true,
        readOnly: false,
        scrollBeyondLastLine: false,
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
  return window.monacoEditor?.getValue() ?? document.getElementById("codeOutput")?.textContent ?? "";
}
