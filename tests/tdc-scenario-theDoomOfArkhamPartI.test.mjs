// P7 阿卡姆的毁灭 第一部分（theDoomOfArkhamPartI · 提示卡 11682）章节测试。
//
// 覆盖：章节结构/manifest、午夜假面地图与变体地点、6 处地点下方暗牌、幽灵商店显现与兰道尔、
// 幕 1 目标/背面分流、神器划除/黏土恐怖/淹没街区记录、四档混乱标记、JSON 存档往返、
// 真实 saveSnapshot/readSnapshot 存档重放（CONTINUATION §2.1）。
//
// 本文件不 import engine.js：章节 behavior 只走内容层函数与 P2 原语（网格/水位用 mechanicState），
// 因此单测可在其他 worker 尚未重建索引时独立运行。
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { persistEnabled, readSnapshot, saveSnapshot } from '../../../lib/sessions.js'
import { registerCardAbilities, registeredEntry } from '../src/engine/ability.js'
import { mechanicState } from '../src/engine/mechanic-state.js'
import * as chapter from '../content/campaigns/theDrownedCity/scenarios/theDoomOfArkhamPartI/index.js'
import {
  scenario, ACT_CODES, AGENDA_CODES, ACT_STAGES, AGENDA_STAGES, LOCATIONS, LOCATION_CONNECTIONS,
  LOCATION_COORDINATES, LOCATION_VARIANTS, BASE_LOCATION_IDS, HIDING_LOCATION_IDS,
  SET_ASIDE_LOCATION_IDS, SET_ASIDE_CARDS, ENCOUNTER_DECK, ENCOUNTER_DECK_CODES,
  MIDNIGHT_MASKS_DECK_CODES, IMPLEMENTED_ENTRY_CODES, RESOLUTION_KEYS, SCENARIO_TEXT,
  PHANTOM_SHOP_ACT_CODE, TILLINGHAST_ESOTERICA_CODE, RANDALL_TILLINGHAST_CODE, LEGRASSE_CODE,
  HORROR_IN_CLAY_CODE, RESOLUTION_ARTIFACT_COUNT,
} from '../content/campaigns/theDrownedCity/scenarios/theDoomOfArkhamPartI/definition.js'
import {
  behavior, setupScenario, artifactsControlled, takeTopBeneath, takeTopBeneathCode,
  scenarioSummary,
} from '../content/campaigns/theDrownedCity/scenarios/theDoomOfArkhamPartI/behavior.js'
import {
  doomOfArkhamPartOneChaosToken, doomOfArkhamPartOneChaosTokenValue, skullValue,
  locationsWithoutBeneath, isHardSide, CHAOS_TOKEN_FACES,
} from '../content/campaigns/theDrownedCity/scenarios/theDoomOfArkhamPartI/chaos.js'
import entry11683 from '../src/cards/encounter-entries/theDrownedCity/theDoomOfArkhamPartI/11683.js'
import entry11684 from '../src/cards/encounter-entries/theDrownedCity/theDoomOfArkhamPartI/11684.js'
import entry11685 from '../src/cards/encounter-entries/theDrownedCity/theDoomOfArkhamPartI/11685.js'
import entry11686 from '../src/cards/encounter-entries/theDrownedCity/theDoomOfArkhamPartI/11686.js'
// 归属算法把两章共用的 11687 落 theDoomOfArkhamPartII（同一战役多章不建 _shared 的例外见 placement 规则）。
import entry11687 from '../src/cards/encounter-entries/theDrownedCity/theDoomOfArkhamPartII/11687.js'
import entry11688 from '../src/cards/encounter-entries/theDrownedCity/theDoomOfArkhamPartI/11688.js'

const ENTRIES = [entry11683, entry11684, entry11685, entry11686, entry11687, entry11688]
for (const entry of ENTRIES) if (!registeredEntry(entry.code)) registerCardAbilities([entry])

