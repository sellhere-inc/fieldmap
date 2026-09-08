// Follow only Google Maps redirects. Never fetch user-supplied arbitrary hosts.
function allowed(url) {
  if (url.protocol !== 'https:' || url.port || url.username || url.password) return false;
  if (url.hostname === 'maps.app.goo.gl') return true;
  if (url.hostname === 'goo.gl') return url.pathname.startsWith('/maps/');
  return /^(?:(?:www|maps)\.)?google\.(?:com|[a-z]{2}|co\.[a-z]{2}|com\.[a-z]{2})$/.test(url.hostname)
    && (url.pathname.startsWith('/maps') || url.hostname.startsWith('maps.'));
}

export default async function handler(request) {
  if (request.method !== 'GET') return Response.json({ error: 'Method not allowed' }, { status: 405 });
  try {
    const input = new URL(request.url).searchParams.get('url');
    if (!input || input.length > 4096) return Response.json({ error: 'Invalid link' }, { status: 400 });
    let url = new URL(input);
    if (!allowed(url) || !['maps.app.goo.gl', 'goo.gl'].includes(url.hostname)) {
      return Response.json({ error: 'Use a Google Maps short link' }, { status: 400 });
    }
    const signal = AbortSignal.timeout(8000);
    for (let hop = 0; hop < 5; hop++) {
      if (!allowed(url)) throw new Error('Unsupported redirect');
      if (!['maps.app.goo.gl', 'goo.gl'].includes(url.hostname)) {
        return Response.json({ url: url.href }, { headers: { 'Cache-Control': 'private, no-store' } });
      }
      const response = await fetch(url, { redirect: 'manual', signal });
      await response.body?.cancel();
      const location = response.headers.get('location');
      if (response.status < 300 || response.status >= 400 || !location) throw new Error('No redirect');
      url = new URL(location, url);
    }
    throw new Error('Too many redirects');
  } catch {
    return Response.json({ error: 'Open the link in Google Maps and copy the full link or coordinates.' }, { status: 422 });
  }
}

export const config = { path: '/api/resolve-map-link' };
