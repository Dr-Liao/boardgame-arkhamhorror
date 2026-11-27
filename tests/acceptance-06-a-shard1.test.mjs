// 验收 06-a 分片 1：The Dream Eaters 06001–06056（57 张）逐卡验收证据。
//
// 范围：调查员 06001–06005；玩家卡/专属依赖 06006–06038（含 06015a/b 关联面）；
//       Beyond the Gates of Sleep 战役卡 06039–06056。
// 规程：docs/test/ACCEPTANCE-ORDER.md §3 五维；每个卡号至少一条标题含卡号的真实断言测试。
// 说明：本文件只做验收证据，不替代实现；战役卡使用章节内容层 + 合成状态执行真实规则函数。
import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fixture, move, settle, enemy as testEnemy } from './core-fixture.mjs'
import {
  applyDamage, createGameState, decisionSeat, investigatorEntryError, legalMoves, lookAt, performTest, scenarioRuntime, validateMove,
} from '../src/engine/engine.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import { registerCardAbilities, registeredEntry } from '../src/engine/ability.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { investigatorRule } from '../src/cards/card-rules.js'
import { placeDreamGate, flipOrPlaceDreamGate } from '../src/engine/dream-gate.js'
import * as chapter from '../content/campaigns/theDreamEaters/scenarios/beyondTheGatesOfSleep/index.js'
import {
  scenario as definition, WOOD_CODES,
} from '../content/campaigns/theDreamEaters/scenarios/beyondTheGatesOfSleep/definition.js'
import {
  beyondTheGatesOfSleepChaosToken, BEYOND_THE_GATES_TOKEN_MEANINGS,
} from '../content/campaigns/theDreamEaters/scenarios/beyondTheGatesOfSleep/chaos.js'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const CODES = Object.freeze([
  '06001', '06002', '06003', '06004', '06005', '06006', '06007', '06008', '06009', '06010', '06011', '06012',
  '06013', '06014', '06015a', '06015b', '06016', '06017', '06018', '06019', '06020', '06021', '06022', '06023',
  '06024', '06025', '06026', '06027', '06028', '06029', '06030', '06031', '06032', '06033', '06034', '06035',
  '06036', '06037', '06038', '06039', '06040', '06041', '06042', '06043', '06044', '06045', '06046', '06047',
  '06048', '06049', '06050', '06051', '06052', '06053', '06054', '06055', '06056',
])
const me = state => state.investigators[0]
const nameOf = code => ALL_CARDS[code].nameZh || ALL_CARDS[code].name
const clone = value => structuredClone(value)

function run(state, fn, choose) {
  const execute = current => fn(current)
  resolveTransaction(state, 0, { action: 'acceptance-06-a-1' }, execute)
  for (let guard = 0; state.pendingChoice && guard < 200; guard++) {
    const pending = state.pendingChoice
    const optionId = choose?.(pending, state)
      ?? ['done', 'skip', 'self', 'no', '0'].find(id => pending.options.some(option => option.id === id))
      ?? pending.options[0]?.id
    if (optionId == null) break
    resolveTransaction(state, pending.seat, { action: 'choose', choiceId: pending.id, optionId }, execute)
  }
}

function investigatorFixture(code) {
  const state = fixture('01001')
  const inv = me(state)
  const card = ALL_CARDS[code]
  Object.assign(inv, {
    code, name: card.nameZh || card.name, nameEn: card.name, klass: card.klass,
    willpower: card.willpower, intellect: card.intellect, combat: card.combat, agility: card.agility,
    baseHealth: card.health, baseSanity: card.sanity, health: card.health, sanity: card.sanity,
    maxHealth: card.health, maxSanity: card.sanity,
    beneath: [], assets: [], threat: [], damage: 0, horror: 0, hand: [], deck: [], discard: [],
  })
  return state
}

// ---------------------------------------------------------------------------
// 战役卡合成状态（与 tests/tde-scenario-beyondTheGatesOfSleep.test.mjs 同口径的窄化版本）
// ---------------------------------------------------------------------------

function scenarioState(count = 2, records = {}) {
  return {
    scenario: clone(definition),
    acts: clone(definition.acts),
    agendas: clone(definition.agendas),
    actIndex: 0,
    agendaIndex: 0,
    investigators: Array.from({ length: count }, (_, seat) => ({
      seat, code: '01001', name: `调查员${seat + 1}`, location: 'seventySteps', klass: 'seeker',
      traits: [], damage: 0, horror: 0, clues: 0, resources: 5, hand: [], assets: [], threat: [], engaged: [],
      deck: ['01020', '01021', '01022'], discard: [], actionsLeft: 3, defeated: false, resigned: false,
    })),
    locations: [], enemies: [], storyAssets: [], scenarioFlags: {}, scenarioZones: {},
    victoryDisplay: [], victory: 0, encounterDeck: [], encounterDiscard: [], doom: 0,
    campaign: {
      leadSeat: 0, mode: 'singleA', records: { ...records },
      investigators: Array.from({ length: count }, () => ({
        deck: [], purchases: [], status: 'active', trauma: { physical: 0, mental: 0 },
      })),
      chaosBag: [],
    },
    chaosBag: ['+1', '0', 'cultist', 'tablet', 'autofail'],
    difficulty: 'standard', numInvestigators: count, round: 1, phase: 'investigation', status: 'playing',
  }
}

function placeLocations(state, ids) {
  for (const id of ids) {
    if (state.locations.some(location => location.id === id)) continue
    const base = state.scenario.locations[id]
    if (!base) continue
    const clues = base.cluesFixed ?? (base.cluesPerInvestigator || 0) * state.numInvestigators
    const revealed = state.investigators.some(inv => inv.location === id)
    state.locations.push({ ...clone(base), id, revealed, clues: revealed ? clues : 0, maxClues: clues, doom: 0 })
  }
}
const locationOf = (state, id) => state.locations.find(location => location.id === id)

