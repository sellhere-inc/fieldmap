import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Port 5174 so this can run at the same time as the admin panel on 5173.
//
// `host: true` binds to the LAN address as well as localhost, which is how you
// open the dev server on a phone. Note that browser geolocation is blocked on
// insecure origins, so "use my location" will not work over plain http://<lan-ip>
// — for that you need the deployed HTTPS build.
export default defineConfig({
  plugins: [react()],
  server: { port: 5174, host: true, open: true },
});
