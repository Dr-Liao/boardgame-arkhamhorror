// 疯星乱舞（dancingMad · 09591）章节测试（P7）。
//
// 三层证据：
//   1. 章节数据 —— manifest/身份/幕与议程/遭遇牌库/正文可读；
//   2. 章节钩子（behavior）—— 两种布置版本、交涉潜入↔战斗警报切换、隐匿迷你卡与阴影敌人、
//      地点能力、幕/议程正反面与推进、投入卡空洞化与回收、结局记录、JSON 存档往返；
//   3. 单卡条目 —— 四张专属卡（09606a/09607a/09607b/09608）登记后规则数据可读、可执行。
//
// 索引由 Lead 合并后重建，因此本测试用动态 import + registerCardAbilities 显式登记本章条目
// （已登记则跳过），使 behavior 里的 enemyRule/assetRule/encounterResolve 读点生效。
import test from 'node:test'
import assert from 'node:assert/strict'
import { registerCardAbilities, registeredEntry } from '../src/engine/ability.js'
import { enemyRuleFor, encounterResolveFor } from '../src/cards/card-rules.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { ALL_RECORD_KEYS } from '../content/campaigns/theScarletKeys/records.js'
import {
  concealedAt, concealedMiniCards, distributeConcealed, exposeMiniCard, isInShadows, placeMiniCard,
  reshuffleConcealed, setInShadows,
} from '../src/engine/tsk-concealed.js'
import {
  eraseFromExistence, erasedFromExistence, hollowCard, hollowCards, hollowCount, isHollowed, recallHollow,
} from '../src/engine/tsk-hollow.js'
import { bindKey, initializeScarletKeys, keyFace, scarletKey } from '../src/engine/tsk-scarlet-keys.js'
import { mapTime } from '../src/engine/tsk-map.js'
import * as chapter from '../content/campaigns/theScarletKeys/scenarios/dancingMad/index.js'
import {
  ACT_VARIANTS, AGENDA_HOLLOW_THRESHOLDS, CAFE_LUNA_FACES, CHAPTER_ENTRY_CODES, DEAL_SET_ASIDE_DECK_CODES,
  LOCATIONS, RAW_CODES, RECORD_READS, RECORD_WRITES, SET_ASIDE_CODES, SET_ASIDE_LOCATION_IDS, START_LOCATION,
  TIME_THRESHOLD, concealedXOf, enemies, identities, linkedLocationIds, scenario,
} from '../content/campaigns/theScarletKeys/scenarios/dancingMad/definition.js'
import {
  DANCING_MAD_TOKEN_MEANINGS, dancingMadAfterTest, dancingMadChaosToken,
} from '../content/campaigns/theScarletKeys/scenarios/dancingMad/chaos.js'
import {
  ACT_BACK_HANDLERS, behavior, concealEnemy, concealedMiniSet, dancingMadFlags, decoysInPlay, enemiesInShadows,
  markAlert, setAsideHollowCount, setAsideHollows,
} from '../content/campaigns/theScarletKeys/scenarios/dancingMad/behavior.js'

const ENTRIES = []
for (const code of CHAPTER_ENTRY_CODES) {
  const module = await import(`../src/cards/encounter-entries/theScarletKeys/dancingMad/${code}.js`)
  ENTRIES.push(module.default)
}
for (const entry of ENTRIES) if (!registeredEntry(entry.code)) registerCardAbilities(entry)

const clone = value => structuredClone(value)
const traitsOf = code => [...(ALL_CARDS[code]?.traits || [])]

