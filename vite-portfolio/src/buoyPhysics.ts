import { Quaternion, Vector3 } from "three";
import { createWaterSample, GRAVITY, METRES_PER_UNIT, sampleWater, type WaterSample } from "./waves.ts";

export { GRAVITY, METRES_PER_UNIT } from "./waves.ts";
export const PHYSICS_STEP = 1 / 120;
export const WATER_DENSITY = 1000;
export const BUOY_DENSITY = 110;
const RADIUS = 1.43;
const TUBE = 0.395;
const SQUASH = 0.82;
const SECTIONS = 32;

export interface BuoyBounds { minX: number; maxX: number; minZ: number; maxZ: number }
export interface BuoyOptions {
  scale?: number;
  x?: number;
  z?: number;
  bounds?: BuoyBounds;
  /** Injection supports still-water verification without a second solver. */
  water?: typeof sampleWater;
}

/** Circular segment area below a waterline t, normalized by its full area. */
export function submergedDiscFraction(t: number): number {
  if (t <= -1) return 0;
  if (t >= 1) return 1;
  return 0.5 + (Math.asin(t) + t * Math.sqrt(1 - t * t)) / Math.PI;
}

/** A force-driven rigid body; position/velocity use scene units, angular velocity rad/s. */
export class BuoyPhysics {
  readonly position = new Vector3();
  readonly quaternion = new Quaternion();
  readonly velocity = new Vector3();
  readonly angularVelocity = new Vector3();
  readonly inertia = new Vector3();
  mass = 1;
  volume = 1;
  scale = 1;
  submergedVolume = 0;
  private water: typeof sampleWater;
  private bounds?: BuoyBounds;
  private clock = 0;
  private accumulator = 0;
  private dragging = false;
  private grabLocal = new Vector3();
  private target = new Vector3();
  private waterSample: WaterSample = createWaterSample();
  private force = new Vector3();
  private torque = new Vector3();
  private radial = new Vector3();
  private faceNormal = new Vector3();
  private offset = new Vector3();
  private wetOffset = new Vector3();
  private point = new Vector3();
  private relative = new Vector3();
  private sampleForce = new Vector3();
  private scratch = new Vector3();
  private bodyOmega = new Vector3();
  private bodyTorque = new Vector3();
  private angularMomentum = new Vector3();
  private inverseRotation = new Quaternion();
  private rotationStep = new Quaternion();

  constructor(options: BuoyOptions = {}) {
    this.water = options.water ?? sampleWater;
    this.bounds = options.bounds;
    this.reset(options);
  }

  get time(): number { return this.clock; }
  get isDragging(): boolean { return this.dragging; }

  setBounds(bounds: BuoyBounds): void { this.bounds = bounds; }

  reset(options: Pick<BuoyOptions, "scale" | "x" | "z"> = {}): void {
    this.scale = options.scale ?? this.scale;
    const metres = this.scale * METRES_PER_UNIT;
    const r = RADIUS * metres, a = TUBE * metres, b = a * SQUASH;
    this.volume = 2 * Math.PI ** 2 * r * a * b;
    this.mass = BUOY_DENSITY * this.volume;
    this.inertia.set(
      this.mass * (0.5 * r * r + 0.375 * a * a + 0.25 * b * b),
      this.mass * (0.5 * r * r + 0.375 * a * a + 0.25 * b * b),
      this.mass * (r * r + 0.75 * a * a),
    );
    this.position.set(options.x ?? this.position.x, 0, options.z ?? this.position.z);
    this.water(this.position.x, this.position.z, this.clock, this.waterSample);
    this.position.y = this.waterSample.height + TUBE * SQUASH * this.scale * 0.68;
    this.quaternion.setFromAxisAngle(this.scratch.set(1, 0, 0), -Math.PI / 2);
    this.velocity.set(0, 0, 0);
    this.angularVelocity.set(0, 0, 0);
    this.dragging = false;
    this.accumulator = 0;
    // Let Archimedes and its restoring moment find the local resting pose. The
    // frozen initial water has no orbital velocity and its time never advances.
    for (let i = 0; i < 180; i++) this.integrate(PHYSICS_STEP, true);
    this.velocity.set(0, 0, 0);
    this.angularVelocity.set(0, 0, 0);
  }

