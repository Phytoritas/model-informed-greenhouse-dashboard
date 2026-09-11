import { airflowGeometry, cucumberGeometry, fieldSlice, plantInstances, rowBeds, sunGeometry, type DisplayGeometry } from './illustrativeGeometry';
import { available, growthDisplay, type LoadedScene, type ScenePart, type SceneSnapshot } from './sceneData';
import { cameraBasis, center, clamp, dot, multiply, perspective, project, solarPosition, sub, viewMatrix, type SunPosition, type Vec3 } from './sceneMath';

type Color = [number, number, number, number];
interface GpuBatch {
  vao: WebGLVertexArrayObject;
  buffers: WebGLBuffer[];
  indexBuffer: WebGLBuffer;
  lineBuffer: WebGLBuffer;
  count: number;
  lineCount: number;
  group: string;
  target: string;
  oneSided: boolean;
  parts: ScenePart[];
}
export interface ScreenPoint { x: number; y: number; visible: boolean }
export interface SceneProjection {
  sensors: ScreenPoint[];
  plant: ScreenPoint;
  northAngle: number;
  sun: SunPosition | null;
  insetVisible: boolean;
}
interface Callbacks { onProjection: (projection: SceneProjection) => void; onError: (message: string) => void }

const BACKGROUND_COLORS: Record<'light' | 'dark', Color> = {
  light: [249 / 255, 248 / 255, 245 / 255, 1],
  dark: [41 / 255, 41 / 255, 39 / 255, 1],
};
const COLORS: Record<string, Color> = {
  plant_leaf: [.34, .52, .18, 1], plant_stem: [.48, .56, .23, 1], plant_fruit: [.89, .34, .09, 1],
  cucumber_fruit: [.15, .35, .09, 1], floor: [.92, .928, .899, 1],
  posts: [.67, .71, .7, 1], y8_columns: [.67, .71, .7, 1], perimeter_columns: [.67, .71, .7, 1],
  trusses: [.74, .77, .76, 1], truss_webs: [.72, .76, .75, 1],
  roof: [.72, .85, .84, .07], walls: [.74, .85, .81, .045], partitions: [.59, .79, .71, .08],
  screens_lower: [.79, .79, .69, .17], screens_upper: [.72, .76, .76, .14],
  beds: [.77, .8, .72, 1], field: [1, 1, 1, .38], airflow: [.14, .6, .76, .8], sun: [1, .76, .22, 1],
};
const SENSOR_POSITIONS: Vec3[] = [[7.2, 5.8, 3.1], [21, 9.2, 4.0], [34.5, 11, 3.2]];
const VERTEX = `#version 300 es
layout(location=0) in vec3 position;
layout(location=1) in vec3 normal;
layout(location=2) in vec4 instance;
uniform mat4 matrix;
uniform vec3 origin, scale, offset;
uniform bool instanced;
out vec3 surfaceNormal;
out vec3 world;
void main() {
  float angle=instanced?instance.w:0.0;
  mat3 rotation=mat3(cos(angle),sin(angle),0.,-sin(angle),cos(angle),0.,0.,0.,1.);
  world=rotation*(position*scale)+offset+(instanced?instance.xyz:vec3(0.));
  surfaceNormal=rotation*(normal/max(scale,vec3(.001)));
  gl_Position=matrix*vec4(world-origin,1.);
}`;
const FRAGMENT = `#version 300 es
precision highp float;
in vec3 surfaceNormal;
in vec3 world;
uniform vec4 colour;
uniform vec3 sunDirection;
uniform bool unlit;
uniform int fieldMode;
uniform float fieldValue;
out vec4 pixel;
vec3 ramp(float t) {
  vec3 a=vec3(.22,.48,.75), b=vec3(.46,.76,.62), c=vec3(.98,.79,.36), d=vec3(.85,.27,.12);
  return t<.333?mix(a,b,t*3.):t<.666?mix(b,c,(t-.333)*3.):mix(c,d,(t-.666)*3.);
}
void main() {
  vec3 base=colour.rgb;
  if(fieldMode>0) {
    // Explicitly illustrative spatial variation around the passed scalar.
    float variation=.1*sin(world.x*.26)+.045*(world.z-2.5);
    base=fieldMode==1?ramp(clamp(fieldValue+variation,0.,1.)):
      mix(vec3(.69,.86,.9),vec3(.17,.41,.7),clamp(fieldValue+variation,0.,1.));
  }
  vec3 n=normalize(surfaceNormal); if(!gl_FrontFacing)n=-n;
  float light=unlit?1.:.72+.28*max(0.,dot(n,sunDirection));
  pixel=vec4(base*light,colour.a);
}`;