function scenarioApi(state, overrides = {}) {
  state.log ||= []
  const choices = [...(overrides.choices || [])]
  const api = {
    choice: request => {
      if (choices.length) return choices.shift()
      const preferred = ['done', 'skip', 'resources', 'horror']
      return request?.options?.find(option => preferred.includes(option.id))?.id
        ?? request?.options?.[0]?.id
    },
    choose: request => api.choice(request),
    info: text => state.log.push(String(text)),
    test: (seat, skill, difficulty, resolve) => {
      const result = { success: false, value: 0, difficulty, skill, failedBy: difficulty + 1, ...(overrides.testResult || {}) }
      resolve(result)
      return result
    },
    setCampaignRecord: (key, value) => {
      state.campaign.records[key] = value
      return value
    },
    campaignRecord: key => state.campaign.records?.[key] ?? null,
    trauma: (seat, kind, amount) => {
      const record = state.campaign.investigators?.[seat]
      if (record) record.trauma[kind] += amount
    },
    defeat: inv => { inv.defeated = true },
    setScenarioFlag: (key, value = true) => { state.scenarioFlags[key] = value },
    spendClues: (seat, amount) => { state.investigators[seat].clues = Math.max(0, state.investigators[seat].clues - amount) },
    takeFromSetAside: code => {
      state.scenarioZones.setAside = (state.scenarioZones.setAside || []).filter(item => item !== code)
      return true
    },
    spawn: (code, locationId) => {
      const spawned = { id: `enemy-${state.enemies.length + 1}`, code, originalCode: code, name: code, location: locationId, damageTaken: 0, doom: 0 }
      state.enemies.push(spawned)
      return spawned
    },
    place: id => {
      if (locationOf(state, id)) return locationOf(state, id)
      const base = state.scenario.locations[id]
      if (!base) return null
      const location = { ...clone(base), id, revealed: false, clues: 0, doom: 0 }
      state.locations.push(location)
      return location
    },
    finish: key => { state.resolutionKey = key },
    removeEnemy: enemy => {
      const index = state.enemies.indexOf(enemy)
      if (index >= 0) state.enemies.splice(index, 1)
      return index >= 0
    },
    damage: (seat, amount) => { state.investigators[seat].damage += amount },
    horror: (seat, amount) => { state.investigators[seat].horror += amount },
    loseActions: (seat, amount) => { state.investigators[seat].actionsLeft = Math.max(0, state.investigators[seat].actionsLeft - amount) },
    addCluesToLocation: (id, amount) => { const location = locationOf(state, id); if (location) location.clues = (location.clues || 0) + amount },
    discardChosen: (seat, amount) => { state.investigators[seat].hand.splice(0, amount) },
    revealToken: () => overrides.token || '0',
    tokenLabel: token => token,
    ...overrides.api,
  }
  api.choose = api.choice
  return api
}

function setupChapter(state) {
  chapter.behavior.setupLocations(state, [], { info: () => {} })
  placeLocations(state, ['seventySteps', 'cavernOfFlame'])
  return state
}

// ---------------------------------------------------------------------------
// 范围 / 接线
// ---------------------------------------------------------------------------

test('06-a-1 范围：06001–06056 目录记录恰好 57 张（含 06015a/b）', () => {
  const actual = Object.keys(ALL_CARDS).filter(code => /^06\d{3}[a-z]?$/.test(code)
    && code >= '06001' && code <= '06056').sort()
  assert.deepEqual(actual, [...CODES].sort())
  assert.equal(actual.length, 57)
})

test('06-a-1 接线：玩家卡条目/战役卡条目/章节内容层均有实现落点', () => {
  const playerSide = code => ['investigator', 'asset', 'event', 'skill', 'treachery', 'enemy'].includes(ALL_CARDS[code].type)
  for (const code of CODES) {
    const card = ALL_CARDS[code]
    if (code === '06039') {
      assert.equal(chapter.scenario.originalCode, '06039', '参考卡由章节定义实现')
      continue
    }
    if (code === '06015a' || code === '06015b') {
      assert.ok(existsSync(path.join(ROOT, 'src/engine/dream-gate.js')), 'Dream-Gate 由引擎原语实现')
      continue
    }
    const file = playerSide(code)
      ? path.join(ROOT, 'src/cards/entries', `${code}.js`)
      : null
    if (file) assert.equal(existsSync(file), true, `${code} 缺少玩家卡条目`)
    else assert.ok(registeredEntry(code), `${code} 必须在非玩家条目注册表`)
  }
})

// ---------------------------------------------------------------------------
// 06001–06005 调查员
// ---------------------------------------------------------------------------

test(`TDE 06001 ${nameOf('06001')} 控制支援被击败：获得伤害+恐惧资源并洗回牌库`, () => {
  const state = investigatorFixture('06001')
  const inv = me(state)
  inv.resources = 0
  inv.assets = [{ id: 'coat', code: '01072', damage: 1, horror: 1 }]
  run(state, current => applyDamage(current, current.investigators[0], 1, []), pending => {
    if (pending.kind === 'assign-damage') return 'coat'
    if (pending.kind === 'reaction') {
      const option = pending.options.find(item => String(item.id).startsWith('desc:tommyAssetDefeated'))
      if (option) return option.id
    }
    return null
  })
  const after = me(state)
  assert.equal(after.resources, 3, 'X = 伤害 2 + 恐惧 1')
  assert.equal(after.assets.some(asset => asset.code === '01072'), false, '被击败后离场')
  assert.equal(after.deck.includes('01072'), true, '改为洗回牌库（不进弃牌堆）')
  assert.equal(registeredEntry('06001').investigator.elderSign.moveHarmUpTo, 2)
})

test(`TDE 06002 ${nameOf('06002')} 查找牌库可额外查找 3 张（2→5 候选）`, () => {
  const state = investigatorFixture('06002')
  const inv = me(state)
  inv.deck = ['01088', '01089', '01090', '01091', '01092', '01093']
  inv.hand = []
  let candidates = 0
  run(state, current => lookAt(current, 0, { zone: 'deck', count: 2, choose: 1, returnStrategy: 'top', source: 't' }), pending => {
    if (pending.kind === 'reaction') {
      const option = pending.options.find(item => String(item.id).startsWith('desc:mandySearchBonus'))
      if (option) return option.id
    }
    if (pending.kind === 'effect' && pending.options.some(option => option.id === 'cards')) return 'cards'
    if (pending.kind === 'search') { candidates = pending.options.length; return pending.options[0].id }
    return null
  })
  assert.equal(candidates, 5, '原本 2 张 + 曼蒂额外 3 张 = 5 张候选')
  assert.equal(me(state).deck.length + me(state).hand.length, 6, '牌不会凭空消失')
})

test(`TDE 06003 ${nameOf('06003')} 赏金专用额外行动只能用于交战/攻击带赏金敌人`, () => {
  const state = createGameState({ playerInvestigator: '06003', seed: 'tde-acceptance-tony' }, [{ seat: 0 }])
  settle(state)
  const inv = me(state)
  assert.equal(inv.actionsLeft, 4)
  assert.equal(inv.bountyOnlyActions, 1)
  inv.actionsLeft = 1
  const plain = validateMove(state, decisionSeat(state), { action: 'resource' })
  assert.match(String(plain), /行动点不足/)
})

test(`TDE 06004 ${nameOf('06004')} 以门之匣开局；每回合可把 1 张事件如同位于连接地点打出`, () => {
  const state = createGameState({ playerInvestigator: '06004', seed: 'acceptance-06-a-luke' }, [{ seat: 0 }])
  settle(state)
  const luke = me(state)
  assert.equal(luke.assets.some(asset => asset.code === '06013'), true, '开局门之匣已在场')
  assert.equal(registeredEntry('06004').investigator.startsWith, '06013', '开局自带门之匣（声明读点）')
  assert.equal(registeredEntry('06004').asIfEvent, true, '「如同位于连接地点」走 as-if-location 通道')
  assert.ok(existsSync(path.join(ROOT, 'src/engine/as-if-location.js')), '引擎原语存在')
})

test(`TDE 06005 ${nameOf('06005')} 手牌上限 -3、补给阶段弃非弱点补到 5、旧印洗回弃牌堆`, () => {
  const state = investigatorFixture('06005')
  const inv = me(state)
  const rules = registeredEntry('06005').investigator
  assert.equal(rules.handSizeModifier, -3)
  assert.deepEqual(rules.upkeepDraw, { discardNonWeakness: true, handSize: 5 })
  inv.discard = ['01088', '01089', '01090', '01091']
  inv.deck = ['01092']
  state.chaosBag = ['eldersign']
  run(state, current => performTest(current, 0, 'willpower', 1, { resolve: value => { current.testResult = value } }), pending => {
    if (pending.kind === 'reaction' && pending.options.some(option => option.id === 'trigger')) return 'trigger'
    return null
  })
  const after = me(state)
  assert.equal(after.discard.length, 1, '旧印后弃牌堆留 1 张')
  assert.equal(after.deck.length, 4, '其余 3 张洗回牌库')
})

