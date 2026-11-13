// 不留痕迹（withoutATrace · 09681）章节测试（P7）。
//
// 三层证据：
//   1. 章节数据 —— manifest/身份/幕与议程/遭遇牌库/正文可读；
//   2. 章节钩子（behavior）—— 异界牌库顺序与阴影三位置、左/中/右迷你卡揭露入场与补位、
//      空洞数修正（[tablet]/[skull]）、[cultist]/[elderthing] 后果、幕/议程正反面、逃生（撤退）与结局、
//      进入未揭示地点的额外费用、JSON 存档往返；
//   3. 单卡条目 —— 四张专属卡（09690/09691/09692/09693）登记后规则数据可读、被 behavior 读点接线。
//
// 索引由 Lead 合并后重建，因此本测试用动态 import + registerCardAbilities 显式登记本章条目
// （已登记则跳过），使 behavior 里的 enemyRule/assetRule 读点生效。
import test from 'node:test'
import assert from 'node:assert/strict'
import { registerCardAbilities, registeredEntry } from '../src/engine/ability.js'
import { assetRuleFor, enemyRuleFor, encounterResolveFor } from '../src/cards/card-rules.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { ALL_RECORD_KEYS } from '../content/campaigns/theScarletKeys/records.js'
import { gridPosition } from '../src/engine/grid-map.js'
import {
  concealedAt, concealedMiniCards, exposeMiniCard, isInShadows, placeMiniCard, setInShadows,
} from '../src/engine/tsk-concealed.js'
import { hollowCard, hollowCards, hollowCount, isHollowed, recallHollow } from '../src/engine/tsk-hollow.js'
import { mapTime } from '../src/engine/tsk-map.js'
import * as chapter from '../content/campaigns/theScarletKeys/scenarios/withoutATrace/index.js'
import {
  CHAPTER_ENTRY_CODES, CITY_OF_REMNANTS_LOCATION_IDS, CLIFFS_LOCATION_IDS, EXPOSED_POSITION_EFFECTS,
  INTRO_SECTIONS, LOCATIONS, MINI_KIND_BY_POSITION, OTHERWORLD_DECK_ID, OTHERWORLD_LOCATION_IDS,
  OUTSIDERS_LAIR_ID, RAW_CODES, RECORD_READS, RECORD_WRITES, RESOLUTION_TABLE, SET_ASIDE_CODES,
  SHADOW_POSITIONS, START_LOCATION, START_MINI_SPOTS, cityRemovalCount, identities, isOtherworldLocationId,
  scenario,
} from '../content/campaigns/theScarletKeys/scenarios/withoutATrace/definition.js'
import {
  WITHOUT_A_TRACE_TOKEN_MEANINGS, withoutATraceAfterTest, withoutATraceChaosToken,
} from '../content/campaigns/theScarletKeys/scenarios/withoutATrace/chaos.js'
import {
  ACT_BACK_HANDLERS, behavior, distanceBetween, emptySpotsAround, exposableMiniCards, exposeShroud,
  exposeMiniInShadows, inVictoryDisplay, miniSpotOf, otherworldDeckSize, prepareOtherworldDeck, putLocationInShadows,
  redGlovedManIsHollow, resolutionFromVictory, setAsideHollowCount, setAsideHollows, withoutATraceFlags,
} from '../content/campaigns/theScarletKeys/scenarios/withoutATrace/behavior.js'

const ENTRIES = []
for (const code of CHAPTER_ENTRY_CODES) {
  const module = await import(`../src/cards/encounter-entries/theScarletKeys/withoutATrace/${code}.js`)
  ENTRIES.push(module.default)
}
for (const entry of ENTRIES) if (!registeredEntry(entry.code)) registerCardAbilities(entry)

const clone = value => structuredClone(value)
const traitsOf = code => [...(ALL_CARDS[code]?.traits || [])]

// ---------------------------------------------------------------------------
// 状态 / api 夹具（场景运行时的窄替身：所有写入都走同一个 api 面）
// ---------------------------------------------------------------------------
function stateFor(count = 2) {
  const state = {
    scenario: clone(scenario),
    acts: clone(scenario.acts),
    agendas: clone(scenario.agendas),
    actIndex: 0,
    agendaIndex: 0,
    numInvestigators: count,
    difficulty: 'standard',
    round: 1,
    phase: 'investigation',
    turnSerial: 1,
    currentSeat: 0,
    status: 'playing',
    doom: 0,
    victory: 0,
    locations: [],
    locationVariants: {},
    investigators: Array.from({ length: count }, (_, seat) => ({
      seat, code: '01001', name: `调查员${seat + 1}`, location: START_LOCATION, klass: 'survivor', traits: [],
      damage: 0, horror: 0, clues: 0, resources: 5, hand: ['01001', '01002'], assets: [], threat: [], engaged: [],
      deck: ['01001', '01002', '01003'], discard: [], actionsLeft: 3, defeated: false, resigned: false,
    })),
    enemies: [],
    storyAssets: [],
    encounterDeck: [],
    encounterDiscard: [],
    setAside: [],
    removedFromGame: [],
    scenarioZones: {},
    scenarioFlags: {},
    campaign: {
      leadSeat: 0,
      records: {},
      tsk: {
        map: {
          version: 1, current: 'Bermuda', visited: ['Bermuda'], unlocked: ['Bermuda'], time: 4,
          forcedNode: 'Tunguska',
        },
      },
    },
    victoryDisplay: [],
    chaosBag: ['+1', '0', '-1', 'skull', 'skull', 'tablet', 'elderthing', 'autofail', 'eldersign'],
    testResults: [], choices: [], finished: null, infos: [], log: [],
  }
  return state
}

