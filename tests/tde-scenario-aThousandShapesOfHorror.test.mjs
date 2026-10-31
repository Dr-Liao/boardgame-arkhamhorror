// 万千骇形（06168）章节点 + 单卡条目测试（P8 交付证据）。
//
// 两层结构照 tests/tcu-witching-hour.test.mjs：
//   第 1 层：直接 import 章节 index/definition/behavior，手搓 state 与 api 桩，断言 setup / 幕 / 议程 / 混乱 / 结局；
//   第 2 层：直接 import 单卡条目，调 locationRule/actRule/encounterResolve。
// 不依赖 implementedFor（索引由主进程合并后重建）。
import test from 'node:test'
import assert from 'node:assert/strict'
import '../src/engine/engine.js'
import * as chapter from '../content/campaigns/theDreamEaters/scenarios/aThousandShapesOfHorror/index.js'
import { behavior } from '../content/campaigns/theDreamEaters/scenarios/aThousandShapesOfHorror/behavior.js'
import { scenario as definition } from '../content/campaigns/theDreamEaters/scenarios/aThousandShapesOfHorror/definition.js'
import burialGround from '../src/cards/encounter-entries/theDreamEaters/aThousandShapesOfHorror/06174.js'
import stairs183 from '../src/cards/encounter-entries/theDreamEaters/aThousandShapesOfHorror/06183.js'
import endlessDescent from '../src/cards/encounter-entries/theDreamEaters/aThousandShapesOfHorror/06190.js'

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
      { seat: 0, id: 'inv0', code: '06001', name: '调查员一', location: 'burialGround', damage: 0, horror: 0,
        clues: 2, resources: 5, hand: ['01001'], assets: [], threat: [], engaged: [], deck: [], discard: [],
        actionsLeft: 3, defeated: false, resigned: false },
      { seat: 1, id: 'inv1', code: '06002', name: '调查员二', location: 'burialGround', damage: 0, horror: 0,
        clues: 2, resources: 5, hand: [], assets: [], threat: [], engaged: [], deck: [], discard: [],
        actionsLeft: 3, defeated: false, resigned: false },
    ],
    locations: [],
    enemies: [],
    storyAssets: [],
    scenarioFlags: {},
    scenarioZones: { setAside: [] },
    victoryDisplay: [],
    victory: [],
    encounterDeck: ['06191', '06192', '06193', '06194', '01159'],
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
    investigatorCounters: {},
  }
  return Object.assign(state, overrides)
}

function placeAllLocations(state) {
  for (const location of Object.values(state.scenario.locations)) {
    state.locations.push({ ...CLONE(location), id: location.id, revealed: false, clues: 0, doom: 0,
      connections: [...(location.connections || [])] })
  }
  return state
}

