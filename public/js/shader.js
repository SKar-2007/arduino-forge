const vertexSrc = `#version 300 es
precision highp float;
in vec2 position;
out vec2 uv;
void main() {
  uv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}`;

const fragmentSrc = `#version 300 es
precision highp float;
in vec2 uv;
out vec4 fragColor;
uniform float uTime;
uniform vec2 uResolution;

void main() {
  vec2 p = (gl_FragCoord.xy * 2.0 - uResolution) / min(uResolution.x, uResolution.y);
  float t = uTime * 0.08;

  float d = 0.0;
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    vec2 q = p + vec2(cos(t * 0.5 + fi * 2.5), sin(t * 0.4 + fi * 1.7)) * 2.0;
    float len = length(q);
    d += 0.04 / (len + 0.4) * sin(len * 2.5 - t * 0.6 + fi);
  }

  float v = 0.12 + 0.04 * d;
  v *= 1.0 - length(p) * 0.2;

  fragColor = vec4(vec3(v), 0.7);
}`;

function initShader() {
  const canvas = document.getElementById("bgCanvas");
  if (!canvas) return;

  const gl = canvas.getContext("webgl2", { alpha: true, antialias: true });
  if (!gl) {
    canvas.style.display = "none";
    return;
  }

  const vs = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(vs, vertexSrc);
  gl.compileShader(vs);

  const fs = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(fs, fragmentSrc);
  gl.compileShader(fs);

  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  gl.useProgram(program);

  const vertices = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(0);

  const uTime = gl.getUniformLocation(program, "uTime");
  const uResolution = gl.getUniformLocation(program, "uResolution");

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(uResolution, canvas.width, canvas.height);
  }
  resize();
  window.addEventListener("resize", resize);

  const start = performance.now();
  function frame() {
    gl.uniform1f(uTime, (performance.now() - start) / 1000);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    requestAnimationFrame(frame);
  }
  frame();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initShader);
} else {
  initShader();
}