const floorApi = (api, state) => {
  api.mechanics = {
    water: {
      level: id => Number(mechanicState(state)?.flood?.[id]) || 0,
      change: (id, delta) => {
        const data = mechanicState(state, true)
        data.flood ||= {}
        data.flood[id] = Math.max(0, Math.min(2, (Number(data.flood[id]) || 0) + delta))
        return data.flood[id]
      },
    },
    map: { nearest: () => [] },
  }
  return api
}

function makeApi(state, options = {}) {
  let serial = 0
  const api = {
    state,
    info: () => {},
    finished: null,
    choose: options.choose || (() => 'advance'),
    random: options.random || (() => 0.5),
    shuffle: options.shuffle || (list => [...list]),
    giveAsset(seat, code) {
      const inv = state.investigators[seat]
      if (!inv) return null
      const asset = {
        id: `asset-${code}-${++serial}`, code, originalCode: code, name: code,
        controllerSeat: seat, ownerSeat: seat, exhausted: false, damage: 0, horror: 0,
        tokens: 0, attachments: [],
      }
      inv.assets.push(asset)
      return asset
    },
    removeAsset(seat, assetId) {
      const inv = state.investigators[seat]
      const index = inv?.assets?.findIndex(asset => asset.id === assetId) ?? -1
      if (index < 0) return null
      return inv.assets.splice(index, 1)[0].code
    },
    exemptAssetSlot(asset, slot) {
      asset.ignoredSlots ||= []
      asset.ignoredSlots.push(slot)
      return true
    },
    spawn(code, location, extra = {}) {
      const enemy = {
        id: `${code}-${++serial}`, code, originalCode: code, name: code, location,
        fight: 1, evade: 3, health: 1, damage: 1, horror: 1, damageTaken: 0, doom: 0,
        exhausted: false, engagedSeat: null, traits: [], attachments: [], victory: 1,
        ...extra,
      }
      state.enemies.push(enemy)
      return enemy
    },
    drawEncounter() { return state.encounterDeck.pop() || null },
    placeDoomOnCard(card, amount = 1) { card.doom = (Number(card.doom) || 0) + amount; return amount },
    addCluesToLocation(id, amount = 1) {
      const location = state.locations.find(item => item.id === id)
      if (!location) return 0
      location.clues = (Number(location.clues) || 0) + amount
      return location.clues
    },
    loseClues(seat, amount = 1) {
      const inv = state.investigators[seat]
      const lost = Math.min(amount, Number(inv.clues) || 0)
      inv.clues -= lost
      return lost
    },
    drawAnotherChaosToken(seat) { api.drewAnotherToken = seat; return true },
    addScenarioXpBonus(seat, amount = 1) {
      const inv = state.investigators[seat]
      inv.scenarioXpBonus = (Number(inv.scenarioXpBonus) || 0) + amount
    },
    advanceAct() { behavior.actReveal(state, state.acts[state.actIndex], api) },
    finish(key) { api.finished = key },
  }
  return floorApi(api, state)
}

const investigator = (seat, location = null) => ({
  seat, name: `调查员${seat + 1}`, location, damage: 0, horror: 0, clues: 1, resources: 5,
  assets: [], hand: [], deck: [], discard: [], threat: [], defeated: false, resigned: false,
})
const stateFor = (count = 2, records = {}, difficulty = 'standard') => ({
  investigators: Array.from({ length: count }, (_, seat) => investigator(seat)),
  locations: [], enemies: [], storyAssets: [], encounterDeck: [], encounterDiscard: [],
  scenarioFlags: {}, scenarioZones: {}, victoryDisplay: [],
  campaign: { leadSeat: 0, records: { ...records }, trauma: {}, investigators: {} },
  doom: 0, difficulty, numInvestigators: count, phase: 'investigation', round: 1, status: 'playing',
})

const withScenario = (count = 2, { records = {}, difficulty = 'standard' } = {}) => {
  const state = stateFor(count, records, difficulty)
  state.scenario = structuredClone(scenario)
  return state
}

