import test from 'node:test'
import assert from 'node:assert/strict'
import { after, before } from 'node:test'
import { loadMods } from '../../../lib/mods.js'
import { createServer } from '../../../lib/server.js'
import { cardFaceText } from '../web/catalog.js'

let base
let server
let resourceVersion

before(async () => {
  server = createServer({ mods: await loadMods(), persist: false })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  base = `http://127.0.0.1:${server.address().port}`
  resourceVersion = (await get('/api/mods/arkhamhorror/catalog/meta')).body.resourceVersion
})

after(() => new Promise(resolve => server.close(resolve)))

async function get(path, init) {
  const response = await fetch(base + path, init)
  const text = await response.text()
  let body = null
  try { body = text ? JSON.parse(text) : null } catch { body = text }
  return { status: response.status, headers: response.headers, body, text }
}

test('目录元数据提供筛选口径、资源版本与图片语言来源', async () => {
  const { status, body } = await get('/api/mods/arkhamhorror/catalog/meta')
  assert.equal(status, 200)
  assert.equal(body.ok, true)
  assert.match(body.resourceVersion, /^[0-9a-f]{64}$/)
  assert.equal(body.total, 5930)
  assert.equal(body.types.length, 13)
  assert.ok(body.packs.length > 40)
  assert.ok(body.classes.length >= 6)
  assert.ok(body.effectStatuses.length >= 1)
  assert.ok(body.availabilityStatuses.length >= 1)
  assert.equal(body.images.localizedLanguage, 'zh')
  assert.equal(body.images.verifiedRemoteImages, 0)
  assert.equal(body.images.source.cardArts, 5065)
  assert.equal(body.types.reduce((sum, type) => sum + type.count, 0), 5930)
})

test('图鉴支持分页与组合筛选，列表项自带卡图描述符', async () => {
  const page = await get('/api/mods/arkhamhorror/catalog?limit=24&offset=0')
  assert.equal(page.body.total, 5930)
  assert.equal(page.body.cards.length, 24)
  assert.equal(page.body.offset, 0)
  const second = await get('/api/mods/arkhamhorror/catalog?limit=24&offset=24')
  assert.notEqual(second.body.cards[0].code, page.body.cards[0].code)
  assert.ok(page.body.cards.every(card => card.images && card.images.front.candidates.length))
  assert.ok(page.body.cards.every(card => ['local', 'remote-candidate'].includes(card.imageStatus)))

  const investigators = await get('/api/mods/arkhamhorror/catalog?type=investigator&limit=1')
  assert.equal(investigators.body.total, 111)
  const locations = await get('/api/mods/arkhamhorror/catalog?type=location&limit=1')
  assert.equal(locations.body.total, 1258)
  const guardians = await get('/api/mods/arkhamhorror/catalog?type=asset&klass=guardian&limit=1')
  assert.ok(guardians.body.total > 0 && guardians.body.total < 1256)
  const core = await get('/api/mods/arkhamhorror/catalog?packCode=core&limit=1')
  assert.ok(core.body.total > 0)
  const strict = await get('/api/mods/arkhamhorror/catalog?availability=strict&limit=1')
  assert.ok(strict.body.total > 0)
  assert.equal(strict.body.cards[0].availability, 'strict')
  const single = await get('/api/mods/arkhamhorror/catalog?q=01119')
  assert.equal(single.body.total, 1)
  assert.equal(single.body.cards[0].code, '01119')
  const named = await get('/api/mods/arkhamhorror/catalog?name=' + encodeURIComponent('罗兰'))
  assert.ok(named.body.cards.some(card => card.code === '01001'))
  const missing = await get('/api/mods/arkhamhorror/catalog?q=' + encodeURIComponent('不存在的卡'))
  assert.deepEqual(missing.body.cards, [])
})

test('非法分页与重复参数明确拒绝，不静默截断', async () => {
  for (const query of ['limit=0', 'limit=201', 'limit=-1', 'offset=-1', 'limit=abc', 'type=a&type=b', 'v=1&v=2']) {
    const { status, body } = await get('/api/mods/arkhamhorror/catalog?' + query)
    assert.ok([400, 409].includes(status), query + ' → ' + status)
    assert.equal(body.ok, false, query)
  }
})

