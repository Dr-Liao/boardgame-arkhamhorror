// 07-a 印斯茅斯暗潮 · 分片 6（A Light in the Fog，07220–07260）独立验收证据。
//
// 既有 TIC 测试没有「标题含卡号」用例的 9 张卡补逐卡真实断言：
//   07226 哈米吉多顿 / 07227 混乱之眼 / 07228 暗影遁形（玩家卡，真实引擎）
//   07240 灯塔梯井（章节地点 [free] 能力，真实章节夹具 + 引擎合法动作）
//   07242 猎鹰岬崖边 / 07245 沉没岩洞（中层）/ 07246 沉没岩洞（底层）/ 07248 深潜者温床
//     （地点：卡面数据 + floodBounds/揭示涨水/钥匙闪回/同行潮水通道查看读点）
//   07255 深潜者幼体（敌人强制：交战窗口真实引擎 + 击败窗口钩子级断言）
import test from 'node:test'
import assert from 'node:assert/strict'

import { fixture, asset, enemy, move, settle, legalMoves } from './core-fixture.mjs'
import { chapterFixture } from './tic-chapter-fixture.mjs'
import { revealLocation, scenarioRuntime, spawnEnemy } from '../src/engine/engine.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import { randomValue } from '../src/engine/rules-state.js'
import { registeredEntry, registerCardAbilities } from '../src/engine/ability.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { floodLevel } from '../src/engine/flood.js'

import entry07255 from '../src/cards/encounter-entries/theInnsmouthConspiracy/aLightInTheFog/07255.js'

if (!registeredEntry(entry07255.code)) registerCardAbilities([entry07255])

function transaction(s, execute) {
  const run = draft => {
    try { return execute(draft) } catch (error) {
      if (error.constructor?.name !== 'ScenarioEnded') throw error
    }
  }
  resolveTransaction(s, 0, { action: 'ticShard6' }, run)
  for (let guard = 0; s.pendingChoice; guard++) {
    assert.ok(guard < 80, `choice loop ${s.pendingChoice?.source}`)
    const choice = s.pendingChoice
    const id = ['done', 'skip', 'self'].find(candidate => choice.options.some(option => option.id === candidate))
      ?? choice.options[0]?.id
    resolveTransaction(s, choice.seat, { action: 'choose', choiceId: choice.id, optionId: id }, run)
  }
}

function setupPlayer() {
  const state = fixture('01001', 1)
  state.enemies = []
  state.abilityLimits = {}
  state.chaosBag = ['0']
  for (const inv of state.investigators) inv.location = state.investigators[0].location
  return state
}

// 混乱袋只放 [curse, 0] 并固定随机种子让首抽命中 index 0（curse）；单个 curse 会让
// 祝福/诅咒令牌池结算出空袋，因此必须保留一个数字标记。
function seedCurseFirst(state) {
  state.chaosBag = ['curse', '0']
  for (let seed = 1; seed < 2000; seed++) {
    if (randomValue({ rngState: seed }) < 0.5) { state.rngState = seed; return }
  }
  throw new Error('找不到让首抽为 curse 的种子')
}

const abilityFor = (s, code, predicate = () => true) => legalMoves(s, 0)
  .find(command => command.action === 'ability'
    && command.assetId === s.investigators[0].assets.find(a => a.code === code)?.id
    && predicate(command))

// ---------------------------------------------------------------------------
// 07226 哈米吉多顿
// ---------------------------------------------------------------------------
test('07226 哈米吉多顿：花 1 充能用意志攻击（+2 意志、+1 伤害），每枚诅咒可补 1 充能或造成 1 伤害', () => {
  const s = setupPlayer()
  asset(s, '07226')
  const foe = enemy(s, { fight: 1, evade: 1, health: 8, engagedSeat: 0 })
  const before = s.investigators[0].actionsLeft
  const attack = () => {
    const command = abilityFor(s, '07226', candidate => candidate.targetId === foe.id)
    assert.ok(command, '哈米吉多顿的攻击能力应出现在合法列表')
    move(s, command)
  }
  // 第一次攻击：首抽诅咒 → 选择补充 1 充能。
  seedCurseFirst(s)
  attack()
  settle(s, choice => choice.options.find(option => option.id === 'charge')?.id ?? null)
  assert.equal(s.investigators[0].assets[0].uses, 3, '花 1 充能、诅咒补回 1 充能（3 → 3）')
  assert.equal(s.enemies[0].damageTaken, 2, '意志攻击基础伤害 1 + 卡面 +1')
  // 第二次攻击：首抽诅咒 → 选择对所在地点敌人造成 1 伤害。
  seedCurseFirst(s)
  attack()
  settle(s, choice => choice.options.find(option => String(option.id).startsWith('enemy:'))?.id ?? null)
  assert.equal(s.investigators[0].actionsLeft, before - 2, '两次攻击共消耗 2 行动')
  assert.equal(s.investigators[0].assets[0].uses, 2, '第二次攻击后充能 3 → 2')
  assert.equal(s.enemies[0].damageTaken, 5, '两次攻击各 2 伤害 + 第二枚诅咒 1 伤害')
})

