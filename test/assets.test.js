import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {CHALLENGES} from '../src/challenges.js';

test('every medal has its rendered front and back fallback', async () => {
  for(const rule of CHALLENGES)for(const side of ['front','back']) {
    const png=await readFile(new URL(`../ui/assets/medals/${rule.design==='numeric'?rule.id:rule.design}-${side}.png`,import.meta.url));
    assert.equal(png.subarray(1,4).toString(),'PNG');
    assert(png.readUInt32BE(16)>=512);assert(png.readUInt32BE(20)>=512);
  }
});
