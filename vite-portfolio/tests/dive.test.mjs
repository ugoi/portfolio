import assert from 'node:assert/strict';
import test from 'node:test';
import { METRES_PER_UNIT, WATER_LEVEL } from '../src/waterScale.ts';
import { advanceDiveDepth, cameraAtDive, depthAtScroll, depthAtProgress, MAX_DIVE_DEPTH } from '../src/dive.ts';

test('descent clamps outside the document and holds at the destination', () => {
  assert.equal(depthAtScroll(-100, 0, 7600, 1000), 0);
  assert.equal(depthAtScroll(0, 0, 7600, 1000), 0);
  assert.equal(depthAtScroll(5808, 0, 7600, 1000), MAX_DIVE_DEPTH);
  assert.equal(depthAtScroll(6600, 0, 7600, 1000), MAX_DIVE_DEPTH);
  assert.equal(depthAtScroll(10000, 0, 7600, 1000), MAX_DIVE_DEPTH);
  assert.equal(depthAtScroll(500, 0, 800, 800), 0);
});

test('surface gets more scroll time; depth is continuous and monotonic', () => {
  assert.ok(depthAtProgress(.1) > 1 && depthAtProgress(.1) < 3);
  assert.ok(depthAtProgress(.25) > 5 && depthAtProgress(.25) < 10);
  assert.ok(depthAtProgress(.5) > 20 && depthAtProgress(.5) < 25);
  assert.equal(depthAtProgress(.88), MAX_DIVE_DEPTH);
  let previous = 0;
  for (let n = 0; n <= 1000; n++) {
    const depth = depthAtProgress(n / 1000);
    assert.ok(depth >= previous && depth <= MAX_DIVE_DEPTH);
    assert.ok(depth - previous < .1);
    previous = depth;
  }
});

test('restored scroll and resized viewports preserve equivalent progress', () => {
  assert.equal(depthAtScroll(2830, 190, 6080, 800), depthAtScroll(3300, 0, 7600, 1000));
  assert.equal(depthAtScroll(1510, 190, 6080, 800), depthAtProgress(.25));
});

test('gauge excludes the above-water approach and reaches the actual lagoon depth', () => {
  for (const mobile of [false, true]) {
    assert.equal(cameraAtDive(0, mobile).depth, 0);
    assert.equal(cameraAtDive(.4, mobile).depth, 0);
    assert.ok(cameraAtDive(.6, mobile).depth > 0);
    assert.ok(cameraAtDive(.6, mobile).depth < .3);
    assert.ok(Math.abs(cameraAtDive(.8, mobile).depth - .8) < 1e-12);
    assert.equal(cameraAtDive(20, mobile).depth, 20);
    assert.equal(cameraAtDive(MAX_DIVE_DEPTH, mobile).y, WATER_LEVEL - MAX_DIVE_DEPTH / METRES_PER_UNIT);
    assert.equal(cameraAtDive(1000, mobile).depth, MAX_DIVE_DEPTH);
    assert.equal(cameraAtDive(2000, mobile).depth, MAX_DIVE_DEPTH);
    let previous = 0;
    for (let value = 0; value <= MAX_DIVE_DEPTH; value += .1) {
      const camera = cameraAtDive(value, mobile);
      assert.ok(camera.depth >= previous);
      previous = camera.depth;
    }
  }
});

test('camera smoothing is monotonic and independent of render cadence', () => {
  const result = rate => {
    let depth = 0;
    for (let i = 0; i < rate; i++) {
      const next = advanceDiveDepth(depth, MAX_DIVE_DEPTH, 1 / rate);
      assert.ok(next >= depth && next <= MAX_DIVE_DEPTH);
      depth = next;
    }
    return depth;
  };
  assert.ok(Math.abs(result(30) - result(120)) < 1e-8);
  assert.ok(result(60) > MAX_DIVE_DEPTH - .01 && result(60) < MAX_DIVE_DEPTH);
  assert.equal(advanceDiveDepth(MAX_DIVE_DEPTH, MAX_DIVE_DEPTH, 1), MAX_DIVE_DEPTH);
  assert.equal(advanceDiveDepth(0, MAX_DIVE_DEPTH, 0), 0);
});
