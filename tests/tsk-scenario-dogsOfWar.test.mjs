// 战争疮痍（dogsOfWar · 09635 · 亚历山大）章节测试（P7）。
//
// 三层证据：
//   1. 章节装配 —— manifest（7 地点 / 1 幕 1 密谋 / 9 个结局 / 区域守恒 / 展示连线 ⊆ 规则连接）、
//      正文可读、四档混乱标记表；
//   2. 章节机械 —— 版本化布置（v. I/II/III：地点面、钥匙节点面、首领与密钥归属、混乱袋换标记）、
//      地点连接、路线分支（骑士/西里/恶兽）、巡逻（有钥匙节点的最近地点）、钥匙节点（守护/破坏）、
//      法罗斯之光（资源 → 控制权 → 变换）、遭遇卡行为（节点脉冲）、幕/密谋推进（R1/R2/R3/R5/R6/R8）、
//      时间与结局记录、JSON 往返（真实 tsk 原语容器校验）；
//   3. 单卡条目 —— 11 条专属条目逐条具备可执行声明（enemyRule / assetRule / encounterResolve / keyShift）。
import test from 'node:test'
import assert from 'node:assert/strict'
import { registerCardAbilities, registeredEntry } from '../src/engine/ability.js'
import { validateTskState } from '../src/engine/tsk-primitives.js'
import { ENCOUNTER_GROUPS } from '../content/campaigns/theScarletKeys/shared.js'
import * as tskKeys from '../src/engine/tsk-scarlet-keys.js'
import * as tskConcealed from '../src/engine/tsk-concealed.js'
import * as tskPatrol from '../src/engine/tsk-coterie.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import * as chapter from '../content/campaigns/theScarletKeys/scenarios/dogsOfWar/index.js'
import {
  CHAPTER_ENTRY_CODES, ENCOUNTER_DECK, GATHER_GROUPS, INTRO, KEY_LOCUS_DATA, LIGHT_OF_PHAROS, LOCUS_SITE_IDS,
  RAW_CODES, RECORD_KEYS, SET_ASIDE_CODES, START_LOCATION, VERSION_CODES, VERSION_SETUPS,
  clueValueOf, locationFaceFor, scenario,
} from '../content/campaigns/theScarletKeys/scenarios/dogsOfWar/definition.js'
import {
  ACTION_RULES, behavior, chapterState, chapterSummary, currentVersion, enemyAttacksKeyLoci, keyBearer,
  keyControlledByInvestigator, keyLociInPlay, knightAsset, markTime, resolveKeyShift, swapChaosToken, timePassed,
} from '../content/campaigns/theScarletKeys/scenarios/dogsOfWar/behavior.js'
import {
  DOGS_OF_WAR_TOKEN_MEANINGS, dogsOfWarAfterTest, dogsOfWarChaosToken, keyLocusEntities,
  keyLocusLocations, locationHasKeyLocus,
} from '../content/campaigns/theScarletKeys/scenarios/dogsOfWar/chaos.js'

// ---------------------------------------------------------------------------
// 条目注册（真实注册期校验：未知字段/未知 kind/未知窗口都会在这里失败）
// ---------------------------------------------------------------------------
const ENTRIES = []
for (const code of CHAPTER_ENTRY_CODES) {
  const module = await import(`../src/cards/encounter-entries/theScarletKeys/dogsOfWar/${code}.js`)
  ENTRIES.push(module.default)
}
for (const entry of ENTRIES) if (!registeredEntry(entry.code)) registerCardAbilities(entry)

const clone = value => JSON.parse(JSON.stringify(value))
const NOOP = () => {}
const ALLY = '01018'
const ITEM = '01020'
const SKILL = '01025'

// ---------------------------------------------------------------------------
// 状态与 api 桩（TSK 原语用真实模块；剧本运行时用窄桩）
// ---------------------------------------------------------------------------
function stateFor(count = 2, seed = 20261111) {
  return {
    scenario: clone(scenario),
    acts: clone(scenario.acts),
    agendas: clone(scenario.agendas),
    actIndex: 0,
    agendaIndex: 0,
    numInvestigators: count,
    difficulty: 'standard',
    round: 1,
    currentSeat: 0,
    doom: 0,
    rngState: seed,
    status: 'playing',
    locations: [],
    locationVariants: {},
    investigators: Array.from({ length: count }, (_, seat) => ({
      seat, code: '01001', name: `调查员${seat + 1}`, location: START_LOCATION, klass: 'seeker', traits: [],
      damage: 0, horror: 0, clues: 2, resources: 5, hand: [], assets: [], threat: [], engaged: [],
      deck: ['01002', '01003'], discard: [], actionsLeft: 3, defeated: false, resigned: false,
    })),
    enemies: [], setAsideEnemies: [], storyAssets: [], agendaAside: [], removedFromGame: [],
    encounterDeck: [...ENCOUNTER_DECK], encounterDiscard: [],
    scenarioZones: {}, scenarioFlags: {}, chaosBag: ['+1', '0', '-1', 'skull', 'tablet', 'elderthing'],
    campaign: {
      records: {}, leadSeat: 0,
      investigators: Array.from({ length: count }, () => ({ xp: 0, earnedXp: 0, deck: [] })),
      trauma: Array.from({ length: count }, () => ({ physical: 0, mental: 0 })),
    },
    victoryDisplay: [], victory: 0,
    infos: [], testCalls: [], testResults: [], choices: [], finished: [], advanced: 0, agendaAdvanced: 0,
    spawns: [], attacks: [], immediateActions: [], doomPlacements: [], played: [], reverted: 0, resigned: [],
  }
}

const locationOf = (state, id) => state.locations.find(location => location.id === id) || null

function placeLocation(state, id) {
  if (locationOf(state, id)) return locationOf(state, id)
  const base = state.scenario.locations[id]
  if (!base) return null
  const def = { ...base, ...(state.locationVariants?.[id] || {}) }
  const clues = def.cluesFixed ?? (def.cluesPerInvestigator != null
    ? def.cluesPerInvestigator * state.numInvestigators : 0)
  const revealed = state.investigators.some(inv => inv.location === id)
  const location = { ...def, id, revealed, clues: revealed ? clues : 0, maxClues: clues }
  location.connections = [...(base.connections || [])]
  state.locations.push(location)
  return location
}

function revealLocation(state, id) {
  const location = locationOf(state, id)
  if (!location) return null
  location.revealed = true
  location.clues = Number(location.maxClues) || 0
  return location
}