// ---------------------------------------------------------------------------
// 07227 混乱之眼
// ---------------------------------------------------------------------------
test('07227 混乱之眼：花 1 充能用意志 +2 调查并多发现 1 线索；每枚诅咒可发现连接地点线索或补充能', () => {
  const s = setupPlayer()
  asset(s, '07227')
  const here = s.locations.find(location => location.id === s.investigators[0].location)
  here.clues = 3
  here.shroud = 0
  const neighbour = {
    id: 'shard6InvestigateNeighbour', code: '01086', originalCode: '01086', name: '连接地点',
    revealed: true, clues: 2, doom: 0, shroud: 1, connections: [here.id], traits: [],
  }
  s.locations.push(neighbour)
  here.connections = [...(here.connections || []), neighbour.id]
  const investigate = () => {
    const command = abilityFor(s, '07227')
    assert.ok(command, '混乱之眼的调查能力应出现在合法列表')
    move(s, command)
  }
  // 事务会把 state 克隆重放，因此每次结算后都要按 id 重新取地点。
  const cluesAt = id => s.locations.find(location => location.id === id)?.clues
  // 第一次调查：首抽诅咒 → 从连接地点发现 1 个线索。
  seedCurseFirst(s)
  investigate()
  settle(s, choice => choice.options.find(option => String(option.id).startsWith('location:'))?.id ?? null)
  assert.equal(cluesAt(here.id), 1, '本地发现 2 个线索（基础 1 + 额外 1）')
  assert.equal(cluesAt(neighbour.id), 1, '诅咒从连接地点发现 1 个线索')
  assert.equal(s.investigators[0].clues, 3, '第一次调查共获得 3 个线索')
  // 第二次调查：首抽诅咒 → 补充 1 充能。
  seedCurseFirst(s)
  investigate()
  settle(s, choice => choice.options.find(option => option.id === 'charge')?.id ?? null)
  assert.equal(cluesAt(here.id), 0, '第二次调查发现本地剩余 2 个线索')
  assert.equal(s.investigators[0].clues, 4, '本地只剩 1 个线索，第二次只发现 1 个')
  assert.equal(s.investigators[0].assets[0].uses, 2, '两次各花 1 充能、第二次补回 1 → 2')
})

// ---------------------------------------------------------------------------
// 07228 暗影遁形
// ---------------------------------------------------------------------------
test('07228 暗影遁形：花 1 充能用意志 +2 躲避（非敏捷）；成功可移动非精英敌人，每枚诅咒可移动自己', () => {
  const s = setupPlayer()
  asset(s, '07228')
  // 躲避难度 5：意志 3+2=5 成功，敏捷 2+2=4 失败 → 成功即证明使用意志。
  const foe = enemy(s, { fight: 2, evade: 5, health: 3, engagedSeat: 0 })
  s.chaosBag = ['0']
  const command = abilityFor(s, '07228', candidate => candidate.targetId === foe.id)
  assert.ok(command, '暗影遁形的躲避能力应出现在合法列表')
  move(s, command)
  settle(s, choice => choice.options.find(option => option.id === 'skip')?.id ?? null)
  assert.equal(s.enemies[0].exhausted, true, '意志 5 vs 躲避 5 成功（敏捷 4 会失败）')
  assert.equal(s.investigators[0].assets[0].uses, 2, '花 1 充能')
})

