import { DAY } from './playback'
import { projectionScale } from './map-projection'
import { EDGE_FLOATS, HEAD_TEXTURE_WIDTH, FleetHeads, type FleetView } from './fleet-geometry'

const common = `
precision highp float;
uniform sampler2D uHeads;
uniform vec2 uSize;
uniform vec2 uCenter;
uniform float uScale;
uniform float uShift;
uniform float uTime;
uniform vec2 uTrail;
uniform float uSelection;
uniform float uRatio;
out vec4 vColor;
vec4 head(int index) { return texelFetch(uHeads, ivec2(index % 256, index / 256), 0); }
vec2 project(vec2 point) { return uSize * .5 + (point + vec2(uShift, 0.) - uCenter) * vec2(uScale, -uScale); }
vec4 clip(vec2 point) { return vec4(point / uSize * vec2(2., -2.) + vec2(-1., 1.), 0., 1.); }
bool visible(vec4 h) {
  vec2 p = project(h.xy);
  return h.z > .5 && all(greaterThanEqual(p, vec2(-100.))) && all(lessThanEqual(p, uSize + 100.));
}
vec3 color(float category) {
  return category < 1.5 ? vec3(213., 233., 231.) / 255. : category < 2.5 ? vec3(233., 184., 107.) / 255. : vec3(112., 136., 142.) / 255.;
}
`
const trailVertex = `#version 300 es
${common}
layout(location=0) in vec3 aStart;
layout(location=1) in vec3 aEnd;
layout(location=2) in float aSegment;
out float vDistance;
out float vHalfWidth;
void main() {
  vec4 h = head(int(aSegment));
  float duration = h.w > .5 ? uTrail.y : uTrail.x;
  float first = max(aStart.z, uTime - duration), last = min(aEnd.z, uTime);
  if (!visible(h) || last <= first) { gl_Position = vec4(2., 2., 0., 1.); return; }
  vec2 a = project(mix(aStart.xy, aEnd.xy, (first - aStart.z) / (aEnd.z - aStart.z)));
  vec2 b = project(mix(aStart.xy, aEnd.xy, (last - aStart.z) / (aEnd.z - aStart.z)));
  vec2 delta = b - a;
  float length = length(delta);
  if (length < .0001) { gl_Position = vec4(2., 2., 0., 1.); return; }
  vec2 corners[6] = vec2[6](vec2(0., -1.), vec2(1., -1.), vec2(0., 1.), vec2(0., 1.), vec2(1., -1.), vec2(1., 1.));
  vec2 corner = corners[gl_VertexID];
  vHalfWidth = (h.w > .5 ? 1.7 : .9) * .5;
  vDistance = corner.y * (vHalfWidth + .5);
  gl_Position = clip(mix(a, b, corner.x) + vec2(-delta.y, delta.x) / length * vDistance);
  float strength = h.w > .5 ? .85 : uSelection > .5 ? .08 : .45;
  vColor = vec4(color(h.z), strength * (mix(first, last, corner.x) - uTime + duration) / duration);
}
`
const trailFragment = `#version 300 es
precision highp float;
in vec4 vColor;
in float vDistance;
in float vHalfWidth;
out vec4 outputColor;
void main() {
  float alpha = vColor.a * (1. - smoothstep(vHalfWidth - .5, vHalfWidth + .5, abs(vDistance)));
  outputColor = vec4(vColor.rgb * alpha, alpha);
}
`
const headVertex = `#version 300 es
${common}
out float vRadius;
out float vSelected;
void main() {
  vec4 h = head(gl_VertexID);
  if (!visible(h)) { gl_Position = vec4(2., 2., 0., 1.); gl_PointSize = 1.; return; }
  vSelected = h.w;
  vRadius = h.w > .5 ? 10. : 2.2;
  gl_Position = clip(project(h.xy));
  gl_PointSize = vRadius * 2. * uRatio;
  vColor = vec4(color(h.z), uSelection > .5 && h.w < .5 ? .18 : .95);
}
`
const headFragment = `#version 300 es
precision highp float;
in vec4 vColor;
in float vRadius;
in float vSelected;
out vec4 outputColor;
void main() {
  float distance = length(gl_PointCoord - .5) * 2. * vRadius;
  float radius = vSelected > .5 ? 3.6 : 1.7;
  float alpha = vColor.a * (1. - smoothstep(radius - .5, radius + .5, distance));
  if (vSelected > .5) alpha = max(alpha, .4 * (1. - smoothstep(.35, 1.35, abs(distance - 9.))));
  outputColor = vec4(vColor.rgb * alpha, alpha);
}
`