function apiFor(state, overrides = {}) {
  const api = {
    info: text => state.infos.push(String(text)),
    choose: request => {
      const answer = state.choices.length ? state.choices.shift() : null
      return answer ?? request?.options?.[0]?.id ?? null
    },
    choice: request => api.choose(request),
    cardName: code => ALL_CARDS[code]?.nameZh || code,
    test: (seat, skill, difficulty, resolve = null) => {
      state.testCalls.push({ seat, skill, difficulty })
      const result = state.testResults.length
        ? state.testResults.shift()
        : { success: true, value: difficulty + 2, difficulty, failedBy: 0, successBy: 2, drawn: [] }
      if (typeof resolve === 'function') resolve(result)
      return result
    },
    place: id => placeLocation(state, id),
    reveal: id => revealLocation(state, id),
    spawn: (code, locationId) => {
      const def = state.scenario.enemies[code]
        || { code, name: code, fight: 2, evade: 2, health: 2, damage: 1, horror: 1, traits: [] }
      const health = def.healthPerInvestigator
        ? def.healthPerInvestigator * state.numInvestigators : (def.health || 1)
      const enemy = {
        id: `enemy-${state.enemies.length + 1}`, code, originalCode: code, name: def.name || code,
        location: locationId, engagedSeat: null, exhausted: false, defeated: false, damageTaken: 0,
        health, fight: def.fight ?? 0, evade: def.evade ?? null,
        damage: def.damage || 0, horror: def.horror || 0, victory: def.victory || 0,
        traits: [...(def.traits || [])], alert: !!def.alert, hunter: !!def.hunter, retaliate: !!def.retaliate,
        aloof: !!def.aloof,
      }
      state.enemies.push(enemy)
      state.spawns.push({ code, locationId })
      behavior.enemySpawned?.(state, enemy, api)
      return enemy
    },
    setEnemyAside: enemy => {
      state.enemies = state.enemies.filter(item => item !== enemy)
      state.setAsideEnemies.push(enemy)
      return true
    },
    restoreEnemyFromAside: (id, locationId) => {
      const enemy = state.setAsideEnemies.find(item => item.id === id)
      if (!enemy) return null
      state.setAsideEnemies = state.setAsideEnemies.filter(item => item !== enemy)
      enemy.location = locationId
      state.enemies.push(enemy)
      return enemy
    },
    moveEnemy: (enemy, destination) => { enemy.location = destination; return true },
    moveInvestigator: (seat, destination) => { state.investigators[seat].location = destination },
    damageEnemy: (enemyId, amount) => {
      const enemy = state.enemies.find(item => item.id === enemyId)
      if (!enemy) return 0
      enemy.damageTaken = (Number(enemy.damageTaken) || 0) + amount
      if (enemy.damageTaken >= enemy.health) {
        const handled = behavior.enemyDefeated?.(state, enemy, api)
        state.enemies = state.enemies.filter(item => item !== enemy)
        enemy.defeated = true
        if (handled !== true) state.victoryDisplay.push({ code: enemy.code, originalCode: enemy.code })
      }
      return amount
    },
    healEnemy: (enemy, amount) => {
      enemy.damageTaken = Math.max(0, (Number(enemy.damageTaken) || 0) - amount)
    },
    addEnemyToVictory: enemy => {
      state.enemies = state.enemies.filter(item => item !== enemy)
      state.victoryDisplay.push({ code: enemy.code, originalCode: enemy.code })
    },
    removeFromGameCards: codes => { state.removedFromGame.push(...codes) },
    harm: (seat, { damage = 0, horror = 0 } = {}) => {
      state.investigators[seat].damage += damage
      state.investigators[seat].horror += horror
    },
    directDamage: (seat, amount) => { state.investigators[seat].damage += amount },
    damage: (seat, amount) => { state.investigators[seat].damage += amount },
    addTrauma: (seat, kind, amount = 1) => { state.campaign.trauma[seat][kind] += amount },
    loseResources: (seat, amount) => {
      state.investigators[seat].resources = Math.max(0, state.investigators[seat].resources - amount)
    },
    gainResources: (seat, amount) => { state.investigators[seat].resources += amount },
    spendClues: (seat, amount) => { state.investigators[seat].clues -= amount },
    payGroupClues: (amount, options = {}) => {
      const group = state.investigators.filter(inv => !options.atLocation || inv.location === options.atLocation)
      const total = group.reduce((sum, inv) => sum + (Number(inv.clues) || 0), 0)
      if (total < amount) return false
      let left = amount
      for (const inv of group) {
        const spend = Math.min(left, Number(inv.clues) || 0)
        inv.clues -= spend
        left -= spend
        if (!left) break
      }
      return true
    },
    drawCards: (seat, amount) => {
      const inv = state.investigators[seat]
      for (let index = 0; index < amount; index += 1) {
        const code = inv.deck.pop()
        if (code) inv.hand.push(code)
      }
    },
    lookAt: (seat, options = {}) => {
      state.lookAtCalls ||= []
      state.lookAtCalls.push({ seat, ...options })
      return []
    },
    shuffle: list => [...list],
    attachEncounterToLocation: (code, locationId, extra = {}) => {
      const location = locationOf(state, locationId)
      if (!location) return null
      location.attachments ||= []
      const attachment = { id: `locatt-${locationId}-${location.attachments.length + 1}-${code}`, code, ...extra }
      location.attachments.push(attachment)
      return attachment
    },
    detachLocationAttachment: (locationId, attachmentId) => {
      const location = locationOf(state, locationId)
      if (!location?.attachments) return null
      const index = location.attachments.findIndex(item => item.id === attachmentId)
      if (index < 0) return null
      return location.attachments.splice(index, 1)[0]
    },
    locationAttachments: locationId => [...(locationOf(state, locationId)?.attachments || [])],
    locationName: id => locationOf(state, id)?.name || id,
    addDoom: amount => { state.doom = (Number(state.doom) || 0) + amount },
    doomOn: (card, amount = 1) => {
      if (!card) return 0
      card.doom = (Number(card.doom) || 0) + amount
      behavior.doomPlaced?.(state, { target: card, amount, agenda: false }, api)
      state.doomPlacements.push({ code: card.code, amount })
      return card.doom
    },
    removeDoomFromCard: (card, amount = 1) => {
      const removed = Math.min(amount, Number(card?.doom) || 0)
      if (card) card.doom = (Number(card.doom) || 0) - removed
      return removed
    },
    evadeEnemy: (enemy, options = {}) => { enemy.exhausted = true; return options },
    disengage: enemy => { enemy.engagedSeat = null; return true },
    resign: seat => { state.resigned.push(seat); state.investigators[seat].resigned = true },
    advanceAct: () => { state.advanced += 1; state.actIndex += 1 },
    advanceAgenda: () => { state.agendaAdvanced += 1; state.agendaIndex += 1 },
    revertAgenda: () => { state.reverted += 1 },
    finish: key => state.finished.push(key),
    playCardFromHandFree: (seat, code, options = {}) => {
      const inv = state.investigators[seat]
      const index = inv.hand.indexOf(code)
      if (index < 0) return false
      inv.hand.splice(index, 1)
      state.played.push({ seat, code, ...options })
      return true
    },
    discardOneFromHand: seat => {
      const inv = state.investigators[seat]
      const code = inv.hand.shift()
      if (code) inv.discard.push(code)
      return code || null
    },
    addUses: (card, amount) => { card.uses = (Number(card.uses) || 0) + amount },
    locationDistance: (from, targets) => {
      const queue = [[from, 0]]
      const seen = new Set([from])
      while (queue.length) {
        const [id, steps] = queue.shift()
        if (targets.includes(id)) return steps
        for (const next of locationOf(state, id)?.connections || []) {
          if (seen.has(next)) continue
          seen.add(next)
          queue.push([next, steps + 1])
        }
      }
      return -1
    },
    mechanics: {
      tsk: {
        keys: {
          initialize: specs => tskKeys.initializeScarletKeys(state, specs),
          all: () => tskKeys.scarletKeys(state),
          get: id => tskKeys.scarletKey(state, id),
          face: id => tskKeys.keyFace(state, id),
          shift: (id, options) => tskKeys.shiftKey(state, id, options),
          shiftedThisRound: (id, round) => tskKeys.keyShiftedThisRound(state, id, round),
          bind: (id, bearer) => tskKeys.bindKey(state, id, bearer),
          steal: (id, bearer) => tskKeys.stealKey(state, id, bearer),
          heldBy: bearer => tskKeys.heldBy(state, bearer),
        },
        concealed: {
          miniCards: () => tskConcealed.concealedMiniCards(state),
          at: (locationId, position) => tskConcealed.concealedAt(state, locationId, position),
          byId: id => tskConcealed.concealedById(state, id),
          place: spec => tskConcealed.placeMiniCard(state, spec),
          distribute: spec => tskConcealed.distributeConcealed(state, spec),
          expose: id => tskConcealed.exposeMiniCard(state, id),
          reshuffle: options => tskConcealed.reshuffleConcealed(state, options),
        },
        patrol: {
          destination: enemy => tskPatrol.patrolDestination(state, enemy),
          target: patrol => tskPatrol.patrolTargetLocation(state, patrol),
        },
      },
    },
    ...overrides,
  }
  return api
}

