export interface Coordinates { lat: number; lng: number }

export function coordinates(latitude: string, longitude: string): Coordinates {
  const numeric = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/;
  if (!numeric.test(latitude.trim()) || !numeric.test(longitude.trim())) {
    throw new Error('Enter both latitude and longitude as decimal numbers.');
  }
  const lat = Number(latitude), lng = Number(longitude);
  if (!Number.isFinite(lat) || Math.abs(lat) > 90 || !Number.isFinite(lng) || Math.abs(lng) > 180) {
    throw new Error('Latitude must be between -90 and 90; longitude between -180 and 180.');
  }
  return { lat, lng };
}

function pair(text: string): Coordinates | null {
  const match = text.trim().match(/^([+-]?(?:\d+(?:\.\d*)?|\.\d+))\s*,\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+))$/);
  return match ? coordinates(match[1], match[2]) : null;
}

function webUrl(text: string): URL {
  const input = text.trim();
  const normalized = input.startsWith('//') ? 'https:' + input
    : /^[a-z][a-z\d+.-]*:/i.test(input) ? input : 'https://' + input;
  let url: URL;
  try { url = new URL(normalized); } catch { throw new Error('Enter a valid link, such as example.com.'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || !url.hostname
    || /\s/.test(input)) throw new Error('Enter a valid website link, such as example.com.');
  return url;
}

export function googleMapsUrl(text: string): URL {
  const url = webUrl(text);
  if (url.protocol === 'http:') url.protocol = 'https:';
  const google = /^(?:(?:www|maps)\.)?google\.(?:com|[a-z]{2}|co\.[a-z]{2}|com\.[a-z]{2})$/.test(url.hostname);
  if (url.protocol !== 'https:' || url.username || url.password || url.port
    || !(url.hostname === 'maps.app.goo.gl' || (url.hostname === 'goo.gl' && url.pathname.startsWith('/maps/'))
      || (google && (url.pathname.startsWith('/maps') || url.hostname.startsWith('maps.'))))) {
    throw new Error('Use a Google Maps link or enter coordinates directly.');
  }
  return url;
}

export function savedGoogleMapsLink(text: string): string | null {
  return text.trim() ? webUrl(text).href : null;
}

export function openGoogleMapsLink(link: string | null, lat: number, lng: number): string {
  try {
    if (link) return webUrl(link).href;
  } catch { /* Older or externally edited invalid links fall back to the pin. */ }
  return 'https://www.google.com/maps/search/?api=1&query=' + lat + ',' + lng;
}

export function parseLocationInput(text: string): Coordinates | null {
  const direct = pair(text);
  if (direct) return direct;
  const url = googleMapsUrl(text);
  if (url.hostname === 'maps.app.goo.gl' || url.hostname === 'goo.gl') return null;
  const decoded = decodeURIComponent(url.href);
  // Place coordinates take priority over the @ camera center in place links.
  const place = decoded.match(/!3d(-?[\d.]+)!4d(-?[\d.]+)/);
  if (place) return coordinates(place[1], place[2]);
  for (const key of ['destination', 'query', 'q', 'll', 'center']) {
    const value = url.searchParams.get(key);
    if (value) { const result = pair(value); if (result) return result; }
  }
  const path = decodeURIComponent(url.pathname);
  const search = path.match(/\/maps\/(?:search|place)\/([^/]+)/);
  if (search) { const result = pair(search[1]); if (result) return result; }
  // A named place's map viewport is not its exact location.
  if (!/\/maps\/(?:place|dir|search)\//.test(path)) {
    const center = path.match(/@(-?[\d.]+),(-?[\d.]+)/);
    if (center) return coordinates(center[1], center[2]);
  }
  throw new Error('This link has no exact coordinates. Open it in Google Maps, then copy the pin’s latitude and longitude.');
}

export async function resolveLocationInput(text: string): Promise<Coordinates> {
  const parsed = parseLocationInput(text);
  if (parsed) return parsed;
  const response = await fetch('/api/resolve-map-link?url=' + encodeURIComponent(googleMapsUrl(text).href), { signal: AbortSignal.timeout(12000) });
  if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) {
    throw new Error('Could not expand this short link. Open it in Google Maps and copy the full link or pin coordinates.');
  }
  const data = await response.json();
  const result = typeof data.url === 'string' ? parseLocationInput(data.url) : null;
  if (!result) throw new Error('Open this link in Google Maps and copy the pin coordinates.');
  return result;
}