// ---------------------------------------------------------------------------
// 07240 灯塔梯井
// ---------------------------------------------------------------------------
test('07240 灯塔梯井：有[[遗物]]剧情支援放在一边时，[free] 将其中 1 张加入手牌', () => {
  const s = chapterFixture('aLightInTheFog')
  const stairwell = s.locations.find(location => String(location.originalCode || location.code) === '07240')
  assert.ok(stairwell, '灯塔梯井在初始地点中')
  // 地点能力只有在调查员位于该地点且地点已揭示时才会进入合法动作。
  stairwell.revealed = true
  s.investigators[0].location = stairwell.id
  const freeAbility = () => legalMoves(s).find(command => command.action === 'entityAbility'
    && command.entityId === stairwell.id && command.actionKind === 'activate')
  assert.equal(freeAbility(), undefined, '旁置区没有遗物剧情支援时不提供该能力')
  s.scenarioZones.setAside.push('07179') // 被带到灯塔的遗物之一（type asset + Relic 特性）
  const command = freeAbility()
  assert.ok(command, '旁置区有遗物剧情支援时提供 [free] 能力')
  const before = s.investigators[0].hand.length
  move(s, command)
  settle(s, choice => choice.options.find(option => option.cardCode === '07179')?.id ?? null)
  assert.equal(s.investigators[0].hand.length, before + 1, '[free] 把 1 张遗物加入手牌')
  assert.ok(s.investigators[0].hand.includes('07179'))
  assert.equal(s.scenarioZones.setAside.includes('07179'), false, '旁置区移除该卡')
})

// ---------------------------------------------------------------------------
// 07255 深潜者幼体
// ---------------------------------------------------------------------------
test('07255 深潜者幼体：涌动；交战后失去 1 行动或它攻击你；被击败后最近的另一名深潜者向你移动一步', () => {
  const s = chapterFixture('aLightInTheFog')
  assert.equal(s.scenario.enemies['07255'].surge, true, '印刷「涌动」由章节定义解析')
  transaction(s, draft => spawnEnemy(draft, '07255', draft.investigators[0].location))
  const hatchling = s.enemies.find(candidate => String(candidate.originalCode || candidate.code) === '07255')
  assert.ok(hatchling, '深潜者幼体生成')
  const actionsBefore = s.investigators[0].actionsLeft
  const engage = legalMoves(s).find(command => command.action === 'engage' && command.enemyId === hatchling.id)
  assert.ok(engage, '提供交战动作')
  move(s, engage)
  settle(s, choice => choice.options.find(option => option.id === 'loseAction')?.id ?? null)
  assert.equal(s.investigators[0].actionsLeft, actionsBefore - 2, '交战 1 行动 + 强制失去 1 行动')
  // 击败窗口（钩子级）：最近的另一名准备就绪且未交战的[[深潜者]]向你移动一步，移动期间忽略冷漠。
  const location = s.investigators[0].location
  const state = {
    investigators: s.investigators,
    enemies: [
      { id: 'hatchling', code: '07255', originalCode: '07255', location, traits: ['Monster', 'Deep One'] },
      { id: 'nursemaid', code: '07254', originalCode: '07254', location, exhausted: false, engagedSeat: null, traits: ['Humanoid', 'Monster', 'Deep One'] },
    ],
    locations: s.locations,
    scenario: s.scenario,
    scenarioFlags: {},
  }
  const calls = []
  const nearbyEnemies = (locationId, options = {}) => state.enemies.filter(options.predicate || (() => true))
  const api = {
    choice: request => request.options?.[0]?.id ?? null,
    scenario: {
      nearestEnemies: nearbyEnemies,
      isEnemyUnengaged: candidate => candidate.engagedSeat == null,
      moveEnemyToward: (candidate, destination, options) => calls.push({ candidate, destination, options }),
    },
    info: () => {},
  }
  const defeat = entry07255.abilities[1]
  const criteria = Array.isArray(defeat.criteria) ? defeat.criteria : [defeat.criteria]
  const ctx = {
    state, inv: state.investigators[0], source: state.enemies[0],
    context: { enemy: state.enemies[0], seat: state.investigators[0].seat, attackCancelled: false },
    helpers: {
      nearestEnemies: nearbyEnemies,
      isEnemyUnengaged: candidate => candidate.engagedSeat == null,
    },
    api,
  }
  assert.equal(criteria[0](ctx), true)
  defeat.resolve(ctx)
  assert.equal(calls.length, 1, '最近的另一名深潜者被移动')
  assert.equal(calls[0].candidate.id, 'nursemaid')
  assert.equal(calls[0].options.ignoreAloof, true, '本次移动期间失去冷漠')
})

