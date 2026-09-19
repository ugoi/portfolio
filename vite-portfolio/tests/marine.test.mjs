import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { createMarineLife } from '../src/marineLife.ts';
import { advanceMarineSimulation, createMarineSimulation, marineHabitats, MARINE_TIME_STEP } from '../src/marinePhysics.ts';
import { METRES_PER_UNIT, WATER_LEVEL, DESTINATION_DEPTH } from '../src/waterScale.ts';

const matrices = scene => {
  const result = [];
  scene.traverse(object => {
    result.push({ name: object.name, visible: object.visible,
      position: object.position.toArray(), quaternion: object.quaternion.toArray(), scale: object.scale.toArray(),
      instances: object instanceof THREE.InstancedMesh ? Array.from(object.instanceMatrix.array) : null });
  });
  return result;
};

test('marine integration is deterministic across regular, dropped and repeated frames', () => {
  const habitats = marineHabitats().slice(0, 3);
  const regular = createMarineSimulation(habitats);
  const irregular = createMarineSimulation(habitats);
  const single = createMarineSimulation(habitats);
  for (let frame = 1; frame <= 300; frame++) advanceMarineSimulation(regular, frame / 60);
  for (const seconds of [.016, .15, .15, .19, .98, 1.7, 2.33, 2.9, 4.11, 5]) advanceMarineSimulation(irregular, seconds);
  advanceMarineSimulation(single, 5);
  assert.equal(single.step, 150);
  assert.deepEqual(regular, single);
  assert.deepEqual(irregular, single);
  const before = structuredClone(single);
  advanceMarineSimulation(single, 5);
  advanceMarineSimulation(single, Number.NaN);
  assert.deepEqual(single, before);
});

test('real-depth habitats stay bounded without wrapping or position resets', () => {
  const habitats = marineHabitats();
  const depths = habitats.map(habitat => (WATER_LEVEL - habitat.centre.y) * METRES_PER_UNIT);
  assert.equal(Math.min(...depths), 6);
  assert.equal(Math.max(...depths), 42);
  const sampleHabitats = [habitats[0], habitats[3], habitats[6]];
  const simulation = createMarineSimulation(sampleHabitats);
  for (let step = 1; step <= 3600; step++) {
    const previous = simulation.schools.map(school => school.bodies.map(body => ({ ...body.position })));
    advanceMarineSimulation(simulation, step * MARINE_TIME_STEP);
    simulation.schools.forEach((school, schoolIndex) => school.bodies.forEach((body, bodyIndex) => {
      const before = previous[schoolIndex][bodyIndex];
      const displacement = Math.hypot(body.position.x - before.x, body.position.y - before.y, body.position.z - before.z);
      const maximumSpeed = school.habitat.kind === 'silver' ? 3.2 : 2.4;
      assert.ok(displacement <= maximumSpeed * MARINE_TIME_STEP + 1e-9, 'no wrapping, teleport or large simulation step');
      const depth = (WATER_LEVEL - body.position.y) * METRES_PER_UNIT;
      assert.ok(depth > 0 && depth < DESTINATION_DEPTH, 'fish remain in the lagoon water column');
      for (const axis of ['x', 'y', 'z']) {
        assert.ok(Number.isFinite(body.position[axis]));
        assert.ok(Math.abs(body.position[axis] - school.habitat.centre[axis]) < school.habitat.extent[axis] + 3,
          `fish stays in its world habitat on ${axis}`);
      }
    }));
  }
});

test('scrolling and viewport changes leave every fish, ray and jelly in the same world state', () => {
  const scene = new THREE.Scene(), life = createMarineLife(scene);
  const camera = new THREE.PerspectiveCamera(60, 16 / 9, .1, 400);
  life.update(20, 1, false, 1, camera);
  const before = matrices(scene);
  for (const depth of [50, 0, 15, 45, 5, 30, 20]) {
    camera.position.set(depth % 17, WATER_LEVEL - depth / METRES_PER_UNIT, 8);
    camera.aspect = depth % 2 ? 16 / 9 : 9 / 19.5;
    camera.updateProjectionMatrix();
    life.update(depth, 1, false, depth ? 1 : 0, camera);
    assert.deepEqual(matrices(scene), before, 'only the observer moves when scrolling or resizing');
  }
  scene.traverse(object => {
    if (object instanceof THREE.InstancedMesh) {
      assert.equal(object.frustumCulled, true);
      assert.ok(object.boundingSphere.radius > 0);
      if (object.name.includes('school')) {
        assert.equal(object.material.transparent, false);
        assert.equal(object.material.depthWrite, true);
        assert.ok(!('uOpacity' in object.material.uniforms), 'opaque fish have no fade-band control');
      }
    }
  });
  life.dispose();
  assert.equal(scene.children.length, 0);
});

test('marine creatures continue moving in an unseen habitat and hold exactly when time pauses', () => {
  const scene = new THREE.Scene(), life = createMarineLife(scene);
  const camera = new THREE.PerspectiveCamera();
  life.update(0, 0, false, 0, camera);
  const initial = matrices(scene);
  life.update(0, 2, false, 0, camera);
  const advanced = matrices(scene);
  assert.notDeepEqual(advanced, initial, 'being above water does not stop distant habitats');
  const schoolInitial = initial.filter(item => item.name.includes('school'));
  const schoolAdvanced = advanced.filter(item => item.name.includes('school'));
  schoolAdvanced.forEach((item, index) => assert.notDeepEqual(item.instances, schoolInitial[index].instances));
  life.update(50, 2, true, 1, camera);
  assert.deepEqual(matrices(scene), advanced, 'pause freezes motion even during scroll and blueprint toggles');
  life.dispose();
});