// ---------------------------------------------------------------------------
// 状态 / api 夹具（场景运行时的窄替身：所有写入都走同一个 api 面）
// ---------------------------------------------------------------------------
function stateFor(count = 2, { time = 2 } = {}) {
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
    currentSeat: 0,
    status: 'playing',
    doom: 0,
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
    scenarioZones: {},
    scenarioFlags: {},
    campaign: {
      records: {},
      tsk: { map: { version: 1, current: 'Havana', visited: ['Havana'], unlocked: ['Havana'], time, forcedNode: 'Tunguska' } },
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
    decideSeat: () => 0,
    test: (seat, skill, difficulty, resolve, skillBonus = 0, source = null, options = {}) => {
      let callback = resolve
      if (callback && typeof callback === 'object') { options = callback; callback = callback.resolve }
      const result = state.testResults.shift()
        || { success: true, value: difficulty + 1, difficulty, successBy: 1, failedBy: 0, drawn: [], cancelledTokens: [] }
      const full = { successBy: Math.max(0, (result.value ?? difficulty + 1) - difficulty), failedBy: 0, ...result }
      if (typeof callback === 'function') callback(full)
      else options?.resolve?.(full)
      return full
    },
    spawn: (code, location, options = {}) => {
      const enemy = {
        id: `enemy-${code}-${state.enemies.length + 1}`, code, originalCode: code,
        location, engagedSeat: options.engagedSeat ?? null, exhausted: options.exhausted === true,
        damageTaken: 0, doom: 0, clues: 0, health: ALL_CARDS[code]?.health ?? 1,
      }
      state.enemies.push(enemy)
      return enemy
    },
    spawnEngaged: (code, location, seat) => {
      const enemy = {
        id: `enemy-${code}-${state.enemies.length + 1}`, code, originalCode: code,
        location, engagedSeat: seat, exhausted: false, damageTaken: 0, doom: 0, clues: 0,
        health: ALL_CARDS[code]?.health ?? 1,
      }
      state.enemies.push(enemy)
      return enemy
    },
    harm: (seat, amount = {}) => {
      const inv = state.investigators[seat]
      inv.damage += amount.damage || 0
      inv.horror += amount.horror || 0
    },
    removeAsset: (seat, assetId) => {
      const inv = state.investigators[seat]
      const before = inv.assets.length
      inv.assets = inv.assets.filter(asset => String(asset.id) !== String(assetId))
      return inv.assets.length < before
    },
    resume: () => {},
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
    place: id => {
      if (state.locations.some(location => location.id === id)) return false
      state.locations.push(makeLocation(state, id))
      return true
    },
    takeEncounterCard: code => {
      const index = state.encounterDeck.lastIndexOf(code)
      if (index >= 0) { state.encounterDeck.splice(index, 1); return { pile: 'encounterDeck' } }
      const inDiscard = state.encounterDiscard.lastIndexOf(code)
      if (inDiscard >= 0) { state.encounterDiscard.splice(inDiscard, 1); return { pile: 'encounterDiscard' } }
      return null
    },
    shuffleIntoEncounterDeck: (codes, options = {}) => {
      state.encounterDeck.push(...(Array.isArray(codes) ? codes : [codes]).filter(Boolean))
      if (options.shuffle !== false) state.encounterDeck.sort()
      return state.encounterDeck.length
    },
    discardUntilEnemy: (seat, predicate) => {
      const discarded = []
      while (state.encounterDeck.length) {
        const code = state.encounterDeck.pop()
        if (ALL_CARDS[code]?.type === 'enemy' && predicate(ALL_CARDS[code], code)) {
          state.encounterDiscard.push(...discarded)
          return code
        }
        discarded.push(code)
      }
      state.encounterDiscard.push(...discarded)
      return null
    },
    mechanics: {
      tsk: {
        concealed: {
          miniCards: () => concealedMiniCards(state),
          at: (id, position) => concealedAt(state, id, position),
          inShadows: id => isInShadows(state, id),
          setInShadows: (id, value) => setInShadows(state, id, value),
          place: spec => placeMiniCard(state, spec),
          distribute: spec => distributeConcealed(state, spec),
          expose: id => exposeMiniCard(state, id),
          reshuffle: options => reshuffleConcealed(state, options),
        },
        hollow: {
          cards: () => hollowCards(state),
          hollow: spec => hollowCard(state, spec),
          count: options => hollowCount(state, options),
          isHollowed: code => isHollowed(state, code),
          recall: (code, options) => recallHollow(state, code, options),
          erase: codes => eraseFromExistence(state, codes),
          erased: () => erasedFromExistence(state),
          isErased: code => erasedFromExistence(state).includes(code),
        },
        keys: {
          bind: (id, bearer) => bindKey(state, id, bearer),
          get: id => scarletKey(state, id),
          face: id => keyFace(state, id),
        },
        map: { time: () => mapTime(state) },
      },
    },
    ...overrides,
  }
  return api
}

// 与引擎 placeLocation 同口径：合并 locationVariants、按人数换算线索、起点已揭示。
function makeLocation(state, id) {
  const base = state.scenario.locations[id] || LOCATIONS[id]
  const def = { ...base, ...(state.locationVariants?.[id] || {}) }
  const clues = def.cluesFixed ?? (def.cluesPerInvestigator != null
    ? def.cluesPerInvestigator * state.numInvestigators : (def.clues || 0))
  const revealed = state.investigators.some(inv => inv.location === id)
  return { ...def, id, revealed, clues: revealed ? clues : 0, maxClues: clues, connections: [...(def.connections || [])] }
}

function setupState(count = 2, { time = 2 } = {}) {
  const state = stateFor(count, { time })
  const api = apiFor(state)
  behavior.preScenarioSetup(state, [], api)
  const placed = behavior.setupLocations(state, [], { info: () => {}, api })
  for (const id of placed) state.locations.push(makeLocation(state, id))
  // 引擎在 afterDeckSetup 之前已经把整副遭遇牌库洗好放进 state.encounterDeck。
  state.encounterDeck = [...scenario.encounterDeck]
  behavior.afterDeckSetup(state, [], { info: () => {}, api, shuffle: list => list, randomValue: () => 0.5 })
  return { state, api }
}

const byCode = (state, code) => state.locations.find(location => location.originalCode === code)

// ---------------------------------------------------------------------------
// 1. 章节数据 / manifest / 正文
// ---------------------------------------------------------------------------
test('P7 dancingMad 章节清单：playable、六处地点、幕/议程/结局与正文可读', () => {
  assert.equal(chapter.manifest.id, 'dancingMad')
  assert.equal(chapter.manifest.campaignId, 'theScarletKeys')
  assert.equal(chapter.manifest.status, 'playable')
  assert.equal(chapter.manifest.referenceCode, '09591')
  assert.equal(chapter.scenario.originalCode, '09591')
  assert.equal(chapter.manifest.locations.length, 6)
  assert.deepEqual(chapter.manifest.acts.map(act => act.id), ['act1', 'act2', 'act3'])
  assert.deepEqual(chapter.manifest.agendas.map(agenda => agenda.id), ['agenda1', 'agenda2', 'agenda3'])
  assert.deepEqual(chapter.manifest.resolutionIds, ['noResolution', 'resolution1', 'resolution2'])
  assert.equal(chapter.manifest.startLocationId, START_LOCATION)
  // 正文可读（不锁具体译文：story-text 是生成物）。
  assert.ok(chapter.scenario.intro.length > 200, '序章正文可读')
  assert.ok(chapter.scenario.setup.length > 20, '布置正文可读')
  assert.match(chapter.scenario.specialRules, /隐匿/)
  assert.ok(chapter.scenario.resolutions.resolution1.length > 20, '结局 1 正文可读')
  // 生成物里的 HTML 片段必须被去掉（剧本书不展示标签）。
  assert.doesNotMatch(chapter.scenario.setup, /<p|<section|class=/)
})