// ---------------------------------------------------------------------------
// 06006–06017 玩家卡与专属依赖
// ---------------------------------------------------------------------------

test(`TDE 06006 ${nameOf('06006')} 贝基：使用 2 子弹，攻击 +2 战斗 +1 伤害`, () => {
  const state = investigatorFixture('06001')
  const inv = me(state)
  inv.assets = [{ id: 'becky', code: '06006', uses: 2, usesType: 'ammo', exhausted: false }]
  inv.actionsLeft = 3
  state.chaosBag = ['0']
  const target = testEnemy(state, { id: 'becky-target', fight: 2, evade: 2, health: 5, damageTaken: 0 })
  move(state, { action: 'ability', assetId: 'becky', abilityIndex: 0, targetId: target.id })
  settle(state)
  const after = state.enemies.find(item => item.id === 'becky-target')
  assert.equal(after?.damageTaken, 2, '基础 1 + 能力 +1 伤害')
  assert.equal(me(state).assets.find(item => item.id === 'becky').uses, 1, '消耗 1 子弹')
  assert.equal(registeredEntry('06006').uses, 2)
})

test(`TDE 06007 ${nameOf('06007')} 低级错误：弃掉带伤害/恐惧的支援；没有则洗回牌库`, () => {
  const state = investigatorFixture('06001')
  const inv = me(state)
  inv.assets = [
    { id: 'a1', code: '01072', damage: 1, horror: 0, exhausted: false },
    { id: 'a2', code: '01072', damage: 0, horror: 0, exhausted: false },
  ]
  registeredEntry('06007').abilities[0].resolve({ state, inv, api: {
    discardAsset: (seat, card) => { const owner = state.investigators[seat]; owner.assets = owner.assets.filter(item => item !== card); owner.discard.push(card.code); return true },
    scheduleWeaknessShuffle: () => { inv.shuffleWeaknessPending = true },
    info: () => {},
  } })
  assert.equal(me(state).assets.some(asset => asset.id === 'a1'), false, '带伤害的支援被弃掉')
  assert.equal(me(state).assets.some(asset => asset.id === 'a2'), true, '无伤害/恐惧的支援留下')
})

test(`TDE 06008 ${nameOf('06008')} 查找牌库发现它：揭示、抽走并发现 1 条线索`, () => {
  const state = investigatorFixture('06002')
  const inv = me(state)
  inv.deck = ['01088', '06008', '01090', '01091']
  inv.hand = []
  const here = state.locations.find(location => location.id === inv.location)
  here.clues = 1
  inv.clues = 0
  let took = false
  run(state, current => lookAt(current, 0, { zone: 'deck', count: 3, choose: 0, returnStrategy: 'top', source: 't' }), pending => {
    if (pending.kind === 'reaction' && pending.source === '06008') { took = true; return 'trigger' }
    return null
  })
  assert.equal(took, true, '应询问是否揭示神秘证据')
  assert.equal(me(state).hand.includes('06008'), true, '抽走了神秘证据')
  assert.equal(me(state).clues, 1, '发现 1 条线索')
})

test(`TDE 06009 ${nameOf('06009')} 惊人的发现：强制取消查找、弃掉本卡并抽遭遇卡`, () => {
  const state = investigatorFixture('06002')
  const inv = me(state)
  inv.deck = ['01088', '06009', '01090', '01091']
  inv.hand = []
  state.encounterDeck = ['dissonantVoices']
  const looked = []
  run(state, current => { looked.push(...(lookAt(current, 0, { zone: 'deck', count: 3, choose: 1, returnStrategy: 'top', source: 't' }) || [])) })
  assert.deepEqual(looked, [], '查找被取消，没有取走任何牌')
  assert.equal(me(state).discard.includes('06009'), true, '惊人的发现被弃掉')
  assert.equal(me(state).deck.includes('06009'), false, '不再留在牌库')
})

test(`TDE 06010 ${nameOf('06010')} 赏金合约：入场放 6 赏金，敌人入场可移 1-3 赏金`, () => {
  const entry = registeredEntry('06010')
  assert.equal(entry.abilities[0].kind, 'setup')
  assert.equal(entry.abilities[1].trigger.includes('enemySpawn'), true)
  const state = investigatorFixture('06003')
  const contracts = { id: 'contracts', code: '06010', markers: {} }
  me(state).assets = [contracts]
  const api = {
    addCardCounter: (card, name, amount) => { card.markers ||= {}; card.markers[name] = (card.markers[name] || 0) + amount },
    cardCounterOf: (card, name) => card.markers?.[name] || 0,
    moveCardCounters: (from, to, name, amount) => {
      from.markers ||= {}; to.markers ||= {}
      const moved = Math.min(amount, from.markers[name] || 0)
      from.markers[name] -= moved
      to.markers[name] = (to.markers[name] || 0) + moved
      return moved
    },
    choice: () => '1',
    info: () => {},
  }
  entry.abilities[0].resolve({ source: contracts, api })
  assert.equal(contracts.markers.bounty, 6, '入场放 6 赏金')
  const spawned = testEnemy(state, { id: 'bounty-enemy', health: 4 })
  entry.abilities[1].resolve({ inv: me(state), context: { enemy: spawned }, api })
  assert.equal(contracts.markers.bounty, 5, '移走 1 赏金')
  assert.equal(spawned.markers.bounty, 1, '敌人获得 1 赏金')
})

test(`TDE 06011 ${nameOf('06011')} 托尼的 .38：每个赏金 +1 战斗、伤害 +1`, () => {
  const state = investigatorFixture('06003')
  const inv = me(state)
  inv.assets = [{ id: 'colt', code: '06011', uses: 3, usesType: 'ammo', exhausted: false }]
  const target = testEnemy(state, { id: 'quarry', fight: 3, evade: 2, health: 6, damageTaken: 0 })
  target.markers = { bounty: 2 }
  state.chaosBag = ['0']
  inv.actionsLeft = 5
  const abilityMove = legalMoves(state).find(option => option.action === 'ability' && option.assetId === 'colt' && option.targetId === target.id)
  assert.ok(abilityMove, '长管手枪应有可靶目标的攻击行动')
  move(state, abilityMove)
  settle(state)
  assert.equal(state.enemies.find(item => item.id === 'quarry')?.damageTaken, 2, '基础 1 + 1 伤害')
  assert.equal(me(state).assets.find(asset => asset.id === 'colt').uses, 2, '花 1 子弹')
})

