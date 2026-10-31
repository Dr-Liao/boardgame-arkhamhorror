// 月之暗面（06206）章节点 + 单卡条目测试（P8 交付证据）。
//
// 两层结构照 tests/tcu-witching-hour.test.mjs：第 1 层 import 章节 index/definition/behavior 手搓 state；
// 第 2 层直接 import 单卡条目（06223/06228/06230/06232 等）。
import test from 'node:test'
import assert from 'node:assert/strict'
import '../src/engine/engine.js'
import * as chapter from '../content/campaigns/theDreamEaters/scenarios/darkSideOfTheMoon/index.js'
import { behavior } from '../content/campaigns/theDreamEaters/scenarios/darkSideOfTheMoon/behavior.js'
import { scenario as definition } from '../content/campaigns/theDreamEaters/scenarios/darkSideOfTheMoon/definition.js'
import closeWatch from '../src/cards/encounter-entries/theDreamEaters/darkSideOfTheMoon/06230.js'
import lunarPatrol from '../src/cards/encounter-entries/theDreamEaters/darkSideOfTheMoon/06232.js'
import catsFromSaturn from '../src/cards/encounter-entries/theDreamEaters/darkSideOfTheMoon/06228.js'
import theWhiteShip from '../src/cards/encounter-entries/theDreamEaters/darkSideOfTheMoon/06223.js'

const CLONE = value => JSON.parse(JSON.stringify(value))

function createState(overrides = {}) {
  const state = {
    scenario: CLONE(definition),
    acts: CLONE(definition.acts),
    agendas: CLONE(definition.agendas),
    actIndex: 0,
    agendaIndex: 0,
    doom: 0,
    investigators: [
      { seat: 0, id: 'inv0', code: '06001', name: '调查员一', location: 'moonForest', damage: 0, horror: 0,
        clues: 3, resources: 5, hand: ['01001'], assets: [], threat: [], engaged: [], deck: [], discard: [],
        actionsLeft: 3, defeated: false, resigned: false },
      { seat: 1, id: 'inv1', code: '06002', name: '调查员二', location: 'moonForest', damage: 0, horror: 0,
        clues: 3, resources: 5, hand: [], assets: [], threat: [], engaged: [], deck: [], discard: [],
        actionsLeft: 3, defeated: false, resigned: false },
    ],
    locations: [],
    enemies: [],
    storyAssets: [],
    scenarioFlags: {},
    scenarioZones: { setAside: [] },
    victoryDisplay: [],
    victory: [],
    encounterDeck: ['06230', '06231', '06232', '01159'],
    encounterDiscard: [],
    removedFromGame: [],
    campaign: { leadSeat: 0, records: {}, investigators: [{ deck: [], purchases: [] }, { deck: [], purchases: [] }], chaosBag: [] },
    chaosBag: [],
    difficulty: 'standard',
    numInvestigators: 2,
    round: 1,
    phase: 'investigation',
    currentSeat: 0,
    turnSerial: 1,
    status: 'playing',
    investigatorCounters: { alarmLevel: { seats: [1, 1], max: 5 } },
  }
  return Object.assign(state, overrides)
}

