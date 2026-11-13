// 如履薄冰（onThinIce · 09609 · 安克雷奇）章节测试（P7）。
//
// 三层证据：
//   1. 章节装配 —— manifest（9 地点 / 4 幕 / 3 密谋 / 5 结局 / 区域守恒 / 展示连线 ⊆ 规则连接）、正文可读、
//      四档混乱标记表；
//   2. 章节机械 —— 布置（城市 + 三张背面朝上的荒地 + 放一边）、符号连接与揭示、荒野追踪（山间溪流开启界外荒地）、
//      虚空奇美拉四类分裂形态（隐匿 4 / 揭露诱饵生成对应形态 / 其它形态在场时禁止揭露）、
//      空洞化与回收（手牌/牌库顶/支援 + 安克雷奇抽回 + 密谋 3 抹除）、遭遇卡行为、巡逻与猎手、
//      玄丧之镜变换、时间与结局记录、JSON 往返（真实 tsk 原语容器校验）；
//   3. 单卡条目 —— 十二条专属条目逐条具备可执行声明（enemyRule / assetRule / keyRule / encounterResolve）。
import test from 'node:test'
import assert from 'node:assert/strict'
import { registerCardAbilities, registeredEntry } from '../src/engine/ability.js'
import { syncDynamicLocationSymbols } from '../src/engine/location-symbols.js'
import { validateTskState } from '../src/engine/tsk-primitives.js'
import * as tskHollow from '../src/engine/tsk-hollow.js'
import * as tskKeys from '../src/engine/tsk-scarlet-keys.js'
import * as tskConcealed from '../src/engine/tsk-concealed.js'
import * as tskPatrol from '../src/engine/tsk-coterie.js'
import * as tskMap from '../src/engine/tsk-map.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import * as chapter from '../content/campaigns/theScarletKeys/scenarios/onThinIce/index.js'
import {
  CHAPTER_ENTRY_CODES, ENCOUNTER_DECK, GATHER_GROUPS, LOCATIONS, OUTER_WILDERNESS_LOCATION_IDS, OUTSIDERS_LAIR,
  RAW_CODES, RECORD_KEYS, SABLE_GLASS_KEY, SET_ASIDE_CODES, SETUP_GROUPS, START_LOCATION, WILDERNESS_LOCATION_IDS,
  clueValueOf, scenario,
} from '../content/campaigns/theScarletKeys/scenarios/onThinIce/definition.js'
import {
  behavior, chapterState, chapterSummary, concealedAmountOf, concealedSpots, eraseHighestHollows, evenPlacements,
  exposeAt, exposeBlockedReason, hollowAllyOrItemPerInvestigator, hollowCountOf, hollowFromDeckTop, hollowFromHand,
  markTime, openOuterWilderness, recallHollow, relocateToNearestWilderness, resolveKeyShift, resolveRawDeal,
  resolveTrueFormConcealed, restoreProgress, snapshotProgress, wildernessStepToward,
} from '../content/campaigns/theScarletKeys/scenarios/onThinIce/behavior.js'
import {
  ON_THIN_ICE_TOKEN_MEANINGS, hazardTreacheriesInPlay, onThinIceAfterTest, onThinIceChaosToken,
  voidChimeraAtLocation,
} from '../content/campaigns/theScarletKeys/scenarios/onThinIce/chaos.js'

// ---------------------------------------------------------------------------
// 条目注册（真实注册期校验：未知字段/未知 kind/未知窗口都会在这里失败）
// ---------------------------------------------------------------------------
const ENTRIES = []
for (const code of CHAPTER_ENTRY_CODES) {
  const module = await import(`../src/cards/encounter-entries/theScarletKeys/onThinIce/${code}.js`)
  ENTRIES.push(module.default)
}
for (const entry of ENTRIES) if (!registeredEntry(entry.code)) registerCardAbilities(entry)

const clone = value => JSON.parse(JSON.stringify(value))
const NOOP = () => {}
const costOf = code => Number(ALL_CARDS[code]?.cost) || 0

// 测试用真实卡号：01018 Beat Cop（[[盟友]]、生命 2、费用 4）、01020 Machete（[[道具]]、无生命值、费用 3）、
// 01021 Guard Dog（[[盟友]]、生命 3、费用 3）、01025 Vicious Blow（技能卡、无费用）、10003 Hasty Repairs（弱点）。
const ALLY = '01018'
const ITEM = '01020'
const ALLY2 = '01021'
const SKILL = '01025'
const WEAKNESS = '10003'

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
      damage: 0, horror: 0, clues: 0, resources: 5, hand: [], assets: [], threat: [], engaged: [],
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
    spawns: [], attacks: [], immediateActions: [],
  }
}

function placeLocation(state, id) {
  const existing = state.locations.find(location => location.id === id)
  if (existing) return existing
  const definition = state.scenario.locations[id]
  if (!definition) return null
  const variant = state.locationVariants?.[id] || null
  const instance = { ...clone(definition), ...(variant ? clone(variant) : {}), id }
  instance.connections = [...(definition.connections || [])]
  instance.symbolLinks = []
  const revealed = state.investigators.some(inv => inv.location === id)
  instance.revealed = revealed
  instance.maxClues = clueValueOf(state, id)
  instance.clues = revealed ? instance.maxClues : 0
  state.locations.push(instance)
  syncDynamicLocationSymbols(state)
  return instance
}