test('P7 dancingMad 身份登记：地点/幕/议程/敌人/诡计/剧情资产都有原卡身份', () => {
  for (const category of ['locations', 'acts', 'agendas', 'enemies', 'treacheries', 'storyAssets']) {
    for (const [id, identity] of Object.entries(identities[category] || {})) {
      assert.ok(identity.originalCode, `${category}/${id} 缺少 originalCode`)
    }
  }
  assert.equal(identities.locations.cafeLuna.originalCode, RAW_CODES.cafeLunaBastion)
  assert.equal(identities.locations.cafeLuna.linkedOriginalCode, RAW_CODES.cafeLunaHaunt)
  assert.equal(identities.enemies[RAW_CODES.desiderioEncounter].originalCode, RAW_CODES.desiderioEncounter)
})

test('P7 dancingMad 记录键：读写键都在战役记录 schema 里（注册与 schema 校验前置）', () => {
  for (const key of [...RECORD_READS, ...RECORD_WRITES]) {
    assert.ok(ALL_RECORD_KEYS.includes(key), `记录键 ${key} 不在战役 records.js 的 schema`)
  }
  // 存在抹除：布尔复选框（erasedFromExistence）+ 卡名数组（erasedCards）两个键都在 schema 里。
  assert.ok(ALL_RECORD_KEYS.includes('erasedFromExistence'))
  assert.ok(ALL_RECORD_KEYS.includes('erasedCards'))
})

test('P7 dancingMad 地点连接：印刷符号推导（双向任一）与月下餐厅两个面', () => {
  assert.deepEqual(linkedLocationIds('cafeLuna').sort(), ['elMalecon', 'jardinesDeLaTropical'])
  assert.deepEqual(linkedLocationIds('elMalecon').sort(),
    ['cafeLuna', 'jardinesDeLaTropical', 'miramarYachtClub'])
  assert.deepEqual(linkedLocationIds('granTeatroDeLaHabana').sort(),
    ['jardinesDeLaTropical', 'miramarYachtClub', 'plazaHotel'])
  // 连接是双向的（任一方向命中即连）。
  for (const [id, location] of Object.entries(LOCATIONS)) {
    for (const other of location.connections) {
      assert.ok(LOCATIONS[other].connections.includes(id), `${id} ↔ ${other} 必须双向`)
    }
  }
  assert.equal(CAFE_LUNA_FACES.bastion.shroud, 5)
  assert.equal(CAFE_LUNA_FACES.bastion.cluesPerInvestigator, 1)
  assert.equal(CAFE_LUNA_FACES.haunt.shroud, 3)
  assert.equal(CAFE_LUNA_FACES.haunt.cluesPerInvestigator, 2)
})

test('P7 dancingMad 遭遇牌库：v.II 全组 24 张；v.I 把扫荡团伙/猩红阴谋移出（13 张）', () => {
  const deck = scenario.encounterDeck
  assert.equal(deck.length, 24)
  assert.equal(deck.filter(code => code === RAW_CODES.bodySnatched).length, 2)
  for (const code of [RAW_CODES.desiderioEncounter, RAW_CODES.desiderioLinkedEnemy, ...SET_ASIDE_CODES]) {
    assert.ok(!deck.includes(code), `放一边的卡不应在遭遇牌库：${code}`)
  }
  assert.ok(DEAL_SET_ASIDE_DECK_CODES.length > 0)
  assert.equal(deck.length - DEAL_SET_ASIDE_DECK_CODES.length, 13, 'v.I 裁剪后剩 13 张')
  // 09608 的显现必须交给章节 behavior（否则真实遭遇零结算）。
  assert.deepEqual(scenario.treacheries[RAW_CODES.bodySnatched].effect, { kind: 'campaignRule' })
  assert.equal(scenario.treacheries[RAW_CODES.bodySnatched].entryRevelation, true)
})

// ---------------------------------------------------------------------------
// 2. 布置：v.I 交涉潜入 / v.II 战斗警报
// ---------------------------------------------------------------------------
test('P7 dancingMad setup v.I（交涉潜入）：六处地点入场、月下餐厅追忆堡垒面、德西剧情资产', () => {
  const { state } = setupState(2, { time: 5 })
  const flags = dancingMadFlags(state)
  assert.equal(flags.mode, 'deal')
  assert.equal(flags.version, 1)
  assert.equal(flags.stance, 'infiltration')
  assert.equal(state.acts[0].originalCode, RAW_CODES.act1v1)
  assert.equal(state.acts[1].originalCode, RAW_CODES.act2v1)
  assert.equal(state.campaign.records.theCellMadeADealWithDesi, true)
  assert.equal(state.locations.length, 6)
  const cafe = state.locations.find(location => location.id === START_LOCATION)
  assert.equal(cafe.originalCode, RAW_CODES.cafeLunaBastion)
  assert.equal(cafe.shroud, 5)
  assert.equal(cafe.clues, 2, '每人 1 个线索 × 2 人')
  assert.equal(cafe.revealed, true, '起点地点开局揭示')
  // 德西剧情资产由一位调查员控制。
  const holder = state.investigators.find(inv => inv.assets.some(asset => asset.code === RAW_CODES.desiderioAsset))
  assert.ok(holder, '德西剧情资产必须由一位调查员控制')
  assert.equal(holder.assets.find(asset => asset.code === RAW_CODES.desiderioAsset).health, 4)
  // 遭遇牌库裁掉扫荡团伙/猩红阴谋并放一边。
  assert.equal(state.encounterDeck.length, 13)
  for (const code of DEAL_SET_ASIDE_DECK_CODES) {
    assert.ok(state.scenarioZones.setAside.includes(code), `${code} 应放在一边（v.I）`)
  }
  // 其余五处地点也入场，且布置后有揭示队列。
  assert.deepEqual(state.scenarioFlags.dancingMad.pendingSetupReveals.sort(), SET_ASIDE_LOCATION_IDS.slice().sort())
})

