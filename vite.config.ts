import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { localNoaaPlugin } from './scripts/local-noaa-plugin.mjs'

export default defineConfig({
  plugins: [react(), localNoaaPlugin()], base: './', build: { target: 'es2022' },
  server: { fs: { deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', '**/data/raw/**', '**/data/compiled/**'] } },
})
