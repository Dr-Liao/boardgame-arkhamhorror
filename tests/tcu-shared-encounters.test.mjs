// 万象无终（TCU）共享遭遇组（P8 / W-shared）验收测试。
//
// 写法：钩子级（照 tests/tfa-untamed-wilds.test.mjs）——自建假状态，直接调用
// content/campaigns/theCircleUndone/encounter-rules.js 的共享钩子与 23 张单卡条目的
// enemyScript / encounterResolve，不启动真实对局。
//
// 条目的注册：新条目要等 Lead 合并后重建 encounter-entries/index.js 才会进入引擎注册表；
// 本测试先把 23 个条目手动 registerCardAbilities，这样 card-rules.js 的读点
//（enemyScriptFor / treacheryRuleFor / encounterResolveFor …）在合并前就能验收。
import test from 'node:test'
import assert from 'node:assert/strict'
// 只注册本测试要用的 23 个条目：不 import engine.js，避免并行 worker 尚未合并的
// 其他 TCU 章节条目（引擎在 import 时会全局注册全部条目）影响本文件的独立验收。
import { registerCardAbilities, registeredEntry } from '../src/engine/ability.js'
import { entityParleyDescriptors, parleyMovesFor } from '../src/engine/parley.js'

import {
  encounterRules, resolveHauntedOnFailure, testActionKind, isSpectralLocation,
  spectralTargetRestricted, spectralEnemyTargetBlocked, watcherHuntedSeats, isHunted,
  markHuntedSeat, clearHuntedSeat, watcherTaken, markWatcherTaken, watcherSummary,
  agendaAside, agendaAsideCount, placeAgendaAside, removeAgendaAside,
  discardEncounterTop, witchEnemyEncountersInDiscard, isSpellOrRelicSource,
  enemyRuleReads, original, activeInvestigators, here, hasTrait, doomOn,
  resolveEncounterDeckEmptyForced, lastEncounterDrawn, consumeLastEncounterDrawn,
  parleyDifficultyBonus,
} from '../content/campaigns/theCircleUndone/encounter-rules.js'
import { enemyScriptFor, treacheryRuleFor, encounterResolveFor, enemyStatRuleFor } from '../src/cards/card-rules.js'
import { refreshNetherMistPrey } from '../src/cards/encounter-entries/theCircleUndone/_shared/spectral_predators/05100.js'

// ---- 23 张共享组单卡条目（一卡一文件） ----
import e05086 from '../src/cards/encounter-entries/theCircleUndone/_shared/the_watcher/05086.js'
import e05087 from '../src/cards/encounter-entries/theCircleUndone/_shared/the_watcher/05087.js'
import e05088 from '../src/cards/encounter-entries/theCircleUndone/_shared/agents_of_azathoth/05088.js'
import e05089 from '../src/cards/encounter-entries/theCircleUndone/_shared/agents_of_azathoth/05089.js'
import e05090 from '../src/cards/encounter-entries/theCircleUndone/_shared/anettes_coven/05090.js'
import e05091 from '../src/cards/encounter-entries/theCircleUndone/_shared/anettes_coven/05091.js'
import e05092 from '../src/cards/encounter-entries/theCircleUndone/_shared/witchcraft/05092.js'
import e05093 from '../src/cards/encounter-entries/theCircleUndone/_shared/witchcraft/05093.js'
import e05094 from '../src/cards/encounter-entries/theCircleUndone/_shared/witchcraft/05094.js'
import e05095 from '../src/cards/encounter-entries/theCircleUndone/_shared/silver_twilight_lodge/05095.js'
import e05096 from '../src/cards/encounter-entries/theCircleUndone/_shared/silver_twilight_lodge/05096.js'
import e05097 from '../src/cards/encounter-entries/theCircleUndone/_shared/silver_twilight_lodge/05097.js'
import e05098 from '../src/cards/encounter-entries/theCircleUndone/_shared/city_of_sins/05098.js'
import e05099 from '../src/cards/encounter-entries/theCircleUndone/_shared/city_of_sins/05099.js'
import e05100 from '../src/cards/encounter-entries/theCircleUndone/_shared/spectral_predators/05100.js'
import e05101 from '../src/cards/encounter-entries/theCircleUndone/_shared/spectral_predators/05101.js'
import e05102 from '../src/cards/encounter-entries/theCircleUndone/_shared/spectral_predators/05102.js'
import e05103 from '../src/cards/encounter-entries/theCircleUndone/_shared/trapped_spirits/05103.js'
import e05104 from '../src/cards/encounter-entries/theCircleUndone/_shared/trapped_spirits/05104.js'
import e05105 from '../src/cards/encounter-entries/theCircleUndone/_shared/realm_of_death/05105.js'
import e05106 from '../src/cards/encounter-entries/theCircleUndone/_shared/realm_of_death/05106.js'
import e05107 from '../src/cards/encounter-entries/theCircleUndone/_shared/inexorable_fate/05107.js'
import e05108 from '../src/cards/encounter-entries/theCircleUndone/_shared/inexorable_fate/05108.js'

const ENTRIES = [
  e05086, e05087, e05088, e05089, e05090, e05091, e05092, e05093, e05094, e05095, e05096,
  e05097, e05098, e05099, e05100, e05101, e05102, e05103, e05104, e05105, e05106, e05107, e05108,
]

// 合并前后都成立：若 encounter-entries/index.js 已经收录这 23 个条目（Lead 重建后），
// 引擎注册表里已存在，只补缺的；未收录时手动注册，让 card-rules 读点在合并前可验收。
const missingEntries = ENTRIES.filter(entry => !registeredEntry(entry.code))
if (missingEntries.length) registerCardAbilities(missingEntries)

const clone = value => structuredClone(value)

// ---- 假状态 ----
function stateFor(options = {}) {
  const count = options.count ?? 2
  const locationIds = options.locationIds ?? ['a', 'b']
  const locations = locationIds.map((id, index) => ({
    id, name: id.toUpperCase(), connections: options.connections?.[id]
      ?? (locationIds[index + 1] ? [locationIds[index + 1]] : []),
    clues: 0, revealed: true, attachments: [], doom: 0,
    ...(options.locationExtra?.[id] || {}),
  }))
  return {
    scenario: {
      id: 'tcuSharedProbe',
      locations: options.scenarioLocations ?? {},
      ...(options.hauntedOn ? { hauntedOn: options.hauntedOn } : {}),
    },
    investigators: Array.from({ length: count }, (_, seat) => ({
      seat, code: `0100${seat + 1}`, name: `调查员${seat + 1}`, location: locationIds[0],
      damage: 0, horror: 0, clues: 0, resources: 5, sanity: 5,
      hand: [], assets: [], threat: [], engaged: [], deck: [], discard: [], actionsLeft: 3,
    })),
    locations,
    enemies: [],
    storyAssets: [],
    scenarioFlags: {},
    scenarioZones: {},
    victoryDisplay: [],
    encounterDeck: [],
    encounterDiscard: [],
    campaign: { leadSeat: 0, records: {}, chaosBag: [] },
    chaosBag: [],
    difficulty: 'standard',
    numInvestigators: count,
    round: 1,
    phase: 'investigation',
    status: 'playing',
  }
}

