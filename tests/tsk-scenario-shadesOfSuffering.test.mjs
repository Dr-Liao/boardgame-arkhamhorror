// 苦痛之影（shadesOfSuffering · 09660）章节测试（P7）。
//
// 三层证据：
//   1. 章节装配 —— manifest（7 地点 / 三幕 / 三密谋 / 四个结局）、六组遭遇、正文可读、四档混乱标记表；
//   2. 章节机械 —— 布置（4 张入场 + 3 张放一边、三对灵怪各留一张、朱三娘隐匿 2、影穑按时间充能）、
//      福林特工三档分支、灵怪谈判/翻面、朱三娘往返阴影与血债血偿、影穑充能与 Shift、
//      幕/密谋推进（降头师幕间、收割、畏惧收割者）、地点行动、遭遇卡分派、结局与 JSON 往返；
//   3. 单卡条目 —— 十八条专属条目（6 灵怪 / 2 朱三娘 / 2 诡计 / 6 剧情 / 2 密钥）逐条具备可执行声明。
import test from 'node:test'
import assert from 'node:assert/strict'
import { registerCardAbilities, registeredEntry } from '../src/engine/ability.js'
import { validateTskState } from '../src/engine/tsk-primitives.js'
import { ENCOUNTER_GROUPS } from '../content/campaigns/theScarletKeys/shared.js'
import {
  bindKey, initializeScarletKeys, scarletKey, shiftKey,
} from '../src/engine/tsk-scarlet-keys.js'
import * as chapter from '../content/campaigns/theScarletKeys/scenarios/shadesOfSuffering/index.js'
import {
  AGENDA2, CHARGE_FLAG, CONCEALED_AMOUNT, ENCOUNTER_DECK, GATHER_GROUPS, GEIST_ENEMY_CODES, GEIST_PAIRS,
  LOCATIONS, RAW_CODES, REMEMBERED, SET_ASIDE_LOCATION_IDS, SETUP_LOCATION_IDS, SHADE_REAPER_KEY,
  STATION_EAST_WING, STATION_WEST_WING, TIN_MINE, TZU_SAN_NIANG, TZU_SAN_NIANG_OUT_FOR_BLOOD, WAYANG_KULIT_THEATER,
  clueValueOf, scenario,
} from '../content/campaigns/theScarletKeys/scenarios/shadesOfSuffering/definition.js'
import {
  addCharges, behavior, chapterState, chapterSummary, chargesOf, concealedAmountOf, concealedSpotsForTzu,
  drainShadeReaperOnSuccess, enemyOf, ensureShadeReaper, exposeAt, flintStatus, flipTzuOutForBlood,
  geistEnemiesAt, geistPairSpecOf, geistStoryOf, groupCluesAt, hasRemembered, markTime,
  nonWeaknessGeists, rememberedFacts, removeCharges, resolveBomohInterlude, resolveGeistParley,
  resolveGeistStory, resolveRestlessDeadBack, resolveTzuConcealed, returnTzuToShadows, setCharges,
  shadeReaperFace, shiftShadeReaper, spawnGeist, spendGroupClues, storyFactOf, tzuEnemy, tzuInShadows,
} from '../content/campaigns/theScarletKeys/scenarios/shadesOfSuffering/behavior.js'
import {
  SHADES_OF_SUFFERING_TOKEN_MEANINGS, shadeReaperCharges, shadesOfSufferingAfterTest,
  shadesOfSufferingChaosToken, skullModifier,
} from '../content/campaigns/theScarletKeys/scenarios/shadesOfSuffering/chaos.js'

// ---------------------------------------------------------------------------
// 条目注册（真实注册期校验：未知字段/未知 kind/未知窗口都会在这里失败）
// ---------------------------------------------------------------------------
const ENTRIES = []
for (const code of chapter.behavior.implementedEncounterCodes) {
  const module = await import(`../src/cards/encounter-entries/theScarletKeys/shadesOfSuffering/${code}.js`)
  ENTRIES.push(module.default)
}
for (const entry of ENTRIES) if (!registeredEntry(entry.code)) registerCardAbilities(entry)

const clone = value => structuredClone(value)
const info = () => {}

function stateFor(count = 1, { records = {}, seed = 20261111 } = {}) {
  return {
    scenario: clone(scenario),
    acts: clone(scenario.acts),
    agendas: clone(scenario.agendas),
    actIndex: 0,
    agendaIndex: 0,
    numInvestigators: count,
    difficulty: 'standard',
    round: 1,
    turnSerial: 1,
    currentSeat: 0,
    doom: 0,
    rngState: seed,
    locations: [],
    investigators: Array.from({ length: count }, (_, seat) => ({
      seat, code: '01001', name: `调查员${seat + 1}`, location: STATION_WEST_WING, klass: 'seeker', traits: [],
      damage: 0, horror: 0, clues: 0, resources: 5, hand: [], assets: [], threat: [], engaged: [],
      deck: ['01001', '01002'], discard: [], actionsLeft: 3, trauma: { physical: 0, mental: 0 },
    })),
    enemies: [], storyAssets: [], encounterDeck: [...ENCOUNTER_DECK], encounterDiscard: [],
    scenarioZones: {}, scenarioFlags: {}, chaosBag: ['+1', '0', '-2', 'skull', 'cultist', 'tablet', 'elderthing'],
    campaign: {
      leadSeat: 0,
      records: { ...records },
      investigators: Array.from({ length: count }, () => ({ trauma: { physical: 0, mental: 0 }, deck: [], removedCards: [] })),
    },
    victoryDisplay: [], victory: 0, testResults: [], testCalls: [], choices: [], finished: [], infos: [],
  }
}

