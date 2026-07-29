import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * Stockfish's multi-threaded WASM build needs SharedArrayBuffer, which the
 * browser only exposes to cross-origin isolated documents. Without these two
 * headers the app silently falls back to the single-threaded engine — correct,
 * but several times slower to reach the same depth.
 */
const crossOriginIsolation = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    headers: crossOriginIsolation,
    // Vite rejects requests whose Host header it doesn't recognise (DNS-rebind
    // protection). A quick Cloudflare tunnel puts a random *.trycloudflare.com
    // host in front of the dev server, so that suffix needs to be allowed —
    // remove this once the app is no longer shared through a temporary tunnel.
    allowedHosts: ['.trycloudflare.com'],
  },
  preview: { headers: crossOriginIsolation },
})