const setup = (state, { choices = [] } = {}) => {
  for (const answer of choices) state.choices.push(answer)
  state.api = apiFor(state)
  behavior.setupLocations(state, [], { info: NOOP, api: state.api })
  return state
}

const keyLocusAt = (state, locationId) =>
  keyLocusEntities(state).find(entry => entry.location === locationId) || null

// ---------------------------------------------------------------------------
// 1. 装配 / 正文 / 混乱标记表
// ---------------------------------------------------------------------------
test('P7 dogsOfWar 清单：playable、7 地点 / 一幕一密谋 / 九个结局 / 正文可读', () => {
  const manifest = chapter.manifest
  assert.equal(manifest.id, 'dogsOfWar')
  assert.equal(manifest.campaignId, 'theScarletKeys')
  assert.equal(manifest.status, 'playable')
  assert.equal(manifest.referenceCode, '09635')
  assert.equal(manifest.locations.length, 7)
  assert.equal(manifest.startLocationId, START_LOCATION)
  assert.deepEqual(manifest.acts.map(act => act.id), ['act1'])
  assert.deepEqual(manifest.agendas.map(agenda => agenda.id), ['agenda1'])
  assert.deepEqual(manifest.resolutionIds, ['noResolution', 'resolution1', 'resolution2', 'resolution3',
    'resolution4', 'resolution5', 'resolution6', 'resolution7', 'resolution8'])
  assert.deepEqual(manifest.requiredPackIds, ['core', 'tskCampaign'])
  // manifest 只声明本战役 26 个遭遇组（darkCult 等外部/核心组由所需卡包声明）。
  assert.deepEqual(manifest.requiredEncounterGroupIds, GATHER_GROUPS.filter(group => ENCOUNTER_GROUPS.includes(group)).sort())
  assert.deepEqual(manifest.requiredMechanicIds, ['tskScarletKeys', 'tskConcealed', 'tskPatrol', 'tskMap'])
  // 遭遇牌库 = 专属组 + 版本一共享组按印刷份数展开（P0 修复：旧实现只有专属组 6 张）。
  const deck = Object.fromEntries(manifest.zones.encounterDeck.map(entry => [entry.cardCode, entry.count]))
  const expectedDeck = Object.fromEntries(ENCOUNTER_DECK.reduce((counts, code) => {
    counts.set(code, (counts.get(code) || 0) + 1)
    return counts
  }, new Map()))
  assert.deepEqual(deck, expectedDeck)
  assert.ok(Object.keys(deck).length > 6, '版本一共享组遭遇牌没有并入牌库')
  // 放在一边：两个首领的两面 + 两个钥匙节点面 + 法罗斯之光两面 + 不用的地点变体。
  const aside = manifest.zones.setAside.map(entry => entry.cardCode)
  for (const code of ['09653a', '09654a', '09655b', '09659a', '09659b', '09643', '09644', '09650', '09652']) {
    assert.ok(aside.includes(code), `${code} 应在放一边`)
  }
  // 版本一开局在场：七张地点 + 四张钥匙节点 + 暗红骑士 + 恶兽。
  const inPlay = Object.fromEntries(manifest.zones.inPlay.map(entry => [entry.cardCode, entry.count]))
  assert.equal(inPlay['09653b'], 4)
  assert.equal(inPlay['09642'], 1)
  assert.equal(inPlay['09651'], 1)
  assert.equal(inPlay['09654b'], 1)
  assert.equal(inPlay['09655a'], 1)
  // 展示连线不得创建规则连接：每条 edge 都在 manifest 的 connections 里。
  const connections = new Set(manifest.locations.flatMap(location =>
    location.connections.map(to => `${location.id}>${to}`)))
  for (const edge of manifest.layout.edges) {
    assert.ok(connections.has(`${edge.from}>${edge.to}`) || connections.has(`${edge.to}>${edge.from}`),
      `展示连线 ${edge.from}->${edge.to} 缺少规则连接`)
  }
  assert.equal(manifest.layout.edges.length, 10)
  // 正文：开场标题、完整设置、特别规则、九个结局。
  assert.ok(chapter.scenario.introTitle.length >= 4)
  assert.ok(chapter.scenario.intro.length > 400)
  assert.ok(chapter.scenario.setup.length > 100)
  for (const keyword of ['版本选择', '钥匙节点', '巡逻', '法罗斯之光', '混乱标记', '时间']) {
    assert.ok(chapter.scenario.specialRules.includes(keyword), `特别规则缺少 ${keyword}`)
  }
  for (const [key, text] of Object.entries(scenario.resolutions)) {
    assert.ok(String(text).length > 100, `${key} 正文缺失`)
  }
  for (const version of ['v1', 'v2', 'v3']) {
    assert.ok(VERSION_SETUPS[version].title.includes('版本'))
    assert.ok(VERSION_SETUPS[version].gatherSets.includes('战争疮痍'))
  }
  // 中英剧情都经 story-access 的同一份生成物读取。
  assert.ok(chapter.scenario.introEn.title.includes('Dogs of War'))
  assert.ok(chapter.scenario.introEn.intro1.length > 200)
  assert.ok(chapter.scenario.setupByVersionEn.v1.gatherSets.includes('Dogs of War'))
  assert.ok(chapter.scenario.resolutionsEn.resolution1.length > 100)
  assert.ok(chapter.scenario.resolutionsEn.resolution8.length > 100)
})

test('P7 dogsOfWar 混乱标记表：四档共用两套，skull 随钥匙节点再 -2', () => {
  assert.equal(DOGS_OF_WAR_TOKEN_MEANINGS.easy, DOGS_OF_WAR_TOKEN_MEANINGS.standard)
  assert.equal(DOGS_OF_WAR_TOKEN_MEANINGS.hard, DOGS_OF_WAR_TOKEN_MEANINGS.expert)
  assert.equal(DOGS_OF_WAR_TOKEN_MEANINGS.standard.cultist.delta, -3)
  assert.equal(DOGS_OF_WAR_TOKEN_MEANINGS.hard.cultist.delta, -5)
  // 标记文字来自指南生成物（story-text 的 tokens 段）。
  assert.ok(DOGS_OF_WAR_TOKEN_MEANINGS.standard.skull.text.includes('钥匙节点'))
  assert.ok(DOGS_OF_WAR_TOKEN_MEANINGS.hard.skull.text.includes('改为-4'))
  assert.ok(DOGS_OF_WAR_TOKEN_MEANINGS.standard.tablet.text.includes('巡逻'))
  assert.ok(DOGS_OF_WAR_TOKEN_MEANINGS.hard.elderthing.text.includes('失去1资源'))
  const state = setup(stateFor(1), { choices: ['accept'] })
  const inv = state.investigators[0]
  assert.deepEqual(dogsOfWarChaosToken(state, inv, 'skull'), { delta: -1 })
  inv.location = 'windsorPalaceHotel'
  assert.equal(locationHasKeyLocus(state, inv.location), true)
  assert.deepEqual(dogsOfWarChaosToken(state, inv, 'skull'), { delta: -3 })
  state.difficulty = 'hard'
  assert.deepEqual(dogsOfWarChaosToken(state, inv, 'skull'), { delta: -4 })
  assert.deepEqual(dogsOfWarChaosToken(state, inv, 'elderthing'), { delta: -3 })
})