function apiStub(state, overrides = {}) {
  const api = {
    info: text => state.infos.push(String(text)),
    privateInfo: (seat, text) => state.infos.push(`[${seat}] ${text}`),
    choose: request => state.choices.shift() ?? request?.options?.[0]?.id ?? null,
    choice: request => state.choices.shift() ?? request?.options?.[0]?.id ?? null,
    test: (seat, skill, difficulty, resolve = null, skillBonus = 0, source = null) => {
      state.testCalls.push({ seat, skill, difficulty, skillBonus, source })
      const result = state.testResults.shift() || { success: true, value: difficulty + 1, difficulty }
      state.lastTestResult = result
      if (typeof resolve === 'function') resolve(result)
      return result
    },
    spawn: (code, locationId, options = {}) => {
      const definition = state.scenario.enemies?.[code] || {}
      const enemy = {
        id: `enemy-${state.enemies.length + 1}`, code, originalCode: code,
        name: definition.name || code, location: locationId, exhausted: Boolean(options.exhausted),
        defeated: false, damageTaken: 0, health: definition.health ?? 2,
        fight: definition.fight ?? 2, evade: definition.evade ?? 2,
        damage: definition.damage ?? 1, horror: definition.horror ?? 1,
        traits: [...(definition.traits || [])], engagedSeat: null, victory: definition.victory || 0,
      }
      state.enemies.push(enemy)
      return enemy
    },
    attack: (enemy, inv) => { state.attacks ||= []; state.attacks.push({ enemyId: enemy?.id, seat: inv?.seat }) },
    harm: (seat, amount = {}) => {
      const inv = state.investigators[seat]
      inv.damage += amount.damage || 0
      inv.horror += amount.horror || 0
    },
    damage: (seat, amount) => { state.investigators[seat].damage += amount },
    horror: (seat, amount) => { state.investigators[seat].horror += amount },
    directHorror: (seat, amount) => { state.investigators[seat].horror += amount },
    healDamage: (seat, amount) => { state.investigators[seat].damage = Math.max(0, state.investigators[seat].damage - amount) },
    healHorror: (seat, amount) => { state.investigators[seat].horror = Math.max(0, state.investigators[seat].horror - amount) },
    healAsset: (asset, amounts = {}) => {
      asset.damage = Math.max(0, (asset.damage || 0) - (amounts.damage || 0))
      asset.horror = Math.max(0, (asset.horror || 0) - (amounts.horror || 0))
    },
    damageEnemy: (enemyId, amount) => {
      const target = state.enemies.find(enemy => enemy.id === enemyId)
        || (state.victoryDisplay || []).find(card => card.id === enemyId)
      if (target) target.damageTaken = (Number(target.damageTaken) || 0) + amount
    },
    setEnemyAside: enemy => {
      state.enemies = state.enemies.filter(item => item !== enemy)
      state.setAsideEnemies ||= []
      state.setAsideEnemies.push(enemy)
      return enemy.id
    },
    restoreEnemyFromAside: (id, locationId) => {
      const enemy = (state.setAsideEnemies || []).find(item => item.id === id)
      if (!enemy) return null
      state.setAsideEnemies = state.setAsideEnemies.filter(item => item !== enemy)
      enemy.location = locationId
      state.enemies.push(enemy)
      return enemy
    },
    putEnemyInPlay: enemy => {
      if (!state.enemies.includes(enemy)) state.enemies.push(enemy)
      return state.enemies.includes(enemy)
    },
    moveEnemy: (enemy, locationId) => { enemy.location = locationId; return true },
    flipEnemy: (enemy, nextCode) => {
      enemy.code = nextCode
      enemy.originalCode = nextCode
      return { changed: true, to: nextCode }
    },
    engage: (enemy, seat) => { enemy.engagedSeat = seat; return true },
    disengage: enemy => { if (enemy) enemy.engagedSeat = null; return true },
    addDoom: amount => { state.doom = (Number(state.doom) || 0) + amount; return state.doom },
    doomOn: (card, amount = 1) => { card.doom = (Number(card.doom) || 0) + amount; return card.doom },
    removeDoom: (amount = 1) => {
      const removed = Math.min(amount, Number(state.doom) || 0)
      state.doom = Math.max(0, (Number(state.doom) || 0) - removed)
      return removed
    },
    clearDoomOnCard: card => {
      const removed = Number(card?.doom) || 0
      if (card) delete card.doom
      return removed
    },
    loseClues: (seat, amount) => {
      const inv = state.investigators[seat]
      const lost = Math.min(Number(inv.clues) || 0, Math.max(0, amount))
      inv.clues -= lost
      return lost
    },
    spendClues: (seat, amount) => { state.investigators[seat].clues -= amount },
    gainClues: (seat, amount) => { state.investigators[seat].clues += amount },
    loseResources: (seat, amount) => { state.investigators[seat].resources -= amount },
    gainResources: (seat, amount) => { state.investigators[seat].resources += amount },
    drawCards: (seat, amount) => { state.drawn ||= []; state.drawn.push({ seat, amount }) },
    drawEncounter: seat => { state.encounterDrawn ||= []; state.encounterDrawn.push(seat) },
    discardRandomFromHand: (seat, amount) => {
      const inv = state.investigators[seat]
      const removed = inv.hand.splice(0, Math.min(amount, inv.hand.length))
      state.discarded ||= []
      state.discarded.push({ seat, cards: removed })
      return removed
    },
    discardAsset: (seat, assetId) => {
      const inv = state.investigators[seat]
      inv.assets = inv.assets.filter(asset => asset.id !== assetId)
    },
    moveInvestigator: (seat, destination) => { state.investigators[seat].location = destination },
    loseActions: (seat, amount) => {
      const inv = state.investigators[seat]
      const lost = Math.min(inv.actionsLeft || 0, amount)
      inv.actionsLeft -= lost
      return lost
    },
    advanceAct: () => { state.advancedAct = (state.advancedAct || 0) + 1; state.actIndex += 1 },
    advanceAgenda: () => { state.advancedAgenda = (state.advancedAgenda || 0) + 1; state.agendaIndex += 1 },
    advanceAgendaTo: index => {
      if (!(index > state.agendaIndex) || index >= state.agendas.length) return false
      state.agendaIndex = index
      state.advancedAgendaTo = index
      return true
    },
    revertAgenda: () => { state.reverted = (state.reverted || 0) + 1; return true },
    finish: key => state.finished.push(key),
    addTrauma: (seat, kind, amount) => {
      state.campaign.trauma ||= {}
      state.campaign.trauma[`${seat}:${kind}`] = amount
    },
    defeatInvestigator: seat => { state.investigators[seat].defeated = true },
    remember: fact => {
      state.scenarioFlags.remembered ||= []
      if (state.scenarioFlags.remembered.includes(fact)) return false
      state.scenarioFlags.remembered.push(fact)
      return true
    },
    scenarioFlag: key => state.scenarioFlags?.[key] ?? null,
    setScenarioFlag: (key, value = true) => {
      state.scenarioFlags ||= {}
      if (value == null) delete state.scenarioFlags[key]
      else state.scenarioFlags[key] = value
      return state.scenarioFlags[key] ?? null
    },
    putInHand: (seat, code) => {
      const inv = state.investigators[seat]
      if (!inv.deck.includes(code)) return false
      inv.deck = inv.deck.filter(item => item !== code)
      inv.hand.push(code)
      return true
    },
    putAssetIntoPlay: (seat, code) => {
      const inv = state.investigators[seat]
      if (!inv.hand.includes(code)) return false
      inv.hand = inv.hand.filter(item => item !== code)
      inv.assets.push({ id: `asset-${code}`, code, originalCode: code, damage: 0, horror: 0 })
      return true
    },
    exemptAssetSlot: (asset, slot) => { asset.exemptSlots = [...(asset.exemptSlots || []), slot]; return true },
    random: () => 0.5,
    locationDistance: (from, targets) => (targets.includes(from) ? 0 : 1),
    mechanics: {
      tsk: {
        keys: {
          initialize: specs => initializeScarletKeys(state, specs),
          shift: (id, options) => shiftKey(state, id, options),
          bind: (id, bearer) => bindKey(state, id, bearer),
        },
      },
    },
    ...overrides,
  }
  api.scenario = {
    addStoryToVictory: code => {
      state.victoryDisplay ||= []
      if (state.victoryDisplay.some(card => card.code === code)) return false
      state.victoryDisplay.push({ id: code, code, originalCode: code, victory: 1 })
      return true
    },
    putInHand: api.putInHand,
    ...(overrides.scenario || {}),
  }
  return api
}

const setup = (state, overrides = {}) => {
  behavior.setupLocations(state, [], { info, api: apiStub(state, overrides) })
  return state
}
const miniAll = state => state.scenarioFlags?.mechanics?.tsk?.concealed?.miniCards || []

// ---------------------------------------------------------------------------
// 1. 装配 / 正文 / 混乱标记表
// ---------------------------------------------------------------------------
test('P7 shadesOfSuffering 清单：playable、7 地点/三幕三密谋/四结局/正文可读', () => {
  assert.equal(chapter.manifest.id, 'shadesOfSuffering')
  assert.equal(chapter.manifest.campaignId, 'theScarletKeys')
  assert.equal(chapter.manifest.status, 'playable')
  assert.equal(chapter.manifest.referenceCode, RAW_CODES.scenario)
  assert.equal(chapter.manifest.locations.length, 7)
  assert.deepEqual(chapter.manifest.acts.map(act => act.id), ['act1', 'act2', 'act3'])
  assert.deepEqual(chapter.manifest.agendas.map(agenda => agenda.id), ['agenda1', 'agenda2', 'agenda3'])
  assert.deepEqual(chapter.manifest.resolutionIds,
    ['noResolution', 'resolution1', 'resolution2', 'resolution3'])
  assert.equal(chapter.manifest.startLocationId, STATION_WEST_WING)
  // manifest 只声明本战役 26 个遭遇组（strikingFear 等外部/核心组由所需卡包声明）。
  assert.deepEqual([...chapter.manifest.requiredEncounterGroupIds].sort(), GATHER_GROUPS.filter(group => ENCOUNTER_GROUPS.includes(group)).sort())
  assert.deepEqual([...chapter.manifest.requiredMechanicIds], ['tskConcealed', 'tskScarletKeys'])
  // 遭遇牌库＝专属组诡计 + 五个共享组按印刷份数展开（灵怪/朱三娘/密钥都不是遭遇牌）。
  const counts = {}
  for (const code of ENCOUNTER_DECK) counts[code] = (counts[code] || 0) + 1
  assert.equal(counts[RAW_CODES.excruciate], 2)
  assert.equal(counts[RAW_CODES.spiritHarvest], 3)
  for (const code of [...GEIST_ENEMY_CODES, RAW_CODES.tzuSanNiang]) assert.equal(counts[code], undefined)
  assert.ok(chapter.manifest.zones.setAside.some(entry => entry.cardCode === GEIST_ENEMY_CODES[0]))
  assert.deepEqual(chapter.manifest.zones.inPlay.map(entry => entry.cardCode).sort(),
    [RAW_CODES.tzuSanNiang, RAW_CODES.shadeReaperStable].sort())
  // 开局在场与放一边不重叠（check-scenario 的「重复入牌」守卫）。
  const asideCodes = new Set(chapter.manifest.zones.setAside.map(entry => entry.cardCode))
  for (const entry of chapter.manifest.zones.inPlay) assert.equal(asideCodes.has(entry.cardCode), false)
  // 正文：开场两分支、完整设置、特别规则、幕间与四个结局。
  assert.ok(chapter.scenario.introTitle.includes('苦痛之影'))
  assert.ok(chapter.scenario.introBranches.flintTraveledToKualaLumpur.length > 100)
  assert.ok(chapter.scenario.introBranches.agentFlintIsMissing.length > 100)
  assert.ok(chapter.scenario.setup.length > 200)
  assert.ok(chapter.scenario.specialRules.includes('影穑'))
  assert.ok(chapter.scenario.specialRules.includes('灵怪'))
  assert.ok(chapter.scenario.theBomoh.intro.length >= 2)
  assert.ok(chapter.scenario.theBomoh.aftermath.length > 50)
  for (const [key, text] of Object.entries(scenario.resolutions)) {
    assert.ok(String(text).length > 20, `${key} 正文缺失`)
  }
  // 四档混乱标记：简单/普通共用一张表，困难/专家共用另一张。
  assert.equal(SHADES_OF_SUFFERING_TOKEN_MEANINGS.easy, SHADES_OF_SUFFERING_TOKEN_MEANINGS.standard)
  assert.equal(SHADES_OF_SUFFERING_TOKEN_MEANINGS.hard, SHADES_OF_SUFFERING_TOKEN_MEANINGS.expert)
  assert.equal(SHADES_OF_SUFFERING_TOKEN_MEANINGS.standard.cultist.delta, -4)
  assert.equal(SHADES_OF_SUFFERING_TOKEN_MEANINGS.hard.cultist.delta, -5)
})