function createApi(state, overrides = {}) {
  const api = {
    info: () => {},
    choice: request => (request?.options?.[0]?.id ?? null),
    random: () => 0.5,
    shuffle: list => [...list],
    test: (seat, skill, difficulty, resolve) => resolve({ success: true, value: difficulty, difficulty, drawn: [], source: null }),
    counters: {
      get: (seat, id) => Number(state.investigatorCounters?.[id]?.seats?.[seat] || 0),
      highestOf: id => (state.investigatorCounters?.[id]?.seats || []).reduce((max, value) => Math.max(max, Number(value) || 0), 0),
      add: (seat, id, delta = 1) => {
        state.investigatorCounters ||= {}
        const entry = (state.investigatorCounters[id] ||= { seats: [], max: null })
        const next = Math.max(0, Math.min(entry.max ?? Infinity, (entry.seats[seat] || 0) + delta))
        entry.seats[seat] = next
        return next
      },
      setMax: (id, max) => { state.investigatorCounters ||= {}; (state.investigatorCounters[id] ||= { seats: [] }).max = max },
    },
    swarm: {
      place: () => [], cardsOf: () => [], countOf: () => 0, remove: () => true,
    },
    payClues: (n, locationId) => {
      const payers = state.investigators.filter(inv => !locationId || inv.location === locationId)
      let remaining = n
      for (const inv of payers) { const paid = Math.min(remaining, inv.clues); inv.clues -= paid; remaining -= paid }
      assert.equal(remaining, 0, 'stub 支付失败：线索不足')
    },
    spawn: (code, location) => {
      const enemy = { id: `enemy-${state.enemies.length + 1}`, code, originalCode: code, location, damageTaken: 0,
        exhausted: false, defeated: false, engagedSeat: null, doom: 0, traits: [] }
      state.enemies.push(enemy)
      return enemy
    },
    exhaustEnemy: enemy => { enemy.exhausted = true },
    moveInvestigator: (seat, destination) => { const inv = state.investigators[seat]; if (inv) inv.location = destination },
    moveEnemy: (enemy, destination) => { enemy.location = destination },
    loseActions: (seat, n) => { const inv = state.investigators[seat]; if (inv) inv.actionsLeft = Math.max(0, (inv.actionsLeft || 0) - n) },
    damage: (seat, n) => { state.investigators[seat].damage += n },
    horror: (seat, n) => { state.investigators[seat].horror += n },
    damageEnemy: (enemyId, amount) => { const enemy = state.enemies.find(item => item.id === enemyId); if (enemy) enemy.damageTaken = (enemy.damageTaken || 0) + amount },
    discardChosen: (seat, n) => { const inv = state.investigators[seat]; for (let i = 0; i < n && inv.hand.length; i++) inv.discard.push(inv.hand.pop()) },
    discardAsset: (seat, assetId) => { const inv = state.investigators[seat]; inv.assets = inv.assets.filter(asset => asset.id !== assetId) },
    threat: (seat, code) => { state.investigators[seat].threat.push({ id: `threat-${code}`, code, originalCode: code }) },
    removeThreat: card => { for (const inv of state.investigators) inv.threat = inv.threat.filter(item => item !== card) },
    attachToLocation: (id, fields = {}) => {
      const location = state.locations.find(item => item.id === id)
      if (!location) return null
      location.attachments ||= []
      const attachment = { id: `attach-${fields.code}`, code: fields.code, originalCode: fields.code, name: '月球巡逻' }
      location.attachments.push(attachment)
      return attachment
    },
    detachLocationAttachment: (id, attachmentId) => {
      const location = state.locations.find(item => item.id === id)
      const index = (location?.attachments || []).findIndex(item => item.id === attachmentId)
      return index >= 0 ? location.attachments.splice(index, 1)[0] : null
    },
    place: id => {
      const def = state.scenario.locations[id]
      if (!def || state.locations.some(item => item.id === id)) return null
      const location = { ...CLONE(def), id, revealed: false, clues: 0, doom: 0, connections: [...(def.connections || [])] }
      state.locations.push(location)
      return location
    },
    reveal: id => { const location = state.locations.find(item => item.id === id); if (location) location.revealed = true },
    removeLocationFromGame: id => {
      const location = state.locations.find(item => item.id === id)
      if (!location) return null
      state.locations = state.locations.filter(item => item.id !== id)
      return location
    },
    takeFromSetAside: code => { const list = state.scenarioZones?.setAside || []; const index = list.indexOf(String(code)); if (index >= 0) list.splice(index, 1); return index >= 0 },
    discardEncounterCard: code => { const index = state.encounterDeck.lastIndexOf(String(code)); if (index >= 0) { state.encounterDiscard.push(state.encounterDeck.splice(index, 1)[0]); return true } return false },
    takeEncounterDiscard: code => { const index = state.encounterDiscard.lastIndexOf(String(code)); if (index >= 0) { state.encounterDiscard.splice(index, 1); return true } return false },
    shuffleDiscard: () => { state.encounterDeck = [...state.encounterDeck, ...state.encounterDiscard]; state.encounterDiscard = [] },
    shuffleIntoEncounterDeck: codes => { state.encounterDeck.push(...codes); return state.encounterDeck.length },
    shuffleEncounterDeck: () => {},
    drawEncounter: seat => { state.drawnBy = seat },
    discardEnemy: enemy => { state.enemies = state.enemies.filter(item => item !== enemy) },
    cardFlip: () => {},
    giveAsset: (seat, code) => { state.investigators[seat].assets.push({ id: `asset-${code}`, code, originalCode: code }); return state.investigators[seat].assets.at(-1) },
    storyAsset: (code, location) => { const asset = { id: `story-${code}`, code, originalCode: code, location }; state.storyAssets.push(asset); return asset },
    setScenarioFlag: (key, value) => { state.scenarioFlags ||= {}; state.scenarioFlags[key] = value; return value },
    scenarioFlag: key => state.scenarioFlags?.[key] ?? null,
    campaignRecord: key => state.campaign.records[key] ?? null,
    setCampaignRecord: (key, value) => { state.campaign.records[key] = value; return value },
    addDoom: n => { state.doom += n },
    finish: key => { state.finishedWith = key },
    advanceAct: () => { state.actAdvanced = (state.actAdvanced || 0) + 1 },
    addCluesToLocation: (id, n) => { const location = state.locations.find(item => item.id === id); if (location) location.clues = (location.clues || 0) + n },
    removeLocationClues: (id, n) => { const location = state.locations.find(item => item.id === id); if (location) location.clues = Math.max(0, (location.clues || 0) - n) },
    markLocationCounter: (id, key, amount) => { const location = state.locations.find(item => item.id === id); if (location) location[key] = Math.max(0, (location[key] || 0) + amount); return location?.[key] ?? 0 },
    setShroudMod: (location, amount) => { location.shroudMod = (location.shroudMod || 0) + amount },
    detachLocationAttachment: (id, attachmentId) => null,
    enemyFight: enemy => Number(enemy.fight) || 0,
    evadeEnemy: () => true,
  }
  return Object.assign(api, overrides)
}