  beginDrag(worldGrab: Vector3, worldTarget: Vector3): void {
    this.inverseRotation.copy(this.quaternion).invert();
    this.grabLocal.copy(worldGrab).sub(this.position).applyQuaternion(this.inverseRotation);
    this.target.copy(worldTarget);
    this.dragging = true;
  }

  updateDrag(worldTarget: Vector3): void { this.target.copy(worldTarget); }
  endDrag(): void { this.dragging = false; }

  /** Fixed 120 Hz integration. Frozen waves still permit deliberate interaction. */
  advance(frameDt: number, freezeWaves = false): void {
    if (!Number.isFinite(frameDt) || frameDt <= 0) return;
    // Avoid a backlog after a hidden/background tab; normal frames preserve time.
    this.accumulator += Math.min(frameDt, 0.25);
    while (this.accumulator + 1e-12 >= PHYSICS_STEP) {
      this.integrate(PHYSICS_STEP, freezeWaves);
      if (!freezeWaves) this.clock += PHYSICS_STEP;
      this.accumulator -= PHYSICS_STEP;
    }
  }

  /** Integrate one caller-owned timestep. Optional time sets the wave phase. */
  step(dt: number = PHYSICS_STEP, time?: number): void {
    if (!Number.isFinite(dt) || dt <= 0) return;
    if (time !== undefined) this.clock = time;
    this.integrate(dt, false);
    this.clock += dt;
  }

  private addForce(force: Vector3, leverMetres: Vector3): void {
    this.force.add(force);
    this.torque.add(this.scratch.crossVectors(leverMetres, force));
  }

