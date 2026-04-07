import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

const cwd = process.cwd()
const isWindows = process.platform === 'win32'
const isOneDrivePath = /[\\/]OneDrive[\\/]/i.test(cwd)
const disableHmr =
  process.env.VITE_DISABLE_HMR === '1' || (isWindows && isOneDrivePath)

const markdownChunkMarkers = [
  '/react-markdown/',
  '/remark-',
  '/rehype-',
  '/unified/',
  '/bail/',
  '/trough/',
  '/vfile/',
  '/mdast-util-',
  '/micromark',
  '/unist-util-',
  '/hast-util-',
  '/property-information/',
  '/space-separated-tokens/',
  '/comma-separated-tokens/',
]

// https://vite.dev/config/
//
// NOTE (Windows/OneDrive):
// In OneDrive-synced folders, fs events / reads can intermittently fail and surface as:
//   [plugin:vite:import-analysis] UNKNOWN: unknown error, read <.../src/main.tsx>
// Using polling is slower but typically much more reliable.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined
          }

          if (id.includes('node_modules/recharts/')) {
            return 'charts-vendor'
          }

          if (markdownChunkMarkers.some((marker) => id.includes(`node_modules${marker}`))) {
            return 'markdown-vendor'
          }

          return undefined
        },
      },
    },
  },
  server: {
    // Reduce aggressive pre-processing that can trigger extra fs reads
    preTransformRequests: false,
    watch: {
      usePolling: true,
      interval: 500,
    },
    // Workaround: disable HMR on Windows OneDrive paths (stability > convenience)
    hmr: disableHmr ? false : { overlay: true },
  },
})
