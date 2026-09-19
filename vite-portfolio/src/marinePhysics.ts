import { METRES_PER_UNIT, WATER_LEVEL } from './waterScale.ts';

export type MarineVector = { x: number; y: number; z: number };
export type MarineHabitat = {
  id: number;
  centre: MarineVector;
  extent: MarineVector;
  count: number;
  kind: 'silver' | 'lantern';
};
export type MarineBody = {
  position: MarineVector;
  velocity: MarineVector;
  phase: number;
  scale: number;
};
export type MarineSchool = { habitat: MarineHabitat; bodies: MarineBody[] };
export type MarineSimulation = { schools: MarineSchool[]; step: number };

// All distances are world-space units. One unit is 25 cm, including habitats
// and velocities; camera movement and viewport size are deliberately absent.
export const MARINE_TIME_STEP = 1 / 30;
export const marineHash = (n: number) => {
  const value = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return value - Math.floor(value);
};

export function marineHabitats(): MarineHabitat[] {
  const habitats: MarineHabitat[] = [];
  for (let id = 0; id < 7; id++) {
    const metres = 6 + id * 6;
    habitats.push({
      id,
      centre: {
        x: Math.sin(id * 2.4) * 10,
        y: WATER_LEVEL - metres / METRES_PER_UNIT,
        z: -17 - marineHash(id + 45) * 14,
      },
      extent: { x: 15, y: 23, z: 12 },
      count: 24,
      kind: 'silver',
    });
  }
  // A few distant schools make the volume extend beyond the descent corridor.
  for (const [id, metres] of [12, 24, 36].entries()) {
    habitats.push({
      id: id + 100,
      centre: { x: id % 2 ? -35 : 35, y: WATER_LEVEL - metres / METRES_PER_UNIT, z: -64 },
      extent: { x: 18, y: 20, z: 14 },
      count: 16,
      kind: 'silver',
    });
  }
  return habitats;
}

export function createMarineSimulation(habitats: MarineHabitat[] = marineHabitats()): MarineSimulation {
  return {
    step: 0,
    schools: habitats.map(habitat => ({
      habitat,
      bodies: Array.from({ length: habitat.count }, (_, i) => {
        const seed = habitat.id * 137 + i * 3;
        const phase = marineHash(seed + 400) * Math.PI * 2;
        return {
          position: {
            x: habitat.centre.x + (marineHash(seed + 12) - .5) * habitat.extent.x * 1.2,
            y: habitat.centre.y + (marineHash(seed + 38) - .5) * habitat.extent.y * 1.2,
            z: habitat.centre.z + (marineHash(seed + 91) - .5) * habitat.extent.z * 1.2,
          },
          velocity: { x: Math.cos(phase) * 1.1, y: 0, z: Math.sin(phase) * 1.1 },
          phase,
          scale: habitat.kind === 'silver' ? .45 + marineHash(seed + 74) * .43 : .32 + marineHash(seed + 74) * .25,
        };
      }),
    })),
  };
}

function integrateSchool(school: MarineSchool, seconds: number) {
  const { bodies, habitat } = school;
  const seed = habitat.id * .81;
  // Slow current and a school swimming heading act in the same water volume
  // irrespective of where the observer happens to be looking.
  const heading = seconds * .105 + seed;
  const currentX = Math.sin(seconds * .07 + habitat.centre.y * .006) * .34;
  const currentZ = Math.cos(seconds * .09 + habitat.centre.y * .004) * .26;
  const forces: MarineVector[] = [];
  for (let i = 0; i < bodies.length; i++) {
    const body = bodies[i], p = body.position, velocity = body.velocity;
    let sx = 0, sy = 0, sz = 0, vx = 0, vy = 0, vz = 0, px = 0, py = 0, pz = 0, neighbours = 0;
    for (let j = 0; j < bodies.length; j++) {
      if (i === j) continue;
      const other = bodies[j], q = other.position;
      const dx = p.x - q.x, dy = p.y - q.y, dz = p.z - q.z;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 < 12.25 && d2 > 1e-8) {
        // Separation is bounded even during a very close encounter.
        const strength = Math.min(3, 3.5 / Math.sqrt(d2) - 1) / Math.sqrt(d2);
        sx += dx * strength; sy += dy * strength; sz += dz * strength;
      }
      if (d2 < 144) {
        vx += other.velocity.x; vy += other.velocity.y; vz += other.velocity.z;
        px += q.x; py += q.y; pz += q.z;
        neighbours++;
      }
    }
    let fx = sx * 1.7, fy = sy * 1.7, fz = sz * 1.7;
    if (neighbours) {
      fx += (vx / neighbours - velocity.x) * .45 + (px / neighbours - p.x) * .042;
      fy += (vy / neighbours - velocity.y) * .45 + (py / neighbours - p.y) * .035;
      fz += (vz / neighbours - velocity.z) * .45 + (pz / neighbours - p.z) * .042;
    }
    // Propulsion toward a slowly turning heading, linear drag relative to the
    // local water current, and neutral-buoyancy restoration around the habitat.
    fx += Math.cos(heading) * .72 - (velocity.x - currentX) * .31;
    fz += Math.sin(heading) * .72 - (velocity.z - currentZ) * .31;
    fy += Math.sin(seconds * .28 + body.phase) * .10 - velocity.y * .44;
    const offsets = {
      x: p.x - habitat.centre.x,
      y: p.y - habitat.centre.y - Math.sin(seconds * .12 + seed) * 2.5,
      z: p.z - habitat.centre.z,
    };
    const boundary = (offset: number, extent: number) =>
      -offset * .042 - Math.sign(offset) * Math.pow(Math.max(0, Math.abs(offset) - extent * .65), 2) * .16;
    fx += boundary(offsets.x, habitat.extent.x);
    fy += boundary(offsets.y, habitat.extent.y) * 1.35;
    fz += boundary(offsets.z, habitat.extent.z);
    forces.push({ x: fx, y: fy, z: fz });
  }
  // Integrate only after every force has read the same previous-step state.
  for (let i = 0; i < bodies.length; i++) {
    const { position, velocity } = bodies[i], force = forces[i];
    velocity.x += force.x * MARINE_TIME_STEP;
    velocity.y += force.y * MARINE_TIME_STEP;
    velocity.z += force.z * MARINE_TIME_STEP;
    const speed = Math.hypot(velocity.x, velocity.y, velocity.z);
    const limit = habitat.kind === 'silver' ? 3.2 : 2.4;
    if (speed > limit) {
      velocity.x *= limit / speed; velocity.y *= limit / speed; velocity.z *= limit / speed;
    }
    position.x += velocity.x * MARINE_TIME_STEP;
    position.y += velocity.y * MARINE_TIME_STEP;
    position.z += velocity.z * MARINE_TIME_STEP;
  }
}

/** Advance to absolute simulation time. Repeated times are exact no-ops. */
export function advanceMarineSimulation(simulation: MarineSimulation, seconds: number) {
  if (!Number.isFinite(seconds)) return;
  const target = Math.max(0, Math.floor(seconds / MARINE_TIME_STEP + 1e-7));
  while (simulation.step < target) {
    simulation.step++;
    const time = simulation.step * MARINE_TIME_STEP;
    simulation.schools.forEach(school => integrateSchool(school, time));
  }
}