test('P7 dogsOfWar 混乱标记后果：cultist 失败二选一、tablet 只对巡逻敌人的攻击生效', () => {
  const state = setup(stateFor(1), { choices: ['accept'] })
  const inv = state.investigators[0]
  const fail = { success: false, failedBy: 2, drawn: ['cultist'], cancelledTokens: [] }
  assert.deepEqual(dogsOfWarAfterTest(state, inv, fail, { resolvedTokens: ['cultist'] }), ['cultistHarmOrDoom'])
  assert.deepEqual(dogsOfWarAfterTest(state, inv, fail, { resolvedTokens: ['elderthing'] }),
    ['loseResourcesPerPoint'])
  const patrolTarget = { id: 'e1', patrol: { kind: 'named', locationId: 'windsorPalaceHotel' } }
  assert.deepEqual(dogsOfWarAfterTest(state, inv, { success: true, drawn: ['tablet'] },
    { resolvedTokens: ['tablet'], test: { actionKind: 'fight', target: patrolTarget } }), ['patrolDisengage'])
  assert.deepEqual(dogsOfWarAfterTest(state, inv, { success: true, drawn: ['tablet'] },
    { resolvedTokens: ['tablet'], test: { actionKind: 'investigate', target: null } }), [])
  state.difficulty = 'expert'
  assert.deepEqual(dogsOfWarAfterTest(state, inv, { success: true, drawn: ['tablet'] },
    { resolvedTokens: ['tablet'], test: { actionKind: 'fight', target: patrolTarget } }),
  ['patrolAttackDisengage'])
})

// ---------------------------------------------------------------------------
// 2. 版本化布置与地点连接
// ---------------------------------------------------------------------------
test('P7 dogsOfWar 布置（版本一）：地点入场、四张最后堡垒、骑士支援面与恶兽', () => {
  const state = stateFor(2)
  state.campaign.records[RECORD_KEYS.time] = 6
  setup(state, { choices: ['accept'] })
  assert.equal(currentVersion(state), 'v1')
  assert.equal(state.campaign.records[RECORD_KEYS.dealWithKnight], true)
  assert.equal(state.campaign.records[RECORD_KEYS.assistingSirry], undefined)
  assert.equal(state.chaosBag.filter(token => token === 'elderthing').length, 0)
  assert.equal(state.chaosBag.filter(token => token === 'tablet').length, 2)
  const ids = state.locations.map(location => location.id).sort()
  assert.deepEqual(ids, ['catacombs', 'qaitbayCitadel', 'theBourse', 'theCorniche', 'victoriaCollege',
    'windsorPalaceHotel', 'zanEtElSettat'].sort())
  const bourse = locationOf(state, 'theBourse')
  assert.equal(bourse.code, RAW_CODES.bourseLocusSafeguard)
  assert.equal(bourse.revealed, true)
  assert.equal(bourse.shroud, 2)
  assert.equal(bourse.maxClues, 2 * 2)
  const catacombs = locationOf(state, 'catacombs')
  assert.equal(catacombs.code, RAW_CODES.catacombsBloodyNexus)
  assert.equal(catacombs.revealed, false)
  assert.equal(catacombs.clues, 0)
  const loci = keyLociInPlay(state).filter(entry => state.enemies.includes(entry))
  assert.equal(loci.length, 4)
  for (const id of LOCUS_SITE_IDS) {
    const locus = keyLocusAt(state, id)
    assert.ok(locus, `${id} 应有钥匙节点`)
    assert.equal(locus.code, RAW_CODES.keyLocusLastBastion)
    assert.equal(locus.health, 6)
    assert.equal(locationOf(state, id).doom, 1)
  }
  const knight = knightAsset(state)
  assert.ok(knight, '暗红骑士应在场')
  assert.equal(knight.location, 'theBourse')
  assert.equal(knight.resources, 0)
  const beast = state.enemies.find(enemy => enemy.code === RAW_CODES.beastRavager)
  assert.ok(beast, '深红斗篷的恶兽应在场')
  assert.equal(beast.location, 'catacombs')
  assert.equal(keyBearer(state, state.api).type, 'none')
  assert.equal(chapterState(state).lightOfPharosAttachedTo, 'claretKnight')
  assert.equal(keyControlledByInvestigator(state, state.api), false)
  // 版本一密谋的「其它卡毁灭扣减」：4 个地点毁灭 → 密谋 -8，净总数 -4。
  assert.equal(state.doom, -8)
})

test('P7 dogsOfWar 布置（版本二）：敌人面骑士带钥匙、恶兽移除、结社刺客隐匿', () => {
  const state = stateFor(2)
  setup(state, { choices: ['refuse'] })
  assert.equal(currentVersion(state), 'v2')
  assert.equal(state.campaign.records[RECORD_KEYS.assistingSirry], true)
  assert.equal(state.chaosBag.filter(token => token === 'elderthing').length, 2)
  assert.equal(state.chaosBag.filter(token => token === 'tablet').length, 0)
  const bourse = locationOf(state, 'theBourse')
  assert.equal(bourse.code, RAW_CODES.bourseCoteriePost)
  assert.equal(bourse.revealed, false, '版本二的证券交易所未揭示')
  assert.equal(bourse.victory, 1)
  assert.equal(locationOf(state, 'catacombs').code, RAW_CODES.catacombsAncientTomb)
  assert.equal(locationOf(state, 'catacombs').revealed, true)
  for (const id of LOCUS_SITE_IDS) {
    const locus = keyLocusAt(state, id)
    assert.equal(locus.code, RAW_CODES.keyLocusDefensiveBarrier)
    assert.equal(locus.health, 3 * 2)
  }
  const knight = state.enemies.find(enemy => enemy.code === RAW_CODES.claretKnightEnemy)
  assert.ok(knight, '暗红骑士（敌人面）应在场')
  assert.equal(knight.location, 'theBourse')
  assert.equal(state.enemies.some(enemy => enemy.code === RAW_CODES.beastRavager), false)
  assert.equal(state.enemies.some(enemy => enemy.code === RAW_CODES.beastWolf), false)
  assert.equal(keyBearer(state, state.api).type, 'enemy')
  assert.equal(keyBearer(state, state.api).enemyId, knight.id)
  const minis = tskConcealed.concealedMiniCards(state)
  assert.equal(minis.length, 3, '1 真身 + 2 诱饵')
  assert.equal(minis.filter(card => !card.decoy).length, 1)
  assert.equal(state.setAsideEnemies.some(enemy => enemy.code === '09727a'), true, '结社刺客在阴影')
  assert.equal(state.enemies.some(enemy => enemy.code === '09727a'), false)
})

test('P7 dogsOfWar 布置（版本三）：恶兽（披着羊皮的狼）带钥匙、骑士移除', () => {
  const state = stateFor(1)
  state.campaign.records[RECORD_KEYS.time] = 21
  setup(state, { choices: ['accept'] })
  assert.equal(currentVersion(state), 'v3')
  assert.equal(state.campaign.records[RECORD_KEYS.dealWithKnight], true)
  assert.equal(locationOf(state, 'theBourse').code, RAW_CODES.bourseCommercialCenter)
  assert.equal(locationOf(state, 'catacombs').code, RAW_CODES.catacombsDenOfTheBeast)
  assert.equal(locationOf(state, 'catacombs').revealed, false)
  const beast = state.enemies.find(enemy => enemy.code === RAW_CODES.beastWolf)
  assert.ok(beast, '恶兽（披着羊皮的狼）应在场')
  assert.equal(beast.location, 'catacombs')
  assert.equal(state.enemies.some(enemy => enemy.code === RAW_CODES.claretKnightEnemy), false)
  assert.equal(knightAsset(state), null)
  assert.equal(keyBearer(state, state.api).type, 'enemy')
  assert.equal(chapterState(state).lightOfPharosAttachedTo, 'beast')
  const second = stateFor(1)
  second.campaign.records[RECORD_KEYS.time] = 22
  setup(second, { choices: ['refuse'] })
  assert.equal(currentVersion(second), 'v3')
  assert.equal(second.campaign.records[RECORD_KEYS.assistingSirry], true)
})