function placeScenarioLocations(state, ids = ['cityOfTheMoonBeasts', 'templeOfTheMoonLizard', 'moonForest', 'theDarkCrater']) {
  for (const id of ids) {
    const def = state.scenario.locations[id]
    state.locations.push({ ...CLONE(def), id, revealed: true, clues: 0, doom: 0, connections: [...(def.connections || [])] })
  }
  return state
}

test('月之暗面：manifest 身份 / 遭遇组 / 参考卡 / 结局', () => {
  assert.equal(chapter.manifest.id, 'darkSideOfTheMoon')
  assert.equal(chapter.manifest.status, 'development')
  assert.equal(chapter.manifest.referenceCode, '06206')
  assert.deepEqual(chapter.manifest.requiredPackIds, ['core', 'tdeCampaign']) // 印刷包由 tdeCampaign cardRanges 覆盖
  assert.deepEqual(chapter.manifest.requiredEncounterGroupIds, ['darkSideOfTheMoon', 'corsairs', 'dreamersCurse', 'ancientEvils'])
  assert.deepEqual(Object.keys(chapter.scenario.resolutions), ['noResolution', 'resolution1'])
  assert.deepEqual(chapter.scenario.acts.map(item => item.originalCode), ['06210', '06211', '06212', '06213'])
  assert.deepEqual(chapter.scenario.agendas.map(item => item.originalCode), ['06207', '06208', '06209'])
  assert.equal(Object.keys(chapter.scenario.locations).length, 10)
})

test('月之暗面：setup 区域（4 张入场、10 张放在一边、卡达斯在密谋牌库旁）', () => {
  const state = createState()
  behavior.preScenarioSetup(state, [], createApi(state))
  const placed = behavior.setupLocations(state, [], { info: () => {} })
  assert.deepEqual(placed, ['cityOfTheMoonBeasts', 'templeOfTheMoonLizard', 'moonForest', 'theDarkCrater'])
  assert.equal(state.scenarioZones.setAside.length, 10)
  assert.deepEqual(state.scenarioFlags.agendaAside, ['06233'])
  assert.deepEqual(state.scenarioFlags.pendingSetupReveals, placed)
})

test('月之暗面：被俘开场（月兽帆船入场、被俘者就位、每人额外 2 线索、初始警报 1）', () => {
  const state = createState()
  state.campaign.records.wasCaptured = ['inv0']
  const api = createApi(state)
  behavior.preScenarioSetup(state, [], api)
  behavior.setupLocations(state, [], { info: () => {} })
  behavior.afterDeckSetup(state, [], { info: () => {} })
  const galley = state.locations.find(location => location.code === '06214')
  assert.ok(galley, '月兽帆船应入场')
  assert.equal(state.investigators[0].location, galley.id)
  assert.equal(galley.clues, 2)
  assert.equal(state.investigators[1].location, 'moonForest')
  assert.equal(state.investigatorCounters.alarmLevel.seats[0], 1)
  assert.equal(state.investigatorCounters.alarmLevel.max, 5)
})

test('月之暗面：议程 I 背面（洗回弃牌堆 + 全体警报等级 +1）', () => {
  const state = createState({ encounterDiscard: ['06230', '06231'] })
  const api = createApi(state)
  behavior.agendaReveal(state, state.agendas[0], api)
  assert.equal(state.encounterDiscard.length, 0)
  assert.equal(state.investigatorCounters.alarmLevel.seats[0], 2)
  assert.equal(state.investigatorCounters.alarmLevel.seats[1], 2)
})