// ---- 假 api（scenarioRuntime 的窄替身；只实现被测钩子会用到的成员） ----
function makeApi(state, options = {}) {
  const calls = []
  const answers = [...(options.answers || [])]
  const attackLog = []
  const api = {
    calls,
    attackLog,
    info(text) { calls.push({ type: 'info', text: String(text) }) },
    choose(request) {
      calls.push({ type: 'choose', request })
      if (options.choose) {
        const answer = options.choose(request, answers)
        if (answer !== undefined) return answer
      }
      return answers.shift() ?? request.options?.[0]?.id
    },
    test(seat, skill, difficulty, resolve, bonus = 0, source = null, testOptions = {}) {
      const outcome = options.tests?.length
        ? options.tests.shift()
        : { success: true, value: difficulty, difficulty, skill, source }
      const result = {
        ...outcome,
        skill: outcome.skill ?? skill,
        difficulty: outcome.difficulty ?? difficulty,
        source: outcome.source ?? source ?? testOptions.source ?? null,
      }
      calls.push({ type: 'test', seat, skill, difficulty, result })
      if (resolve) resolve(result)
      return result
    },
    haunted(seat, hauntedOptions) {
      calls.push({ type: 'haunted', seat, options: hauntedOptions })
    },
    // 引擎 scenario-runtime api.hauntedAt(id)：返回该地点的闹鬼能力列表（印刷 + 授予）。
    hauntedAt(locationId) {
      if (options.hauntedAt) return options.hauntedAt(locationId)
      const location = state.locations.find(entry => entry.id === locationId)
      return location?.haunted || []
    },
    setEnemyPreySeat(enemy, seat) {
      if (seat == null) delete enemy.preySeat
      else enemy.preySeat = seat
      return enemy.preySeat ?? null
    },
    setHauntedCommitCost(locationId) {
      state.hauntedCommitCost = { locationId, paidSeats: [] }
      return state.hauntedCommitCost
    },
    clearHauntedCommitCost() {
      delete state.hauntedCommitCost
      return true
    },
    markLocationCounter(locationId, key, amount = 1) {
      const location = state.locations.find(item => item.id === locationId)
      location[key] = Math.max(0, (Number(location[key]) || 0) + amount)
      return location[key]
    },
    recordEnemyDamageSource(enemy, source, round = state.round) {
      enemy.lastDamageSource = source ?? null
      enemy.lastDamagedRound = round
      return { source: enemy.lastDamageSource, round }
    },
    damage(seat, amount) {
      const inv = state.investigators[seat]
      inv.damage += Number(amount) || 0
      calls.push({ type: 'damage', seat, amount })
    },
    horror(seat, amount) {
      const inv = state.investigators[seat]
      inv.horror += Number(amount) || 0
      calls.push({ type: 'horror', seat, amount })
    },
    directDamage(seat, amount) {
      api.damage(seat, amount)
      calls.push({ type: 'directDamage', seat, amount })
    },
    damageAsset(seat, assetId, amount) {
      calls.push({ type: 'damageAsset', seat, assetId, amount })
    },
    discardRandom(seat, amount) {
      const inv = state.investigators[seat]
      for (let index = 0; index < amount && inv.hand.length; index++) inv.discard.push(inv.hand.pop())
      calls.push({ type: 'discardRandom', seat, amount })
    },
    // 引擎 scenario-runtime 的 canPlaceDoomOn 读点替身：默认允许；用例可用 options.canPlaceDoomOn 拦截。
    canPlaceDoomOn(card) {
      return options.canPlaceDoomOn ? options.canPlaceDoomOn(card) !== false : true
    },
    doomOn(card, amount = 1) {
      if (!api.canPlaceDoomOn(card)) {
        calls.push({ type: 'doomBlocked', card, amount })
        return 0
      }
      card.doom = (Number(card.doom) || 0) + Number(amount)
      calls.push({ type: 'doomOn', card, amount })
      return Number(amount)
    },
    threat(seat, code, extra = {}) {
      const inv = state.investigators[seat]
      const card = { id: `threat:${inv.seat}:${inv.threat.length}:${code}`, code, ...extra }
      inv.threat.push(card)
      calls.push({ type: 'threat', seat, code })
      return card
    },
    grantHaunted(grant) {
      state.hauntedGrants ||= []
      state.hauntedGrants.push(grant)
      calls.push({ type: 'grantHaunted', grant })
    },
    clearHauntedGrants(predicate) {
      if (!state.hauntedGrants) return 0
      const before = state.hauntedGrants.length
      state.hauntedGrants = state.hauntedGrants.filter(grant => !predicate(grant))
      calls.push({ type: 'clearHauntedGrants', removed: before - state.hauntedGrants.length })
      return before - state.hauntedGrants.length
    },
    attack(enemy, inv) {
      attackLog.push({ enemyId: enemy.id, seat: inv.seat })
    },
    spawnEngaged(code, location, seat) {
      const enemy = {
        id: `spawn:${code}:${state.enemies.length}`, code, originalCode: code, name: code,
        location, engagedSeat: seat, exhausted: false, damageTaken: 0, doom: 0, health: 7,
      }
      state.enemies.push(enemy)
      calls.push({ type: 'spawnEngaged', code, location, seat })
      return enemy
    },
    moveEnemy(enemy, location) { enemy.location = location },
    hunterStep(enemy, stepOptions) {
      if (options.hunterStep) return options.hunterStep(enemy, stepOptions)
      const location = state.locations.find(entry => entry.id === enemy.location)
      return location?.connections?.[0] ?? null
    },
    // 引擎 preyTarget 的替身：实例 preySeat 合法时优先，否则按候选顺序（与 card-ops 的并列兜底同口径）。
    preyTarget(rule, seats) {
      if (options.preyTarget) return options.preyTarget(rule, seats)
      if (Number.isInteger(rule?.preySeat) && seats.includes(rule.preySeat)) return rule.preySeat
      return seats.length ? seats[0] : null
    },
    engage(enemy, seat) {
      enemy.engagedSeat = seat
      const target = state.investigators[seat]
      if (target) target.engaged = [...new Set([...(target.engaged || []), enemy.id])]
      calls.push({ type: 'engage', seat, enemyId: enemy.id })
    },
    healEnemy(enemy, amount = 1) {
      const before = Number(enemy.damageTaken) || 0
      enemy.damageTaken = Math.max(0, before - Math.max(0, Number(amount) || 0))
      return before - enemy.damageTaken
    },
    readyEnemy(enemy) {
      enemy.exhausted = false
      return true
    },
    exhaustEnemy(enemy) {
      enemy.exhausted = true
      return true
    },
    drawEncounter(seat) {
      calls.push({ type: 'drawEncounter', seat })
      if (state.encounterDeck.length) state.encounterDeck.pop()
    },
    shuffleDiscard() {
      state.encounterDeck = [...state.encounterDeck, ...state.encounterDiscard]
      state.encounterDiscard = []
    },
    cannotAttack: enemy => options.cannotAttack?.(enemy) === true,
  }
  return api
}

const inv = (state, seat = 0) => state.investigators[seat]
const threatOf = (state, seat, code) => (inv(state, seat).threat || []).find(card => original(card) === code)

// ===========================================================================
// 1. 模块表面与条目完整性
// ===========================================================================
test('共享遭遇规则保留骨架导出名且钩子齐全', () => {
  for (const value of [encounterRules, resolveHauntedOnFailure, testActionKind, isSpectralLocation,
    spectralTargetRestricted, watcherHuntedSeats, isHunted, markHuntedSeat, clearHuntedSeat,
    agendaAside, agendaAsideCount, placeAgendaAside, removeAgendaAside, discardEncounterTop,
    witchEnemyEncountersInDiscard, isSpellOrRelicSource, enemyRuleReads, original,
    activeInvestigators, here, hasTrait, doomOn, resolveEncounterDeckEmptyForced,
    lastEncounterDrawn, consumeLastEncounterDrawn, parleyDifficultyBonus]) {
    assert.ok(value !== undefined && value !== null)
  }
  for (const hook of ['afterTest', 'canFightEnemy', 'canEvadeEnemy', 'enemySpawned', 'enemyMoved',
    'enemyDamaged', 'enemyDefeated', 'enemyAttackResolved', 'enemyPhaseEnd', 'enemyPhaseStart',
    'mythosEnded', 'enemyStatModifier', 'statModifier', 'turnBegins', 'turnEnded', 'roundEnded',
    'encounterDrawn', 'resolveEncounter', 'encounterActions', 'performEncounterAction']) {
    assert.equal(typeof encounterRules[hook], 'function', `缺少共享钩子 ${hook}`)
  }
})

test('23 张共享组条目一卡一文件、implemented 且 code/scope 合法', () => {
  assert.equal(ENTRIES.length, 23)
  const scopes = new Set(['enemy', 'treachery'])
  const codes = new Set()
  for (const entry of ENTRIES) {
    assert.equal(entry.implemented, true, `${entry.code} 必须 implemented: true`)
    assert.ok(scopes.has(entry.scope), `${entry.code} scope 非法：${entry.scope}`)
    assert.ok(!codes.has(entry.code), `${entry.code} 重复`)
    codes.add(entry.code)
  }
  // 敌人 9 / 诡计 14（scenario-inventory.json groups[] 口径）。
  assert.equal(ENTRIES.filter(entry => entry.scope === 'enemy').length, 9)
  assert.equal(ENTRIES.filter(entry => entry.scope === 'treachery').length, 14)
  // 条目已进 card-rules 读点（本测试手动注册）。
  assert.equal(enemyScriptFor('05088') !== null, true)
  assert.equal(treacheryRuleFor('05105')?.turnBeginsHaunted, true)
  assert.equal(encounterResolveFor('05106') !== null, true)
})

// ===========================================================================
// 2. 闹鬼失败窗口
// ===========================================================================
test('闹鬼失败窗口：攻击失败且剧本配置 fight 时结算一次', () => {
  const state = stateFor({ hauntedOn: ['investigate', 'fight', 'evade'] })
  const api = makeApi(state)
  const result = { success: false, value: 1, difficulty: 3, source: { label: '攻击' } }
  assert.equal(resolveHauntedOnFailure(state, inv(state), result, api), true)
  assert.equal(api.calls.filter(call => call.type === 'haunted').length, 1)
  assert.equal(api.calls.find(call => call.type === 'haunted').options.kind, 'fight')
  assert.equal(testActionKind(result), 'fight')
})

test('闹鬼失败窗口：调查失败不重复结算（引擎负责 investigate）', () => {
  const state = stateFor({ hauntedOn: ['investigate', 'fight', 'evade'] })
  const api = makeApi(state)
  const result = { success: false, value: 1, difficulty: 3, source: { label: '调查' } }
  assert.equal(resolveHauntedOnFailure(state, inv(state), result, api), false)
  assert.equal(api.calls.filter(call => call.type === 'haunted').length, 0)
  // 成功检定也不结算。
  assert.equal(resolveHauntedOnFailure(state, inv(state),
    { success: true, source: { label: '攻击' } }, api), false)
})

