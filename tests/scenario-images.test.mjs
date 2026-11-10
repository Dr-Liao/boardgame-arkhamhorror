import test from 'node:test'
import assert from 'node:assert/strict'
import { handleApi } from '../src/integration/web-api.js'
import { scenarioCardCodes } from '../src/integration/scenario-images.js'
import { preloadOne } from '../web/catalog.js'
import { imageCandidates } from '../web/images.js'
import { imagePreloadContext, runImagePreloadBatches, waitForImageIdle } from '../web/image-preload.js'
import { trackImageResource, disposeImageResources, observeImageViewport } from '../web/image-lifecycle.js'

const get = path => handleApi({ path, searchParams: new URLSearchParams() })

test('小图候选保持语言与原画顺序，原图模式不请求缩略图', () => {
  const images = get('scenarios/theGathering/images').body.cards[0].images
  const full = imageCandidates(images)
  const small = imageCandidates(images, { thumbnail: true })
  assert.ok(small[0].thumbnail)
  assert.ok(small[0].url.includes('/img/thumbs/'))
  assert.equal(small[1].url, full[0].url)
  assert.equal(small[0].language, full[0].language)
  assert.ok(full.every(candidate => !candidate.thumbnail))
})

test('移除节点清理资源，保留的节点跨重绘继续使用', async t => {
  let notify
  const savedObserver = globalThis.MutationObserver, savedDocument = globalThis.document
  let disconnected = 0
  globalThis.document = { documentElement: {} }
  globalThis.MutationObserver = class {
    constructor(callback) { notify = callback }
    observe() {}
    disconnect() { disconnected++ }
  }
  t.after(() => { disposeImageResources(); globalThis.MutationObserver = savedObserver; globalThis.document = savedDocument })
  let cleaned = 0
  const node = { isConnected: true }
  trackImageResource(node, () => cleaned++)
  await Promise.resolve()
  notify([{ removedNodes: [node] }])
  await Promise.resolve()
  assert.equal(cleaned, 0, 'DOM 搬移后仍连接则不释放')
  node.isConnected = false
  notify([{ removedNodes: [node] }])
  await Promise.resolve()
  assert.equal(cleaned, 1)
  disposeImageResources()
  assert.equal(cleaned, 1)
  assert.ok(disconnected > 0)
})

test('预加载取消与超时均清空图片请求，取消不污染失败记录', async t => {
  const previous = globalThis.Image
  const instances = []
  globalThis.Image = class {
    constructor() { instances.push(this) }
    removeAttribute(name) { if (name === 'src') this.src = '' }
  }
  t.after(() => { globalThis.Image = previous })
  const candidate = [{ url: 'https://test.invalid/preload-cancel.webp' }]
  const controller = new AbortController()
  const pending = preloadOne(candidate, controller.signal)
  assert.equal(instances.length, 1)
  controller.abort()
  await pending
  assert.equal(instances[0].src, '')
  assert.equal(instances[0].onload, null)
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const timeout = preloadOne(candidate, new AbortController().signal)
  assert.equal(instances.length, 2, '取消后同一候选可以再次加载')
  t.mock.timers.tick(20000)
  await timeout
  assert.equal(instances[1].src, '')
})
test('关卡卡图清单覆盖剧本参考、密谋、场景、地点与遭遇牌，参考与密谋优先', () => {
  const codes = scenarioCardCodes('theGathering')
  assert.equal(codes[0], '01104')
  assert.deepEqual(codes.slice(1, 7), ['01105', '01106', '01107', '01108', '01109', '01110'])
  for (const code of ['01111', '01115', '01116', '01117', '01159', '01168']) assert.ok(codes.includes(code), code)
  assert.equal(new Set(codes).size, codes.length)

  const carcosa = scenarioCardCodes('curtainCall')
  for (const code of ['03043', '03044', '03047a', '03049', '03058', '03059', '03060']) assert.ok(carcosa.includes(code), code)
})

test('关卡卡图接口下发图鉴同款描述符，并拒绝未知或非法关卡', () => {
  const response = get('scenarios/theMidnightMasks/images')
  assert.equal(response.body.scenarioId, 'theMidnightMasks')
  assert.ok(response.body.cards.length > 20)
  for (const entry of response.body.cards) {
    assert.ok(Array.isArray(entry.images.front.candidates) && Array.isArray(entry.images.back.candidates), entry.code)
  }
  assert.equal(get('scenarios/unknownScenario/images').status, 404)
  assert.equal(get('scenarios/..%2F/images').status, 400)
})

test('preload prioritizes near-term art, uses four primary workers and idle single-worker batches', async () => {
  let active = 0, maxActive = 0
  const events = []
  const task = name => async () => {
    active++; maxActive = Math.max(maxActive, active)
    await Promise.resolve()
    events.push(name); active--
  }
  await runImagePreloadBatches(Array.from({ length: 6 }, (_, i) => task('p' + i)),
    Array.from({ length: 9 }, (_, i) => task('b' + i)), new AbortController().signal,
    async () => { assert.equal(active, 0); events.push('idle') })
  assert.equal(maxActive, 4)
  assert.ok(events.slice(0, 6).every(event => event.startsWith('p')))
  assert.deepEqual(events.slice(6), ['idle', 'b0', 'b1', 'b2', 'b3', 'idle', 'b4', 'b5', 'b6', 'b7', 'idle', 'b8'])
})

