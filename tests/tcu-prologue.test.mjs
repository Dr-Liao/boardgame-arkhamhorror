// 万象无终 · 序章《暮色庄园失踪事件》（05043）切片验收。
//
// 覆盖：manifest/身份、7 张幽灵地点与闹鬼数据、符号连线、塔罗 22 行与确定性/唯一性、
// 故事调查员选人与卡背设置、遭遇牌库与放在一边、幕/议程强制、骷髅标记、结局记录、存档往返。
// 纯 hook 骨架（同 TFA 样板）：不依赖注册表/索引；共享组条目由 W-shared 的 tcu-shared-encounters 测试覆盖。
import test from 'node:test'
import assert from 'node:assert/strict'
import * as prologue from '../content/campaigns/theCircleUndone/scenarios/disappearanceAtTheTwilightEstate/index.js'
import {
  scenario as definition, ACT_CARD, AGENDA_CARD, SCENARIO_CARD, SPECTRAL_LOCATIONS, START_LOCATION,
  STORY_INVESTIGATOR_CODES, STORY_INVESTIGATOR_SETUP, THE_SPECTRAL_WATCHER, setupCardsFor,
} from '../content/campaigns/theCircleUndone/scenarios/disappearanceAtTheTwilightEstate/definition.js'
import { prologueChaosToken } from '../content/campaigns/theCircleUndone/scenarios/disappearanceAtTheTwilightEstate/chaos.js'
import {
  PROLOGUE_TAROT_RESULTS, WITCHING_HOUR_DIVINATION, applyPrologueTarotResult, arcanaName,
  prologueResultText, prologueTarotResult, validateTarotTables, witchingHourDivination,
} from '../content/campaigns/theCircleUndone/tarot.js'
import act05045 from '../src/cards/encounter-entries/theCircleUndone/disappearanceAtTheTwilightEstate/05045.js'
import agenda05044, { JUDGEMENT_FATE_RECORDS } from '../src/cards/encounter-entries/theCircleUndone/disappearanceAtTheTwilightEstate/05044.js'
import { buildTarotDeck, drawTarot } from '../src/engine/tarot.js'
import { normalizeScenarioHaunted } from '../src/engine/haunted.js'
import { normalizeScenarioSpectralLocations } from '../src/engine/locations.js'
import { selectStoryInvestigators } from '../src/engine/story-investigators.js'
import { applyMove, createGameState, legalMoves } from '../src/engine/engine.js'
import { recordDefaults } from '../content/campaigns/theCircleUndone/shared.js'
import { watcherHuntedSeats } from '../content/campaigns/theCircleUndone/encounter-rules.js'
import { layoutFor } from '../content/scenario-manifest.js'
import { layout as scenarioLayout } from '../content/campaigns/theCircleUndone/scenarios/disappearanceAtTheTwilightEstate/layout.js'

const clone = value => structuredClone(value)

// 确定性 LCG（同 TFA 样板）：所有随机只从这里流入 api.randomValue / shuffle / tarot。
function randomSource(seed = 1) {
  let value = seed >>> 0
  const randomValue = () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0
    return value / 0x100000000
  }
  const shuffle = items => {
    const copy = [...items]
    for (let index = copy.length - 1; index > 0; index--) {
      const target = Math.floor(randomValue() * (index + 1))
      ;[copy[index], copy[target]] = [copy[target], copy[index]]
    }
    return copy
  }
  return { randomValue, shuffle }
}

function stateFor(count = 2) {
  const state = {
    scenario: clone(definition),
    acts: clone(definition.acts),
    agendas: clone(definition.agendas),
    actIndex: 0,
    agendaIndex: 0,
    investigators: Array.from({ length: count }, (_, seat) => ({
      seat, code: '01001', name: `调查员${seat + 1}`, location: START_LOCATION,
      damage: 0, horror: 0, clues: 0, resources: 5, hand: [], assets: [], threat: [], engaged: [],
      deck: [], discard: [], actionsLeft: 3,
    })),
    locations: [],
    enemies: [],
    storyAssets: [],
    scenarioFlags: {},
    scenarioZones: {},
    victoryDisplay: [],
    encounterDeck: [],
    encounterDiscard: [],
    campaign: {
      leadSeat: 0,
      records: clone(recordDefaults),
      investigators: Array.from({ length: count }, (_, seat) => ({
        id: `inv${seat}`, deck: [], purchases: [], status: 'active',
        trauma: { physical: 0, mental: 0 },
      })),
      chaosBag: [],
    },
    chaosBag: [],
    difficulty: 'standard',
    numInvestigators: count,
    round: 1,
    phase: 'investigation',
    status: 'playing',
    log: [],
  }
  return state
}

// 选人：按给定 picks 依次回答 storyInvestigator 选择（缺省按座位顺序取剩余第一位）。
function chooseStoryInvestigators(state, picks = null) {
  const queue = picks ? [...picks] : []
  const record = selectStoryInvestigators(state, definition.storyInvestigators, {
    requestChoice(target, request) {
      assert.equal(request.kind, 'storyInvestigator')
      const pick = queue.length ? queue.shift() : request.options[0].id
      assert.ok(request.options.some(option => option.id === pick))
      return pick
    },
    cardName: code => definition.storyInvestigators.codes.includes(code) ? `故事调查员${code}` : code,
  })
  return record
}

