import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { spawn, execSync, type ChildProcess } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// Boot the real built Nitro server and exercise the endpoints over HTTP.
// (We avoid @nuxt/test-utils' in-process build, which is incompatible with the
// current Vite/Vue toolchain.)
const ROOT = resolve(fileURLToPath(import.meta.url), '../..')
const ENTRY = resolve(ROOT, '.output/server/index.mjs')
const PORT = 3123
const BASE = `http://127.0.0.1:${PORT}`

let proc: ChildProcess | undefined

function sampleDoc(overrides: Record<string, unknown> = {}) {
  return {
    title: 'API Test',
    header: { blocks: [] },
    body: { blocks: [{ id: 'p1', type: 'paragraph', spans: [{ text: 'Hello {{name}}' }] }] },
    footer: { blocks: [{ id: 'f1', type: 'paragraph', spans: [{ text: 'Page {{page}} of {{pages}}' }] }] },
    design: {
      font: 'Helvetica',
      textColor: '#111827',
      backgroundColor: '#ffffff',
      accentColor: '#2563eb',
      headingColor: '#111827'
    },
    layout: { pageSize: 'A4', orientation: 'portrait', marginPt: 54 },
    ...overrides
  }
}

const isPdf = (buf: ArrayBuffer) =>
  new TextDecoder().decode(new Uint8Array(buf).slice(0, 5)) === '%PDF-'
const isZip = (buf: ArrayBuffer) => {
  const b = new Uint8Array(buf)
  return b[0] === 0x50 && b[1] === 0x4b // "PK"
}

async function waitForServer(timeoutMs = 30000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(BASE + '/')
      if (res.ok) return
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 300))
  }
  throw new Error('Server did not start in time')
}

beforeAll(async () => {
  if (!existsSync(ENTRY)) {
    execSync('npm run build', { cwd: ROOT, stdio: 'ignore' })
  }
  proc = spawn('node', [ENTRY], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(PORT), HOST: '127.0.0.1', NITRO_PORT: String(PORT) },
    stdio: 'ignore'
  })
  await waitForServer()
}, 180000)

afterAll(() => {
  proc?.kill()
})

describe('PDF API (e2e)', () => {
  it('POST /api/pdf returns a PDF', async () => {
    const res = await fetch(BASE + '/api/pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sampleDoc())
    })
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('application/pdf')
    const buf = await res.arrayBuffer()
    expect(isPdf(buf)).toBe(true)
    expect(buf.byteLength).toBeGreaterThan(500)
  })

  it('POST /api/pdf rejects an invalid document with 400', async () => {
    const res = await fetch(BASE + '/api/pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: '' })
    })
    expect(res.status).toBe(400)
  })

  it('POST /api/pdf/batch returns a ZIP, one PDF per row', async () => {
    const res = await fetch(BASE + '/api/pdf/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        template: sampleDoc(),
        rows: [{ name: 'Ann' }, { name: 'Bob' }],
        namePattern: '{{name}}-{{index}}.pdf'
      })
    })
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('application/zip')
    const buf = await res.arrayBuffer()
    expect(isZip(buf)).toBe(true)
    expect(buf.byteLength).toBeGreaterThan(500)
  })
})