function createApi(state, overrides = {}) {
  const api = {
    info: () => {},
    choice: request => (request?.options?.[0]?.id ?? null),
    choose: request => api.choice(request),
    random: () => 0.5,
    shuffle: list => [...list],
    test: (seat, skill, difficulty, resolve) => resolve({ success: true, value: difficulty, difficulty, drawn: [], source: null }),
    applyPenalty: () => {},
    counters: {
      get: (seat, id) => Number(state.investigatorCounters?.[id]?.seats?.[seat] || 0),
      highestOf: id => (state.investigatorCounters?.[id]?.seats || []).reduce((max, value) => Math.max(max, Number(value) || 0), 0),
      add: (seat, id, delta = 1) => {
        state.investigatorCounters ||= {}
        const entry = (state.investigatorCounters[id] ||= { seats: [], max: null })
        entry.seats[seat] = Math.max(0, Math.min(entry.max ?? Infinity, (entry.seats[seat] || 0) + delta))
        return entry.seats[seat]
      },
      setMax: (id, max) => { state.investigatorCounters ||= {}; (state.investigatorCounters[id] ||= { seats: [] }).max = max },
      set: (seat, id, value) => { state.investigatorCounters ||= {}; const entry = (state.investigatorCounters[id] ||= { seats: [] }); entry.seats[seat] = value },
    },
    swarm: {
      place: () => [], cardsOf: () => [], countOf: () => 0, remove: () => true, canDefeat: () => true,
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
    moveInvestigator: (seat, destination) => { const inv = state.investigators[seat]; if (inv) inv.location = destination },
    moveEnemy: (enemy, destination) => { enemy.location = destination },
    attack: (enemy, inv) => { api.__attacks = (api.__attacks || 0) + 1; void inv },
    evadeEnemy: () => true,
    loseActions: (seat, n) => { const inv = state.investigators[seat]; if (inv) inv.actionsLeft = Math.max(0, (inv.actionsLeft || 0) - n) },
    damage: (seat, n) => { state.investigators[seat].damage += n },
    horror: (seat, n) => { state.investigators[seat].horror += n },
    damageEnemy: () => {},
    discardChosen: (seat, n) => { const inv = state.investigators[seat]; for (let i = 0; i < n && inv.hand.length; i++) inv.discard.push(inv.hand.pop()) },
    discardFromHand: (seat, code) => { const inv = state.investigators[seat]; const index = inv.hand.indexOf(code); if (index >= 0) { inv.hand.splice(index, 1); inv.discard.push(code); return true } return false },
    removeThreat: card => { for (const inv of state.investigators) inv.threat = inv.threat.filter(item => item !== card) },
    threat: (seat, code) => { state.investigators[seat].threat.push({ id: `threat-${code}`, code, originalCode: code, name: code }) },
    spendClues: (seat, n) => { state.investigators[seat].clues -= n },
    addCluesToLocation: (id, n) => { const location = state.locations.find(item => item.id === id); if (location) location.clues = (location.clues || 0) + n },
    removeLocationClues: (id, n) => { const location = state.locations.find(item => item.id === id); if (location) location.clues = Math.max(0, (location.clues || 0) - n) },
    markLocationCounter: (id, key, amount) => { const location = state.locations.find(item => item.id === id); if (location) location[key] = Math.max(0, (location[key] || 0) + amount); return location?.[key] ?? 0 },
    setShroudMod: (location, amount) => { location.shroudMod = (location.shroudMod || 0) + amount },
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
      state.removedFromGame.push(location.originalCode || location.code)
      return location
    },
    takeFromSetAside: code => { const list = state.scenarioZones?.setAside || []; const index = list.indexOf(String(code)); if (index >= 0) list.splice(index, 1); return index >= 0 },
    discardEncounterCard: (code, options = {}) => {
      const deckIndex = state.encounterDeck.lastIndexOf(String(code))
      if (deckIndex >= 0) { state.encounterDiscard.push(state.encounterDeck.splice(deckIndex, 1)[0]); return true }
      if (options.includeDiscard === true) { const index = state.encounterDiscard.lastIndexOf(String(code)); if (index >= 0) { state.encounterDiscard.splice(index, 1); return true } }
      return false
    },
    takeEncounterDiscard: code => { const index = state.encounterDiscard.lastIndexOf(String(code)); if (index >= 0) { state.encounterDiscard.splice(index, 1); return true } return false },
    shuffleDiscard: () => { state.encounterDeck = [...state.encounterDeck, ...state.encounterDiscard]; state.encounterDiscard = [] },
    shuffleIntoEncounterDeck: codes => { state.encounterDeck.push(...codes); return state.encounterDeck.length },
    shuffleEncounterDeck: () => {},
    attachToLocation: (id, fields = {}) => {
      const location = state.locations.find(item => item.id === id)
      if (!location) return null
      location.attachments ||= []
      const attachment = { id: `attach-${fields.code}`, code: fields.code, originalCode: fields.code }
      location.attachments.push(attachment)
      return attachment
    },
    detachLocationAttachment: (id, attachmentId) => {
      const location = state.locations.find(item => item.id === id)
      if (!location?.attachments) return null
      const index = location.attachments.findIndex(item => item.id === attachmentId)
      return index >= 0 ? location.attachments.splice(index, 1)[0] : null
    },
    locationDoom: { remove: () => 0, get: () => 0 },
    verticalChain: {
      link: ids => {
        ids.forEach((id, index) => {
          const location = state.locations.find(item => item.id === id)
          if (!location) return
          location.verticalIndex = index
          location.connections = [ids[index - 1], ids[index + 1]].filter(Boolean)
        })
        return { linked: ids.length }
      },
    },
    cardFlip: () => {},
    giveAsset: () => null,
    storyAsset: () => null,
    drawEncounter: () => {},
    enemyFight: (enemy, seat) => Number(enemy.fight) || 0,
    discardEnemy: enemy => { state.encounterDiscard.push(enemy.code); state.enemies = state.enemies.filter(item => item !== enemy) },
    setScenarioFlag: (key, value) => { state.scenarioFlags ||= {}; state.scenarioFlags[key] = value; return value },
    scenarioFlag: key => state.scenarioFlags?.[key] ?? null,
    campaignRecord: key => state.campaign.records[key] ?? null,
    setCampaignRecord: (key, value) => { state.campaign.records[key] = value; return value },
    addDoom: n => { state.doom += n },
    finish: key => { state.finishedWith = key },
    advanceAct: () => { state.actAdvanced = (state.actAdvanced || 0) + 1 },
    advanceAgenda: () => {},
    clearEnemyAloof: enemy => { enemy.aloof = false },
    resign: seat => { state.investigators[seat].resigned = true },
    spendResources: (seat, n) => { state.investigators[seat].resources -= n },
    heatEnemy: () => {},
  }
  return Object.assign(api, overrides)
}

