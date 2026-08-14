// Plain - drawing the 3D world.
// A small WebGL renderer: one shader, a handful of built-in meshes, one
// directional light. Enough to see a world; nothing a beginner has to know.

const VERTEX_SHADER = `
attribute vec3 position;
attribute vec3 normal;
uniform mat4 model;
uniform mat4 view;
uniform mat4 projection;
uniform mat4 rotation;
varying vec3 shadedNormal;
varying float depthFade;
void main() {
  vec4 world = model * vec4(position, 1.0);
  vec4 eye = view * world;
  gl_Position = projection * eye;
  shadedNormal = normalize((rotation * vec4(normal, 0.0)).xyz);
  depthFade = clamp(-eye.z / 140.0, 0.0, 1.0);
}`;

const FRAGMENT_SHADER = `
precision mediump float;
uniform vec3 color;
uniform vec3 light;
uniform vec3 sky;
varying vec3 shadedNormal;
varying float depthFade;
void main() {
  float lit = max(dot(normalize(shadedNormal), normalize(light)), 0.0);
  vec3 shaded = color * (0.42 + 0.58 * lit);
  gl_FragColor = vec4(mix(shaded, sky, depthFade * 0.75), 1.0);
}`;

export function createRenderer(canvas) {
  const gl = canvas.getContext('webgl', { antialias: true, alpha: false }) ||
             canvas.getContext('experimental-webgl');
  if (!gl) return null;

  const program = link(gl, VERTEX_SHADER, FRAGMENT_SHADER);
  if (!program) return null;

  const attributes = {
    position: gl.getAttribLocation(program, 'position'),
    normal: gl.getAttribLocation(program, 'normal')
  };
  const uniforms = {};
  for (const name of ['model', 'view', 'projection', 'rotation', 'color', 'light', 'sky']) {
    uniforms[name] = gl.getUniformLocation(program, name);
  }

  const meshes = {
    cube: upload(gl, cubeMesh()),
    ball: upload(gl, sphereMesh(18, 12)),
    floor: upload(gl, cubeMesh()),
    post: upload(gl, cylinderMesh(20)),
    cone: upload(gl, coneMesh(20))
  };

  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.CULL_FACE);

  return {
    gl,
    draw(world) {
      const width = canvas.width, height = canvas.height;
      const sky = toRGB(world.sky);
      gl.viewport(0, 0, width, height);
      gl.clearColor(sky[0], sky[1], sky[2], 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.useProgram(program);

      const projection = perspective(60 * Math.PI / 180, width / Math.max(1, height), 0.1, 500);
      const camera = world.camera;
      const view = lookAt(
        [camera.x, camera.y, camera.z],
        [camera.atX, camera.atY, camera.atZ],
        [0, 1, 0]
      );
      gl.uniformMatrix4fv(uniforms.projection, false, projection);
      gl.uniformMatrix4fv(uniforms.view, false, view);
      gl.uniform3f(uniforms.light, world.light.x, world.light.y, world.light.z);
      gl.uniform3f(uniforms.sky, sky[0], sky[1], sky[2]);

      for (const body of world.bodies) {
        if (body.hidden || body.gone) continue;
        const mesh = meshes[body.shape] || meshes.cube;
        const rotation = multiply(
          multiply(rotateY(body.turnY * Math.PI / 180), rotateX(body.turnX * Math.PI / 180)),
          rotateZ(body.turnZ * Math.PI / 180)
        );
        const model = multiply(
          multiply(translate(body.x, body.y, body.z), rotation),
          scale(body.width, body.height, body.depth)
        );
        const color = toRGB(body.color);
        gl.uniformMatrix4fv(uniforms.model, false, model);
        gl.uniformMatrix4fv(uniforms.rotation, false, rotation);
        gl.uniform3f(uniforms.color, color[0], color[1], color[2]);
        drawMesh(gl, mesh, attributes);
      }
    }
  };
}

// ------------------------------------------------------------------ shaders

function link(gl, vertexSource, fragmentSource) {
  const vertex = compile(gl, gl.VERTEX_SHADER, vertexSource);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, fragmentSource);
  if (!vertex || !fragment) return null;
  const program = gl.createProgram();
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('Plain 3D: ' + gl.getProgramInfoLog(program));
    return null;
  }
  return program;
}

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('Plain 3D: ' + gl.getShaderInfoLog(shader));
    return null;
  }
  return shader;
}