// ---------------------------------------------------------------------------
// 1. 结构 / manifest / 数据
// ---------------------------------------------------------------------------
test('P7 theDoomOfArkhamPartI 章节结构：6 张条目、12 地点、1 幕 1 议程、4 结局键', () => {
  assert.equal(chapter.scenario.id, 'theDoomOfArkhamPartI')
  assert.equal(chapter.scenario.originalCode, '11682')
  assert.equal(chapter.scenario.referenceCode, '11682')
  assert.equal(chapter.manifest.status, 'playable')
  assert.equal(chapter.manifest.campaignId, 'theDrownedCity')
  assert.equal(chapter.manifest.referenceCode, '11682')
  assert.equal(chapter.manifest.contentVersion, '0.1.0')
  assert.deepEqual([...ACT_CODES], ['11684'])
  assert.deepEqual([...AGENDA_CODES], ['11683'])
  assert.deepEqual([...RESOLUTION_KEYS], ['noResolution', 'resolution1', 'resolution2', 'resolution3'])
  assert.deepEqual(chapter.manifest.resolutionIds, [...RESOLUTION_KEYS])
  assert.equal(chapter.implementedEncounterCodes.length, 6)
  assert.deepEqual([...chapter.implementedEncounterCodes].sort(), [...IMPLEMENTED_ENTRY_CODES].sort())
  assert.equal(chapter.manifest.acts.length, 1)
  assert.equal(chapter.manifest.agendas.length, 1)
  assert.equal(Object.keys(LOCATIONS).length, 10)
  assert.equal(chapter.manifest.locations.length, 10)
  // 幕 1 目标：轮末在幽灵商店控制 ≥1 张神器。
  assert.equal(ACT_STAGES[1].objective.type, 'phantomShop')
  assert.equal(ACT_STAGES[1].objective.atLocation, 'tillinghastEsoterica')
  assert.equal(ACT_STAGES[1].objective.roundEnd, true)
  assert.ok(AGENDA_STAGES[1].doomThreshold > 0)
  // 剧情正文（优先自译中文，缺译回退英文原文）与指南步骤
  assert.ok(['zh', 'en'].includes(SCENARIO_TEXT.textLanguage))
  assert.ok(SCENARIO_TEXT.heading.length > 0)
  assert.ok(SCENARIO_TEXT.intro.length > 0)
  assert.ok(SCENARIO_TEXT.setup.length > 0)
  assert.equal(SCENARIO_TEXT.setupSteps.length, 14)
  for (const key of RESOLUTION_KEYS) assert.ok(SCENARIO_TEXT.resolutions[key].length > 0)
  // 单卡条目
  assert.equal(registeredEntry('11685').flags.ephemeralShop, true)
  assert.equal(registeredEntry('11686').flags.fightPerBeneath, 1)
  assert.equal(registeredEntry('11688').flags.artifact, true)
  assert.equal(registeredEntry('11687').implemented, true)
  // 第二轮收口：11687 被动 +1 走 testValue 修正，反应走 testBegins；11688 现为受控剧情资产。
  assert.equal(registeredEntry('11687').modifiers.some(modifier => modifier.target === 'testValue'), true)
  assert.equal(registeredEntry('11687').abilities.some(ability => ability.trigger.includes('testBegins')), true)
  assert.equal(registeredEntry('11688').implemented, true)
  assert.equal(registeredEntry('11688').controlledAsset, true)
  assert.deepEqual(registeredEntry('11688').storyAssetRule.enemyOverride,
    { trait: 'Star Spawn', lose: ['patrol', 'prey'], gain: ['hunter'], prey: 'controller' })
  assert.equal(registeredEntry('11688').flags.horrorInClay, true)
})