// ---------------------------------------------------------------------------
// 07242 猎鹰岬崖边（Falcon Point Cliffside）
// ---------------------------------------------------------------------------
test('07242 猎鹰岬崖边：shroud 1 / clues 1 / 不能被完全淹没；控制白色钥匙时 [free] 阅读记忆闪回 XII', () => {
  const card = ALL_CARDS['07242']
  assert.equal(card.shroud, 1)
  assert.equal(card.clues, 1)
  assert.deepEqual(card.traits, ['Falcon Point'])
  const s = chapterFixture('aLightInTheFog')
  const loc = s.locations.find(item => String(item.originalCode || item.code) === '07242')
  assert.ok(loc, '猎鹰岬崖边在初始地点中')
  // 卡面「不能被完全淹没」= floodBounds.max 1。
  transaction(s, draft => scenarioRuntime(draft, []).mechanics.water.change(loc.id, 1))
  assert.equal(floodLevel(s, loc.id), 1, '淹没等级可到 1')
  transaction(s, draft => assert.equal(
    scenarioRuntime(draft, []).mechanics.water.canChange(loc.id, 1), false, '淹没等级到 1 后不能再提升'))
  // 控制白色钥匙前不提供闪回能力；能力要求地点已揭示且调查员在该地点。
  transaction(s, draft => revealLocation(draft, loc.id, [], 0))
  s.investigators[0].location = loc.id
  const ability = () => legalMoves(s).find(command => command.action === 'entityAbility'
    && command.entityId === loc.id && command.actionKind === 'activate')
  assert.equal(ability(), undefined, '未控制白色钥匙时不提供记忆闪回能力')
  transaction(s, draft => scenarioRuntime(draft, []).mechanics.keys.transfer('white', 'setAside', 'investigator:0', { reveal: true }))
  const command = ability()
  assert.ok(command, '控制白色钥匙后提供记忆闪回 XII 能力')
  const beforeClues = s.investigators[0].clues
  move(s, command)
  settle(s)
  assert.equal(s.investigators[0].clues, beforeClues + 1, '闪回 XII 让探长获得 1 个线索（numInvestigators=1）')
  assert.ok((s.scenarioFlags.resolvedFlashbacks || []).includes('flashback12'))
  assert.ok((s.campaign.records.memoriesRecovered || []).includes('AConversationWithMrMoore'))
})

// ---------------------------------------------------------------------------
// 07245 沉没岩洞（中层）
// ---------------------------------------------------------------------------
test('07245 沉没岩洞（中层）：shroud 3 / clues 0；[free] 团队花费 1×人数线索查看本行潮水通道地点已揭示面', () => {
  const card = ALL_CARDS['07245']
  assert.equal(card.shroud, 3)
  assert.equal(card.clues, 0)
  assert.deepEqual(card.traits, ['Cave'])
  assert.equal(ALL_CARDS['07249'].backName, 'Tidal Tunnel', '候选按印刷背面名 Tidal Tunnel 识别')
  const s = chapterFixture('aLightInTheFog')
  const place = (id, x, y) => transaction(s, draft => scenarioRuntime(draft, []).mechanics.map.place(id, x, y))
  place('location07245', 2, -2)
  const loc = () => s.locations.find(item => String(item.originalCode || item.code) === '07245')
  transaction(s, draft => revealLocation(draft, loc().id, [], 0))
  s.investigators[0].location = loc().id
  s.investigators[0].clues = 5
  const ability = () => legalMoves(s).find(command => command.action === 'entityAbility'
    && command.entityId === loc().id && command.actionKind === 'activate')
  assert.equal(ability(), undefined, '本行没有未揭示潮水通道地点时不提供查看能力')
  place('location07249', 0, -2) // 同一行（row -2）的潮水通道地点
  const tunnel = () => s.locations.find(item => String(item.originalCode || item.code) === '07249')
  const command = ability()
  assert.ok(command, '同一行有未揭示潮水通道时提供查看能力')
  const seen = []
  move(s, command)
  settle(s, choice => {
    if (choice.kind === 'location') return tunnel().id
    const cardChoice = choice.options.find(option => option.cardCode === '07249')
    if (cardChoice) { seen.push(cardChoice.cardCode); return cardChoice.id }
    return null
  })
  assert.equal(s.investigators[0].clues, 4, '团队支付 1 个线索（1×人数）')
  assert.deepEqual(seen, ['07249'], '查看的是同行潮水通道 07249 的已揭示面')
  assert.equal(tunnel().revealed, false, '查看不改变地点的揭示状态')
})

