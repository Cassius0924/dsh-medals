import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('gallery content is embedded in the host and contains no seeded sample awards', async () => {
  const html=await readFile(new URL('../ui/index.html',import.meta.url),'utf8');
  assert.doesNotMatch(html,/演示|32\.6M|126M|2026\.10\.12|class="sidebar"/);
  assert.match(html,/sync-status/);
});