test('P7 theDoomOfArkhamPartI 遭遇牌库：按印刷份数展开，商店/兰道尔/午夜假面诡计不入库', () => {
  assert.ok(ENCOUNTER_DECK.length > 0)
  assert.equal(ENCOUNTER_DECK.length, ENCOUNTER_DECK_CODES.reduce((sum, code) => {
    const card = chapter.CARD_DATA[code]
    return sum + Math.max(1, Number(card?.quantity) || 1)
  }, 0))
  assert.equal(ENCOUNTER_DECK.includes(TILLINGHAST_ESOTERICA_CODE), false)
  assert.equal(ENCOUNTER_DECK.includes(RANDALL_TILLINGHAST_CODE), false, '兰道尔放在一边')
  for (const code of MIDNIGHT_MASKS_DECK_CODES) assert.equal(ENCOUNTER_DECK.includes(code), false, `午夜假面诡计 ${code} 在地点下方`)
  assert.equal(new Set(MIDNIGHT_MASKS_DECK_CODES).size, 2)
  assert.equal(MIDNIGHT_MASKS_DECK_CODES.length, 5)
  assert.deepEqual([...SET_ASIDE_CARDS], [RANDALL_TILLINGHAST_CODE, HORROR_IN_CLAY_CODE])
  const aside = Object.fromEntries(chapter.manifest.zones.setAside.map(entry => [entry.cardCode, entry.count]))
  assert.equal(aside[RANDALL_TILLINGHAST_CODE], 1)
  assert.equal(aside[HORROR_IN_CLAY_CODE], 1)
  for (const id of SET_ASIDE_LOCATION_IDS) assert.equal(aside[LOCATIONS[id].code], 1)
})

// ---------------------------------------------------------------------------
// 2. Setup / 地图 / 商店
// ---------------------------------------------------------------------------
test('P7 theDoomOfArkhamPartI Setup：变体地点、6 处暗牌、勒格拉斯入场、星之眷族随机移除', () => {
  const state = withScenario(2)
  const api = makeApi(state)
  const report = setupScenario(state, api)
  assert.equal(state.locations.length, 7, '午夜假面 5 张固定地点 + 2 张随机变体（商店不在 Setup 入场）')
  assert.match(report.variants.downtown, /^0113[01]$/)
  assert.match(report.variants.southside, /^0112[67]$/)
  assert.equal(state.doom, 2, '议程初始毁灭 = 调查员人数')
  assert.equal(state.acts[0].originalCode, '11684')
  assert.equal(state.agendas[0].originalCode, '11683')
  // 6 处地点各 1 张暗牌：幽灵商店 1 张 + 午夜假面诡计 5 张（01135×3、01136×2，卡号重复但实物不同）。
  const beneath = Object.values(state.scenarioZones.beneathStacks).flat()
  assert.equal(Object.keys(state.scenarioZones.beneathStacks).length, 6)
  assert.equal(beneath.length, 6)
  assert.equal(beneath.filter(code => code === TILLINGHAST_ESOTERICA_CODE).length, 1)
  assert.equal(beneath.filter(code => code === '01135').length, 3)
  assert.equal(beneath.filter(code => code === '01136').length, 2)
  assert.ok(Object.values(state.scenarioZones.beneathStacks).every(stack => stack.length === 1))
  // 勒格拉斯入场且豁免盟友槽
  const legrasse = state.investigators[0].assets.find(asset => asset.code === LEGRASSE_CODE)
  assert.ok(legrasse)
  assert.deepEqual(legrasse.ignoredSlots, ['ally'])
  // 星之眷族移除 2 张（标准难度）
  const removed = state.scenarioFlags.doomArkhamPartOneStarSpawnRemoved
  assert.equal(removed.length, 2)
  assert.equal(state.encounterDeck.filter(code => removed.includes(code)).length, 0)
  const remaining = state.encounterDeck.filter(code => ['11725', '11726', '11727', '11728'].includes(code))
  assert.equal(remaining.length, 2)
  // 简单难度移除 3 张
  const easyState = withScenario(2, { difficulty: 'easy' })
  setupScenario(easyState, makeApi(easyState))
  assert.equal(easyState.scenarioFlags.doomArkhamPartOneStarSpawnRemoved.length, 3)
})

