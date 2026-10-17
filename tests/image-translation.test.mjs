import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import sharp from 'sharp'
import { inspectImage } from '../tools/image-integrity.mjs'
import {
  buildTerminologies,
  buildTranslationJobs,
  createRateGate,
  parseTranslationArgs,
  refreshLocalInventory,
  runTranslations,
  saveTranslatedImage,
  withHttpRetry,
  writeBatchManifest,
} from '../tools/translate-images.mjs'

const options = overrides => ({
  ...parseTranslationArgs(['--estimate']),
  ...overrides,
})

test('翻译参数限制模式、范围与请求速率', () => {
  assert.deepEqual(parseTranslationArgs(['--run', '--limit=10', '--rpm=2', '--codes=a,b', '--packs=p']).codes, ['a', 'b'])
  assert.throws(() => parseTranslationArgs(['--run', '--verify']), /只能指定一个模式/)
  assert.throws(() => parseTranslationArgs(['--run', '--rpm=0']), /rpm/)
  assert.throws(() => parseTranslationArgs(['--run', '--api-base=file:\/\/local']), /HTTP/)
})

test('缺图任务按首选美术编号生成，支持 ArkhamDB 原图和 CDN 回退', () => {
  const cards = {
    a: { code: 'a', originalCode: 'a', pack: 'p', name: 'Card A', nameZh: '卡牌甲', traits: ['Item'], traitsZh: ['道具'] },
    b: { code: 'b', originalCode: 'b', pack: 'p', name: 'Card B', nameZh: '卡牌乙', traits: [], traitsZh: [] },
    c: { code: 'c', originalCode: 'c', pack: 'q', name: 'Card C', nameZh: '卡牌丙', traits: [], traitsZh: [] },
  }
  const descriptors = {
    a: { front: { candidates: [{ path: 'cards/10001.avif' }] } },
    b: { front: { candidates: [{ path: 'cards/10002a.avif' }] } },
    c: { front: { candidates: [{ path: 'cards/10003.avif' }] } },
  }
  const jobs = buildTranslationJobs({
    cards,
    rawEnglish: { a: { imagesrc: '/bundles/cards/10001.png' }, b: {} },
    options: options({ packs: ['p'] }),
    localized: code => code === 'c',
    descriptor: code => descriptors[code],
  })
  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs.map(job => job.art), ['10001', '10002a'])
  assert.equal(jobs[0].sourceUrl, 'https://arkhamdb.com/bundles/cards/10001.png')
  assert.equal(jobs[0].directSource, true)
  assert.equal(jobs[1].sourceUrl, 'https://assets.arkhamhorror.app/img/arkham/cards/10002a.avif')
  assert.equal(jobs[1].directSource, false)
  assert.ok(jobs[0].terminologies.some(pair => pair.src === 'Card A' && pair.tgt === '卡牌甲'))
})

test('术语表去重、忽略未翻译值并限制为 API 上限', () => {
  const terms = buildTerminologies({
    name: 'Same',
    nameZh: 'Same',
    subname: 'Power',
    subnameZh: '力量',
    traits: ['Item', 'Item'],
    traitsZh: ['道具', '道具'],
  })
  assert.ok(!terms.some(pair => pair.src === 'Same'))
  assert.equal(terms.filter(pair => pair.src === 'Item').length, 1)
  assert.ok(terms.length <= 50)
})