function apiFor(state, overrides = {}) {
  const api = {
    info: text => state.infos.push(String(text)),
    choice: spec => (state.choices.length ? state.choices.shift() : (spec?.options?.[0]?.id ?? null)),
    cardName: code => ALL_CARDS[code]?.nameZh || ALL_CARDS[code]?.name || code,
    test: (seat, skill, difficulty, resolve, skillBonus = 0, source = null, options = {}) => {
      let callback = resolve
      if (callback && typeof callback === 'object') { options = callback; callback = callback.resolve }
      const result = state.testResults.shift()
        || { success: true, value: difficulty + 1, difficulty, successBy: 1, failedBy: 0, drawn: [], cancelledTokens: [] }
      const full = { successBy: Math.max(0, (result.value ?? difficulty + 1) - difficulty), failedBy: 0, ...result }
      state.lastTestResult = full
      if (typeof callback === 'function') callback(full)
      else options?.resolve?.(full)
      return full
    },
    testResult: () => state.lastTestResult || null,
    spawn: (code, location, options = {}) => {
      const card = ALL_CARDS[code] || {}
      const enemy = {
        id: `enemy-${code}-${state.enemies.length + 1}`, code, originalCode: code,
        name: card.nameZh || card.name, location, engagedSeat: options.engagedSeat ?? null,
        exhausted: options.exhausted === true, damageTaken: 0, doom: 0, clues: 0,
        health: card.health ?? null, traits: traitsOf(code),
      }
      state.enemies.push(enemy)
      return enemy
    },
    spawnEngaged: (code, location, seat) => {
      const enemy = api.spawn(code, location, { engagedSeat: seat })
      return enemy
    },
    harm: (seat, amount = {}) => {
      const inv = state.investigators[seat]
      inv.damage += amount.damage || 0
      inv.horror += amount.horror || 0
    },
    damage: (seat, n) => { state.investigators[seat].damage += n },
    horror: (seat, n) => { state.investigators[seat].horror += n },
    attack: (enemy, inv) => {
      const card = ALL_CARDS[enemy.code] || {}
      inv.damage += card.damage || 0
      inv.horror += card.horror || 0
      state.attackedBy = [...(state.attackedBy || []), { enemyId: enemy.id, seat: inv.seat }]
      return { hit: true }
    },
    readyEnemy: enemy => { enemy.exhausted = false; return true },
    exhaustEnemy: enemy => { enemy.exhausted = true; return true },
    moveEnemyToward: (enemy, destination) => {
      const next = (state.locations.find(item => item.id === enemy.location)?.connections || [])
        .map(id => ({ id, distance: distanceBetween(state, id, destination) }))
        .filter(entry => Number.isFinite(entry.distance))
        .sort((left, right) => left.distance - right.distance)[0]
      if (next) enemy.location = next.id
      return enemy.location
    },
    engageAtInvestigator: (enemy, seat) => {
      const inv = state.investigators[seat]
      if (!inv || enemy.location !== inv.location) return false
      enemy.engagedSeat = seat
      return true
    },
    discoverClue: (seat, amount = 1) => {
      const inv = state.investigators[seat]
      inv.clues += amount
      return amount
    },
    spendClues: (seat, n) => {
      const inv = state.investigators[seat]
      if (inv.clues < n) throw new Error('线索不足')
      inv.clues -= n
      return n
    },
    removeAsset: (seat, assetId) => {
      const inv = state.investigators[seat]
      const before = inv.assets.length
      inv.assets = inv.assets.filter(asset => String(asset.id) !== String(assetId))
      return inv.assets.length < before
    },
    addStoryToVictory: code => {
      if (state.victoryDisplay.some(card => String(card.originalCode || card.code) === String(code))) return false
      state.victoryDisplay.push({ id: `victory-${code}`, code, originalCode: code, victory: 0 })
      return true
    },
    driveInsane: seat => {
      const inv = state.investigators[seat]
      inv.defeated = true
      inv.drivenInsane = true
      state.campaign.records.drivenInsaneInvestigators = [...(state.campaign.records.drivenInsaneInvestigators || []), seat]
      return true
    },
    resign: seat => { state.investigators[seat].resigned = true },
    finish: key => { state.finished = key },
    advanceAct: () => {
      const act = state.acts[state.actIndex]
      if (act) behavior.actReveal(state, act, api)
      state.actIndex += 1
    },
    advanceAgenda: () => {
      const agenda = state.agendas[state.agendaIndex]
      if (agenda) behavior.agendaReveal(state, agenda, api)
      state.agendaIndex += 1
    },
    addDoom: n => { state.doom += n },
    defeatEnemy: enemy => {
      enemy.defeated = true
      return true
    },
    shuffleIntoEncounterDeck: codes => {
      const list = Array.isArray(codes) ? codes : [codes]
      state.encounterDeck.push(...list.filter(Boolean))
      return state.encounterDeck.length
    },
    moveCard: spec => {
      const seat = spec.ownerSeat ?? state.currentSeat
      const inv = state.investigators[seat]
      if (spec.from === 'hand') {
        const index = inv.hand.lastIndexOf(spec.code)
        if (index >= 0) inv.hand.splice(index, 1)
      } else if (spec.from === 'deck') {
        const index = inv.deck.lastIndexOf(spec.code)
        if (index >= 0) inv.deck.splice(index, 1)
      } else if (spec.from === 'discard') {
        const index = inv.discard.lastIndexOf(spec.code)
        if (index >= 0) inv.discard.splice(index, 1)
      }
      if (spec.to === 'setAside') {
        state.setAside ||= []
        state.setAside.push({ code: spec.code, ownerSeat: seat })
      }
      return spec.code
    },
    mechanics: {
      placeLocation: id => {
        if (state.locations.some(location => location.id === id)) return id
        const base = state.scenario.locations[id]
        if (!base) return null
        const clues = base.cluesFixed ?? (base.cluesPerInvestigator != null
          ? base.cluesPerInvestigator * state.numInvestigators : (base.clues || 0))
        const revealed = state.investigators.some(inv => inv.location === id)
        state.locations.push({ ...base, id, revealed, clues: revealed ? clues : 0, maxClues: clues, connections: [] })
        return id
      },
      tsk: {
        concealed: {
          miniCards: () => concealedMiniCards(state),
          at: (id, position) => concealedAt(state, id, position),
          inShadows: id => isInShadows(state, id),
          setInShadows: (id, value) => setInShadows(state, id, value),
          place: spec => placeMiniCard(state, spec),
          expose: id => exposeMiniCard(state, id),
        },
        hollow: {
          cards: () => hollowCards(state),
          hollow: spec => hollowCard(state, spec),
          count: options => hollowCount(state, options),
          isHollowed: code => isHollowed(state, code),
          recall: (code, options) => recallHollow(state, code, options),
        },
        map: { time: () => mapTime(state) },
      },
    },
    ...overrides,
  }
  return api
}

function setupState(count = 2, { shuffleOrder = null, choices = [] } = {}) {
  const state = stateFor(count)
  const api = apiFor(state)
  state.choices = choices
  const deterministicShuffle = shuffleOrder
    ? (list => {
      const out = [...list]
      for (let index = 0; index < shuffleOrder.length && index < out.length; index += 1) {
        const swap = shuffleOrder[index] % out.length
        ;[out[index], out[swap]] = [out[swap], out[index]]
      }
      return out
    })
    : (list => list)
  behavior.preScenarioSetup(state, [], api)
  behavior.setupLocations(state, [], { api, info: () => {}, shuffle: deterministicShuffle })
  state.encounterDeck = [...scenario.encounterDeck]
  behavior.afterDeckSetup(state, [], { api, info: () => {}, shuffle: deterministicShuffle })
  return { state, api }
}

const byId = (state, id) => state.locations.find(location => location.id === id)
const miniFor = (state, position) => concealedMiniCards(state)
  .find(card => card.kind === MINI_KIND_BY_POSITION[position])

