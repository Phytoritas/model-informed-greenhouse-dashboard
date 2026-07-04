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

const reactChunkMarkers = [
  'node_modules/react/',
  'node_modules/react-dom/',
  'node_modules/scheduler/',
  // Shared React helper used by both app-level vendors and recharts; leaving it
  // outside react-vendor lets Rollup route it through the entry chunk and form
  // an entry <-> chart-vendor cycle that evaluates recharts before React is
  // initialized (the production forwardRef white-screen).
  'node_modules/react-is/',
]

const routerChunkMarkers = [
  'node_modules/react-router/',
  'node_modules/react-router-dom/',
  'node_modules/@remix-run/',
]

const iconChunkMarkers = [
  'node_modules/lucide-react/',
]

// NOTE: recharts/d3 must NOT be forced into their own chunk. Their satellite
// dependencies (react-smooth, lodash, victory-vendor helpers, ...) are shared
// with entry-side modules, so a pinned chart chunk ends up in a mutual import
// cycle with react-vendor/entry and evaluates before React is initialized —
// the production "reading 'forwardRef'" white-screen. Rollup's default
// chunking already keeps chart code inside the lazy route chunks.

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

          if (reactChunkMarkers.some((marker) => id.includes(marker))) {
            return 'react-vendor'
          }

          if (routerChunkMarkers.some((marker) => id.includes(marker))) {
            return 'router-vendor'
          }

          if (iconChunkMarkers.some((marker) => id.includes(marker))) {
            return 'icon-vendor'
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