test('MCP 批次清单与目标映射分开持久化', async t => {
  const directory = await mkdtemp(path.join(tmpdir(), 'arkham-qwen-manifest-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const manifestPath = path.join(directory, 'pilot.json')
  const result = writeBatchManifest([{
    code: '10001',
    art: '10001',
    sourceUrl: 'https://source.test/10001.png',
    targetRelative: 'zh/cards/10001.avif',
    targetFile: path.join(directory, '10001.avif'),
  }], { manifestPath })
  assert.equal(result.items, 1)
  assert.deepEqual(JSON.parse(await readFile(manifestPath, 'utf8')), [{
    id: '10001',
    image_url: 'https://source.test/10001.png',
    filename: '10001.jpg',
  }])
  const metadata = JSON.parse(await readFile(result.metadataPath, 'utf8'))
  assert.equal(metadata.items[0].code, '10001')
  assert.equal(metadata.items[0].targetRelative, 'zh/cards/10001.avif')
})

test('HTTP 重试只重试暂时错误，速率门首个请求不等待', async () => {
  let attempts = 0
  const waits = []
  const value = await withHttpRetry(async () => {
    attempts++
    if (attempts < 3) throw Object.assign(new Error('busy'), { status: 429 })
    return 'ok'
  }, { attempts: 3, sleepImpl: async ms => waits.push(ms), random: () => 0 })
  assert.equal(value, 'ok')
  assert.equal(attempts, 3)
  assert.deepEqual(waits, [1000, 2000])

  let clock = 0
  const rateWaits = []
  const gate = createRateGate(2, {
    now: () => clock,
    sleepImpl: async ms => { rateWaits.push(ms); clock += ms },
  })
  await gate()
  await gate()
  assert.deepEqual(rateWaits, [30_000])
})

test('带 attachment 响应在后台保存并原子转换为 AVIF', async t => {
  const directory = await mkdtemp(path.join(tmpdir(), 'arkham-qwen-image-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const target = path.join(directory, 'zh', 'cards', '10001.avif')
  const png = await sharp({
    create: { width: 128, height: 180, channels: 3, background: '#efe7ce' },
  }).png().toBuffer()
  const result = await saveTranslatedImage('https://result.test/card.jpg', target, {
    fetchImpl: async () => new Response(png, {
      headers: {
        'content-type': 'image/jpeg',
        'content-disposition': 'attachment',
        'x-oss-force-download': 'true',
      },
    }),
  })
  assert.equal(result.width, 128)
  assert.equal(result.height, 180)
  assert.ok(result.bytes > 0)
  assert.ok(inspectImage(await readFile(target), target).bytes > 0)
})

test('本地清单收录生成图，失败日志不会泄露 API Key', async t => {
  const directory = await mkdtemp(path.join(tmpdir(), 'arkham-qwen-state-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const publicImg = path.join(directory, 'img')
  const inventoryFile = path.join(directory, 'local-images.json')
  const cardDirectory = path.join(publicImg, 'zh', 'cards')
  const cardFile = path.join(cardDirectory, '10001.avif')
  await mkdir(cardDirectory, { recursive: true })
  await sharp({ create: { width: 32, height: 48, channels: 3, background: '#000' } }).avif().toFile(cardFile)
  const inventory = refreshLocalInventory({ publicImg, inventoryFile })
  assert.equal(inventory.byLanguage.zh, 1)
  assert.deepEqual(inventory.files, ['zh/cards/10001.avif'])

  const apiKey = 'sk-secret-value'
  const job = {
    code: 'x',
    art: '10002',
    sourceUrl: 'https://source.test/10002.png',
    directSource: true,
    targetRelative: 'zh/cards/10002.avif',
    targetFile: path.join(directory, '10002.avif'),
    terminologies: [],
  }
  const result = await runTranslations(options({
    mode: 'run',
    retries: 1,
    pollMs: 100,
    pollTimeoutMs: 100,
    rpm: 60,
  }), {
    jobs: [job],
    apiKey,
    stateFile: path.join(directory, 'state.json'),
    rateGate: async () => {},
    sleepImpl: async () => {},
    fetchImpl: async () => new Response(JSON.stringify({ message: `denied ${apiKey}` }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    }),
    refreshInventory: () => ({ total: 0, byLanguage: { zh: 0 } }),
  })
  assert.equal(result.failed, 1)
  assert.ok(!JSON.stringify(result).includes(apiKey))
  assert.ok(!(await readFile(path.join(directory, 'state.json'), 'utf8')).includes(apiKey))
})