// ---------------------------------------------------------------------------
// 1. 章节数据 / manifest / 正文
// ---------------------------------------------------------------------------
test('P7 withoutATrace 章节清单：playable、11 处地点、幕/议程/结局与正文可读', () => {
  assert.equal(chapter.manifest.id, 'withoutATrace')
  assert.equal(chapter.manifest.campaignId, 'theScarletKeys')
  assert.equal(chapter.manifest.status, 'playable')
  assert.equal(chapter.manifest.referenceCode, '09681')
  assert.equal(chapter.scenario.originalCode, '09681')
  // 11 处地点 = 2 张自有 + 7 张残骸之城 + 2 张疯狂峭壁。
  assert.equal(chapter.manifest.locations.length, 11)
  assert.deepEqual(chapter.manifest.acts.map(act => act.id), ['act1', 'act2', 'act3'])
  assert.deepEqual(chapter.manifest.agendas.map(agenda => agenda.id), ['agenda1', 'agenda2', 'agenda3'])
  assert.deepEqual(chapter.manifest.resolutionIds,
    ['noResolution', 'resolution1', 'resolution2', 'resolution3', 'resolution4'])
  assert.equal(chapter.manifest.startLocationId, START_LOCATION)
  assert.ok(chapter.manifest.requiredEncounterGroupIds.includes('beyondTheBeyond'))
  // 正文可读（不锁具体译文：story-text 是生成物）。
  assert.ok(chapter.scenario.intro.length > 400, '序章正文可读')
  assert.ok(chapter.scenario.setup.length > 20, '布置正文可读')
  assert.match(chapter.scenario.specialRules, /异界牌库/)
  assert.ok(INTRO_SECTIONS.blowTheWhistle.length > 0)
  // 生成物里的 HTML 片段必须被去掉（剧本书不展示标签）。
  assert.doesNotMatch(chapter.scenario.setup, /<p|<section|class=/)
  assert.doesNotMatch(chapter.scenario.specialRules, /<p|<section/)
})

test('P7 withoutATrace 身份登记：地点/幕/议程/敌人/剧情资产都有原卡身份', () => {
  for (const category of ['locations', 'acts', 'agendas', 'enemies', 'storyAssets']) {
    for (const [id, identity] of Object.entries(identities[category] || {})) {
      assert.ok(identity.originalCode, `${category}/${id} 缺少 originalCode`)
    }
  }
  assert.equal(identities.locations.courtOfTheOutsiders.originalCode, RAW_CODES.courtOfTheOutsiders)
  assert.equal(identities.locations.outsidersLair.originalCode, RAW_CODES.outsidersLair)
  // 两张疯狂峭壁同号、两个实体 id。
  assert.equal(identities.locations.cliffsOfInsanityA.originalCode, '09750')
  assert.equal(identities.locations.cliffsOfInsanityB.originalCode, '09750')
  assert.equal(identities.enemies[RAW_CODES.mimeticNemesis].originalCode, RAW_CODES.mimeticNemesis)
  assert.equal(identities.storyAssets[RAW_CODES.aliki].originalCode, RAW_CODES.aliki)
})

test('P7 withoutATrace 记录键与结局表：读写键都在战役记录 schema 里', () => {
  for (const key of [...RECORD_READS, ...RECORD_WRITES]) {
    assert.ok(ALL_RECORD_KEYS.includes(key), `记录键 ${key} 不在战役 records.js 的 schema`)
  }
  assert.equal(RESOLUTION_TABLE.resolution1.time, 3)
  assert.equal(RESOLUTION_TABLE.resolution1.bonus, 1)
  for (const key of ['resolution1', 'resolution2', 'resolution3', 'resolution4']) {
    assert.equal(RESOLUTION_TABLE[key].embark, true)
    assert.equal(RESOLUTION_TABLE[key].award, true)
  }
  assert.equal(RESOLUTION_TABLE.noResolution.award, false)
  assert.equal(RESOLUTION_TABLE.noResolution.records.theCellWasHollowed, true)
})

test('P7 withoutATrace 遭遇牌库：24 张；放一边四张（含两张本章敌人）不在牌库', () => {
  const deck = scenario.encounterDeck
  assert.equal(deck.length, 24)
  for (const code of SET_ASIDE_CODES) {
    assert.ok(!deck.includes(code), `放一边的卡不应在遭遇牌库：${code}`)
  }
  assert.equal(deck.filter(code => code === '09751').length, 2, '超维恐怖 2 张')
  assert.equal(deck.filter(code => code === '09744').length, 2, '异世界之触 2 张')
  // 异界牌库的地点卡不进遭遇牌库。
  for (const id of OTHERWORLD_LOCATION_IDS) {
    const code = LOCATIONS[id].originalCode
    assert.ok(!deck.includes(code), `异界地点 ${code} 不应在遭遇牌库`)
  }
})

// ---------------------------------------------------------------------------
// 2. 布置：异界牌库 + 阴影三位置 + 起点迷你卡
// ---------------------------------------------------------------------------
test('P7 withoutATrace 布置：域外来客之廷在网格 (0,0)，起点揭示、每人 2 线索', () => {
  const { state } = setupState(2)
  const court = byId(state, START_LOCATION)
  assert.ok(court, '域外来客之廷必须入场')
  assert.equal(court.revealed, true)
  assert.equal(court.clues, 4, '每人 2 线索 × 2 人')
  assert.deepEqual(gridPosition(state, START_LOCATION), { x: 0, y: 0, isolated: false })
  assert.equal(state.campaign.records.theCellBlewTheWhistle, true)
  // 吹哨：艾里奇由一位调查员控制。
  const holder = state.investigators.find(inv => inv.assets.some(asset => asset.code === RAW_CODES.aliki))
  assert.ok(holder, '吹响哨子必须让艾里奇入场')
  // 放一边四张。
  for (const code of SET_ASIDE_CODES) assert.ok(state.scenarioZones.setAside.includes(code))
})

test('P7 withoutATrace 异界牌库：底=巢+2 峭壁、顶=残骸之城；1/2 人移出 2/1 张', () => {
  assert.equal(cityRemovalCount(1), 2)
  assert.equal(cityRemovalCount(2), 1)
  assert.equal(cityRemovalCount(4), 0)
  const { state } = setupState(2)
  const pile = state.scenarioFlags.mechanics.scenarioDecks[OTHERWORLD_DECK_ID]
  // 10 张 = 3 底 + 7 城；2 人移出 1 → 牌库 9 张、阴影 3 张在场上。
  assert.equal(pile.deck.length, 6, '2 人：7 城 - 1 移出 - 3 阴影 = 3 顶牌 + 3 底牌')
  assert.equal(otherworldDeckSize(state), 6)
  const flags = withoutATraceFlags(state)
  assert.equal(flags.removedCityIds.length, 1)
  // 牌库底三张是巢 + 两张疯狂峭壁（数组头部 = 牌库底）。
  const bottom = pile.deck.slice(0, 3)
  assert.ok(bottom.includes(OUTSIDERS_LAIR_ID))
  assert.equal(bottom.filter(id => CLIFFS_LOCATION_IDS.includes(id)).length, 2)
  // 牌库顶三张都是残骸之城。
  for (const id of pile.deck.slice(3)) assert.ok(CITY_OF_REMNANTS_LOCATION_IDS.includes(id))
  // 独立准备一次：返回的 inShadows / removed 与人数口径。
  const solo = stateFor(1)
  const api = apiFor(solo)
  behavior.setupLocations(solo, [], { api, info: () => {}, shuffle: list => list })
  const soloFlags = withoutATraceFlags(solo)
  assert.equal(soloFlags.removedCityIds.length, 2, '单人移出 2 张残骸之城')
})