// ---------------------------------------------------------------------------
// 2. 布置：地点 / 灵怪 / 朱三娘隐匿 2 / 影穑按时间充能
// ---------------------------------------------------------------------------
test('P7 shadesOfSuffering 布置：4 张地点入场、3 张放一边、连接互逆、线索按人数', () => {
  const state = setup(stateFor(2))
  assert.equal(state.locations.length, 4, 'Setup 只放 West Wing / Selangor Club / East Wing / Padang')
  for (const id of SETUP_LOCATION_IDS) {
    const location = state.locations.find(item => item.id === id)
    assert.ok(location, `${id} 必须在场`)
    assert.equal(location.revealed, true, `${id} 以揭示面入场`)
    assert.equal(location.clues, clueValueOf(state, id))
  }
  for (const id of SET_ASIDE_LOCATION_IDS) {
    assert.equal(state.locations.some(item => item.id === id), false, `${id} 在放一边区`)
    assert.ok(LOCATIONS[id], `${id} 在卡表里`)
  }
  // 线索：perPlayer × 2（Melati's Shop 固定 0）。
  assert.equal(clueValueOf(state, STATION_EAST_WING), 2)
  assert.equal(clueValueOf(state, 'selangorClubPadang'), 4)
  assert.equal(clueValueOf(state, 'melatisShop'), 0)
  // 连接互逆（静态符号表）：East Wing ⇄ West Wing / Melati's / Tin Mine / Wayang Kulit；
  // West Wing ⇄ Selangor Club / Padang；Selangor Club ⇄ Padang。
  const edges = new Set()
  for (const location of LOCATIONS ? Object.values(LOCATIONS) : []) {
    for (const to of location.connections) edges.add(`${location.id}>${to}`)
  }
  for (const [from, to] of [['stationEastWing', 'stationWestWing'], ['stationWestWing', 'selangorClub'],
    ['selangorClub', 'selangorClubPadang'], ['stationEastWing', 'melatisShop'],
    ['stationEastWing', 'tinMine'], ['stationEastWing', 'wayangKulitTheater']]) {
    assert.ok(edges.has(`${from}>${to}`), `${from} → ${to}`)
    assert.ok(edges.has(`${to}>${from}`), `${to} → ${from}`)
  }
  // West Wing 可以撤退（地点实例上的 resign 供引擎的通用 resign 行动读取）。
  assert.equal(state.locations.find(item => item.id === STATION_WEST_WING).resign, true)
})

test('P7 shadesOfSuffering 布置：三对灵怪各留一张、三张移出游戏、朱三娘隐匿 2', () => {
  const state = setup(stateFor(2))
  const data = chapterState(state)
  assert.equal(Object.keys(data.geists).length, 3)
  for (const role of ['uncannyShadow', 'buriedMiner', 'slainForeman']) {
    assert.ok(data.geists[role], `${role} 必须选出一张`)
  }
  assert.equal(data.removedGeists.length, 3, '三对里各有一张移出游戏')
  for (const code of data.removedGeists) assert.equal(isChosen(state, code), false)
  // 朱三娘：不在 state.enemies（在阴影中），真身 + 2 诱饵＝3 张迷你卡，分布在起始地点以外。
  assert.equal(tzuInShadows(state), true)
  assert.equal(tzuEnemy(state), null)
  const minis = miniAll(state)
  assert.equal(minis.length, CONCEALED_AMOUNT + 1, '隐匿 2 = 2 诱饵 + 真身')
  assert.equal(minis.filter(card => card.decoy).length, CONCEALED_AMOUNT)
  assert.equal(new Set(minis.map(card => card.locationId)).size, 3, '三个非起始地点各 1 张')
  assert.ok(minis.every(card => card.locationId !== data.startLocation))
  function isChosen(currentState, code) {
    return Object.values(chapterState(currentState).geists).includes(code)
  }
})

test('P7 shadesOfSuffering 布置：影穑以动荡面开场，充能按战役记录 time 分档', () => {
  const base = setup(stateFor(1))
  assert.equal(shadeReaperFace(base), SHADE_REAPER_KEY.unstableFace, 'Setup 时以[[动荡]]面附属')
  assert.equal(chargesOf(base), 0, '11 以内不放充能')
  assert.equal(scarletKey(base, SHADE_REAPER_KEY.id).stable, false)
  assert.equal(base.campaign.records.shadeReaperBearer, 'tzuSanNiang')
  assert.equal(chargesOf(setup(stateFor(1, { records: { time: 12 } }))), 3)
  assert.equal(chargesOf(setup(stateFor(1, { records: { time: 19 } }))), 6)
  const late = setup(stateFor(1, { records: { time: 27 } }))
  assert.equal(chargesOf(late), 9)
  assert.equal(late.doom, 1, '27 以上额外放 1 毁灭')
})

test('P7 shadesOfSuffering 布置：单人游戏密谋 2 的毁灭阈值 +1', () => {
  const solo = setup(stateFor(1))
  assert.equal(solo.agendas[1].doomThreshold, AGENDA2.doomThreshold + 1)
  const duo = setup(stateFor(2))
  assert.equal(duo.agendas[1].doomThreshold, AGENDA2.doomThreshold)
})

test('P7 shadesOfSuffering 布置：不传随机源时按确定性顺序（同一 seed 两次结果一致）', () => {
  const signature = state => JSON.stringify({
    geists: chapterState(state).geists,
    concealed: chapterSummary(state).concealed.map(card => `${card.locationId}:${card.kind}`),
  })
  assert.equal(signature(setup(stateFor(2, { seed: 4242 }))), signature(setup(stateFor(2, { seed: 4242 }))))
})

// ---------------------------------------------------------------------------
// 3. 福林特工状态分支
// ---------------------------------------------------------------------------
test('P7 shadesOfSuffering 福林：重归特别小组 → 起始地点雪兰莪俱乐部并把福林加入牌组', () => {
  const records = { flintTraveledToKualaLumpur: true }
  const state = stateFor(1, { records })
  const api = apiStub(state)
  behavior.preScenarioSetup(state, [], api)
  assert.equal(flintStatus(state), 'rejoined')
  assert.equal(state.campaign.records.flintRejoinedTheCell, true)
  assert.equal(state.campaign.investigators[0].deck.includes('09762'), true, '福林探员加入牌组')
  assert.equal(behavior.startLocation(state), 'selangorClub')
  setup(state)
  assert.equal(chapterSummary(state).startLocation, 'selangorClub')
  // Setup 时从牌组搜索入场：不占盟友槽（api.exemptAssetSlot）。
  const assets = state.investigators[0].assets.filter(asset => asset.code === '09762')
  assert.equal(assets.length, 1, '福林从牌组放进场')
  assert.deepEqual(assets[0].exemptSlots, ['ally'])
})

test('P7 shadesOfSuffering 福林：失踪/死亡 → 起始地点火车站西翼；幕间「死亡」分支 +2 充能', () => {
  const missing = stateFor(1, { records: { agentFlintIsMissing: true } })
  behavior.preScenarioSetup(missing, [], apiStub(missing))
  assert.equal(flintStatus(missing), 'missing')
  assert.equal(behavior.startLocation(missing), STATION_WEST_WING)
  // 失踪 → 幕间划掉「失踪」、记「死亡」并在影穑上放 2 充能。
  const state = setup(stateFor(1, { records: { agentFlintIsMissing: true } }))
  const api = apiStub(state)
  resolveBomohInterlude(state, api)
  assert.equal(state.campaign.records.agentFlintIsDead, true)
  assert.equal(state.campaign.records.agentFlintIsMissing, undefined, '失踪被划掉')
  assert.equal(chargesOf(state), 2, '死亡分支在影穑上放 2 充能')
  // 重归 → 不加充能。
  const rejoined = setup(stateFor(1, { records: { flintTraveledToKualaLumpur: true } }))
  resolveBomohInterlude(rejoined, apiStub(rejoined))
  assert.equal(chargesOf(rejoined), 0)
  assert.equal(rejoined.campaign.records.agentFlintIsDead, undefined)
})

