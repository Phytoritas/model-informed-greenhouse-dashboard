import { cross, normalize, sub, type Vec3 } from './sceneMath';

export interface DisplayGeometry { vertices: Float32Array; indices: Uint32Array; group: string }

class GeometryBuilder {
  vertices: number[] = [];
  indices: number[] = [];

  triangle(a: Vec3, b: Vec3, c: Vec3) {
    const normal = normalize(cross(sub(b, a), sub(c, a)));
    const start = this.vertices.length / 6;
    for (const p of [a, b, c]) this.vertices.push(...p, ...normal);
    this.indices.push(start, start + 1, start + 2);
  }

  tube(a: Vec3, b: Vec3, radius: number, segments = 7) {
    const axis = normalize(sub(b, a));
    const side = normalize(cross(axis, Math.abs(axis[2]) > .9 ? [1, 0, 0] : [0, 0, 1]));
    const up = cross(axis, side);
    const p = (origin: Vec3, angle: number): Vec3 => origin.map((v, i) =>
      v + radius * (side[i] * Math.cos(angle) + up[i] * Math.sin(angle))) as Vec3;
    for (let i = 0; i < segments; i++) {
      const t = i * Math.PI * 2 / segments, u = (i + 1) * Math.PI * 2 / segments;
      this.triangle(p(a, t), p(a, u), p(b, u));
      this.triangle(p(a, t), p(b, u), p(b, t));
    }
  }

  ellipsoid(center: Vec3, radius: Vec3, rings = 10, segments = 12) {
    const p = (r: number, s: number): Vec3 => {
      const phi = r * Math.PI / rings, theta = s * Math.PI * 2 / segments;
      return [center[0] + radius[0] * Math.sin(phi) * Math.cos(theta),
        center[1] + radius[1] * Math.sin(phi) * Math.sin(theta), center[2] + radius[2] * Math.cos(phi)];
    };
    for (let r = 0; r < rings; r++) for (let s = 0; s < segments; s++) {
      if (r > 0) this.triangle(p(r, s), p(r + 1, s), p(r, s + 1));
      if (r < rings - 1) this.triangle(p(r, s + 1), p(r + 1, s), p(r + 1, s + 1));
    }
  }

  finish(group: string): DisplayGeometry {
    return { vertices: new Float32Array(this.vertices), indices: new Uint32Array(this.indices), group };
  }
}

/** Distinct conceptual cucumber: broad lobed leaves and elongated hanging fruit.
 * No measured cucumber mesh exists in the approved source. This is display-only.
 */
export function cucumberGeometry(): DisplayGeometry[] {
  const leaf = new GeometryBuilder(), stem = new GeometryBuilder(), fruit = new GeometryBuilder();
  const outline = [[0, 0], [-.38, .12], [-.85, .45], [-.95, .8], [-.55, .92], [-.45, 1.25],
    [0, 1.48], [.45, 1.25], [.55, .92], [.95, .8], [.85, .45], [.38, .12]];
  const stemAt = (height: number): Vec3 => [.014 * Math.sin(height * 5), .01 * Math.cos(height * 5), height];
  for (let node = 0; node < 14; node++) {
    const height = .1 + node * .11, a = stemAt(height), b = stemAt(height + .11);
    stem.tube(a, b, .006 - node * .0002);
    const angle = node * 2.4;
    const forward: Vec3 = [Math.cos(angle), Math.sin(angle), -.25];
    const side: Vec3 = [-Math.sin(angle), Math.cos(angle), 0];
    const attachment = a.map((v, i) => v + forward[i] * .09) as Vec3;
    stem.tube(a, attachment, .0026, 5);
    const size = .2 * (1 - .46 * node / 14);
    const point = (x: number, y: number): Vec3 => attachment.map((v, i) =>
      v + size * (side[i] * x + forward[i] * y) + (i === 2 ? .027 * (1 - Math.abs(x)) * Math.sin(y * 2) : 0)) as Vec3;
    const mid = point(0, .68);
    for (let i = 0; i < outline.length; i++) {
      const a2 = outline[i], b2 = outline[(i + 1) % outline.length];
      leaf.triangle(mid, point(a2[0], a2[1]), point(b2[0], b2[1]));
    }
    stem.tube(attachment, point(0, 1.4), .0011, 4);
    if (node > 1 && node < 10 && node % 2 === 0) {
      const center: Vec3 = [a[0] + Math.cos(angle + .6) * .06, a[1] + Math.sin(angle + .6) * .06, height - .12];
      stem.tube(a, [center[0], center[1], center[2] + .1], .0024, 5);
      fruit.ellipsoid(center, [.026, .027, .145]);
    }
  }
  return [leaf.finish('plant_leaf'), stem.finish('plant_stem'), fruit.finish('cucumber_fruit')];
}