test('P7 withoutATrace 阴影三位置：左/中/右各一张残骸之城，未揭示且不在网格', () => {
  const { state } = setupState(2)
  const flags = withoutATraceFlags(state)
  for (const position of SHADOW_POSITIONS) {
    const id = flags.shadows[position]
    assert.ok(id, `${position} 必须有地点`)
    assert.ok(isOtherworldLocationId(id))
    const location = byId(state, id)
    assert.equal(location.revealed, false, '阴影中的地点未揭示')
    assert.equal(gridPosition(state, id), null, '阴影中的地点没有网格格子')
    assert.equal(isInShadows(state, id), true)
    assert.deepEqual(location.connections, [], '阴影中的地点不可到达')
  }
  assert.equal(new Set(Object.values(flags.shadows)).size, 3, '三个位置是不同地点')
})

test('P7 withoutATrace 起点迷你卡：1 张诱饵 + 3 张残骸之城（L/M/R）环绕起点四个空位', () => {
  const { state } = setupState(2)
  const cards = concealedMiniCards(state)
  assert.equal(cards.length, 4)
  assert.equal(cards.filter(card => card.decoy).length, 1)
  for (const position of SHADOW_POSITIONS) {
    assert.equal(cards.filter(card => card.kind === MINI_KIND_BY_POSITION[position]).length, 1)
  }
  // 四张迷你卡各占起点周围不同的空位（左/右/上/下）。
  const spots = cards.map(card => miniSpotOf(state, card))
  assert.equal(new Set(spots.map(spot => `${spot.x},${spot.y}`)).size, 4)
  for (const spot of spots) assert.equal(Math.abs(spot.x) + Math.abs(spot.y), 1, '只与起点共边')
  // 起点周围的 4 个空位正好被这 4 张迷你卡占满（空位不得与地点或迷你卡重叠）。
  assert.equal(START_MINI_SPOTS.length, 4)
  assert.equal(emptySpotsAround(state, { x: 0, y: 0 }).length, 0)
  for (const spot of START_MINI_SPOTS) {
    assert.ok(spots.some(item => item.x === spot.x && item.y === spot.y), `空位 ${spot.label} 必须被占用`)
  }
  // 揭露范围按「相邻空位」计算，隐藏值取本地。
  const inv = state.investigators[0]
  assert.equal(exposableMiniCards(state, inv).length, 4)
  assert.equal(exposeShroud(state, inv), 2)
})

// ---------------------------------------------------------------------------
// 3. 阴影地点揭露：左/中/右
// ---------------------------------------------------------------------------
test('P7 withoutATrace 揭露诱饵：只弃掉，不放入地点、不补位', () => {
  const { state, api } = setupState(2)
  const decoy = concealedMiniCards(state).find(card => card.decoy)
  const beforeDeck = otherworldDeckSize(state)
  const inv = state.investigators[0]
  const result = behavior.exposeMiniInShadows(state, inv, decoy.id, api)
  assert.equal(result.decoy, true)
  assert.equal(concealedMiniCards(state).length, 3)
  assert.equal(otherworldDeckSize(state), beforeDeck, '诱饵不触发补位')
  assert.equal(state.locations.length, 4, '只有起点 + 三张阴影地点')
})

test('P7 withoutATrace 揭露左位置迷你卡：对应地点放入场、结算左边强制、异界牌库顶补位并隐匿 1', () => {
  const { state, api } = setupState(2)
  const flags = withoutATraceFlags(state)
  const mini = miniFor(state, 'left')
  const spot = miniSpotOf(state, mini)
  const shadowLocationId = flags.shadows.left
  const beforeDeck = otherworldDeckSize(state)
  const inv = state.investigators[0]
  const result = exposeMiniInShadows(state, inv, mini.id, api)
  assert.equal(result.decoy, false)
  assert.equal(result.position, 'left')
  assert.equal(result.locationId, shadowLocationId)
  // 地点放入场：落在迷你卡原来的空位、仍未揭示、离开阴影、连上起点。
  const placed = byId(state, shadowLocationId)
  assert.equal(placed.revealed, false)
  assert.equal(placed.inShadows, undefined)
  assert.equal(isInShadows(state, shadowLocationId), false)
  assert.deepEqual(gridPosition(state, shadowLocationId), { x: spot.x, y: spot.y, isolated: false })
  assert.ok(placed.connections.includes(START_LOCATION), '落在起点旁边 → 与起点相连')
  // 「揭露此地点」的强制：域外来客之巢在同一位置才按左/中/右结算；先断言表存在。
  assert.ok(EXPOSED_POSITION_EFFECTS[RAW_CODES.outsidersLair].left)
  // 补位：左位置重新有地点、异界牌库少 1 张、新地点周围有 1 张 L 迷你卡 + 1 张诱饵。
  const refilledId = flags.shadows.left
  assert.ok(refilledId && refilledId !== shadowLocationId, '左位置由异界牌库顶补上')
  assert.equal(otherworldDeckSize(state), beforeDeck - 1)
  assert.equal(isInShadows(state, refilledId), true)
  const aroundNew = concealedMiniCards(state).filter(card => miniSpotOf(state, card)
    && (() => { const cell = gridPosition(state, shadowLocationId); const at = miniSpotOf(state, card)
      return at && Math.abs(at.x - cell.x) + Math.abs(at.y - cell.y) === 1 })())
  assert.equal(aroundNew.filter(card => card.kind === MINI_KIND_BY_POSITION.left).length, 1)
  assert.equal(aroundNew.filter(card => card.decoy).length, 1)
  // 揭露后必须还能继续揭露（迷你卡池没有丢卡）。
  assert.ok(concealedMiniCards(state).length >= 4)
})

test('P7 withoutATrace 揭露中/右位置：域外来客之巢的中/右强制（空洞手牌 / 恐惧）', () => {
  // 把中/右位置换成域外来客之巢（参考牌库底本就有巢），验证背面的中/右强制。
  const { state, api } = setupState(2)
  const flags = withoutATraceFlags(state)
  // 先把艾里奇横置，隔离「地点背面」与「艾里奇回收空洞」两个读点。
  for (const inv of state.investigators) {
    for (const asset of inv.assets || []) if (asset.code === RAW_CODES.aliki) asset.exhausted = true
  }
  putLocationInShadows(state, api, 'middle', OUTSIDERS_LAIR_ID)
  putLocationInShadows(state, api, 'right', OUTSIDERS_LAIR_ID)
  const middleMini = miniFor(state, 'middle')
  const rightMini = miniFor(state, 'right')
  const inv = state.investigators[0]
  inv.hand = ['01001', '01002', '01003']
  state.choices = ['01001']
  const result = exposeMiniInShadows(state, inv, middleMini.id, api)
  assert.equal(result.position, 'middle')
  assert.equal(flags.shadows.middle !== OUTSIDERS_LAIR_ID, true, '中位置由异界牌库顶补上')
  assert.equal(isHollowed(state, '01001'), true, '中间位置：一张手牌成为空洞')
  assert.equal(inv.hand.includes('01001'), false)
  // 右位置：受到 1 点恐惧。
  const horrorBefore = inv.horror
  exposeMiniInShadows(state, inv, rightMini.id, api)
  assert.equal(inv.horror, horrorBefore + 1, '右边位置：受到 1 点恐惧')
})