test('P7 theDoomOfArkhamPartI 地点连接：午夜假面印刷连接 + 布局投影', () => {
  assert.deepEqual([...LOCATION_CONNECTIONS.northside].sort(), ['downtown', 'miskatonicUniversity'])
  assert.deepEqual([...LOCATION_CONNECTIONS.downtown].sort(), ['easttown', 'northside'])
  assert.deepEqual([...LOCATION_CONNECTIONS.miskatonicUniversity].sort(),
    ['northside', 'rivertown', 'southside', 'stMarysHospital'])
  assert.deepEqual(LOCATION_COORDINATES.northside, { x: 1, y: 0 })
  assert.equal(chapter.layout.locations.northside.x, 1)
  for (const edge of chapter.layout.edges) {
    assert.ok(LOCATIONS[edge.from] && LOCATIONS[edge.to])
    assert.ok(LOCATIONS[edge.from].connections.includes(edge.to), `布局边必须来自真实连接 ${edge.from}->${edge.to}`)
  }
  const state = withScenario(2)
  setupScenario(state, makeApi(state))
  assert.equal(state.locations.every(location => location.revealed === true), true, '起始地点正面入场')
  assert.equal(state.locations.find(location => location.id === 'rivertown').clues, 2, '河岸城 1[per_investigator]（2 人局 2）')
})

test('P7 theDoomOfArkhamPartI 商店显现：放在抽出的地点旁、生成兰道尔、神器暗堆', () => {
  const state = withScenario(2, { records: { barrierNode: true, tidalTablet: true } })
  const api = makeApi(state)
  setupScenario(state, api)
  const host = Object.entries(state.scenarioZones.beneathStacks)
    .find(([, stack]) => stack[0] === TILLINGHAST_ESOTERICA_CODE)[0]
  const code = takeTopBeneathCode(state, host, api)
  assert.equal(code, TILLINGHAST_ESOTERICA_CODE)
  const shop = state.locations.find(location => location.originalCode === TILLINGHAST_ESOTERICA_CODE)
  assert.ok(shop, '商店入场')
  assert.deepEqual(shop.connections, [host])
  assert.ok(state.locations.find(location => location.id === host).connections.includes(shop.id))
  const randall = state.enemies.find(enemy => enemy.code === RANDALL_TILLINGHAST_CODE)
  assert.ok(randall, '兰道尔在商店生成')
  assert.equal(randall.location, shop.id)
  // 已获得神器洗到商店下方
  const beneathShop = state.scenarioZones.beneathStacks[shop.id]
  assert.deepEqual([...beneathShop].sort(), ['11552', '11611'])
})

test('P7 theDoomOfArkhamPartI 幕 1 行动：共同支付线索抽暗牌，控制支援/神器', () => {
  const state = withScenario(2)
  const api = makeApi(state)
  setupScenario(state, api)
  const [host] = Object.entries(state.scenarioZones.beneathStacks)
    .find(([, stack]) => stack[0] !== TILLINGHAST_ESOTERICA_CODE)
  state.investigators.forEach(inv => { inv.location = host; inv.clues = 1 })
  const moves = behavior.actions(state, state.investigators[0])
  const draw = moves.find(move => move.rule === 'doomArkhamDrawBeneath')
  assert.ok(draw, '有暗牌 + 线索足够时提供行动')
  assert.equal(draw.actions, 1)
  const before = state.investigators.reduce((sum, inv) => sum + inv.clues, 0)
  assert.equal(behavior.performAction(state, state.investigators[0], draw, api), true)
  const after = state.investigators.reduce((sum, inv) => sum + inv.clues, 0)
  assert.equal(before - after, 2, '共同支付 1[per_investigator] 线索')
  assert.equal(takeTopBeneath(state, host), null)
})