function runtimeApi(state, seed = 1, { tarot = true } = {}) {
  const { randomValue, shuffle } = randomSource(seed)
  const calls = { info: [], damage: [], horror: [], haunted: [], choose: [] }
  const api = {
    calls,
    random: randomValue,
    shuffle,
    info: text => calls.info.push(String(text)),
    // agenda-in-place-flip（05044 原语）的测试替身：记录翻面顺序并打 face 日志标记。
    flipAgendaInPlace: face => {
      calls.flipAgenda ||= []
      calls.flipAgenda.push(face)
      state.agendaFace = face
      calls.info.push(`face:${face}`)
    },
    privateInfo: () => {},
    damage: (seat, amount) => { calls.damage.push({ seat, amount }); const inv = state.investigators[seat]; if (inv) inv.damage += amount },
    horror: (seat, amount) => { calls.horror.push({ seat, amount }); const inv = state.investigators[seat]; if (inv) inv.horror += amount },
    haunted: (seat, options) => calls.haunted.push({ seat, ...options }),
    choose(request) {
      calls.choose.push(request)
      return request.options[0].id
    },
    ...(tarot ? { tarot: {
      build: options => buildTarotDeck(state, { ...options, shuffle: list => shuffle(list) }),
      draw: (seat, options) => drawTarot(state, { ...options, random: randomValue }),
      remaining: () => [...(state.scenarioDecks?.tarot?.deck || [])],
      info: () => state.scenarioDecks?.tarot || null,
    } } : {}),
  }
  return api
}

// 开一局：选人 → preScenarioSetup（塔罗/资源/起手/位置）→ 铺地点 → 设置敌人 → 建遭遇牌库。
function setupGame({ count = 2, picks = null, seed = 1, skipTarot = false } = {}) {
  const state = stateFor(count)
  const api = runtimeApi(state, seed, { tarot: !skipTarot })
  chooseStoryInvestigators(state, picks)
  // 模拟引擎 prepareInvestigator 为故事调查员放置起始游戏区域资产（setupCards 配置）。
  for (const inv of state.investigators) {
    const codes = definition.storyInvestigators.setupCards[inv.code] || []
    inv.assets = codes.map((code, index) => ({
      id: `asset:${inv.seat}:${index}`, code, originalCode: code,
      name: definition.locations ? code : code, exhausted: false, damage: 0, horror: 0,
    }))
  }
  prologue.behavior.preScenarioSetup(state, [], api)
  // 引擎 placeLocation：有调查员的地点直接揭示并放线索（clues = 每人数 × 人数）。
  for (const id of prologue.behavior.setupLocations(state, [], { info: () => {} })) {
    const base = state.scenario.locations[id]
    const clues = (base.cluesPerInvestigator || 0) * state.numInvestigators
    const revealed = state.investigators.some(inv => inv.location === id)
    state.locations.push({ ...clone(base), id, revealed, clues: revealed ? clues : 0, maxClues: clues })
  }
  const spawned = setupEnemies(state)
  const deck = prologue.behavior.modifyDeck(state, state.scenario.encounterDeck.slice(), [], { info: () => {} })
  state.encounterDeck = deck
  state.chaosBag = ['+1', '0', '-1', 'skull']
  prologue.behavior.afterChaosBagSetup(state)
  return { state, api, spawned, deck }
}

function setupEnemies(state) {
  const spawned = []
  prologue.behavior.setupEnemies(state, [], {
    spawnEnemy(target, code, locationId, engagedSeat) {
      const def = target.scenario.enemies[code] || {}
      const enemy = {
        id: `enemy:${spawned.length + 1}`, code, originalCode: code,
        name: def.name || code, location: locationId, engagedSeat: engagedSeat ?? null,
        damageTaken: 0, doom: 0, exhausted: false, traits: [...(def.traits || [])],
      }
      target.enemies.push(enemy)
      spawned.push(enemy)
      return enemy
    },
    locName: (target, id) => target.locations.find(location => location.id === id)?.name || id,
    info: () => {},
  })
  return spawned
}

const enemyOf = (state, code) => state.enemies.find(enemy => enemy.code === code)

// --- manifest / 结构 -------------------------------------------------------

test('manifest：id/状态/战役/原卡身份/遭遇组与机制声明完整', () => {
  assert.equal(prologue.manifest.id, 'disappearanceAtTheTwilightEstate')
  assert.equal(prologue.manifest.status, 'playable')
  assert.equal(prologue.manifest.campaignId, 'theCircleUndone')
  assert.equal(prologue.manifest.catalogReferenceOnly, undefined)
  assert.equal(prologue.scenario.originalCode, SCENARIO_CARD)
  assert.equal(prologue.behavior.id, 'disappearanceAtTheTwilightEstate')
  assert.deepEqual(prologue.manifest.requiredEncounterGroupIds, [
    'disappearanceAtTheTwilightEstate', 'inexorableFate', 'realmOfDeath', 'spectralPredators',
    'trappedSpirits', 'theWatcher', 'chillingCold',
  ])
  for (const mechanic of ['tcuPrologue', 'tcuTarot', 'tcuSpectral', 'tcuHaunted', 'tcuWatcher']) {
    assert.ok(prologue.manifest.requiredMechanicIds.includes(mechanic), mechanic)
  }
})

test('manifest：7 地点 / 1 幕 / 1 议程 / 单一 noResolution 结局 / 看守人放在一边', () => {
  assert.equal(prologue.manifest.locations.length, 7)
  assert.equal(prologue.manifest.startLocationId, START_LOCATION)
  assert.deepEqual(prologue.manifest.acts.map(act => act.id), ['act1'])
  assert.deepEqual(prologue.manifest.agendas.map(agenda => agenda.id), ['agenda1'])
  assert.deepEqual(prologue.manifest.resolutionIds, ['noResolution'])
  assert.deepEqual(prologue.manifest.zones.setAside, [{ cardCode: THE_SPECTRAL_WATCHER, count: 1 }])
  assert.deepEqual(prologue.manifest.zones.removed, [])
})

test('身份：7 张幽灵地点的原卡号是 05078–05084，幕 05045 / 议程 05044', () => {
  assert.deepEqual(Object.values(prologue.identities.locations).map(identity => identity.originalCode).sort(),
    Object.values(SPECTRAL_LOCATIONS).sort())
  for (const identity of Object.values(prologue.identities.locations)) {
    assert.equal(identity.identityStatus, 'mapped')
  }
  assert.equal(prologue.identities.acts.act1.originalCode, ACT_CARD)
  assert.equal(prologue.identities.agendas.agenda1.originalCode, AGENDA_CARD)
})

