import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createGzip } from 'node:zlib'
import { pipeline } from 'node:stream/promises'

/** One fixed, loopback-only review artifact. Never part of build or preview. */
export function localNoaaPlugin() {
  return {
    name: 'local-noaa-review', apply: 'serve',
    configureServer(server) {
      const artifacts = new Map([
        ['/__local/noaa-la-2025.json', resolve(server.config.root, 'data/compiled/noaa-la-2025.json')],
        ['/__local/noaa-la-land.geojson', resolve(server.config.root, 'data/compiled/noaa-la-land.geojson')],
      ])
      server.middlewares.use(async (request, response, next) => {
        const artifact = artifacts.get(request.url?.split('?')[0])
        if (!artifact) return next()
        const remote = request.socket.remoteAddress
        const origin = request.headers.origin
        if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(remote) || (origin && origin !== `http://${request.headers.host}`)) {
          response.writeHead(403); response.end('Local review only.'); return
        }
        if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405); response.end(); return }
        try { await stat(artifact) } catch { response.writeHead(404); response.end('Run node scripts/noaa-sample.mjs to prepare the local sample.'); return }
        response.setHeader('Content-Type', 'application/json')
        response.setHeader('Cache-Control', 'no-store')
        response.setHeader('Vary', 'Accept-Encoding')
        if (request.method === 'HEAD') { response.end(); return }
        try {
          if (/\bgzip\b/.test(request.headers['accept-encoding'] ?? '')) {
            response.setHeader('Content-Encoding', 'gzip')
            await pipeline(createReadStream(artifact), createGzip(), response)
          } else await pipeline(createReadStream(artifact), response)
        } catch { response.destroy() }
      })
    },
  }
}
