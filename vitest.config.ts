import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Las fechas y la racha dependen de la hora local: se prueba con hora de Chile.
    env: { TZ: 'America/Santiago' },
  },
})