// ===========================================================================
// 3. 幽灵敌人目标限制
// ===========================================================================
test('幽灵敌人目标限制：非幽灵地点禁止攻击/躲避，幽灵地点允许', () => {
  const state = stateFor({
    locationIds: ['a', 'b'],
    scenarioLocations: { a: { spectral: true }, b: {} },
    locationExtra: { a: { spectral: true } },
  })
  const spectralEnemy = { id: 'e1', code: '05100', originalCode: '05100', traits: ['Monster', 'Spectral'], location: 'b' }
  const normalEnemy = { id: 'e2', code: '05090', originalCode: '05090', traits: ['Humanoid', 'Witch'], location: 'b' }
  // 调查员也在非幽灵地点 b：此时不能攻击幽灵敌人。
  inv(state, 0).location = 'b'
  assert.equal(spectralTargetRestricted(state), true)
  assert.equal(encounterRules.canFightEnemy(state, inv(state), spectralEnemy), false, '非幽灵地点不能攻击幽灵敌人')
  assert.equal(encounterRules.canEvadeEnemy(state, inv(state), spectralEnemy), false)
  assert.equal(encounterRules.canFightEnemy(state, inv(state), normalEnemy), true)
  // 移动到幽灵地点后允许。
  spectralEnemy.location = 'a'
  inv(state, 0).location = 'a'
  assert.equal(isSpectralLocation(here(state, inv(state))), true)
  assert.equal(encounterRules.canFightEnemy(state, inv(state), spectralEnemy), true)
})

test('幽灵敌人目标限制：没有幽灵地点的剧本不受影响，可按剧本覆盖', () => {
  const state = stateFor({ scenarioLocations: { a: {}, b: {} } })
  const spectralEnemy = { id: 'e1', code: '05100', traits: ['Spectral'], location: 'a' }
  assert.equal(spectralTargetRestricted(state), false)
  assert.equal(encounterRules.canFightEnemy(state, inv(state), spectralEnemy), true)
  state.scenario.spectralTargetLimit = true
  assert.equal(spectralEnemyTargetBlocked(state, inv(state), spectralEnemy), true)
})

// ===========================================================================
// 4. 看守人（watcher）跨章记录读点
// ===========================================================================
test('看守人记录：标记/查询/清除被追捕座位与被带走调查员', () => {
  const state = stateFor()
  markHuntedSeat(state, 1)
  markWatcherTaken(state, '05046')
  assert.deepEqual(watcherHuntedSeats(state), [1])
  assert.equal(isHunted(state, 1), true)
  assert.equal(isHunted(state, 0), false)
  assert.deepEqual(watcherTaken(state), ['05046'])
  assert.deepEqual(watcherSummary(state), { huntedSeats: [1], taken: ['05046'] })
  clearHuntedSeat(state, 1)
  assert.deepEqual(watcherHuntedSeats(state), [])
})

// ===========================================================================
// 5. agents_of_azathoth
// ===========================================================================
test('05088 吹笛手：敌军阶段结束攻击同地点未交战调查员', () => {
  const state = stateFor({ count: 2 })
  inv(state, 0).location = 'a'
  inv(state, 1).location = 'a'
  const piper = { id: 'piper', code: '05088', originalCode: '05088', name: '吹笛手', location: 'a', engagedSeat: 1, exhausted: true }
  state.enemies.push(piper)
  const api = makeApi(state)
  encounterRules.enemyPhaseEnd(state, api)
  assert.deepEqual(api.attackLog, [{ enemyId: 'piper', seat: 0 }], '只攻击未与其交战的 0 号调查员')
})

test('05089 魔鬼的笛声：吹笛手在场时对地点与连接地点造成恐惧', () => {
  const state = stateFor({ count: 2 })
  inv(state, 0).location = 'a'
  inv(state, 1).location = 'b'
  state.enemies.push({ id: 'piper', code: '05088', originalCode: '05088', location: 'a', engagedSeat: null })
  const api = makeApi(state)
  const resolved = encounterResolveFor('05089')(state, inv(state, 0), { code: '05089' }, api)
  assert.equal(resolved, false)
  assert.equal(inv(state, 0).horror, 1, '同地点调查员受到 1 点恐惧')
  assert.equal(inv(state, 1).horror, 1, '连接地点调查员也受到 1 点恐惧')
  assert.equal(agendaAsideCount(state, '05089'), 0)
})

test('05089 魔鬼的笛声：三张集齐弃掉并生成与猎物交战的吹笛手', () => {
  const state = stateFor({ count: 2 })
  inv(state, 0).horror = 3 // 剩余神智最低 → 猎物
  inv(state, 1).horror = 0
  inv(state, 0).location = 'a'
  inv(state, 1).location = 'b'
  state.encounterDeck = ['05088']
  const api = makeApi(state)
  const resolve = encounterResolveFor('05089')
  assert.equal(resolve(state, inv(state, 0), { code: '05089' }, api), true)
  assert.equal(resolve(state, inv(state, 0), { code: '05089' }, api), true)
  assert.equal(agendaAsideCount(state, '05089'), 2)
  assert.equal(resolve(state, inv(state, 0), { code: '05089' }, api), true)
  assert.equal(agendaAsideCount(state, '05089'), 0, '三张全部弃掉')
  assert.equal(state.encounterDiscard.filter(code => code === '05089').length, 3)
  assert.equal(state.enemies.filter(enemy => enemy.code === '05088').length, 1)
  assert.equal(state.enemies.find(enemy => enemy.code === '05088').engagedSeat, 0, '与剩余神智最低者交战')
})

// ===========================================================================
// 6. anettes_coven
// ===========================================================================
test('05090 女巫集会学徒：显现弃 2 张，耗尽时抽取弃牌堆巫术卡', () => {
  const state = stateFor()
  state.encounterDeck = ['05092']
  state.encounterDiscard = ['05093']
  const api = makeApi(state)
  const enemy = { id: 'initiate', code: '05090', originalCode: '05090', location: 'a', drawnBySeat: 0 }
  state.enemies.push(enemy)
  // 显现只在「抽到」时结算：共享 encounterDrawn 钩子记录最近抽到的卡号。
  encounterRules.encounterDrawn(state, inv(state, 0), '05090', api)
  encounterRules.enemySpawned(state, enemy, api)
  assert.equal(state.encounterDeck.length, 0, '遭遇牌库顶 2 张都被弃掉（原本只有 1 张）')
  assert.ok(state.encounterDiscard.includes('05092'))
  assert.equal(api.calls.some(call => call.type === 'drawEncounter' && call.seat === 0), true,
    '耗尽后抽取弃牌堆顶的巫术（Hex）卡牌')
  assert.equal(state.encounterDiscard.includes('05093'), false, '巫术卡离开弃牌堆')
})

test('05090 女巫集会学徒：效果生成不结算显现，只有本效果弃空牌库才继续', () => {
  // 剧本效果生成（最近抽到的不是 05090）：不弃牌库。
  const state = stateFor()
  state.encounterDeck = ['05092', '05093']
  const spawned = { id: 'i1', code: '05090', originalCode: '05090', location: 'a', drawnBySeat: 0 }
  const api = makeApi(state)
  state.scenarioFlags.lastEncounterDrawn = { code: '05099', round: 1, seat: 0 }
  encounterRules.enemySpawned(state, spawned, makeApi(state))
  assert.equal(state.encounterDeck.length, 2, '效果生成不结算显现')
  // 抽到 05090 时弃 2 张把牌库清空（弃牌前有牌）→ 继续抽巫术。
  state.scenarioFlags.lastEncounterDrawn = { code: '05090', round: 1, seat: 0 }
  encounterRules.encounterDrawn(state, inv(state, 0), '05090', api)
  encounterRules.enemySpawned(state, { id: 'i2', code: '05090', originalCode: '05090', location: 'a', drawnBySeat: 0 }, api)
  assert.equal(api.calls.some(call => call.type === 'drawEncounter'), true)
  // 牌库本来就是 0 时弃不出牌，不触发「本效果耗尽」。
  const empty = stateFor()
  empty.scenarioFlags.lastEncounterDrawn = { code: '05090', round: 1, seat: 0 }
  const emptyApi = makeApi(empty)
  encounterRules.encounterDrawn(empty, inv(empty, 0), '05090', emptyApi)
  encounterRules.enemySpawned(empty, { id: 'i3', code: '05090', originalCode: '05090', location: 'a', drawnBySeat: 0 }, emptyApi)
  assert.equal(emptyApi.calls.some(call => call.type === 'drawEncounter'), false)
})

test('05090 弃空遭遇牌库 → 经共享 enemySpawned 通知，05091 立即重整并攻击', () => {
  const state = stateFor()
  inv(state, 0).location = 'a'
  const priestess = { id: 'priestess', code: '05091', originalCode: '05091', location: 'a', exhausted: true, engagedSeat: null }
  state.enemies.push(priestess)
  state.encounterDeck = ['01166', '05098']
  state.encounterDiscard = []
  const api = makeApi(state)
  state.scenarioFlags.lastEncounterDrawn = { code: '05090', round: 1, seat: 0 }
  encounterRules.enemySpawned(state, { id: 'initiate', code: '05090', originalCode: '05090', location: 'a', drawnBySeat: 0 }, api)
  assert.equal(state.encounterDeck.length, 0, '牌库被弃空')
  assert.equal(priestess.exhausted, false, '遭遇牌库耗尽：女祭司重整')
  assert.deepEqual(api.attackLog.map(entry => entry.seat), [0, 1], '攻击其所在地点的每位调查员')
})

