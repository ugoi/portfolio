import assert from 'node:assert/strict';
import test from 'node:test';
import { cameraAtDive, depthAtScroll, depthAtProgress, MAX_DIVE_DEPTH } from '../src/dive.ts';

test('descent clamps outside the document and holds at the destination', () => {
  assert.equal(depthAtScroll(-100, 0, 7600, 1000), 0);
  assert.equal(depthAtScroll(0, 0, 7600, 1000), 0);
  assert.equal(depthAtScroll(5808, 0, 7600, 1000), 1000);
  assert.equal(depthAtScroll(6600, 0, 7600, 1000), 1000);
  assert.equal(depthAtScroll(10000, 0, 7600, 1000), 1000);
  assert.equal(depthAtScroll(500, 0, 800, 800), 0);
});

test('surface gets more scroll time; depth is continuous and monotonic', () => {
  assert.ok(depthAtProgress(.1) < 5);
  assert.ok(depthAtProgress(.25) > 20 && depthAtProgress(.25) < 40);
  assert.ok(depthAtProgress(.5) > 150 && depthAtProgress(.5) < 250);
  assert.equal(depthAtProgress(.88), MAX_DIVE_DEPTH);
  let previous = 0;
  for (let n = 0; n <= 1000; n++) {
    const depth = depthAtProgress(n / 1000);
    assert.ok(depth >= previous && depth <= 1000);
    assert.ok(depth - previous < 4);
    previous = depth;
  }
});

test('restored scroll and resized viewports preserve equivalent progress', () => {
  assert.equal(depthAtScroll(2830, 190, 6080, 800), depthAtScroll(3300, 0, 7600, 1000));
  assert.equal(depthAtScroll(1510, 190, 6080, 800), depthAtProgress(.25));
});

test('gauge excludes the above-water approach and reaches the actual kilometre', () => {
  for (const mobile of [false, true]) {
    assert.equal(cameraAtDive(0, mobile).depth, 0);
    assert.equal(cameraAtDive(.4, mobile).depth, 0);
    assert.ok(cameraAtDive(.6, mobile).depth > 0);
    assert.ok(cameraAtDive(.6, mobile).depth < .3);
    assert.ok(Math.abs(cameraAtDive(.8, mobile).depth - .8) < 1e-12);
    assert.equal(cameraAtDive(200, mobile).depth, 200);
    assert.equal(cameraAtDive(1000, mobile).depth, 1000);
    assert.equal(cameraAtDive(2000, mobile).depth, 1000);
    let previous = 0;
    for (let value = 0; value <= 1000; value += .1) {
      const camera = cameraAtDive(value, mobile);
      assert.ok(camera.depth >= previous);
      previous = camera.depth;
    }
  }
});