function program(gl: WebGL2RenderingContext, vertex: string, fragment: string) {
  const shaders: WebGLShader[] = []
  const result = gl.createProgram()!
  try {
    for (const [type, source] of [[gl.VERTEX_SHADER, vertex], [gl.FRAGMENT_SHADER, fragment]] as const) {
      const shader = gl.createShader(type)!
      shaders.push(shader); gl.shaderSource(shader, source); gl.compileShader(shader)
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) ?? 'Fleet shader failed')
      gl.attachShader(result, shader)
    }
    gl.linkProgram(result)
    if (!gl.getProgramParameter(result, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(result) ?? 'Fleet program failed')
    return result
  } catch (error) { gl.deleteProgram(result); throw error }
  finally { shaders.forEach(shader => gl.deleteShader(shader)) }
}

/** Resident sample geometry; playback changes only a small head texture and uniforms. */
export function createFleetRenderer(canvas: HTMLCanvasElement) {
  const gl = canvas.getContext('webgl2', { alpha: true, antialias: false, depth: false, stencil: false, premultipliedAlpha: true })
  if (!gl) return null
  const debug = gl.getExtension('WEBGL_debug_renderer_info')
  const backend = debug ? String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)) : 'WebGL 2'
  canvas.dataset.backend = backend
  // Software GL is much slower than batched Canvas at fleet volume.
  if (/swiftshader|llvmpipe|softpipe|software rasterizer/i.test(backend)) return null
  const trails = program(gl, trailVertex, trailFragment)
  let points: WebGLProgram
  try { points = program(gl, headVertex, headFragment) }
  catch (error) { gl.deleteProgram(trails); throw error }
  const buffer = gl.createBuffer()!, texture = gl.createTexture()!, vao = gl.createVertexArray()!, pointVao = gl.createVertexArray()!
  const uniforms = new Map([trails, points].map(p => [p, new Map(['uHeads', 'uSize', 'uCenter', 'uScale', 'uShift', 'uTime', 'uTrail', 'uSelection', 'uRatio'].map(name => [name, gl.getUniformLocation(p, name)]))]))
  let heads: FleetHeads | null = null, edgeCount = 0, bytes = 0, uploads = 0
  gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  for (const [location, size, offset] of [[0, 3, 0], [1, 3, 3], [2, 1, 6]]) {
    gl.enableVertexAttribArray(location)
    gl.vertexAttribPointer(location, size, gl.FLOAT, false, EDGE_FLOATS * 4, offset * 4)
    gl.vertexAttribDivisor(location, 1)
  }
  gl.bindTexture(gl.TEXTURE_2D, texture)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
  return {
    draw(next: FleetHeads, view: FleetView) {
      const ratio = Math.min(window.devicePixelRatio || 1, 2)
      const width = Math.round(view.size.width * ratio), height = Math.round(view.size.height * ratio)
      if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height }
      gl.viewport(0, 0, width, height)
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT)
      const drawn = next.update(view)
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texture)
      if (heads !== next) {
        const edges = next.edges
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer); gl.bufferData(gl.ARRAY_BUFFER, edges, gl.STATIC_DRAW)
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, HEAD_TEXTURE_WIDTH, next.data.length / 4 / HEAD_TEXTURE_WIDTH, 0, gl.RGBA, gl.FLOAT, next.data)
        heads = next; edgeCount = edges.length / EDGE_FLOATS; bytes = edges.byteLength + next.data.byteLength; uploads++
      } else {
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, HEAD_TEXTURE_WIDTH, next.data.length / 4 / HEAD_TEXTURE_WIDTH, gl.RGBA, gl.FLOAT, next.data)
      }
      const observed = next.study.source.evidence === 'observed'
      for (const p of [trails, points]) {
        gl.useProgram(p)
        const u = uniforms.get(p)!
        gl.uniform1i(u.get('uHeads')!, 0)
        gl.uniform2f(u.get('uSize')!, view.size.width, view.size.height)
        gl.uniform2f(u.get('uCenter')!, view.camera.longitude, view.camera.latitude)
        gl.uniform1f(u.get('uScale')!, projectionScale(view.size) * view.camera.zoom)
        gl.uniform1f(u.get('uTime')!, view.time)
        gl.uniform2f(u.get('uTrail')!, observed ? 1800 : DAY * 1.4, observed ? 3600 : DAY * 3)
        gl.uniform1f(u.get('uSelection')!, Number(view.selected !== null))
        gl.uniform1f(u.get('uRatio')!, ratio)
        gl.bindVertexArray(p === trails ? vao : pointVao)
        for (const shift of [-360, 0, 360]) {
          gl.uniform1f(u.get('uShift')!, shift)
          if (p === trails) gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, edgeCount)
          else gl.drawArrays(gl.POINTS, 0, next.study.segments.length)
        }
      }
      canvas.dataset.geometryUploads = String(uploads)
      canvas.dataset.bufferBytes = String(bytes)
      canvas.dataset.drawCalls = '6'
      return drawn
    },
    dispose() {
      gl.deleteBuffer(buffer); gl.deleteTexture(texture); gl.deleteVertexArray(vao); gl.deleteVertexArray(pointVao)
      gl.deleteProgram(trails); gl.deleteProgram(points)
    },
  }
}
export type FleetRenderer = NonNullable<ReturnType<typeof createFleetRenderer>>