test('P7 dancingMad setup v.II（战斗警报）：只有月下餐厅入场、结社据点面与阴影敌人', () => {
  const { state } = setupState(2, { time: TIME_THRESHOLD })
  const flags = dancingMadFlags(state)
  assert.equal(flags.mode, 'ambush')
  assert.equal(flags.version, 2)
  assert.equal(flags.stance, 'alert')
  assert.equal(state.acts[0].originalCode, RAW_CODES.act1v2)
  assert.equal(state.acts[1].originalCode, RAW_CODES.act2v2)
  assert.equal(state.campaign.records.theCellHasBeenAmbushed, true)
  assert.equal(state.locations.length, 1)
  const cafe = state.locations[0]
  assert.equal(cafe.id, START_LOCATION)
  assert.equal(cafe.originalCode, RAW_CODES.cafeLunaHaunt)
  assert.equal(cafe.shroud, 3)
  assert.equal(cafe.clues, 4, '每人 2 个线索 × 2 人')
  // 其余五处地点 + 两张德西 + 四张域外敌人放在一边。
  for (const id of SET_ASIDE_LOCATION_IDS) {
    assert.ok(state.scenarioZones.setAside.includes(LOCATIONS[id].originalCode), `${id} 应放在一边`)
  }
  for (const code of SET_ASIDE_CODES) assert.ok(state.scenarioZones.setAside.includes(code))
  // 阴影敌人：德西（1 真身 + 2 诱饵）+ 另一位调查员抽到的同志会敌人（1 真身 + 1 诱饵）。
  assert.equal(enemiesInShadows(state), 2)
  assert.equal(decoysInPlay(state), 3)
  assert.equal(concealedMiniCards(state).length, 5)
  // 布置时只有月下餐厅在场，迷你卡只能分配给它；幕 1 v.II 背面把地点放上场后重新平均分配。
  const shadowLocations = new Set(concealedMiniCards(state).map(card => card.locationId))
  assert.deepEqual([...shadowLocations], [START_LOCATION])
})

test('P7 dancingMad 潜入↔警报：揭露真身切 alert，谈判成功切回 infiltration', () => {
  const { state, api } = setupState(1, { time: TIME_THRESHOLD })
  assert.equal(dancingMadFlags(state).stance, 'alert')
  // 先谈判一条路径：把模式切回潜入。
  markAlert(state, false)
  assert.equal(dancingMadFlags(state).stance, 'infiltration')
  markAlert(state, true)
  assert.equal(dancingMadFlags(state).stance, 'alert')
  // 揭露一张诱饵不改变模式；揭露真身保持警报并生成敌人。
  const inv = state.investigators[0]
  const decoy = concealedMiniCards(state).find(card => card.decoy)
  assert.ok(decoy, '布置后应该有诱饵迷你卡')
  inv.location = decoy.locationId
  const before = enemiesInShadows(state)
  behavior.exposeMiniCard(state, inv, decoy.id, api)
  assert.equal(enemiesInShadows(state), before, '诱饵不减少阴影中的敌人数量（露出的不是真身）')
  assert.equal(state.enemies.length, 0, '诱饵不生成敌人')
  const real = concealedMiniCards(state).find(card => !card.decoy)
  inv.location = real.locationId
  const exposed = behavior.exposeMiniCard(state, inv, real.id, api)
  assert.equal(exposed.decoy, false)
  assert.ok(exposed.enemy, '揭露真身必须生成敌人')
  assert.equal(state.enemies.length, 1)
  assert.equal(dancingMadFlags(state).lastExposed.kind, 'DesiderioDelgadoAlvarez')
  assert.equal(dancingMadFlags(state).stance, 'alert')
})

// ---------------------------------------------------------------------------
// 3. 地点
// ---------------------------------------------------------------------------
test('P7 dancingMad 地点：月下餐厅隐藏值/补线索、大剧院快速行动、广场酒店查看、热带花园回收', () => {
  const { state, api } = setupState(2, { time: 5 })
  const cafe = state.locations.find(location => location.id === START_LOCATION)
  // [[域外]] 敌人每个让隐藏值 -1。
  assert.equal(behavior.locationShroudModifier(state, cafe), 0)
  api.spawn('09734', START_LOCATION)
  assert.equal(behavior.locationShroudModifier(state, cafe), -1)
  // 月下餐厅没有线索时补到每人 1 个。
  cafe.clues = 0
  behavior.cluesRemoved(state, cafe, 1, api)
  assert.equal(cafe.clues, 2)
  // 大剧院：花 2 资源，隐藏值 -2（每回合一次）。
  const inv = state.investigators[0]
  inv.location = 'granTeatroDeLaHabana'
  inv.resources = 4
  const moves = behavior.actions(state, inv)
  assert.ok(moves.some(move => move.rule === 'granTeatroShroud'))
  behavior.performAction(state, inv, { rule: 'granTeatroShroud' }, api)
  assert.equal(inv.resources, 2)
  assert.equal(state.locations.find(location => location.id === 'granTeatroDeLaHabana').shroudMod, -2)
  assert.equal(behavior.performAction(state, inv, { rule: 'granTeatroShroud' }, api), false, '每回合一次')
  // 广场酒店：受 1 点恐惧查看迷你卡的已揭示面。
  inv.location = 'plazaHotel'
  const mini = placeMiniCard(state, { kind: 'Decoy', decoy: true, locationId: 'plazaHotel' })
  behavior.performAction(state, inv, { rule: 'plazaHotelLook' }, api)
  assert.equal(inv.horror, 1)
  assert.equal(concealedMiniCards(state).find(card => card.id === mini.id).known, true)
})

