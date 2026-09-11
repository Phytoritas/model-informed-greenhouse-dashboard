export type Vec3 = [number, number, number];
export type Bounds = { min: Vec3; max: Vec3 };

export const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));
export const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const center = (bounds: Bounds): Vec3 => bounds.min.map((v, i) => (v + bounds.max[i]) / 2) as Vec3;
export const normalize = (v: Vec3): Vec3 => {
  const length = Math.hypot(...v);
  return length ? v.map(n => n / length) as Vec3 : [0, 0, 1];
};

export function multiply(a: Float32Array, b: Float32Array) {
  const result = new Float32Array(16);
  for (let col = 0; col < 4; col++) {
    for (let row = 0; row < 4; row++) {
      result[col * 4 + row] = a[row] * b[col * 4] + a[4 + row] * b[col * 4 + 1]
        + a[8 + row] * b[col * 4 + 2] + a[12 + row] * b[col * 4 + 3];
    }
  }
  return result;
}

export function perspective(aspect: number, near: number, far: number, fov: number) {
  const f = 1 / Math.tan(fov / 2), range = 1 / (near - far);
  return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (near + far) * range, -1, 0, 0, 2 * near * far * range, 0]);
}

export function cameraBasis(azimuth: number, elevation: number) {
  const c = Math.cos(elevation);
  const back: Vec3 = [c * Math.cos(azimuth), c * Math.sin(azimuth), Math.sin(elevation)];
  const right: Vec3 = [-Math.sin(azimuth), Math.cos(azimuth), 0];
  return { back, right, up: cross(back, right) };
}

export function viewMatrix(target: Vec3, distance: number, azimuth: number, elevation: number) {
  const { back, right, up } = cameraBasis(azimuth, elevation);
  const eye = target.map((v, i) => v + back[i] * distance) as Vec3;
  return new Float32Array([right[0], up[0], back[0], 0, right[1], up[1], back[1], 0,
    right[2], up[2], back[2], 0, -dot(right, eye), -dot(up, eye), -dot(back, eye), 1]);
}

export function project(point: Vec3, matrix: Float32Array, width: number, height: number) {
  const clip = [0, 1, 2, 3].map(row => matrix[row] * point[0] + matrix[4 + row] * point[1]
    + matrix[8 + row] * point[2] + matrix[12 + row]);
  const x = clip[0] / clip[3], y = clip[1] / clip[3];
  return { x: (x * .5 + .5) * width, y: (-y * .5 + .5) * height,
    visible: clip[3] > 0 && Math.abs(x) < .94 && Math.abs(y) < .9 };
}

export interface SiteLocation { name: string; latitude: number; longitude: number; utcOffsetHours: number }
export interface SunPosition { direction: Vec3; elevation: number; azimuth: number; aboveHorizon: boolean }

/**
 * Geometric solar position, not irradiance or measured sun angles.
 * NOAA general solar equations: https://gml.noaa.gov/grad/solcalc/solareqns.PDF
 * The site comes from twin-studio's compute_knu_solar_position.py. We preserve
 * its east-positive ENU convention and explicit KST clock; this browser
 * approximation does not claim to execute its native PyHelios adapter.
 */
export function solarPosition(timestamp: number, site: SiteLocation): SunPosition | null {
  if (!Number.isFinite(timestamp) || timestamp <= 0) return null;
  const civil = new Date(timestamp + site.utcOffsetHours * 3_600_000);
  if (!Number.isFinite(civil.getTime())) return null;
  const year = civil.getUTCFullYear();
  if (year < 1900 || year > 3000) return null;
  const day = Math.floor((Date.UTC(year, civil.getUTCMonth(), civil.getUTCDate()) - Date.UTC(year, 0, 1)) / 86_400_000) + 1;
  const days = (Date.UTC(year + 1, 0, 1) - Date.UTC(year, 0, 1)) / 86_400_000;
  const hours = civil.getUTCHours() + civil.getUTCMinutes() / 60;
  const gamma = 2 * Math.PI / days * (day - 1 + (hours - 12) / 24);
  const equation = 229.18 * (.000075 + .001868 * Math.cos(gamma) - .032077 * Math.sin(gamma)
    - .014615 * Math.cos(2 * gamma) - .040849 * Math.sin(2 * gamma));
  const declination = .006918 - .399912 * Math.cos(gamma) + .070257 * Math.sin(gamma)
    - .006758 * Math.cos(2 * gamma) + .000907 * Math.sin(2 * gamma)
    - .002697 * Math.cos(3 * gamma) + .00148 * Math.sin(3 * gamma);
  const angle = (hours * 60 + equation + 4 * site.longitude - 60 * site.utcOffsetHours) / 4 - 180;
  const hourAngle = angle * Math.PI / 180, latitude = site.latitude * Math.PI / 180;
  const direction = normalize([
    -Math.cos(declination) * Math.sin(hourAngle),
    Math.cos(latitude) * Math.sin(declination) - Math.sin(latitude) * Math.cos(declination) * Math.cos(hourAngle),
    Math.sin(latitude) * Math.sin(declination) + Math.cos(latitude) * Math.cos(declination) * Math.cos(hourAngle),
  ]);
  return { direction, elevation: Math.asin(clamp(direction[2], -1, 1)) * 180 / Math.PI,
    azimuth: (Math.atan2(direction[0], direction[1]) * 180 / Math.PI + 360) % 360,
    aboveHorizon: direction[2] > 0 };
}