test('P7 withoutATrace 揭露补位耗尽：异界牌库空后该位置留空，迷你卡移出游戏', () => {
  const { state, api } = setupState(2)
  const flags = withoutATraceFlags(state)
  const pile = state.scenarioFlags.mechanics.scenarioDecks[OTHERWORLD_DECK_ID]
  pile.deck = []
  const mini = miniFor(state, 'right')
  const result = exposeMiniInShadows(state, state.investigators[0], mini.id, api)
  assert.equal(result.decoy, false)
  assert.equal(result.refilled, null, '牌库空 → 不补位')
  assert.equal(flags.shadows.right, null)
  // 位置空着时再揭露同位置：地点为 null → 迷你卡移出游戏。
  const extra = placeMiniCard(state, { kind: MINI_KIND_BY_POSITION.right, decoy: false, locationId: START_LOCATION })
  withoutATraceFlags(state).spots[extra.id] = { x: -1, y: 0 }
  const second = exposeMiniInShadows(state, state.investigators[0], extra.id, api)
  assert.equal(second.locationId, null)
})

// ---------------------------------------------------------------------------
// 4. 空洞数修正与混沌符号
// ---------------------------------------------------------------------------
test('P7 withoutATrace 空洞计数：[tablet] 个人口径（简单最多 5 / 困难 +1）、[skull] 地点计数', () => {
  const { state } = setupState(2)
  for (let index = 0; index < 3; index += 1) {
    hollowCard(state, { code: `card${index}`, source: 'test', scope: 'investigator', seat: 0 })
  }
  hollowCard(state, { code: 'teamsCard', source: 'test', scope: 'team' })
  assert.equal(hollowCount(state, { scope: 'investigator', seat: 0 }), 4, '个人 + 全队共享')
  assert.equal(hollowCount(state, { scope: 'investigator', seat: 1 }), 1, '队友只算全队共享')
  const inv0 = state.investigators[0]
  const token = withoutATraceChaosToken(state, inv0, 'tablet', {
    countHollows: (value, seat) => hollowCount(value, { scope: 'investigator', seat }),
  })
  assert.equal(token.delta, -4)
  assert.equal(token.x, 4)
  state.difficulty = 'hard'
  const hard = withoutATraceChaosToken(state, inv0, 'tablet', {
    countHollows: (value, seat) => hollowCount(value, { scope: 'investigator', seat }),
  })
  assert.equal(hard.delta, -5, '困难：个人空洞 + 1')
  // [skull]：简单取一半向下取整；阴影中的地点不算。
  state.difficulty = 'standard'
  const skull = withoutATraceChaosToken(state, inv0, 'skull', {
    countLocations: value => value.locations.filter(location => !location.inShadows).length,
  })
  assert.equal(skull.x, Math.floor(state.locations.filter(location => !location.inShadows).length / 2))
  const shadowCount = state.locations.filter(location => location.inShadows).length
  assert.equal(shadowCount, 3, '阴影中 3 张地点不计入 [skull]')
  state.difficulty = 'hard'
  const hardSkull = withoutATraceChaosToken(state, inv0, 'skull', {
    countLocations: value => value.locations.filter(location => !location.inShadows).length,
  })
  assert.equal(hardSkull.x, state.locations.filter(location => !location.inShadows).length)
  assert.equal(WITHOUT_A_TRACE_TOKEN_MEANINGS.standard.tablet.rider, 'tabletHollowCount')
})

test('P7 withoutATrace 符号后果：[cultist] 最近域外敌人重整并移动/攻击，[elderthing] 失败空洞', () => {
  const { state, api } = setupState(2)
  const inv = state.investigators[0]
  inv.location = START_LOCATION
  // 起点相邻放一张地点，域外敌人站在那边。
  api.mechanics.placeLocation('cliffsOfInsanityA')
  state.locations.find(location => location.id === 'cliffsOfInsanityA').connections = [START_LOCATION]
  byId(state, START_LOCATION).connections = ['cliffsOfInsanityA']
  const enemy = api.spawn('09731', 'cliffsOfInsanityA')
  enemy.exhausted = true
  assert.deepEqual(withoutATraceAfterTest(state, inv, { success: false, drawn: ['cultist'], cancelledTokens: [] }),
    ['cultistOutsider'])
  assert.deepEqual(withoutATraceAfterTest(state, inv, { success: true, drawn: ['cultist'], cancelledTokens: [] }), [],
    '[cultist] 成功不触发')
  behavior.afterTest(state, inv, { success: false, drawn: ['cultist'], cancelledTokens: [] }, api)
  assert.equal(enemy.exhausted, false, '最近的域外敌人重整')
  assert.equal(enemy.location, START_LOCATION, '向你移动一次')
  assert.deepEqual(state.attackedBy, [{ enemyId: enemy.id, seat: 0 }], '移动到本地后攻击')
  // [elderthing]：简单面失败 → 一张手牌成为空洞；成功不触发。
  inv.hand = ['01001', '01002']
  state.choices = ['01002']
  assert.deepEqual(withoutATraceAfterTest(state, inv, { success: false, drawn: ['elderthing'], cancelledTokens: [] }),
    ['elderThingHollow'])
  behavior.afterTest(state, inv, { success: false, drawn: ['elderthing'], cancelledTokens: [] }, api)
  assert.equal(isHollowed(state, '01002'), true)
  assert.equal(inv.hand.includes('01002'), false)
  assert.deepEqual(withoutATraceAfterTest(state, inv, { success: true, drawn: ['elderthing'], cancelledTokens: [] }), [])
})

// ---------------------------------------------------------------------------
// 5. 幕 / 议程
// ---------------------------------------------------------------------------
test('P7 withoutATrace 幕 1：域外来客之巢揭示触发推进与背面（拟态克星、弃牌堆空洞、红手套男子）', () => {
  const { state, api } = setupState(2)
  const flags = withoutATraceFlags(state)
  // 幕 1 目标：巢被揭示。
  const lairId = OTHERWORLD_LOCATION_IDS.includes(flags.shadows.left) ? flags.shadows.left : OUTSIDERS_LAIR_ID
  state.locations.push({ ...LOCATIONS.outsidersLair, id: OUTSIDERS_LAIR_ID, revealed: false, clues: 0, connections: [START_LOCATION] })
  byId(state, START_LOCATION).connections = [OUTSIDERS_LAIR_ID]
  assert.equal(behavior.checkObjectives(state, api), false, '未揭示不推进')
  byId(state, OUTSIDERS_LAIR_ID).revealed = true
  behavior.locationRevealed(state, byId(state, OUTSIDERS_LAIR_ID), api)
  // 引擎 advanceAct 会先 actReveal（背面）再 +1。
  assert.equal(state.actIndex, 1, '幕 1 推进到幕 2')
  assert.equal(flags.mimeticSpawned, true)
  const mimetic = state.enemies.find(enemy => enemy.code === RAW_CODES.mimeticNemesis)
  assert.ok(mimetic, '背面在域外来客之巢生成拟态克星')
  assert.equal(mimetic.exhausted, true, '以横置状态生成')
  assert.equal(mimetic.location, OUTSIDERS_LAIR_ID)
  // 每位调查员弃牌堆 2 张非弱点卡 → 空洞。
  state.investigators[0].discard = ['01001', '01002', '01003']
  const { state: fresh, api: freshApi } = setupState(2)
  fresh.investigators[0].discard = ['01001', '01002', '01003']
  ACT_BACK_HANDLERS[RAW_CODES.act1](fresh, freshApi)
  assert.equal(hollowCount(fresh, { scope: 'investigator', seat: 0 }), 3, '2 张弃牌 + 全队共享的红手套男子')
  assert.equal(hollowCards(fresh).filter(card => card.scope === 'investigator' && card.seat === 0).length, 2)
  assert.equal(isHollowed(fresh, '01001'), true)
  // 红手套男子与其它空洞放在一起（全队所有）。
  assert.equal(isHollowed(fresh, RAW_CODES.redGlovedMan), true)
  assert.equal(redGlovedManIsHollow(fresh), true)
  assert.equal(setAsideHollows(fresh).some(card => card.code === RAW_CODES.redGlovedMan), true)
  void lairId
})

