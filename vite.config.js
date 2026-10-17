import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'
import handler from './api/index.js'

const readBody = req =>
  new Promise(resolve => {
    let data = ''
    req.on('data', c => (data += c))
    req.on('end', () => {
      if (!data) return resolve(undefined)
      try { resolve(JSON.parse(data)) } catch { resolve(undefined) }
    })
  })

function localApi() {
  return {
    name: 'local-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const path = (req.url || '').split('?')[0]
        if (path !== '/api' && path !== '/api/') return next()
        const url = new URL(req.url, 'http://localhost')
        req.query = Object.fromEntries(url.searchParams)
        if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) req.body = await readBody(req)
        res.status = code => { res.statusCode = code; return res }
        res.json = data => {
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(JSON.stringify(data))
        }
        try {
          await handler(req, res)
        } catch (e) {
          console.error(e)
          if (!res.headersSent) {
            res.statusCode = 500
            res.end('{"error":"Server error. Please try again."}')
          }
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  Object.assign(process.env, loadEnv(mode, resolve(process.cwd(), '..'), ''), loadEnv(mode, process.cwd(), ''))
  return { plugins: [react(), localApi()] }
})
