import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { existsSync, readFileSync, readdirSync } from 'fs'
import { resolve } from 'path'
import type { Plugin } from 'vite'

function mainIconAssetsPlugin(): Plugin {
  return {
    name: 'fling-main-icon-assets',
    generateBundle() {
      const iconsDir = resolve(__dirname, 'src/main/icons')
      if (!existsSync(iconsDir)) return

      for (const file of readdirSync(iconsDir)) {
        if (!file.endsWith('.png')) continue
        this.emitFile({
          type: 'asset',
          fileName: `icons/${file}`,
          source: readFileSync(resolve(iconsDir, file))
        })
      }
    }
  }
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin(), mainIconAssetsPlugin()],
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/main/index.ts') }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/preload/index.ts') },
        output: {
          format: 'cjs',
          entryFileNames: '[name].cjs',
          chunkFileNames: '[name]-[hash].cjs'
        }
      }
    }
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/renderer/index.html') }
      }
    },
    resolve: {
      alias: {
        '@renderer': resolve(__dirname, 'src/renderer/src')
      }
    },
    plugins: [react()]
  }
})