/** Direct WebGL2 renderer adapted from twin-studio's native scene viewer.
 * ENU remains ENU; one common translation improves Float32 camera precision.
 * No perpetual animation loop: redraw only on input, resize, theme change or a new snapshot.
 */
export class GreenhouseRenderer {
  private canvas: HTMLCanvasElement;
  private gl: WebGL2RenderingContext;
  private loaded: LoadedScene;
  private callbacks: Callbacks;
  private snapshot: SceneSnapshot;
  private program: WebGLProgram | null = null;
  private uniforms: Record<string, WebGLUniformLocation | null> = {};
  private buffers = new Set<WebGLBuffer>();
  private vaos = new Set<WebGLVertexArrayObject>();
  private batches: GpuBatch[] = [];
  private cucumber: GpuBatch[] = [];
  private beds: GpuBatch | null = null;
  private slice: GpuBatch | null = null;
  private sunMesh: GpuBatch | null = null;
  private airflow: GpuBatch | null = null;
  private airflowKey = '';
  private instances: WebGLBuffer | null = null;
  private instanceCount = 0;
  private origin: Vec3;
  private camera = { target: [0, 0, 0] as Vec3, azimuth: -1.06, elevation: .6, distance: 60 };
  private fov = Math.PI / 5;
  private frame: number | null = null;
  private disposed = false;
  private lost = false;
  private observer: ResizeObserver | null = null;
  private themeObserver: MutationObserver | null = null;
  private abort = new AbortController();
  private pointers = new Map<number, { x: number; y: number; pan: boolean }>();

