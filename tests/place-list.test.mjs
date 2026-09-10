import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

const dir = await mkdtemp(tmpdir() + '/fieldmap-search-');
await build({
  entryPoints: ['src/PlaceList.tsx'], outfile: dir + '/list.mjs',
  format: 'esm', platform: 'node', bundle: true,
  resolveExtensions: ['.ts', '.tsx', '.js', '.json'],
  plugins: [{ name: 'no-database', setup(builder) {
    builder.onResolve({ filter: /^@supabase\/supabase-js$/ }, () => ({ path: 'client', namespace: 'test' }));
    builder.onLoad({ filter: /.*/, namespace: 'test' }, () => ({ contents: 'export const createClient = () => ({});' }));
  } }],
  define: { 'import.meta.env': JSON.stringify({
    VITE_SUPABASE_URL: 'https://example.supabase.co', VITE_SUPABASE_ANON_KEY: 'test-key',
  }) },
});
const { selectPlaces } = await import(pathToFileURL(dir + '/list.mjs'));
const places = [
  { id: '1', name: 'Green Farm', remarks: 'Meet on Monday', kind: 'farmer', visit_status: 'planned', tags: ['Organic'] },
  { id: '2', name: 'Blue Buyer', remarks: null, kind: 'trader', visit_status: 'planned', tags: ['Organic'] },
  { id: '3', name: 'Empty Warehouse', remarks: '  \n ', kind: 'warehouse', visit_status: 'met', tags: [] },
  { id: '4', name: 'Another Buyer', remarks: '', kind: 'trader', visit_status: 'met', tags: [] },
];
const search = (query) => selectPlaces(places, query, 'all', 'all', 'name').map(({ id }) => id);

test('automatic suggestions include only places with nonblank remarks', () => {
  assert.deepEqual(search(''), ['1']);
  assert.deepEqual(search('  '), ['1']);
});

test('explicit searches still find places without remarks by name or tag', () => {
  assert.deepEqual(search('blue'), ['2']);
  assert.deepEqual(search('warehouse'), ['3']);
  assert.deepEqual(search('another'), ['4']);
  assert.deepEqual(search('Organic'), ['2', '1']);
  assert.deepEqual(search('Monday'), ['1']);
});

test('search retains type, status and tag filters', () => {
  assert.deepEqual(selectPlaces(places, 'Organic', 'farmer', 'planned', 'name', ['organic']).map(({ id }) => id), ['1']);
  assert.deepEqual(selectPlaces(places, 'Organic', 'trader', 'met', 'name'), []);
});
