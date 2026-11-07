import fs from 'node:fs'
import path from 'node:path'
import { execFile } from 'node:child_process'
import type { IncomingMessage } from 'node:http'
import { defineConfig, type Plugin } from 'vitest/config'
import react from '@vitejs/plugin-react'

/**
 * Dev-only save endpoints used by the Sign Capture page (/record-gesture):
 *   POST /__signify/save-signatures          body = full text of src/signing/gestureSignatures.ts
 *   POST /__signify/save-capture?language=ESL&id=thank-you   body = <id>.capture.json (then rebuilds assets)
 * They only exist while `npm run dev` is running, only answer to localhost, and only write to those two places.
 */
function signifySave(): Plugin {
  const read = (req: IncomingMessage, limit = 20e6) =>
    new Promise<string>((resolve, reject) => {
      let size = 0
      const chunks: Buffer[] = []
      req.on('data', (c: Buffer) => {
        size += c.length
        if (size > limit) { reject(new Error('Request too large')); req.destroy() } else chunks.push(c)
      })
      req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
      req.on('error', reject)
    })
  return {
    name: 'signify-save',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__signify', async (req, res) => {
        const send = (status: number, body: unknown) => {
          res.statusCode = status
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify(body))
        }
        const host = String(req.headers.host || '')
        if (!/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host)) return send(403, { ok: false, error: 'localhost only' })
        const url = new URL(req.url || '/', 'http://localhost')
        try {
          if (req.method === 'GET' && url.pathname === '/ping') return send(200, { ok: true })
          if (req.method !== 'POST') return send(405, { ok: false, error: 'POST only' })
          if (url.pathname === '/save-signatures') {
            const text = await read(req)
            if (!text.includes('export const TRAINED_TEMPLATES')) return send(400, { ok: false, error: 'Not a gestureSignatures.ts file' })
            fs.writeFileSync(path.resolve('src/signing/gestureSignatures.ts'), text)
            return send(200, { ok: true })
          }
          if (url.pathname === '/save-capture') {
            const language = url.searchParams.get('language') || ''
            const id = url.searchParams.get('id') || ''
            if (!['ASL', 'ESL'].includes(language) || !/^[a-z0-9][a-z0-9-]{0,60}$/.test(id)) return send(400, { ok: false, error: 'Bad language or id' })
            const body = await read(req)
            const parsed = JSON.parse(body)
            if (!parsed?.entry?.label || !parsed?.clip?.tracks) return send(400, { ok: false, error: 'Not a capture file' })
            fs.mkdirSync(path.resolve('captures', language), { recursive: true })
            fs.writeFileSync(path.resolve('captures', language, `${id}.capture.json`), body)
            return execFile('node', ['scripts/build-demo-assets.mjs'], { cwd: process.cwd() }, (error, stdout, stderr) =>
              send(error ? 500 : 200, { ok: !error, log: String(stdout).slice(-500), error: error ? String(stderr || error.message).slice(-500) : undefined }))
          }
          send(404, { ok: false, error: 'unknown endpoint' })
        } catch (e) {
          send(500, { ok: false, error: e instanceof Error ? e.message : 'failed' })
        }
      })
    },
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), signifySave()],
  test: { include: ['tests/unit/**/*.test.ts'], environment: 'node', testTimeout: 60000 },
})