test('05099 弃空遭遇牌库 → 经共享 resolveEncounter 通知，05098 结算 2 恐惧与意志检定', () => {
  const state = stateFor()
  inv(state, 0).threat.push({ id: 'evil', code: '05098', originalCode: '05098' })
  // 05099 弃顶 n 张：牌库 1 张、弃牌堆 0 张、失败 2 点 → 弃 1 张后牌库空，洗回再弃 1 张，最终牌库为 0。
  state.encounterDeck = ['05091']
  state.encounterDiscard = []
  const api = makeApi(state, {
    tests: [
      { success: false, value: 3, difficulty: 5 }, // 05099 意志(5) 失败 2 点
      { success: true, value: 3, difficulty: 3 }, // 05098 意志(3) 成功
    ],
  })
  encounterRules.resolveEncounter(state, inv(state, 0), { code: '05099', originalCode: '05099' }, api)
  assert.equal(state.encounterDeck.length, 0, '05099 结算后牌库为空')
  assert.equal(inv(state, 0).horror, 2, '05098 触发：受到 2 点恐惧（只结算一次）')
  assert.equal(inv(state, 0).threat.some(card => original(card) === '05098'), false, '检定成功弃掉邪恶往昔')
  assert.equal(api.calls.filter(call => call.type === 'test').length, 2, '05099 + 05098 各一次检定，不重复')
})

test('05090：从幽灵遭遇牌库抽到时，弃牌与巫术卡抽取都走幽灵牌堆', () => {
  const state = stateFor()
  state.extraEncounterDecks = { spectral: { deck: ['01166'], discard: ['05093'] } }
  state.scenarioFlags.lastEncounterDeck = 'spectral'
  state.scenarioFlags.lastEncounterDrawn = { code: '05090', round: 1, seat: 0 }
  state.encounterDeck = ['05100']
  state.encounterDiscard = []
  const api = makeApi(state)
  const drawnFromSpectral = []
  api.drawExtra = (seat, deckId) => { // 模拟引擎 drawExtra：从幽灵牌库顶抽 1 张。
    const deck = state.extraEncounterDecks[deckId].deck
    if (deck.length) state.extraEncounterDecks[deckId].discard.push(deck.pop())
    drawnFromSpectral.push({ seat, deckId })
  }
  encounterRules.enemySpawned(state, { id: 'initiate', code: '05090', originalCode: '05090', location: 'a', drawnBySeat: 0 }, api)
  assert.deepEqual(state.extraEncounterDecks.spectral.deck, [], '幽灵牌库被弃空')
  assert.ok(state.extraEncounterDecks.spectral.discard.includes('01166'), '弃牌进幽灵弃牌堆')
  assert.ok(state.extraEncounterDecks.spectral.discard.includes('05093'), '巫术卡被抽取后（结算完）仍回幽灵弃牌堆')
  assert.deepEqual(drawnFromSpectral, [{ seat: 0, deckId: 'spectral' }], '抽取走 api.drawExtra(spectral)')
  assert.deepEqual(state.encounterDeck, ['05100'], '基础遭遇牌库不受影响')
  assert.deepEqual(state.encounterDiscard, [], '基础遭遇弃牌堆不受影响')
})

test('05091 女祭司：弃牌堆女巫敌人提供攻击/躲避加成（上限 3）', () => {
  const state = stateFor()
  const enemy = { id: 'priestess', code: '05091', originalCode: '05091', location: 'a' }
  state.enemies.push(enemy)
  state.encounterDiscard = ['05090', '05090', '05100', '05090', '05090']
  assert.equal(witchEnemyEncountersInDiscard(state), 4)
  assert.equal(enemyStatRuleFor('05091')?.fightEvadePerWitchInDiscard?.cap, 3)
  assert.equal(encounterRules.enemyStatModifier(state, enemy, 'fight'), 3)
  assert.equal(encounterRules.enemyStatModifier(state, enemy, 'evade'), 3)
  assert.equal(encounterRules.enemyStatModifier(state, enemy, 'health'), 0)
})

test('05091 女祭司：遭遇牌库耗尽时重整并攻击', () => {
  const state = stateFor()
  inv(state, 0).location = 'a'
  const enemy = { id: 'priestess', code: '05091', originalCode: '05091', location: 'a', exhausted: true, engagedSeat: null }
  state.enemies.push(enemy)
  const api = makeApi(state)
  enemyScriptFor('05091').onEncounterDeckEmpty(state, enemy, api)
  assert.equal(enemy.exhausted, false)
  assert.deepEqual(api.attackLog, [{ enemyId: 'priestess', seat: 0 }, { enemyId: 'priestess', seat: 1 }],
    '攻击其所在地点的每位调查员')
})

test('05091 女祭司：抽到牌库最后一张时立即触发强制（不等下一次抽牌）', () => {
  const state = stateFor()
  inv(state, 0).location = 'a'
  const enemy = { id: 'priestess', code: '05091', originalCode: '05091', location: 'a', exhausted: true, engagedSeat: null }
  state.enemies.push(enemy)
  state.encounterDeck = ['05100']
  state.encounterDeck.pop() // 引擎：本次抽牌抽走最后一张
  const api = makeApi(state)
  encounterRules.encounterDrawn(state, inv(state, 0), '05100', api)
  assert.equal(enemy.exhausted, false, '抽空牌库当次即重整')
  assert.equal(api.attackLog.length, 2, '并攻击同地点每位调查员')
})

// ===========================================================================
// 7. silver_twilight_lodge
// ===========================================================================
test('05095 秘社新信徒：任意无人地点生成、入场毁灭与谈判清空', () => {
  assert.equal(e05095.enemyRule.spawnAnyEmpty, true)
  assert.equal(e05095.enemySpawnRule.doomOnSpawn, 1)
  const state = stateFor()
  const enemy = { id: 'neophyte', code: '05095', originalCode: '05095', name: '秘社新信徒', location: 'a', doom: 0 }
  state.enemies.push(enemy)
  const api = makeApi(state)
  encounterRules.enemySpawned(state, enemy, api)
  assert.equal(enemy.doom, 1, '入场后放置 1 个毁灭标记')
  // 谈判由通用 Parley 原语枚举（src/engine/parley.js），条目只声明 actionKind:'parley' 的描述子。
  const parleys = parleyMovesFor(state, inv(state)).filter(move => move.entityId === enemy.id)
  assert.equal(parleys.length, 1)
  assert.equal(parleys[0].actionKind, 'parley')
  const descriptor = entityParleyDescriptors(enemy)[0]
  assert.equal(descriptor.actionKind, 'parley')
  const callParley = () => {
    let difficulty = null
    descriptor.resolve({ state, inv: inv(state), source: enemy, api: {
      test: (_seat, _skill, value, options) => { difficulty = value; options.resolve({ success: true }) },
      clearDoomOnCard: card => { card.doom = 0 },
      info: () => {},
    } })
    return difficulty
  }
  assert.equal(callParley(), 2)
  assert.equal(enemy.doom, 0, '谈判成功移除所有毁灭标记')
  // 05097 的「直到一轮结束 +2 难度」生效。
  enemy.doom = 2
  enemy.roundFightEvadeBonus = { round: state.round, amount: 2 }
  assert.equal(callParley(), 4)
  assert.equal(enemy.doom, 0)
})

test('05096 守密人：神话阶段结束放置毁灭，谈判用智识(3)', () => {
  const state = stateFor()
  const keeper = { id: 'keeper', code: '05096', originalCode: '05096', name: '守密人', location: 'a', doom: 0 }
  state.enemies.push(keeper)
  const api = makeApi(state)
  encounterRules.mythosEnded(state, api)
  assert.equal(keeper.doom, 1)
  const descriptor = entityParleyDescriptors(keeper)[0]
  let skill = null
  descriptor.resolve({ state, inv: inv(state), source: keeper, api: {
    test: (_seat, value, difficulty, options) => { skill = value; options.resolve({ success: true }) },
    clearDoomOnCard: card => { card.doom = 0 },
    info: () => {},
  } })
  assert.equal(skill, 'intellect')
  assert.equal(keeper.doom, 0)
})

