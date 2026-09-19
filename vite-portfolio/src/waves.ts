import { Vector3 } from "three";

import { WATER_LEVEL, METRES_PER_UNIT } from "./waterScale.ts";
export { WATER_LEVEL, METRES_PER_UNIT };
export const GRAVITY = 9.81;

// The GPU and CPU consume this single set of wave parameters. Plane-local XY
// becomes world X/-Z when the water plane rotates -PI/2 around X.
export const WAVES = [
  { direction: [1, 0.35], wavelength: 8.2, steepness: 0.26, phase: 0.2 },
  { direction: [0.75, -0.65], wavelength: 4.6, steepness: 0.2, phase: 2.4 },
  { direction: [-0.3, 1], wavelength: 2.8, steepness: 0.13, phase: 1.1 },
  { direction: [0.9, 0.5], wavelength: 1.65, steepness: 0.07, phase: 4.7 },
  { direction: [-0.65, 0.8], wavelength: 1.05, steepness: 0.035, phase: 3 },
] as const;

const waves = WAVES.map(({ direction: [x, y], wavelength, steepness, phase }) => {
  const length = Math.hypot(x, y);
  const k = 2 * Math.PI / wavelength;
  return { x: x / length, y: y / length, k, amplitude: steepness / k,
    steepness, phase, omega: Math.sqrt(GRAVITY * k / METRES_PER_UNIT) };
});
const glslFloat = (value: number) => Number.isInteger(value) ? `${value}.0` : `${value}`;

export const WAVE_GLSL = `
void gerstner(vec2 at, vec2 direction, float wavelength,
  float steepness, float phase, inout vec3 p,
  inout vec3 tangent, inout vec3 binormal) {
  vec2 d = normalize(direction);
  float k = ${2 * Math.PI} / wavelength;
  float omega = sqrt(${GRAVITY} * k / ${METRES_PER_UNIT});
  float f = k * dot(d, at) - omega * uTime + phase;
  float s = sin(f);
  float c = cos(f);
  float amplitude = steepness / k;
  p += vec3(d * amplitude * c, amplitude * s);
  tangent += vec3(-d * d.x * steepness * s, d.x * steepness * c);
  binormal += vec3(-d * d.y * steepness * s, d.y * steepness * c);
}`;

export const WAVE_GLSL_CALLS = WAVES.map((w) =>
  `gerstner(position.xy, vec2(${w.direction.map(glslFloat).join(", ")}), ${glslFloat(w.wavelength)}, ${glslFloat(w.steepness)}, ${glslFloat(w.phase)}, p, tangent, binormal);`,
).join("\n");

export interface WaterSample {
  height: number;
  normal: Vector3;
  /** Material/orbital water velocity, in scene units per second. */
  velocity: Vector3;
}

export function createWaterSample(): WaterSample {
  return { height: WATER_LEVEL, normal: new Vector3(0, 1, 0), velocity: new Vector3() };
}

export interface WaveSurface extends WaterSample {
  /** Displaced world position for an undisturbed plane-local material point. */
  position: Vector3;
}

export function evaluateWaveSurface(u: number, v: number, time: number,
  out: WaveSurface = { ...createWaterSample(), position: new Vector3() }): WaveSurface {
  let x = u, y = v, height = 0;
  let xu = 1, xv = 0, yu = 0, yv = 1, hu = 0, hv = 0;
  let vx = 0, vy = 0, vh = 0;
  for (const wave of waves) {
    const f = wave.k * (wave.x * u + wave.y * v) - wave.omega * time + wave.phase;
    const s = Math.sin(f), c = Math.cos(f);
    x += wave.x * wave.amplitude * c;
    y += wave.y * wave.amplitude * c;
    height += wave.amplitude * s;
    xu -= wave.x * wave.x * wave.steepness * s;
    xv -= wave.x * wave.y * wave.steepness * s;
    yu -= wave.y * wave.x * wave.steepness * s;
    yv -= wave.y * wave.y * wave.steepness * s;
    hu += wave.x * wave.steepness * c;
    hv += wave.y * wave.steepness * c;
    vx += wave.x * wave.amplitude * wave.omega * s;
    vy += wave.y * wave.amplitude * wave.omega * s;
    vh -= wave.amplitude * wave.omega * c;
  }
  out.height = WATER_LEVEL + height;
  out.position.set(x, out.height, -y);
  // Cross the parametric derivatives in local coordinates, then rotate to world.
  out.normal.set(yu * hv - hu * yv, xu * yv - yu * xv, xu * hv - hu * xv).normalize();
  out.velocity.set(vx, vh, -vy);
  return out;
}

const surfaceScratch: WaveSurface = { ...createWaterSample(), position: new Vector3() };

/** Invert horizontal displacement: a vertex parameter is not its world X/Z. */
export function sampleWater(x: number, z: number, time: number,
  out: WaterSample = createWaterSample()): WaterSample {
  let u = x, v = -z;
  for (let iteration = 0; iteration < 7; iteration++) {
    let dx = u - x, dy = v + z;
    let j00 = 1, j01 = 0, j11 = 1;
    for (const wave of waves) {
      const f = wave.k * (wave.x * u + wave.y * v) - wave.omega * time + wave.phase;
      const s = Math.sin(f), c = Math.cos(f);
      dx += wave.x * wave.amplitude * c;
      dy += wave.y * wave.amplitude * c;
      j00 -= wave.x * wave.x * wave.steepness * s;
      j01 -= wave.x * wave.y * wave.steepness * s;
      j11 -= wave.y * wave.y * wave.steepness * s;
    }
    const inverseDet = 1 / (j00 * j11 - j01 * j01);
    u -= (j11 * dx - j01 * dy) * inverseDet;
    v -= (j00 * dy - j01 * dx) * inverseDet;
    if (dx * dx + dy * dy < 1e-16) break;
  }
  evaluateWaveSurface(u, v, time, surfaceScratch);
  out.height = surfaceScratch.height;
  out.normal.copy(surfaceScratch.normal);
  out.velocity.copy(surfaceScratch.velocity);
  return out;
}