// ---------------------------------------------------------------------------
// 4. 朱三娘：揭露 / 返回阴影 / 血债血偿 / 血债血偿强制
// ---------------------------------------------------------------------------
test('P7 shadesOfSuffering 朱三娘：揭露诱饵移除、揭露真身入场、返回阴影重新分配', () => {
  const state = setup(stateFor(2))
  const api = apiStub(state)
  const decoy = miniAll(state).find(card => card.decoy)
  const decoyResult = exposeAt(state, state.investigators[0], decoy.id, api)
  assert.equal(decoyResult.decoy, true)
  assert.equal(miniAll(state).length, CONCEALED_AMOUNT)
  const truth = miniAll(state).find(card => !card.decoy)
  const result = exposeAt(state, state.investigators[0], truth.id, api)
  assert.equal(result.decoy, false)
  assert.equal(tzuInShadows(state), false)
  const enemy = tzuEnemy(state)
  assert.ok(enemy, '真身被揭露时朱三娘入场')
  assert.equal(enemy.location, truth.locationId)
  assert.equal(enemy.code, TZU_SAN_NIANG)
  // 返回阴影：敌人离场、真身迷你卡重新分配（有灵怪时只进有灵怪的地点）。
  spawnGeist(state, api, chapterState(state).geists.uncannyShadow, 'selangorClub')
  const back = returnTzuToShadows(state, api)
  assert.equal(tzuEnemy(state), null)
  assert.equal(tzuInShadows(state), true)
  assert.equal(back.cards.length, CONCEALED_AMOUNT + 1)
  assert.deepEqual([...new Set(back.cards.map(card => card.locationId))], ['selangorClub'])
  assert.deepEqual(concealedSpotsForTzu(state).sort(), geistEnemiesAt(state, null).map(enemy => enemy.location).sort())
})

test('P7 shadesOfSuffering 朱三娘：将要被击败 → 治愈、清毁灭、返回阴影（替换击败）', () => {
  const state = setup(stateFor(1))
  const api = apiStub(state)
  const truth = miniAll(state).find(card => !card.decoy)
  exposeAt(state, state.investigators[0], truth.id, api)
  const enemy = tzuEnemy(state)
  enemy.damageTaken = 99
  enemy.doom = 2
  state.doom = 3
  state.investigators[0].assets.push({ id: 'ally-1', code: '01001', doom: 1 })
  const replaced = behavior.enemyDefeated(state, enemy, api)
  assert.equal(replaced, true, '「将要被击败」被替换')
  assert.equal(tzuEnemy(state), null)
  assert.equal(tzuInShadows(state), true)
  assert.equal(state.doom, 0, '移除场上所有毁灭（密谋）')
  assert.equal(state.investigators[0].assets[0].doom, undefined, '移除支援上的毁灭')
})

test('P7 shadesOfSuffering 血债血偿：翻面重算生命、成功攻击移除充能并分伤', () => {
  const state = setup(stateFor(2, { records: { time: 12 } }))
  const api = apiStub(state)
  const tzu = flipTzuOutForBlood(state, api, { locationId: 'selangorClub', healAll: true })
  assert.equal(tzu.code, TZU_SAN_NIANG_OUT_FOR_BLOOD)
  assert.equal(tzu.health, 4 + 2 * 2, '4 + 2×人数')
  assert.equal(tzu.hunter, true)
  assert.equal(tzu.retaliate, true)
  assert.equal(tzu.victory, 1)
  // 充能 3：成功超过 3 点 → 移除 3 充能并平分（1 伤害 + 1 恐惧，剩 1 点由选择决定）。
  assert.equal(chargesOf(state), 3)
  state.choices = ['damage']
  const removed = drainShadeReaperOnSuccess(state, state.investigators[0], 3, api)
  assert.equal(removed, 3)
  assert.equal(chargesOf(state), 0)
  const inv = state.investigators[0]
  assert.equal(inv.damage, 2, '奇数 3：2 伤害 + 1 恐惧')
  assert.equal(inv.horror, 1)
})

// ---------------------------------------------------------------------------
// 5. 灵怪：谈判 / 剧情翻面
// ---------------------------------------------------------------------------
test('P7 shadesOfSuffering 灵怪：谈判成功且记住事实 → 剧情卡进胜利区', () => {
  const state = setup(stateFor(1))
  const api = apiStub(state)
  const code = chapterState(state).geists.uncannyShadow
  const enemy = spawnGeist(state, api, code, STATION_WEST_WING)
  const plot = geistStoryOf(state, code)
  assert.equal(plot.story, geistPairSpecOf(code).story)
  assert.equal(plot.fact, REMEMBERED.embarrassedTheConsulate)
  assert.equal(storyFactOf(plot.story), REMEMBERED.embarrassedTheConsulate)
  // 谈判：随机弃 1 张手牌 → 难度 5。
  state.investigators[0].hand = ['01001', '01002']
  state.investigators[0].location = STATION_WEST_WING
  state.choices = ['1']
  assert.equal(resolveGeistParley(state, state.investigators[0], enemy, api), true)
  assert.equal(state.testCalls.at(-1).difficulty, 5, '每弃 1 张牌难度 -1')
  // 没有记住事实 → 灵怪翻回敌人面、治愈、解除交战、横置。
  assert.equal(state.enemies.includes(enemy), true)
  assert.equal(enemy.damageTaken, 0)
  assert.equal(enemy.exhausted, true)
  assert.equal(state.victoryDisplay.length, 0)
  // 记住事实后再谈判 → 剧情卡加入胜利区。
  state.investigators[0].hand = ['01001']
  state.scenarioFlags.remembered = [REMEMBERED.embarrassedTheConsulate]
  assert.equal(resolveGeistParley(state, state.investigators[0], enemy, api), true)
  assert.equal(state.enemies.includes(enemy), false, '记住事实后灵怪离场')
  assert.equal(state.victoryDisplay.some(card => card.code === plot.story), true)
  assert.deepEqual(chapterState(state).storyVictories, [plot.story])
})

test('P7 shadesOfSuffering 灵怪：将要被击败时翻面（记住 → 胜利区，未记住 → 留在场上）', () => {
  const remembered = setup(stateFor(1))
  const rememberedApi = apiStub(remembered)
  const code = chapterState(remembered).geists.buriedMiner
  const plot = geistStoryOf(remembered, code)
  remembered.scenarioFlags.remembered = [plot.fact]
  const first = spawnGeist(remembered, rememberedApi, code, TIN_MINE)
  assert.equal(behavior.enemyDefeated(remembered, first, rememberedApi), true, '灵怪的击败被替换')
  assert.equal(remembered.victoryDisplay.some(card => card.code === plot.story), true)
  // 未记住：敌人被放回场上、治愈、横置。
  const plain = setup(stateFor(1))
  const plainApi = apiStub(plain)
  const plainCode = chapterState(plain).geists.slainForeman
  const second = spawnGeist(plain, plainApi, plainCode, STATION_WEST_WING)
  second.damageTaken = 3
  behavior.enemyDefeated(plain, second, plainApi)
  assert.equal(plain.enemies.includes(second), true, '未记住事实：灵怪留在场上')
  assert.equal(second.damageTaken, 0)
  assert.equal(second.exhausted, true)
  assert.equal(plain.victoryDisplay.length, 0)
})

test('P7 shadesOfSuffering 灵怪：密谋 3 期间不能被翻面（击败被取消）', () => {
  const state = setup(stateFor(1))
  const api = apiStub(state)
  state.agendaIndex = 2
  behavior.checkObjectives(state, api)
  assert.equal(chapterState(state).agenda3, true)
  const code = chapterState(state).geists.uncannyShadow
  const enemy = spawnGeist(state, api, code, STATION_WEST_WING)
  enemy.damageTaken = 99
  assert.equal(behavior.enemyDefeated(state, enemy, api), true)
  assert.equal(state.enemies.includes(enemy), true, '取消击败、留在场上')
  assert.equal(enemy.hunter, true, '获得猎手')
  assert.equal(enemy.retaliate, true, '获得反击')
  // 谈判行动在密谋 3 期间不再出现。
  state.investigators[0].location = STATION_WEST_WING
  const parley = behavior.actions(state, state.investigators[0]).filter(move => String(move.rule).startsWith('parley:'))
  assert.equal(parley.length, 0)
})