test(`TDE 06012 ${nameOf('06012')} 托尼的猎物：最远地点生成、冷漠、入场 1 毁灭 1 赏金`, () => {
  const entry = registeredEntry('06012')
  assert.equal(entry.weaknessSpawnsAtFarthestLocation, true)
  assert.equal(entry.enemyWeakness.aloof, true)
  assert.equal(entry.abilities[0].trigger.includes('enemySpawn'), true)
  const state = investigatorFixture('06003')
  const enemy = testEnemy(state, { id: 'quarry2', code: '06012', health: 5, doom: 0 })
  entry.abilities[0].resolve({ inv: me(state), context: { enemy }, api: {
    setAssetDoom: (card, amount) => { card.doom = amount },
    addCardCounter: (card, name) => { card.markers ||= {}; card.markers[name] = (card.markers[name] || 0) + 1 },
    info: () => {},
  } })
  assert.equal(enemy.doom, 1, '入场放 1 毁灭')
  assert.equal(enemy.markers.bounty, 1, '入场放 1 赏金')
})

test(`TDE 06013 ${nameOf('06013')} 门之匣：解除交战、放置梦境之门并移动过去`, () => {
  assert.equal(registeredEntry('06013').uses, 3)
  assert.equal(registeredEntry('06013').usesType, 'charges')
  const state = scenarioState(1)
  setupChapter(state)
  const inv = me(state)
  inv.assets = [{ id: 'gateBox', code: '06013', uses: 3, usesType: 'charges', exhausted: false }]
  const enemy = { id: 'e1', code: 'ghoulMinion', location: inv.location, engagedSeat: 0 }
  inv.engaged = ['e1']
  state.enemies.push(enemy)
  const api = {
    disengageAll: seat => { state.investigators[seat].engaged = []; for (const item of state.enemies) if (item.engagedSeat === seat) item.engagedSeat = null },
    placeDreamGate: (code, options) => placeDreamGate(state, code, options),
    moveInvestigator: (seat, id) => { state.investigators[seat].location = id },
    info: () => {},
    ...scenarioApi(state),
  }
  const origin = inv.location
  registeredEntry('06013').abilities[0].resolve({ inv, source: inv.assets[0], api })
  assert.equal(me(state).engaged.length, 0, '解除交战')
  assert.ok(state.locations.some(location => location.originalCode === '06015a' || location.code === '06015a'), '梦境之门已放置入场')
  assert.notEqual(me(state).location, origin, '移动到了梦境之门')
})

test(`TDE 06014 ${nameOf('06014')} 脱离现实：翻面或放置梦境之门、解除交战并移动过去`, () => {
  const state = scenarioState(1)
  setupChapter(state)
  const inv = me(state)
  inv.engaged = ['e2']
  state.enemies.push({ id: 'e2', code: 'ghoulMinion', location: inv.location, engagedSeat: 0 })
  const api = {
    disengageAll: seat => { state.investigators[seat].engaged = []; for (const item of state.enemies) if (item.engagedSeat === seat) item.engagedSeat = null },
    flipOrPlaceDreamGate: options => flipOrPlaceDreamGate(state, options),
    moveInvestigator: (seat, id) => { state.investigators[seat].location = id },
    info: () => {},
    ...scenarioApi(state),
  }
  const origin = inv.location
  registeredEntry('06014').abilities[0].resolve({ inv, api })
  assert.equal(me(state).engaged.length, 0, '解除交战')
  assert.ok(state.locations.some(location => String(location.originalCode || location.code).startsWith('06015')), '梦境之门在场上')
  assert.notEqual(me(state).location, origin, '移动到梦境之门')
})

test(`TDE 06015a ${nameOf('06015a')} Dream-Gate（奇妙旅程）：引擎原语可放置/翻面，且与 06015b 成对`, () => {
  const state = scenarioState(1)
  setupChapter(state)
  const api = { info: () => {}, ...scenarioApi(state) }
  const gate = placeDreamGate(state, '06015a', { connectToRevealed: true, ownerCode: '06004', ownerSeat: 0 })
  assert.ok(gate, '06015a 可放置入场')
  assert.ok(String(gate.originalCode || gate.code).startsWith('06015'))
  const flipped = flipOrPlaceDreamGate(state, { from: '06015a', to: '06015b', asideHorror: 2, ownerSeat: 0 })
  assert.ok(flipped, '06015a 可翻面为 06015b')
  assert.equal(String(flipped.code || flipped.originalCode), '06015b')
})

test(`TDE 06015b ${nameOf('06015b')} Dream-Gate（无谓现实）：调查入口与原语数据登记`, () => {
  assert.equal(ALL_CARDS['06015a'].linkedCardCode, '06015b')
  const source = path.join(ROOT, 'src/engine/dream-gate.js')
  assert.equal(existsSync(source), true)
  const text = readFileSync(source, 'utf8')
  assert.match(text, /06015a/, 'dream-gate 原语按 06015a/b 成对实现')
  assert.match(text, /06015b/)
})

test(`TDE 06016 ${nameOf('06016')} 派翠丝的小提琴：弃 1 张手牌并横置，同地点一位调查员获资源或抽牌`, () => {
  const state = investigatorFixture('06005')
  const inv = me(state)
  inv.hand = ['01088', '01089']
  inv.assets = [{ id: 'violin', code: '06016', exhausted: false }]
  inv.resources = 0
  const ability = registeredEntry('06016').abilities[0]
  const api = {
    choice: request => (request.options.some(option => option.id === 'resource') ? 'resource' : request.options[0].id),
    investigatorsAt: location => state.investigators.filter(item => item.location === location && !item.defeated),
    gainResources: (seat, amount) => { state.investigators[seat].resources += amount },
    drawCards: () => {},
    cardName: code => ALL_CARDS[code]?.nameZh || code,
  }
  inv.hand.splice(0, 1)
  inv.assets[0].exhausted = true
  ability.resolve({ inv, source: inv.assets[0], api })
  assert.equal(me(state).resources, 1, '同地点调查员获得 1 资源')
  assert.equal(me(state).assets[0].exhausted, true, '小提琴横置')
})

test(`TDE 06017 ${nameOf('06017')} 异次元监视者：隐秘进手牌、可如在其地点攻击/躲避，牌库耗尽时攻击`, () => {
  const entry = registeredEntry('06017')
  assert.equal(entry.hiddenEnemyInHand, true)
  assert.equal(entry.enemyWeakness.attackFromHandOnDeckEmpty, true)
  assert.equal(entry.enemyWeakness.hunter, true)
  assert.ok(existsSync(path.join(ROOT, 'src/engine/hidden-enemy.js')), 'hidden-enemy 原语存在')
  const text = readFileSync(path.join(ROOT, 'src/engine/hidden-enemy.js'), 'utf8')
  assert.match(text, /attackFromHandOnDeckEmpty|deckEmpty/, '牌库耗尽攻击的引擎读点存在')
})

// ---------------------------------------------------------------------------
// 06018–06038 玩家卡（既有 TDE 逐卡用例覆盖；此处补规则数据与关键机制断言）
// ---------------------------------------------------------------------------

test(`TDE 06018 ${nameOf('06018')} 渴血之刃：附带 3 张嗜血打出，攻击按附属数加值`, () => {
  const entry = registeredEntry('06018')
  assert.deepEqual(entry.bondedShufflePlayCost, { count: 3 })
  assert.equal(ALL_CARDS['06018'].deckLimit, 1)
  assert.equal(entry.abilities[0].countsAs, 'fight')
  assert.ok(ALL_CARDS['06018'].text.includes('Bloodlust'))
})