test('地点：7 张全是幽灵地点、注册期校验通过、都有连接', () => {
  assert.equal(Object.keys(normalizeScenarioSpectralLocations(definition.locations)).length, 7)
  assert.equal(Object.keys(definition.locations).length, 7)
  for (const location of Object.values(definition.locations)) {
    assert.equal(location.spectral, true, location.id)
    assert.ok(Array.isArray(location.connections) && location.connections.length > 0, location.id)
  }
})

test('地点：符号连线与印刷地图一致（入口大厅只连宴会厅，办公室只连宴会厅）', () => {
  const loc = id => definition.locations[id]
  assert.deepEqual([...loc('entryHall').connections].sort(), ['victorianHalls'])
  assert.deepEqual([...loc('office').connections].sort(), ['victorianHalls'])
  assert.deepEqual([...loc('trophyRoom').connections].sort(), ['billiardsRoom', 'victorianHalls'])
  assert.deepEqual([...loc('billiardsRoom').connections].sort(), ['trophyRoom'])
  assert.deepEqual([...loc('balcony').connections].sort(), ['masterBedroom'])
  assert.deepEqual([...loc('victorianHalls').connections].sort(),
    ['entryHall', 'masterBedroom', 'office', 'trophyRoom'])
})

test('闹鬼：6 个地点各有 1 条闹鬼能力，闭集子句与卡面文本对应', () => {
  const normalized = normalizeScenarioHaunted(definition.locations)
  assert.deepEqual(Object.keys(normalized).sort(),
    ['balcony', 'billiardsRoom', 'masterBedroom', 'office', 'trophyRoom', 'victorianHalls'])
  const kinds = id => normalized[id][0].effect.map(clause => clause.kind)
  assert.deepEqual(kinds('victorianHalls'), ['loseAction'])
  assert.deepEqual(kinds('trophyRoom'), ['loseResource'])
  assert.deepEqual(kinds('billiardsRoom'), ['choice'])
  assert.deepEqual(kinds('masterBedroom'), ['placeClue'])
  assert.deepEqual(kinds('balcony'), ['damageAssets'])
  assert.deepEqual(kinds('office'), ['discardChosen'])
  assert.equal(normalized.entryHall, undefined, '入口大厅没有闹鬼能力')
  // 逐字保留卡面文本（中文文案事实源）。
  assert.equal(normalized.victorianHalls[0].text, '闹鬼 - 失去1个行动。')
})

test('布局：坐标来自 Haskell 地图且只含印刷连线', () => {
  const expected = layoutFor(definition, {
    office: { x: 4, y: 0 },
    billiardsRoom: { x: 0, y: 2 },
    trophyRoom: { x: 2, y: 2 },
    victorianHalls: { x: 4, y: 2 },
    masterBedroom: { x: 6, y: 2 },
    balcony: { x: 8, y: 2 },
    entryHall: { x: 4, y: 4 },
  })
  assert.deepEqual(scenarioLayout, expected)
  const coords = Object.values(scenarioLayout.locations)
  assert.equal(new Set(coords.map(point => `${point.x},${point.y}`)).size, 7, '坐标互不重叠')
  for (const edge of scenarioLayout.edges) {
    assert.ok(definition.locations[edge.from].connections.includes(edge.to), `${edge.from}>${edge.to}`)
  }
})

test('故事调查员配置：4 码无重复 / 划掉开关 / 起始游戏区域合法', () => {
  const config = definition.storyInvestigators
  assert.deepEqual([...config.codes], STORY_INVESTIGATOR_CODES)
  assert.equal(config.crossOutUnused, true)
  assert.deepEqual(Object.keys(config.setupCards).sort(), ['05046', '05048', '05049'])
  assert.deepEqual([...config.setupCards['05046']], ['01016', '01017'])
  assert.deepEqual([...config.setupCards['05049']], ['01077', '01086', '01087'])
})

// --- 遭遇牌库 / 放在一边 ---------------------------------------------------

test('遭遇牌库：25 张、不含幽灵看守人、含全部共享组卡', () => {
  assert.equal(definition.encounterDeck.length, 25)
  assert.equal(definition.encounterDeck.includes(THE_SPECTRAL_WATCHER), false)
  const counts = code => definition.encounterDeck.filter(entry => entry === code).length
  assert.equal(counts('05108'), 3)
  assert.equal(counts('05107'), 3)
  assert.equal(counts('05100'), 1)
  assert.equal(counts('05087'), 2)
  assert.equal(counts('01168'), 2)
  assert.equal(prologue.manifest.zones.encounterDeck.reduce((sum, entry) => sum + entry.count, 0), 25)
})

test('布置：看守人在入口大厅，加弗瑞拉使其受到 1 点伤害', () => {
  const { spawned } = setupGame({ count: 2, picks: ['05046', '05049'] })
  const watcher = spawned.find(enemy => enemy.code === THE_SPECTRAL_WATCHER)
  assert.ok(watcher, '看守人已生成')
  assert.equal(watcher.location, 'entryHall')
  assert.equal(watcher.engagedSeat, null)
  assert.equal(watcher.damageTaken, 1, '加弗瑞拉的卡背设置：看守人上放 1 点伤害')
})

test('布置：杰罗姆的冥府之雾在办公室、圣诞老人……（朦胧之雾）附属办公室', () => {
  const { state } = setupGame({ count: 1, picks: ['05047'] })
  const mist = enemyOf(state, '05100')
  assert.ok(mist)
  assert.equal(mist.location, 'office')
  const office = state.locations.find(location => location.id === 'office')
  assert.equal(office.fog, 1)
  assert.equal(office.shroudMod, 2)
  assert.equal(office.fogCode, '01168')
})