// ---------------------------------------------------------------------------
// 4. 幕 / 议程：正反面、目标、谈判与结局
// ---------------------------------------------------------------------------
test('P7 dancingMad 幕：两套正面、幕 1 v.I 背面放一边并隐匿、幕 3 谈判查看另一面', () => {
  assert.equal(ACT_VARIANTS.deal[0].originalCode, RAW_CODES.act1v1)
  assert.equal(ACT_VARIANTS.ambush[0].originalCode, RAW_CODES.act1v2)
  assert.equal(ACT_VARIANTS.deal[2].originalCode, RAW_CODES.act3, '幕 3 两套共用')
  const { state, api } = setupState(2, { time: 5 })
  const holder = state.investigators.find(inv => inv.assets.some(asset => asset.code === RAW_CODES.desiderioAsset))
  ACT_BACK_HANDLERS[RAW_CODES.act1v1](state, api)
  assert.equal(holder.assets.some(asset => asset.code === RAW_CODES.desiderioAsset), false, '剧情资产放一边')
  assert.ok(state.scenarioZones.setAside.includes(RAW_CODES.desiderioAsset))
  assert.ok(enemiesInShadows(state) >= 1, '幕 1 v.I 背面把德西放进阴影')
  assert.equal(state.scenarioZones.setAside.includes(RAW_CODES.desiderioAsset), true)
  for (const code of DEAL_SET_ASIDE_DECK_CODES) {
    assert.ok(!state.scenarioZones.setAside.includes(code), `${code} 应洗回遭遇牌库`)
  }
})

test('P7 dancingMad 幕目标：幕 2 v.II 敌人线索达标推进；幕 3 德西被击败推进；幕 3 谈判需要记录', () => {
  const { state, api } = setupState(2, { time: TIME_THRESHOLD })
  state.actIndex = 1
  state.enemies = []
  assert.equal(behavior.checkObjectives(state, api), false)
  api.place('elMalecon')
  api.spawn(RAW_CODES.desiderioEncounter, 'elMalecon')
  state.enemies[0].clues = 4 * state.numInvestigators
  assert.equal(behavior.checkObjectives(state, api), true)
  assert.equal(state.actIndex, 2, '线索达标后推进到幕 3')
  // 幕 3：谈判需要「特别小组知道了德西的过往」。
  const inv = state.investigators[0]
  inv.location = state.enemies[0].location
  let moves = behavior.actions(state, inv)
  const parley = moves.find(move => move.rule === 'parleyDesiderio')
  assert.ok(parley)
  assert.ok(parley.reason, '没有记录时给出不可用原因')
  state.campaign.records.theCellKnowsOfDesisPast = true
  moves = behavior.actions(state, inv)
  assert.equal(moves.find(move => move.rule === 'parleyDesiderio').reason, null)
  assert.equal(behavior.performAction(state, inv, { rule: 'parleyDesiderio', enemyId: state.enemies[0].id }, api), true)
  assert.equal(dancingMadFlags(state).desiderioOtherSideSeen, true)
  // 德西被击败 → 幕 3 目标达成。
  behavior.enemyDefeated(state, state.enemies[0], api)
  assert.equal(dancingMadFlags(state).desiderioDefeated, true)
  assert.equal(behavior.checkObjectives(state, api), true)
})

test('P7 dancingMad 议程：空洞阈值放毁灭、背面二选一（迷倪卡/牌库顶空洞）、第三张抹除', () => {
  const { state, api } = setupState(2, { time: 5 })
  assert.deepEqual(AGENDA_HOLLOW_THRESHOLDS.agenda1, { perInvestigator: 5, remove: 3 })
  // 放一边的空洞达到 5 × 2 = 10 张时移除 3 × 2 张并放 1 毁灭。
  for (let index = 0; index < 10; index += 1) {
    hollowCard(state, { code: `card${index}`, source: 'test', scope: 'investigator', seat: 0 })
  }
  assert.equal(behavior.agendaForced(state, 'roundEnd', api), true)
  assert.equal(state.doom, 1)
  assert.equal(setAsideHollowCount(state), 4)
  // 议程 1 背面：队长选择「揭示每位调查员牌库顶」→ 弱点进手牌、其它进空洞。
  state.choices = ['hollow']
  const before = state.investigators[0].deck.length
  behavior.agendaReveal(state, state.agendas[0], api)
  assert.ok(state.investigators[0].deck.length < before)
  // 议程 3 背面：每位调查员经验值最高的一张进存在抹除名单。
  state.choices = []
  state.agendas[2].backAction = 'erasure'
  behavior.agendaReveal(state, state.agendas[2], api)
  assert.equal(state.finished, 'resolution2')
  // 存在抹除：复选框置真，被放逐的卡名进 erasedCards（与战役 records.js 的 schema 对齐）。
  assert.equal(state.campaign.records.erasedFromExistence, true)
  assert.ok(Array.isArray(state.campaign.records.erasedCards))
  assert.ok(state.campaign.records.erasedCards.length > 0)
})