test('cancelling idle wait prevents subsequent background work', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const controller = new AbortController()
  let started = 0
  const run = runImagePreloadBatches([], [async () => started++], controller.signal)
  await Promise.resolve()
  controller.abort()
  await run
  t.mock.timers.tick(10000)
  assert.equal(started, 0)
  await waitForImageIdle(controller.signal)
})

test('preload context uses current hand/public board and only the observers campaign deck', () => {
  const context = imagePreloadContext({ mySeat: 0, state: {
    cards: { assetAlias: { originalCode: '01016' } },
    investigators: [{ seat: 0, code: '01001', hand: ['01017'], assets: ['assetAlias'] },
      { seat: 1, code: '01002', hand: ['01018'] }],
    acts: [{ originalCode: '01108' }], actIndex: 0,
    agendas: [{ originalCode: '01105' }], agendaIndex: 0,
    locations: [{ originalCode: '01111' }],
    campaign: { investigators: [{ deck: ['01017', '01019'] }, { deck: ['01020'] }] },
  } })
  assert.deepEqual(context.priority, ['01001', '01017', '01016', '01002', '01108', '01105', '01111'])
  assert.deepEqual(context.deck, ['01019'])
})

test('offscreen eviction is delayed, cancelled on reentry and stopped on disposal', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const previous = globalThis.IntersectionObserver
  let notify, options, disconnected = 0, entered = 0, exited = 0
  globalThis.IntersectionObserver = class {
    constructor(callback, config) { notify = callback; options = config }
    observe() {}
    disconnect() { disconnected++ }
  }
  t.after(() => { globalThis.IntersectionObserver = previous })
  const stop = observeImageViewport({ isConnected: true }, { enter: () => entered++, exit: () => exited++ })
  await Promise.resolve()
  assert.equal(options.rootMargin, '600px')
  notify([{ isIntersecting: true }])
  notify([{ isIntersecting: false }])
  t.mock.timers.tick(2999)
  assert.equal(exited, 0)
  notify([{ isIntersecting: true }])
  t.mock.timers.tick(3000)
  assert.equal(exited, 0)
  notify([{ isIntersecting: false }])
  t.mock.timers.tick(3000)
  assert.equal(exited, 1)
  stop()
  notify([{ isIntersecting: true }])
  assert.equal(entered, 2)
  assert.equal(disconnected, 1)
})

test('scenario manifest prioritizes reference, first act/agenda and initial location', () => {
  const cards = get('scenarios/theGathering/images').body.cards
  const initial = cards.filter(card => card.priority === 'initial').map(card => card.code)
  for (const code of ['01104', '01105', '01108', '01111']) assert.ok(initial.includes(code), code)
  assert.ok(cards.some(card => card.priority === 'background'))
})

test('retained images rebind viewport observers when their scroll container is replaced', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const saved = { io: globalThis.IntersectionObserver, mo: globalThis.MutationObserver,
    document: globalThis.document, style: globalThis.getComputedStyle }
  const instances = []
  let mutation, entered = 0, exited = 0
  globalThis.document = { documentElement: {} }
  globalThis.getComputedStyle = () => ({ overflowY: 'auto', overflowX: 'visible' })
  globalThis.MutationObserver = class {
    constructor(callback) { mutation = callback }
    observe() {}
    disconnect() {}
  }
  globalThis.IntersectionObserver = class {
    constructor(callback, options) { this.callback = callback; this.root = options.root; instances.push(this) }
    observe() {}
    disconnect() { this.disconnected = true }
  }
  t.after(() => {
    disposeImageResources()
    globalThis.IntersectionObserver = saved.io; globalThis.MutationObserver = saved.mo
    globalThis.document = saved.document; globalThis.getComputedStyle = saved.style
  })
  const previous = { parentElement: null }, next = { parentElement: null }
  const node = { isConnected: true, parentElement: previous }
  const stop = observeImageViewport(node, { enter: () => entered++, exit: () => exited++ })
  trackImageResource(node, stop, () => stop.refresh())
  await Promise.resolve()
  assert.equal(instances[0].root, previous)
  instances[0].callback([{ isIntersecting: true }])
  node.parentElement = next
  mutation([{ removedNodes: [previous] }])
  await Promise.resolve()
  assert.equal(instances[0].disconnected, true)
  assert.equal(instances[1].root, next)
  instances[0].callback([{ isIntersecting: false }])
  instances[1].callback([{ isIntersecting: true }])
  t.mock.timers.tick(3000)
  assert.equal(entered, 2)
  assert.equal(exited, 0, 'obsolete observer must not evict visible retained art')
})