function revealLocationStub(state, id, api) {
  const location = state.locations.find(item => item.id === id)
  if (!location || location.revealed) return location
  location.revealed = true
  if (location.unrevealedActualName) {
    location.name = location.unrevealedActualName
    delete location.unrevealedActualName
  }
  if (location.unrevealedActualNameEn) {
    location.nameEn = location.unrevealedActualNameEn
    delete location.unrevealedActualNameEn
  }
  delete location.hiddenIdentity
  location.clues = Math.max(0, Number(location.maxClues) || 0)
  syncDynamicLocationSymbols(state)
  behavior.locationRevealed(state, location, api, state.investigators[0]?.seat ?? null)
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
    cardName: code => code,
    decideSeat: () => 0,
    test: (seat, skill, difficulty, resolve = null, skillBonus = 0, source = null) => {
      state.testCalls.push({ seat, skill, difficulty, skillBonus, source })
      const result = state.testResults.length
        ? state.testResults.shift()
        : { success: true, value: difficulty + 1, difficulty, failedBy: 0, drawn: [] }
      if (typeof resolve === 'function') resolve(result)
      return result
    },
    place: id => placeLocation(state, id),
    reveal: id => revealLocationStub(state, id, api),
    spawn: (code, locationId, options = {}) => {
      const enemy = {
        id: `enemy-${state.enemies.length + 1}`, code, originalCode: code, name: code,
        location: locationId, engagedSeat: null, exhausted: Boolean(options.exhausted),
        defeated: false, damageTaken: 0, health: 3, traits: ['Monster', 'Outsider', 'Elite'],
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
    moveEnemy: (enemy, destination) => {
      const from = enemy.location
      enemy.location = destination
      behavior.enemyMoved?.(state, enemy, from, api)
      return true
    },
    moveInvestigator: (seat, destination) => { state.investigators[seat].location = destination },
    beginImmediateAction: seat => { state.immediateActions.push(seat); return true },
    putInHand: (seat, code) => { state.investigators[seat].hand.push(code); return code },
    putOnDeckBottom: (seat, code) => { state.investigators[seat].deck.unshift(code); return code },
    takeDeckCard: (seat, code) => {
      const inv = state.investigators[seat]
      const index = inv.deck.lastIndexOf(code)
      if (index < 0) return null
      return inv.deck.splice(index, 1)[0]
    },
    removeAsset: (seat, assetId) => {
      const inv = state.investigators[seat]
      const asset = inv.assets.find(item => item.id === assetId)
      inv.assets = inv.assets.filter(item => item.id !== assetId)
      return asset?.code || null
    },
    gainResources: (seat, amount) => { state.investigators[seat].resources += amount },
    harm: (seat, amount = {}) => {
      const inv = state.investigators[seat]
      inv.damage += amount.damage || 0
      inv.horror += amount.horror || 0
    },
    damage: (seat, amount) => { state.investigators[seat].damage += amount },
    directDamage: (seat, amount) => { state.investigators[seat].damage += amount },
    damageAsset: (seat, assetId, amount) => {
      const asset = state.investigators[seat].assets.find(item => item.id === assetId)
      if (asset) asset.damage = (Number(asset.damage) || 0) + amount
    },
    healEnemy: (enemy, amount) => {
      enemy.damageTaken = Math.max(0, (Number(enemy.damageTaken) || 0) - amount)
    },
    damageEnemy: (enemyId, amount) => {
      const enemy = state.enemies.find(item => item.id === enemyId)
      if (enemy) enemy.damageTaken = (Number(enemy.damageTaken) || 0) + amount
    },
    loseActions: (seat, amount) => { state.investigators[seat].actionsLeft -= amount },
    discardOneFromHand: seat => {
      const inv = state.investigators[seat]
      const code = inv.hand.shift()
      if (code) inv.discard.push(code)
      return code || null
    },
    drawCards: (seat, amount) => {
      const inv = state.investigators[seat]
      for (let index = 0; index < amount; index += 1) {
        const code = inv.deck.pop()
        if (code) inv.hand.push(code)
      }
    },
    addDoom: amount => { state.doom = (Number(state.doom) || 0) + amount },
    advanceAct: () => { state.advanced += 1; state.actIndex += 1 },
    advanceAgenda: () => { state.agendaAdvanced += 1; state.agendaIndex += 1 },
    finish: key => state.finished.push(key),
    putNextToAgenda: code => {
      const card = { id: `aside-${state.agendaAside.length + 1}`, code, originalCode: code }
      state.agendaAside.push(card)
      return card
    },
    agendaAsideCards: () => state.agendaAside.map(card => card.originalCode || card.code),
    discardAgendaAside: id => {
      const card = state.agendaAside.find(item => item.id === id)
      if (!card) return null
      state.agendaAside = state.agendaAside.filter(item => item !== card)
      return card.originalCode || card.code
    },
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
    locationDistance: (from, targets) => {
      const queue = [[from, 0]]
      const seen = new Set([from])
      while (queue.length) {
        const [id, steps] = queue.shift()
        if (targets.includes(id)) return steps
        for (const next of state.locations.find(item => item.id === id)?.connections || []) {
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
          heldBy: bearer => tskKeys.keysHeldBy(state, bearer),
        },
        hollow: {
          cards: () => tskHollow.hollowCards(state),
          hollow: spec => tskHollow.hollowCard(state, spec),
          count: options => tskHollow.hollowCount(state, options),
          isHollowed: code => tskHollow.isHollowed(state, code),
          recall: (code, options) => tskHollow.recallHollow(state, code, options),
          erase: codes => tskHollow.eraseFromExistence(state, codes),
          erased: () => tskHollow.erasedFromExistence(state),
          invalidCards: () => tskHollow.invalidCampaignCards(state),
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
        map: {
          time: () => tskMap.mapTime(state),
          state: () => tskMap.worldMapState(state),
        },
      },
    },
    ...overrides,
  }
  return api
}

const setup = (state, overrides = {}) => {
  state.api = apiFor(state, overrides)
  behavior.setupLocations(state, [], { info: NOOP, api: state.api })
  return state
}

const locationOf = (state, id) => state.locations.find(location => location.id === id)
const miniCards = state => tskConcealed.concealedMiniCards(state)

// ---------------------------------------------------------------------------
// 1. 装配 / 正文 / 混乱标记表
// ---------------------------------------------------------------------------
test('P7 onThinIce 清单：playable、9 地点 / 四幕三密谋 / 五结局 / 正文可读', () => {
  const manifest = chapter.manifest
  assert.equal(manifest.id, 'onThinIce')
  assert.equal(manifest.campaignId, 'theScarletKeys')
  assert.equal(manifest.status, 'playable')
  assert.equal(manifest.referenceCode, '09609')
  assert.equal(manifest.locations.length, 9)
  assert.equal(manifest.startLocationId, 'anchorage')
  assert.deepEqual(manifest.acts.map(act => act.id), ['act1', 'act2', 'act3', 'act4'])
  assert.deepEqual(manifest.agendas.map(agenda => agenda.id), ['agenda1', 'agenda2', 'agenda3'])
  assert.deepEqual(manifest.resolutionIds,
    ['noResolution', 'resolution1', 'resolution2', 'resolution3', 'resolution4'])
  assert.deepEqual(manifest.requiredPackIds, ['core', 'tskCampaign'])
  // 遭遇组：manifest 声明的是本战役 26 组里的依赖（7 个共享组 + setup 专用的 globetrotting/redCoterie）；
  // 核心复用组 chillingCold 由所需卡包 core 提供，不进 requiredEncounterGroupIds（schema 只收本战役组）。
  const expectedGroups = [...GATHER_GROUPS.filter(group => group !== 'chillingCold'), ...SETUP_GROUPS].sort()
  assert.deepEqual([...manifest.requiredEncounterGroupIds].sort(), expectedGroups)
  assert.ok(manifest.requiredEncounterGroupIds.includes('onThinIce'))
  assert.deepEqual(manifest.requiredMechanicIds,
    ['tskConcealed', 'tskScarletKeys', 'tskHollow', 'tskPatrol', 'tskMap'])
  // 遭遇牌库 = 专属组 + 七个共享组按印刷份数展开（P0 修复：旧实现只有专属组 8 张）。
  const deck = Object.fromEntries(manifest.zones.encounterDeck.map(entry => [entry.cardCode, entry.count]))
  assert.deepEqual(deck, Object.fromEntries(ENCOUNTER_DECK
    .reduce((counts, code) => {
      counts.set(code, (counts.get(code) || 0) + 1)
      return counts
    }, new Map())))
  assert.ok(Object.keys(deck).length > 10, '共享组遭遇牌没有并入牌库')
  // 放一边：索恩两面 + 五张虚空奇美拉 + 玄丧之镜 + 三张界外荒地。
  const aside = manifest.zones.setAside.map(entry => entry.cardCode).sort()
  assert.deepEqual(aside, ['09622', '09623', '09624', '09625a', '09625b', '09626', '09627', '09628', '09629',
    '09630', '09634a'])
  assert.deepEqual(manifest.zones.inPlay.map(entry => entry.cardCode).sort(),
    ['09617', '09618', '09619', '09620', '09621'])
  // 展示连线不得创建规则连接：每条 edge 都在 manifest 的 connections 里。
  const connections = new Set(manifest.locations.flatMap(location =>
    location.connections.map(to => `${location.id}>${to}`)))
  for (const edge of manifest.layout.edges) {
    assert.ok(connections.has(`${edge.from}>${edge.to}`), `展示连线 ${edge.from}->${edge.to} 缺少规则连接`)
  }
  // 正文：开场标题、完整设置、特别规则、五个结局。
  assert.ok(chapter.scenario.introTitle.length >= 4)
  assert.ok(chapter.scenario.intro.length > 400)
  assert.ok(chapter.scenario.setup.length > 200)
  for (const keyword of ['荒野', '隐匿', '空洞', '玄丧之镜', '混乱标记', '时间']) {
    assert.ok(chapter.scenario.specialRules.includes(keyword), `特别规则缺少 ${keyword}`)
  }
  for (const [key, text] of Object.entries(scenario.resolutions)) {
    assert.ok(String(text).length > 100, `${key} 正文缺失`)
  }
})

test('P7 onThinIce 混乱标记表：四档共用两套，X 与 tablet 的取值随状态变化', () => {
  assert.equal(ON_THIN_ICE_TOKEN_MEANINGS.easy, ON_THIN_ICE_TOKEN_MEANINGS.standard)
  assert.equal(ON_THIN_ICE_TOKEN_MEANINGS.hard, ON_THIN_ICE_TOKEN_MEANINGS.expert)
  assert.equal(ON_THIN_ICE_TOKEN_MEANINGS.standard.cultist.delta, -4)
  assert.equal(ON_THIN_ICE_TOKEN_MEANINGS.hard.cultist.delta, -5)
  const state = setup(stateFor(1))
  const inv = state.investigators[0]
  // [skull]：简单/普通 = -(场上[[危险]]诡计数量)；困难/专家再 -1。
  assert.deepEqual(onThinIceChaosToken(state, inv, 'skull'), { delta: 0 })
  state.agendaAside.push({ id: 'ice-1', code: RAW_CODES.crackingIce, originalCode: RAW_CODES.crackingIce })
  state.agendaAside.push({ id: 'ice-2', code: RAW_CODES.crackingIce, originalCode: RAW_CODES.crackingIce })
  assert.equal(hazardTreacheriesInPlay(state).length, 2)
  assert.deepEqual(onThinIceChaosToken(state, inv, 'skull'), { delta: -2 })
  state.difficulty = 'hard'
  assert.deepEqual(onThinIceChaosToken(state, inv, 'skull'), { delta: -3 })
  // [tablet]：简单/普通 -2（奇美拉在场 -5）；困难/专家 -3 且奇美拉在场改为自动失败。
  state.difficulty = 'standard'
  assert.deepEqual(onThinIceChaosToken(state, inv, 'tablet'), { delta: -2 })
  state.enemies.push({ id: 'chimera', code: RAW_CODES.voidChimeraFellbeak,
    originalCode: RAW_CODES.voidChimeraFellbeak, location: START_LOCATION, defeated: false })
  assert.equal(voidChimeraAtLocation(state, inv), true)
  assert.deepEqual(onThinIceChaosToken(state, inv, 'tablet'), { delta: -5 })
  state.difficulty = 'expert'
  assert.deepEqual(onThinIceChaosToken(state, inv, 'tablet'), { delta: -3, autoFail: true })
})

test('P7 onThinIce 混乱标记后果：简单/普通只失败后空洞，困难/专家一律空洞', () => {
  const state = setup(stateFor(1))
  const inv = state.investigators[0]
  const fail = { success: false, drawn: ['cultist', 'elderthing'], cancelledTokens: [] }
  assert.deepEqual(onThinIceAfterTest(state, inv, fail), ['hollowFromHand', 'hollowFromDeckTop'])
  assert.deepEqual(onThinIceAfterTest(state, inv, { ...fail, success: true }), [])
  state.difficulty = 'hard'
  assert.deepEqual(onThinIceAfterTest(state, inv, { ...fail, success: true }),
    ['hollowFromHand', 'hollowFromDeckTop'])
  assert.deepEqual(onThinIceAfterTest(state, inv, { success: false, drawn: ['cultist'],
    cancelledTokens: ['cultist'] }), [])
})

// ---------------------------------------------------------------------------
// 2. 布置与地点连接
// ---------------------------------------------------------------------------
test('P7 onThinIce 布置：城市入场、三张荒地背面朝上、放一边与时间毁灭', () => {
  const state = stateFor(2)
  state.campaign.records[RECORD_KEYS.time] = 12
  setup(state)
  const ids = state.locations.map(location => location.id)
  assert.deepEqual(ids.sort(), ['anchorage', 'fairbanks', 'frozenLake', 'isolatedRoad', 'mountainStream'])
  assert.equal(locationOf(state, 'anchorage').revealed, true, '起点所在地点已揭示')
  assert.equal(locationOf(state, 'fairbanks').revealed, true, '费尔班克斯是单面城市地点')
  for (const id of WILDERNESS_LOCATION_IDS) {
    const location = locationOf(state, id)
    assert.equal(location.revealed, false, `${id} 背面朝上`)
    assert.equal(location.name, '阿拉斯加荒地', '未揭示面显示背面白身')
    assert.equal(location.unrevealedActualName, LOCATIONS[id].name)
    assert.equal(location.clues, 0)
  }
  assert.deepEqual([...chapterState(state).wildernessOrder].sort(), [...WILDERNESS_LOCATION_IDS].sort())
  const aside = new Set(state.scenarioZones.setAside)
  for (const code of SET_ASIDE_CODES) assert.ok(aside.has(code), `${code} 应在放一边`)
  for (const id of OUTER_WILDERNESS_LOCATION_IDS) assert.ok(aside.has(LOCATIONS[id].originalCode))
  // time 12 → 每 5 点给密谋 1 放 1 个毁灭 = 2。
  assert.equal(state.doom, 2)
  // 玄丧之镜登记进战役密钥容器（稳定面）。
  assert.equal(tskKeys.scarletKey(state, SABLE_GLASS_KEY.id).stable, true)
  assert.equal(tskKeys.keyFace(state, SABLE_GLASS_KEY.id), SABLE_GLASS_KEY.stableFace)
})

test('P7 onThinIce 地点连接：印刷符号自动连线，揭示后换成正面符号', () => {
  const state = setup(stateFor(2))
  const fairbanks = locationOf(state, 'fairbanks')
  for (const id of WILDERNESS_LOCATION_IDS) {
    assert.ok(fairbanks.connections.includes(id), `费尔班克斯连接 ${id}`)
  }
  // 未揭示时三张荒地背面都是 Triangle：只连费尔班克斯（山间溪流的正面骨架另有界外荒地，
  // 那些卡此时不在场，连接里保留声明不影响可达性）。
  for (const id of ['frozenLake', 'isolatedRoad']) {
    assert.deepEqual(locationOf(state, id).connections, ['fairbanks'])
  }
  for (const id of OUTER_WILDERNESS_LOCATION_IDS) {
    assert.equal(locationOf(state, id), undefined, `${id} 此时不在场`)
    assert.ok(LOCATIONS.mountainStream.connections.includes(id), '山间溪流的印刷连接声明含界外荒地')
  }
  assert.deepEqual(locationOf(state, 'mountainStream').connections.filter(id => id === 'fairbanks'), ['fairbanks'])
  assert.ok(locationOf(state, 'anchorage').connections.includes('fairbanks'))
  // 揭示山间溪流：正面符号（Square）生效，名称换回正面名。
  const api = apiFor(state)
  revealLocationStub(state, 'mountainStream', api)
  const stream = locationOf(state, 'mountainStream')
  assert.equal(stream.revealed, true)
  assert.equal(stream.name, '山间溪流')
  assert.ok(stream.connections.includes('fairbanks'), '揭示后仍连费尔班克斯')
  // 山间溪流最后一个线索 → 三张界外荒地入场并与它相邻。
  stream.clues = 0
  behavior.cluesRemoved(state, stream, 1, api)
  assert.deepEqual(OUTER_WILDERNESS_LOCATION_IDS.filter(id => locationOf(state, id)).sort(),
    [...OUTER_WILDERNESS_LOCATION_IDS].sort())
  for (const id of OUTER_WILDERNESS_LOCATION_IDS) {
    assert.ok(locationOf(state, id).connections.includes('mountainStream'), `${id} 与山间溪流相邻`)
    assert.equal(locationOf(state, id).revealed, false, `${id} 背面朝上入场`)
    assert.ok(stream.connections.includes(id))
  }
  const count = state.locations.length
  behavior.cluesRemoved(state, stream, 1, api)
  assert.equal(state.locations.length, count, '界外荒地只入场一次')
})

test('P7 onThinIce 荒野追踪：进入山间溪流与揭示猎人小屋都要检定', () => {
  const state = setup(stateFor(1))
  const api = apiFor(state)
  const inv = state.investigators[0]
  inv.location = 'mountainStream'
  behavior.locationEntered(state, inv, locationOf(state, 'mountainStream'), api)
  assert.equal(state.testCalls.length, 1)
  assert.equal(state.testCalls[0].skill, 'intellect', '默认选择列表第一项：智力')
  assert.equal(state.testCalls[0].difficulty, 1)
  state.testResults.push({ success: false, value: 0, difficulty: 1, failedBy: 1, drawn: [] })
  behavior.locationEntered(state, inv, locationOf(state, 'mountainStream'), api)
  assert.equal(inv.damage, 1, '山间溪流失败受 1 点伤害')
  // 猎人小屋揭示：意志或智力(3)。
  openOuterWilderness(state, api)
  state.choices.push('intellect')
  state.testResults.push({ success: false, value: 1, difficulty: 3, failedBy: 2, drawn: [] })
  revealLocationStub(state, 'huntersLodge', api)
  const lodgeCall = state.testCalls.at(-1)
  assert.equal(lodgeCall.skill, 'intellect')
  assert.equal(lodgeCall.difficulty, 3)
  assert.equal(inv.damage, 2, '猎人小屋说服失败再受 1 点伤害')
})

test('P7 onThinIce 饥饿的灰熊：生成到最近的荒地、移动跳过非荒地', () => {
  const state = setup(stateFor(2))
  const api = apiFor(state)
  const grizzly = {
    id: 'grizzly', code: RAW_CODES.ravenousGrizzly, originalCode: RAW_CODES.ravenousGrizzly,
    name: '饥饿的灰熊', location: 'fairbanks', engagedSeat: null, exhausted: false, traits: ['Creature'],
  }
  state.enemies.push(grizzly)
  const nearest = relocateToNearestWilderness(state, grizzly, api)
  assert.ok(WILDERNESS_LOCATION_IDS.includes(nearest), '生成到最近的荒地')
  assert.equal(grizzly.location, nearest)
  openOuterWilderness(state, api)
  assert.equal(wildernessStepToward(state, 'mountainStream', 'fairbanks'), 'fairbanks',
    '荒地到城市的下一步就是城市本身')
  assert.equal(wildernessStepToward(state, 'mountainStream', 'isolatedRoad'), null,
    '三张荒地彼此不直接相连时没有荒地内路径')
  const walker = { ...grizzly, id: 'grizzly-2', location: 'mountainStream' }
  state.enemies.push(walker)
  assert.equal(behavior.hunterMove(state, walker, api), false, '没有别处的调查员时不动')
  state.investigators[0].location = 'fairbanks'
  state.investigators[1].location = 'anchorage'
  assert.equal(behavior.hunterMove(state, walker, api), true)
  assert.equal(walker.location, 'fairbanks', '跳过非荒地：直接走到目标荒地相邻的城市')
})

// ---------------------------------------------------------------------------
// 3. 虚空奇美拉：隐匿 4 / 分裂形态 / 揭露限制
// ---------------------------------------------------------------------------
test('P7 onThinIce 虚空奇美拉：隐匿 4 = 真身 + 四张具名诱饵，平均分到荒地', () => {
  const state = setup(stateFor(2))
  assert.equal(concealedAmountOf(RAW_CODES.voidChimeraTrueForm), 4)
  assert.equal(concealedAmountOf(RAW_CODES.voidChimeraFellbeak), 0)
  assert.deepEqual(concealedSpots(state).sort(), [...WILDERNESS_LOCATION_IDS].sort())
  const created = resolveTrueFormConcealed(state)
  assert.equal(created.length, 5, '1 真身 + 4 诱饵')
  const kinds = created.map(card => card.kind)
  assert.ok(kinds.includes('VoidChimeraTrueForm'))
  for (const decoy of ['DecoyVoidChimeraFellbeak', 'DecoyVoidChimeraEarsplitter',
    'DecoyVoidChimeraGorefeaster', 'DecoyVoidChimeraFellhound']) {
    assert.ok(kinds.includes(decoy), `缺具名诱饵 ${decoy}`)
  }
  const byLocation = new Map()
  for (const card of miniCards(state)) byLocation.set(card.locationId, (byLocation.get(card.locationId) || 0) + 1)
  assert.equal(byLocation.size, 3)
  assert.deepEqual([...byLocation.values()].sort(), [1, 2, 2])
  for (const id of byLocation.keys()) assert.ok(WILDERNESS_LOCATION_IDS.includes(id))
  // 平均分配的纯函数：4 张卡 3 个地点 → 2/1/1。
  const cards = [{ kind: 'a' }, { kind: 'b' }, { kind: 'c' }, { kind: 'd' }]
  assert.deepEqual(evenPlacements(cards, ['x', 'y', 'z']).map(entry => entry.count), [2, 1, 1])
})

test('P7 onThinIce 虚空奇美拉：揭露诱饵生成对应分裂形态，真身揭露记录位置', () => {
  const state = setup(stateFor(1))
  const api = apiFor(state)
  const inv = state.investigators[0]
  resolveTrueFormConcealed(state)
  const decoy = miniCards(state).find(card => card.kind === 'DecoyVoidChimeraGorefeaster')
  inv.location = decoy.locationId
  const exposed = exposeAt(state, inv, decoy.id, api)
  assert.equal(exposed.decoy, true)
  assert.equal(exposed.enemyCode, RAW_CODES.voidChimeraGorefeaster)
  assert.equal(exposed.locationId, decoy.locationId)
  assert.equal(state.enemies.filter(enemy => enemy.code === RAW_CODES.voidChimeraGorefeaster).length, 1)
  assert.equal(miniCards(state).length, 4, '诱饵翻面移除')
  assert.ok(exposeBlockedReason(state)?.includes('其他形态'), '其它形态在场 → 不能揭露')
  const truth = miniCards(state).find(card => card.kind === 'VoidChimeraTrueForm')
  assert.equal(exposeAt(state, inv, truth.id, api), null)
  state.enemies = state.enemies.filter(enemy => enemy.code !== RAW_CODES.voidChimeraGorefeaster)
  assert.equal(exposeBlockedReason(state), null)
  inv.location = truth.locationId
  const revealed = exposeAt(state, inv, truth.id, api)
  assert.equal(revealed.kind, 'VoidChimeraTrueForm')
  assert.equal(chapterState(state).exposedLocation, truth.locationId)
  assert.equal(state.enemies.filter(enemy => enemy.code === RAW_CODES.voidChimeraTrueForm).length, 1)
})

// ---------------------------------------------------------------------------
// 4. 幕 / 密谋推进
// ---------------------------------------------------------------------------
test('P7 onThinIce 幕 1 幕后交易：合作 → 记录 + 换标记 + 索恩支援面 + 钥匙', () => {
  const state = setup(stateFor(2))
  state.choices.push('deal')
  const api = apiFor(state)
  assert.equal(resolveRawDeal(state, api), 'deal')
  assert.equal(state.campaign.records[RECORD_KEYS.dealWithThorne], true)
  assert.equal(state.chaosBag.filter(token => token === 'tablet').length, 2, '移除 elderthing 加入 tablet（原本 1 个）')
  assert.equal(state.chaosBag.filter(token => token === 'elderthing').length, 0)
  assert.ok(state.investigators[0].assets.some(asset => asset.code === RAW_CODES.thorneAsset))
  assert.equal(chapterState(state).thorneVersion, 'asset')
  assert.equal(tskKeys.scarletKey(state, SABLE_GLASS_KEY.id).bearer.type, 'investigator')
  assert.equal(state.removedFromGame.includes('09716a'), true, '深红密谋移出游戏')
  // 幂等：同一幕背面只结算一次。
  state.choices.push('refuse')
  assert.equal(resolveRawDeal(state, api), 'deal')
})

test('P7 onThinIce 幕 1 幕后交易：拒绝 → 索恩敌人带钥匙在山间溪流生成', () => {
  const state = setup(stateFor(1))
  state.choices.push('refuse')
  const api = apiFor(state)
  assert.equal(resolveRawDeal(state, api), 'refuse')
  assert.equal(state.campaign.records[RECORD_KEYS.dealWithThorne], undefined)
  const thorne = state.enemies.find(enemy => enemy.code === RAW_CODES.thorneEnemy)
  assert.ok(thorne, '索恩（敌人）生成')
  assert.equal(thorne.location, 'mountainStream')
  assert.equal(tskKeys.scarletKey(state, SABLE_GLASS_KEY.id).bearer.type, 'investigator',
    '拒绝合作时钥匙由领队控制')
  assert.equal(chapterState(state).thorneVersion, 'enemy')
})

test('P7 onThinIce 幕 2/3/4 背面：引出奇美拉 → 巢穴 → 绝杀一击分流', () => {
  const state = setup(stateFor(2))
  const api = apiFor(state)
  behavior.actReveal(state, { originalCode: RAW_CODES.act2, code: RAW_CODES.act2 }, api)
  assert.equal(miniCards(state).length, 5)
  chapterState(state).exposedLocation = 'mountainStream'
  const trueForm = { id: 'true-form', code: RAW_CODES.voidChimeraTrueForm,
    originalCode: RAW_CODES.voidChimeraTrueForm, location: 'mountainStream', defeated: false }
  state.enemies.push(trueForm)
  state.investigators.forEach(inv => { inv.location = 'mountainStream' })
  behavior.actReveal(state, { originalCode: RAW_CODES.act3, code: RAW_CODES.act3 }, api)
  assert.ok(locationOf(state, OUTSIDERS_LAIR), '域外来客之巢入场')
  assert.ok(locationOf(state, 'mountainStream').connections.includes(OUTSIDERS_LAIR), '揭露地点单向连巢穴')
  assert.equal(trueForm.location, OUTSIDERS_LAIR)
  assert.ok(state.investigators.every(inv => inv.location === OUTSIDERS_LAIR))
  behavior.actReveal(state, { originalCode: RAW_CODES.act4, code: RAW_CODES.act4 }, api)
  assert.deepEqual(state.finished, ['resolution3'], '索恩不在场 → 结局 3')
  // 剧情支援在场 → 结局 1。
  const second = setup(stateFor(1))
  const api2 = apiFor(second)
  second.investigators[0].assets.push({ id: 'thorne', code: RAW_CODES.thorneAsset,
    originalCode: RAW_CODES.thorneAsset, exhausted: false })
  behavior.actReveal(second, { originalCode: RAW_CODES.act4, code: RAW_CODES.act4 }, api2)
  assert.deepEqual(second.finished, ['resolution1'])
  // 敌人版本在场 → 结局 2。
  const third = setup(stateFor(1))
  const api3 = apiFor(third)
  third.enemies.push({ id: 'thorne-enemy', code: RAW_CODES.thorneEnemy,
    originalCode: RAW_CODES.thorneEnemy, location: 'mountainStream', defeated: false })
  behavior.actReveal(third, { originalCode: RAW_CODES.act4, code: RAW_CODES.act4 }, api3)
  assert.deepEqual(third.finished, ['resolution2'])
})

test('P7 onThinIce 幕目标：真实形态揭露/被击败推进幕 3/幕 4，幕 2 轮末可推进', () => {
  const state = setup(stateFor(1))
  const api = apiFor(state)
  state.actIndex = 2
  assert.equal(behavior.checkObjectives(state, api), false, '还没揭露')
  chapterState(state).exposedLocation = 'mountainStream'
  assert.equal(behavior.checkObjectives(state, api), true)
  assert.equal(state.advanced, 1)
  state.actIndex = 3
  assert.equal(behavior.checkObjectives(state, api), false)
  chapterState(state).trueFormDefeated = true
  assert.equal(behavior.checkObjectives(state, api), true)
  // 幕 2 轮末：只有选「推进」才推进，同一轮只问一次。
  const round = setup(stateFor(1))
  const roundApi = apiFor(round)
  round.actIndex = 1
  round.choices.push('wait')
  behavior.roundEnded(round, roundApi)
  assert.equal(round.advanced, 0)
  round.round = 2
  round.choices.push('advance')
  behavior.roundEnded(round, roundApi)
  assert.equal(round.advanced, 1)
})

test('P7 onThinIce 密谋 1/2 背面：每位调查员把一个盟友/道具放在一边作为空洞', () => {
  const state = setup(stateFor(2))
  const api = apiFor(state)
  state.investigators[0].assets.push({ id: 'ally-1', code: ALLY, originalCode: ALLY,
    traits: ['Ally'], health: 2, exhausted: false })
  state.investigators[1].hand.push(ITEM)
  state.choices.push('asset:ally-1', `hand:${ITEM}`)
  const hollowed = hollowAllyOrItemPerInvestigator(state, api)
  assert.equal(hollowed.length, 2)
  assert.equal(state.investigators[0].assets.length, 0, '在场支援离场')
  assert.equal(state.investigators[1].hand.length, 0, '手牌离场')
  assert.deepEqual(tskHollow.hollowCards(state).map(card => card.code).sort(), [ALLY, ITEM].sort())
  assert.equal(hollowCountOf(state, 0), 1, '个人口径只算自己（含 team）')
  assert.equal(hollowCountOf(state), 2)
  // 密谋 3 背面：放逐经验值费用最高的空洞。
  const result = eraseHighestHollows(state, api)
  assert.equal(result.codes.length, 2, '每个座位各放逐一张')
  assert.ok(tskHollow.erasedFromExistence(state).length >= 1)
  assert.equal(tskHollow.hollowCards(state).length, 0, '被抹除的卡离开空洞区')
})

// ---------------------------------------------------------------------------
// 5. 空洞化与回收
// ---------------------------------------------------------------------------
test('P7 onThinIce 空洞化：手牌 / 牌库顶 / 支援三条路径与索恩反应', () => {
  const state = setup(stateFor(1))
  const api = apiFor(state)
  const inv = state.investigators[0]
  inv.hand.push(ALLY, ITEM)
  inv.deck.push(ALLY2, SKILL)
  const fromHand = hollowFromHand(state, 0, api, { code: ITEM })
  assert.deepEqual({ code: fromHand.code, scope: fromHand.scope }, { code: ITEM, scope: 'investigator' })
  assert.equal(inv.hand.includes(ITEM), false)
  const fromDeck = hollowFromDeckTop(state, 0, api)
  assert.equal(fromDeck.code, SKILL, '牌库顶是最后一张')
  assert.equal(inv.deck.includes(SKILL), false)
  const fromAssets = hollowAllyOrItemPerInvestigator(state, api)
  assert.equal(fromAssets.length, 1, '手里只剩一张[[盟友]] → 成为空洞')
  assert.equal(hollowCountOf(state), 3)
  // 索恩反应：把索恩放进场后，空洞结算让他横置并给出立即行动。
  inv.assets.push({ id: 'thorne', code: RAW_CODES.thorneAsset, originalCode: RAW_CODES.thorneAsset, exhausted: false })
  inv.hand.push(ALLY2)
  hollowFromHand(state, 0, api, { code: ALLY2 })
  assert.equal(state.immediateActions.length, 1, '索恩触发立即行动')
  assert.equal(inv.assets.find(asset => asset.code === RAW_CODES.thorneAsset).exhausted, true)
  inv.hand.push(SKILL)
  hollowFromHand(state, 0, api, { code: SKILL })
  assert.equal(state.immediateActions.length, 1, '索恩已横置：不再触发')
  // 空牌库没有牌库顶。
  state.investigators[0].deck = []
  assert.equal(hollowFromDeckTop(state, 0, api), null)
  // 回收：安克雷奇抽回所有者手中（每轮一次）。
  inv.location = 'anchorage'
  const action = behavior.actions(state, inv).find(move => move.rule === 'hollowRecall')
  assert.ok(action, '安克雷奇提供抽回空洞的行动')
  assert.equal(action.reason, undefined)
  const before = hollowCountOf(state)
  behavior.performAction(state, inv, action, api)
  assert.equal(hollowCountOf(state), before - 1, '抽回一张')
  const again = behavior.actions(state, inv).find(move => move.rule === 'hollowRecall')
  assert.ok(again.reason, '同一轮不能再抽')
})

test('P7 onThinIce 空洞与凶狠猎犬：有空洞时获得警戒与反击', () => {
  const state = setup(stateFor(1))
  const api = apiFor(state)
  const hound = { id: 'hound', code: RAW_CODES.voidChimeraFellhound,
    originalCode: RAW_CODES.voidChimeraFellhound, location: 'fairbanks', engagedSeat: 0, defeated: false }
  state.enemies.push(hound)
  behavior.enemySpawned(state, hound, api)
  assert.equal(hound.retaliate, false, '没有空洞时不获得')
  state.investigators[0].hand.push(ALLY)
  hollowFromHand(state, 0, api, { code: ALLY })
  assert.equal(hound.retaliate, true)
  assert.equal(hound.alert, true)
  recallHollow(state, ALLY, api, { to: 'hand' })
  assert.equal(hound.retaliate, false, '空洞被回收后失去')
})

// ---------------------------------------------------------------------------
// 6. 遭遇卡行为
// ---------------------------------------------------------------------------
test('P7 onThinIce 冰层破裂：放在密谋旁，满 3 张全部弃掉并让荒地调查员检定', () => {
  const state = setup(stateFor(2))
  const api = apiFor(state)
  const entry = registeredEntry(RAW_CODES.crackingIce)
  state.investigators[0].location = 'mountainStream'
  state.investigators[1].location = 'anchorage'
  entry.encounterResolve(state, state.investigators[0], { code: RAW_CODES.crackingIce }, api)
  assert.equal(api.agendaAsideCards().filter(code => code === RAW_CODES.crackingIce).length, 1)
  entry.encounterResolve(state, state.investigators[0], { code: RAW_CODES.crackingIce }, api)
  assert.equal(state.testCalls.length, 0, '未满 3 张不检定')
  state.testResults.push({ success: false, value: 1, difficulty: 4, failedBy: 3, drawn: [] })
  state.choices.push('horror', 'damage', 'action')
  entry.encounterResolve(state, state.investigators[0], { code: RAW_CODES.crackingIce }, api)
  assert.equal(state.agendaAside.filter(card => card.code === RAW_CODES.crackingIce).length, 0, '全部弃掉')
  assert.equal(state.testCalls.length, 1, '只有荒地地点的调查员检定')
  assert.equal(state.testCalls[0].skill, 'agility')
  assert.equal(state.testCalls[0].difficulty, 4)
  assert.equal(state.investigators[0].horror, 1)
  assert.equal(state.investigators[0].damage, 1)
  assert.equal(state.investigators[0].actionsLeft, 2)
})

test('P7 onThinIce 积雪崩坍：敏捷(3)失败后你与有生命值的支援各受 1 点直接伤害', () => {
  const state = setup(stateFor(1))
  const api = apiFor(state)
  const inv = state.investigators[0]
  inv.assets.push({ id: 'ally', code: ALLY, originalCode: ALLY, traits: ['Ally'], health: 2, damage: 0 })
  inv.assets.push({ id: 'machete', code: ITEM, originalCode: ITEM, traits: ['Item'], damage: 0 })
  const entry = registeredEntry(RAW_CODES.snowslide)
  state.testResults.push({ success: false, value: 0, difficulty: 3, failedBy: 3, drawn: [] })
  entry.encounterResolve(state, inv, { code: RAW_CODES.snowslide }, api)
  assert.equal(state.testCalls.at(-1).skill, 'agility')
  assert.equal(inv.damage, 1, '你受 1 点直接伤害')
  assert.deepEqual(inv.assets.filter(asset => (asset.damage || 0) > 0).map(asset => asset.id), ['ally'],
    '只有有生命值的支援受伤')
})

test('P7 onThinIce 索恩（敌人）：抽到[[危险]]诡计时变换身上的玄丧之镜', () => {
  const state = setup(stateFor(1))
  const api = apiFor(state)
  const thorne = { id: 'thorne-enemy', code: RAW_CODES.thorneEnemy,
    originalCode: RAW_CODES.thorneEnemy, location: 'mountainStream', defeated: false }
  state.enemies.push(thorne)
  state.investigators[0].hand.push(ALLY, ITEM)
  tskKeys.stealKey(state, SABLE_GLASS_KEY.id, { type: 'enemy', enemyId: thorne.id })
  assert.equal(tskKeys.keyFace(state, SABLE_GLASS_KEY.id), SABLE_GLASS_KEY.unstableFace)
  behavior.encounterDrawn(state, state.investigators[0], '01040', api)
  assert.equal(tskHollow.hollowCards(state).length, 0, '非[[危险]]诡计不触发')
  behavior.encounterDrawn(state, state.investigators[0], RAW_CODES.crackingIce, api)
  assert.equal(tskHollow.hollowCards(state).length, 1, '动荡面：每人一张最高费手牌成为空洞')
  assert.equal(tskKeys.scarletKey(state, SABLE_GLASS_KEY.id).stable, false, '敌人持钥不翻回稳定面')
  behavior.enemyDefeated(state, thorne, api)
  assert.equal(tskKeys.scarletKey(state, SABLE_GLASS_KEY.id).bearer.type, 'investigator')
})

test('P7 onThinIce 玄丧之镜：稳定面查看迷你卡已知面，动荡面空洞化最高费手牌', () => {
  const state = setup(stateFor(1))
  const api = apiFor(state)
  const inv = state.investigators[0]
  resolveTrueFormConcealed(state)
  const mini = miniCards(state)[0]
  inv.location = mini.locationId
  tskKeys.bindKey(state, SABLE_GLASS_KEY.id, { type: 'investigator', seat: 0 })
  const stableShift = resolveKeyShift(state, 0, api, { by: 'investigator' })
  assert.equal(stableShift.effect, 'lookAtConcealedAtLocation')
  assert.equal(stableShift.flipped, true)
  assert.ok(miniCards(state).filter(card => card.locationId === inv.location).every(card => card.known),
    '所在地点的迷你卡标记 known（不揭露）')
  assert.equal(miniCards(state).length, 5, '查看不揭露')
  assert.equal(tskKeys.keyFace(state, SABLE_GLASS_KEY.id), SABLE_GLASS_KEY.unstableFace)
  inv.hand.push(ALLY, ITEM, SKILL)
  state.round = 2
  const unstableShift = resolveKeyShift(state, 0, api, { by: 'investigator' })
  assert.equal(unstableShift.effect, 'hollowHighestCostInHand')
  assert.equal(tskHollow.hollowCards(state).length, 1)
  assert.equal(tskHollow.hollowCards(state)[0].code, ALLY, `${ALLY} 的印刷费用最高（${costOf(ALLY)}）`)
  assert.equal(tskKeys.keyFace(state, SABLE_GLASS_KEY.id), SABLE_GLASS_KEY.stableFace, '翻回稳定面')
})

// ---------------------------------------------------------------------------
// 7. 时间 / 结局 / JSON 往返
// ---------------------------------------------------------------------------
test('P7 onThinIce 时间与结局：未达成记 1 时间、R1/R2/R3 各记 3 点、R4 不记时间', () => {
  const state = setup(stateFor(2))
  const api = apiFor(state)
  state.campaign.tsk = { version: 1, map: { version: 1, current: 'Anchorage', visited: ['Anchorage'],
    unlocked: ['Anchorage'], time: 0, forcedNode: null } }
  behavior.resolution(state, 'noResolution', [], api)
  assert.equal(state.campaign.records[RECORD_KEYS.time], 1)
  assert.equal(state.campaign.records[RECORD_KEYS.theVoidChimeraEscaped], true)
  assert.equal(state.campaign.tsk.map.time, 1, '世界地图时间同步')
  assert.equal(state.campaign.records.keysSableGlassBearer, 'thorne', '没有调查员持钥 → 索恩')
  const second = setup(stateFor(1))
  const api2 = apiFor(second)
  behavior.resolution(second, 'resolution1', [], api2)
  assert.equal(second.campaign.records[RECORD_KEYS.time], 3)
  behavior.resolution(second, 'resolution2', [], api2)
  assert.equal(second.campaign.records[RECORD_KEYS.time], 6)
  assert.equal(second.campaign.records[RECORD_KEYS.youHaventSeenTheLastOfThorn], true)
  behavior.resolution(second, 'resolution3', [], api2)
  assert.equal(second.campaign.records[RECORD_KEYS.time], 9)
  assert.equal(second.campaign.records[RECORD_KEYS.thorneDisappeared], true)
  // 结局 4：不记时间、不记经验、恢复开场快照。
  const fourth = setup(stateFor(1))
  const api4 = apiFor(fourth)
  fourth.campaign.trauma[0] = { physical: 2, mental: 1 }
  fourth.campaign.investigators[0].xp = 7
  const result = behavior.resolution(fourth, 'resolution4', [], api4)
  assert.equal(result.award, false)
  assert.equal(fourth.campaign.records[RECORD_KEYS.time], undefined, '不记时间')
  assert.equal(fourth.campaign.records[RECORD_KEYS.nothingOfNoteInAnchorage], true)
  assert.deepEqual(fourth.campaign.trauma[0], { physical: 0, mental: 0 }, '创伤恢复开场快照')
  assert.equal(fourth.campaign.investigators[0].xp, 0, '经验恢复开场快照')
})

test('P7 onThinIce 进度快照与密谋 3：存在抹除记录与空洞收齐', () => {
  const state = setup(stateFor(2))
  const api = apiFor(state)
  assert.deepEqual(snapshotProgress(state), [
    { seat: 0, physical: 0, mental: 0, xp: 0 }, { seat: 1, physical: 0, mental: 0, xp: 0 },
  ])
  state.campaign.trauma[0] = { physical: 3, mental: 0 }
  assert.equal(restoreProgress(state, api), 2)
  assert.deepEqual(state.campaign.trauma[0], { physical: 0, mental: 0 })
  state.investigators[0].hand.push(ALLY)
  hollowFromHand(state, 0, api, { code: ALLY })
  behavior.agendaReveal(state, { originalCode: RAW_CODES.agenda3, code: RAW_CODES.agenda3 }, api)
  assert.deepEqual(state.finished, ['resolution4'], '密谋 3 背面 → 结局 4')
  assert.equal(tskHollow.hollowCards(state).length, 0, '空洞被收齐（抹除）')
  // 结局 4 的记录与进度回滚由 resolution 钩子写（引擎在 api.finish 之后才结算它）。
  behavior.resolution(state, 'resolution4', [], api)
  assert.equal(state.campaign.records[RECORD_KEYS.nothingOfNoteInAnchorage], true)
})

test('P7 onThinIce JSON 往返：原语状态容器与章节状态都能存取', () => {
  const state = setup(stateFor(2))
  const api = apiFor(state)
  resolveTrueFormConcealed(state)
  state.investigators[0].hand.push(ALLY)
  hollowFromHand(state, 0, api, { code: ALLY })
  tskKeys.bindKey(state, SABLE_GLASS_KEY.id, { type: 'investigator', seat: 0 })
  markTime(state, 2)
  const roundTrip = clone(state)
  assert.doesNotThrow(() => validateTskState(roundTrip))
  assert.equal(tskConcealed.concealedMiniCards(roundTrip).length, 5)
  assert.deepEqual(tskHollow.hollowCards(roundTrip).map(card => card.code), [ALLY])
  assert.equal(tskKeys.keyFace(roundTrip, SABLE_GLASS_KEY.id), SABLE_GLASS_KEY.stableFace)
  assert.equal(roundTrip.campaign.records[RECORD_KEYS.time], 2)
  assert.equal(chapterState(roundTrip).exposedLocation, null)
  // 读档后钩子仍可结算（同一份 state 形状）。
  const api2 = apiFor(roundTrip)
  const shifted = resolveKeyShift(roundTrip, 0, api2, { by: 'investigator' })
  assert.equal(shifted.flipped, true)
})

// ---------------------------------------------------------------------------
// 8. 巡逻 / 猎人小屋 / 尤嗜鲜血
// ---------------------------------------------------------------------------
test('P7 onThinIce 巡逻与猎人小屋：敌人阶段移动、怪物进入小屋受伤', () => {
  const state = setup(stateFor(2))
  const api = apiFor(state)
  const fellbeak = { id: 'fellbeak', code: RAW_CODES.voidChimeraFellbeak,
    originalCode: RAW_CODES.voidChimeraFellbeak, location: 'fairbanks', exhausted: false,
    engagedSeat: null, defeated: false, traits: ['Monster'] }
  state.enemies.push(fellbeak)
  state.investigators[0].location = 'frozenLake'
  state.investigators[1].location = 'isolatedRoad'
  behavior.enemyPhaseStart(state, api)
  assert.ok(fellbeak.patrol, '巡逻目标写入实例')
  assert.equal(fellbeak.patrol.kind, 'named')
  assert.ok(WILDERNESS_LOCATION_IDS.includes(fellbeak.patrol.locationId), '目标是调查员最多的荒地')
  assert.ok(WILDERNESS_LOCATION_IDS.includes(fellbeak.location), '巡逻移动了一格')
  // 猎人小屋：怪物敌人进入时受 1 点伤害（同一实例只结算一次）。
  openOuterWilderness(state, api)
  const monster = { id: 'monster', code: RAW_CODES.voidChimeraFellbeak,
    originalCode: RAW_CODES.voidChimeraFellbeak, location: 'mountainStream', defeated: false,
    damageTaken: 0, traits: ['Monster'] }
  state.enemies.push(monster)
  behavior.enemyMoved(state, monster, 'mountainStream', api)
  assert.equal(monster.damageTaken, 0, '不在小屋不受伤')
  api.moveEnemy(monster, 'huntersLodge')
  assert.equal(monster.damageTaken, 1, '进入猎人小屋受 1 点伤害')
  behavior.enemyMoved(state, monster, 'mountainStream', api)
  assert.equal(monster.damageTaken, 1, '同一实例只结算一次')
})

test('P7 onThinIce 尤嗜鲜血：攻击后查看牌库顶并作为空洞治愈自身', () => {
  const state = setup(stateFor(1))
  const api = apiFor(state)
  const inv = state.investigators[0]
  inv.deck.push(ALLY, ITEM)
  const gorefeaster = { id: 'gore', code: RAW_CODES.voidChimeraGorefeaster,
    originalCode: RAW_CODES.voidChimeraGorefeaster, location: 'fairbanks', damageTaken: 3, defeated: false }
  state.enemies.push(gorefeaster)
  behavior.enemyAttackResolved(state, gorefeaster, inv, api)
  assert.equal(tskHollow.hollowCards(state).length, 1, '牌库顶成为空洞')
  assert.equal(inv.deck.includes(ITEM), false)
  assert.equal(gorefeaster.damageTaken < 3, true, '按空洞印刷费用治愈')
  assert.equal(gorefeaster.damageTaken, 3 - costOf(ITEM))
})

test('P7 onThinIce 章节摘要：布置与机械状态可只读投影（桌面/AI 共用）', () => {
  const state = setup(stateFor(1))
  const api = apiFor(state)
  resolveTrueFormConcealed(state)
  state.investigators[0].hand.push(ALLY)
  hollowFromHand(state, 0, api, { code: ALLY })
  const summary = chapterSummary(state)
  assert.equal(summary.wildernessOrder.length, 3)
  assert.equal(summary.outerWildernessOpened, false)
  assert.equal(summary.exposedLocation, null)
  assert.equal(summary.trueFormDefeated, false)
  assert.equal(summary.concealed.length, 5)
  assert.equal(summary.hollows.length, 1)
  assert.equal(summary.currentAct, RAW_CODES.act1)
  assert.equal(summary.currentAgenda, RAW_CODES.agenda1)
  assert.deepEqual(summary.entryCodes, [...chapter.behavior.implementedEncounterCodes])
})

// ---------------------------------------------------------------------------
// 9. 单卡条目
// ---------------------------------------------------------------------------
test('P7 onThinIce 条目：十二条专属卡逐条有可执行声明并已注册', () => {
  assert.equal(ENTRIES.length, 12)
  assert.deepEqual(ENTRIES.map(entry => entry.code).sort(), [...CHAPTER_ENTRY_CODES].sort())
  for (const entry of ENTRIES) {
    const registered = registeredEntry(entry.code)
    assert.ok(registered, `${entry.code} 未注册`)
    assert.equal(registered.implemented, true, `${entry.code} 未标 implemented`)
    assert.ok(['enemy', 'treachery', 'storyAsset'].includes(entry.scope), `${entry.code} scope 非法`)
  }
  const byCode = Object.fromEntries(ENTRIES.map(entry => [entry.code, entry]))
  assert.equal(byCode['09626'].enemyRule.concealed, 4)
  assert.equal(byCode['09626'].enemyRule.blocksExposeWhileOtherFormsInPlay, true)
  assert.deepEqual(Object.keys(byCode['09626'].enemyRule.decoySpawns).sort(), [
    'DecoyVoidChimeraEarsplitter', 'DecoyVoidChimeraFellbeak', 'DecoyVoidChimeraFellhound',
    'DecoyVoidChimeraGorefeaster',
  ])
  assert.equal(byCode['09627'].enemyRule.patrol.trait, 'Wilderness')
  assert.equal(byCode['09628'].enemyRule.alert, true)
  assert.equal(byCode['09629'].enemyRule.hollowDeckTopWhenAttacks, true)
  assert.equal(byCode['09630'].enemyRule.gainsAlertRetaliateWhileHollowsOwned, true)
  assert.deepEqual(byCode['09631'].enemyRule.enterOnlyTraits, ['Wilderness'])
  assert.equal(byCode['09631'].enemyRule.spawnNearestWilderness, true)
  assert.equal(byCode['09625a'].enemyRule.shiftsKeysOnHazardDrawn, true)
  assert.equal(byCode['09625b'].assetRule.onHollowSetAside.immediateAction, true)
  assert.equal(byCode['09634a'].assetRule.keyShift.face, 'stable')
  assert.equal(byCode['09634b'].assetRule.keyShift.face, 'unstable')
  assert.equal(typeof byCode['09632'].encounterResolve, 'function')
  assert.equal(typeof byCode['09633'].encounterResolve, 'function')
  // 近似逐条披露：每条 entry 都有 note，带近似的卡写明「approximation」。
  for (const entry of ENTRIES) assert.ok(String(entry.note || '').length > 10, `${entry.code} 缺 note`)
  for (const code of ['09625a', '09625b', '09626', '09627', '09629', '09630', '09631', '09632', '09633',
    '09634a', '09634b']) {
    assert.ok(byCode[code].note.includes('approximation'), `${code} note 必须写明 approximation`)
  }
  assert.ok(chapter.scenarioApproximations.length >= 5)
  assert.ok(chapter.scenarioGaps.length >= 2)
  assert.equal(chapter.behavior.scenarioApproximations, chapter.scenarioApproximations)
})