test('布置：瓦伦蒂诺与暗影猎犬交战、恐怖夜色在密谋旁', () => {
  const { state } = setupGame({ count: 1, picks: ['05048'] })
  const hound = enemyOf(state, '05101')
  assert.ok(hound)
  assert.equal(hound.engagedSeat, 0)
  assert.equal(hound.location, 'billiardsRoom')
  assert.deepEqual(nextToAgendaCodes(state), ['05107'])
})

test('布置：佩妮与怨灵交战、黑暗中的低语在密谋旁', () => {
  const { state } = setupGame({ count: 1, picks: ['05049'] })
  const wraith = enemyOf(state, '05103')
  assert.ok(wraith)
  assert.equal(wraith.engagedSeat, 0)
  assert.equal(wraith.location, 'balcony')
  assert.deepEqual(nextToAgendaCodes(state), ['05102'])
})

test('布置：加弗瑞拉的「愚人的命运」进入威胁区域', () => {
  const { state } = setupGame({ count: 1, picks: ['05046'] })
  assert.deepEqual(state.investigators[0].threat.map(card => card.code), ['05108'])
})

test('遭遇牌库：按已选调查员各移除 1 张设置卡（4 人时 25 → 18）', () => {
  const { deck } = setupGame({ count: 4 })
  assert.equal(deck.length, 18)
  for (const card of setupCardsFor(STORY_INVESTIGATOR_CODES).map(entry => entry.code)) {
    const remaining = deck.filter(code => code === card).length
    const original = definition.encounterDeck.filter(code => code === card).length
    assert.equal(remaining, original - 1, card)
  }
})

test('确定性与唯一性：同种子同一副塔罗；4 人抽 4 张互不相同', () => {
  const first = setupGame({ count: 4, seed: 17 })
  const second = setupGame({ count: 4, seed: 17 })
  assert.deepEqual(first.state.scenarioDecks.tarot, second.state.scenarioDecks.tarot)
  const drawn = first.state.scenarioDecks.tarot.drawn
  assert.equal(drawn.length, 4)
  assert.equal(new Set(drawn.map(entry => entry.arcana)).size, 4)
  assert.equal(first.state.scenarioDecks.tarot.deck.length, 18)
  for (const entry of drawn) assert.equal(entry.orientation, 'upright')
  const other = setupGame({ count: 4, seed: 18 })
  assert.notDeepEqual(other.state.scenarioDecks.tarot.drawn, drawn)
})

// --- 塔罗表 ---------------------------------------------------------------

test('塔罗表：22 行恰好覆盖 0–21，记录键与证据数合法', () => {
  assert.deepEqual(validateTarotTables(), { prologueRows: 22, divinationRows: 8 })
  assert.equal(new Set(PROLOGUE_TAROT_RESULTS.map(row => row.arcana)).size, 22)
  for (const row of PROLOGUE_TAROT_RESULTS) {
    assert.ok(['disappearedIntoTheMist', 'wasClaimedBySpecters', 'wasPulledIntoTheSpectralRealm',
      'wasTakenByTheWatcher'].includes(row.record))
    assert.ok(Number.isInteger(row.evidence) && row.evidence >= 0)
  }
})

test('塔罗结果：按行写对应 string[] 记录并累加证据', () => {
  const state = stateFor(1)
  const inv = state.investigators[0]
  applyPrologueTarotResult(state, inv, 0)
  applyPrologueTarotResult(state, inv, 3)
  assert.deepEqual(state.campaign.records.disappearedIntoTheMist, ['01001'])
  assert.deepEqual(state.campaign.records.wasClaimedBySpecters, ['01001'])
  assert.equal(state.campaign.records.piecesOfEvidenceWereLeftBehind, 5)
  const total = PROLOGUE_TAROT_RESULTS.reduce((sum, row) => sum + row.evidence, 0)
  assert.equal(total, 74)
})

test('塔罗文案：中文结果文案替换 {name}，未知 arcana 返回空串', () => {
  assert.ok(prologueResultText(0, '佩妮').includes('佩妮'))
  assert.ok(prologueResultText(0, '佩妮').includes('2个证据'))
  assert.equal(prologueResultText(99, '佩妮'), '')
  assert.deepEqual(arcanaName(14), { id: 14, name: '节制', nameEn: 'Temperance' })
  assert.equal(prologueTarotResult(21).record, 'wasTakenByTheWatcher')
})

test('巫异时刻占卜表：8 张固定牌与章节一一对应（供 ch1 只读）', () => {
  assert.equal(WITCHING_HOUR_DIVINATION.length, 8)
  assert.deepEqual(WITCHING_HOUR_DIVINATION.map(entry => entry.scenarioId), [
    'theWitchingHour', 'atDeathsDoorstep', 'theSecretName', 'theWagesOfSin',
    'forTheGreaterGood', 'unionAndDisillusion', 'inTheClutchesOfChaos', 'beforeTheBlackThrone',
  ])
  assert.deepEqual(WITCHING_HOUR_DIVINATION.map(entry => entry.arcana), [14, 11, 9, 12, 5, 6, 7, 10])
  assert.equal(witchingHourDivination('theWagesOfSin').arcana, 12)
  assert.equal(witchingHourDivination('unknownChapter'), null)
})

// --- 故事调查员设置 -------------------------------------------------------

test('布置：资源/起点按卡背覆盖（1/3/10/2 资源）', () => {
  const { state } = setupGame({ count: 4 })
  const byCode = Object.fromEntries(state.investigators.map(inv => [inv.code, inv]))
  assert.equal(byCode['05046'].resources, 1)
  assert.equal(byCode['05047'].resources, 3)
  assert.equal(byCode['05048'].resources, 10)
  assert.equal(byCode['05049'].resources, 2)
  assert.equal(byCode['05046'].location, 'victorianHalls')
  assert.equal(byCode['05047'].location, 'office')
  assert.equal(byCode['05048'].location, 'billiardsRoom')
  assert.equal(byCode['05049'].location, 'balcony')
})