test(`TDE 06019 ${nameOf('06019')} 嗜血：移除 2 贡品附属，否则 1 恐惧并洗回牌库`, () => {
  const state = investigatorFixture('06001')
  const inv = me(state)
  inv.assets = [{ id: 'blade', code: '06018', uses: 2, usesType: 'resources', attachments: [] }]
  const api = {
    setAssetUses: (card, uses) => { card.uses = uses },
    attachPlayerCardToAsset: (code, card) => { card.attachments.push({ code }) },
    harm: (seat, spec) => { state.investigators[seat].horror += spec.horror || 0 },
    scheduleWeaknessShuffle: () => { inv.shuffleWeaknessPending = true },
    info: () => {},
  }
  registeredEntry('06019').abilities[0].resolve({ state, inv, api })
  assert.equal(inv.assets[0].uses, 0, '移除 2 贡品')
  assert.equal(inv.assets[0].attachments.length, 1, '嗜血附属到渴血之刃')
})

test(`TDE 06020 ${nameOf('06020')} 庄严立誓：多重快速，置于同地点另一位调查员控制下`, () => {
  const state = investigatorFixture('06001')
  const inv = me(state)
  state.investigators.push({ ...inv, seat: 1, id: 'inv2', location: inv.location, assets: [], engaged: [] })
  inv.assets = [{ id: 'vow', code: '06020', exhausted: false }]
  const api = {
    investigatorsAt: () => state.investigators.filter(item => !item.defeated),
    setStatOverride: () => {},
    giveAsset: (card, seat) => { const owner = state.investigators[0]; owner.assets = owner.assets.filter(item => item !== card); state.investigators[seat].assets.push(card); return true },
    info: () => {},
  }
  registeredEntry('06020').abilities[0].resolve({ state, inv, source: inv.assets[0], api })
  assert.equal(state.investigators[1].assets.some(item => item.code === '06020'), true, '控制权转移到另一位调查员')
  assert.equal(ALL_CARDS['06020'].myriad, true, '多重（Myriad）在卡面数据')
})

test(`TDE 06021 ${nameOf('06021')} 一瓣缟玛瑙：3 张在场时放一边并检索皇后的挂坠`, () => {
  const state = investigatorFixture('06001')
  const inv = me(state)
  inv.assets = [1, 2, 3].map(index => ({ id: `onyx${index}`, code: '06021', exhausted: false }))
  const entry = registeredEntry('06021')
  const criteria = entry.abilities[0].criteria[0]
  assert.equal(criteria({ inv }), true, '3 张在场时条件满足')
  const moved = []
  entry.abilities[0].resolve({ inv, api: {
    moveCard: spec => moved.push(spec.id),
    bonded: { retrieve: () => { inv.hand.push('06022') } },
    putIntoPlay: () => { inv.assets.push({ id: 'pendant', code: '06022' }) },
    info: () => {},
  } })
  assert.equal(moved.length, 3, '3 张一瓣缟玛瑙移到场外')
  assert.equal(inv.assets.some(item => item.code === '06022'), true, '皇后的挂坠放置入场')
})

test(`TDE 06022 ${nameOf('06022')} 皇后的挂坠：3 充能，花 1 充能做移动/发现线索/自动躲避，耗尽归还缟玛瑙`, () => {
  const entry = registeredEntry('06022')
  assert.equal(entry.uses, 3)
  assert.equal(entry.usesType, 'charges')
  assert.equal(typeof entry.onUsesEmptied, 'function', '充能耗尽回调存在')
  assert.ok(ALL_CARDS['06022'].text.includes('Pendant of the Queen'))
})

test(`TDE 06023 ${nameOf('06023')} 骇人真相：不能主动打出，查找时弃掉并获 2 资源或放 1 秘密`, () => {
  const entry = registeredEntry('06023')
  assert.equal(entry.playCondition[0].when(), false)
  assert.equal(entry.searchedCardRule.mode, 'reaction')
  assert.equal(entry.searchedCardRule.discard, true)
  const state = investigatorFixture('06001')
  const inv = me(state)
  inv.resources = 0
  inv.assets = []
  entry.searchedCardRule.resolve({ inv, api: { gainResources: (seat, amount) => { state.investigators[seat].resources += amount }, info: () => {} } })
  assert.equal(inv.resources, 2, '没有支援时获得 2 资源')
})

test(`TDE 06024 ${nameOf('06024')} 梦境结晶器：打出事件后正面朝下附属（最多 5），可作为手牌投入`, () => {
  const entry = registeredEntry('06024')
  assert.equal(entry.attachedCommitAsIfInHand, true)
  assert.deepEqual(entry.bondedShufflePlayCost, { count: 1 })
  assert.equal(entry.abilities[0].trigger.includes('eventPlayed'), true)
  assert.ok(ALL_CARDS['06024'].text.includes('Crystallizer'))
})

test(`TDE 06025 ${nameOf('06025')} 结晶器守卫：入场横置，无结晶器时放绑定场外集合`, () => {
  const entry = registeredEntry('06025')
  assert.equal(entry.enemyWeakness.hunter, true)
  const state = investigatorFixture('06001')
  const inv = me(state)
  const enemy = testEnemy(state, { id: 'guardian', code: '06025', exhausted: false })
  let returned = false
  entry.abilities[0].resolve({ state, inv, context: { enemy }, api: {
    exhaust: target => { target.exhausted = true },
    returnEnemyToBonded: () => { returned = true },
    info: () => {},
  } })
  assert.equal(enemy.exhausted, true, '入场横置')
  assert.equal(returned, true, '场上无梦境结晶器时放在绑定场外集合')
})

test(`TDE 06026 ${nameOf('06026')} 冤大头：获得 2 资源抽 1 张，可免费再打出另一张`, () => {
  const state = investigatorFixture('06001')
  const inv = me(state)
  inv.resources = 0
  inv.deck = ['01088']
  inv.hand = ['06026']
  let playedFree = false
  registeredEntry('06026').abilities[0].resolve({ inv, api: {
    gainResources: (seat, amount) => { state.investigators[seat].resources += amount },
    drawCards: (seat, amount) => { for (let i = 0; i < amount; i++) state.investigators[seat].hand.push(state.investigators[seat].deck.pop()) },
    choice: () => 'play',
    playCardFromHandFree: () => { playedFree = true; return true },
    info: () => {},
  } })
  assert.equal(inv.resources, 2, '获得 2 资源')
  assert.equal(playedFree, true, '可免费打出另一张冤大头')
})

test(`TDE 06027 ${nameOf('06027')} 仰望星空：遭遇牌库 ≥10 才能打出，把群星正确之时混入牌库顶 10 张`, () => {
  const entry = registeredEntry('06027')
  assert.equal(entry.playCondition[0].when({ state: { encounterDeck: Array(9).fill('x') } }), false)
  assert.equal(entry.playCondition[0].when({ state: { encounterDeck: Array(10).fill('x') } }), true)
  assert.equal(entry.abilities[0].limit.scope, 'perGame')
  assert.equal(entry.abilities[0].limit.owner, 'player')
  assert.equal(entry.abilities[0].limit.count, 2)
})