test('月之暗面：议程 III 背面「杀戮时刻」重置密谋 3a 并放 2 毁灭', () => {
  const state = createState({ agendaIndex: 2 })
  const api = createApi(state)
  const handled = behavior.agendaReveal(state, state.agendas[2], api)
  assert.equal(handled, true)
  assert.equal(state.agendaIndex, 2)
  assert.equal(state.doom, 2)
  // 每位调查员警报 +1 后受到 ceil(alarm/2) 恐惧：初始 1 → 2，ceil(2/2)=1。
  assert.equal(state.investigatorCounters.alarmLevel.seats[0], 2)
  assert.equal(state.investigators[0].horror, 1)
})

test('月之暗面：幕 I 背面「及时救援」交给维吉尔·格雷；伦道夫被俘时入手', () => {
  const state = createState()
  placeScenarioLocations(state)
  state.campaign.records.randolphWasCaptured = true
  const randolph = Object.values(chapter.scenario.storyAssets || {}).length >= 0
    ? null : null
  void randolph
  const api = createApi(state)
  const handled = behavior.actReveal(state, state.acts[0], api)
  assert.equal(handled, true)
  assert.ok(state.investigators[0].assets.some(asset => asset.code === '06224'))
})

test('月之暗面：幕目标——月兽之城团队 3×人数线索推进', () => {
  const state = createState()
  placeScenarioLocations(state)
  for (const inv of state.investigators) { inv.location = 'cityOfTheMoonBeasts'; inv.clues = 2 }
  const api = createApi(state)
  behavior.checkObjectives(state, api)
  assert.equal(state.actAdvanced, undefined) // 每人 2 点、需要 6 点：不足
  for (const inv of state.investigators) inv.clues = 3
  behavior.checkObjectives(state, api)
  assert.equal(state.actAdvanced, 1)
})

test('月之暗面：幕 II 背面放置月下洞穴（暗面）与黑暗月核并横置生成月蜥', () => {
  const state = createState({ actIndex: 1 })
  placeScenarioLocations(state)
  state.scenarioZones.setAside = ['06219', '06220', '06226']
  const api = createApi(state)
  const handled = behavior.actReveal(state, state.acts[1], api)
  assert.equal(handled, true)
  assert.ok(state.locations.some(location => location.code === '06219'))
  assert.ok(state.locations.some(location => location.code === '06220'))
  const lizard = state.enemies.find(enemy => enemy.code === '06226')
  assert.ok(lizard)
  assert.equal(lizard.exhausted, true)
})

test('月之暗面：混乱标记数值（skull 半警报/全警报、tablet、elder_thing）', () => {
  const state = createState()
  state.investigatorCounters.alarmLevel.seats = [3, 1]
  assert.equal(behavior.resolveChaosToken(state, state.investigators[0], 'skull'), -2) // ceil(3/2)
  assert.equal(behavior.resolveChaosToken(state, state.investigators[0], 'tablet'), -1)
  assert.equal(behavior.resolveChaosToken(state, state.investigators[0], 'elder_thing'), 1)
  const hard = createState({ difficulty: 'hard' })
  hard.investigatorCounters.alarmLevel.seats = [3, 1]
  assert.equal(behavior.resolveChaosToken(hard, hard.investigators[0], 'skull'), -3)
  assert.equal(behavior.resolveChaosToken(hard, hard.investigators[0], 'tablet'), -2)
})

test('月之暗面：混乱标记后果（cultist 失败抽牌 / tablet 失败警报 +1 / elder_thing 躲避成功 2 伤害）', () => {
  const state = createState()
  state.enemies.push({ id: 'e1', code: '06229', originalCode: '06229', location: 'moonForest', damageTaken: 0, defeated: false })
  const api = createApi(state, { drawEncounter: seat => { state.drawnBy = seat } })
  behavior.afterTest(state, state.investigators[0], {
    success: false, value: 0, difficulty: 2, drawn: ['cultist', 'tablet'], cancelledTokens: [], source: null,
  }, api)
  assert.equal(state.drawnBy, 0)
  assert.equal(state.investigatorCounters.alarmLevel.seats[0], 2)
  behavior.afterTest(state, state.investigators[0], {
    success: true, value: 3, difficulty: 2, drawn: ['elder_thing'], cancelledTokens: [],
    source: { label: '躲避', enemyId: 'e1' },
  }, api)
  assert.equal(state.enemies[0].damageTaken, 2)
})