const act = index => createState().acts[index]

test('万千骇形：manifest 身份 / 遭遇组 / 参考卡', () => {
  assert.equal(chapter.manifest.id, 'aThousandShapesOfHorror')
  assert.equal(chapter.manifest.campaignId, 'theDreamEaters')
  assert.equal(chapter.manifest.status, 'development')
  assert.equal(chapter.manifest.referenceCode, '06168')
  assert.deepEqual(chapter.manifest.requiredPackIds, ['core', 'tdeCampaign']) // 印刷包由 tdeCampaign cardRanges 覆盖
  for (const group of ['aThousandShapesOfHorror', 'creaturesOfTheUnderworld', 'mergingRealities', 'rats']) {
    assert.ok(chapter.manifest.requiredEncounterGroupIds.includes(group), `缺少遭遇组 ${group}`)
  }
  assert.deepEqual(Object.keys(chapter.scenario.resolutions), ['noResolution', 'resolution1', 'resolution2', 'resolution3', 'resolution4'])
  assert.equal(Object.keys(chapter.scenario.locations).length, 15)
  assert.deepEqual(chapter.scenario.acts.map(item => item.originalCode), ['06172', '06173'])
  assert.deepEqual(chapter.scenario.agendas.map(item => item.originalCode), ['06169a', '06170', '06171'])
})

test('万千骇形：setup 区域与放在一边的卡（14 张、7 个入场地点）', () => {
  const state = createState()
  const api = createApi(state)
  const placed = behavior.setupLocations(state, [], { info: () => {} })
  assert.deepEqual(placed, ['burialGround', 'frontPorchEntryway', 'upstairsHallway', 'den', 'parlor', 'library', 'bedroom'])
  assert.equal(state.scenarioZones.setAside.length, 14)
  assert.deepEqual(state.scenarioFlags.pendingSetupReveals, ['burialGround'])
  // 清单守恒：8 张地点（阁楼/无名坟墓/6 阶梯）+ 6 张非地点（不可名状之物/银钥匙/4 无尽深入）。
  assert.equal(state.scenarioZones.setAside.filter(code => code === '06190').length, 4)
  void api
})