// ---------------------------------------------------------------------------
// 6. 影穑充能 / 混乱标记 / 两张诡计 / Shift
// ---------------------------------------------------------------------------
test('P7 shadesOfSuffering 影穑：[skull] 取充能一半（上限 6），困难档等于充能数', () => {
  const state = setup(stateFor(1))
  const inv = state.investigators[0]
  assert.equal(chargesOf(state), 0)
  assert.deepEqual(shadesOfSufferingChaosToken(state, inv, 'skull'), { delta: 0 })
  addCharges(state, 5)
  assert.equal(skullModifier(state), 3, '⌈5/2⌉ = 3')
  assert.deepEqual(shadesOfSufferingChaosToken(state, inv, 'skull'), { delta: -3 })
  setCharges(state, 30)
  assert.equal(skullModifier(state), 6, '简单/普通上限 6')
  state.difficulty = 'expert'
  assert.equal(skullModifier(state), 30, '困难/专家等于充能数')
  // cultist 的失败连带（简单/普通）与揭示即放（困难/专家）。
  state.difficulty = 'standard'
  setCharges(state, 0)
  const api = apiStub(state)
  assert.deepEqual(shadesOfSufferingChaosToken(state, inv, 'cultist', api), { delta: -4, rider: 'chargeOnFailedByTwo' })
  assert.equal(chargesOf(state), 0, '简单档揭示时不放充能')
  state.difficulty = 'hard'
  shadesOfSufferingChaosToken(state, inv, 'cultist', api)
  assert.equal(chargesOf(state), 1, '困难档揭示即放 1 充能')
  assert.deepEqual(shadesOfSufferingAfterTest(state, inv,
    { success: false, difficulty: 4, value: 1, drawn: ['cultist'], cancelledTokens: [] }), [])
  state.difficulty = 'standard'
  assert.deepEqual(shadesOfSufferingAfterTest(state, inv,
    { success: false, difficulty: 4, value: 1, drawn: ['cultist'], cancelledTokens: [] }), ['cultistCharge'])
  // tablet：有灵怪时额外揭示（简单）/ 自动失败（困难）。
  const geistState = setup(stateFor(1))
  const geistApi = apiStub(geistState)
  spawnGeist(geistState, geistApi, chapterState(geistState).geists.uncannyShadow, STATION_WEST_WING)
  geistState.investigators[0].location = STATION_WEST_WING
  geistState.difficulty = 'standard'
  assert.equal(shadesOfSufferingChaosToken(geistState, geistState.investigators[0], 'tablet').drawAnother, true)
  geistState.difficulty = 'hard'
  assert.equal(shadesOfSufferingChaosToken(geistState, geistState.investigators[0], 'tablet').autoFail, true)
  // elderthing：付 1 充能把修正改为 0（简单）/ -3（困难）。
  addCharges(geistState, 2)
  geistState.difficulty = 'standard'
  geistState.choices = ['pay']
  assert.deepEqual(shadesOfSufferingChaosToken(geistState, geistState.investigators[0], 'elderthing', geistApi).delta, 0)
  assert.equal(chargesOf(geistState), 3)
  geistState.difficulty = 'hard'
  geistState.choices = ['skip']
  assert.deepEqual(shadesOfSufferingChaosToken(geistState, geistState.investigators[0], 'elderthing', geistApi).delta, -6)
})

test('P7 shadesOfSuffering 诡计：折磨按充能改难度、魂灵收割两选项都接线', () => {
  const state = setup(stateFor(2))
  const api = apiStub(state)
  const inv = state.investigators[0]
  inv.hand = ['01001', '01002']
  // 折磨：先放 1 充能，充能 <8 → 难度 3；失败 -2 点 → 选择受伤。
  state.testResults = [{ success: false, value: 1, difficulty: 3 }]
  state.choices = ['damage']
  assert.equal(behavior.resolveEncounter(state, inv, { code: RAW_CODES.excruciate }, api), true)
  assert.equal(chargesOf(state), 1, '显现放 1 充能')
  assert.equal(state.testCalls.at(-1).skill, 'willpower')
  assert.equal(state.testCalls.at(-1).difficulty, 3)
  assert.equal(inv.damage, 2, '失败选择受到 2 点伤害')
  // 8 充能以上 → 难度 6。
  setCharges(state, 7)
  state.testResults = [{ success: true, value: 9, difficulty: 6 }]
  behavior.resolveEncounter(state, inv, { code: RAW_CODES.excruciate }, api)
  assert.equal(state.testCalls.at(-1).difficulty, 6, '8 充能以上难度改为 6')
  assert.equal(chargesOf(state), 8)
  // 魂灵收割：选「全体 1 伤害 1 恐惧」。
  state.choices = ['damage']
  behavior.resolveEncounter(state, inv, { code: RAW_CODES.spiritHarvest }, api)
  assert.equal(inv.damage, 3)
  assert.equal(inv.horror, 1)
  // 魂灵收割：选「朱三娘变换影穑 + 2 充能」（不翻面）。
  const tzuState = setup(stateFor(1))
  const tzuApi = apiStub(tzuState)
  tzuState.choices = ['tzu']
  const before = chargesOf(tzuState)
  behavior.resolveEncounter(tzuState, tzuState.investigators[0], { code: RAW_CODES.spiritHarvest }, tzuApi)
  assert.equal(chargesOf(tzuState), before + 2)
  assert.equal(shadeReaperFace(tzuState), SHADE_REAPER_KEY.unstableFace, '朱三娘变换不翻回稳定面')
})

test('P7 shadesOfSuffering 影穑 Shift：动荡面由调查员变换翻回稳定面；稳定面移动/攻击后翻到动荡面', () => {
  const state = setup(stateFor(1))
  const api = apiStub(state)
  const inv = state.investigators[0]
  inv.location = STATION_WEST_WING
  // Setup 是动荡面：调查员变换 → 每位调查员失去 1 行动，然后翻回稳定面。
  assert.equal(shadeReaperFace(state), SHADE_REAPER_KEY.unstableFace)
  const unstable = shiftShadeReaper(state, 0, api, { by: 'investigator' })
  assert.equal(unstable.kind, 'loseActions')
  assert.equal(shadeReaperFace(state), SHADE_REAPER_KEY.stableFace, '调查员变换动荡面 → 翻回稳定面')
  // 稳定面：选一个非精英敌人，可不移动、可攻击同地点的另一个敌人，然后翻到动荡面。
  state.round = 2
  const mover = api.spawn('01001', STATION_WEST_WING)
  mover.horror = 2
  const other = api.spawn('01002', STATION_WEST_WING)
  state.choices = [mover.id, 'skip', other.id]
  const stable = shiftShadeReaper(state, 0, api, { by: 'investigator' })
  assert.equal(stable.kind, 'moveAndClash')
  assert.equal(stable.face, SHADE_REAPER_KEY.stableFace)
  assert.equal(state.choices.length, 0, '移动与攻击各问一次')
  assert.equal(mover.location, STATION_WEST_WING, '选择「不移动」')
  assert.equal(other.damageTaken, 2, '原本的恐惧（2）作为伤害')
  assert.equal(shadeReaperFace(state), SHADE_REAPER_KEY.unstableFace, '稳定面变换后翻到动荡面')
  // 朱三娘变换动荡面：不翻面。
  state.round = 3
  const shifted = shiftShadeReaper(state, 0, api, { by: 'tzuSanNiang' })
  assert.equal(shifted.stable, false, '朱三娘变换后仍是动荡面')
  assert.equal(registeredEntry(RAW_CODES.shadeReaperStable).assetRule.shift.kind, 'moveAndClash')
  assert.equal(registeredEntry(RAW_CODES.shadeReaperUnstable).assetRule.shift.kind, 'loseActions')
})

// ---------------------------------------------------------------------------
// 7. 幕 / 密谋推进（含降头师幕间与收割）
// ---------------------------------------------------------------------------
test('P7 shadesOfSuffering 幕 1：与朱三娘交战并共同花费线索 → 推进幕（降头师幕间）', () => {
  const state = setup(stateFor(2))
  const api = apiStub(state)
  state.investigators[0].clues = 1
  state.investigators[1].clues = 1
  const truth = miniAll(state).find(card => !card.decoy)
  exposeAt(state, state.investigators[0], truth.id, api)
  const tzu = tzuEnemy(state)
  behavior.enemyEngaged(state, tzu, state.investigators[0], api)
  assert.equal(chapterState(state).act1Advanced, true)
  assert.equal(state.advancedAct, 1, '幕 1 推进')
  assert.equal(state.investigators[0].clues + state.investigators[1].clues, 0, '共同支付 2 个线索')
})