test('P7 dogsOfWar 地点连接：印刷符号成对双向，共 10 条边', () => {
  const state = setup(stateFor(2), { choices: ['accept'] })
  assert.deepEqual([...locationOf(state, 'theBourse').connections].sort(),
    ['victoriaCollege', 'windsorPalaceHotel'])
  assert.deepEqual([...locationOf(state, 'qaitbayCitadel').connections].sort(),
    ['theCorniche', 'victoriaCollege', 'windsorPalaceHotel', 'zanEtElSettat'])
  assert.deepEqual([...locationOf(state, 'catacombs').connections].sort(), ['theCorniche', 'zanEtElSettat'])
  let edges = 0
  for (const location of state.locations) {
    for (const to of location.connections) {
      const other = locationOf(state, to)
      assert.ok(other, `${location.id} 连接到不存在的地点 ${to}`)
      assert.ok(other.connections.includes(location.id), `${location.id}<->${to} 不对称`)
      edges += 1
    }
  }
  assert.equal(edges / 2, 10)
  const sites = state.locations.filter(location => (location.traits || []).includes('Locus Site')).map(location => location.id)
  assert.deepEqual([...sites].sort(), [...LOCUS_SITE_IDS].sort())
  // 版本二：证券交易所未揭示时不能进入（多于 1 个钥匙节点）。只剩 1 个后可以进入。
  const v2 = setup(stateFor(2), { choices: ['refuse'] })
  const bourseV2 = locationOf(v2, 'theBourse')
  const error = behavior.investigatorEntryError(v2, bourseV2, v2.investigators[0])
  assert.ok(error && error.includes('重兵把守'), '版本二的证券交易所应禁止进入')
  const loci = keyLociInPlay(v2)
  for (const locus of loci.slice(1)) v2.enemies = v2.enemies.filter(item => item !== locus)
  assert.equal(behavior.investigatorEntryError(v2, bourseV2, v2.investigators[0]), null)
})

// ---------------------------------------------------------------------------
// 3. 路线分支 / 巡逻 / 钥匙节点
// ---------------------------------------------------------------------------
test('P7 dogsOfWar 路线分支：版本决定幕/密谋、记录与混乱袋', () => {
  const v1 = setup(stateFor(1), { choices: ['accept'] })
  assert.equal(v1.acts[0].originalCode, RAW_CODES.actV1)
  assert.equal(v1.agendas[0].originalCode, RAW_CODES.agendaV1)
  assert.equal(v1.agendas[0].doomThreshold, 12)
  const v2 = setup(stateFor(1), { choices: ['refuse'] })
  assert.equal(v2.acts[0].originalCode, RAW_CODES.actV2)
  assert.equal(v2.agendas[0].originalCode, RAW_CODES.agendaV2)
  assert.equal(v2.agendas[0].doomThreshold, 14)
  const v3 = stateFor(1)
  v3.campaign.records[RECORD_KEYS.time] = 20
  setup(v3, { choices: ['accept'] })
  assert.equal(v3.acts[0].originalCode, RAW_CODES.actV3)
  assert.equal(v3.agendas[0].originalCode, RAW_CODES.agendaV3)
  // 版本已确定时再次进入布置不会再询问。
  const before = [...v1.choices]
  behavior.preScenarioSetup(v1, [], v1.api)
  assert.deepEqual(v1.choices, before, '版本已确定时不再询问')
  // 混乱袋换标记的 4 个上限：已经有 4 个 tablet 时改为每人 +1 经验。
  const capped = setup(stateFor(1), { choices: ['accept'] })
  capped.chaosBag = ['+1', '0', 'tablet', 'tablet', 'tablet', 'tablet', 'elderthing']
  swapChaosToken(capped, 'elderthing', 'tablet', capped.api)
  assert.equal(capped.chaosBag.filter(token => token === 'tablet').length, 4)
  assert.equal(capped.investigators[0].scenarioXpBonus, 1)
})

test('P7 dogsOfWar 巡逻：目标是有钥匙节点的最近地点，敌军阶段移动一步', () => {
  const state = setup(stateFor(2), { choices: ['accept'] })
  const api = state.api
  const keep = keyLocusAt(state, 'windsorPalaceHotel')
  state.enemies = state.enemies.filter(enemy => enemy === keep || enemy.code !== RAW_CODES.keyLocusLastBastion)
  assert.deepEqual(keyLocusLocations(state), ['windsorPalaceHotel'])
  const provocative = api.spawn(RAW_CODES.coterieProvocateur, 'catacombs')
  assert.equal(provocative.location, 'windsorPalaceHotel', '生成 - 有钥匙节点的最近地点')
  provocative.location = 'catacombs'
  provocative.exhausted = false
  behavior.enemyPhaseStart(state, api)
  assert.equal(provocative.patrol.kind, 'named')
  assert.equal(provocative.patrol.locationId, 'windsorPalaceHotel')
  assert.ok(['theCorniche', 'zanEtElSettat'].includes(provocative.location),
    `巡逻只走一步（实际 ${provocative.location}）`)
  // 猩红野兽在[[节点地]]：+2 攻击值 / -2 躲避值。
  const beast = api.spawn(RAW_CODES.scarletBeast, 'windsorPalaceHotel')
  assert.equal(behavior.enemyStatModifier(state, beast, 'fight', state.investigators[0]), 2)
  assert.equal(behavior.enemyStatModifier(state, beast, 'evade', state.investigators[0]), -2)
  beast.location = 'qaitbayCitadel'
  assert.equal(behavior.enemyStatModifier(state, beast, 'fight', state.investigators[0]), 0)
  // 结社煽动者重整时，同地点的调查员不能攻击其它敌人。
  const other = api.spawn(RAW_CODES.scarletBeast, 'qaitbayCitadel')
  const inv = state.investigators[0]
  inv.location = 'qaitbayCitadel'
  const provocateur = api.spawn(RAW_CODES.coterieProvocateur, 'qaitbayCitadel')
  // 结社煽动者生成时会先被挪到最近的钥匙节点；这里放回同地点以验证攻击限制。
  provocateur.location = 'qaitbayCitadel'
  provocateur.exhausted = false
  assert.equal(behavior.canFightEnemy(state, inv, other), false)
  assert.equal(behavior.canFightEnemy(state, inv, provocateur), undefined)
  provocateur.exhausted = true
  assert.equal(behavior.canFightEnemy(state, inv, other), undefined)
})