test('05097 秘社玄仪：最近异教徒放置毁灭并获得 +2 难度；不能放毁灭的敌人被跳过/涌动', () => {
  const state = stateFor({ locationIds: ['a', 'b', 'c'], connections: { a: ['b'], b: ['a', 'c'], c: ['b'] } })
  const far = { id: 'cultist-far', code: '05090', traits: ['Humanoid', 'Cultist'], location: 'c', doom: 0 }
  const near = { id: 'cultist-near', code: '05096', traits: ['Humanoid', 'Cultist'], location: 'b', doom: 0 }
  state.enemies.push(far, near)
  const api = makeApi(state)
  encounterResolveFor('05097')(state, inv(state), { code: '05097' }, api)
  assert.equal(near.doom, 1, '最近的异教徒被放置毁灭')
  assert.equal(far.doom, 0)
  assert.deepEqual(near.roundFightEvadeBonus, { round: state.round, amount: 2 })
  assert.equal(encounterRules.enemyStatModifier(state, near, 'fight'), 2)
  assert.equal(encounterRules.enemyStatModifier(state, near, 'evade'), 2)

  // 最近的敌人不能放毁灭（如 05085b 生效后的银暮秘社敌人）→ 跳过它选次近的异教徒。
  const blockedNear = { id: 'cultist-near2', code: '05096', traits: ['Humanoid', 'Cultist'], location: 'b', doom: 0 }
  const allowedFar = { id: 'cultist-far2', code: '05090', traits: ['Humanoid', 'Cultist'], location: 'c', doom: 0 }
  const state2 = stateFor({ locationIds: ['a', 'b', 'c'], connections: { a: ['b'], b: ['a', 'c'], c: ['b'] } })
  state2.enemies.push(blockedNear, allowedFar)
  const blockedIds = new Set([blockedNear.id])
  encounterResolveFor('05097')(state2, inv(state2), { code: '05097' },
    makeApi(state2, { canPlaceDoomOn: enemy => !blockedIds.has(enemy.id) }))
  assert.equal(blockedNear.doom, 0, '不能放毁灭的最近敌人被跳过')
  assert.equal(allowedFar.doom, 1, '改在次近的异教徒上放毁灭')
  assert.deepEqual(allowedFar.roundFightEvadeBonus, { round: state2.round, amount: 2 })

  // 场上异教徒全都不能放毁灭 → 未因本效果放置毁灭，秘社玄仪获得涌动且不挂 +2。
  const state3 = stateFor({ locationIds: ['a', 'b'], connections: { a: ['b'], b: ['a'] } })
  const onlyBlocked = { id: 'cultist-only', code: '05096', traits: ['Humanoid', 'Cultist'], location: 'a', doom: 0 }
  state3.enemies.push(onlyBlocked)
  const allBlockedApi = makeApi(state3, { canPlaceDoomOn: () => false })
  encounterResolveFor('05097')(state3, inv(state3), { code: '05097' }, allBlockedApi)
  assert.equal(onlyBlocked.doom, 0)
  assert.equal(onlyBlocked.roundFightEvadeBonus, undefined, '未放置毁灭时不挂 +2 难度')
  assert.equal(allBlockedApi.calls.some(call => call.type === 'drawEncounter'), true, '未放置毁灭 → 涌动')

  // 无异教徒 → 涌动。
  state.enemies = []
  const surgeApi = makeApi(state)
  encounterResolveFor('05097')(state, inv(state), { code: '05097' }, surgeApi)
  assert.equal(surgeApi.calls.some(call => call.type === 'drawEncounter'), true)
})

// ===========================================================================
// 8. the_watcher
// ===========================================================================
test('05086 幽灵看守人：被击败时改为治疗/横置/不重整并留在场上', () => {
  const state = stateFor()
  inv(state, 0).engaged = ['watcher']
  const watcher = {
    id: 'watcher', code: '05086', originalCode: '05086', name: '幽灵看守人',
    location: 'a', damageTaken: 5, exhausted: false, engagedSeat: 0,
  }
  state.enemies.push(watcher)
  const api = makeApi(state)
  const replaced = encounterRules.enemyDefeated(state, watcher, api)
  assert.equal(replaced, true, '替代击败：不弃掉/不进胜利区')
  assert.equal(state.enemies.includes(watcher), true, '重新留在场上')
  assert.equal(watcher.damageTaken, 0, '治愈所有伤害')
  assert.equal(watcher.exhausted, true)
  assert.equal(watcher.engagedSeat, null)
  assert.deepEqual(inv(state, 0).engaged, [])
  assert.deepEqual(watcher.preventReady, { from: state.round, rounds: 1 })
})

test('05087 看守人的攫噬：治愈 3、重整、按敌军阶段移动/交战/攻击', () => {
  const state = stateFor({ count: 1, locationIds: ['a', 'b'] })
  const watcher = {
    id: 'watcher', code: '05086', originalCode: '05086', name: '幽灵看守人',
    location: 'a', damageTaken: 4, exhausted: true, engagedSeat: null, hunter: true,
  }
  state.enemies.push(watcher)
  // 猎手步：从 a 移到 b；抽到本卡的调查员在 b。
  inv(state, 0).location = 'b'
  const stepCalls = []
  const api = makeApi(state, {
    hunterStep: (enemy, stepOptions) => {
      stepCalls.push({ preySeat: enemy.preySeat, options: stepOptions })
      return 'b'
    },
  })
  encounterResolveFor('05087')(state, inv(state), { code: '05087' }, api)
  assert.equal(watcher.damageTaken, 1, '治愈 3 点伤害')
  assert.equal(watcher.location, 'b', '移动')
  assert.equal(watcher.engagedSeat, 0, '交战')
  assert.deepEqual(api.attackLog, [{ enemyId: 'watcher', seat: 0 }], '攻击')
  assert.equal(watcher.exhausted, true, '攻击后按敌军阶段横置')
  assert.equal(stepCalls.length, 1)
  assert.equal(stepCalls[0].options, undefined, '不传 targets 覆盖，由引擎按最近调查员选路')
  assert.equal(stepCalls[0].preySeat, 0, '结算期间「猎物 - 你」写入 preySeat 供并列裁决')
  assert.equal(Object.prototype.hasOwnProperty.call(watcher, 'preySeat'), false, '结算后恢复原 preySeat')
})

// ===========================================================================
// 9. spectral_predators
// ===========================================================================
test('05100 冥府之雾：为所在地点授予闹鬼并随移动迁移', () => {
  const state = stateFor()
  const mist = { id: 'mist', code: '05100', originalCode: '05100', location: 'a' }
  state.enemies.push(mist)
  const api = makeApi(state)
  encounterRules.enemySpawned(state, mist, api)
  assert.equal(state.hauntedGrants.length, 1)
  assert.equal(state.hauntedGrants[0].locationId, 'a')
  assert.equal(state.hauntedGrants[0].ability.id, '05100:mist')
  mist.location = 'b'
  encounterRules.enemyMoved(state, mist, 'b', api)
  assert.equal(state.hauntedGrants.filter(grant => grant.ability.id === '05100:mist').length, 1)
  assert.equal(state.hauntedGrants[0].locationId, 'b')
  encounterRules.enemyDefeated(state, mist, api)
  assert.equal(state.hauntedGrants.filter(grant => grant.ability.id === '05100:mist').length, 0)
})

test('05101 暗影猎犬：攻击后结算所在地点闹鬼', () => {
  const state = stateFor()
  const hound = { id: 'hound', code: '05101', originalCode: '05101', location: 'a' }
  state.enemies.push(hound)
  const api = makeApi(state)
  encounterRules.enemyAttackResolved(state, hound, inv(state), api)
  const haunted = api.calls.find(call => call.type === 'haunted')
  assert.ok(haunted)
  assert.equal(haunted.options.locationId, 'a')
})

test('05102 黑暗中的低语：放置牌库旁、每个地点获得闹鬼；轮末弃掉并撤销授予', () => {
  const state = stateFor()
  const api = makeApi(state)
  encounterResolveFor('05102')(state, inv(state), { code: '05102' }, api)
  assert.equal(agendaAsideCount(state, '05102'), 1)
  assert.equal(state.hauntedGrants.length, 1)
  assert.equal(state.hauntedGrants[0].locationId, 'all')
  assert.equal(state.hauntedGrants[0].ability.effect[0].kind, 'horror')
  encounterRules.roundEnded(state, api)
  assert.equal(agendaAsideCount(state, '05102'), 0)
  assert.equal(state.hauntedGrants.length, 0)
  assert.ok(state.encounterDiscard.includes('05102'))
})

// ===========================================================================
// 10. trapped_spirits
// ===========================================================================
test('05103 怨灵：非法术/遗物伤害击败改为附属地点并授予闹鬼', () => {
  const state = stateFor()
  const wraith = {
    id: 'wraith', code: '05103', originalCode: '05103', name: '怨灵',
    location: 'a', health: 2, damageTaken: 2,
  }
  state.enemies.push(wraith)
  const api = makeApi(state)
  encounterRules.enemyDamaged(state, wraith, api, 0, 'encounter')
  const replaced = encounterRules.enemyDefeated(state, wraith, api)
  assert.equal(replaced, true)
  assert.equal(state.locations.find(entry => entry.id === 'a').attachments.length, 1)
  assert.equal(state.hauntedGrants.length, 1)
  assert.deepEqual(state.hauntedGrants[0].ability.effect[0], { kind: 'spawn', code: '05103', locationId: 'a' })
})