function upload(gl, mesh) {
  const positions = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positions);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(mesh.positions), gl.STATIC_DRAW);
  const normals = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, normals);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(mesh.normals), gl.STATIC_DRAW);
  return { positions, normals, count: mesh.positions.length / 3 };
}

function drawMesh(gl, mesh, attributes) {
  gl.bindBuffer(gl.ARRAY_BUFFER, mesh.positions);
  gl.enableVertexAttribArray(attributes.position);
  gl.vertexAttribPointer(attributes.position, 3, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, mesh.normals);
  gl.enableVertexAttribArray(attributes.normal);
  gl.vertexAttribPointer(attributes.normal, 3, gl.FLOAT, false, 0, 0);
  gl.drawArrays(gl.TRIANGLES, 0, mesh.count);
}

// ------------------------------------------------------------------- meshes
// Every mesh is one unit across and centred, so a body's width/height/depth
// scale it directly.

export function cubeMesh() {
  const positions = [];
  const normals = [];
  const faces = [
    { normal: [0, 0, 1], corners: [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]] },
    { normal: [0, 0, -1], corners: [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]] },
    { normal: [1, 0, 0], corners: [[1, -1, 1], [1, -1, -1], [1, 1, -1], [1, 1, 1]] },
    { normal: [-1, 0, 0], corners: [[-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1]] },
    { normal: [0, 1, 0], corners: [[-1, 1, 1], [1, 1, 1], [1, 1, -1], [-1, 1, -1]] },
    { normal: [0, -1, 0], corners: [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]] }
  ];
  for (const face of faces) {
    const [a, b, c, d] = face.corners.map(p => p.map(v => v / 2));
    for (const point of [a, b, c, a, c, d]) {
      positions.push(...point);
      normals.push(...face.normal);
    }
  }
  return { positions, normals };
}

export function sphereMesh(columns = 18, rows = 12) {
  const positions = [];
  const normals = [];
  const point = (column, row) => {
    const theta = (column / columns) * Math.PI * 2;
    const phi = (row / rows) * Math.PI;
    return [
      Math.sin(phi) * Math.cos(theta) / 2,
      Math.cos(phi) / 2,
      Math.sin(phi) * Math.sin(theta) / 2
    ];
  };
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const a = point(column, row);
      const b = point(column + 1, row);
      const c = point(column + 1, row + 1);
      const d = point(column, row + 1);
      for (const p of [a, d, c, a, c, b]) {
        positions.push(...p);
        const length = Math.hypot(...p) || 1;
        normals.push(p[0] / length, p[1] / length, p[2] / length);
      }
    }
  }
  return { positions, normals };
}

export function cylinderMesh(sides = 20) {
  const positions = [];
  const normals = [];
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI * 2;
    const b = ((i + 1) / sides) * Math.PI * 2;
    const ax = Math.cos(a) / 2, az = Math.sin(a) / 2;
    const bx = Math.cos(b) / 2, bz = Math.sin(b) / 2;
    // side
    for (const [x, y, z, nx, nz] of [
      [ax, -0.5, az, Math.cos(a), Math.sin(a)], [bx, -0.5, bz, Math.cos(b), Math.sin(b)], [bx, 0.5, bz, Math.cos(b), Math.sin(b)],
      [ax, -0.5, az, Math.cos(a), Math.sin(a)], [bx, 0.5, bz, Math.cos(b), Math.sin(b)], [ax, 0.5, az, Math.cos(a), Math.sin(a)]
    ]) {
      positions.push(x, y, z);
      normals.push(nx, 0, nz);
    }
    // top and bottom caps
    positions.push(0, 0.5, 0, ax, 0.5, az, bx, 0.5, bz);
    normals.push(0, 1, 0, 0, 1, 0, 0, 1, 0);
    positions.push(0, -0.5, 0, bx, -0.5, bz, ax, -0.5, az);
    normals.push(0, -1, 0, 0, -1, 0, 0, -1, 0);
  }
  return { positions, normals };
}

