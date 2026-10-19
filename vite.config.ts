import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/',
  test: {
    include: ['src/**/*.test.ts'],
    coverage: {
      include: ['src/utils/**', 'api/lib/confirmationMetrics.ts'],
    },
  },
})