test('05103 怨灵：法术/遗物伤害或非伤害击败时正常弃掉', () => {
  const state = stateFor()
  inv(state, 0).assets.push({ id: 'spell-asset', code: '01060' }) // 01060 = 皱缩术（Spell）
  const wraith = {
    id: 'wraith', code: '05103', originalCode: '05103', location: 'a', health: 2, damageTaken: 2,
  }
  state.enemies.push(wraith)
  const api = makeApi(state)
  encounterRules.enemyDamaged(state, wraith, api, 0, 'spell-asset')
  assert.equal(isSpellOrRelicSource(state, 'spell-asset'), true)
  assert.equal(encounterRules.enemyDefeated(state, wraith, api), false)
  // 非伤害击败（伤害未填满生命）也正常弃掉。
  const state2 = stateFor()
  const wraith2 = { id: 'w2', code: '05103', originalCode: '05103', location: 'a', health: 2, damageTaken: 0 }
  state2.enemies.push(wraith2)
  assert.equal(encounterRules.enemyDefeated(state2, wraith2, makeApi(state2)), false)
})

test('05104 被困的灵魂：检定失败按差额受到伤害', () => {
  const state = stateFor()
  const api = makeApi(state, { tests: [{ success: false, value: 1, difficulty: 3 }] })
  encounterResolveFor('05104')(state, inv(state), { code: '05104' }, api)
  assert.equal(inv(state, 0).damage, 2)
  // 第二段（投入卡牌的额外费用）已由 commit-extra-cost-hook 接线，不再登记为 simplified。
  assert.equal(e05104.simplified, undefined, '投入额外费用已实现，不再显式简化')
  assert.equal(typeof encounterRules.beforeCommitCard, 'function', '共享 behavior 提供 beforeCommitCard 钩子')
})

// ===========================================================================
// 11. realm_of_death
// ===========================================================================
test('05105 苦痛之地：威胁区 + 回合开始结算闹鬼 + 回合结束检定弃掉', () => {
  const state = stateFor()
  const api = makeApi(state)
  encounterResolveFor('05105')(state, inv(state), { code: '05105' }, api)
  assert.equal(inv(state, 0).threat.length, 1)
  encounterRules.turnBegins(state, inv(state), api)
  assert.equal(api.calls.filter(call => call.type === 'haunted').length, 1)
  const discardApi = makeApi(state) // 默认检定成功
  encounterRules.turnEnded(state, inv(state), discardApi)
  assert.equal(inv(state, 0).threat.length, 0, '检定成功弃掉苦痛之地')
  assert.ok(state.encounterDiscard.includes('05105'))
})

test('05106 雾中身形：显现结算所在地点每个闹鬼能力', () => {
  const state = stateFor()
  const api = makeApi(state)
  encounterResolveFor('05106')(state, inv(state), { code: '05106' }, api)
  const haunted = api.calls.find(call => call.type === 'haunted')
  assert.ok(haunted)
  assert.equal(haunted.options.locationId, 'a')
})

// ===========================================================================
// 12. inexorable_fate
// ===========================================================================
test('05107 恐怖夜色：失败放到密谋牌库旁，第三张触发全体 3 点恐惧', () => {
  const state = stateFor({ count: 2 })
  const api = makeApi(state, { tests: [{ success: false, value: 3, difficulty: 4 }] })
  const resolve = encounterResolveFor('05107')
  // 失败 1 点：不放牌库旁？——只要失败就放牌库旁，低于 3 点不获得涌动。
  resolve(state, inv(state, 0), { code: '05107' }, api)
  assert.equal(agendaAsideCount(state, '05107'), 1)
  assert.equal(api.calls.filter(call => call.type === 'drawEncounter').length, 0, '失败 <3 没有涌动')
  resolve(state, inv(state, 0), { code: '05107' }, makeApi(state, { tests: [{ success: false, value: 0, difficulty: 4 }] }))
  assert.equal(agendaAsideCount(state, '05107'), 2)
  const thirdApi = makeApi(state, { tests: [{ success: false, value: 0, difficulty: 4 }] })
  const thirdPlaced = resolve(state, inv(state, 0), { code: '05107' }, thirdApi)
  assert.equal(agendaAsideCount(state, '05107'), 0)
  assert.equal(thirdPlaced, false, '第三张由引擎弃置（返回 false = 本卡离开）')
  // 牌库旁的 2 张先推进弃牌堆；当前这张由引擎在 encounterResolve=false 后弃置 → 合计 3 张。
  assert.equal(state.encounterDiscard.filter(code => code === '05107').length, 2)
  state.encounterDiscard.push('05107') // 引擎路径：encounter.js 对 false 结果弃置当前卡
  assert.equal(state.encounterDiscard.filter(code => code === '05107').length, 3)
  assert.equal(inv(state, 0).horror, 3)
  assert.equal(inv(state, 1).horror, 3)
})

test('05107 恐怖夜色：从幽灵遭遇牌堆抽到时，牌库旁的 2 张弃回幽灵弃牌堆', () => {
  const state = stateFor({ count: 1 })
  state.extraEncounterDecks = { spectral: { deck: [], discard: [] } }
  const spectralApi = () => {
    state.scenarioFlags.lastEncounterDeck = 'spectral'
    return makeApi(state, { tests: [{ success: false, value: 0, difficulty: 4 }] })
  }
  const resolve = encounterResolveFor('05107')
  resolve(state, inv(state, 0), { code: '05107' }, spectralApi())
  resolve(state, inv(state, 0), { code: '05107' }, spectralApi())
  assert.equal(agendaAsideCount(state, '05107'), 2)
  assert.deepEqual(state.scenarioZones.agendaAside.filter(entry => entry.code === '05107').map(entry => entry.deck),
    ['spectral', 'spectral'], '每张记录来源牌堆')
  resolve(state, inv(state, 0), { code: '05107' }, spectralApi())
  assert.equal(agendaAsideCount(state, '05107'), 0)
  assert.equal(state.extraEncounterDecks.spectral.discard.filter(code => code === '05107').length, 2,
    '牌库旁的前 2 张进幽灵弃牌堆')
  assert.equal(state.encounterDiscard.filter(code => code === '05107').length, 0, '主遭遇弃牌堆不被污染')
})

test('05108 愚人的命运：无复制品进威胁区；有复制品时选择直接伤害/毁灭', () => {
  const state = stateFor({ count: 2 })
  const resolve = encounterResolveFor('05108')
  assert.equal(resolve(state, inv(state, 0), { code: '05108' }, makeApi(state)), true)
  assert.equal(inv(state, 0).threat.length, 1)
  // 第二位调查员抽到：选择「另一张愚人的命运上放毁灭」。
  const api = makeApi(state, { answers: ['otherCopy'] })
  resolve(state, inv(state, 1), { code: '05108' }, api)
  assert.equal(threatOf(state, 0, '05108').doom, 1)
  // 第三位（复用 0 号威胁区后再抽）选择直接伤害 → 只对持有一张的调查员。
  const api2 = makeApi(state, { answers: ['otherInvestigator'] })
  resolve(state, inv(state, 1), { code: '05108' }, api2)
  assert.equal(inv(state, 0).damage, 2)
})

// ===========================================================================
// 13. city_of_sins
// ===========================================================================
test('05098 邪恶往昔：首张进威胁区，重复时涌动；遭遇牌库耗尽强制', () => {
  const state = stateFor()
  const resolve = encounterResolveFor('05098')
  assert.equal(resolve(state, inv(state, 0), { code: '05098' }, makeApi(state)), true)
  assert.equal(inv(state, 0).threat.length, 1)
  const surgeApi = makeApi(state)
  assert.equal(resolve(state, inv(state, 0), { code: '05098' }, surgeApi), false)
  assert.equal(surgeApi.calls.some(call => call.type === 'drawEncounter'), true, '重复时获得涌动')
  // 卡面没有 [action] 摆脱行动：威胁区不应列出任何 encounterAction。
  assert.deepEqual(encounterRules.encounterActions(state, inv(state, 0)), [], '05098 卡面无 [action]')
  // 遭遇牌库耗尽：本次抽牌把牌库抽到 0 → 立即触发强制（旧实现在下一次抽牌才触发）。
  const emptyApi = makeApi(state, { tests: [{ success: false, value: 0, difficulty: 3 }] })
  state.encounterDeck = ['05090']
  state.encounterDeck.pop() // 引擎：先抽走最后一张
  encounterRules.encounterDrawn(state, inv(state, 0), '05090', emptyApi)
  assert.equal(inv(state, 0).horror, 2, '受到 2 点恐惧')
  assert.equal(inv(state, 0).threat.length, 1, '检定失败：邪恶往昔仍留在威胁区域')
  // 检定成功则弃掉邪恶往昔。
  const successState = stateFor()
  encounterResolveFor('05098')(successState, inv(successState, 0), { code: '05098' }, makeApi(successState))
  const successApi = makeApi(successState, { tests: [{ success: true, value: 5, difficulty: 3 }] })
  successState.encounterDeck = ['05090']
  successState.encounterDeck.pop()
  encounterRules.encounterDrawn(successState, inv(successState, 0), '05090', successApi)
  assert.equal(inv(successState, 0).threat.length, 0, '检定成功：弃掉邪恶往昔')
  assert.ok(successState.encounterDiscard.includes('05098'), '威胁区诡计弃置到遭遇弃牌堆')
})