test('P7 shadesOfSuffering 幕 1：线索不足 → 朱三娘返回阴影并重新分配迷你卡', () => {
  const state = setup(stateFor(1))
  const api = apiStub(state)
  const truth = miniAll(state).find(card => !card.decoy)
  exposeAt(state, state.investigators[0], truth.id, api)
  const tzu = tzuEnemy(state)
  behavior.enemyEngaged(state, tzu, state.investigators[0], api)
  assert.equal(state.advancedAct || 0, 0)
  assert.equal(tzuEnemy(state), null)
  assert.equal(tzuInShadows(state), true)
  assert.equal(miniAll(state).length, CONCEALED_AMOUNT + 1, '重新分配后张数守恒')
})

test('P7 shadesOfSuffering 降头师幕间：三张地点入场、三只灵怪生成、毁灭清空、密谋跳到 2a', () => {
  const state = setup(stateFor(1))
  const api = apiStub(state)
  state.doom = 2
  const done = resolveBomohInterlude(state, api)
  assert.equal(done, true)
  for (const id of [ 'melatisShop', 'tinMine', 'wayangKulitTheater']) {
    const location = state.locations.find(item => item.id === id)
    assert.ok(location, `${id} 入场`)
    assert.equal(location.revealed, true)
  }
  const geists = nonWeaknessGeists(state)
  assert.equal(geists.length, 3, '三只灵怪生成')
  assert.equal(geists.find(enemy => enemy.location === STATION_WEST_WING).code,
    chapterState(state).geists.slainForeman, '被杀害的工头在火车站西翼')
  assert.equal(geists.find(enemy => enemy.location === WAYANG_KULIT_THEATER).code,
    chapterState(state).geists.uncannyShadow, '诡怪的阴影在哇扬皮影偶戏剧场')
  assert.equal(geists.find(enemy => enemy.location === TIN_MINE).code,
    chapterState(state).geists.buriedMiner, '被掩埋的矿工在锡矿')
  assert.equal(state.investigators[0].location, 'melatisShop', '全队移动到美拉提的商店')
  assert.equal(state.doom, 0, '移除场上其它毁灭')
  assert.equal(state.agendaIndex, 1, '密谋 1a 直接推进到 2a（不结算 1b）')
  // 朱三娘的迷你卡重新分配到有灵怪的地点（三只灵怪各一处，各 1 张）。
  const spots = new Set(miniAll(state).map(card => card.locationId))
  assert.deepEqual([...spots].sort(), [STATION_WEST_WING, TIN_MINE, WAYANG_KULIT_THEATER].sort())
  // 重复调用不再生效。
  assert.equal(resolveBomohInterlude(state, api), false)
})

test('P7 shadesOfSuffering 幕 2：轮末没有非弱点灵怪 → 推进幕；幕 2 背面翻到血债血偿并推进密谋 3a', () => {
  const state = setup(stateFor(1))
  const api = apiStub(state)
  state.actIndex = 1
  resolveBomohInterlude(state, api)
  assert.equal(nonWeaknessGeists(state).length, 3)
  behavior.roundEnded(state, api)
  assert.equal(state.advancedAct || 0, 0, '还有灵怪时不推进')
  state.enemies = []
  behavior.roundEnded(state, api)
  assert.equal(state.advancedAct, 1, '没有灵怪时推进')
  // 幕 2 背面：把朱三娘翻到血债血偿并把密谋直接推进到 3a。
  const back = setup(stateFor(1))
  const backApi = apiStub(back)
  back.actIndex = 1
  back.agendaIndex = 1
  behavior.actReveal(back, back.acts[1], backApi)
  assert.ok(tzuEnemy(back))
  assert.equal(tzuEnemy(back).code, TZU_SAN_NIANG_OUT_FOR_BLOOD)
  assert.equal(back.agendaIndex, 2, '密谋直接推进到 3a')
})

test('P7 shadesOfSuffering 密谋 1 背面：苦难历史（弃盟友检定或放毁灭）并推进幕', () => {
  const state = setup(stateFor(1))
  const api = apiStub(state)
  state.investigators[0].assets.push({ id: 'ally-1', code: '01004' })
  state.investigators[0].clues = 3
  state.choices = ['doom']
  behavior.agendaReveal(state, state.agendas[0], api)
  assert.equal(state.investigators[0].clues, 0, '每位调查员失去所有线索')
  assert.equal(chapterState(state).tzuDoom, 1, '在阴影中的朱三娘上放 1 毁灭（记在章节状态）')
  assert.equal(state.advancedAct, 1, '幕 1 → 幕 1b（降头师幕间）')
  // 弃盟友分支：检定意志(X)，失败在影穑上放 X 充能。
  const ALLY_COST = 4
  const ally = setup(stateFor(1))
  const allyApi = apiStub(ally)
  ally.investigators[0].assets.push({ id: 'ally-1', code: '11027' })
  ally.choices = ['ally']
  ally.testResults = [{ success: false, value: 0, difficulty: ALLY_COST }]
  behavior.agendaReveal(ally, ally.agendas[0], allyApi)
  assert.equal(ally.investigators[0].assets.length, 0, '盟友被弃掉')
  assert.equal(ally.testCalls.at(-1).skill, 'willpower')
  assert.equal(chargesOf(ally), ALLY_COST, '失败按印刷费用放充能')
})

test('P7 shadesOfSuffering 密谋 2 背面：她在场 → 攻击全体并返回阴影；在阴影 → 抓走灵怪 +4 充能', () => {
  // 在阴影中：抓住她真身迷你卡所在地点的灵怪（只留一只）→ +4 充能 → 幕推进到 2b。
  const state = setup(stateFor(1))
  const api = apiStub(state)
  resolveBomohInterlude(state, api)
  state.actIndex = 1
  state.agendaIndex = 1
  const keep = nonWeaknessGeists(state)[0]
  state.enemies = state.enemies.filter(enemy => enemy === keep)
  const truth = miniAll(state).find(card => !card.decoy)
  truth.locationId = keep.location
  const before = chargesOf(state)
  const result = resolveRestlessDeadBack(state, api)
  assert.equal(result.branch, 'shadows')
  const tzu = tzuEnemy(state)
  assert.ok(tzu, '朱三娘以真身迷你卡的位置入场')
  assert.equal(tzu.beneath.length, 1, '把灵怪压在身下')
  assert.equal(chargesOf(state), before + 4, '收割 +4 充能')
  assert.equal(state.advancedAct, 1, '没有灵怪留在场上：推进幕 2b')
  // 她在场：攻击同地点每位调查员并返回阴影。
  const inPlay = setup(stateFor(2))
  const inPlayApi = apiStub(inPlay)
  inPlay.agendaIndex = 1
  const exposedTruth = miniAll(inPlay).find(card => !card.decoy)
  exposeAt(inPlay, inPlay.investigators[0], exposedTruth.id, inPlayApi)
  const tzuInPlay = tzuEnemy(inPlay)
  inPlay.investigators[0].location = tzuInPlay.location
  inPlay.investigators[1].location = tzuInPlay.location
  const branch = resolveRestlessDeadBack(inPlay, inPlayApi)
  assert.equal(branch.branch, 'inPlay')
  assert.equal((inPlay.attacks || []).length, 2, '攻击该地点的每位调查员')
  assert.equal(tzuInShadows(inPlay), true)
})

test('P7 shadesOfSuffering 密谋 3：毁灭放置时翻出朱三娘底下的灵怪；背面全体被击败 → 结局 3', () => {
  const state = setup(stateFor(1))
  const api = apiStub(state)
  state.agendaIndex = 2
  behavior.checkObjectives(state, api)
  assert.equal(chapterState(state).agenda3, true)
  const tzu = flipTzuOutForBlood(state, api, { locationId: 'selangorClub' })
  const code = chapterState(state).geists.uncannyShadow
  tzu.beneath = [{ code, originalCode: code, facedown: true }]
  behavior.doomPlaced(state, { target: null, amount: 1, agenda: true }, api)
  assert.equal(state.enemies.some(enemy => enemy.code === code), true, '灵怪被翻出生成')
  assert.equal(tzu.beneath.length, 0)
  // 背面：每位调查员被击败 + 1 精神创伤 → 结局 3。
  behavior.agendaReveal(state, state.agendas[2], api)
  assert.equal(state.investigators[0].defeated, true)
  assert.equal(state.campaign.trauma['0:mental'], 1)
  assert.deepEqual(state.finished, ['resolution3'])
})