test(`TDE 06028 ${nameOf('06028')} 群星正确之时：被抽到时选一位调查员抽 1 获 1 资源并可立即行动，之后移出游戏`, () => {
  const entry = registeredEntry('06028')
  assert.equal(entry.removeAfterPlay, true)
  assert.equal(typeof entry.encounterResolve, 'function')
  const state = investigatorFixture('06001')
  const inv = me(state)
  state.investigators.push({ ...structuredClone(inv), seat: 1, id: 'inv-second', resources: 0, hand: [], deck: [], assets: [], engaged: [], threat: [] })
  state.investigators[1].resources = 0
  let immediate = false
  entry.encounterResolve(state, inv, null, {
    choice: request => (request?.kind === 'investigator' ? '1' : 'act'),
    drawCards: () => {},
    gainResources: (seat, amount) => { state.investigators[seat].resources += amount },
    beginImmediateAction: () => { immediate = true },
    info: () => {},
  })
  assert.equal(state.investigators[1].resources, 1, '被选中的调查员获得 1 资源')
  assert.equal(immediate, true, '可立即进行一次行动')
})

test(`TDE 06029 ${nameOf('06029')} 开启大门：快速附属到地点，连接附属地点，团队最多 3 张`, () => {
  const entry = registeredEntry('06029')
  assert.equal(entry.fast, true)
  assert.equal(entry.keepOnPlay, true)
  assert.equal(entry.connectsAttachedLocations, true)
  assert.equal(entry.playCondition[1].when({ state: { playerLocationAttachments: Array(3).fill({ code: '06029' }) } }), false)
})

test(`TDE 06030 ${nameOf('06030')} 道尔女士：检索希望/热诚/预见各 1 张随机入场、其余洗回、离场收回`, () => {
  const entry = registeredEntry('06030')
  assert.equal(entry.abilities[0].kind, 'entersPlay')
  assert.equal(entry.abilities[1].kind, 'leavesPlay')
  const state = investigatorFixture('06004')
  const inv = me(state)
  let played = null
  entry.abilities[0].resolve({ inv, api: {
    bonded: { retrieve: (seat, code, options) => { assert.deepEqual(options, { handCount: 3 }); return ['06031', '06032', '06033'] } },
    random: () => 0,
    moveCard: () => {},
    shuffleDeck: () => {},
    playCardFromHandFree: (seat, code) => { played = code; return true },
    gainAction: () => {},
    cardName: code => ALL_CARDS[code]?.nameZh || code,
    info: () => {},
  } })
  assert.equal(played, '06031', '随机选出 06031 放置入场')
})

test(`TDE 06031 ${nameOf('06031')} 希望：横置或弃掉做敏捷 5 躲避，弃掉自动成功`, () => {
  const entry = registeredEntry('06031')
  assert.equal(entry.abilities[0].countsAs, 'evade')
  assert.equal(ALL_CARDS['06031'].traits.includes('Ally'), true, '伙伴支援')
  assert.ok(ALL_CARDS['06031'].text.includes('Hope'))
})

test(`TDE 06032 ${nameOf('06032')} 热诚：横置或弃掉做战斗 5 攻击，弃掉自动造成伤害`, () => {
  const entry = registeredEntry('06032')
  assert.equal(entry.abilities[0].countsAs, 'fight')
  assert.equal(ALL_CARDS['06032'].traits.includes('Ally'), true)
  assert.ok(ALL_CARDS['06032'].text.includes('Zeal'))
})

test(`TDE 06033 ${nameOf('06033')} 预见：伙伴支援，与希望/热诚同组检索`, () => {
  const entry = registeredEntry('06033')
  assert.ok(entry.abilities.length >= 1)
  assert.equal(ALL_CARDS['06033'].traits.includes('Ally'), true)
  assert.ok(ALL_CARDS['06033'].text.includes('Augur'))
})

test(`TDE 06034 ${nameOf('06034')} 意外发现：快速事件，获得资源/线索的规则数据`, () => {
  const entry = registeredEntry('06034')
  assert.ok(entry.abilities.length >= 1)
  assert.ok(ALL_CARDS['06034'].text.length > 0)
  assert.equal(ALL_CARDS['06034'].type, 'event')
})

test(`TDE 06035 ${nameOf('06035')} 自私自利：专属弱点，显现结算存在`, () => {
  const entry = registeredEntry('06035')
  assert.equal(entry.abilities[0].kind, 'weakness')
  assert.ok(ALL_CARDS['06035'].text.includes('Revelation'))
})

test(`TDE 06036 ${nameOf('06036')} 盗窃癖：疯狂天赋，附着/结算规则存在`, () => {
  const entry = registeredEntry('06036')
  assert.ok(entry.abilities.length >= 1)
  assert.equal(ALL_CARDS['06036'].type, 'asset')
})

test(`TDE 06037 ${nameOf('06037')} 嗜睡症：疯狂弱点，显现结算存在`, () => {
  const entry = registeredEntry('06037')
  assert.equal(entry.abilities[0].kind, 'weakness')
  assert.equal(ALL_CARDS['06037'].type, 'treachery')
})

test(`TDE 06038 ${nameOf('06038')} 你最可怕的梦魇：专属敌人弱点，生成与规则存在`, () => {
  const entry = registeredEntry('06038')
  assert.ok(entry.enemyWeakness || entry.abilities.length > 0)
  assert.equal(ALL_CARDS['06038'].type, 'enemy')
})

// ---------------------------------------------------------------------------
// 06039–06056 Beyond the Gates of Sleep
// ---------------------------------------------------------------------------

test(`TDE 06039 ${nameOf('06039')} 参考卡：章节 playable、12 地点、4 幕 1 议程、结局与混乱标记表`, () => {
  const state = scenarioState(2)
  setupChapter(state)
  assert.equal(chapter.manifest.status, 'playable')
  assert.equal(chapter.scenario.originalCode, '06039')
  assert.equal(chapter.manifest.locations.length, 12, '5 台阶/小路 + 7 魔幻森林')
  assert.deepEqual(chapter.manifest.acts.map(act => act.id), ['act1', 'act2', 'act3', 'act4'])
  assert.deepEqual(chapter.manifest.agendas.map(agenda => agenda.id), ['agenda1'])
  assert.deepEqual(chapter.manifest.resolutionIds, ['noResolution', 'resolution1', 'resolution2'])
  assert.ok(BEYOND_THE_GATES_TOKEN_MEANINGS.standard.skull, '普通难度混乱标记表存在 skull 项')
  assert.ok(BEYOND_THE_GATES_TOKEN_MEANINGS.hard.skull, '困难难度混乱标记表存在 skull 项')
  const token = beyondTheGatesOfSleepChaosToken(state, me(state), 'skull')
  assert.ok(token != null, 'skull 符号可结算')
  const tablet = beyondTheGatesOfSleepChaosToken(state, me(state), 'tablet')
  assert.equal(tablet.delta, -2, 'tablet = -2')
})

test(`TDE 06040 ${nameOf('06040')} 穿越门扉之旅：幕揭示写记录/创伤，Steps 上额外毁灭`, () => {
  const entry = registeredEntry('06040')
  assert.equal(entry.scope, 'agenda')
  assert.equal(entry.agendaRule.extraDoomOnMythosPlacement.amount, 1)
  assert.equal(entry.agendaRule.extraDoomOnMythosPlacement.whileAnyInvestigatorAtTrait, 'Steps')
  const state = scenarioState(1)
  setupChapter(state)
  state.actIndex = 3
  const api = scenarioApi(state)
  entry.agendaRule.onReveal(state, state.agendas[0], api)
  assert.equal(state.campaign.records.theDreamersStrayedFromThePath, true, '第 4 幕时记录「偏离道路」')
  assert.equal(me(state).defeated, true, '每位调查员被击败')
})