test('万千骇形：议程 I 背面生成不可名状之物（阁楼不在场时选楼上的走廊）', () => {
  const state = createState()
  behavior.setupLocations(state, [], { info: () => {} })
  for (const id of ['upstairsHallway', 'burialGround']) state.locations.push({ ...CLONE(state.scenario.locations[id]), id, revealed: false })
  const api = createApi(state)
  const revealed = behavior.agendaReveal(state, state.agendas[0], api)
  assert.equal(revealed, true)
  assert.equal(state.enemies.length, 1)
  assert.equal(state.enemies[0].code, '06169b')
  assert.equal(state.enemies[0].location, 'upstairsHallway')
})

test('万千骇形：幕 II 目标——所有未败退调查员撤退后推进', () => {
  const state = createState({ actIndex: 1 })
  const api = createApi(state)
  behavior.checkObjectives(state, api)
  assert.equal(state.actAdvanced, undefined)
  for (const inv of state.investigators) inv.resigned = true
  behavior.checkObjectives(state, api)
  assert.equal(state.actAdvanced, 1)
})

test('万千骇形：议程 II 背面把遭遇弃牌堆洗回牌库', () => {
  const state = createState({ agendaIndex: 1, encounterDiscard: ['06191', '06192'] })
  const api = createApi(state)
  behavior.agendaReveal(state, state.agendas[1], api)
  assert.equal(state.encounterDiscard.length, 0)
  assert.ok(state.encounterDeck.includes('06191'))
})

test('万千骇形：回合开始的议程强制（不可名状之物重整且在所在地点）', () => {
  const state = createState({ agendaIndex: 1 })
  state.enemies.push({ id: 'e1', code: '06169b', originalCode: '06169b', location: 'burialGround', exhausted: false, damageTaken: 0, defeated: false })
  const api = createApi(state, {
    test: (seat, skill, difficulty, resolve) => resolve({ success: false, value: 0, difficulty, drawn: [], source: null }),
  })
  behavior.turnBegins(state, state.investigators[0], api)
  assert.equal(api.__attacks, 2)
})

test('万千骇形：混乱标记数值（skull 依地点、tablet、elder_thing、困难面）', () => {
  const state = createState({ difficulty: 'standard' })
  state.locations.push({ id: 'burialGround', originalCode: '06174', code: '06174', traits: ['Graveyard'] })
  assert.equal(behavior.resolveChaosToken(state, state.investigators[0], 'skull'), -3) // 墓地上 -3
  state.investigators[0].location = 'upstairsHallway'
  state.locations.push({ id: 'upstairsHallway', originalCode: '06178', code: '06178', traits: [] })
  assert.equal(behavior.resolveChaosToken(state, state.investigators[0], 'skull'), -1)
  assert.equal(behavior.resolveChaosToken(state, state.investigators[0], 'tablet'), 2)
  assert.equal(behavior.resolveChaosToken(state, state.investigators[0], 'elder_thing'), -2)
  const hard = createState({ difficulty: 'hard' })
  hard.locations.push({ id: 'burialGround', originalCode: '06174', code: '06174', traits: ['Graveyard'] })
  assert.equal(behavior.resolveChaosToken(hard, hard.investigators[0], 'skull'), -4)
  assert.equal(behavior.resolveChaosToken(hard, hard.investigators[0], 'elder_thing'), -3)
})

test('万千骇形：[tablet] 成功时可选并躲避敌人（afterTest 幂等）', () => {
  const state = createState()
  state.enemies.push({ id: 'e1', code: '01159', originalCode: '01159', location: 'burialGround', fight: 2, defeated: false })
  let evaded = 0
  const api = createApi(state, {
    evadeEnemy: () => { evaded += 1 },
    choice: request => (request?.options?.at(-1)?.id ?? null),
  })
  const result = { success: true, value: 4, difficulty: 2, drawn: ['tablet'], cancelledTokens: [], source: null }
  behavior.afterTest(state, state.investigators[0], result, api)
  behavior.afterTest(state, state.investigators[0], result, api)
  assert.equal(evaded, 1)
})