test('P7 withoutATrace 幕 2：红手套男子入场推进；域外来客之巢 [fast] 在唯一空洞时放入场', () => {
  const { state, api } = setupState(2)
  state.actIndex = 1
  const flags = withoutATraceFlags(state)
  // 只有红手套男子是唯一放一边的空洞。
  hollowCard(state, { code: RAW_CODES.redGlovedMan, source: RAW_CODES.act1, scope: 'team' })
  assert.equal(setAsideHollowCount(state), 1)
  // 巢入场并把一位调查员放在那里。
  state.locations.push({ ...LOCATIONS.outsidersLair, id: OUTSIDERS_LAIR_ID, revealed: true, clues: 2, connections: [START_LOCATION] })
  const inv = state.investigators[0]
  inv.location = OUTSIDERS_LAIR_ID
  const moves = behavior.actions(state, inv)
  const summon = moves.find(move => move.rule === 'lairSummonRedGlovedMan')
  assert.ok(summon, '巢的 [fast] 行动必须出现')
  assert.equal(summon.reason, null)
  assert.equal(behavior.performAction(state, inv, summon, api), true)
  assert.equal(flags.redGlovedManInPlay, true)
  assert.equal(state.actIndex, 2, '红手套男子入场 → 幕 2 推进到幕 3')
  assert.ok(inv.assets.some(asset => asset.code === RAW_CODES.redGlovedMan))
  // 空洞已被取走（不再算放一边的空洞）。
  assert.equal(isHollowed(state, RAW_CODES.redGlovedMan), false)
  assert.equal(setAsideHollowCount(state), 0)
  // 不是唯一空洞时给不可用原因。
  hollowCard(state, { code: '01001', source: RAW_CODES.act1, scope: 'investigator', seat: 1 })
  const again = behavior.actions(state, inv).find(move => move.rule === 'lairSummonRedGlovedMan')
  assert.ok(again.reason, '不是唯一空洞时必须给出原因')
})

test('P7 withoutATrace 幕 2 正面：花 1 线索对同地点拟态克星造成 2 点伤害', () => {
  const { state, api } = setupState(2)
  state.actIndex = 1
  const inv = state.investigators[0]
  const mimetic = api.spawn(RAW_CODES.mimeticNemesis, inv.location)
  inv.clues = 2
  const move = behavior.actions(state, inv).find(item => item.rule === 'act2StrikeMimetic')
  assert.ok(move)
  assert.equal(move.reason, null)
  behavior.performAction(state, inv, move, api)
  assert.equal(inv.clues, 1, '花费 1 个线索')
  assert.equal(mimetic.damageTaken, 2)
  // 没有线索时给不可用原因。
  inv.clues = 0
  const blocked = behavior.actions(state, inv).find(item => item.rule === 'act2StrikeMimetic')
  assert.match(blocked.reason, /需要 1 个线索/)
})

test('P7 withoutATrace 议程 1 背面：洗回天启噩兆+原生质重组者，并共同选择两项', () => {
  const { state, api } = setupState(2)
  const agenda = state.agendas[0]
  state.scenarioZones.setAside = [...SET_ASIDE_CODES]
  state.choices = ['damageAndHorror', 'shuffleConcealed']
  behavior.agendaReveal(state, agenda, api)
  assert.equal(state.encounterDeck.includes('09732'), true, '天启噩兆洗回遭遇牌库')
  assert.equal(state.encounterDeck.includes(RAW_CODES.protoplasmicReassembler), true)
  assert.equal(state.scenarioZones.setAside.includes('09732'), false)
  // 选项 1：每位调查员 1 伤害 1 恐惧。
  for (const inv of state.investigators) {
    assert.equal(inv.damage, 1)
    assert.equal(inv.horror, 1)
  }
  // 选项 2：混洗迷你卡（不增删、仍占同样的空位集合）。
  assert.equal(concealedMiniCards(state).length, 4)
})

test('P7 withoutATrace 议程 3 背面：未撤退的调查员发疯；有撤退者推进到幕 3 背面（结局分派）', () => {
  const { state, api } = setupState(2)
  const agenda = state.agendas[2]
  behavior.agendaReveal(state, agenda, api)
  assert.equal(state.finished, 'noResolution', '没人撤退 → 全部发疯、无结局')
  for (const inv of state.investigators) assert.equal(inv.defeated, true)
  // 有撤退者：立即进入幕 3 背面的结局分派（红手套男子在胜利区 → 结局 2）。
  const second = setupState(2)
  second.state.investigators[0].resigned = true
  second.state.victoryDisplay.push({ id: 'v1', code: RAW_CODES.redGlovedMan, originalCode: RAW_CODES.redGlovedMan })
  behavior.agendaReveal(second.state, second.state.agendas[2], second.api)
  assert.equal(second.state.finished, 'resolution2')
  assert.equal(second.state.investigators[0].resigned, true)
  assert.equal(second.state.investigators[0].defeated, false, '已撤退的调查员不发疯')
})

// ---------------------------------------------------------------------------
// 6. 逃生与结局
// ---------------------------------------------------------------------------
test('P7 withoutATrace 逃生：域外来客之廷撤退检定成功 → 撤退 + [[同谋]]支援加入胜利区', () => {
  const { state, api } = setupState(2)
  const inv = state.investigators[0]
  inv.assets.push({ id: 'aliki-asset', code: RAW_CODES.aliki, originalCode: RAW_CODES.aliki, exhausted: false })
  inv.assets.push({ id: 'rgm-asset', code: RAW_CODES.redGlovedMan, originalCode: RAW_CODES.redGlovedMan, exhausted: false })
  state.testResults = [{ success: true, value: 6, difficulty: 4 }]
  const move = behavior.actions(state, inv).find(item => item.rule === 'resignCourtOfTheOutsiders')
  assert.ok(move)
  behavior.performAction(state, inv, move, api)
  assert.equal(inv.resigned, true)
  assert.equal(inVictoryDisplay(state, RAW_CODES.aliki), true)
  assert.equal(inVictoryDisplay(state, RAW_CODES.redGlovedMan), true)
  assert.equal(inv.assets.length, 0, '同谋支援离开支援区')
  // 失败：本回合该检定 -1 难度（下一张候选的标签带 3）。
  const other = setupState(2)
  const inv2 = other.state.investigators[0]
  other.state.testResults = [{ success: false, value: 1, difficulty: 4 }]
  behavior.performAction(other.state, inv2, behavior.actions(other.state, inv2)
    .find(item => item.rule === 'resignCourtOfTheOutsiders'), other.api)
  assert.equal(inv2.resigned, false)
  assert.match(behavior.actions(other.state, inv2).find(item => item.rule === 'resignCourtOfTheOutsiders').label, /\(3\)/)
})