// ---------------------------------------------------------------------------
// 5. 阴影敌人 / 混乱标记
// ---------------------------------------------------------------------------
test('P7 dancingMad 阴影敌人：隐匿 X 张数、揭露生成、阴影计数与 [skull] 取值', () => {
  const { state } = setupState(3, { time: TIME_THRESHOLD })
  assert.deepEqual(concealedXOf(RAW_CODES.desiderioEncounter), { value: 1, perInvestigator: true, x: null })
  const set = concealedMiniSet(state, RAW_CODES.desiderioEncounter)
  assert.equal(set.cards.length, 4, '3 位调查员：真身 1 + 诱饵 3')
  assert.equal(set.cards.filter(card => card.decoy).length, 3)
  const coterie = concealedMiniSet(state, '09716a')
  assert.equal(coterie.cards.length, 3, 'Concealed 2：真身 1 + 诱饵 2')
  assert.equal(enemiesInShadows(state), 3)
  // [skull]：-X，X = 阴影中敌人数（简单/普通最多 3）。
  assert.deepEqual(dancingMadChaosToken(state, state.investigators[0], 'skull', { enemiesInShadows: () => 5 }), { delta: -3, rider: 'skullShadowCount', x: 3 })
  state.difficulty = 'hard'
  assert.deepEqual(dancingMadChaosToken(state, state.investigators[0], 'skull', { enemiesInShadows: () => 5 }), { delta: -5, rider: 'skullShadowCount', x: 5 })
  assert.deepEqual(dancingMadChaosToken(state, state.investigators[0], 'cultist'), { delta: -6, rider: 'decoyOnFail' })
  assert.deepEqual(dancingMadChaosToken(state, state.investigators[0], 'tablet'), { delta: -3, rider: 'hollowCommitted' })
  state.difficulty = 'standard'
  assert.deepEqual(dancingMadChaosToken(state, state.investigators[0], 'tablet'), { delta: -3, rider: 'hollowCommittedOnFail' })
  assert.equal(DANCING_MAD_TOKEN_MEANINGS.standard.skull.rider, 'skullShadowCount')
})

test('P7 dancingMad 符号后果：cultist 失败放诱饵、elderthing 本地有迷你卡时二选一', () => {
  const { state, api } = setupState(1, { time: TIME_THRESHOLD })
  const inv = state.investigators[0]
  inv.location = state.locations[0].id
  const before = concealedMiniCards(state).length
  assert.deepEqual(dancingMadAfterTest(state, inv, { success: false, drawn: ['cultist'], cancelledTokens: [] }), ['decoyOnFail'])
  behavior.afterTest(state, inv, { success: false, drawn: ['cultist'], cancelledTokens: [] }, api)
  assert.ok(concealedMiniCards(state).length > before, 'cultist 失败后多一张诱饵')
  assert.deepEqual(dancingMadAfterTest(state, inv, { success: true, drawn: ['cultist'], cancelledTokens: [] }), [], '成功不触发')
  // elderthing：本地有迷你卡 → 选择受到伤害。
  state.choices = ['damage']
  behavior.afterTest(state, inv, { success: false, drawn: ['elderthing'], cancelledTokens: [] }, api)
  assert.equal(inv.damage, 1)
})

// ---------------------------------------------------------------------------
// 6. 空洞化（投入卡）与回收
// ---------------------------------------------------------------------------
test('P7 dancingMad 空洞：投入卡在 [tablet] 失败后成为空洞，[tablet] 困难面不看失败', () => {
  const { state, api } = setupState(2, { time: 5 })
  const inv = state.investigators[0]
  inv.hand = ['01025', '01026']
  inv.discard = ['01025', '01026']
  const result = {
    success: false, drawn: ['tablet'], cancelledTokens: [],
    committed: [{ seat: 0, code: '01025', icons: ['intellect'] }, { seat: 0, code: '01026', icons: ['wild'] }],
  }
  assert.deepEqual(dancingMadAfterTest(state, inv, result), ['hollowCommitted'])
  behavior.afterTest(state, inv, result, api)
  assert.equal(hollowCards(state).length, 2)
  assert.ok(isHollowed(state, '01025'))
  assert.equal(inv.discard.includes('01025'), false, '空洞卡从弃牌堆移出场外')
  // 困难/专家面的 [tablet] 没有「如果失败」限定：成功也要成为空洞。
  state.difficulty = 'hard'
  const second = { ...result, success: true, committed: [{ seat: 0, code: '01027', icons: [] }] }
  assert.deepEqual(dancingMadAfterTest(state, inv, second), ['hollowCommitted'])
  behavior.afterTest(state, inv, second, api)
  assert.equal(hollowCards(state).length, 3)
})

test('P7 dancingMad 空洞回收：热带花园成功调查超过 3 点把空洞抽回手牌', () => {
  const { state, api } = setupState(1, { time: 5 })
  const inv = state.investigators[0]
  hollowCard(state, { code: '01025', source: 'test', scope: 'investigator', seat: 0 })
  inv.location = 'jardinesDeLaTropical'
  const location = state.locations.find(item => item.id === 'jardinesDeLaTropical')
  behavior.afterInvestigate(state, inv, location, { success: true, successBy: 3 }, api)
  assert.equal(state.investigators[0].hand.includes('01025'), true)
  assert.equal(setAsideHollows(state).length, 0)
})

