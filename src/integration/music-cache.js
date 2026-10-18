// 按需背景音乐缓存：程序包不带 MP3，首次播放时下载到 web/audio/music/，后续请求直接由静态文件服务
// （含拖动进度所需的 Range）。优先从镜像取转码后的文件（校验 encoded），镜像不可用时回退到
// incompetech 官方原始文件（校验原始 bytes/sha256）；只接受 sources.json 登记的曲目。

import { createHash, randomBytes } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { mkdir, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// R2 公开地址（不含末尾斜杠）；对象键为 arkhamhorror/music/<localFile>。留空时只使用官方源。
export const DEFAULT_MUSIC_HOST = 'https://drliao1.com'
export const MIRROR_PREFIX = 'arkhamhorror/music/'
const DEFAULT_WEB_ROOT = fileURLToPath(new URL('../../web/', import.meta.url))
const MUSIC_PREFIX = 'audio/music/'
const OFFICIAL_SOURCE = 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/'

function readManifest(webRoot) {
  return JSON.parse(readFileSync(path.join(webRoot, 'audio', 'music', 'sources.json'), 'utf8'))
}

function mirrorBase(host) {
  if (!host) return null
  const url = new URL(host)
  if (url.protocol !== 'https:' || url.search || url.hash) throw new RangeError('背景音乐镜像必须是 HTTPS 地址')
  return url.origin + url.pathname.replace(/\/+$/, '')
}

export function createMusicAssetCache({
  webRoot = DEFAULT_WEB_ROOT,
  manifest,
  host = DEFAULT_MUSIC_HOST,
  fetchImpl = globalThis.fetch,
  timeoutMs = 5 * 60 * 1000,
} = {}) {
  const root = path.resolve(webRoot)
  const mirror = mirrorBase(host)
  const tracks = new Map()
  for (const track of (manifest || readManifest(root)).tracks || []) {
    if (typeof track.download !== 'string' || !track.download.startsWith(OFFICIAL_SOURCE)) {
      throw new RangeError('背景音乐只允许从官方 HTTPS 地址下载：' + track.localFile)
    }
    const candidates = []
    if (mirror && track.encoded) candidates.push({ url: `${mirror}/${MIRROR_PREFIX}${track.localFile}`, ...track.encoded })
    candidates.push({ url: track.download, bytes: track.bytes, sha256: track.sha256 })
    tracks.set(MUSIC_PREFIX + track.localFile, candidates)
  }
  const pending = new Map()

  async function download({ url, bytes, sha256 }) {
    const response = await fetchImpl(url, {
      redirect: 'error',
      signal: AbortSignal.timeout(timeoutMs),
      headers: { accept: 'audio/mpeg' },
    })
    if (!response.ok) return null
    const announced = Number(response.headers.get('content-length') || 0)
    if (announced && announced !== bytes) return null
    const body = Buffer.from(await response.arrayBuffer())
    return body.length === bytes && createHash('sha256').update(body).digest('hex') === sha256 ? body : null
  }

  return async function cacheMusicAsset({ relative, searchParams }) {
    if (searchParams?.getAll('cache').length !== 1 || searchParams.get('cache') !== 'cdn') return false
    const candidates = tracks.get(relative)
    if (!candidates) return false
    const target = path.resolve(root, ...relative.split('/'))
    const inside = path.relative(root, target)
    if (!inside || inside.startsWith('..') || path.isAbsolute(inside)) return false
    if (existsSync(target)) return true
    if (pending.has(relative)) return pending.get(relative)

    const job = (async () => {
      const temporary = target + '.part-' + randomBytes(6).toString('hex')
      try {
        let body = null
        for (const candidate of candidates) {
          body = await download(candidate).catch(() => null)
          if (body) break
        }
        if (!body) return false
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

export const cacheMusicAsset = createMusicAssetCache()