test('P7 withoutATrace 幕 3 目标与背面的结局分派：全部撤退 → R1–R4', () => {
  const { state, api } = setupState(2)
  state.actIndex = 2
  // 还有活着的调查员 → 不推进。
  assert.equal(behavior.checkObjectives(state, api), false)
  for (const inv of state.investigators) inv.resigned = true
  behavior.checkObjectives(state, api)
  // 两人都不在胜利区 → 结局 4。
  assert.equal(state.finished, 'resolution4')
  assert.equal(state.actIndex, 3)
  // 结局分派表。
  const check = (codes, expected) => {
    const local = setupState(1).state
    for (const code of codes) local.victoryDisplay.push({ id: code, code, originalCode: code })
    assert.equal(resolutionFromVictory(local), expected)
  }
  check([RAW_CODES.redGlovedMan, RAW_CODES.aliki], 'resolution1')
  check([RAW_CODES.redGlovedMan], 'resolution2')
  check([RAW_CODES.aliki], 'resolution3')
  check([], 'resolution4')
})

test('P7 withoutATrace 结局结算：记录、奖励经验、记时间与启程节点', () => {
  const { state, api } = setupState(2)
  const before = mapTime(state)
  state.choices = ['SanJuan']
  const result = behavior.resolution(state, 'resolution1', [], api)
  assert.equal(result.bonus, 1)
  assert.equal(result.award, true)
  assert.equal(state.campaign.records.theCellKnowsTheTrueNatureOfTheCoterie, true)
  assert.equal(state.campaign.records.alikiIsOnYourSide, true)
  assert.equal(state.campaign.records.time, before + 3, '结局 1 记 3 时间')
  assert.equal(mapTime(state), before + 3, '时间同步到世界地图')
  assert.equal(state.campaign.tsk.map.current, 'SanJuan', '启程节点')
  assert.equal(withoutATraceFlags(state).embarkFrom, 'SanJuan')
  // 结局 4：记 1 时间 + 恩怨未了。
  const second = setupState(2)
  behavior.resolution(second.state, 'resolution4', [], second.api)
  assert.equal(second.state.campaign.records.youHaventSeenTheLastOfAlikiZoniUperetria, true)
  assert.equal(second.state.campaign.records.time, mapTime(second.state))
})

test('P7 withoutATrace 失败路线：所有调查员被击败时结束为 noResolution', () => {
  const { state, api } = setupState(1)
  for (const inv of state.investigators) inv.defeated = true
  assert.equal(behavior.allResigned(state, api), true)
  assert.equal(state.finished, 'noResolution')
  assert.equal(behavior.finalResolution(state), 'noResolution')
})

// ---------------------------------------------------------------------------
// 7. 进入未揭示地点的额外费用
// ---------------------------------------------------------------------------
test('P7 withoutATrace 额外费用：线索不足时 moveError 拒绝；进入后由出发点团队共同支付', () => {
  const { state, api } = setupState(2)
  // 一张未揭示的异界地点与起点相邻。
  const inv = state.investigators[0]
  api.mechanics.placeLocation('ramblingRouteA')
  const target = byId(state, 'ramblingRouteA')
  target.connections = [START_LOCATION]
  byId(state, START_LOCATION).connections = ['ramblingRouteA']
  assert.equal(target.revealed, false)
  assert.match(behavior.moveError(state, inv, target), /共同花费 2 个线索/)
  for (const other of state.investigators) other.location = START_LOCATION
  state.investigators[0].clues = 1
  state.investigators[1].clues = 1
  assert.equal(behavior.moveError(state, inv, target), null)
  // 进入（模拟引擎顺序：reveal → locationEntered → beforeMove → locationLeft）。
  target.revealed = true
  state.lastLocationRevealed = { id: target.id, round: state.round, turnSerial: state.turnSerial }
  inv.location = target.id
  behavior.locationEntered(state, inv, target, api)
  behavior.locationLeft(state, inv, byId(state, START_LOCATION), api)
  assert.equal(state.investigators[0].clues, 0)
  assert.equal(state.investigators[1].clues, 0)
  // 已揭示的地点不再收费。
  assert.equal(behavior.moveError(state, inv, target), null)
})

// ---------------------------------------------------------------------------
// 8. 敌人与[[同谋]]支援
// ---------------------------------------------------------------------------
test('P7 withoutATrace 拟态克星：伤害改为弃掉等量放一边的空洞（不造成伤害）', () => {
  const { state, api } = setupState(1)
  for (const code of ['01001', '01002', '01003']) {
    hollowCard(state, { code, source: 'test', scope: 'investigator', seat: 0 })
  }
  hollowCard(state, { code: RAW_CODES.redGlovedMan, source: RAW_CODES.act1, scope: 'team' })
  const mimetic = api.spawn(RAW_CODES.mimeticNemesis, START_LOCATION)
  assert.equal(enemyRuleFor(RAW_CODES.mimeticNemesis).insteadOfDamageHollows, true)
  assert.equal(behavior.enemyDamageAmount(state, mimetic, 2, api), 0, '伤害被替换为 0')
  assert.equal(setAsideHollowCount(state), 2, '弃掉 2 张（红手套男子不被弃，剩 1 张个人空洞 + 红手套男子）')
  assert.equal(setAsideHollows(state).some(card => card.code === RAW_CODES.redGlovedMan), true)
  // 轮末强制：手牌空洞化。
  state.investigators[0].location = START_LOCATION
  state.investigators[0].hand = ['01005', '01006']
  state.choices = ['01005']
  const results = behavior.roundEnded(state, api)
  assert.equal(results.length, 1)
  assert.equal(isHollowed(state, '01005'), true)
})

test('P7 withoutATrace 原生质重组者：敌军阶段结束时把最近调查员牌库顶卡生成魔像（记为空洞）', () => {
  const { state, api } = setupState(1)
  api.mechanics.placeLocation('cliffsOfInsanityA')
  const reassembler = api.spawn(RAW_CODES.protoplasmicReassembler, 'cliffsOfInsanityA')
  reassembler.exhausted = false
  const inv = state.investigators[0]
  inv.location = START_LOCATION
  const top = inv.deck[inv.deck.length - 1]
  const result = behavior.enemyPhaseEnd(state, api)
  assert.equal(result.golem, top)
  assert.equal(inv.deck.includes(top), false, '牌库顶卡被移出')
  assert.equal(isHollowed(state, top), true, '魔像记为放在一边的空洞')
  assert.equal(withoutATraceFlags(state).golems.length, 1)
  // 横置时不生成。
  reassembler.exhausted = true
  assert.equal(behavior.enemyPhaseEnd(state, api), null)
})