test('布置：卡背固定起手牌直接写入手牌（故事调查员没有牌组）', () => {
  const { state } = setupGame({ count: 2, picks: ['05046', '05049'] })
  assert.deepEqual(state.investigators[0].hand, [...STORY_INVESTIGATOR_SETUP['05046'].startingHand])
  assert.deepEqual(state.investigators[1].hand, [...STORY_INVESTIGATOR_SETUP['05049'].startingHand])
  assert.deepEqual(state.investigators[0].deck, [])
})

test('布置：起始游戏区域弹药/补给按卡背覆盖为 2', () => {
  const { state } = setupGame({ count: 2, picks: ['05046', '05049'] })
  const pistol = state.investigators[0].assets.find(asset => asset.code === '01016')
  assert.equal(pistol.uses, 2)
  assert.equal(pistol.usesType, 'ammo')
  const flashlight = state.investigators[1].assets.find(asset => asset.code === '01087')
  assert.equal(flashlight.uses, 2)
  assert.equal(flashlight.usesType, 'supplies')
})

test('失踪人口：只记录已选故事调查员，未选者缺席（等价于划掉）', () => {
  const { state } = setupGame({ count: 2, picks: ['05046', '05047'] })
  assert.deepEqual(state.campaign.records.missingPersons, ['05046', '05047'])
  assert.equal(state.campaign.records.missingPersons.includes('05048'), false)
  assert.equal(state.campaign.records.missingPersons.includes('05049'), false)
  // 已揭示地点数量 = 有调查员的起点数（2 人 = 2 个）。
  assert.equal(state.locations.filter(location => location.revealed).length, 2)
})

// --- 幕 / 议程强制 --------------------------------------------------------

test('幕 1a 强制：被消除调查员的线索放到幕上而不是地点', () => {
  const { state, api } = setupGame({ count: 2, picks: ['05046', '05047'] })
  const inv = state.investigators[0]
  inv.clues = 3
  const handled = prologue.behavior.investigatorEliminated(state, inv, inv.clues, api)
  assert.equal(handled, true)
  assert.equal(state.acts[0].clues, 3)
  assert.equal(inv.clues, 0)
  assert.equal(state.locations.some(location => location.clues === 3), false)
})

test('议程 1b：被幽灵看守人击败 → 记录「被看守人抓走」，议程翻回 1a 且不移除毁灭', () => {
  const { state, api } = setupGame({ count: 1, picks: ['05046'], skipTarot: true })
  state.round = 2
  state.doom = 4
  const inv = state.investigators[0]
  prologue.behavior.beforeEnemyHarm(state,
    { code: THE_SPECTRAL_WATCHER, originalCode: THE_SPECTRAL_WATCHER, traits: ['Ancient One', 'Spectral'] },
    inv, { damage: 2, horror: 0 }, api)
  prologue.behavior.beforeHarm(state, inv, { damage: 2, horror: 0 }, api)
  prologue.behavior.investigatorEliminated(state, inv, 0, api)
  assert.deepEqual(state.campaign.records.wasTakenByTheWatcher, ['05046'])
  assert.equal(state.agendaIndex, 0, '议程索引不变（就地翻面，不推进）')
  assert.equal(state.doom, 4, '推进不移除毁灭')
  assert.deepEqual(api.calls.flipAgenda, ['back', 'front'], '推进 1b 后翻回 1a（agenda-in-place-flip）')
  assert.ok(api.calls.info.includes('face:back'), '播报背面正文（face 标记）')
  assert.ok(api.calls.info.includes('face:front'), '翻回正面（face 标记）')
})

test('议程 1b：被怪物敌人击败 → 记录「被幽灵夺走性命」', () => {
  const { state, api } = setupGame({ count: 1, picks: ['05049'], skipTarot: true })
  state.round = 1
  const inv = state.investigators[0]
  prologue.behavior.beforeEnemyHarm(state, { code: '05103', originalCode: '05103', traits: ['Monster', 'Geist', 'Spectral'] },
    inv, { damage: 2, horror: 0 }, api)
  prologue.behavior.beforeHarm(state, inv, { damage: 2, horror: 0 }, api)
  prologue.behavior.investigatorEliminated(state, inv, 0, api)
  assert.deepEqual(state.campaign.records.wasClaimedBySpecters, ['05049'])
})

test('议程 1b：其他效果击败且场上毁灭 ≥7 → 记录「消失在迷雾之中」', () => {
  const { state, api } = setupGame({ count: 1, picks: ['05047'], skipTarot: true })
  state.doom = 7
  const inv = state.investigators[0]
  // 议程 1a 强制伤害/恐惧：content 自己在 api.damage 周围置 agendaHarmSeat；这里直接模拟落点。
  state.scenarioFlags.agendaHarmSeat = inv.seat
  prologue.behavior.beforeHarm(state, inv, { damage: 2, horror: 0 }, api)
  state.scenarioFlags.agendaHarmSeat = null
  prologue.behavior.investigatorEliminated(state, inv, 0, api)
  assert.deepEqual(state.campaign.records.disappearedIntoTheMist, ['05047'])
})