test('P7 dogsOfWar 钥匙节点：防御屏障可攻击/进胜利区，最后堡垒治愈/移出游戏', () => {
  const state = setup(stateFor(2), { choices: ['refuse'] })
  const api = state.api
  const inv = state.investigators[0]
  inv.location = 'windsorPalaceHotel'
  inv.clues = 3
  const locus = keyLocusAt(state, 'windsorPalaceHotel')
  const action = behavior.actions(state, inv).find(move => move.rule === ACTION_RULES.keyLocusDamage)
  assert.ok(action, '防御屏障应提供「花 1 线索造成 2 伤害」行动')
  behavior.performAction(state, inv, action, api)
  assert.equal(locus.damageTaken, 2)
  assert.equal(inv.clues, 2, '花费 1 个线索')
  behavior.performAction(state, inv,
    behavior.actions(state, inv).find(move => move.rule === ACTION_RULES.keyLocusDamage), api)
  behavior.performAction(state, inv,
    behavior.actions(state, inv).find(move => move.rule === ACTION_RULES.keyLocusDamage), api)
  assert.equal(state.enemies.includes(locus), false, '钥匙节点被击败')
  assert.ok(state.victoryDisplay.some(entry => entry.code === RAW_CODES.keyLocusDefensiveBarrier))
  // 版本一：最后堡垒（6 生命）→ 花 1 线索检定治愈；被击败移出游戏。
  const v1 = setup(stateFor(1), { choices: ['accept'] })
  const api1 = v1.api
  const hero = v1.investigators[0]
  hero.location = 'victoriaCollege'
  hero.clues = 2
  const bastion = keyLocusAt(v1, 'victoriaCollege')
  bastion.damageTaken = 3
  v1.testResults.push({ success: true, value: 4, difficulty: 2, successBy: 2, failedBy: 0, drawn: [] })
  behavior.performAction(v1, hero,
    behavior.actions(v1, hero).find(move => move.rule === ACTION_RULES.keyLocusHeal), api1)
  assert.equal(bastion.damageTaken, 0, '治愈 1 + 成功差值 2')
  const handled = behavior.enemyDefeated(v1, bastion, api1)
  assert.equal(handled, true, '最后堡垒被击败时返回 handled')
  assert.ok(v1.removedFromGame.includes(RAW_CODES.keyLocusLastBastion))
  // 场上没有钥匙节点后：暗红骑士算作钥匙节点（版本一）。
  v1.enemies = v1.enemies.filter(enemy => !enemy.keyLocus)
  behavior.roundEnded(v1, api1)
  assert.equal(keyLocusEntities(v1).some(entry => entry.countsAsLocus), true, '暗红骑士算作钥匙节点')
  assert.equal(locationHasKeyLocus(v1, 'theBourse'), true)
})

// ---------------------------------------------------------------------------
// 4. 幕 / 密谋推进
// ---------------------------------------------------------------------------
test('P7 dogsOfWar 幕背（版本一）：恶兽与每个钥匙节点进胜利区 → 结局 1 → 结局 8', () => {
  const state = setup(stateFor(2), { choices: ['accept'] })
  const api = state.api
  behavior.actReveal(state, state.acts[0], api)
  assert.deepEqual(state.finished, ['resolution1'])
  assert.ok(state.victoryDisplay.some(entry => entry.code === RAW_CODES.beastRavager))
  assert.ok(state.victoryDisplay.filter(entry => entry.code === RAW_CODES.keyLocusLastBastion).length >= 1)
  const result = behavior.resolution(state, 'resolution1', [], api)
  assert.deepEqual(result, { bonus: 0 })
  assert.equal(state.campaign.records[RECORD_KEYS.theCellAidedTheKnight], true)
  assert.equal(state.campaign.records[RECORD_KEYS.youHaventSeenTheLastOfTheBeast], true)
  assert.equal(state.campaign.records[RECORD_KEYS.time], 3)
})

test('P7 dogsOfWar 密谋背（版本一）：骑士未败 → 推进幕；骑士被击败 → 结局 3', () => {
  const state = setup(stateFor(2), { choices: ['accept'] })
  behavior.agendaReveal(state, state.agendas[0], state.api)
  assert.equal(state.advanced, 1, '密谋背面推进场景')
  assert.deepEqual(state.finished, [])
  // 骑士被击败：先让其它钥匙节点消失（骑士成为唯一钥匙节点），再让恶兽在证券交易所攻击它。
  const second = setup(stateFor(2), { choices: ['accept'] })
  const api2 = second.api
  second.enemies = second.enemies.filter(enemy => !enemy.keyLocus)
  behavior.roundEnded(second, api2)
  assert.equal(knightAsset(second).keyLocus, true, '骑士成为唯一钥匙节点')
  const beast = second.enemies.find(enemy => enemy.code === RAW_CODES.beastRavager)
  beast.location = 'theBourse'
  beast.exhausted = false
  const hits = enemyAttacksKeyLoci(second, api2)
  assert.equal(hits.length, 1, '恶兽攻击骑士一次')
  assert.equal(chapterState(second).claretKnightDefeated, true, '暗红骑士应被击败')
  assert.equal(second.agendaAdvanced, 1, '被击败触发密谋推进')
  behavior.agendaReveal(second, second.agendas[0], api2)
  assert.deepEqual(second.finished, ['resolution3'])
})

test('P7 dogsOfWar 幕目标（版本二/三）：骑士/恶兽被击败或调查员控制法罗斯之光', () => {
  const v2 = setup(stateFor(2), { choices: ['refuse'] })
  const api2 = v2.api
  assert.equal(behavior.checkObjectives(v2, api2), false)
  chapterState(v2).keyResources = 2
  v2.investigators[0].location = 'theBourse'
  v2.investigators[0].clues = 4
  behavior.performAction(v2, v2.investigators[0],
    behavior.actions(v2, v2.investigators[0]).find(move => move.rule === ACTION_RULES.keyResource), api2)
  assert.equal(chapterState(v2).keyResources, 3)
  assert.equal(chapterState(v2).keyControlledSeat, 0)
  assert.equal(keyControlledByInvestigator(v2, api2), true)
  assert.equal(behavior.checkObjectives(v2, api2), true)
  assert.equal(v2.advanced, 1)
  // 版本二：击败骑士也推进（另开一局，避免上一局已推进到没有幕）。
  const knightCase = setup(stateFor(2), { choices: ['refuse'] })
  chapterState(knightCase).claretKnightDefeated = true
  assert.equal(behavior.checkObjectives(knightCase, knightCase.api), true)
  assert.equal(knightCase.advanced, 1)
  // 版本三：恶兽被击败 → 推进。
  const v3 = stateFor(1)
  v3.campaign.records[RECORD_KEYS.time] = 20
  setup(v3, { choices: ['accept'] })
  chapterState(v3).beastDefeated = true
  assert.equal(behavior.checkObjectives(v3, v3.api), true)
})

test('P7 dogsOfWar 幕背（版本三）：与骑士交易 → 结局 5；帮助西里 → 结局 6', () => {
  const deal = stateFor(1)
  deal.campaign.records[RECORD_KEYS.time] = 20
  setup(deal, { choices: ['accept'] })
  behavior.actReveal(deal, deal.acts[0], deal.api)
  assert.deepEqual(deal.finished, ['resolution5'])
  behavior.resolution(deal, 'resolution5', [], deal.api)
  assert.equal(deal.campaign.records[RECORD_KEYS.theCellAidedTheKnight], true)
  assert.equal(deal.campaign.records[RECORD_KEYS.time], 23)
  const sirry = stateFor(1)
  sirry.campaign.records[RECORD_KEYS.time] = 20
  setup(sirry, { choices: ['refuse'] })
  behavior.actReveal(sirry, sirry.acts[0], sirry.api)
  assert.deepEqual(sirry.finished, ['resolution6'])
  const result = behavior.resolution(sirry, 'resolution6', [], sirry.api)
  assert.deepEqual(result, { bonus: 0 })
  assert.equal(sirry.campaign.records[RECORD_KEYS.youHaventSeenTheLastOfTheBeast], true)
  assert.equal(sirry.campaign.records[RECORD_KEYS.time], 22)
  assert.equal(keyBearer(sirry, sirry.api).type, 'investigator')
})

test('P7 dogsOfWar 密谋背（版本二/三）：创伤或撤退 + 翻回 + 10 毁灭', () => {
  const state = setup(stateFor(2), { choices: ['refuse'] })
  const api = state.api
  state.choices.push('trauma')
  behavior.agendaReveal(state, state.agendas[0], api)
  assert.equal(state.investigators[0].damage, 1, '直接伤害')
  assert.equal(state.campaign.trauma[0].physical, 1, '肉体创伤')
  assert.equal(state.reverted, 1, '翻回正面')
  assert.equal(state.doom, 10, '放置 10 个毁灭')
  const resign = setup(stateFor(2), { choices: ['refuse'] })
  resign.choices.push('resign')
  behavior.agendaReveal(resign, resign.agendas[0], resign.api)
  assert.deepEqual(resign.resigned, [0, 1])
  assert.equal(resign.doom, 10)
})