// ---------------------------------------------------------------------------
// 7. 遭遇卡（09608 惨遭夺舍）
// ---------------------------------------------------------------------------
test('P7 dancingMad 遭遇 09608 惨遭夺舍：失败把[[盟友]]变成空洞，无候选改为 2 点恐惧', () => {
  const entry = registeredEntry('09608')
  assert.ok(entry, '09608 必须已登记')
  assert.equal(typeof encounterResolveFor('09608'), 'function')
  const { state, api } = setupState(1, { time: TIME_THRESHOLD })
  const inv = state.investigators[0]
  inv.assets.push({ id: 'a1', code: '01001', originalCode: '01001', name: '盟友', traits: ['Ally'] })
  state.testResults = [{ success: false, value: 1, difficulty: 4 }]
  state.choices = ['a1']
  chapter.behavior.resolveEncounter(state, inv, { code: '09608' }, api)
  assert.equal(inv.assets.length, 0, '支援离场')
  assert.ok(isHollowed(state, '01001'))
  // 没有可选支援时改为 2 点恐惧。
  const alone = state.investigators[0]
  alone.assets = []
  state.testResults = [{ success: false, value: 0, difficulty: 4 }]
  chapter.behavior.resolveEncounter(state, alone, { code: '09608' }, api)
  assert.equal(alone.horror, 2)
  // 成功不产生任何变化。
  state.testResults = [{ success: true, value: 6, difficulty: 4 }]
  chapter.behavior.resolveEncounter(state, alone, { code: '09608' }, api)
  assert.equal(alone.horror, 2)
})

// ---------------------------------------------------------------------------
// 8. 结局与 JSON 往返
// ---------------------------------------------------------------------------
test('P7 dancingMad 结局：记时间、Θ 动态报告、镜刃归属与存在抹除记录', () => {
  const { state, api } = setupState(2, { time: 5 })
  const startTime = state.campaign.tsk.map.time
  // 战役 setup 已初始化密钥、且「红字账」德西在场时，镜刃直接绑定到该敌人。
  initializeScarletKeys(state, [{ id: '09768', stableFace: '09768a', unstableFace: '09768b' }])
  state.enemies.push({ id: '09758', code: '09758', originalCode: '09758', location: 'elMalecon', exhausted: false, damageTaken: 0 })
  behavior.resolution(state, 'resolution1', [], api)
  assert.equal(state.campaign.records.desiIsInYourDebt, true)
  assert.equal(state.campaign.records.youKnowThePassphrase, true)
  assert.equal(state.campaign.tsk.map.time, startTime + 2, '结局 1 记 2 时间')
  assert.equal(state.campaign.tsk.statusReports.theta, startTime + 2 + 6, '时间轴当前 + 6 格写 Θ')
  behavior.resolution(state, 'resolution2', [], api)
  assert.equal(state.campaign.records.theCellDidntDiscoverTheTruthInHavana, true)
  assert.equal(state.campaign.records.youHaventSeenTheLastOfDesiderioDelgadoAlvarez, true)
  assert.equal(scarletKey(state, '09768').bearer.enemyId, '09758', '镜刃记在红字账德西名下')
  assert.equal(behavior.finalResolution(state), 'resolution2')
  state.investigators[0].resigned = true
  assert.equal(behavior.finalResolution(state), 'resolution1')
  // 密钥容器不存在时退回战役记录（不静默失败）。
  const bare = setupState(1, { time: 5 }).state
  behavior.resolution(bare, 'resolution2', [], apiFor(bare))
  assert.equal(bare.campaign.records.mirroringBladeBearer, '09758')
})

test('P7 dancingMad JSON 存档往返：模式/阴影迷你卡/空洞/幕索引可序列化复原', () => {
  const { state, api } = setupState(2, { time: TIME_THRESHOLD })
  hollowCard(state, { code: '01025', source: '09608', scope: 'investigator', seat: 0 })
  const real = concealedMiniCards(state).find(card => !card.decoy)
  behavior.exposeMiniCard(state, state.investigators[0], real.id, api)
  state.actIndex = 1
  const restored = JSON.parse(JSON.stringify(state))
  assert.deepEqual(restored.scenarioFlags.dancingMad, state.scenarioFlags.dancingMad)
  assert.deepEqual(restored.scenarioZones, state.scenarioZones)
  assert.equal(restored.actIndex, 1)
  assert.equal(restored.locations.length, state.locations.length)
  // 复原后的状态还能继续用同一套原语读写（容器形状未被破坏）。
  assert.equal(enemiesInShadows(restored), enemiesInShadows(state))
  assert.equal(hollowCards(restored).length, 1)
  assert.equal(isHollowed(restored, '01025'), true)
  assert.equal(dancingMadFlags(restored).mode, 'ambush')
  assert.equal(mapTime(restored), mapTime(state))
})

// ---------------------------------------------------------------------------
// 9. 单卡条目：四张专属卡登记后的规则数据与读点接线
// ---------------------------------------------------------------------------
test('P7 dancingMad 单卡条目：四张专属卡都有可读规则且被 behavior 读点接线', () => {
  assert.deepEqual(CHAPTER_ENTRY_CODES, [
    RAW_CODES.desiderioEncounter, RAW_CODES.desiderioLinkedEnemy, RAW_CODES.desiderioAsset, RAW_CODES.bodySnatched,
  ])
  for (const code of [RAW_CODES.desiderioEncounter, RAW_CODES.desiderioLinkedEnemy]) {
    const rule = enemyRuleFor(code)
    assert.equal(rule.concealed.perInvestigator, true)
    assert.equal(rule.healthPerInvestigatorBonus, 2)
    assert.deepEqual(rule.autoEvadeInsteadOfDamageActs, [1, 2])
    assert.equal(rule.otherCopyEvadeDamage, 2)
    assert.equal(registeredEntry(code).scope, 'enemy')
    assert.equal(registeredEntry(code).implemented, true)
  }
  const assetEntry = registeredEntry(RAW_CODES.desiderioAsset)
  assert.equal(assetEntry.scope, 'storyAsset')
  assert.equal(assetEntry.assetRule.monsterAttackDamageReduction, 1)
  assert.equal(assetEntry.assetRule.monsterRetaliate ?? assetEntry.assetRule.monsterAttackRetaliate, 1)
  // 敌人生命 +2/人（enemyStatModifier 读点）。
  const { state } = setupState(2, { time: 5 })
  const enemy = { id: 'e1', code: RAW_CODES.desiderioEncounter, originalCode: RAW_CODES.desiderioEncounter, health: 2 }
  assert.equal(behavior.enemyStatModifier(state, enemy, 'health'), 4, '+2 × 2 位调查员')
  assert.equal(behavior.enemyStatModifier(state, enemy, 'fight'), 0)
})

