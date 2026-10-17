// 按需卡图缓存：默认 CDN 图片首次展示时下载到 Mod 的 web/img/，
// 目录结构与独立卡图资源包完全一致，后续请求直接由静态文件服务。

import { randomBytes } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const DEFAULT_IMAGE_HOST = 'https://assets.arkhamhorror.app'
const DEFAULT_WEB_ROOT = fileURLToPath(new URL('../../web/', import.meta.url))
const MAX_IMAGE_BYTES = 20 * 1024 * 1024
const SAFE_IMAGE_PATH = /^img\/(?:zh\/)?(?:cards|backs)\/[A-Za-z0-9][A-Za-z0-9_.-]*\.(?:avif|webp|png|jpe?g|gif)$/

function isImage(body, extension) {
  if (!body.length) return false
  if (extension === '.avif') return body.length >= 12 && body.subarray(4, 8).toString('ascii') === 'ftyp' &&
    /avif|avis/.test(body.subarray(8, Math.min(body.length, 40)).toString('ascii'))
  if (extension === '.webp') return body.length >= 12 && body.subarray(0, 4).toString('ascii') === 'RIFF' &&
    body.subarray(8, 12).toString('ascii') === 'WEBP'
  if (extension === '.png') return body.length >= 8 && body.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  if (extension === '.jpg' || extension === '.jpeg') return body.length >= 3 && body[0] === 0xff && body[1] === 0xd8 && body[2] === 0xff
  if (extension === '.gif') return body.length >= 6 && /^GIF8[79]a$/.test(body.subarray(0, 6).toString('ascii'))
  return false
}

export function createImageAssetCache({
  webRoot = DEFAULT_WEB_ROOT,
  host = DEFAULT_IMAGE_HOST,
  fetchImpl = globalThis.fetch,
  timeoutMs = 15000,
  maxBytes = MAX_IMAGE_BYTES,
} = {}) {
  const root = path.resolve(webRoot)
  const source = new URL(host)
  const sourceBase = source.origin + source.pathname.replace(/\/+$/, '')
  if (source.protocol !== 'https:' || sourceBase !== DEFAULT_IMAGE_HOST) {
    throw new RangeError('按需卡图缓存只允许使用默认 HTTPS CDN')
  }
  const pending = new Map()

  return async function cacheWebAsset({ relative, searchParams }) {
    if (searchParams?.getAll('cache').length !== 1 || searchParams.get('cache') !== 'cdn') return false
    if (typeof relative !== 'string' || !SAFE_IMAGE_PATH.test(relative)) return false
    const target = path.resolve(root, ...relative.split('/'))
    const inside = path.relative(root, target)
    if (!inside || inside.startsWith('..') || path.isAbsolute(inside)) return false
    if (existsSync(target)) return true
    if (pending.has(relative)) return pending.get(relative)

    const job = (async () => {
      const temporary = target + '.part-' + randomBytes(6).toString('hex')
      try {
        const remotePath = relative.slice('img/'.length)
        const response = await fetchImpl(`${sourceBase}/img/arkham/${remotePath}`, {
          redirect: 'error',
          signal: AbortSignal.timeout(timeoutMs),
          headers: { accept: 'image/avif,image/webp,image/png,image/jpeg,image/gif' },
        })
        if (!response.ok) return false
        const announced = Number(response.headers.get('content-length') || 0)
        if (announced > maxBytes) return false
        const body = Buffer.from(await response.arrayBuffer())
        if (body.length > maxBytes || !isImage(body, path.extname(target).toLowerCase())) return false
        await mkdir(path.dirname(target), { recursive: true })
        await writeFile(temporary, body, { flag: 'wx' })
        try {
          await rename(temporary, target)
        } catch (error) {
          if (!existsSync(target)) throw error
          await rm(temporary, { force: true })
        }
        return true
      } catch {
        await rm(temporary, { force: true }).catch(() => {})
        return false
      }
    })().finally(() => pending.delete(relative))
    pending.set(relative, job)
    return job
  }
}

export const cacheWebAsset = createImageAssetCache()
