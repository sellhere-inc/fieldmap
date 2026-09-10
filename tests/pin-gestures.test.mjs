import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

const dir = await mkdtemp(tmpdir() + '/fieldmap-gestures-');
await build({
  entryPoints: ['src/useLongPress.ts'], outfile: dir + '/gestures.mjs',
  format: 'esm', platform: 'node', bundle: true,
  plugins: [{ name: 'effect-harness', setup(builder) {
    builder.onResolve({ filter: /^react$/ }, () => ({ path: 'react', namespace: 'test' }));
    builder.onLoad({ filter: /.*/, namespace: 'test' }, () => ({
      contents: 'export const useEffect = (effect) => { globalThis.gestureCleanup = effect(); };',
    }));
  } }],
});
const { useLongPress } = await import(pathToFileURL(dir + '/gestures.mjs'));

function harness(t, mobile = true, enabled = true) {
  const events = new Map();
  const positions = [];
  const originalWindow = globalThis.window;
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', { value: { vibrate: () => {} }, configurable: true });
  globalThis.window = { matchMedia: () => ({ matches: mobile }) };
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const map = { on: (name, callback) => events.set(name, callback), off: (name) => events.delete(name) };
  useLongPress(map, (position) => positions.push(position), enabled);
  t.after(() => {
    globalThis.gestureCleanup?.();
    delete globalThis.gestureCleanup;
    if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator);
    else delete globalThis.navigator;
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  });
  const touch = (count = 1, x = 50) => ({ originalEvent: { touches: Array(count).fill({}) }, point: { x, y: 50 }, lngLat: { lat: 9.93, lng: 76.26 } });
  return { events, positions, touch };
}

test('desktop never binds a context-menu drop or responds to touch holds', (t) => {
  const { events, positions, touch } = harness(t, false);
  assert.equal(events.has('contextmenu'), false);
  events.get('touchstart')(touch());
  t.mock.timers.tick(600);
  assert.deepEqual(positions, []);
});

test('a stationary mobile touch drops one pin after the hold threshold', (t) => {
  const { events, positions, touch } = harness(t);
  events.get('touchstart')(touch());
  t.mock.timers.tick(499);
  assert.equal(positions.length, 0);
  t.mock.timers.tick(1);
  assert.deepEqual(positions, [{ lat: 9.93, lng: 76.26 }]);
  t.mock.timers.tick(1000);
  assert.equal(positions.length, 1);
});

test('mobile panning, pinching and early release never drop pins', (t) => {
  const { events, positions, touch } = harness(t);
  events.get('touchstart')(touch());
  events.get('touchmove')(touch(1, 100));
  t.mock.timers.tick(600);
  events.get('touchstart')(touch());
  events.get('touchstart')(touch(2));
  t.mock.timers.tick(600);
  events.get('touchstart')(touch());
  events.get('touchend')();
  t.mock.timers.tick(600);
  assert.deepEqual(positions, []);
});

test('disabled gesture handling does not register map listeners', (t) => {
  const { events } = harness(t, true, false);
  assert.equal(events.size, 0);
});