test('05099 百年秘事：失败按差额弃遭遇牌；弃到诅咒诡计造成直接伤害', () => {
  const state = stateFor()
  state.encounterDeck = ['05100', '05090', '05101', '05098'] // 顶(末尾)=05098 诅咒诡计
  inv(state, 0).assets.push({ id: 'ally-1', code: '01018' }) // 01018 = 侍卫（盟友）
  const api = makeApi(state, { tests: [{ success: false, value: 2, difficulty: 5 }] })
  encounterResolveFor('05099')(state, inv(state, 0), { code: '05099' }, api)
  assert.equal(inv(state, 0).damage, 1, '弃到诅咒诡计：直接伤害 1')
  assert.ok(state.encounterDiscard.includes('05098'), '诅咒诡计被弃掉')
  assert.equal(api.calls.filter(call => call.type === 'damageAsset').length, 1, '盟友支援也受到伤害')
})

// ===========================================================================
// 14. witchcraft
// ===========================================================================
test('05092 恶魔之音：失败弃手牌，弃不掉的张数二选一', () => {
  const state = stateFor()
  inv(state, 0).hand = ['01018']
  state.encounterDiscard = ['05092']
  const api = makeApi(state, {
    tests: [{ success: false, value: 0, difficulty: 4 }],
    answers: ['damage', 'horror'],
  })
  encounterResolveFor('05092')(state, inv(state, 0), { code: '05092' }, api)
  // 难度 3 + 弃牌堆 1 张 = 4；失败 4 点：弃 1 张手牌，其余 3 点二选一（第 3 次在 defeat 前继续）。
  assert.deepEqual(inv(state, 0).discard, ['01018'])
  assert.equal(inv(state, 0).damage, 1)
  assert.equal(inv(state, 0).horror, 2)
})

test('05093 崩毁离析：每轮第一次技能检定 -1，横置女巫时摆脱检定自动成功', () => {
  const state = stateFor()
  const api = makeApi(state)
  encounterResolveFor('05093')(state, inv(state, 0), { code: '05093' }, api)
  assert.equal(inv(state, 0).threat.length, 1)
  // 本轮第一次检定期间每项技能 -1。
  assert.equal(encounterRules.statModifier(state, inv(state, 0), 'willpower'), -1)
  encounterRules.afterTest(state, inv(state, 0), { success: true, source: { label: '调查' } }, makeApi(state))
  assert.equal(encounterRules.statModifier(state, inv(state, 0), 'willpower'), 0, '本轮已检定过，不再 -1')
  // 横置的女巫敌人让摆脱检定自动成功。
  state.enemies.push({ id: 'witch', code: '05090', traits: ['Humanoid', 'Witch'], location: 'a', exhausted: true })
  const autoApi = makeApi(state)
  const moves = encounterRules.encounterActions(state, inv(state, 0))
  assert.equal(moves[0].rule, 'discardWracked')
  encounterRules.performEncounterAction(state, inv(state, 0), moves[0], autoApi)
  assert.equal(inv(state, 0).threat.length, 0, '自动成功：弃掉崩毁离析')
  assert.equal(autoApi.calls.filter(call => call.type === 'test').length, 0, '没有进行检定')
})

test('05094 苦痛折磨：进威胁区并列出摆脱行动', () => {
  const state = stateFor()
  const api = makeApi(state)
  encounterResolveFor('05094')(state, inv(state, 0), { code: '05094' }, api)
  assert.equal(inv(state, 0).threat.length, 1)
  const moves = encounterRules.encounterActions(state, inv(state, 0))
  assert.deepEqual(moves.map(move => move.rule), ['discardBedeviled'])
  // 引擎读点是条目顶级 threatEffect（moves.js 的 actionAbilityBlocked），不是 treacheryRule。
  assert.equal(e05094.threatEffect?.cannotTriggerActionAbilities, true, '[action] 禁制读点已声明')
  assert.equal(e05094.simplified, undefined, '禁制已有引擎读点，不再是显式简化')
})

// ===========================================================================
// 14.5 2026-10-25 修复回归：enemyMoved 语义 / 敌方阶段猎物 / 05087 门控 / 05089 猎物 /
//      05100 preySeat / 05103 多只怨灵 / 遭遇牌库耗尽触发
// ===========================================================================
test('enemyMoved：共享钩子以 enemy.location 为新地点、第三参只作旧地点（05100）', () => {
  const state = stateFor()
  inv(state, 0).location = 'a'
  const mist = { id: 'mist', code: '05100', originalCode: '05100', location: 'a' }
  state.enemies.push(mist)
  const api = makeApi(state)
  encounterRules.enemySpawned(state, mist, api)
  assert.equal(state.hauntedGrants[0].locationId, 'a')
  // 引擎语义：先更新 enemy.location，再把「移动前地点」作为第三参传给行为钩子。
  mist.location = 'b'
  encounterRules.enemyMoved(state, mist, 'a', api)
  assert.equal(state.hauntedGrants[0].locationId, 'b')
  assert.equal(state.hauntedGrants.length, 1, '移动先清旧授予再授予新地点')
  // 新语义（第三参=新地点）也必须兼容，避免引擎侧再改时共享规则失效。
  mist.location = 'a'
  encounterRules.enemyMoved(state, mist, 'a', api)
  assert.equal(state.hauntedGrants[0].locationId, 'a')
})

test('enemyPhaseStart：共享钩子派发条目 onEnemyPhaseStart 并刷新 05100 猎物', () => {
  const state = stateFor()
  inv(state, 0).location = 'a'
  inv(state, 1).location = 'b'
  const mist = { id: 'mist', code: '05100', originalCode: '05100', location: 'a' }
  state.enemies.push(mist)
  encounterRules.enemySpawned(state, mist, makeApi(state))
  assert.equal(mist.preySeat, 0, '当前只有 0 号调查员在场地')
  // 地点线索变化后，敌方阶段开始按「所在地点线索最多」重算猎物。
  state.locations.find(entry => entry.id === 'b').clues = 3
  encounterRules.enemyPhaseStart(state, makeApi(state))
  assert.equal(mist.preySeat, 1)
  // 并列时由队长选择，默认取第一个候选。
  state.locations.find(entry => entry.id === 'a').clues = 3
  const api = makeApi(state)
  encounterRules.enemyPhaseStart(state, api)
  assert.equal([0, 1].includes(mist.preySeat), true)
})

test('05087 看守人的攫噬：所在地点已有调查员时跳过猎手移动，仍交战并攻击', () => {
  const state = stateFor({ count: 1, locationIds: ['a', 'b'] })
  const watcher = {
    id: 'watcher', code: '05086', originalCode: '05086', name: '幽灵看守人',
    location: 'a', damageTaken: 4, exhausted: true, engagedSeat: null, hunter: true,
  }
  state.enemies.push(watcher)
  inv(state, 0).location = 'a' // 与看守人同地点：敌军阶段不会猎手移动
  let hunterCalls = 0
  const api = makeApi(state, { hunterStep: () => { hunterCalls++; return 'b' } })
  encounterResolveFor('05087')(state, inv(state, 0), { code: '05087' }, api)
  assert.equal(hunterCalls, 0, '同地点有调查员时不移动')
  assert.equal(watcher.damageTaken, 1, '治愈 3 点伤害')
  assert.equal(watcher.engagedSeat, 0, '交战抽牌者（猎物 - 你）')
  assert.deepEqual(api.attackLog, [{ enemyId: 'watcher', seat: 0 }], '攻击其交战调查员')
  // 无调查员同地点时按敌军阶段猎手规则移动一步（抽牌者非最近也朝最近者移动）。
  const state2 = stateFor({ count: 2, locationIds: ['a', 'b', 'c'], connections: { a: ['b'], b: ['a', 'c'], c: ['b'] } })
  const watcher2 = {
    id: 'watcher2', code: '05086', originalCode: '05086', name: '幽灵看守人',
    location: 'a', damageTaken: 0, exhausted: false, engagedSeat: null, hunter: true,
  }
  state2.enemies.push(watcher2)
  inv(state2, 1).location = 'b' // 最近的调查员
  inv(state2, 0).location = 'c' // 抽到本卡的调查员（更远）
  const moves = []
  const api2 = makeApi(state2, {
    hunterStep: (enemy, stepOptions) => {
      moves.push({ options: stepOptions, preySeat: enemy.preySeat })
      return 'b'
    },
    preyTarget: (enemy, seats) => seats.includes(enemy.preySeat) ? enemy.preySeat : seats[0],
  })
  encounterResolveFor('05087')(state2, inv(state2, 0), { code: '05087' }, api2)
  assert.equal(watcher2.location, 'b', '猎手移动按最近调查员（不强制朝抽牌者）')
  assert.equal(moves[0]?.options, undefined, '不传 targets：抽牌者非最近时不强制改道')
  assert.equal(moves[0]?.preySeat, 0, '结算期 preySeat=抽牌者，只在并列时参与裁决')
  assert.equal(watcher2.engagedSeat, 1, '在 b 与最近调查员交战（敌军阶段 autoEngageAll 口径）')
  assert.deepEqual(api2.attackLog, [{ enemyId: 'watcher2', seat: 1 }])
})