// ---------------------------------------------------------------------------
// 3. 幕背面 / 结局
// ---------------------------------------------------------------------------
test('P7 theDoomOfArkhamPartI 幕 1 背面：≥5 神器 → 结局 1，否则 +1 额外经验 → 结局 2', () => {
  const state = withScenario(2)
  const api = makeApi(state)
  setupScenario(state, api)
  state.investigators[0].assets.push(
    { id: 'a1', code: '11552', originalCode: '11552', traits: ['Item', 'Artifact'], controllerSeat: 0 },
    { id: 'a2', code: '11611', originalCode: '11611', traits: ['Item', 'Artifact'], controllerSeat: 0 },
    { id: 'a3', code: '11582', originalCode: '11582', traits: ['Item', 'Artifact'], controllerSeat: 0 },
    { id: 'a4', code: '11638', originalCode: '11638', traits: ['Item', 'Artifact'], controllerSeat: 0 },
    { id: 'a5', code: '11672a', originalCode: '11672a', traits: ['Item', 'Artifact'], controllerSeat: 0 },
  )
  assert.equal(artifactsControlled(state).length, 5)
  behavior.actReveal(state, state.acts[0], api)
  assert.equal(api.finished, 'resolution1')
  assert.equal(state.scenarioFlags.doomArkhamPartOneActResolved, 'resolution1')

  const weak = withScenario(2)
  const weakApi = makeApi(weak)
  setupScenario(weak, weakApi)
  weak.investigators[0].assets.push(
    { id: 'w1', code: '11552', originalCode: '11552', traits: ['Item', 'Artifact'], controllerSeat: 0 },
  )
  behavior.actReveal(weak, weak.acts[0], weakApi)
  assert.equal(weakApi.finished, 'resolution2')
  assert.equal(weak.investigators.every(inv => inv.scenarioXpBonus === 1), true, '每人 +1 额外经验')
  assert.equal(weak.scenarioFlags.doomArkhamPartOneActResolved, 'resolution2')
})

test('P7 theDoomOfArkhamPartI 结局：神器划除、黏土恐怖、淹没街区记录', () => {
  const state = withScenario(2, { records: { barrierNode: true, tidalTablet: true } })
  const api = makeApi(state)
  setupScenario(state, api)
  // 控制黏土恐怖与 barrierNode；未控制 tidalTablet
  state.investigators[0].assets.push(
    { id: 'h', code: HORROR_IN_CLAY_CODE, originalCode: HORROR_IN_CLAY_CODE, traits: ['Item', 'Artifact'], controllerSeat: 0 },
    { id: 'b', code: '11552', originalCode: '11552', traits: ['Item', 'Artifact'], controllerSeat: 0 },
  )
  behavior.changeFloodLevel(state, 'rivertown', 1, api)
  behavior.changeFloodLevel(state, 'northside', 1, api)
  behavior.resolution(state, 'resolution1', null, api)
  const records = state.campaign.records
  assert.equal(records.horrorInClay, true)
  assert.equal(records.barrierNode, true)
  assert.equal(records.tidalTablet, false, '未控制的已获得神器被划除')
  assert.deepEqual([...records.floodedNeighborhoods].sort(), ['01125', '01134'])
  const summary = scenarioSummary(state)
  assert.equal(summary.flooded.length, 2)
  // 存档往返
  const saved = JSON.parse(JSON.stringify(state))
  assert.deepEqual(scenarioSummary(saved).flooded, summary.flooded)
})

