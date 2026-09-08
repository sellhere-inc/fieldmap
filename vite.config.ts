import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import resolveMapLink from './netlify/functions/resolve-map-link.mjs';

function mapLinkApi(): Plugin {
  const configure: NonNullable<Plugin['configureServer']> = (server) => {
    server.middlewares.use('/api/resolve-map-link', async (req, res) => {
      try {
        const result = await resolveMapLink(new Request('http://localhost' + req.url, { method: req.method }));
        res.statusCode = result.status;
        result.headers.forEach((value, key) => res.setHeader(key, value));
        res.end(await result.text());
      } catch {
        res.statusCode = 500; res.end('Could not resolve link');
      }
    });
  };
  return { name: 'map-link-api', configureServer: configure, configurePreviewServer: configure };
}

// Port 5174 so this can run at the same time as the admin panel on 5173.
//
// `host: true` binds to the LAN address as well as localhost, which is how you
// open the dev server on a phone. Note that browser geolocation is blocked on
// insecure origins, so "use my location" will not work over plain http://<lan-ip>
// — for that you need the deployed HTTPS build.
export default defineConfig({
  plugins: [react(), mapLinkApi()],
  server: { port: 5174, host: true, open: true },
});