test('卡牌详情给出双面文本、状态与关联面，且不下发原始追溯', async () => {
  const { status, body, text } = await get('/api/mods/arkhamhorror/cards/01001')
  assert.equal(status, 200)
  assert.equal(body.card.code, '01001')
  assert.equal(body.card.nameZh.length > 0, true)
  assert.ok(body.card.backTextZh || body.card.backText)
  assert.equal(body.card.images.hasBackArt, true)
  assert.equal(body.card.localeStatus, 'complete')
  assert.ok(typeof body.card.effectStatus === 'string')
  assert.ok(typeof body.card.availability === 'string')
  assert.ok(body.card.imageNote.includes('候选'))
  assert.equal(body.card.strictAccepted, true)
  for (const leak of ['provenance', 'rawSources', 'canonicalSource', '"raw"']) {
    assert.equal(text.includes(leak), false, leak)
  }
  const agenda = await get('/api/mods/arkhamhorror/cards/01121a')
  assert.equal(agenda.body.linkedCard.code, '01121b')
  assert.equal(agenda.body.card.images.back.candidates[0].path, 'cards/01121b.avif')
  const enemy = await get('/api/mods/arkhamhorror/cards/01121b')
  assert.equal(enemy.body.card.images.back.candidates[0].path, 'cards/01121a.avif')
  // 有些地点只由背面故事卡指回正面；接口仍须下发背面卡文，不能退化为通用卡背。
  const location = await get('/api/mods/arkhamhorror/cards/03328e')
  assert.equal(location.body.linkedCard.code, '03328f')
  assert.equal(location.body.linkedCard.nameZh, '拱门')
  assert.match(location.body.linkedCard.textZh, /检定\[willpower\]\(1\)/)
  const locationBack = cardFaceText(location.body.card, location.body.linkedCard, 'back')
  assert.equal(locationBack.name, '拱门')
  assert.match(locationBack.text, /检定\[willpower\]\(1\)/)
  const weakness = await get('/api/mods/arkhamhorror/cards/01011')
  assert.ok(weakness.body.card.differenceNotes.length >= 0)
})

test('敌人卡详情下发每名调查员生命加值，图鉴才能算有效生命', async () => {
  const { status, body } = await get('/api/mods/arkhamhorror/cards/02058')
  assert.equal(status, 200)
  assert.equal(body.card.health, 7)
  assert.equal(body.card.healthPerPlayerBonus, 3)
  // 没有每人加值的敌人不受影响，也不凭空多出字段。
  const plain = await get('/api/mods/arkhamhorror/cards/01116')
  assert.equal(plain.body.card.healthPerPlayerBonus, undefined)
})

test('胆量使用玩家卡背并公开剧本指定属性', async () => {
  const { status, body } = await get('/api/mods/arkhamhorror/cards/xcourage')
  assert.equal(status, 200)
  assert.equal(body.card.nameZh, '胆量')
  assert.equal(body.card.type, 'asset')
  assert.equal(body.card.cost, 0)
  assert.equal(body.card.sanity, 2)
  assert.deepEqual(body.card.icons, {})
  assert.equal(body.card.images.front.kind, 'generic-back')
  assert.equal(body.card.images.front.candidates[0].path, 'backs/back_player.webp')
  assert.match(body.card.textZh, /费用为0.*神智值为2.*无技能图标/)
})

test('未知卡号 404、非法卡号 400，不暴露内部错误', async () => {
  assert.equal((await get('/api/mods/arkhamhorror/cards/09999999')).status, 404)
  assert.equal((await get('/api/mods/arkhamhorror/cards/icyGhoul')).status, 404)
  assert.equal((await get('/api/mods/arkhamhorror/cards/' + encodeURIComponent('../../secret'))).status, 400)
  assert.equal((await get('/api/mods/arkhamhorror/cards/' + encodeURIComponent('__proto__'))).status, 404)
  assert.equal((await get('/api/mods/arkhamhorror/cards/' + encodeURIComponent('constructor'))).status, 404)
  assert.equal((await get('/api/mods/arkhamhorror/catalog', { method: 'POST' })).status, 405)
})

