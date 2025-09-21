import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: mode === 'production' ? '/StatCheck/' : '/',  // correct base
  build: { outDir: 'docs' },                          // build into docs/
}));