test('P7 dancingMad 德西：幕 1–2 受伤改为自动躲避，结局 3 之前不受伤害；另一张在躲避后受 2 伤', () => {
  const { state, api } = setupState(2, { time: 5 })
  const enemy = api.spawn(RAW_CODES.desiderioEncounter, 'elMalecon')
  state.actIndex = 0
  const dodged = behavior.enemyDamageAmount(state, enemy, 2, api)
  assert.equal(dodged, 0, '幕 1 伤害改为自动躲避')
  assert.equal(enemy.exhausted, true)
  // 幕 3 起恢复真实伤害。
  state.actIndex = 2
  assert.equal(behavior.enemyDamageAmount(state, enemy, 2, api), undefined)
  assert.equal(dancingMadFlags(state).lastEnemyDamage.amount, 2)
  // 躲避成功超过 2 点且同地点有另一张 → 另一张受到 2 点伤害。
  state.investigators[0].location = 'elMalecon'
  const other = api.spawn(RAW_CODES.desiderioLinkedEnemy, 'elMalecon')
  const amount = behavior.afterEvade(state, state.investigators[0], enemy,
    { success: true, value: 5, difficulty: 3, successBy: 2 }, api)
  assert.equal(amount, 2)
  assert.equal(other.damageTaken, 2)
})

test('P7 dancingMad 剧情资产 09607b：[[怪物]] 攻击伤害 -1、横置他并对攻击者造成 1 点伤害', () => {
  const { state, api } = setupState(2, { time: 5 })
  const inv = state.investigators[0]
  const asset = inv.assets.find(item => item.code === RAW_CODES.desiderioAsset)
  assert.ok(asset)
  const monster = api.spawn('09734', inv.location)
  const modifier = behavior.enemyAttackModifier(state, monster)
  assert.deepEqual(modifier, { damage: -1 })
  assert.equal(asset.exhausted, true, '横置德西')
  assert.equal(monster.damageTaken, 1, '对攻击的敌人造成 1 点伤害')
  assert.equal(behavior.enemyAttackModifier(state, monster), null, '横置后不再生效')
  // 非 [[怪物]] 敌人不触发。
  asset.exhausted = false
  const human = api.spawn('09752', inv.location)
  assert.equal(behavior.enemyAttackModifier(state, human), null)
})

test('P7 dancingMad 幕 1 v.II 正面强制：敌军阶段结束时按阴影敌人数量伤害月下餐厅调查员', () => {
  const { state, api } = setupState(2, { time: TIME_THRESHOLD })
  state.actIndex = 0
  for (const inv of state.investigators) inv.location = START_LOCATION
  const x = enemiesInShadows(state)
  const result = behavior.enemyPhaseEnd(state, api)
  assert.equal(result.x, x)
  assert.equal(result.dealt, Math.min(x, 2))
  // 潜入状态不结算这条强制（卡面是战斗警报下的清场压力）。
  markAlert(state, false)
  assert.equal(behavior.enemyPhaseEnd(state, api), null)
})

test('P7 dancingMad 幕 1 v.II 反应：[[结社]] 敌人受伤后在月下餐厅发现一半线索', () => {
  const { state, api } = setupState(2, { time: TIME_THRESHOLD })
  state.actIndex = 0
  const cafe = state.locations.find(location => location.id === START_LOCATION)
  const before = cafe.clues || 0
  const enemy = api.spawn('09726a', 'elMalecon')
  behavior.enemyDamageAmount(state, enemy, 4, api)
  behavior.enemyDamaged(state, enemy, api)
  assert.equal(cafe.clues, before + 2)
  // 幕 2 之后不再触发。
  state.actIndex = 1
  behavior.enemyDamageAmount(state, enemy, 4, api)
  behavior.enemyDamaged(state, enemy, api)
  assert.equal(cafe.clues, before + 2)
})

test('P7 dancingMad 幕 2 v.I 团队反应：共同花 X 线索改为直接交战生成', () => {
  const { state, api } = setupState(2, { time: 5 })
  state.actIndex = 1
  // 幕 2 v.I 的目标允许支付：X 线索（德西 X = 1 × 人数 = 2）。
  state.choices = ['pay']
  for (const inv of state.investigators) inv.clues = 2
  const result = concealEnemy(state, api, RAW_CODES.desiderioEncounter, { seat: 0, locationId: 'elMalecon' })
  assert.equal(result.paid, 2)
  assert.equal(state.enemies.length, 1, '支付后直接生成实体')
  assert.equal(state.enemies[0].engagedSeat, 0)
  assert.equal(state.investigators[0].clues + state.investigators[1].clues, 2, '团队共花 2 线索')
  assert.equal(concealedMiniCards(state).filter(card => !card.decoy).length, 0, 'v.I 初始没有阴影敌人')
  // 不支付时照常隐匿。
  state.choices = ['hide']
  const before = concealedMiniCards(state).length
  const hidden = concealEnemy(state, api, RAW_CODES.desiderioEncounter, { seat: 0 })
  assert.ok(hidden.placed.length >= 3)
  assert.equal(concealedMiniCards(state).length, before + hidden.placed.length)
})