  constructor(canvas: HTMLCanvasElement, loaded: LoadedScene, snapshot: SceneSnapshot, callbacks: Callbacks) {
    this.canvas = canvas; this.loaded = loaded; this.snapshot = snapshot; this.callbacks = callbacks;
    const gl = canvas.getContext('webgl2', { antialias: true, alpha: false, powerPreference: 'low-power' });
    if (!gl) throw new Error('이 브라우저에서 WebGL2를 사용할 수 없습니다. 다른 브라우저에서 3D 온실을 열어 주세요.');
    this.gl = gl;
    this.origin = center(loaded.manifest.facilityBounds);
    try {
      this.program = this.createProgram();
      for (const name of ['matrix', 'origin', 'scale', 'offset', 'instanced', 'colour', 'sunDirection', 'unlit', 'fieldMode', 'fieldValue']) {
        this.uniforms[name] = gl.getUniformLocation(this.program, name);
      }
      const instances = plantInstances(loaded.manifest.plantOrigin);
      this.instances = this.buffer(gl.ARRAY_BUFFER, instances);
      this.instanceCount = instances.length / 4;
      for (const item of loaded.manifest.batches) {
        const vertices = new Float32Array(loaded.binary, item.vertices.byteOffset, item.vertices.length);
        const indices = new Uint32Array(loaded.binary, item.indices.byteOffset, item.indices.length);
        const lines = new Uint32Array(loaded.binary, item.lines.byteOffset, item.lines.length);
        this.batches.push(this.upload(vertices, indices, lines, item.group, item.target, item.sidedness === 'ONE_SIDED', item.parts));
      }
      this.cucumber = cucumberGeometry().map(geometry => this.uploadDisplay(geometry));
      this.beds = this.uploadDisplay(rowBeds());
      this.slice = this.uploadDisplay(fieldSlice());
      this.sunMesh = this.uploadDisplay(sunGeometry());
      this.installInput();
      let previousWidth = 0, previousHeight = 0;
      this.observer = new ResizeObserver(() => {
        const width = canvas.clientWidth, height = canvas.clientHeight;
        // Fit when the viewport changes shape, while preserving deliberate orbit/zoom otherwise.
        if (!previousWidth || Math.abs(width / Math.max(height, 1) - previousWidth / Math.max(previousHeight, 1)) > .12) this.reset();
        previousWidth = width; previousHeight = height;
        this.requestDraw();
      });
      this.observer.observe(canvas);
      this.themeObserver = new MutationObserver(() => this.requestDraw());
      this.themeObserver.observe(canvas.ownerDocument.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
      this.reset();
    } catch (error) { this.dispose(); throw error; }
  }

  private createProgram() {
    const gl = this.gl, shaders: WebGLShader[] = [];
    const program = gl.createProgram();
    if (!program) throw new Error('그래픽 프로그램을 준비하지 못했습니다.');
    try {
      for (const [type, source] of [[gl.VERTEX_SHADER, VERTEX], [gl.FRAGMENT_SHADER, FRAGMENT]] as const) {
        const shader = gl.createShader(type);
        if (!shader) throw new Error('그래픽 셰이더를 준비하지 못했습니다.');
        shaders.push(shader); gl.shaderSource(shader, source); gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error('3D 그래픽을 초기화하지 못했습니다.');
        gl.attachShader(program, shader);
      }
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('3D 그래픽을 연결하지 못했습니다.');
      return program;
    } catch (error) { gl.deleteProgram(program); throw error; }
    finally { shaders.forEach(shader => gl.deleteShader(shader)); }
  }

  private buffer(target: number, data: Float32Array | Uint32Array) {
    const buffer = this.gl.createBuffer();
    if (!buffer) throw new Error('3D 형상을 위한 메모리가 부족합니다.');
    this.buffers.add(buffer); this.gl.bindBuffer(target, buffer);
    this.gl.bufferData(target, data, this.gl.STATIC_DRAW);
    return buffer;
  }

  private upload(vertices: Float32Array, indices: Uint32Array, lines: Uint32Array, group: string,
    target = 'display', oneSided = false, parts: ScenePart[] = []): GpuBatch {
    const gl = this.gl, vao = gl.createVertexArray();
    if (!vao) throw new Error('3D 형상을 준비하지 못했습니다.');
    this.vaos.add(vao); gl.bindVertexArray(vao);
    const vertexBuffer = this.buffer(gl.ARRAY_BUFFER, vertices);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instances);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 16, 0); gl.vertexAttribDivisor(2, 1);
    const lineBuffer = this.buffer(gl.ELEMENT_ARRAY_BUFFER, lines);
    const indexBuffer = this.buffer(gl.ELEMENT_ARRAY_BUFFER, indices);
    gl.bindVertexArray(null);
    return { vao, buffers: [vertexBuffer, lineBuffer, indexBuffer], indexBuffer, lineBuffer,
      count: indices.length, lineCount: lines.length, group, target, oneSided, parts };
  }

  private uploadDisplay(geometry: DisplayGeometry) {
    return this.upload(geometry.vertices, geometry.indices, new Uint32Array(), geometry.group);
  }

  private releaseBatch(batch: GpuBatch) {
    for (const buffer of batch.buffers) { this.gl.deleteBuffer(buffer); this.buffers.delete(buffer); }
    this.gl.deleteVertexArray(batch.vao); this.vaos.delete(batch.vao);
  }

  update(snapshot: SceneSnapshot) {
    const viewChanged = snapshot.view !== this.snapshot.view;
    this.snapshot = snapshot;
    if (viewChanged) this.reset();
    this.requestDraw();
  }

  reset() {
    const plant = this.snapshot.view === 'plant';
    this.camera.azimuth = plant ? -1.05 : -1.06;
    this.camera.elevation = plant ? .18 : .6;
    if (plant) {
      const scale = growthDisplay(this.snapshot.metrics, this.snapshot.crop, this.snapshot.data).scale[2];
      this.camera.target = sub(this.loaded.manifest.plantOrigin, this.origin);
      this.camera.target[2] += .82 * scale;
      this.camera.distance = 3.1 * scale;
    } else {
      this.camera.target = [0, 0, -.9];
      const { back, right, up } = cameraBasis(this.camera.azimuth, this.camera.elevation);
      const extent = this.loaded.manifest.facilityBounds;
      const aspect = Math.max(1, this.canvas.clientWidth) / Math.max(1, this.canvas.clientHeight);
      const tangent = Math.tan(this.fov / 2);
      let distance = 1;
      for (const x of [extent.min[0], extent.max[0]]) for (const y of [extent.min[1], extent.max[1]]) for (const z of [extent.min[2], extent.max[2]]) {
        const p = sub(sub([x, y, z], this.origin), this.camera.target);
        distance = Math.max(distance, dot(p, back) + Math.max(Math.abs(dot(p, right)) / (aspect * tangent), Math.abs(dot(p, up)) / tangent));
      }
      this.camera.distance = distance * 1.16;
    }
    this.requestDraw();
  }

  zoom(factor: number) {
    const plant = this.snapshot.view === 'plant';
    this.camera.distance = clamp(this.camera.distance * factor, plant ? .7 : 15, plant ? 15 : 220);
    this.requestDraw();
  }

  private requestDraw() {
    if (this.frame === null && !this.disposed && !this.lost) this.frame = requestAnimationFrame(() => {
      this.frame = null;
      try { this.draw(); } catch { this.lost = true; this.callbacks.onError('3D 장면을 그리지 못했습니다. 다시 불러와 주세요.'); }
    });
  }

  private transform(scale: Vec3 = [1, 1, 1], offset: Vec3 = [0, 0, 0], instanced = false) {
    const gl = this.gl;
    gl.uniform3fv(this.uniforms.scale, scale); gl.uniform3fv(this.uniforms.offset, offset);
    gl.uniform1i(this.uniforms.instanced, instanced ? 1 : 0);
  }

  private renderBatch(batch: GpuBatch, options: { lines?: boolean; instances?: number; start?: number; count?: number; color?: Color } = {}) {
    const gl = this.gl, lines = options.lines ?? false;
    const color = options.color ?? (lines ? [.46, .53, .51, batch.group.startsWith('screens') ? .15 : .53] : COLORS[batch.group] ?? [.6, .65, .6, 1]);
    if (batch.oneSided && !lines) gl.enable(gl.CULL_FACE); else gl.disable(gl.CULL_FACE);
    gl.uniform4fv(this.uniforms.colour, color);
    gl.uniform1i(this.uniforms.unlit, lines || ['floor', 'beds', 'airflow', 'field', 'sun'].includes(batch.group) ? 1 : 0);
    gl.bindVertexArray(batch.vao);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, lines ? batch.lineBuffer : batch.indexBuffer);
    const count = options.count ?? (lines ? batch.lineCount : batch.count), start = (options.start ?? 0) * 4;
    if (options.instances) gl.drawElementsInstanced(gl.TRIANGLES, count, gl.UNSIGNED_INT, start, options.instances);
    else gl.drawElements(lines ? gl.LINES : gl.TRIANGLES, count, gl.UNSIGNED_INT, start);
  }

  private drawPlants(detail: boolean, inset = false) {
    const { crop, metrics } = this.snapshot;
    const growth = growthDisplay(metrics, crop, this.snapshot.data);
    if (!growth.visible) return;
    const batches = crop === 'Cucumber' ? this.cucumber : this.batches.filter(b => b.target === (detail ? 'tomatoDetail' : 'tomatoRows'));
    this.transform(growth.scale, detail && !inset ? this.loaded.manifest.plantOrigin : [0, 0, 0], !detail);
    for (const batch of batches) this.renderBatch(batch, detail ? {} : { instances: this.instanceCount });
    this.transform();
  }

  private backgroundColor(): Color {
    return BACKGROUND_COLORS[this.canvas.ownerDocument.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'];
  }

  private draw() {
    if (this.disposed || this.lost) return;
    const gl = this.gl, { canvas, snapshot } = this;
    const ratio = Math.min(window.devicePixelRatio || 1, 1.75);
    const cssWidth = Math.max(1, canvas.clientWidth), cssHeight = Math.max(1, canvas.clientHeight);
    const width = Math.max(1, Math.round(cssWidth * ratio)), height = Math.max(1, Math.round(cssHeight * ratio));
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
    gl.viewport(0, 0, width, height); gl.disable(gl.SCISSOR_TEST); gl.depthMask(true);
    gl.clearColor(...this.backgroundColor()); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(this.program); gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.frontFace(gl.CCW);
    gl.disable(gl.BLEND); gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(1, 1);
    gl.uniform3fv(this.uniforms.origin, this.origin); gl.uniform1i(this.uniforms.fieldMode, 0);
    const sun = solarPosition(snapshot.data.timestamp, this.loaded.manifest.site);
    gl.uniform3fv(this.uniforms.sunDirection, sun?.aboveHorizon ? sun.direction : [.25, -.35, .9]);
    const matrix = multiply(perspective(width / height, .05, 500, this.fov),
      viewMatrix(this.camera.target, this.camera.distance, this.camera.azimuth, this.camera.elevation));
    gl.uniformMatrix4fv(this.uniforms.matrix, false, matrix);
    this.transform();
    if (snapshot.view === 'plant') this.drawPlants(true);
    else {
      const facility = this.batches.filter(b => b.target === 'facility');
      for (const batch of facility) if ((COLORS[batch.group]?.[3] ?? 1) === 1) this.renderBatch(batch);
      if (this.beds) this.renderBatch(this.beds);
      this.drawPlants(false);
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
      const back = cameraBasis(this.camera.azimuth, this.camera.elevation).back;
      const panes = facility.filter(b => (COLORS[b.group]?.[3] ?? 1) < 1)
        .flatMap(batch => batch.parts.map(part => ({ batch, part })));
      panes.sort((a, b) => dot(a.part.center, back) - dot(b.part.center, back));
      for (const { batch, part } of panes) this.renderBatch(batch, { start: part.start, count: part.count });
      gl.disable(gl.POLYGON_OFFSET_FILL);
      for (const batch of facility) if (batch.lineCount) this.renderBatch(batch, { lines: true });
      this.drawLayer();
      gl.depthMask(true); gl.disable(gl.BLEND);
      if (sun?.aboveHorizon && this.sunMesh) {
        const offset = this.origin.map((v, i) => v + sun.direction[i] * 25) as Vec3;
        this.transform([1, 1, 1], offset); this.renderBatch(this.sunMesh); this.transform();
      }
    }
    const plantPosition = sub(this.loaded.manifest.plantOrigin, this.origin);
    plantPosition[2] += 1.8 * growthDisplay(snapshot.metrics, snapshot.crop, snapshot.data).scale[2];
    const north = project(sub([20.195, 24.295, 0], this.origin), matrix, cssWidth, cssHeight);
    const northBase = project(sub([20.195, 14.295, 0], this.origin), matrix, cssWidth, cssHeight);
    const insetVisible = snapshot.showInset && snapshot.view === 'whole' && cssWidth >= 640;
    if (insetVisible) this.drawInset(ratio, width);
    this.callbacks.onProjection({ sun, insetVisible,
      sensors: SENSOR_POSITIONS.map(p => project(sub(p, this.origin), matrix, cssWidth, cssHeight)),
      plant: project(plantPosition, matrix, cssWidth, cssHeight),
      northAngle: Math.atan2(north.x - northBase.x, northBase.y - north.y) * 180 / Math.PI,
    });
    gl.bindVertexArray(null); gl.depthMask(true); gl.disable(gl.SCISSOR_TEST);
  }

  private drawLayer() {
    const { data, layer } = this.snapshot, gl = this.gl;
    if ((layer === 'temperature' && available(data, 'temperature')) || (layer === 'humidity' && available(data, 'humidity'))) {
      gl.uniform1i(this.uniforms.fieldMode, layer === 'temperature' ? 1 : 2);
      gl.uniform1f(this.uniforms.fieldValue, layer === 'temperature' ? (data.temperature - 18) / 16 : (data.humidity - 40) / 55);
      if (this.slice) this.renderBatch(this.slice);
      gl.uniform1i(this.uniforms.fieldMode, 0);
    }
    if (layer === 'airflow' && available(data, 'temperature') && available(data, 'humidity')) {
      const key = `${data.timestamp}/${data.temperature}/${data.humidity}`;
      if (key !== this.airflowKey) {
        if (this.airflow) this.releaseBatch(this.airflow);
        this.airflow = this.uploadDisplay(airflowGeometry(data.timestamp, data.temperature, clamp(data.humidity, 0, 100)));
        this.airflowKey = key;
      }
      if (this.airflow) this.renderBatch(this.airflow);
    }
  }

  private drawInset(ratio: number, width: number) {
    const gl = this.gl;
    const insetWidth = Math.round(142 * ratio), insetHeight = Math.round(188 * ratio);
    const x = width - insetWidth - Math.round(18 * ratio), y = Math.round(66 * ratio);
    gl.enable(gl.SCISSOR_TEST); gl.scissor(x, y, insetWidth, insetHeight); gl.viewport(x, y, insetWidth, insetHeight);
    gl.depthMask(true); gl.clearColor(...this.backgroundColor()); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.disable(gl.BLEND); gl.uniform1i(this.uniforms.fieldMode, 0); gl.uniform3fv(this.uniforms.origin, [0, 0, 0]);
    const scale = growthDisplay(this.snapshot.metrics, this.snapshot.crop, this.snapshot.data).scale[2];
    const matrix = multiply(perspective(insetWidth / insetHeight, .02, 20, this.fov), viewMatrix([0, 0, .82 * scale], 3.05 * scale, -.95, .13));
    gl.uniformMatrix4fv(this.uniforms.matrix, false, matrix);
    this.drawPlants(true, true);
    gl.disable(gl.SCISSOR_TEST);
  }

  private pan(dx: number, dy: number) {
    const { right, up } = cameraBasis(this.camera.azimuth, this.camera.elevation);
    const scale = 2 * this.camera.distance * Math.tan(this.fov / 2) / Math.max(1, this.canvas.clientHeight);
    this.camera.target = this.camera.target.map((v, i) => v - right[i] * dx * scale + up[i] * dy * scale) as Vec3;
  }

  private installInput() {
    const canvas = this.canvas, signal = this.abort.signal;
    canvas.addEventListener('pointerdown', event => {
      if (event.button > 2) return;
      canvas.focus({ preventScroll: true }); canvas.setPointerCapture(event.pointerId);
      this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY, pan: event.shiftKey || event.button !== 0 });
    }, { signal });
    canvas.addEventListener('pointermove', event => {
      const old = this.pointers.get(event.pointerId);
      if (!old) return;
      const previous = [...this.pointers.values()];
      this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY, pan: old.pan });
      if (this.pointers.size === 2) {
        const next = [...this.pointers.values()];
        const a = Math.hypot(previous[0].x - previous[1].x, previous[0].y - previous[1].y);
        const b = Math.hypot(next[0].x - next[1].x, next[0].y - next[1].y);
        if (a > 0 && b > 0) this.zoom(a / b);
        this.pan((next[0].x + next[1].x - previous[0].x - previous[1].x) / 2,
          (next[0].y + next[1].y - previous[0].y - previous[1].y) / 2);
      } else if (this.pointers.size === 1) {
        const dx = event.clientX - old.x, dy = event.clientY - old.y;
        if (old.pan || event.shiftKey) this.pan(dx, dy);
        else {
          this.camera.azimuth -= dx * .007;
          this.camera.elevation = clamp(this.camera.elevation + dy * .006, .045, 1.42);
        }
      }
      this.requestDraw();
    }, { signal });
    for (const name of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) {
      canvas.addEventListener(name, event => this.pointers.delete(event.pointerId), { signal });
    }
    canvas.addEventListener('contextmenu', event => event.preventDefault(), { signal });
    canvas.addEventListener('wheel', event => {
      event.preventDefault();
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? canvas.clientHeight : 1;
      this.zoom(Math.exp(clamp(event.deltaY * unit * .0012, -.5, .5)));
    }, { passive: false, signal });
    canvas.addEventListener('keydown', event => {
      if (event.key.toLowerCase() === 'r') this.reset();
      else if (event.key === '+' || event.key === '=') this.zoom(.88);
      else if (event.key === '-') this.zoom(1.12);
      else if (event.key === 'ArrowLeft') this.camera.azimuth += .08;
      else if (event.key === 'ArrowRight') this.camera.azimuth -= .08;
      else if (event.key === 'ArrowUp') this.camera.elevation = clamp(this.camera.elevation + .06, .045, 1.42);
      else if (event.key === 'ArrowDown') this.camera.elevation = clamp(this.camera.elevation - .06, .045, 1.42);
      else return;
      event.preventDefault(); this.requestDraw();
    }, { signal });
    canvas.addEventListener('webglcontextlost', event => {
      event.preventDefault(); this.lost = true;
      if (this.frame !== null) cancelAnimationFrame(this.frame);
      this.frame = null;
      this.callbacks.onError('그래픽 연결이 끊겼습니다. 다시 불러와 주세요.');
    }, { signal });
    canvas.addEventListener('webglcontextrestored', () => {
      this.callbacks.onError('그래픽 연결이 복구되었습니다. 다시 불러오기를 눌러 주세요.');
    }, { signal });
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.abort.abort(); this.observer?.disconnect(); this.themeObserver?.disconnect();
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    this.pointers.clear();
    for (const buffer of this.buffers) this.gl.deleteBuffer(buffer);
    for (const vao of this.vaos) this.gl.deleteVertexArray(vao);
    if (this.program) this.gl.deleteProgram(this.program);
    this.buffers.clear(); this.vaos.clear();
  }
}