test('版本化响应支持 immutable 缓存、条件请求与 HEAD', async () => {
  const fresh = await get('/api/mods/arkhamhorror/catalog?limit=1')
  assert.match(fresh.headers.get('cache-control'), /must-revalidate/)
  const versioned = await get('/api/mods/arkhamhorror/catalog?limit=1&v=' + resourceVersion)
  assert.match(versioned.headers.get('cache-control'), /immutable/)
  const etag = versioned.headers.get('etag')
  assert.ok(etag)
  const conditional = await fetch(base + '/api/mods/arkhamhorror/catalog?limit=1&v=' + resourceVersion, { headers: { 'if-none-match': etag } })
  assert.equal(conditional.status, 304)
  assert.equal((await conditional.text()).length, 0)
  const head = await fetch(base + '/api/mods/arkhamhorror/catalog?limit=1', { method: 'HEAD' })
  assert.equal(head.status, 200)
  assert.equal((await head.text()).length, 0)
  const stale = await get('/api/mods/arkhamhorror/catalog?limit=1&v=' + 'f'.repeat(64))
  assert.equal(stale.status, 409)
  assert.equal(stale.body.resourceVersion, resourceVersion)
})

test('静态展示代码可加载，越界路径被拒绝，其他 Mod 与对局接口不受影响', async () => {
  // Mod 自带资源挂在 /mods/<id>/ 下；大厅 public/ 只放通用外壳。
  for (const [path, type] of [
    ['/mods/arkhamhorror/game-ui.js', 'text/javascript'],
    ['/mods/arkhamhorror/catalog.js', 'text/javascript'],
    ['/mods/arkhamhorror/images.js', 'text/javascript'],
    ['/mods/arkhamhorror/style.css', 'text/css'],
    ['/mods/arkhamhorror/img/cards/01001.avif', 'image/avif'],
    ['/app.js', 'text/javascript'],
    ['/style.css', 'text/css'],
    ['/index.html', 'text/html'],
  ]) {
    const response = await fetch(base + path)
    assert.equal(response.status, 200, path)
    assert.match(response.headers.get('content-type'), new RegExp(type), path)
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff', path)
  }
  // 诡镇专属资源不得再从大厅根路径暴露
  for (const path of ['/arkham-catalog.js', '/arkham-images.js', '/img/arkham/cards/01001.avif']) {
    assert.equal((await fetch(base + path)).status, 404, path)
  }
  for (const path of ['/../package.json', '/..%2fpackage.json', '/games/arkhamhorror/cards-data.js', '/%2e%2e/server.js', '/参考资源/x.json',
    '/mods/arkhamhorror/../../package.json', '/mods/arkhamhorror/..%2f..%2fserver.js', '/mods/unknown/x.js']) {
    const response = await fetch(base + path)
    assert.ok([403, 404].includes(response.status), path + ' → ' + response.status)
  }
  const catalog = await get('/api/catalog')
  assert.equal(catalog.headers.get('cache-control'), 'no-store')
  assert.deepEqual(catalog.body.games.map(game => game.id).sort(), ['arkhamhorror', 'gobang', 'ox'])
  // 大厅只下发 Mod 资源的地址，不感知其内容
  const arkham = catalog.body.games.find(game => game.id === 'arkhamhorror')
  assert.deepEqual(arkham.web, { client: '/mods/arkhamhorror/game-ui.js', styles: '/mods/arkhamhorror/style.css', mount: '/mods/arkhamhorror' })
  assert.equal(arkham.api, '/api/mods/arkhamhorror')
  assert.equal(catalog.body.games.find(game => game.id === 'gobang').web, null)
  assert.equal(catalog.body.games.find(game => game.id === 'gobang').api, null)
  assert.equal((await get('/api/mods/gobang/catalog')).status, 404)
  const started = await get('/api/start', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ modId: 'gobang', settings: { opponents: ['__random__'] } }),
  })
  assert.equal(started.body.ok, true)
  assert.equal(started.headers.get('cache-control'), 'no-store')
})

test('对局响应只嵌入本局所需卡牌定义，图鉴不扩大运行许可', async () => {
  const started = await get('/api/start', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ modId: 'arkhamhorror', settings: { legacyAutoStart: true, opponents: [], teammates: 0, playerInvestigator: '01001' } }),
  })
  assert.equal(started.body.ok, true, started.text.slice(0, 200))
  const state = started.body.session.state
  assert.ok(Object.keys(state.cards).length <= 253)
  for (const inv of state.investigators) {
    for (const code of [...inv.hand, ...inv.deck]) assert.ok(state.cards[code], code)
  }
  assert.equal(state.cards['09001'], undefined)
  assert.ok(!JSON.stringify(state).includes('"images"'))
  const illegal = await get('/api/start', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ modId: 'arkhamhorror', settings: { opponents: [], teammates: 0, playerInvestigator: '09001' } }),
  })
  assert.equal(illegal.body.ok, false)
})