export function coneMesh(sides = 20) {
  const positions = [];
  const normals = [];
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI * 2;
    const b = ((i + 1) / sides) * Math.PI * 2;
    const ax = Math.cos(a) / 2, az = Math.sin(a) / 2;
    const bx = Math.cos(b) / 2, bz = Math.sin(b) / 2;
    positions.push(0, 0.5, 0, ax, -0.5, az, bx, -0.5, bz);
    const nx = Math.cos((a + b) / 2), nz = Math.sin((a + b) / 2);
    for (let k = 0; k < 3; k++) normals.push(nx, 0.5, nz);
    positions.push(0, -0.5, 0, bx, -0.5, bz, ax, -0.5, az);
    for (let k = 0; k < 3; k++) normals.push(0, -1, 0);
  }
  return { positions, normals };
}

// ----------------------------------------------------------------- matrices
// Column major, the order WebGL wants.

export function identity() {
  return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
}

export function multiply(a, b) {
  const out = new Float32Array(16);
  for (let column = 0; column < 4; column++) {
    for (let row = 0; row < 4; row++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) sum += a[k * 4 + row] * b[column * 4 + k];
      out[column * 4 + row] = sum;
    }
  }
  return out;
}

export function translate(x, y, z) {
  const out = identity();
  out[12] = x; out[13] = y; out[14] = z;
  return out;
}

export function scale(x, y, z) {
  const out = identity();
  out[0] = x; out[5] = y; out[10] = z;
  return out;
}

export function rotateY(angle) {
  const out = identity();
  const s = Math.sin(angle), c = Math.cos(angle);
  out[0] = c; out[2] = -s; out[8] = s; out[10] = c;
  return out;
}

export function rotateX(angle) {
  const out = identity();
  const s = Math.sin(angle), c = Math.cos(angle);
  out[5] = c; out[6] = s; out[9] = -s; out[10] = c;
  return out;
}

export function rotateZ(angle) {
  const out = identity();
  const s = Math.sin(angle), c = Math.cos(angle);
  out[0] = c; out[1] = s; out[4] = -s; out[5] = c;
  return out;
}

export function perspective(fieldOfView, aspect, near, far) {
  const f = 1 / Math.tan(fieldOfView / 2);
  const out = new Float32Array(16);
  out[0] = f / aspect;
  out[5] = f;
  out[10] = (far + near) / (near - far);
  out[11] = -1;
  out[14] = (2 * far * near) / (near - far);
  return out;
}

export function lookAt(eye, at, up) {
  const z = normalise(subtract(eye, at));
  const x = normalise(cross(up, z));
  const y = cross(z, x);
  return new Float32Array([
    x[0], y[0], z[0], 0,
    x[1], y[1], z[1], 0,
    x[2], y[2], z[2], 0,
    -dot(x, eye), -dot(y, eye), -dot(z, eye), 1
  ]);
}

function subtract(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function normalise(v) {
  const length = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / length, v[1] / length, v[2] / length];
}

// ------------------------------------------------------------------- colour

const NAMED = {
  white: '#ffffff', black: '#000000', red: '#e5484d', green: '#3ba55d', blue: '#4c8dff',
  yellow: '#ffd166', orange: '#ff8c42', purple: '#a970ff', pink: '#ff7ab6', brown: '#8b5e3c',
  grey: '#9aa0aa', gray: '#9aa0aa', cyan: '#31c8c0', sand: '#d9c39a', sky: '#7ec8ff'
};

export function toRGB(color) {
  let value = String(color || '#cccccc').trim().toLowerCase();
  if (NAMED[value]) value = NAMED[value];
  if (value.startsWith('#')) {
    let hex = value.slice(1);
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    const number = parseInt(hex, 16);
    if (!Number.isNaN(number) && hex.length === 6) {
      return [((number >> 16) & 255) / 255, ((number >> 8) & 255) / 255, (number & 255) / 255];
    }
  }
  const match = value.match(/rgba?\(([^)]+)\)/);
  if (match) {
    const parts = match[1].split(',').map(p => parseFloat(p.trim()));
    return [(parts[0] || 0) / 255, (parts[1] || 0) / 255, (parts[2] || 0) / 255];
  }
  return [0.8, 0.8, 0.8];
}
