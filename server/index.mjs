import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { networkInterfaces } from 'node:os'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, extname, sep } from 'node:path'
import { createStorage } from './storage.mjs'
import { endpoint, fetchModelsList, streamChat, testConnection } from './provider.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const port = Number(process.env.MENGNAN_PORT || 8765)
const lanMode =
  process.argv.includes('--lan') ||
  process.env.MENGNAN_LAN === '1' ||
  process.env.MENGNAN_HOST === '0.0.0.0'
const listenHost = lanMode ? '0.0.0.0' : '127.0.0.1'
const dataPath = resolve(process.env.MENGNAN_DATA_DIR || resolve(root, '.data'))
const storage = await createStorage(dataPath)
const staticRoot = resolve(root, 'dist')

const getLanIpv4List = () => {
  const result = []
  const nets = networkInterfaces()
  for (const list of Object.values(nets)) {
    for (const info of list ?? []) {
      if (info.family === 'IPv4' && !info.internal) {
        if (
          info.address.startsWith('192.168.') ||
          info.address.startsWith('10.') ||
          /^172\.(1[6-9]|2\d|3[0-1])\./.test(info.address)
        ) {
          result.push(info.address)
        }
      }
    }
  }
  return [...new Set(result)]
}

const isAllowedHostAndOrigin = (host, origin) => {
  const baseHosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`])
  const baseOrigins = new Set([
    `http://127.0.0.1:${port}`,
    `http://localhost:${port}`,
    'http://localhost:8090',
    'http://127.0.0.1:8090',
  ])
  if (lanMode) {
    for (const ip of getLanIpv4List()) {
      baseHosts.add(`${ip}:${port}`)
      baseOrigins.add(`http://${ip}:${port}`)
      baseOrigins.add(`http://${ip}:8090`)
    }
  }
  if (!baseHosts.has(host)) return false
  if (origin && !baseOrigins.has(origin)) return false
  return true
}

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
}
const json = (res, value, status = 200) => {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  })
  res.end(JSON.stringify(value ?? null))
}
async function readBody(req, limit = 64 * 1024 * 1024) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > limit) throw new Error('文件过大，单次请求最多 64 MB。')
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}
const readJson = async (req) => {
  if (!req.headers['content-type']?.startsWith('application/json')) throw new Error('Expected JSON')
  return JSON.parse((await readBody(req)).toString('utf8'))
}
const server = createServer(async (req, res) => {
  const controller = new AbortController()
  res.on('close', () => controller.abort())
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Referrer-Policy', 'no-referrer')
  res.setHeader('X-Frame-Options', 'DENY')
  try {
    const host = req.headers.host ?? ''
    const origin = req.headers.origin
    if (!isAllowedHostAndOrigin(host, origin) || req.headers['sec-fetch-site'] === 'cross-site')
      return json(res, { error: { message: 'Host or Origin not allowed' } }, 403)
    const url = new URL(req.url, `http://${host}`)
    if (url.pathname.startsWith('/api/')) {
      if (req.headers['x-mengnan-client'] !== '1')
        return json(res, { error: { message: 'Local client required' } }, 403)
      if (url.pathname === '/api/lan-info' && req.method === 'GET') {
        return json(res, {
          lan: lanMode,
          port,
          urls: getLanIpv4List().map((ip) => `http://${ip}:${port}/?mode=mobile`),
        })
      }
      if (url.pathname === '/api/connection') {
        if (req.method === 'PUT') await storage.setConfig(await readJson(req))
        else if (req.method !== 'GET') return json(res, null, 405)
        return json(res, storage.publicConfig())
      }
      if (url.pathname === '/api/connection/test' && req.method === 'POST') {
        const result = await testConnection(
          storage.config(),
          AbortSignal.any([controller.signal, AbortSignal.timeout(15000)])
        )
        return json(res, result)
      }
      if (url.pathname === '/api/connection/models' && req.method === 'POST') {
        const draft = storage.resolveDraftConfig(await readJson(req))
        const models = await fetchModelsList(
          draft,
          AbortSignal.any([controller.signal, AbortSignal.timeout(12000)])
        )
        return json(res, { models })
      }
      if (url.pathname === '/api/tavern') {
        if (req.method === 'PUT') await storage.setTavern(await readJson(req))
        else if (req.method !== 'GET') return json(res, null, 405)
        return json(res, storage.getTavern())
      }
      if (url.pathname === '/api/storage' && req.method === 'POST') {
        const { operation, args } = await readJson(req)
        return json(res, await storage.run(operation, args))
      }
      if (url.pathname === '/api/chat' && req.method === 'POST') {
        const body = await readJson(req)
        if (!Array.isArray(body.messages) || typeof body.system !== 'string')
          throw new Error('Invalid chat request')
        return await streamChat(
          storage.config(),
          body,
          res,
          AbortSignal.any([controller.signal, AbortSignal.timeout(300000)])
        )
      }
      if (url.pathname.startsWith('/api/deepseek/')) {
        const config = storage.config()
        if (config.protocol !== 'deepseek')
          return json(res, { error: { message: '附件和语音功能需要 DeepSeek 连接。' } }, 400)
        const route = url.pathname.slice('/api/deepseek'.length)
        if (!/^\/(?:anthropic\/v1\/files(?:\/[^/]+)?|v1\/tools\/(?:asr|tts))$/.test(route))
          return json(res, null, 404)
        const body = req.method === 'GET' ? undefined : await readBody(req)
        const headers = {
          Authorization: `Bearer ${config.apiKey}`,
          ...(req.headers['content-type'] ? { 'Content-Type': req.headers['content-type'] } : {}),
          ...(req.headers['anthropic-beta']
            ? { 'anthropic-beta': req.headers['anthropic-beta'] }
            : {}),
        }
        const upstream = await fetch(endpoint(config, route), {
          method: req.method,
          headers,
          body,
          signal: controller.signal,
        })
        res.writeHead(upstream.status, {
          'Content-Type': upstream.headers.get('content-type') || 'application/octet-stream',
        })
        if (upstream.body) for await (const chunk of upstream.body) res.write(chunk)
        res.end()
        return
      }
      return json(res, { error: { message: 'Not found' } }, 404)
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') return json(res, null, 405)
    const file = resolve(
      staticRoot,
      `.${decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname)}`
    )
    if (!file.startsWith(staticRoot + sep)) return json(res, null, 403)
    try {
      if (!(await stat(file)).isFile()) return json(res, null, 404)
      res.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream' })
      res.end(req.method === 'HEAD' ? undefined : await readFile(file))
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end('请先运行 pnpm build，或使用 pnpm dev 打开开发界面。')
    }
  } catch (error) {
    if (controller.signal.aborted) return
    const message = String(error.message || '请求失败').replaceAll(
      storage.config().apiKey || '\0',
      '[redacted]'
    )
    if (res.headersSent) res.end()
    else json(res, { error: { message } }, 400)
  }
})
server.listen(port, listenHost, () => {
  console.log(`猫猫酒馆本地服务：http://127.0.0.1:${port}`)
  console.log(`手机 APP 陪伴模式：http://127.0.0.1:${port}/?mode=mobile`)
  if (lanMode) {
    for (const ip of getLanIpv4List()) {
      console.log(`局域网真机手机访问：http://${ip}:${port}/?mode=mobile`)
    }
  }
  console.log(`数据目录：${dataPath}`)
  console.log('此窗口需要保持打开；按 Ctrl+C 停止。')
})
server.on('error', (error) => {
  console.error(error.message)
  process.exitCode = 1
})