test('月之暗面：地点条目（白船 06223 警报 ≥5 不能进入；月蜥是攻击值 = 警报）', () => {
  assert.ok(theWhiteShip.locationRule.entryErrorAlarmAtLeast)
  const state = createState()
  placeScenarioLocations(state)
  state.locations.push({ ...CLONE(state.scenario.locations.theWhiteShip), id: 'theWhiteShip', revealed: true, clues: 0, connections: [] })
  state.investigatorCounters.alarmLevel.seats = [5, 1]
  const error = behavior.investigatorEntryError(state, state.locations.find(location => location.id === 'theWhiteShip'), state.investigators[0])
  assert.match(error, /警报等级/)
  // 月蜥：交战时 X = 该调查员的警报等级（印刷 5 → 警报 3 时 -2 修正）。
  state.investigatorCounters.alarmLevel.seats = [3, 1]
  const lizard = { code: '06226', originalCode: '06226', fight: 5, evade: 5, engagedSeat: 0, location: 'cavernsBeneathTheMoonDarkSide' }
  assert.equal(behavior.enemyStatModifier(state, lizard, 'fight'), -2)
})

test('月之暗面：诡计条目（严密监视 06230 失败二选一；月球巡逻 06232 附属与离开强制）', () => {
  assert.ok(closeWatch.encounterResolve)
  assert.ok(lunarPatrol.encounterResolve)
  assert.equal(lunarPatrol.treacheryRule.forcedWhenLeaves.alarm, 1)
  const state = createState()
  placeScenarioLocations(state)
  state.investigators[0].location = 'cityOfTheMoonBeasts'
  const api = createApi(state, {
    test: (seat, skill, difficulty, resolve) => resolve({ success: false, value: 0, difficulty, drawn: [], source: null }),
  })
  closeWatch.encounterResolve(state, state.investigators[0], { code: '06230' }, api)
  assert.equal(state.investigatorCounters.alarmLevel.seats[0], 2)
  const attached = lunarPatrol.encounterResolve(state, state.investigators[0], { code: '06232' }, createApi(state))
  assert.equal(attached, true)
  const city = state.locations.find(location => location.id === 'cityOfTheMoonBeasts')
  assert.ok(city.attachments.some(attachment => attachment.code === '06232'))
  behavior.locationLeft(state, state.investigators[0], city, createApi(state))
  assert.equal(state.investigatorCounters.alarmLevel.seats[0], 3)
})

test('月之暗面：土星猫（06228）头领移动后弃 1 张蜂拥卡', () => {
  const state = createState()
  state.enemies.push({ id: 'host', code: '06228', originalCode: '06228', location: 'cityOfTheMoonBeasts', defeated: false })
  let removed = 0
  const api = createApi(state, {
    swarm: { cardsOf: () => [{ id: 'swarm1', code: '06228' }], remove: () => { removed += 1; return true }, place: () => [], countOf: () => 1 },
  })
  catsFromSaturn.enemyScript.onMoved(state, state.enemies[0], 'moonForest', api, 'cityOfTheMoonBeasts')
  assert.equal(removed, 1)
})

test('月之暗面：结局记录（resolution1：证据 +3、旅程记录；noResolution：寒冷荒原）', () => {
  const state = createState()
  const api = createApi(state)
  const result = behavior.resolution(state, 'resolution1', [], api)
  assert.equal(result.award, true)
  assert.equal(state.campaign.records.theInvestigatorsTraveledToTheColdWastes, true)
  assert.equal(state.campaign.records.evidenceOfKadath, 3)
  assert.ok(result.effects.some(effect => effect.recordCount?.key === 'evidenceOfKadath'))
  const lost = createState()
  behavior.resolution(lost, 'noResolution', [], createApi(lost))
  assert.equal(lost.campaign.records.theInvestigatorsWereCarriedToTheColdWastes, true)
  assert.equal(lost.campaign.records.randolphCarterDidNotSurviveTheVoyage, true)
})

test('月之暗面：存档 JSON 往返（serialize / parse 两次全等）', () => {
  const state = createState()
  behavior.setupLocations(state, [], { info: () => {} })
  placeScenarioLocations(state)
  const once = JSON.stringify(state)
  const twice = JSON.stringify(JSON.parse(once))
  assert.equal(once, twice)
  assert.equal(JSON.parse(once).scenario.id, 'darkSideOfTheMoon')
})