test('P7 shadesOfSuffering 幕 3：朱三娘（血债血偿）被击败 → 推进；背面二选一进入结局 1/2', () => {
  const state = setup(stateFor(1))
  const api = apiStub(state)
  state.actIndex = 2
  const tzu = flipTzuOutForBlood(state, api, { locationId: 'selangorClub' })
  behavior.enemyDefeated(state, tzu, api)
  assert.equal(chapterState(state).tzuDefeated, true)
  assert.equal(behavior.checkObjectives(state, api), true)
  assert.equal(state.advancedAct, 1)
  state.choices = ['resolution1']
  behavior.actReveal(state, state.acts[2], api)
  assert.deepEqual(state.finished, ['resolution1'])
  const letGo = setup(stateFor(1))
  const letGoApi = apiStub(letGo)
  letGo.choices = ['resolution2']
  behavior.actReveal(letGo, letGo.acts[2], letGoApi)
  assert.deepEqual(letGo.finished, ['resolution2'])
})

// ---------------------------------------------------------------------------
// 8. 地点行动
// ---------------------------------------------------------------------------
test('P7 shadesOfSuffering 地点：东翼快速移动/换小猫、西翼纪念品、美拉提查看、锡矿检定', () => {
  const state = setup(stateFor(1))
  const api = apiStub(state)
  const inv = state.investigators[0]
  inv.location = STATION_EAST_WING
  // [快速] 支付 2 资源移动（每回合一次；行动费用 0）。
  const fast = behavior.actions(state, inv).find(move => move.rule === 'loc:eastWingMove')
  assert.equal(fast.actions, 0)
  state.choices = ['stationWestWing']
  assert.equal(behavior.performAction(state, inv, fast, api), true)
  assert.equal(inv.resources, 3)
  assert.equal(inv.location, STATION_WEST_WING)
  inv.location = STATION_EAST_WING
  assert.ok(behavior.actions(state, inv).find(move => move.rule === 'loc:eastWingMove').reason, '每回合一次')
  // [行动] 弃支援换半价资源 + 记住小猫（团队每场游戏一次）。
  inv.location = STATION_EAST_WING
  inv.assets.push({ id: 'asset-1', code: '11033' })
  const kitten = behavior.actions(state, inv).find(move => move.rule === 'loc:eastWingKitten')
  assert.equal(behavior.performAction(state, inv, kitten, api), true)
  assert.equal(inv.resources, 3 + 1, '获得印刷费用一半（向下取整）的资源')
  assert.equal(hasRemembered(state, REMEMBERED.tradedForAKitten), true)
  assert.ok(behavior.actions(state, inv).find(move => move.rule === 'loc:eastWingKitten').reason)
  // 西翼：团队花费 1 线索 → 各治愈 2 恐惧 + 记住纪念品。
  inv.location = STATION_WEST_WING
  inv.clues = 1
  inv.horror = 3
  const memento = behavior.actions(state, inv).find(move => move.rule === 'loc:westWingMemento')
  assert.equal(behavior.performAction(state, inv, memento, api), true)
  assert.equal(inv.clues, 0)
  assert.equal(inv.horror, 1)
  assert.equal(hasRemembered(state, REMEMBERED.foundACheapMemento), true)
  // 美拉提的商店：查看灵怪另一面（私密日志）+ 记住「眺望彼端」。
  resolveBomohInterlude(state, api)
  inv.location = 'melatisShop'
  inv.clues = 1
  const geist = nonWeaknessGeists(state)[0]
  state.choices = [`enemy:${geist.id}`]
  const peek = behavior.actions(state, inv).find(move => move.rule === 'loc:melatiPeek')
  assert.equal(behavior.performAction(state, inv, peek, api), true)
  assert.equal(hasRemembered(state, REMEMBERED.peeredBeyond), true)
  assert.ok(state.infos.some(text => text.includes('灵怪的另一面')))
  // 锡矿：敏捷 6 检定成功 → 抽 2 + 记住遗骨；失败则受到 1 点伤害（forced）。
  inv.location = TIN_MINE
  inv.resources = 5
  state.testResults = [{ success: true, value: 7, difficulty: 6 }]
  state.choices = ['skip']
  const mine = behavior.actions(state, inv).find(move => move.rule === 'loc:tinMineTest')
  assert.equal(behavior.performAction(state, inv, mine, api), true)
  assert.equal(hasRemembered(state, REMEMBERED.foundHiddenBones), true)
  assert.equal(state.drawn.at(-1).amount, 2)
  const damageBefore = inv.damage
  behavior.afterTest(state, inv, { success: false, value: 1, difficulty: 6 }, api)
  assert.equal(inv.damage, damageBefore + 1, '锡矿检定失败后受到 1 点伤害')
})

test('P7 shadesOfSuffering 地点：俱乐部谈判、草坪加入球赛、剧场治愈', () => {
  const state = setup(stateFor(2))
  const api = apiStub(state)
  const inv = state.investigators[0]
  // 雪兰莪俱乐部：花 2 资源治愈 1 伤害 + 1 恐惧（每轮一次）。
  inv.location = 'selangorClub'
  inv.damage = 2
  inv.horror = 2
  const parley = behavior.actions(state, inv).find(move => move.rule === 'loc:selangorParley')
  assert.equal(behavior.performAction(state, inv, parley, api), true)
  assert.equal(inv.resources, 3)
  assert.equal(inv.damage, 1)
  assert.equal(inv.horror, 1)
  assert.ok(behavior.actions(state, inv).find(move => move.rule === 'loc:selangorParley').reason, '每轮一次')
  // 草坪：战斗 4 失败 → 记住「让领事蒙羞」；成功 → 3 资源（本轮一次）。
  inv.location = 'selangorClubPadang'
  state.testResults = [{ success: false, value: 1, difficulty: 4 }]
  const padang = behavior.actions(state, inv).find(move => move.rule === 'loc:padangParley')
  assert.equal(behavior.performAction(state, inv, padang, api), true)
  assert.equal(hasRemembered(state, REMEMBERED.embarrassedTheConsulate), true)
  inv.resources = 0
  state.testResults = [{ success: true, value: 6, difficulty: 4 }]
  assert.equal(behavior.performAction(state, inv, padang, api), true)
  assert.equal(inv.resources, 3)
  assert.ok(behavior.actions(state, inv).find(move => move.rule === 'loc:padangParley').reason)
  // 剧场：团队花 2 线索 → 各治愈 2 伤害 + 记住「分担深沉的痛苦」。
  resolveBomohInterlude(state, api)
  inv.location = WAYANG_KULIT_THEATER
  inv.damage = 3
  inv.clues = 2
  const heal = behavior.actions(state, inv).find(move => move.rule === 'loc:wayangHeal')
  assert.equal(behavior.performAction(state, inv, heal, api), true)
  assert.equal(inv.damage, 1)
  assert.equal(hasRemembered(state, REMEMBERED.sharedADeepPain), true)
  // 哇扬皮影偶戏剧场的帷幕 = ⌈充能/2⌉（上限 8）。
  setCharges(state, 0)
  addCharges(state, 6)
  const wayang = state.locations.find(location => location.id === WAYANG_KULIT_THEATER)
  assert.equal(behavior.locationShroudModifier(state, wayang), 3)
  addCharges(state, 40)
  assert.equal(behavior.locationShroudModifier(state, wayang), 8)
})

