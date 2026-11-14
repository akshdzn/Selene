import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vite'

const horizonsProxy = {
  target: 'https://ssd.jpl.nasa.gov',
  changeOrigin: true,
  rewrite: (path) => path.replace(/^\/api\/horizons/, '/api/horizons.api'),
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [svelte()],
  assetsInclude: ['**/*.tif', '**/*.tiff'],
  server: {
    proxy: {
      '/api/horizons': horizonsProxy,
    },
  },
  preview: {
    proxy: {
      '/api/horizons': horizonsProxy,
    },
  },
})