test('P7 dogsOfWar 地下陵墓（血腥联结）：6 毁灭强制揭示，正面行动自动躲避恶兽', () => {
  const state = setup(stateFor(1), { choices: ['accept'] })
  const api = state.api
  const catacombs = locationOf(state, 'catacombs')
  assert.equal(catacombs.revealed, false)
  state.doom = 5
  behavior.doomPlaced(state, { target: null, amount: 1, agenda: true }, api)
  assert.equal(catacombs.revealed, false, '还差 1 点')
  state.doom = 6
  behavior.doomPlaced(state, { target: null, amount: 1, agenda: true }, api)
  assert.equal(catacombs.revealed, true, '6 毁灭时揭示')
  const inv = state.investigators[0]
  inv.location = 'catacombs'
  const move = behavior.actions(state, inv).find(item => item.rule === ACTION_RULES.bloodyNexusEvade)
  assert.ok(move, '血腥联结应提供自动躲避行动')
  behavior.performAction(state, inv, move, api)
  const beast = state.enemies.find(enemy => enemy.code === RAW_CODES.beastRavager)
  assert.equal(beast.exhausted, true, '自动躲避（横置）')
  assert.equal(chapterState(state).bloodyNexusUsed, true)
  assert.equal(behavior.actions(state, inv).find(item => item.rule === ACTION_RULES.bloodyNexusEvade).used, true)
})

// ---------------------------------------------------------------------------
// 5. 法罗斯之光（密钥）与遭遇卡
// ---------------------------------------------------------------------------
test('P7 dogsOfWar 法罗斯之光：稳定面以 -3 打出 1 张手牌并翻面；动荡面弃手牌', () => {
  const state = setup(stateFor(1), { choices: ['refuse'] })
  const api = state.api
  const inv = state.investigators[0]
  tskKeys.stealKey(state, LIGHT_OF_PHAROS.id, { type: 'investigator', seat: 0 })
  chapterState(state).lightOfPharosAttachedTo = null
  chapterState(state).keyControlledSeat = 0
  inv.hand.push(ALLY)
  const stable = resolveKeyShift(state, 0, api, { by: 'investigator' })
  assert.equal(stable.face, RAW_CODES.lightOfPharosStable)
  assert.equal(stable.flipped, true)
  assert.deepEqual(state.played, [{ seat: 0, code: ALLY, discount: 3 }])
  assert.equal(inv.hand.includes(ALLY), false, '打出的牌离开手牌')
  assert.equal(tskKeys.keyFace(state, LIGHT_OF_PHAROS.id), RAW_CODES.lightOfPharosUnstable)
  inv.hand.push(ITEM, SKILL)
  state.round = 2
  const unstable = resolveKeyShift(state, 0, api, { by: 'investigator' })
  assert.equal(unstable.face, RAW_CODES.lightOfPharosUnstable)
  assert.equal(inv.hand.length, 0, '动荡面弃掉最多 2 张手牌')
  assert.equal(tskKeys.keyFace(state, LIGHT_OF_PHAROS.id), RAW_CODES.lightOfPharosStable, '翻回稳定面')
  // 敌人强制变换：只结算效果、不翻面。
  const enemy = state.enemies.find(item => item.code === RAW_CODES.claretKnightEnemy)
  tskKeys.stealKey(state, LIGHT_OF_PHAROS.id, { type: 'enemy', enemyId: enemy.id })
  chapterState(state).lightOfPharosAttachedTo = 'claretKnight'
  inv.hand.push(ALLY)
  const before = tskKeys.keyFace(state, LIGHT_OF_PHAROS.id)
  resolveKeyShift(state, 0, api, { by: 'enemy' })
  assert.equal(tskKeys.keyFace(state, LIGHT_OF_PHAROS.id), before, '敌人强制变换不翻面')
})

test('P7 dogsOfWar 节点脉冲：附属到有钥匙节点的最近地点，钥匙节点消失后弃掉', () => {
  const state = setup(stateFor(2), { choices: ['accept'] })
  const api = state.api
  const entry = registeredEntry(RAW_CODES.locusPulse)
  const inv = state.investigators[0]
  inv.location = 'qaitbayCitadel'
  const resolved = entry.encounterResolve(state, inv, { code: RAW_CODES.locusPulse }, api)
  assert.deepEqual(resolved, { placed: true })
  const attachedLocations = state.locations.filter(location =>
    (location.attachments || []).some(attachment => attachment.code === RAW_CODES.locusPulse))
  assert.equal(attachedLocations.length, 1)
  assert.ok(LOCUS_SITE_IDS.includes(attachedLocations[0].id), '附属到[[节点地]]')
  const attached = attachedLocations[0]
  const locus = keyLocusAt(state, attached.id)
  state.enemies = state.enemies.filter(enemy => enemy !== locus)
  behavior.roundEnded(state, api)
  assert.equal((attached.attachments || []).length, 0, '没有钥匙节点后弃掉节点脉冲')
})

test('P7 dogsOfWar 遭遇卡：节点脉冲的显现伤害/恐惧按地点结算', () => {
  const state = setup(stateFor(2), { choices: ['accept'] })
  const api = state.api
  const entry = registeredEntry(RAW_CODES.locusPulse)
  state.investigators[0].location = 'windsorPalaceHotel'
  state.investigators[1].location = 'windsorPalaceHotel'
  entry.encounterResolve(state, state.investigators[0], { code: RAW_CODES.locusPulse }, api)
  const attachment = locationOf(state, 'windsorPalaceHotel').attachments
    .find(item => item.code === RAW_CODES.locusPulse)
  assert.ok(attachment, '附属到温莎宫酒店（本地点的钥匙节点）')
  assert.equal(state.investigators[0].damage, 1)
  assert.equal(state.investigators[0].horror, 1)
  assert.equal(state.investigators[1].damage, 1)
})

// ---------------------------------------------------------------------------
// 6. 时间 / 结局 / JSON 往返
// ---------------------------------------------------------------------------
test('P7 dogsOfWar 结局：R2/R4/R6/R7/R8 的记录与时间', () => {
  const cases = [
    ['resolution2', 2, state => {
      assert.equal(state.campaign.records[RECORD_KEYS.youHaventSeenTheLastOfTheClaretKnight], true)
      assert.equal(keyBearer(state, state.api).type, 'investigator')
    }],
    ['resolution4', 1, state => {
      assert.equal(state.campaign.records[RECORD_KEYS.youHaventSeenTheLastOfTheClaretKnight], true)
      assert.equal(state.campaign.records.keyLightOfPharosBearer, 'claretKnight')
    }],
    ['resolution6', 2, state => {
      assert.equal(state.campaign.records[RECORD_KEYS.youHaventSeenTheLastOfTheBeast], true)
      assert.equal(keyBearer(state, state.api).type, 'investigator')
    }],
    ['resolution7', 1, state => {
      assert.equal(state.campaign.records[RECORD_KEYS.theDogsAreAtWar], true)
    }],
    ['resolution8', 3, state => {
      assert.equal(state.campaign.records[RECORD_KEYS.theCellAidedTheKnight], true)
      assert.equal(state.campaign.records[RECORD_KEYS.youHaventSeenTheLastOfTheBeast], true)
    }],
  ]
  for (const [key, time, check] of cases) {
    const state = setup(stateFor(1), { choices: ['accept'] })
    const result = behavior.resolution(state, key, [], state.api)
    assert.deepEqual(result, { bonus: 0 }, `${key} 应返回 bonus 0`)
    assert.equal(state.campaign.records[RECORD_KEYS.time], time, `${key} 应记 ${time} 点时间`)
    check(state)
  }
  // 未达成任一结局：按版本跳 R3/R4/R7（版本二 → 结局 4）。
  const noRes = setup(stateFor(1), { choices: ['refuse'] })
  behavior.resolution(noRes, 'noResolution', [], noRes.api)
  assert.equal(noRes.campaign.records[RECORD_KEYS.youHaventSeenTheLastOfTheClaretKnight], true)
  assert.equal(noRes.campaign.records[RECORD_KEYS.time], 1)
  // 时间与世界地图同步。
  const world = setup(stateFor(1), { choices: ['accept'] })
  world.campaign.tsk = { version: 1, map: { version: 1, current: 'Alexandria', visited: ['Alexandria'],
    unlocked: ['Alexandria'], time: 0, forcedNode: null } }
  assert.equal(markTime(world, 2), 2)
  assert.equal(world.campaign.tsk.map.time, 2)
  assert.equal(timePassed(world), 2)
})

