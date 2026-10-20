import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://pensiones-espana.up.railway.app',
  output: 'static',
  build: { format: 'directory' },
  devToolbar: { enabled: false },
});