test('议程 1b：击败来源精确到「致命那次伤害」——同轮先被攻击、随后被其他效果击败 → 记「被拉入幽灵国度」', () => {
  const { state, api } = setupGame({ count: 1, picks: ['05046'], skipTarot: true })
  state.round = 2
  const inv = state.investigators[0]
  // 同轮先发生一次看守人攻击（beforeEnemyHarm 标记），但它没有击败；随后一个非攻击效果造成致命伤害。
  prologue.behavior.beforeEnemyHarm(state,
    { code: THE_SPECTRAL_WATCHER, originalCode: THE_SPECTRAL_WATCHER, traits: ['Ancient One', 'Spectral'] },
    inv, { damage: 1, horror: 0 }, api)
  prologue.behavior.beforeHarm(state, inv, { damage: 1, horror: 0 }, api)
  prologue.behavior.beforeHarm(state, inv, { damage: 1, horror: 0 }, api)
  prologue.behavior.investigatorEliminated(state, inv, 0, api)
  assert.deepEqual(state.campaign.records.wasPulledIntoTheSpectralRealm, ['05046'], '以致命那次伤害的来源为准，不误归看守人')
  assert.deepEqual(state.campaign.records.wasTakenByTheWatcher, [])
})

test('议程 1b：同轮先被攻击、随后被议程 1a 强制伤害击败且毁灭 ≥7 → 记「消失在迷雾之中」', () => {
  const { state, api } = setupGame({ count: 1, picks: ['05046'], skipTarot: true })
  state.round = 2
  state.doom = 7
  const inv = state.investigators[0]
  prologue.behavior.beforeEnemyHarm(state,
    { code: '05103', originalCode: '05103', traits: ['Monster', 'Geist'] }, inv, { damage: 1, horror: 0 }, api)
  prologue.behavior.beforeHarm(state, inv, { damage: 1, horror: 0 }, api)
  state.scenarioFlags.agendaHarmSeat = inv.seat
  prologue.behavior.beforeHarm(state, inv, { horror: 2 }, api)
  state.scenarioFlags.agendaHarmSeat = null
  prologue.behavior.investigatorEliminated(state, inv, 0, api)
  assert.deepEqual(state.campaign.records.disappearedIntoTheMist, ['05046'])
  assert.deepEqual(state.campaign.records.wasClaimedBySpecters, [])
})

test('议程 1b：其他效果击败 → 记录「被拉入幽灵国度」', () => {
  const { state, api } = setupGame({ count: 1, picks: ['05048'], skipTarot: true })
  prologue.behavior.investigatorEliminated(state, state.investigators[0], 0, api)
  assert.deepEqual(state.campaign.records.wasPulledIntoTheSpectralRealm, ['05048'])
})

test('撤退不是「被击败」：线索上幕但不写命运记录', () => {
  const { state, api } = setupGame({ count: 1, picks: ['05046'], skipTarot: true })
  const inv = state.investigators[0]
  inv.resigned = true
  inv.clues = 2
  prologue.behavior.investigatorEliminated(state, inv, 2, api)
  assert.equal(state.acts[0].clues, 2)
  assert.deepEqual(state.campaign.records.wasTakenByTheWatcher, [])
  assert.deepEqual(state.campaign.records.wasClaimedBySpecters, [])
  assert.deepEqual(state.campaign.records.wasPulledIntoTheSpectralRealm, [])
})

test('议程 1a 强制：放置毁灭后每位调查员二选一（≥5 毁灭时 2 点）', () => {
  const { state, api } = setupGame({ count: 2 })
  // < 5 毁灭：1 点
  prologue.behavior.doomPlaced(state, { target: state.locations[0], amount: 1, agenda: false }, api)
  assert.equal(api.calls.choose.length, 2)
  assert.ok(api.calls.choose[0].prompt.includes('1 点伤害'))
  assert.deepEqual(api.calls.damage.map(call => call.amount), [1, 1])
  // ≥ 5 毁灭：2 点
  api.calls.damage.length = 0
  state.doom = 5
  prologue.behavior.doomPlaced(state, { target: null, amount: 1, agenda: true }, api)
  assert.ok(api.calls.choose.at(-1).prompt.includes('2 点'))
  assert.deepEqual(api.calls.damage.map(call => call.amount), [2, 2])
  // setup 还没结束时（flags.setupComplete=false）不触发。
  delete state.scenarioFlags.setupComplete
  const before = api.calls.choose.length
  prologue.behavior.doomPlaced(state, { target: null, amount: 1, agenda: true }, api)
  assert.equal(api.calls.choose.length, before)
})

// --- 混乱标记 / 骷髅 ------------------------------------------------------

test('混乱标记：骷髅在简单/普通为 -3，困难/专家为 -5；其他标记交回共享规则', () => {
  assert.deepEqual(prologueChaosToken({ difficulty: 'standard' }, null, 'skull', null), { delta: -3 })
  assert.deepEqual(prologueChaosToken({ difficulty: 'easy' }, null, 'skull', null), { delta: -3 })
  assert.deepEqual(prologueChaosToken({ difficulty: 'hard' }, null, 'skull', null), { delta: -5 })
  assert.deepEqual(prologueChaosToken({ difficulty: 'expert' }, null, 'skull', null), { delta: -5 })
  assert.equal(prologueChaosToken({ difficulty: 'standard' }, null, 'cultist', null), null)
  assert.deepEqual(prologue.behavior.resolveChaosToken({ difficulty: 'expert' }, null, 'skull', {}), { delta: -5 })
})