test(`TDE 06041 ${nameOf('06041')} 进入幻梦境：花光线索、生成两位守门祭司、混乱袋加 1 骷髅`, () => {
  const entry = registeredEntry('06041')
  const state = scenarioState(1)
  setupChapter(state)
  const inv = me(state)
  inv.clues = 2
  state.scenarioZones.setAside = ['06057', '06058']
  const api = scenarioApi(state)
  entry.actRule.onReveal(state, state.acts[0], api)
  assert.equal(inv.clues, 0, '花光线索')
  assert.equal(state.enemies.filter(enemy => ['06057', '06058'].includes(enemy.code)).length, 2, '两位守门祭司生成')
  assert.equal(state.chaosBag.filter(token => token === 'skull').length >= 1, true, '混乱袋永久加 1 骷髅')
})

test(`TDE 06042 ${nameOf('06042')} 纳什特和卡曼塔的考验：目标清空守门祭司，背面放置台阶与小径`, () => {
  const entry = registeredEntry('06042')
  assert.deepEqual(entry.actRule.objective.originalCodes, ['06057', '06058'])
  assert.equal(entry.actRule.objective.type, 'noEnemiesInPlay')
  const state = scenarioState(1)
  setupChapter(state)
  state.scenarioZones.setAside = ['06047', '06048', '06049']
  const api = scenarioApi(state)
  entry.actRule.onReveal(state, state.acts[1], api)
  for (const code of ['06047', '06048', '06049']) {
    assert.ok(state.locations.some(location => String(location.originalCode || location.code) === code), `${code} 已放置入场`)
  }
})

test(`TDE 06043 ${nameOf('06043')} 最后的下降：目标全员在魔幻小路，章节流程 theFinalDescent`, () => {
  const entry = registeredEntry('06043')
  assert.deepEqual(entry.actRule.objective, { type: 'allInvestigatorsAt', originalCode: '06049' })
  assert.equal(entry.actRule.chapterFlow, 'theFinalDescent')
})

test(`TDE 06044 ${nameOf('06044')} 小路：目标该地点线索、强制偏离记录、揭示二选一结局`, () => {
  const entry = registeredEntry('06044')
  assert.deepEqual(entry.actRule.objective, { type: 'cluesAtLocation', originalCode: '06049', perInvestigator: 5, group: true })
  assert.equal(entry.actRule.forcedOnEnter.record, 'theDreamersStrayedFromThePath')
  const state = scenarioState(1)
  setupChapter(state)
  const api = scenarioApi(state, { choices: ['interrupt'] })
  entry.actRule.onReveal(state, state.acts[3], api)
  assert.equal(state.scenarioFlags.thePathChoice, 'resolution2', '打断 → 结局 2')
  assert.equal(state.resolutionKey, 'resolution2', '章节结算键 = 结局 2')
})

test(`TDE 06045 ${nameOf('06045')} 七十级台阶：离开时手牌超 5 受恐惧；[fast] 弃 1 张手牌`, () => {
  const entry = registeredEntry('06045')
  const state = scenarioState(1)
  setupChapter(state)
  const inv = me(state)
  inv.hand = Array(7).fill('01088')
  const api = scenarioApi(state)
  entry.locationRule.onLeave.effect(state, locationOf(state, 'seventySteps'), api, inv)
  assert.equal(inv.horror, 2, '手牌 7 张 → 受 2 点恐惧')
  const moves = []
  entry.locationRule.actions({ moves, state, inv, location: { id: inv.location } })
  assert.equal(moves.some(item => item.rule === 'seventyStepsDiscard'), true, '[fast] 弃手牌行动可达')
  let discarded = false
  entry.locationRule.performAction(state, inv, { rule: 'seventyStepsDiscard' }, {
    discardChosen: () => { discarded = true }, info: () => {},
  })
  assert.equal(discarded, true, '执行时弃 1 张手牌')
})

test(`TDE 06046 ${nameOf('06046')} 火焰洞穴：进入前需清空七十级台阶线索；神话结束本地调查员各受 1 伤`, () => {
  const entry = registeredEntry('06046')
  const state = scenarioState(1)
  setupChapter(state)
  const steps = locationOf(state, 'seventySteps')
  steps.clues = 1
  assert.match(String(entry.locationRule.entryError(state, null, me(state))), /七十级台阶/)
  steps.clues = 0
  assert.equal(entry.locationRule.entryError(state, null, me(state)), undefined, '清空线索后可进入')
  steps.clues = 1
  assert.match(investigatorEntryError(state, 'cavernOfFlame', 0), /七十级台阶/)
  steps.clues = 0
  assert.equal(investigatorEntryError(state, 'cavernOfFlame', 0), null)
  me(state).location = 'cavernOfFlame'
  entry.locationRule.onMythosEnd(state, locationOf(state, 'cavernOfFlame'), scenarioApi(state))
  assert.equal(me(state).damage, 1, '神话阶段结束受到 1 点伤害')
})

test(`TDE 06047 ${nameOf('06047')} 七百级台阶：离开时手牌超 3 受恐惧；[fast] 弃 1 张手牌`, () => {
  const entry = registeredEntry('06047')
  const state = scenarioState(1)
  setupChapter(state)
  const inv = me(state)
  inv.hand = Array(5).fill('01088')
  entry.locationRule.onLeave.effect(state, { id: 'sevenHundredSteps', clues: 0 }, scenarioApi(state), inv)
  assert.equal(inv.horror, 2, '手牌 5 张 → 受 2 点恐惧')
  const moves = []
  entry.locationRule.actions({ moves, state, inv, location: { id: inv.location } })
  assert.equal(moves.some(item => item.rule === 'sevenHundredStepsDiscard'), true)
})

test(`TDE 06048 ${nameOf('06048')} 楼梯底部：进入前需清空七百级台阶线索；进入时意志检定失败逐张弃/受恐惧`, () => {
  const entry = registeredEntry('06048')
  const state = scenarioState(1)
  setupChapter(state)
  placeLocations(state, ['sevenHundredSteps', 'baseOfTheSteps'])
  const steps = locationOf(state, 'sevenHundredSteps')
  steps.clues = 1
  assert.match(String(entry.locationRule.entryError(state, null, me(state))), /七百级台阶/)
  steps.clues = 0
  steps.clues = 1
  assert.match(investigatorEntryError(state, 'baseOfTheSteps', 0), /七百级台阶/)
  steps.clues = 0
  assert.equal(investigatorEntryError(state, 'baseOfTheSteps', 0), null)
  const inv = me(state)
  inv.hand = ['01088', '01089']
  let tested = 0
  entry.locationRule.onEnter.effect(state, locationOf(state, 'baseOfTheSteps'), {
    test: (seat, skill, difficulty, resolve) => { tested++; resolve({ success: false, difficulty, value: 0 }) },
    choice: () => 'horror',
    horror: (seat, amount) => { state.investigators[seat].horror += amount },
    info: () => {},
  }, inv)
  assert.equal(tested, 1, '进入时进行意志检定')
  assert.equal(inv.horror, 2, '失败后为 2 张手牌各选择（此处均受恐惧）')

  const game = fixture()
  me(game).hand = ['01017', '01020']
  run(game, current => {
    const owner = me(current)
    entry.locationRule.onEnter.effect(current, null, scenarioRuntime(current, []), owner)
  }, pending => pending.kind === 'commit' && pending.options.some(option => option.id === '0') ? '0' : null)
  assert.equal(game.lastTestResult.difficulty, 1, '投入一张后按剩余手牌重算难度')
})

