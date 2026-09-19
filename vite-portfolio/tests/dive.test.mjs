import assert from 'node:assert/strict';
import test from 'node:test';
import { cameraAtDive, depthAtScroll } from '../src/dive.ts';

test('depth follows the full sticky travel and clamps outside the journey', () => {
  assert.equal(depthAtScroll(-100, 0, 7600, 1000), 0);
  assert.equal(depthAtScroll(0, 0, 7600, 1000), 0);
  assert.equal(depthAtScroll(3300, 0, 7600, 1000), 20);
  assert.equal(depthAtScroll(6600, 0, 7600, 1000), 40);
  assert.equal(depthAtScroll(10000, 0, 7600, 1000), 40);
});

test('restored scroll and a resized mobile viewport use measured geometry', () => {
  assert.equal(depthAtScroll(2830, 190, 6080, 800), 20);
  assert.equal(depthAtScroll(1510, 190, 6080, 800), 10);
  assert.equal(depthAtScroll(4150, 190, 6080, 800), 30);
  assert.equal(depthAtScroll(500, 0, 800, 800), 0);
});

test('the gauge counts actual immersion, excluding the above-water approach', () => {
  for (const mobile of [false, true]) {
    assert.equal(cameraAtDive(0, mobile).depth, 0);
    assert.equal(cameraAtDive(.4, mobile).depth, 0);
    assert.ok(cameraAtDive(.6, mobile).depth > 0);
    assert.ok(cameraAtDive(.6, mobile).depth < .3);
    assert.ok(Math.abs(cameraAtDive(.8, mobile).depth - .8) < 1e-12);
    assert.equal(cameraAtDive(20, mobile).depth, 20);
    assert.equal(cameraAtDive(40, mobile).depth, 40);
    let previous = 0;
    for (let value = 0; value <= 40; value += .02) {
      const camera = cameraAtDive(value, mobile);
      assert.ok(camera.depth >= previous);
      previous = camera.depth;
    }
  }
});