test('骷髅后半句：攻击/躲避检定失败时结算所在地点每条闹鬼能力', () => {
  const { state, api } = setupGame({ count: 1, picks: ['05046'] })
  const inv = state.investigators[0]
  // 判定读「检定动作种类」（source 标签），不是技能值：战斗/敏捷检定在其他行动里不能误触发。
  prologue.behavior.afterTest(state, inv,
    { success: false, token: 'skull', skill: 'combat', source: { label: '攻击' } }, api)
  prologue.behavior.afterTest(state, inv,
    { success: false, token: 'skull', skill: 'agility', source: { label: '躲避' } }, api)
  assert.equal(api.calls.haunted.length, 2)
  assert.deepEqual(api.calls.haunted[0], { seat: 0, locationId: 'victorianHalls', times: 1, kind: 'scenario' })
  // 成功 / 非骷髅 / 调查失败 / 战斗技能但非攻击行动都不触发（调查失败由引擎自动结算闹鬼）。
  prologue.behavior.afterTest(state, inv,
    { success: true, token: 'skull', skill: 'combat', source: { label: '攻击' } }, api)
  prologue.behavior.afterTest(state, inv,
    { success: false, token: 'cultist', skill: 'combat', source: { label: '攻击' } }, api)
  prologue.behavior.afterTest(state, inv,
    { success: false, token: 'skull', skill: 'intellect', source: { label: '调查' } }, api)
  prologue.behavior.afterTest(state, inv,
    { success: false, token: 'skull', skill: 'combat', source: { label: '卡牌效果检定' } }, api)
  assert.equal(api.calls.haunted.length, 2)
})

// --- 结局 / 遭遇分派 / 存档 -----------------------------------------------

test('结局：noResolution 把幕上线索累加进证据，且序章不获得经验值', () => {
  const { state, api } = setupGame({ count: 2 })
  state.acts[0].clues = 4
  state.campaign.records.piecesOfEvidenceWereLeftBehind = 10
  const result = prologue.behavior.resolution(state, 'noResolution', [], api)
  assert.deepEqual(result, { award: false, bonus: 0 })
  assert.equal(state.campaign.records.piecesOfEvidenceWereLeftBehind, 14)
  assert.throws(() => prologue.behavior.resolution(state, 'r1', [], api), /未知暮色庄园失踪事件结局/)
})

test('遭遇分派：已注册的核心共享条目（01168 朦胧之雾）由单卡条目结算', () => {
  const { state, api } = setupGame({ count: 1, picks: ['05047'] })
  const inv = state.investigators[0]
  const office = state.locations.find(location => location.id === 'office')
  const before = office.fog
  const handled = prologue.behavior.resolveEncounter(state, inv,
    { code: '01168', originalCode: '01168', effect: { kind: 'campaignRule' } }, api)
  assert.equal(handled, true)
  assert.equal(office.fog, before + 1)
})

test('遭遇分派：未知卡号返回 false（共享组条目由 W-shared 提供）', () => {
  const { state, api } = setupGame({ count: 1 })
  const result = prologue.behavior.resolveEncounter(state, state.investigators[0],
    { code: '05999', originalCode: '05999', effect: { kind: 'campaignRule' } }, api)
  assert.equal(result, false)
})

test('幕/议程条目：1b 文案记录写进战役记录', () => {
  const { state, api } = setupGame({ count: 2 })
  act05045.actRule.onReveal(state, state.acts[0], api)
  // 参考实现是团队级 boolean 记录（recordSchema 已改 boolean；旧座位 string[] 由 watcherHuntedSeats 兼容）。
  assert.equal(state.campaign.records.youAreBeingHunted, true)
  assert.deepEqual(watcherHuntedSeats(state), [0, 1], 'boolean 记录视为全体存活调查员被追捕')
  agenda05044.agendaRule.onReveal(state, state.agendas[0], api)
  for (const key of JUDGEMENT_FATE_RECORDS) {
    assert.ok(Array.isArray(state.campaign.records[key]), key)
  }
  assert.equal(act05045.implemented, true)
  assert.equal(agenda05044.implemented, true)
})

test('幕 1b 翻回：actIndexAfterAdvance 把幕 1 的推进翻回索引 0', () => {
  const { state } = setupGame({ count: 1 })
  assert.equal(prologue.behavior.actIndexAfterAdvance(state, state.acts[0], {}), 0)
})

test('描述：序章状态包含证据、命运记录与密谋旁卡牌', () => {
  const { state, api } = setupGame({ count: 1, picks: ['05048'] })
  state.campaign.records.piecesOfEvidenceWereLeftBehind = 3
  state.campaign.records.wasClaimedBySpecters = ['05048']
  const lines = prologue.behavior.describe(state, api)
  assert.ok(lines.some(line => line.includes('遗留证据：3')))
  assert.ok(lines.some(line => line.includes('被幽灵夺走性命')))
  assert.ok(lines.some(line => line.includes('密谋旁：恐怖夜色')))
})

test('存档往返：JSON 往返后塔罗/区域/记录/幕线索完全一致', () => {
  const build = () => {
    const game = setupGame({ count: 4, seed: 23 })
    game.state.round = 2
    game.state.doom = 3
    prologue.behavior.doomPlaced(game.state, { target: game.state.locations[0], amount: 1, agenda: false }, game.api)
    const victim = game.state.investigators[2]
    victim.clues = 2
    prologue.behavior.investigatorEliminated(game.state, victim, 2, game.api)
    return game.state
  }
  const first = build()
  const second = build()
  assert.equal(JSON.stringify(first), JSON.stringify(second), '同种子同路线状态逐字一致')
  const restored = JSON.parse(JSON.stringify(first))
  assert.deepEqual(restored.scenarioDecks, first.scenarioDecks)
  assert.deepEqual(restored.scenarioZones, first.scenarioZones)
  assert.deepEqual(restored.scenarioFlags, first.scenarioFlags)
  assert.deepEqual(restored.campaign.records, first.campaign.records)
  assert.deepEqual(restored.acts, first.acts)
  assert.deepEqual(restored.locations.map(location => location.clues), first.locations.map(location => location.clues))
  // 往返后仍能继续结算结局（记录仍是可写 JSON）。
  prologue.behavior.resolution(restored, 'noResolution', [], { info: () => {} })
  assert.ok(restored.campaign.records.piecesOfEvidenceWereLeftBehind >= first.campaign.records.piecesOfEvidenceWereLeftBehind)
})

// 小工具：密谋旁卡号（避免测试里重复读共享 agendaAside 结构）。
function nextToAgendaCodes(state) {
  return (state.scenarioZones.agendaAside || []).map(card => card.code || card.originalCode)
}

