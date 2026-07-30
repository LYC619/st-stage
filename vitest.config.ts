import { defineConfig } from 'vitest/config'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  resolve: {
    alias: { '@': root },
  },
  test: {
    include: ['core/**/*.test.ts', 'st-extension/**/*.test.ts'],
    environment: 'node',
    // forks 池的子进程在 Windows + Node 22 上退出期原生崩溃（uv_poll_stop），threads 池无此问题
    pool: 'threads',
  },
})
