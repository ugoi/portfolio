import test from 'node:test';
import assert from 'node:assert/strict';
import { createOceanGeometry } from '../src/oceanGeometry.ts';

test('ocean has one connected surface through the former foreground edge and to the horizon', () => {
  const g = createOceanGeometry();
  try {
    const p = g.attributes.position;
    const width = 257;
    const middle = 128 * width;
    assert.equal(p.getX(middle), -500);
    assert.equal(p.getX(middle + 256), 500);
    let previous = -Infinity;
    for (let column = 0; column < width; column++) {
      const x = p.getX(middle + column);
      assert.ok(x > previous);
      assert.equal(p.getZ(middle + column), 0, 'no lowered background plane');
      if (Math.abs(x) <= 24) assert.equal(g.attributes.aCellWidth.getX(middle + column), .375);
      previous = x;
    }
    assert.equal(g.index.count, 256 * 256 * 6, 'every adjacent grid cell is joined');
    // Mesh density changes gradually rather than jumping at the old 32-unit edge.
    const nearEdge = Array.from({length: width}, (_, i) => i).filter(i => Math.abs(p.getX(middle + i) - 32) < 4);
    assert.ok(nearEdge.length >= 5);
  } finally { g.dispose(); }
});