export function sunGeometry(): DisplayGeometry {
  const builder = new GeometryBuilder();
  builder.ellipsoid([0, 0, 0], [.7, .7, .7], 10, 16);
  return builder.finish('sun');
}

/** Rows lie only in the source research strip (Y .295..16.295 m).
 * First instance preserves the source plant origin. Remaining placements are illustrative.
 */
export function plantInstances(sourceOrigin: Vec3) {
  const result = [...sourceOrigin, 0];
  for (let row = 0; row < 24; row++) for (let column = 0; column < 11; column++) {
    const x = 1.1 + row * 1.61, y = 1.25 + column * 1.34;
    if (Math.hypot(x - sourceOrigin[0], y - sourceOrigin[1]) < .8) continue;
    result.push(x, y, 0, (row % 2) * Math.PI + (column % 3) * .16);
  }
  return new Float32Array(result);
}

export function rowBeds() {
  const builder = new GeometryBuilder();
  for (let row = 0; row < 24; row++) {
    const x = 1.1 + row * 1.61;
    const a: Vec3 = [x - .22, .9, .018], b: Vec3 = [x + .22, .9, .018];
    const c: Vec3 = [x + .22, 15, .018], d: Vec3 = [x - .22, 15, .018];
    builder.triangle(a, b, c); builder.triangle(a, c, d);
  }
  return builder.finish('beds');
}

export function fieldSlice() {
  const builder = new GeometryBuilder();
  for (let x = 0; x < 40; x++) for (let z = 0; z < 10; z++) {
    const a: Vec3 = [.195 + x, 8.295, .25 + z * .5], b: Vec3 = [1.195 + x, 8.295, .25 + z * .5];
    const c: Vec3 = [b[0], 8.295, a[2] + .5], d: Vec3 = [a[0], 8.295, a[2] + .5];
    builder.triangle(a, b, c); builder.triangle(a, c, d);
  }
  return builder.finish('field');
}

/** Deterministic illustrative streamlines. No velocity units or CFD claims. */
export function airflowGeometry(timestamp: number, temperature: number, humidity: number): DisplayGeometry {
  const builder = new GeometryBuilder();
  const phase = ((Math.floor(timestamp / 60_000) % 60) / 60) * Math.PI * 2;
  const bend = .4 + Math.max(0, Math.min(1.6, (temperature - 15) / 14));
  for (let row = 0; row < 6; row++) for (let height = 0; height < 2; height++) {
    const points: Vec3[] = [];
    const span = 19 + (humidity / 100) * 2;
    for (let i = 0; i <= 32; i++) {
      const t = i / 32;
      points.push([3 + row * 6.5 + Math.sin(t * 3.1 + phase + row) * .45,
        -2 + t * span, 1.2 + height * 1.8 + bend * t * t]);
    }
    for (let i = 1; i < points.length; i++) builder.tube(points[i - 1], points[i], .035, 4);
    for (const index of [12, 25]) {
      const tip = points[index], previous = points[index - 1];
      const direction = normalize(sub(tip, previous)), side = normalize(cross(direction, [0, 0, 1]));
      const left = tip.map((v, i) => v - direction[i] * .65 + side[i] * .3) as Vec3;
      const right = tip.map((v, i) => v - direction[i] * .65 - side[i] * .3) as Vec3;
      builder.triangle(tip, left, right);
    }
  }
  return builder.finish('airflow');
}