test('P7 dogsOfWar JSON 往返：原语状态容器与章节状态都能存取', () => {
  const state = setup(stateFor(2), { choices: ['refuse'] })
  markTime(state, 2)
  state.investigators[0].hand.push(ALLY)
  state.investigators[0].location = 'theBourse'
  const roundTrip = clone(state)
  assert.doesNotThrow(() => validateTskState(roundTrip))
  assert.equal(tskConcealed.concealedMiniCards(roundTrip).length, 3, '隐匿迷你卡随存档往返')
  assert.equal(roundTrip.campaign.records[RECORD_KEYS.time], 2)
  assert.equal(chapterState(roundTrip).variant, 'v2')
  assert.equal(tskKeys.keyFace(roundTrip, LIGHT_OF_PHAROS.id), RAW_CODES.lightOfPharosUnstable,
    '敌人持有的密钥在动荡面')
  const brief = chapterSummary(roundTrip)
  assert.equal(brief.version, 'v2')
  assert.equal(brief.currentAct, RAW_CODES.actV2)
  assert.equal(brief.keyLoci.length, 4)
})

test('P7 dogsOfWar 章节摘要：布置与机械状态可只读投影（桌面/AI 共用）', () => {
  const state = setup(stateFor(1), { choices: ['accept'] })
  const summary = chapterSummary(state)
  assert.equal(summary.version, 'v1')
  assert.equal(summary.branch, 'knight')
  assert.equal(summary.keyLoci.length, 4)
  assert.equal(summary.knightDefeated, false)
  assert.equal(summary.beastDefeated, false)
  assert.equal(summary.currentAct, RAW_CODES.actV1)
  assert.equal(summary.currentAgenda, RAW_CODES.agendaV1)
  assert.equal(summary.clueValueOfStart, 1)
  assert.deepEqual(summary.resolutions, Object.keys(scenario.resolutions))
  assert.deepEqual(summary.entryCodes, [...chapter.behavior.implementedEncounterCodes])
  assert.equal(summary.stage, '冒险设置(版本一)')
})

test('P7 dogsOfWar 版本设置清单与传说：6 组依赖、时间阈值、三个版本标题', () => {
  assert.deepEqual([...GATHER_GROUPS], ['dogsOfWar', 'scarletSorcery', 'spatialAnomaly', 'spreadingCorruption',
    'darkCult', 'cleanupCrew'])
  assert.ok(INTRO.intro1.length > 100)
  assert.ok(INTRO.knightMeeting.part1.length > 100)
  assert.ok(INTRO.knightAlreadyRobbed.length > 100)
  assert.ok(INTRO.outcomes.v1.includes('特别小组与暗红骑士达成交易'))
  assert.ok(INTRO.outcomes.v2.includes('特别小组帮助西里特工'))
  assert.ok(INTRO.checkTime.twentyOrMore.includes('20'))
  assert.equal(locationFaceFor('v1', 'theBourse').revealedAtStart, VERSION_CODES.v1.bourseRevealed)
  assert.equal(locationFaceFor('v1', 'catacombs').revealedAtStart, VERSION_CODES.v1.catacombsRevealed)
  assert.equal(locationFaceFor('v2', 'theBourse').code, RAW_CODES.bourseCoteriePost)
  assert.equal(locationFaceFor('v3', 'catacombs').code, RAW_CODES.catacombsDenOfTheBeast)
  const state = stateFor(3)
  assert.equal(clueValueOf(state, 'theBourse'), 2 * 3)
  assert.equal(clueValueOf(state, 'windsorPalaceHotel'), 1 * 3)
})

// ---------------------------------------------------------------------------
// 7. 单卡条目
// ---------------------------------------------------------------------------
test('P7 dogsOfWar 条目：十一条专属卡逐条有可执行声明并已注册', () => {
  assert.equal(ENTRIES.length, 11)
  assert.deepEqual(ENTRIES.map(entry => entry.code).sort(), [...CHAPTER_ENTRY_CODES].sort())
  for (const entry of ENTRIES) {
    const registered = registeredEntry(entry.code)
    assert.ok(registered, `${entry.code} 未注册`)
    assert.equal(registered.implemented, true, `${entry.code} 未标 implemented`)
    assert.ok(['enemy', 'treachery', 'storyAsset'].includes(entry.scope), `${entry.code} scope 非法`)
    assert.ok(String(entry.note || '').length > 10, `${entry.code} 缺 note`)
  }
  const byCode = Object.fromEntries(ENTRIES.map(entry => [entry.code, entry]))
  assert.equal(byCode['09653a'].assetRule.keyLocus.face, 'defensiveBarrier')
  assert.equal(byCode['09653a'].assetRule.keyLocus.action.damage, 2)
  assert.equal(byCode['09653b'].assetRule.keyLocus.face, 'lastBastion')
  assert.equal(byCode['09653b'].assetRule.keyLocus.defeatedRemovedFromGame, true)
  assert.equal(byCode['09654a'].enemyRule.shiftsKeysOnFailedTestAtLocation, true)
  assert.equal(byCode['09654b'].assetRule.resourceShuttle.max, 3)
  assert.equal(byCode['09655a'].enemyRule.cannotBeDefeatedHealsAndFlees, true)
  assert.equal(byCode['09655b'].enemyRule.shiftsKeysOnFailedTestAtLocation, true)
  assert.equal(byCode['09656'].enemyRule.locusSiteStatModifier.fight, 2)
  assert.equal(byCode['09657'].enemyRule.blocksOtherAttacksWhileReady, true)
  assert.equal(typeof byCode['09658'].encounterResolve, 'function')
  assert.equal(byCode['09659a'].assetRule.keyShift.face, 'stable')
  assert.equal(typeof byCode['09659a'].assetRule.keyShift.resolve, 'function')
  assert.equal(byCode['09659b'].assetRule.keyShift.face, 'unstable')
  assert.equal(typeof byCode['09659b'].assetRule.keyShift.resolve, 'function')
  for (const code of ['09653a', '09653b', '09654a', '09654b', '09655a', '09657', '09658', '09659a', '09659b']) {
    assert.ok(byCode[code].note.includes('approximation'), `${code} note 必须写明 approximation`)
  }
  assert.ok(chapter.scenarioApproximations.length >= 8)
  assert.ok(chapter.scenarioGaps.length >= 2)
  assert.equal(chapter.behavior.scenarioApproximations, chapter.scenarioApproximations)
  assert.equal(KEY_LOCUS_DATA['09653a'].healthPerInvestigator, true)
  assert.equal(KEY_LOCUS_DATA['09653b'].health, 6)
  assert.equal(SET_ASIDE_CODES.includes(RAW_CODES.lightOfPharosStable), true)
})