// ---------------------------------------------------------------------------
// 9. 结局与记录 / 时间
// ---------------------------------------------------------------------------
test('P7 shadesOfSuffering 结局：四个结局的记录、经验、时间与影穑归属', () => {
  const base = (records = {}) => {
    const state = setup(stateFor(2, { records }))
    const api = apiStub(state)
    return { state, api }
  }
  // 结局 1：用伞制住她 → 记「受你摆布」、每人 1 点肉体创伤、影穑交给调查员、时间 +1。
  const r1 = base()
  r1.state.choices = ['1']
  let result = behavior.resolution(r1.state, 'resolution1', [], r1.api)
  assert.equal(r1.state.campaign.records.tzuSanNiangIsUnderYourSway, true)
  assert.equal(r1.state.campaign.records.shadeReaperBearer, 1)
  assert.equal(r1.state.campaign.trauma['0:physical'], 1)
  assert.equal(result.bonus, 1, '每个已安息的灵怪 +1 经验')
  assert.equal(r1.state.campaign.records.time, 1)
  // 结局 2：放她走 → 记「你还没见过她最后一面」、影穑交给调查员、时间 +1。
  const r2 = base()
  r2.state.choices = ['0']
  result = behavior.resolution(r2.state, 'resolution2', [], r2.api)
  assert.equal(r2.state.campaign.records.youHaventSeenTheLastOfTzuSanNiang, true)
  assert.equal(r2.state.campaign.records.shadeReaperBearer, 0)
  assert.equal(result.bonus, 0)
  assert.equal(r2.state.campaign.records.time, 1)
  // 结局 3：被她控制 → 记「受她摆布」、影穑归她、时间 +1。
  const r3 = base()
  result = behavior.resolution(r3.state, 'resolution3', [], r3.api)
  assert.equal(r3.state.campaign.records.tzuSanNiangHasYouUnderHerSway, true)
  assert.equal(r3.state.campaign.records.shadeReaperBearer, 'tzuSanNiang')
  assert.equal(typeof result.bonus, 'number')
  assert.equal(r3.state.campaign.records.time, 1)
  // 未达成：记「你还没见过她最后一面」、影穑归她。
  const noRes = base()
  result = behavior.resolution(noRes.state, 'noResolution', [], noRes.api)
  assert.ok(result.story.paragraphs[0].length > 20)
  assert.equal(noRes.state.campaign.records.youHaventSeenTheLastOfTzuSanNiang, true)
  // finalResolution 的默认判定：幕 3 背面的二选一优先，其次她是否被击败过。
  assert.equal(behavior.finalResolution(noRes.state), 'noResolution')
  assert.equal(behavior.finalResolution(r3.state), 'noResolution')
  const chosen = base()
  chosen.state.choices = ['resolution1']
  behavior.actReveal(chosen.state, chosen.state.acts[2], chosen.api)
  assert.equal(behavior.finalResolution(chosen.state), 'resolution1')
})

test('P7 shadesOfSuffering 时间：markTime 累加记录并在世界地图存在时同步', () => {
  const state = setup(stateFor(1))
  assert.equal(markTime(state, 2), 2)
  assert.equal(markTime(state, 1), 3)
  state.campaign.tsk = { map: { version: 1, current: 'KualaLumpur', visited: ['KualaLumpur'], unlocked: ['KualaLumpur'], time: 0, forcedNode: null } }
  markTime(state, 2)
  assert.equal(state.campaign.records.time, 5)
  assert.equal(state.campaign.tsk.map.time, 5, '世界地图已初始化时同步时间轴')
})

// ---------------------------------------------------------------------------
// 10. 开场正文 / JSON 往返 / 条目
// ---------------------------------------------------------------------------
test('P7 shadesOfSuffering 开场正文：福林去过吉隆坡 → Intro 1，否则 Intro 2', () => {
  const traveled = behavior.introduction(scenario, { flintTraveledToKualaLumpur: true })
  assert.ok(traveled.paragraphs[0].includes('福林') || traveled.paragraphs[0].length > 100)
  assert.notEqual(traveled.paragraphs[0], behavior.introduction(scenario, {}).paragraphs[0])
  assert.equal(traveled.code, RAW_CODES.act1)
})

test('P7 shadesOfSuffering JSON 往返：布置 / 幕间 / 充能 / 记录可序列化复原并通过读档校验', () => {
  const state = setup(stateFor(2, { records: { time: 19 } }))
  const api = apiStub(state)
  addCharges(state, 2, api)
  markTime(state, 1)
  const restored = JSON.parse(JSON.stringify(state))
  validateTskState(restored)
  assert.equal(chargesOf(restored), 8)
  assert.equal(chapterSummary(restored).concealed.length, CONCEALED_AMOUNT + 1)
  assert.equal(Object.keys(chapterState(restored).geists).length, 3)
  assert.equal(restored.campaign.records.time, 20)
  // 幕间之后同样可往返（地点入场、灵怪生成、密谋跳转）。
  resolveBomohInterlude(restored, apiStub(restored))
  const afterInterlude = JSON.parse(JSON.stringify(restored))
  validateTskState(afterInterlude)
  assert.equal(afterInterlude.locations.length, 7)
  assert.equal(nonWeaknessGeists(afterInterlude).length, 3)
  assert.equal(afterInterlude.agendaIndex, 1)
  // 朱三娘返回阴影后的迷你卡与章节旗标同样往返。
  returnTzuToShadows(afterInterlude, apiStub(afterInterlude))
  const afterReturn = JSON.parse(JSON.stringify(afterInterlude))
  validateTskState(afterReturn)
  assert.equal(tzuInShadows(afterReturn), true)
  assert.equal(shadesOfSufferingChaosToken(afterReturn, afterReturn.investigators[0], 'skull').delta,
    -skullModifier(afterReturn))
})

test('P7 shadesOfSuffering 条目：十八条专属条目（6 灵怪 / 2 朱三娘 / 2 诡计 / 6 剧情 / 2 密钥）具备可执行声明', () => {
  assert.equal(ENTRIES.length, 18)
  assert.deepEqual(ENTRIES.map(entry => entry.code).sort(), [
    '09674a', '09674b', '09674c', '09674d', '09675a', '09675b', '09675c', '09675d',
    '09676a', '09676b', '09676c', '09676d', '09677', '09678', '09679a', '09679b', '09680a', '09680b',
  ])
  for (const entry of ENTRIES) {
    assert.equal(entry.implemented, true, `${entry.code} 必须声明 implemented`)
    assert.ok(entry.enemyRule || entry.treacheryRule || entry.assetRule,
      `${entry.code} 不能是空壳`)
    assert.ok(String(entry.note || '').length > 0, `${entry.code} 必须写清近似/读点`)
  }
  // 声明即接线：灵怪条目 → behavior 的谈判/剧情；朱三娘/影穑的数值与 shift 读点。
  for (const pair of GEIST_PAIRS) {
    const rule = registeredEntry(pair.enemy).enemyRule
    assert.equal(rule.geist.story, pair.story)
    assert.equal(rule.geist.fact, pair.fact)
    assert.equal(registeredEntry(pair.story).assetRule.geistStory.fact, pair.fact)
    assert.equal(geistStoryOf(null, pair.enemy).story, pair.story)
    assert.equal(concealedAmountOf(TZU_SAN_NIANG), CONCEALED_AMOUNT)
  }
  assert.equal(registeredEntry(TZU_SAN_NIANG).enemyRule.returnsToShadowsWhenDefeated, true)
  assert.equal(registeredEntry(TZU_SAN_NIANG_OUT_FOR_BLOOD).enemyRule.drainsShadeReaperOnSuccess, true)
  assert.equal(registeredEntry(TZU_SAN_NIANG_OUT_FOR_BLOOD).enemyRule.healthPerPlayerBonus, 2)
  assert.equal(registeredEntry(RAW_CODES.excruciate).treacheryRule.chargeOnReveal, 1)
  assert.equal(registeredEntry(RAW_CODES.spiritHarvest).treacheryRule.charges, 2)
  assert.equal(registeredEntry(RAW_CODES.shadeReaperUnstable).assetRule.shift.flipOnShift, 'investigatorOnly')
  assert.ok(chapter.behavior.scenarioApproximations.length >= 5, '近似必须逐条披露')
  assert.ok(chapter.behavior.scenarioGaps.length >= 1)
  // 章节目录下的条目目录与 CHAPTER_ENTRY_CODES 一致。
  assert.deepEqual([...chapter.CHAPTER_ENTRY_CODES].sort(), ENTRIES.map(entry => entry.code).sort())
})

// ---------------------------------------------------------------------------
// 11. 辅助函数（团队线索 / 记住 / 充能 / 密钥面）
// ---------------------------------------------------------------------------
test('P7 shadesOfSuffering 辅助：团队线索扣除顺序、记住事实去重、充能不出现负值', () => {
  const state = setup(stateFor(2))
  const api = apiStub(state)
  state.investigators[0].location = STATION_WEST_WING
  state.investigators[1].location = STATION_WEST_WING
  state.investigators[0].clues = 1
  state.investigators[1].clues = 2
  assert.equal(groupCluesAt(state, STATION_WEST_WING), 3)
  assert.equal(spendGroupClues(state, api, 2, { locationId: STATION_WEST_WING }), 2)
  assert.equal(state.investigators[0].clues, 0)
  assert.equal(state.investigators[1].clues, 1)
  assert.equal(spendGroupClues(state, api, 5, { anywhere: true }), 1, '只支付现有线索')
  assert.equal(rememberedFacts(state).length, 0)
  assert.equal(behavior.actions(state, state.investigators[0]).length > 0, true)
  setCharges(state, 3)
  removeCharges(state, 10)
  assert.equal(chargesOf(state), 0, '充能不会变成负数')
  assert.equal(state.scenarioFlags[CHARGE_FLAG], 0)
  // 密钥面：翻到动荡面/稳定面都由同一记录承担。
  ensureShadeReaper(state, api)
  assert.equal(scarletKey(state, SHADE_REAPER_KEY.id).stableFace, SHADE_REAPER_KEY.stableFace)
})