// ---------------------------------------------------------------------------
// 4. 混乱标记
// ---------------------------------------------------------------------------
test('P7 theDoomOfArkhamPartI 四档混乱符号与失败效果', () => {
  assert.deepEqual([...CHAOS_TOKEN_FACES], ['skull', 'cultist', 'tablet', 'elderthing'])
  const state = withScenario(2, { records: {} }, 'standard')
  const api = makeApi(state)
  setupScenario(state, api)
  // 7 处入场地点中 6 处有暗牌 → 1 处没有。
  assert.equal(locationsWithoutBeneath(state), 1)
  const withBeneath = Object.keys(state.scenarioZones.beneathStacks)
  for (const id of withBeneath.slice(0, 3)) state.scenarioZones.beneathStacks[id] = []
  // 清掉 3 处后：3 处仍有暗牌 → 7-3 = 4 处没有。
  assert.equal(locationsWithoutBeneath(state), 4)
  // 期望：简单/普通 ceil(4/2)=2；困难/专家 4
  assert.equal(skullValue(state), -2)
  assert.equal(skullValue({ ...state, difficulty: 'hard' }), -4)
  assert.equal(isHardSide({ difficulty: 'expert' }), true)
  assert.equal(doomOfArkhamPartOneChaosTokenValue(state, 'skull'), skullValue(state))
  assert.equal(doomOfArkhamPartOneChaosTokenValue(state, 'cultist'), -3)
  assert.equal(doomOfArkhamPartOneChaosTokenValue({ ...state, difficulty: 'hard' }, 'cultist'), -5)
  assert.equal(doomOfArkhamPartOneChaosTokenValue(state, 'tablet'), -3)
  assert.equal(doomOfArkhamPartOneChaosTokenValue({ ...state, difficulty: 'expert' }, 'tablet'), -5)
  assert.equal(doomOfArkhamPartOneChaosTokenValue(state, 'elderthing'), -2)
  assert.equal(doomOfArkhamPartOneChaosTokenValue({ ...state, difficulty: 'hard' }, 'elderthing'), -4)
  // 未知标记交回默认
  assert.equal(doomOfArkhamPartOneChaosToken(state, null, 'auto_fail'), null)
})

// ---------------------------------------------------------------------------
// 5. 真实存档重放（CONTINUATION §2.1）
// ---------------------------------------------------------------------------
const stable = value => JSON.parse(JSON.stringify(value))

