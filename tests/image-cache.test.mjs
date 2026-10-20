import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createServer } from '../../../lib/server.js'
import { createImageAssetCache, DEFAULT_IMAGE_HOST } from '../src/integration/image-cache.js'

const AVIF = Buffer.concat([Buffer.from([0, 0, 0, 12]), Buffer.from('ftypavif')])
const query = value => new URLSearchParams(value)

test('默认 CDN 卡图按资源包目录原子写入并可重复复用', async t => {
  const webRoot = await mkdtemp(path.join(tmpdir(), 'arkham-image-cache-'))
  t.after(() => rm(webRoot, { recursive: true, force: true }))
  const requests = []
  const cache = createImageAssetCache({
    webRoot,
    fetchImpl: async url => {
      requests.push(url)
      return new Response(AVIF, { status: 200, headers: { 'content-type': 'image/avif' } })
    },
  })
  const input = { relative: 'img/zh/cards/01001.avif', searchParams: query('cache=cdn') }
  assert.equal(await cache(input), true)
  assert.deepEqual(await readFile(path.join(webRoot, 'img/zh/cards/01001.avif')), AVIF)
  assert.deepEqual(requests, [DEFAULT_IMAGE_HOST + '/zh/01001.avif'])
  assert.equal(await cache(input), true)
  assert.equal(requests.length, 1)
})

test('并发请求只下载一次，非法路径、非 CDN 请求与伪图片不会落盘', async t => {
  const webRoot = await mkdtemp(path.join(tmpdir(), 'arkham-image-cache-'))
  t.after(() => rm(webRoot, { recursive: true, force: true }))
  let requests = 0
  const cache = createImageAssetCache({
    webRoot,
    fetchImpl: async () => {
      requests++
      await new Promise(resolve => setTimeout(resolve, 10))
      return new Response(AVIF, { status: 200 })
    },
  })
  const input = { relative: 'img/cards/01002.avif', searchParams: query('cache=cdn') }
  assert.deepEqual(await Promise.all([cache(input), cache(input), cache(input)]), [true, true, true])
  assert.equal(requests, 1)
  assert.equal(await cache({ relative: '../outside.avif', searchParams: query('cache=cdn') }), false)
  assert.equal(await cache({ relative: 'img/cards/01003.avif', searchParams: query('') }), false)

  const reject = createImageAssetCache({
    webRoot,
    fetchImpl: async () => new Response('<html>not an image</html>', { status: 200 }),
  })
  assert.equal(await reject({ relative: 'img/cards/01004.avif', searchParams: query('cache=cdn') }), false)
  assert.rejects(readFile(path.join(webRoot, 'img/cards/01004.avif')), { code: 'ENOENT' })
})

test('服务端缓存器拒绝被改造成任意远程代理', () => {
  assert.throws(() => createImageAssetCache({ host: 'https://example.test' }), /默认 HTTPS CDN/)
  assert.throws(() => createImageAssetCache({ host: 'http://drliao1.com/arkhamhorror/cards' }), /默认 HTTPS CDN/)
})

test('大厅在静态文件缺失时调用 Mod 缓存钩子并返回新文件', async t => {
  const webRoot = await mkdtemp(path.join(tmpdir(), 'mod-web-cache-'))
  let calls = 0
  const mod = {
    id: 'cache-test',
    web: { root: webRoot },
    async cacheWebAsset({ relative, searchParams }) {
      calls++
      assert.equal(relative, 'img/cards/new.avif')
      assert.equal(searchParams.get('cache'), 'cdn')
      const target = path.join(webRoot, ...relative.split('/'))
      await mkdir(path.dirname(target), { recursive: true })
      await writeFile(target, AVIF)
      return true
    },
  }
  const server = createServer({ mods: [mod], persist: false })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  t.after(async () => {
    await new Promise(resolve => server.close(resolve))
    await rm(webRoot, { recursive: true, force: true })
  })
  const response = await fetch(`http://127.0.0.1:${server.address().port}/mods/cache-test/img/cards/new.avif?cache=cdn`)
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('content-type'), 'image/avif')
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), AVIF)
  assert.equal(calls, 1)
})
