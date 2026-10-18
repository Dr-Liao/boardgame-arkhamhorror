import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createServer } from '../../../lib/server.js'
import { createMusicAssetCache } from '../src/integration/music-cache.js'

const ORIGINAL = Buffer.from('ID3 original 320k body')
const ENCODED = Buffer.from('ID3 encoded 128k')
const sha = data => createHash('sha256').update(data).digest('hex')
const DOWNLOAD = 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Ritual.mp3'
const MIRROR = 'https://music.example.test'
const MIRROR_URL = MIRROR + '/arkhamhorror/music/common/ritual.mp3'
const manifest = { tracks: [{
  localFile: 'common/ritual.mp3', download: DOWNLOAD, bytes: ORIGINAL.length, sha256: sha(ORIGINAL),
  encoded: { bytes: ENCODED.length, sha256: sha(ENCODED) },
}] }
const query = value => new URLSearchParams(value)
const input = { relative: 'audio/music/common/ritual.mp3', searchParams: query('cache=cdn') }
const target = webRoot => path.join(webRoot, 'audio/music/common/ritual.mp3')

async function tempRoot(t) {
  const webRoot = await mkdtemp(path.join(tmpdir(), 'arkham-music-cache-'))
  t.after(() => rm(webRoot, { recursive: true, force: true }))
  return webRoot
}

test('优先从镜像下载转码文件，并发只下载一次，落盘后复用', async t => {
  const webRoot = await tempRoot(t)
  const requests = []
  const cache = createMusicAssetCache({
    webRoot, manifest, host: MIRROR + '/',
    fetchImpl: async url => {
      requests.push(url)
      await new Promise(resolve => setTimeout(resolve, 10))
      return new Response(ENCODED, { status: 200 })
    },
  })
  assert.deepEqual(await Promise.all([cache(input), cache(input)]), [true, true])
  assert.deepEqual(await readFile(target(webRoot)), ENCODED)
  assert.deepEqual(requests, [MIRROR_URL])
  assert.equal(await cache(input), true)
  assert.equal(requests.length, 1)
})

test('镜像失败或内容不符时回退官方原始文件', async t => {
  const webRoot = await tempRoot(t)
  const requests = []
  const cache = createMusicAssetCache({
    webRoot, manifest, host: MIRROR,
    fetchImpl: async url => {
      requests.push(url)
      return url === MIRROR_URL ? new Response(Buffer.from('ID3 tampered 128k'), { status: 200 }) : new Response(ORIGINAL, { status: 200 })
    },
  })
  assert.equal(await cache(input), true)
  assert.deepEqual(requests, [MIRROR_URL, DOWNLOAD])
  assert.deepEqual(await readFile(target(webRoot)), ORIGINAL)
})

test('未配置镜像时直接使用官方源', async t => {
  const webRoot = await tempRoot(t)
  const requests = []
  const cache = createMusicAssetCache({ webRoot, manifest, host: '', fetchImpl: async url => { requests.push(url); return new Response(ORIGINAL) } })
  assert.equal(await cache(input), true)
  assert.deepEqual(requests, [DOWNLOAD])
})

test('未登记路径、缺少 cache 参数与全部来源校验失败时不会落盘', async t => {
  const webRoot = await tempRoot(t)
  let requests = 0
  const cache = createMusicAssetCache({
    webRoot, manifest, host: MIRROR,
    fetchImpl: async () => { requests++; return new Response(Buffer.from('<html>blocked</html>'), { status: 200 }) },
  })
  assert.equal(await cache({ relative: 'audio/music/common/other.mp3', searchParams: query('cache=cdn') }), false)
  assert.equal(await cache({ relative: 'audio/music/../ritual.mp3', searchParams: query('cache=cdn') }), false)
  assert.equal(await cache({ ...input, searchParams: query('') }), false)
  assert.equal(requests, 0)
  assert.equal(await cache(input), false)
  assert.equal(requests, 2)
  await assert.rejects(readFile(target(webRoot)), { code: 'ENOENT' })
})

test('清单与镜像都不能把缓存器改造成任意远程代理', () => {
  const bad = { tracks: [{ ...manifest.tracks[0], download: 'https://example.test/ritual.mp3' }] }
  assert.throws(() => createMusicAssetCache({ manifest: bad }), /官方 HTTPS 地址/)
  assert.throws(() => createMusicAssetCache({ manifest, host: 'http://music.example.test' }), /HTTPS/)
})

test('播放器的一字节预下载请求会让大厅缓存整首曲目', async t => {
  const webRoot = await tempRoot(t)
  const cacheMusic = createMusicAssetCache({ webRoot, manifest, host: MIRROR, fetchImpl: async () => new Response(ENCODED) })
  const server = createServer({ mods: [{ id: 'music-test', web: { root: webRoot }, cacheWebAsset: cacheMusic }], persist: false })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  t.after(() => new Promise(resolve => server.close(resolve)))
  const response = await fetch(`http://127.0.0.1:${server.address().port}/mods/music-test/audio/music/common/ritual.mp3?cache=cdn`, { headers: { Range: 'bytes=0-0' } })
  assert.equal(response.status, 206)
  assert.equal((await response.arrayBuffer()).byteLength, 1)
  assert.deepEqual(await readFile(target(webRoot)), ENCODED)
})

test('真实清单覆盖全部内置曲目', () => {
  assert.doesNotThrow(() => createMusicAssetCache())
})