test('P7 withoutATrace 同谋支援：红手套男子的命中反应、艾里奇揭露后回收空洞', () => {
  const { state, api } = setupState(2)
  const inv = state.investigators[0]
  inv.assets.push({ id: 'rgm', code: RAW_CODES.redGlovedMan, originalCode: RAW_CODES.redGlovedMan, exhausted: false })
  const outsider = api.spawn('09731', inv.location)
  assert.equal(assetRuleFor(RAW_CODES.redGlovedMan).outsiderSuccessReaction.by, 2)
  state.lastTestResult = { success: true, value: 5, difficulty: 3, successBy: 2 }
  behavior.enemyAttackedSuccessfully(state, inv, outsider, api)
  assert.equal(inv.assets.find(asset => asset.code === RAW_CODES.redGlovedMan).exhausted, true)
  assert.equal(outsider.damageTaken, 1)
  assert.equal(inv.clues, 1, '发现 1 个线索')
  // 只超过 1 点不触发。
  const second = setupState(1)
  const inv2 = second.state.investigators[0]
  inv2.assets.push({ id: 'rgm2', code: RAW_CODES.redGlovedMan, originalCode: RAW_CODES.redGlovedMan, exhausted: false })
  const enemy2 = second.api.spawn('09731', inv2.location)
  second.state.lastTestResult = { success: true, value: 4, difficulty: 3, successBy: 1 }
  assert.equal(behavior.enemyAttackedSuccessfully(second.state, inv2, enemy2, second.api), null)
  // 艾里奇：揭露后把一张空洞还给所有者。
  const inv3 = state.investigators[1]
  inv3.assets.push({ id: 'aliki', code: RAW_CODES.aliki, originalCode: RAW_CODES.aliki, exhausted: false })
  hollowCard(state, { code: '01009', source: 'test', scope: 'investigator', seat: 1 })
  const mini = concealedMiniCards(state).find(card => card.decoy)
  exposeMiniInShadows(state, inv3, mini.id, api)
  assert.equal(hollowCards(state).some(card => card.code === '01009'), false)
  assert.equal(inv3.hand.includes('01009'), true, '空洞回到所有者手中')
  // 序章吹哨时艾里奇已由第一位调查员控制：被横置的是她（同一张卡只结算一次）。
  assert.equal(state.investigators[0].assets.find(asset => asset.code === RAW_CODES.aliki).exhausted, true)
})

test('P7 withoutATrace 幕 3 正面：域外敌人失去冷漠（与调查员同地点时自动交战）', () => {
  const { state, api } = setupState(1)
  state.actIndex = 2
  const inv = state.investigators[0]
  inv.location = START_LOCATION
  const outsider = api.spawn('09731', START_LOCATION)
  outsider.engagedSeat = null
  behavior.phaseBegan(state, 'enemy', api)
  assert.equal(outsider.engagedSeat, 0)
})

// ---------------------------------------------------------------------------
// 9. 单卡条目
// ---------------------------------------------------------------------------
test('P7 withoutATrace 单卡条目：四张专属卡的规则数据可读且被 behavior 读点接线', () => {
  assert.deepEqual(CHAPTER_ENTRY_CODES, [
    RAW_CODES.mimeticNemesis, RAW_CODES.protoplasmicReassembler, RAW_CODES.redGlovedMan, RAW_CODES.aliki,
  ])
  for (const code of CHAPTER_ENTRY_CODES) {
    const entry = registeredEntry(code)
    assert.ok(entry, `${code} 必须已登记`)
    assert.equal(entry.code, code)
    assert.equal(entry.implemented, true)
  }
  assert.equal(registeredEntry(RAW_CODES.mimeticNemesis).scope, 'enemy')
  assert.equal(registeredEntry(RAW_CODES.protoplasmicReassembler).scope, 'enemy')
  assert.equal(registeredEntry(RAW_CODES.redGlovedMan).scope, 'storyAsset')
  assert.equal(registeredEntry(RAW_CODES.aliki).scope, 'storyAsset')
  assert.equal(enemyRuleFor(RAW_CODES.mimeticNemesis).roundEndHollowOrAttack, true)
  assert.equal(enemyRuleFor(RAW_CODES.protoplasmicReassembler).golemSpawn, true)
  assert.equal(registeredEntry(RAW_CODES.protoplasmicReassembler).spawnFarthestFromAll, true)
  assert.equal(assetRuleFor(RAW_CODES.aliki).exposeRecallHollow, true)
  // 条目里的数值被读点使用（不是死声明）。
  const { state, api } = setupState(1)
  hollowCard(state, { code: '01001', source: 'test', scope: 'investigator', seat: 0 })
  behavior.enemyDamageAmount(state, api.spawn(RAW_CODES.mimeticNemesis, START_LOCATION), 1, api)
  assert.equal(setAsideHollowCount(state), 0)
  // 共享遭遇（本章没有专属诡计）接回条目/声明式检定的读点仍然可用。
  assert.equal(encounterResolveFor(RAW_CODES.scenario), null)
})

// ---------------------------------------------------------------------------
// 10. JSON 往返
// ---------------------------------------------------------------------------
test('P7 withoutATrace JSON 存档往返：异界牌库/阴影/空位/空洞/台账可序列化复原', () => {
  const { state, api } = setupState(2)
  // 横置艾里奇：本用例只验证影子地点的揭露，不掺入「揭露后回收空洞」。
  for (const inv of state.investigators) {
    for (const asset of inv.assets || []) if (asset.code === RAW_CODES.aliki) asset.exhausted = true
  }
  hollowCard(state, { code: '01001', source: RAW_CODES.act1, scope: 'investigator', seat: 0 })
  const mini = miniFor(state, 'left')
  exposeMiniInShadows(state, state.investigators[0], mini.id, api)
  state.actIndex = 1
  const restored = JSON.parse(JSON.stringify(state))
  assert.deepEqual(restored.scenarioFlags.withoutATrace, state.scenarioFlags.withoutATrace)
  assert.deepEqual(restored.scenarioFlags.mechanics, state.scenarioFlags.mechanics)
  assert.deepEqual(restored.scenarioZones, state.scenarioZones)
  assert.equal(restored.actIndex, 1)
  assert.equal(restored.locations.length, state.locations.length)
  // 复原后同一套原语继续读写。
  assert.equal(otherworldDeckSize(restored), otherworldDeckSize(state))
  assert.equal(concealedMiniCards(restored).length, concealedMiniCards(state).length)
  assert.equal(setAsideHollowCount(restored), setAsideHollowCount(state))
  assert.equal(isHollowed(restored, '01001'), true)
  assert.equal(mapTime(restored), mapTime(state))
  assert.equal(withoutATraceFlags(restored).version, 1)
  // 阴影表与迷你卡空位都还在。
  for (const position of SHADOW_POSITIONS) {
    assert.equal(withoutATraceFlags(restored).shadows[position], withoutATraceFlags(state).shadows[position])
  }
  for (const card of concealedMiniCards(restored)) {
    const spot = miniSpotOf(restored, card)
    assert.ok(spot && Number.isInteger(spot.x) && Number.isInteger(spot.y))
  }
})