test('万千骇形：坟地条目（06174）生成改道数据与团队线索记住事实', () => {
  assert.equal(burialGround.locationRule.spawnRedirectTrait, 'Ghoul')
  const state = createState({ numInvestigators: 2 })
  state.locations.push({ ...CLONE(state.scenario.locations.burialGround), id: 'burialGround', revealed: true, clues: 2 })
  const moves = []
  burialGround.locationRule.actions({ moves, state, inv: state.investigators[0], location: state.locations[0] })
  assert.equal(moves.length, 1)
  const api = createApi(state)
  const handled = burialGround.locationRule.performAction(state, state.investigators[0], moves[0], api)
  assert.equal(handled, true)
  assert.deepEqual(state.scenarioFlags.remembered, ['noticedTheMissingBones'])
})

test('万千骇形：神秘阶梯 183 进入失去 1 行动；184 有线索时移动/撤退封锁', () => {
  const state = createState()
  state.scenario.locations.mysteriousStairs1 = CLONE(state.scenario.locations.mysteriousStairs1)
  state.locations.push({ ...CLONE(state.scenario.locations.mysteriousStairs1), id: 'mysteriousStairs1', revealed: true, clues: 0, verticalIndex: 0,
    connections: ['mysteriousStairs2'] })
  state.locations.push({ ...CLONE(state.scenario.locations.mysteriousStairs2), id: 'mysteriousStairs2', revealed: true, clues: 1, verticalIndex: 1,
    connections: ['mysteriousStairs1'] })
  state.investigators[0].location = 'mysteriousStairs2'
  const api = createApi(state)
  stairs183.locationRule.onEnter.effect(state, state.locations[0], api, state.investigators[0])
  assert.equal(state.investigators[0].actionsLeft, 2)
  const error = behavior.moveError(state, state.investigators[0], 'mysteriousStairs1')
  assert.match(error, /线索/)
})

test('万千骇形：无尽深入（06190）重排阶梯并把本卡加入胜利区', () => {
  const state = createState()
  behavior.setupLocations(state, [], { info: () => {} })
  for (let index = 0; index < 5; index += 1) {
    const id = `mysteriousStairs${index + 1}`
    state.locations.push({ ...CLONE(state.scenario.locations[id]), id, revealed: index !== 4, clues: 0, verticalIndex: index,
      connections: [] })
  }
  for (const inv of state.investigators) inv.location = 'mysteriousStairs1'
  const api = createApi(state)
  const handled = behavior.resolveEncounter(state, state.investigators[0],
    { id: 't1', code: '06190', originalCode: '06190' }, api)
  assert.equal(handled, true)
  assert.ok(state.victoryDisplay.some(card => card.code === '06190'))
  const top = state.locations.find(location => location.verticalIndex === 0)
  assert.notEqual(top.id, 'mysteriousStairs1') // 原顶点被挪到最下方/重新排列
  assert.equal(endlessDescent.flags.flow, 'endlessDescent')
})

test('万千骇形：结局 2 依记忆分流到 3/4 并写战役记录', () => {
  const state = createState()
  state.scenarioFlags.remembered = ['recoveredAStrangeKey']
  const api = createApi(state)
  const result = behavior.resolution(state, 'resolution2', [], api)
  assert.equal(result.award, true)
  assert.equal(state.campaign.records.randolphSurvivedTheDescent, true)
  assert.ok(result.effects.some(effect => effect.chaos?.token === 'skull'))
  const lost = createState()
  lost.scenarioFlags.remembered = []
  behavior.resolution(lost, 'resolution2', [], createApi(lost))
  assert.equal(lost.campaign.records.randolphDidNotSurviveTheDescent, true)
})

test('万千骇形：存档 JSON 往返（serialize / parse 两次全等）', () => {
  const state = createState()
  behavior.setupLocations(state, [], { info: () => {} })
  const once = JSON.stringify(state)
  const twice = JSON.stringify(JSON.parse(once))
  assert.equal(once, twice)
  const roundTrip = JSON.parse(once)
  assert.equal(roundTrip.scenario.id, 'aThousandShapesOfHorror')
  assert.deepEqual(roundTrip.scenarioZones.setAside, state.scenarioZones.setAside)
  assert.equal(JSON.stringify(roundTrip), once)
})
