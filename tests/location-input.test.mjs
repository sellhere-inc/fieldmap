import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import handler from '../netlify/functions/resolve-map-link.mjs';
const dir = await mkdtemp(tmpdir() + '/fieldmap-location-');
await build({ entryPoints: ['src/locationInput.ts'], outfile: dir + '/parser.mjs', format: 'esm', platform: 'node' });
const { coordinates, parseLocationInput, savedGoogleMapsLink, openGoogleMapsLink, googleMapsName, resolveLocationInput } = await import(pathToFileURL(dir + '/parser.mjs'));

test('coordinates retain zero, negative values and boundary values', () => {
  assert.deepEqual(coordinates('0', '-180'), { lat: 0, lng: -180 });
  assert.deepEqual(coordinates('90', '180'), { lat: 90, lng: 180 });
  for (const pair of [['', '0'], ['91', '0'], ['0', '181'], ['NaN', '1'], ['1', 'Infinity'], ['0x10', '1']]) {
    assert.throws(() => coordinates(...pair));
  }
});
test('copied pairs and encoded Maps query, pin and center links', () => {
  for (const input of ['9.93, 76.26', 'https://maps.google.com/?q=9.93,76.26',
    'https://www.google.com/maps/search/?api=1&query=9.93%2C76.26',
    'https://www.google.co.in/maps/place/Farm/@1,2,10z/data=!3d9.93!4d76.26',
    'https://www.google.com/maps/@9.93,76.26,15z',
    'https://www.google.com/maps/dir/?api=1&destination=9.93,76.26']) {
    assert.deepEqual(parseLocationInput(input), { lat: 9.93, lng: 76.26 });
  }
});
test('does not mistake named place viewport, arbitrary URLs or invalid pairs for a pin', () => {
  for (const input of ['https://www.google.com/maps/place/Farm/@1,2,10z',
    'https://evil.test/maps/@1,2,10z', 'https://google.com.evil.test/maps/@1,2',
    'https://www.google.com/maps/?q=91,0', 'https://www.google.com/maps/?query=Farm']) {
    assert.throws(() => parseLocationInput(input));
  }
  assert.equal(parseLocationInput('https://maps.app.goo.gl/example'), null);
});
test('short link resolver follows Google redirects and blocks external redirect targets', async () => {
  const original = globalThis.fetch;
  let calls = 0;
  try {
    globalThis.fetch = async () => { calls++; return new Response(null, { status: 302, headers: { location: 'https://www.google.com/maps/?q=9.93,76.26' } }); };
    const request = () => new Request('http://localhost/api/resolve-map-link?url=https://maps.app.goo.gl/example');
    const response = await handler(request());
    assert.equal(response.status, 200);
    assert.deepEqual(parseLocationInput((await response.json()).url), { lat: 9.93, lng: 76.26 });
    assert.equal(calls, 1);
    globalThis.fetch = async () => new Response(null, { status: 302, headers: { location: 'http://127.0.0.1/private' } });
    assert.equal((await handler(request())).status, 422);
    assert.equal((await handler(new Request('http://localhost/api/resolve-map-link?url=https://evil.test'))).status, 400);
  } finally { globalThis.fetch = original; }
});

test('saved Maps links take precedence with safe coordinate fallback', () => {
  const link = 'https://maps.app.goo.gl/example';
  assert.equal(savedGoogleMapsLink('  ' + link + '  '), link);
  assert.equal(savedGoogleMapsLink(' '), null);
  assert.equal(openGoogleMapsLink(link, 1, 2), link);
  assert.equal(openGoogleMapsLink(null, 1, 2), 'https://www.google.com/maps/search/?api=1&query=1,2');
  assert.equal(openGoogleMapsLink('javascript:alert(1)', 1, 2), 'https://www.google.com/maps/search/?api=1&query=1,2');
  assert.throws(() => savedGoogleMapsLink('javascript:alert(1)'));
});

test('saved website links accept bare domains and optional www', () => {
  assert.equal(savedGoogleMapsLink('example.com'), 'https://example.com/');
  assert.equal(savedGoogleMapsLink('www.example.com/place?a=1'), 'https://www.example.com/place?a=1');
  assert.equal(openGoogleMapsLink('example.com', 1, 2), 'https://example.com/');
  assert.equal(savedGoogleMapsLink('http://example.com'), 'http://example.com/');
  assert.deepEqual(parseLocationInput('google.com/maps/?q=9.93,76.26'), { lat: 9.93, lng: 76.26 });
  assert.equal(parseLocationInput('maps.app.goo.gl/example'), null);
  assert.throws(() => savedGoogleMapsLink('data:text/html,test'));
  assert.throws(() => savedGoogleMapsLink('not a link'));
});


test('Maps names decode words and Unicode without using coordinates or identifiers as names', () => {
  assert.equal(googleMapsName('https://www.google.com/maps/place/Green+Valley+Farm/data=!3d9.93!4d76.26'), 'Green Valley Farm');
  assert.equal(googleMapsName('https://www.google.com/maps/place/' + encodeURIComponent('കഫേ')), 'കഫേ');
  assert.equal(googleMapsName('https://www.google.com/maps/?q=Green+Valley+Farm'), 'Green Valley Farm');
  for (const input of ['9.93,76.26', 'https://www.google.com/maps/?q=9.93,76.26',
    'https://www.google.com/maps/?q=place_id:example', 'https://maps.app.goo.gl/example',
    'https://www.google.com/maps/@9.93,76.26,15z', 'https://example.com/maps/place/Farm']) {
    assert.equal(googleMapsName(input), undefined);
  }
});

test('resolving full and short links carries the name alongside exact pin coordinates', async () => {
  const full = 'https://www.google.com/maps/place/Green+Valley+Farm/@1,2,10z/data=!3d9.93!4d76.26';
  const expected = { lat: 9.93, lng: 76.26, name: 'Green Valley Farm' };
  assert.deepEqual(await resolveLocationInput(full), expected);
  assert.deepEqual(await resolveLocationInput('9.93,76.26'), { lat: 9.93, lng: 76.26 });
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => Response.json({ url: full });
    assert.deepEqual(await resolveLocationInput('https://maps.app.goo.gl/example'), expected);
  } finally { globalThis.fetch = original; }
});