test('P7 theDoomOfArkhamPartI 真实存档重放：saveSnapshot/readSnapshot 读回等价，续动作确定', () => {
  const previousHome = process.env.DSH_HOME
  const previousPersist = process.env.BOARDGAME_PERSIST
  delete process.env.BOARDGAME_PERSIST // 覆盖默认开启路径，不设置 persist=0
  const home = mkdtempSync(path.join(tmpdir(), 'tdc-doom1-'))
  process.env.DSH_HOME = home
  const sessionId = `tdc-doom1-${Date.now()}`
  try {
    assert.equal(persistEnabled(), true, 'BOARDGAME_PERSIST 默认开启')
    const state = withScenario(2, { records: { barrierNode: true } })
    const api = makeApi(state)
    setupScenario(state, api)
    const players = [{ seat: 0, id: 'p1' }, { seat: 1, id: 'p2' }]
    const events = [{ type: 'info', text: 'setup' }]
    const settings = { difficulty: state.difficulty, seed: 'doom1' }
    const file = saveSnapshot({ sessionId, modId: 'arkhamhorror', state, players, events, settings })
    assert.ok(file.endsWith('.json'))

    const restored = readSnapshot(sessionId)
    assert.ok(restored, '读回存档不能为空')
    const session = restored.session || restored
    assert.equal(session.sessionId, sessionId)
    assert.equal(session.modId, 'arkhamhorror')
    assert.deepEqual(stable(session.state), stable(state), '读回状态必须与内存状态一致')
    assert.deepEqual(session.players, players)
    assert.deepEqual(session.events, events)

    // 从读回状态继续一个本章真实动作：幕 1「共同支付线索抽取地点下方暗牌」。
    const continueAction = target => {
      const host = Object.keys(target.scenarioZones.beneathStacks)[0]
      target.scenarioZones.beneathStacks[host] = ['01135']
      for (const inv of target.investigators) {
        inv.location = host
        inv.clues = 3
      }
      const actionApi = makeApi(target)
      const moved = behavior.performAction(target, target.investigators[0],
        { action: 'scenarioAction', rule: 'doomArkhamDrawBeneath', locationId: host }, actionApi)
      return { moved, state: stable(target) }
    }
    const fromDisk = continueAction(session.state)
    const fromMemory = continueAction(stable(state))
    assert.equal(fromDisk.moved, true, '读回状态上的续动作必须可执行')
    assert.equal(fromMemory.moved, true)
    assert.deepEqual(fromDisk.state, fromMemory.state, '同一续动作在两条路径上的结果必须一致')
  } finally {
    if (previousHome === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = previousHome
    if (previousPersist === undefined) delete process.env.BOARDGAME_PERSIST
    else process.env.BOARDGAME_PERSIST = previousPersist
    rmSync(home, { recursive: true, force: true })
  }
})

// ---------------------------------------------------------------------------
// 13. 跨章收口：Good Money（11611）→ 本关补给阶段不获得资源
//   引擎读点：phases.js#201 scenarioBehavior(state).canGainResources
//   规则来源：content/campaigns/theDrownedCity/campaign-rules.js#tdcCannotGainUpkeepResources
// ---------------------------------------------------------------------------
test('P7 theDoomOfArkhamPartI 补给阶段：tdcNoUpkeepResources 命中且 scenarioIndex/seat 匹配时不获得资源', async t => {
  let engine, rules, core
  try {
    engine = await import('../src/engine/engine.js')
    rules = await import('../content/campaigns/theDrownedCity/campaign-rules.js')
    core = await import('./core-fixture.mjs')
  } catch (error) {
    t.diagnostic(`engine/campaign-rules 导入失败（集成期间注册表在改？）：${error?.stack || error?.message || error}`)
    return
  }
  const scenario = chapter.scenario
  assert.equal(typeof chapter.behavior.canGainResources, 'function', 'behavior 必须暴露 canGainResources 钩子')
  const runUpkeep = (flag) => {
    const state = core.fixture('01001', 1)
    state.scenario = structuredClone(scenario)
    state.scenarioFlags = {}
    state.campaign.ruleFlags = {}
    state.campaign.scenarioIndex = 2
    if (flag) state.campaign.ruleFlags[rules.TDC_NO_UPKEEP_RESOURCES] = flag
    const inv = state.investigators[0]
    inv.resources = 5
    inv.clues = 0
    inv.hand = []
    const capacity = chapter.behavior.canGainResources(state, inv)
    state.phase = 'investigation'
    state.currentSeat = 0
    engine.runBetweenInvestigationPhases(state, [])
    return { state, inv, capacity }
  }
  // 无标记 → 正常 +1 资源
  const normal = runUpkeep(null)
  assert.equal(normal.capacity, true)
  assert.equal(normal.inv.resources, 6, '无标记时补给阶段正常获得 1 资源')
  // 命中且 scenarioIndex/seat 匹配 → 不获得资源
  const matched = runUpkeep({ appliesToScenarioIndex: 2, seats: [0] })
  assert.equal(matched.capacity, false)
  assert.equal(matched.inv.resources, 5, '标记命中：补给阶段不获得资源')
  // seat 不匹配 → 正常
  const wrongSeat = runUpkeep({ appliesToScenarioIndex: 2, seats: [1] })
  assert.equal(wrongSeat.capacity, true)
  assert.equal(wrongSeat.inv.resources, 6, '仅 seats 不匹配时正常获得资源')
  // scenarioIndex 不匹配 → 正常
  const wrongIndex = runUpkeep({ appliesToScenarioIndex: 9, seats: [0] })
  assert.equal(wrongIndex.capacity, true)
  assert.equal(wrongIndex.inv.resources, 6, '仅 scenarioIndex 不匹配时正常获得资源')
})