// ---------------------------------------------------------------------------
// 07246 沉没岩洞（底层）
// ---------------------------------------------------------------------------
test('07246 沉没岩洞（底层）：shroud 4 / clues 0；[free] 团队花费 1×人数线索查看本行潮水通道地点已揭示面', () => {
  const card = ALL_CARDS['07246']
  assert.equal(card.shroud, 4)
  assert.equal(card.clues, 0)
  assert.deepEqual(card.traits, ['Cave'])
  assert.equal(ALL_CARDS['07250'].backName, 'Tidal Tunnel', '候选按印刷背面名 Tidal Tunnel 识别')
  const s = chapterFixture('aLightInTheFog')
  const place = (id, x, y) => transaction(s, draft => scenarioRuntime(draft, []).mechanics.map.place(id, x, y))
  place('location07246', 2, -3)
  const loc = () => s.locations.find(item => String(item.originalCode || item.code) === '07246')
  transaction(s, draft => revealLocation(draft, loc().id, [], 0))
  s.investigators[0].location = loc().id
  s.investigators[0].clues = 5
  const ability = () => legalMoves(s).find(command => command.action === 'entityAbility'
    && command.entityId === loc().id && command.actionKind === 'activate')
  assert.equal(ability(), undefined, '本行没有未揭示潮水通道地点时不提供查看能力')
  place('location07250', 0, -3) // 同一行（row -3）的潮水通道地点
  const tunnel = () => s.locations.find(item => String(item.originalCode || item.code) === '07250')
  const command = ability()
  assert.ok(command, '同一行有未揭示潮水通道时提供查看能力')
  const seen = []
  move(s, command)
  settle(s, choice => {
    if (choice.kind === 'location') return tunnel().id
    const cardChoice = choice.options.find(option => option.cardCode === '07250')
    if (cardChoice) { seen.push(cardChoice.cardCode); return cardChoice.id }
    return null
  })
  assert.equal(s.investigators[0].clues, 4, '团队支付 1 个线索（1×人数）')
  assert.deepEqual(seen, ['07250'], '查看的是同行潮水通道 07250 的已揭示面')
  assert.equal(tunnel().revealed, false, '查看不改变地点的揭示状态')
})

// ---------------------------------------------------------------------------
// 07248 深潜者温床（Deep One Nursery）
// ---------------------------------------------------------------------------
test('07248 深潜者温床：shroud 2 / clues 0；揭示时提升自身淹没等级；控制紫色钥匙时 [free] 阅读记忆闪回 XIII', () => {
  const card = ALL_CARDS['07248']
  assert.equal(card.shroud, 2)
  assert.equal(card.clues, 0)
  assert.deepEqual(card.traits, ['Cave'])
  assert.equal(card.backName, 'Tidal Tunnel')
  const s = chapterFixture('aLightInTheFog')
  transaction(s, draft => scenarioRuntime(draft, []).mechanics.map.place('location07248', 0, -2))
  const loc = () => s.locations.find(item => String(item.originalCode || item.code) === '07248')
  transaction(s, draft => revealLocation(draft, loc().id, [], 0))
  assert.equal(floodLevel(s, loc().id), 1, '揭示后强制提升 1 级淹没')
  s.investigators[0].location = loc().id
  const ability = () => legalMoves(s).find(command => command.action === 'entityAbility'
    && command.entityId === loc().id && command.actionKind === 'activate')
  assert.equal(ability(), undefined, '未控制紫色钥匙时不提供记忆闪回能力')
  transaction(s, draft => scenarioRuntime(draft, []).mechanics.keys.transfer('purple', 'setAside', 'investigator:0', { reveal: true }))
  const command = ability()
  assert.ok(command, '控制紫色钥匙后提供记忆闪回 XIII 能力')
  move(s, command)
  settle(s)
  assert.ok((s.scenarioFlags.resolvedFlashbacks || []).includes('flashback13'))
  assert.ok((s.campaign.records.memoriesRecovered || []).includes('TheLifecycleOfADeepOne'))
})