// 无牌组故事调查员用卡面印刷的固定属性（05046–05049），不能沿用开局时原本调查员的
// 职业/技能（例如普雷斯顿 05003 的 1/1/1/1）。这里用真实 createGameState 跑 4 人开局，
// 让四位故事调查员都被选中，逐人核对技能/职业/生命/理智。
// （放在文件末尾：前面的账本/备注证据会按行号引用本文件，插在中间会让行号整体漂移。）
test('开局：故事调查员按卡面写入职业与四项技能，不继承原调查员属性', () => {
  const state = createGameState(
    { campaignId: 'theCircleUndone', campaignHub: false, seed: 'tcu-prologue-stats', playerInvestigator: '01001' },
    [{ seat: 0 }, { seat: 1 }, { seat: 2 }, { seat: 3 }],
  )
  const picks = ['05047', '05046', '05048', '05049']
  let guard = 0
  while (state.pendingChoice && guard++ < 400) {
    const pending = state.pendingChoice
    const optionId = pending.kind === 'storyInvestigator'
      ? (pending.options.find(option => option.id === picks[pending.seat])?.id || pending.options[0].id)
      : (pending.options.find(option => ['done', 'skip'].includes(option.id))?.id || pending.options[0].id)
    applyMove(state, pending.seat, { action: 'choose', choiceId: pending.id, optionId })
  }
  assert.equal(guard < 400, true, '开局选择没有收敛')
  assert.equal(state.scenario.id, 'disappearanceAtTheTwilightEstate')
  // 卡面印刷值：05046 中立 3/2/4/1·8/4；05047 中立 2/4/1/3·4/8；
  // 05048 中立 1/3/2/4·5/7；05049 中立 4/1/3/2·7/5。
  const printed = {
    '05046': { klass: 'neutral', willpower: 3, intellect: 2, combat: 4, agility: 1, health: 8, sanity: 4 },
    '05047': { klass: 'neutral', willpower: 2, intellect: 4, combat: 1, agility: 3, health: 4, sanity: 8 },
    '05048': { klass: 'neutral', willpower: 1, intellect: 3, combat: 2, agility: 4, health: 5, sanity: 7 },
    '05049': { klass: 'neutral', willpower: 4, intellect: 1, combat: 3, agility: 2, health: 7, sanity: 5 },
  }
  assert.deepEqual(state.investigators.map(inv => inv.code).sort(), Object.keys(printed).sort())
  for (const inv of state.investigators) {
    assert.deepEqual({
      klass: inv.klass,
      willpower: inv.willpower, intellect: inv.intellect, combat: inv.combat, agility: inv.agility,
      health: inv.maxHealth, sanity: inv.maxSanity,
    }, printed[inv.code], inv.code)
  }
})

// 05094 苦痛折磨的引擎读点：威胁区威胁数据 threatEffect.cannotTriggerActionAbilities 使受影响的
// 调查员不能触发其控制卡牌上的 [action] 能力（src/engine/moves.js 的 actionAbilityBlocked）。
// 用真实 createGameState 状态 + legalMoves 验证：行动型能力消失、免费/快速能力仍在、摆脱行动仍在。
test('05094 苦痛折磨：威胁区禁制资产 [action] 能力，免费能力与摆脱行动不受影响', () => {
  const state = createGameState(
    { campaignId: 'theCircleUndone', campaignHub: false, seed: 'tcu-05094-legal-moves', playerInvestigator: '01001' },
    [{ seat: 0 }],
  )
  let guard = 0
  while (state.pendingChoice && guard++ < 400) {
    const pending = state.pendingChoice
    const optionId = pending.options.find(option => ['done', 'skip'].includes(option.id))?.id
      || pending.options[0].id
    applyMove(state, pending.seat, { action: 'choose', choiceId: pending.id, optionId })
  }
  assert.equal(Boolean(state.pendingChoice), false, '开局选择没有收敛')
  state.phase = 'investigation'
  state.currentSeat = 0
  state.pendingChoice = null
  const inv = state.investigators[0]
  // 同地点敌人：让攻击型 [action] 能力有合法目标。
  state.enemies.push({
    id: 'test-enemy', code: '01167', originalCode: '01167', name: '测试敌人',
    location: inv.location, engagedSeat: inv.seat, exhausted: false, damageTaken: 0,
    fight: 1, evade: 1, health: 3, doom: 0, traits: [],
  })
  // 01020：行动型 [action] 攻击能力；01018：免费（cost.action=false）能力。
  inv.assets.push({ id: 'test-knife', code: '01020', originalCode: '01020', exhausted: false })
  inv.assets.push({ id: 'test-guard', code: '01018', originalCode: '01018', exhausted: false })
  const abilityMovesOf = (moves, assetId) => moves.filter(move => move.action === 'ability' && move.assetId === assetId)

  let moves = legalMoves(state, 0)
  assert.equal(abilityMovesOf(moves, 'test-knife').length > 0, true, '未受禁制时 [action] 出现在合法行动里')
  assert.equal(abilityMovesOf(moves, 'test-guard').length > 0, true, '免费能力正常出现')

  inv.threat.push({ id: 'threat:05094', code: '05094', originalCode: '05094' })
  moves = legalMoves(state, 0)
  assert.equal(abilityMovesOf(moves, 'test-knife').length, 0, '05094 在威胁区时 [action] 能力被禁制')
  assert.equal(abilityMovesOf(moves, 'test-guard').length > 0, true, '免费/快速能力不受禁制')
  assert.equal(moves.some(move => move.action === 'encounterAction'), true, '威胁区的摆脱行动仍可用')

  inv.threat = []
  moves = legalMoves(state, 0)
  assert.equal(abilityMovesOf(moves, 'test-knife').length > 0, true, '弃掉 05094 后恢复')
})