test('05089 魔鬼的笛声：猎物按印刷神智−恐惧，不再叠加支援神智轨道', () => {
  const state = stateFor({ count: 2 })
  inv(state, 0).location = 'a'
  inv(state, 1).location = 'a'
  inv(state, 0).horror = 4 // 5-4=1
  inv(state, 1).horror = 2 // 5-2=3
  inv(state, 0).assets.push({ id: 'ghost', code: '05236' }) // 神智轨道 3：旧实现会把它加到剩余神智上
  const resolve = encounterResolveFor('05089')
  const api = makeApi(state)
  resolve(state, inv(state, 0), { code: '05089' }, api)
  resolve(state, inv(state, 0), { code: '05089' }, api)
  resolve(state, inv(state, 0), { code: '05089' }, api)
  const spawned = state.enemies.find(enemy => enemy.code === '05088')
  assert.ok(spawned)
  assert.equal(spawned.engagedSeat, 0, '剩余神智最低者=0 号（旧实现会因支援神智误选 1 号）')
  assert.equal(spawned.preySeat, 0)
})

test('05089 魔鬼的笛声：猎物走引擎 preyTarget（getMaxSanity 修正生效，不再只读印刷神智）', () => {
  const state = stateFor({ count: 2 })
  inv(state, 0).location = 'a'
  inv(state, 1).location = 'a'
  const calls = []
  const api = makeApi(state)
  // 引擎 card-ops.preyTarget：这里模拟「修正后 1 号剩余神智更低」。
  api.preyTarget = (rule, seats) => { calls.push({ rule, seats }); return 1 }
  const resolve = encounterResolveFor('05089')
  resolve(state, inv(state, 0), { code: '05089' }, api)
  resolve(state, inv(state, 0), { code: '05089' }, api)
  resolve(state, inv(state, 0), { code: '05089' }, api)
  const spawned = state.enemies.find(enemy => enemy.code === '05088')
  assert.ok(spawned)
  assert.equal(calls.length, 1, '3 张齐了才查询一次猎物')
  assert.deepEqual(calls[0].rule, { prey: 'lowestSanity' })
  assert.deepEqual(calls[0].seats, [0, 1])
  assert.equal(spawned.engagedSeat, 1, '采用引擎返回的猎物座位（含神智修正）')
  assert.equal(spawned.preySeat, 1)
})

test('05103 怨灵：两只怨灵各自附属并获得独立闹鬼能力；对象来源识别法术', () => {
  const state = stateFor()
  const makeWraith = id => ({ id, code: '05103', originalCode: '05103', location: 'a', health: 2, damageTaken: 2 })
  const w1 = makeWraith('w1')
  const w2 = makeWraith('w2')
  state.enemies.push(w1, w2)
  const api = makeApi(state)
  encounterRules.enemyDamaged(state, w1, api, 0, 'encounter')
  assert.equal(encounterRules.enemyDefeated(state, w1, api), true)
  encounterRules.enemyDamaged(state, w2, api, 0, 'encounter')
  assert.equal(encounterRules.enemyDefeated(state, w2, api), true)
  assert.equal(state.locations.find(entry => entry.id === 'a').attachments.length, 2, '两只怨灵都附属')
  assert.equal(state.hauntedGrants.filter(grant => grant.ability.id.startsWith('05103:haunt:')).length, 2, '各自授予闹鬼')
  // 对象来源：{ kind:'asset', code:'01060'(Spell) } 视作法术伤害 → 正常弃掉。
  const state2 = stateFor()
  const w3 = makeWraith('w3')
  state2.enemies.push(w3)
  const api2 = makeApi(state2)
  encounterRules.enemyDamaged(state2, w3, api2, 0, { kind: 'asset', code: '01060' })
  assert.equal(encounterRules.enemyDefeated(state2, w3, api2), false)
})

test('parleyDifficultyBonus：05097 的谈判 +2 只在本轮有效', () => {
  const state = stateFor()
  const enemy = { id: 'cultist', roundFightEvadeBonus: { round: 1, amount: 2 } }
  assert.equal(parleyDifficultyBonus(state, enemy), 2)
  state.round = 2
  assert.equal(parleyDifficultyBonus(state, enemy), 0)
  assert.equal(parleyDifficultyBonus(state, { id: 'x' }), 0)
})

test('discardEncounterTop：弃到牌库由有到无时触发共享的遭遇牌库耗尽强制', () => {
  const state = stateFor()
  inv(state, 0).threat.push({ id: 'evil', code: '05098', originalCode: '05098' })
  state.encounterDeck = ['05090', '05091']
  const api = makeApi(state, { tests: [{ success: false, value: 0, difficulty: 3 }] })
  const discarded = discardEncounterTop(state, api, 2)
  assert.deepEqual(discarded, ['05091', '05090'])
  assert.equal(inv(state, 0).horror, 2, '耗尽触发 05098 的 2 点恐惧')
  // 只弃 1 张（牌库仍有牌）时不触发。
  const state2 = stateFor()
  inv(state2, 0).threat.push({ id: 'evil2', code: '05098', originalCode: '05098' })
  state2.encounterDeck = ['05090', '05091']
  discardEncounterTop(state2, makeApi(state2), 1)
  assert.equal(inv(state2, 0).horror, 0)
})
// ===========================================================================
// 15. 存档往返与确定性（saveReplay 证据）
// ===========================================================================
function playSharedRoute(seed = 7) {
  const state = stateFor({ count: 2 })
  inv(state, 0).hand = ['01018', '01019']
  state.encounterDeck = ['05092', '05090', '05099', '05100']
  state.encounterDiscard = ['05093']
  const api = makeApi(state, {
    answers: ['otherCopy', 'horror', 'damage', 'discardWarded'],
    tests: [
      { success: false, value: 0, difficulty: 4 },
      { success: false, value: 2, difficulty: 5 },
    ],
    hunterStep: () => 'b',
  })
  encounterResolveFor('05092')(state, inv(state, 0), { code: '05092' }, api)
  encounterResolveFor('05099')(state, inv(state, 0), { code: '05099' }, api)
  encounterRules.enemySpawned(state, {
    id: 'mist', code: '05100', originalCode: '05100', location: 'a',
  }, api)
  encounterResolveFor('05093')(state, inv(state, 0), { code: '05093' }, api)
  encounterResolveFor('05108')(state, inv(state, 0), { code: '05108' }, api)
  encounterRules.turnBegins(state, inv(state, 0), api)
  encounterRules.roundEnded(state, api)
  return state
}

test('同一路线两次运行完全一致（确定性）', () => {
  const first = playSharedRoute(7)
  const second = playSharedRoute(7)
  assert.equal(JSON.stringify(first), JSON.stringify(second))
})

test('共享组状态在 JSON 往返后一致（saveReplay）', () => {
  const state = playSharedRoute(11)
  const restored = JSON.parse(JSON.stringify(state))
  assert.deepEqual(restored, state)
  assert.deepEqual(restored.investigators[0].threat, state.investigators[0].threat)
  assert.deepEqual(restored.scenarioFlags, state.scenarioFlags)
  assert.deepEqual(restored.hauntedGrants, state.hauntedGrants)
})

// ===========================================================================
// 16. 第四轮 commit-extra-cost-hook：05104 被困的灵魂
// ===========================================================================
test('05104 被困的灵魂：闹鬼地点的检定在首次投入前结算该地点每个闹鬼能力（每 owner 每次一次）', () => {
  const state = stateFor()
  state.locations[0].haunted = [{ text: '闹鬼 - 受到 1 点恐惧。', effect: [{ kind: 'horror', amount: 1 }] }]
  const api = makeApi(state)
  let flagDuringTest = null
  const originalTest = api.test
  api.test = (...args) => {
    flagDuringTest = state.hauntedCommitCost ? { ...state.hauntedCommitCost } : null
    return originalTest(...args)
  }
  encounterResolveFor('05104')(state, inv(state, 0), { code: '05104' }, api)
  assert.equal(flagDuringTest?.locationId, 'a', '闹鬼地点：检定期间写额外费用上下文')
  assert.equal(state.hauntedCommitCost, undefined, '检定结束清除上下文')
  // 模拟引擎投入循环：同一 owner 首次投入前结算一次，重复调用不再结算。
  state.hauntedCommitCost = { locationId: 'a', paidSeats: [] }
  encounterRules.beforeCommitCard(state, inv(state, 0), { skill: 'agility', difficulty: 3 }, api)
  encounterRules.beforeCommitCard(state, inv(state, 0), { skill: 'agility', difficulty: 3 }, api)
  const hauntedCalls = api.calls.filter(call => call.type === 'haunted')
  assert.equal(hauntedCalls.length, 1, '每名调查员每次检定只结算一次')
  assert.deepEqual(hauntedCalls[0].options, { locationId: 'a', kind: 'effect', source: '05104' })
  delete state.hauntedCommitCost
  // 非闹鬼地点：条目不写上下文，钩子也不结算。
  const plain = stateFor()
  const plainApi = makeApi(plain)
  let plainFlag = 'unset'
  plainApi.test = () => { plainFlag = plain.hauntedCommitCost }
  encounterResolveFor('05104')(plain, inv(plain, 0), { code: '05104' }, plainApi)
  assert.equal(plainFlag, undefined, '非闹鬼地点的检定没有额外费用上下文')
  assert.equal(encounterRules.beforeCommitCard(plain, inv(plain, 0), {}, plainApi), false)
})