  private integrate(dt: number, freezeWaves: boolean): void {
    this.force.set(0, -this.mass * GRAVITY, 0);
    this.torque.set(0, 0, 0);
    this.submergedVolume = 0;
    this.faceNormal.set(0, 0, 1).applyQuaternion(this.quaternion);
    const radius = RADIUS * this.scale;
    const tube = TUBE * this.scale;
    const sectionVolume = this.volume / SECTIONS;
    const sectionArea = 2 * tube * (2 * Math.PI * radius / SECTIONS) * METRES_PER_UNIT ** 2;

    for (let i = 0; i < SECTIONS; i++) {
      const angle = i * 2 * Math.PI / SECTIONS;
      this.radial.set(Math.cos(angle), Math.sin(angle), 0).applyQuaternion(this.quaternion);
      this.offset.copy(this.radial).multiplyScalar(radius);
      this.point.copy(this.position).add(this.offset);
      this.water(this.point.x, this.point.z, this.clock, this.waterSample);
      // Locally tangent water plane cuts an elliptical cross section. Its exact
      // segment area and centroid vary continuously through the waterline.
      const radialProjection = this.radial.dot(this.waterSample.normal);
      const axialProjection = this.faceNormal.dot(this.waterSample.normal) * SQUASH;
      const projection = Math.max(1e-5, Math.hypot(radialProjection, axialProjection));
      const depth = (this.waterSample.height - this.point.y) * this.waterSample.normal.y;
      const t = depth / (tube * projection);
      const fraction = submergedDiscFraction(t);
      if (fraction === 0) continue;
      const displaced = sectionVolume * fraction;
      this.submergedVolume += displaced;
      const centroid = Math.abs(t) < 1
        ? -2 * (1 - t * t) ** 1.5 / (3 * Math.PI * fraction) : 0;
      this.wetOffset.copy(this.offset)
        .addScaledVector(this.radial, tube * radialProjection / projection * centroid)
        .addScaledVector(this.faceNormal, tube * SQUASH * axialProjection / projection * centroid)
        .multiplyScalar(METRES_PER_UNIT);
      this.sampleForce.set(0, WATER_DENSITY * GRAVITY * displaced, 0);
      this.addForce(this.sampleForce, this.wetOffset);

      // Velocity at the application point: v + omega cross r. Water velocity is
      // the Gerstner material velocity, not the surface height's time derivative.
      this.relative.crossVectors(this.angularVelocity, this.wetOffset)
        .addScaledVector(this.velocity, METRES_PER_UNIT);
      if (!freezeWaves) this.relative.addScaledVector(this.waterSample.velocity, -METRES_PER_UNIT);
      const speed = this.relative.length();
      const wettedArea = sectionArea * Math.pow(fraction, 2 / 3);
      const drag = 0.5 * WATER_DENSITY * 1.05 * wettedArea * speed;
      // Small linear radiation/viscous damping makes the zero-speed limit settle.
      const linearDamping = this.mass * 4 / SECTIONS * Math.pow(fraction, 2 / 3);
      this.sampleForce.copy(this.relative).multiplyScalar(-(drag + linearDamping));
      this.addForce(this.sampleForce, this.wetOffset);
    }

    if (this.dragging) {
      this.wetOffset.copy(this.grabLocal).applyQuaternion(this.quaternion);
      this.point.copy(this.position).add(this.wetOffset);
      this.wetOffset.multiplyScalar(METRES_PER_UNIT);
      this.relative.crossVectors(this.angularVelocity, this.wetOffset)
        .addScaledVector(this.velocity, METRES_PER_UNIT);
      this.sampleForce.copy(this.target).sub(this.point).multiplyScalar(METRES_PER_UNIT * this.mass * 24)
        .addScaledVector(this.relative, -this.mass * 4.4);
      this.sampleForce.clampLength(0, this.mass * 16);
      this.addForce(this.sampleForce, this.wetOffset);
    }

    if (this.bounds) {
      // Soft boundary forces only act outside the visible interaction area.
      // They do not attract a freely floating ring to an authored centre pose.
      const b = this.bounds;
      const x = Math.max(b.minX, Math.min(b.maxX, this.position.x)) - this.position.x;
      const z = Math.max(b.minZ, Math.min(b.maxZ, this.position.z)) - this.position.z;
      if (x) this.force.x += this.mass * METRES_PER_UNIT * (x * 8 - this.velocity.x * 3);
      if (z) this.force.z += this.mass * METRES_PER_UNIT * (z * 8 - this.velocity.z * 3);
    }

    this.velocity.addScaledVector(this.force, dt / (this.mass * METRES_PER_UNIT));
    this.position.addScaledVector(this.velocity, dt);

    // Euler rigid-body equation in principal/body axes, including gyroscopic
    // omega cross I*omega, then integrate orientation with a normalized quaternion.
    this.inverseRotation.copy(this.quaternion).invert();
    this.bodyOmega.copy(this.angularVelocity).applyQuaternion(this.inverseRotation);
    this.bodyTorque.copy(this.torque).applyQuaternion(this.inverseRotation);
    this.angularMomentum.copy(this.bodyOmega).multiply(this.inertia);
    this.bodyTorque.sub(this.scratch.crossVectors(this.bodyOmega, this.angularMomentum));
    this.bodyOmega.addScaledVector(this.bodyTorque.divide(this.inertia), dt);
    this.bodyOmega.multiplyScalar(Math.exp(-0.035 * dt));
    this.angularVelocity.copy(this.bodyOmega).applyQuaternion(this.quaternion);
    const angle = this.angularVelocity.length() * dt;
    if (angle > 1e-12) {
      this.rotationStep.setFromAxisAngle(this.scratch.copy(this.angularVelocity).normalize(), angle);
      this.quaternion.premultiply(this.rotationStep).normalize();
    }
  }
}