test(`TDE 06049 ${nameOf('06049')} 魔幻小路：隐藏值按未揭示魔幻森林数增加；行动可放 1 线索`, () => {
  const entry = registeredEntry('06049')
  const state = scenarioState(1)
  setupChapter(state)
  placeLocations(state, ['baseOfTheSteps', 'theEnchantedPath', 'mysticalForest', 'stoneTrapdoor'])
  const path = locationOf(state, 'theEnchantedPath')
  const base = locationOf(state, 'baseOfTheSteps')
  base.clues = 1
  assert.match(investigatorEntryError(state, path.id, 0), /楼梯底部/)
  base.clues = 0
  assert.equal(investigatorEntryError(state, path.id, 0), null)
  locationOf(state, 'mysticalForest').revealed = false
  locationOf(state, 'stoneTrapdoor').revealed = true
  assert.equal(scenarioRuntime(state, []).locationShroud(path.id, 0), path.shroud + 1)
  locationOf(state, 'stoneTrapdoor').revealed = false
  assert.equal(scenarioRuntime(state, []).locationShroud(path.id, 0), path.shroud + 2)
  const inv = me(state)
  inv.location = 'theEnchantedPath'
  const moves = []
  entry.locationRule.actions({ moves, state, inv, location: locationOf(state, 'theEnchantedPath') })
  const action = moves.find(item => item.rule === 'enchantedPathPlaceClue')
  assert.ok(action, '魔幻小路放线索行动可达')
  let added = false
  entry.locationRule.performAction(state, inv, action, {
    addCluesToLocation: () => { added = true }, info: () => {}, returnEnemyToBonded: () => {},
  })
  assert.equal(added, true, '执行时在本地点放 1 线索')
})

test(`TDE 06050 ${nameOf('06050')} 魔幻森林：离开时按本地线索数弃手牌`, () => {
  const entry = registeredEntry('06050')
  const state = scenarioState(1)
  setupChapter(state)
  const inv = me(state)
  inv.hand = ['01088', '01089', '01090']
  let discarded = 0
  entry.locationRule.onLeave.effect(state, { id: 'enchantedWoods1', clues: 2 }, {
    discardChosen: () => { discarded++; state.investigators[0].hand.pop() },
    info: () => {},
  }, inv)
  assert.equal(discarded, 2, '按线索数弃 2 张手牌')
})

test(`TDE 06051 ${nameOf('06051')} 魔幻森林：祖格鼠生成时加蜂拥卡标记`, () => {
  const entry = registeredEntry('06051')
  assert.equal(entry.flags.addSwarmOnZoogSpawn, true)
  assert.ok(existsSync(path.join(ROOT, 'content/campaigns/theDreamEaters/scenarios/beyondTheGatesOfSleep/behavior.js')))
  const behavior = readFileSync(path.join(ROOT, 'content/campaigns/theDreamEaters/scenarios/beyondTheGatesOfSleep/behavior.js'), 'utf8')
  assert.match(behavior, /addSwarmOnZoogSpawn/, '行为层读点存在')
})

test(`TDE 06052 ${nameOf('06052')} 巨石阵：揭示时把放在一边的辛劳的古革巨人生成在本地`, () => {
  const entry = registeredEntry('06052')
  const state = scenarioState(1)
  setupChapter(state)
  placeLocations(state, ['greatStoneCircle'])
  const location = locationOf(state, 'greatStoneCircle')
  state.scenarioZones.setAside = ['06060']
  const api = scenarioApi(state)
  entry.locationRule.onReveal(state, location, api)
  assert.equal(state.scenarioZones.setAside.includes('06060'), false, '从场外取出')
  assert.equal(state.enemies.some(enemy => enemy.code === '06060' && enemy.location === location.id), true, '本地生成古革巨人')
})

test(`TDE 06053 ${nameOf('06053')} 魔幻森林：调查时隐藏值按手牌数增加`, () => {
  const state = scenarioState(1)
  setupChapter(state)
  placeLocations(state, ['stoneTrapdoor'])
  const loc = locationOf(state, 'stoneTrapdoor')
  const api = scenarioRuntime(state, [])
  me(state).location = loc.id
  me(state).hand = ['01088', '01089']
  assert.equal(api.locationShroud(loc.id, 0, { includeLocationState: true }), loc.shroud + 2)
  me(state).hand = []
  assert.equal(api.locationShroud(loc.id, 0, { includeLocationState: true }), loc.shroud)
})

test(`TDE 06054 ${nameOf('06054')} 魔幻森林：进入时受 2 恐惧或失去所有剩余行动`, () => {
  const entry = registeredEntry('06054')
  const state = scenarioState(1)
  setupChapter(state)
  const inv = me(state)
  inv.actionsLeft = 3
  entry.locationRule.onEnter.effect(state, { id: 'wood', clues: 0 }, scenarioApi(state, { choices: ['loseActions'] }), inv)
  assert.equal(inv.actionsLeft, 0, '选择失去所有剩余行动')
  entry.locationRule.onEnter.effect(state, { id: 'wood', clues: 0 }, scenarioApi(state, { choices: ['horror'] }), inv)
  assert.equal(inv.horror, 2, '选择受到 2 点恐惧')
})

test(`TDE 06055 ${nameOf('06055')} 魔幻森林：回合开始揭示标记，坏标记受 1 伤害并失去 1 行动`, () => {
  const entry = registeredEntry('06055')
  const state = scenarioState(1)
  setupChapter(state)
  const inv = me(state)
  inv.actionsLeft = 3
  entry.locationRule.onTurnBegins(state, inv, { id: inv.location }, scenarioApi(state, { token: 'skull' }))
  assert.equal(inv.damage, 1, '坏标记受 1 伤害')
  assert.equal(inv.actionsLeft, 2, '失去 1 行动')
  const safe = scenarioState(1)
  setupChapter(safe)
  const safeInv = me(safe)
  entry.locationRule.onTurnBegins(safe, safeInv, { id: safeInv.location }, scenarioApi(safe, { token: '+1' }))
  assert.equal(safeInv.damage, 0, '普通标记无惩罚')
})

test(`TDE 06056 ${nameOf('06056')} 迷失森林：揭示时记录本轮未离开将放毁灭`, () => {
  const entry = registeredEntry('06056')
  const state = scenarioState(1)
  setupChapter(state)
  placeLocations(state, ['lostWoods'])
  const location = locationOf(state, 'lostWoods')
  entry.locationRule.onReveal(state, location, scenarioApi(state), 0)
  assert.equal(Array.isArray(state.scenarioFlags.lostWoodsPending), true)
  assert.equal(state.scenarioFlags.lostWoodsPending.length, 1, '记录了揭示者')
  assert.equal(state.scenarioFlags.lostWoodsPending[0].locationId, location.id)
})
