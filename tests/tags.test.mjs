import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
const dir = await mkdtemp(tmpdir() + '/fieldmap-tags-');
await build({ entryPoints: ['src/tags.ts'], outfile: dir + '/tags.mjs', format: 'esm', platform: 'node' });
const { cleanTags, matchesTags } = await import(pathToFileURL(dir + '/tags.mjs'));
test('reuse existing spelling and drop whitespace and case duplicates', () => {
  assert.deepEqual(cleanTags([' restaurant ', 'RESTAURANT', '', '  Coffee   shop  '], ['Restaurant']), ['Restaurant', 'Coffee shop']);
});
test('preserve multilingual tags and normalize equivalent Unicode', () => {
  assert.deepEqual(cleanTags(['കഫേ', 'Café', 'Cafe\u0301']), ['കഫേ', 'Café']);
});
test('reject tags longer than the database permits', () => {
  assert.throws(() => cleanTags(['a'.repeat(65)]), /64 characters/);
  assert.equal(cleanTags(['a'.repeat(64)])[0].length, 64);
});

test('tag filters match any selected tag and hide untagged pins until cleared', () => {
  assert.equal(matchesTags(['Restaurant'], ['restaurant', 'Cafe']), true);
  assert.equal(matchesTags(['Cafe'], ['Restaurant', 'Cafe']), true);
  assert.equal(matchesTags(['Warehouse'], ['Restaurant', 'Cafe']), false);
  assert.equal(matchesTags([], ['Restaurant']), false);
  assert.equal(matchesTags([], []), true);
  assert.equal(matchesTags(['Restaurant'], []), true);
});
