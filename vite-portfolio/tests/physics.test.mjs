import assert from "node:assert/strict";
import { test } from "node:test";
import { Vector3 } from "three";
import {
  BUOY_DENSITY, BuoyPhysics, GRAVITY, METRES_PER_UNIT, PHYSICS_STEP,
  WATER_DENSITY, submergedDiscFraction,
} from "../src/buoyPhysics.ts";
import {
  WATER_LEVEL, WAVES, WAVE_GLSL_CALLS, evaluateWaveSurface, sampleWater,
} from "../src/waves.ts";

const stillWater = (_x, _z, _time, out) => {
  out.height = WATER_LEVEL;
  out.normal.set(0, 1, 0);
  out.velocity.set(0, 0, 0);
  return out;
};
const advance = (body, seconds, frozen = true) => {
  for (let n = 0; n < Math.round(seconds / PHYSICS_STEP); n++) body.advance(PHYSICS_STEP, frozen);
};
const up = (body) => new Vector3(0, 0, 1).applyQuaternion(body.quaternion);
const bounds = { minX: -3, maxX: 3, minZ: -2, maxZ: 2 };

test("Gerstner inverse returns the rendered material point, normal and orbital velocity", () => {
  const h = 1e-5;
  for (let n = 0; n < 35; n++) {
    const u = -7 + n * 0.421, v = 3 - n * 0.283, time = n * 0.413;
    const surface = evaluateWaveSurface(u, v, time);
    const sample = sampleWater(surface.position.x, surface.position.z, time);
    assert.ok(Math.abs(sample.height - surface.height) < 1e-10);
    assert.ok(sample.normal.distanceTo(surface.normal) < 1e-10);
    assert.ok(Math.abs(sample.normal.length() - 1) < 1e-12);
    const velocity = evaluateWaveSurface(u, v, time + h).position
      .sub(evaluateWaveSurface(u, v, time - h).position).multiplyScalar(1 / (2 * h));
    assert.ok(velocity.distanceTo(sample.velocity) < 1e-8, "orbital velocity matches material derivative");
    const du = evaluateWaveSurface(u + h, v, time).position
      .sub(evaluateWaveSurface(u - h, v, time).position);
    const dv = evaluateWaveSurface(u, v + h, time).position
      .sub(evaluateWaveSurface(u, v - h, time).position);
    assert.ok(new Vector3().crossVectors(du, dv).normalize().distanceTo(sample.normal) < 1e-8);
  }
  assert.equal((WAVE_GLSL_CALLS.match(/gerstner\(/g) ?? []).length, WAVES.length);
});

test("circular segment covers dry, half, and fully submerged limits", () => {
  assert.equal(submergedDiscFraction(-2), 0);
  assert.equal(submergedDiscFraction(0), 0.5);
  assert.equal(submergedDiscFraction(2), 1);
  for (const t of [0.15, 0.45, 0.95]) {
    assert.ok(Math.abs(submergedDiscFraction(t) + submergedDiscFraction(-t) - 1) < 1e-12);
  }
});

test("fully submerged acceleration obeys Archimedes in metres and kilograms", () => {
  const body = new BuoyPhysics({ scale: 1.12, water: stillWater });
  body.position.y = WATER_LEVEL - 3;
  body.step(PHYSICS_STEP, 0);
  const expected = (WATER_DENSITY / BUOY_DENSITY - 1) * GRAVITY;
  const actual = body.velocity.y * METRES_PER_UNIT / PHYSICS_STEP;
  assert.ok(Math.abs(actual - expected) < 1e-9);
  assert.ok(Math.abs(body.submergedVolume - body.volume) < 1e-12);
});

test("both responsive sizes settle at density-ratio displacement without pose animation", () => {
  for (const scale of [0.72, 1.12]) {
    const body = new BuoyPhysics({ scale, water: stillWater });
    advance(body, 12);
    assert.ok(Math.abs(body.submergedVolume / body.volume - BUOY_DENSITY / WATER_DENSITY) < 0.001);
    assert.ok(body.velocity.length() < 0.004);
    assert.ok(up(body).y > 0.999);
    assert.equal(body.time, 0, "frozen equilibrium does not advance the ocean");
  }
});

test("a dropped and tilted ring splashes back to a stable floating state", () => {
  const body = new BuoyPhysics({ scale: 1.12, water: stillWater });
  const restingHeight = body.position.y;
  body.position.y += 2.5;
  body.quaternion.premultiply(body.quaternion.clone().setFromAxisAngle(new Vector3(0, 0, 1), 0.38));
  let lowest = body.position.y;
  let greatestImmersion = 0;
  for (let n = 0; n < 120 * 20; n++) {
    body.advance(PHYSICS_STEP, true);
    lowest = Math.min(lowest, body.position.y);
    greatestImmersion = Math.max(greatestImmersion, body.submergedVolume / body.volume);
  }
  assert.ok(lowest < restingHeight - 0.1, "drop pushes the ring deeper into the water before recovery");
  assert.ok(greatestImmersion > 2 * BUOY_DENSITY / WATER_DENSITY, "impact displaces more than twice the equilibrium water volume");
  assert.ok(body.position.y > WATER_LEVEL && body.position.y < WATER_LEVEL + 0.45);
  assert.ok(body.velocity.length() < 0.03);
  assert.ok(up(body).y > 0.995);
});

test("off-centre dragging applies torque; release retains then dissipates momentum", () => {
  const body = new BuoyPhysics({ scale: 1.12, water: stillWater });
  const start = body.position.clone();
  const grab = new Vector3(1.43 * body.scale, 0, 0).applyQuaternion(body.quaternion).add(body.position);
  const target = grab.clone().add(new Vector3(1.5, 0.55, 0.6));
  body.beginDrag(grab, target);
  assert.ok(body.position.equals(start), "grab does not teleport body");
  let lowestUp = 1, greatestAngularSpeed = 0;
  for (let n = 0; n < 60; n++) {
    body.advance(PHYSICS_STEP, true);
    lowestUp = Math.min(lowestUp, up(body).y);
    greatestAngularSpeed = Math.max(greatestAngularSpeed, body.angularVelocity.length());
  }
  assert.ok(body.position.distanceTo(start) > 0.08);
  assert.ok(lowestUp < 0.9998, "force at an offset produces measurable tilt despite hydrostatic restoring torque");
  assert.ok(greatestAngularSpeed > 0.03, "off-centre spring produces angular acceleration");
  body.endDrag();
  const speedAtRelease = body.velocity.length();
  const releasePosition = body.position.clone();
  assert.ok(speedAtRelease > 0.05);
  body.advance(PHYSICS_STEP, true);
  assert.ok(body.position.distanceTo(releasePosition) > 0.0001, "release preserves inertia");
  advance(body, 15);
  assert.ok(body.velocity.length() < speedAtRelease * 0.1);
  assert.ok(up(body).y > 0.99, "hydrostatic torque restores face-up floating");
  assert.ok(body.position.distanceTo(start) > 0.1, "release does not reset authored position");
});

test("fixed accumulator gives identical dynamics for 30, 60 and 120 Hz frames", () => {
  const bodies = [30, 60, 120].map((fps) => {
    const body = new BuoyPhysics({ scale: 1.12, bounds });
    for (let n = 0; n < fps * 4; n++) body.advance(1 / fps);
    return body;
  });
  for (const body of bodies.slice(1)) {
    assert.ok(body.position.distanceTo(bodies[0].position) < 1e-12);
    assert.ok(body.velocity.distanceTo(bodies[0].velocity) < 1e-12);
    assert.ok(1 - Math.abs(body.quaternion.dot(bodies[0].quaternion)) < 1e-12);
    assert.ok(Math.abs(body.time - 4) < 1e-10);
  }
});

test("long wave run and bounded extreme dragging keep finite normalized state", () => {
  for (const scale of [0.72, 1.12]) {
    const body = new BuoyPhysics({ scale, bounds });
    for (let n = 0; n < 120 * 35; n++) {
      if (n === 120) body.beginDrag(body.position.clone().add(new Vector3(scale, 0, 0)), new Vector3(8, 0, -5));
      if (n === 180) body.endDrag();
      body.advance(PHYSICS_STEP);
      const state = [...body.position, ...body.velocity, ...body.angularVelocity, ...body.quaternion];
      assert.ok(state.every(Number.isFinite));
      assert.ok(Math.abs(body.quaternion.length() - 1) < 1e-10);
      assert.ok(body.position.y > WATER_LEVEL - 3 && body.position.y < WATER_LEVEL + 5);
    }
    assert.ok(body.position.x > bounds.minX - 1 && body.position.x < bounds.maxX + 1);
    assert.ok(body.position.z > bounds.minZ - 1 && body.position.z < bounds.maxZ + 1);
  }
});
