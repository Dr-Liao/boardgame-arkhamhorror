// 寻觅卡达斯（theSearchForKadath · 06119）章节测试（P8 worker w-p8-b）。
//
// 两层证据（照 tests/tcu-witching-hour.test.mjs）：
//   1. 章节钩子（behavior）：setup/区域切换/幕与议程/混乱标记/结局与记录/存档往返；
//   2. 单卡条目（encounter-entries）：直接 import 单卡文件，调 locationRule / actRule /
//      agendaRule / encounterResolve / enemyScript 等规则函数。
//
// 注意：单卡索引由 Lead 合并后统一重建，因此本测试用 readdir 动态 import 本章 52 个条目并
// 注册到引擎注册表（registerCardAbilities），不依赖 implementedFor / encounter-entries/index.js。
import test from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import '../src/engine/engine.js'
import { registerCardAbilities, registeredCodes } from '../src/engine/ability.js'
import { normalizeVeiledScenario } from '../src/engine/veiled.js'
import { swarmCountOf } from '../src/engine/swarm.js'
import * as chapter from '../content/campaigns/theDreamEaters/scenarios/theSearchForKadath/index.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import {
  scenario as definition, REGIONS, VIRGIL_GRAY, PRIEST_OF_A_THOUSAND_MASKS, PACK_OF_VOONITHS,
  HORDE_OF_NIGHT, CATS_OF_ULTHAR, CATS_OF_ULTHAR as _CATS,
} from '../content/campaigns/theDreamEaters/scenarios/theSearchForKadath/definition.js'
import { behavior } from '../content/campaigns/theDreamEaters/scenarios/theSearchForKadath/behavior.js'
import { signsOfTheGods } from '../content/campaigns/theDreamEaters/scenarios/theSearchForKadath/chaos.js'

// ---------------------------------------------------------------------------
// 本章单卡条目注册（索引重建前的过渡办法）
// ---------------------------------------------------------------------------
const here = dirname(fileURLToPath(import.meta.url))
const ENTRY_DIR = resolve(here, '../src/cards/encounter-entries/theDreamEaters/theSearchForKadath')
const ENTRY_FILES = readdirSync(ENTRY_DIR).filter(name => name.endsWith('.js')).sort()
const ENTRIES = []
for (const name of ENTRY_FILES) {
  const module = await import(pathToFileURL(resolve(ENTRY_DIR, name)).href)
  if (module.default) ENTRIES.push(module.default)
}
const alreadyRegistered = new Set(registeredCodes())
const pendingEntries = ENTRIES.filter(entry => !alreadyRegistered.has(entry.code))
if (pendingEntries.length) registerCardAbilities(pendingEntries)
const entryOf = code => ENTRIES.find(entry => entry.code === code) || null

// ---------------------------------------------------------------------------
// state / api stub（够本章钩子跑；api 的写操作只改 stub state）
// ---------------------------------------------------------------------------
const clone = value => structuredClone(value)

function makeState({ numInvestigators = 2, difficulty = 'standard', records = {} } = {}) {
  const scenario = clone(definition)
  const state = {
    scenario,
    difficulty,
    numInvestigators,
    investigators: Array.from({ length: numInvestigators }, (_, seat) => ({
      seat, name: `调查员${seat + 1}`, code: `0100${seat + 1}`, location: 'ulthar',
      damage: 0, horror: 0, clues: 0, resources: 5, actionsLeft: 3,
      hand: [], deck: [], discard: [], assets: [], threat: [], engaged: [],
      defeated: false, resigned: false,
    })),
    campaign: { leadSeat: 0, records: { ...records }, investigators: [] },
    locations: [],
    enemies: [],
    storyAssets: [],
    scenarioFlags: {},
    scenarioZones: {},
    victoryDisplay: [],
    removedFromGame: [],
    encounterDeck: [...scenario.encounterDeck],
    encounterDiscard: [],
    doom: 0,
    round: 1,
    phase: 'investigation',
    currentSeat: 0,
    turnSerial: 0,
    markerCounts: {},
    acts: clone(scenario.acts),
    agendas: clone(scenario.agendas),
    actIndex: 0,
    agendaIndex: 0,
    chaosBag: [],
    status: 'playing',
  }
  return state
}

function makeApi(state, overrides = {}) {
  const calls = { info: [], finish: [], spawns: [], spawnedEngaged: [], moves: [], defeatedAll: 0, advanceAct: 0, doom: [], damage: [], horror: [], discoverClue: [], drawEncounter: 0, removedLocations: [], removedEnemies: [], choosePrompts: [] }
  const api = {
    calls,
    info: text => calls.info.push(String(text)),
    present: text => calls.info.push(String(text)),
    choose: request => { calls.choosePrompts.push(request?.prompt || ''); return request?.options?.[0]?.id },
    random: () => 0.5,
    scenarioFlag: key => state.scenarioFlags?.[key] ?? null,
    setScenarioFlag: (key, value = true) => { state.scenarioFlags ||= {}; state.scenarioFlags[key] = value },
    campaignRecord: key => state.campaign.records?.[key] ?? null,
    setCampaignRecord: (key, value) => { state.campaign.records[key] = value },
    markers: {
      get: (id = 'reference') => Number(state.markerCounts?.[id]) || 0,
      add: (id = 'reference', delta = 1) => {
        state.markerCounts ||= {}
        state.markerCounts[id] = Math.max(0, (Number(state.markerCounts[id]) || 0) + delta)
        return state.markerCounts[id]
      },
      set: (id, value) => { state.markerCounts ||= {}; state.markerCounts[id] = value; return value },
    },
    cardName: code => definition.storyFaces?.[code]?.name || `卡${code}`,
    cardTraits: code => (definition.storyFaces?.[code]?.traits || ALL_CARDS[code]?.traits || []).slice(),
    cardType: () => null,
    takeFromSetAside: code => {
      const list = state.scenarioZones?.setAside
      if (!Array.isArray(list)) return false
      const index = list.indexOf(String(code))
      if (index < 0) return false
      list.splice(index, 1)
      return true
    },
    shuffleIntoEncounterDeck: (codes) => { state.encounterDeck.push(...(Array.isArray(codes) ? codes : [codes])) },
    shuffleEncounterDeck: () => {},
    shuffleDiscard: () => { state.encounterDeck = [...state.encounterDeck, ...state.encounterDiscard]; state.encounterDiscard = [] },
    discardEncounterCard: (code, options = {}) => {
      const index = state.encounterDeck.lastIndexOf(String(code))
      if (index >= 0) { state.encounterDiscard.push(state.encounterDeck.splice(index, 1)[0]); return true }
      if (options.includeDiscard !== true) return false
      const discardIndex = state.encounterDiscard.lastIndexOf(String(code))
      if (discardIndex < 0) return false
      state.encounterDiscard.splice(discardIndex, 1)
      return true
    },
    takeEncounterDiscard: (code, options = {}) => {
      const index = state.encounterDiscard.lastIndexOf(String(code))
      if (index < 0) return false
      state.encounterDiscard.splice(index, 1)
      if (options.toDeck) state.encounterDeck.push(String(code))
      return true
    },
    discardEncounterTop: (count = 1) => {
      const discarded = []
      for (let index = 0; index < count && state.encounterDeck.length; index += 1) {
        const code = state.encounterDeck.pop()
        state.encounterDiscard.push(code)
        discarded.push(code)
      }
      return discarded
    },
    spawn: (code, locationId) => {
      const enemy = { id: `enemy-${calls.spawns.length + 1}`, originalCode: code, code, location: locationId, engagedSeat: null, damageTaken: 0, doom: 0 }
      state.enemies.push(enemy)
      calls.spawns.push({ code, locationId })
      return enemy
    },
    spawnEngaged: (code, locationId, seat) => {
      const enemy = api.spawn(code, locationId)
      enemy.engagedSeat = seat
      calls.spawnedEngaged.push({ code, locationId, seat })
      return enemy
    },
    removeEnemyFromGame: enemy => {
      const index = state.enemies.indexOf(enemy)
      if (index < 0) return false
      state.enemies.splice(index, 1)
      calls.removedEnemies.push(enemy.originalCode || enemy.code)
      return true
    },
    place: id => {
      const definition = state.scenario.locations?.[id]
      if (!definition) return null
      if (state.locations.some(location => location.id === id)) return null
      const location = { ...clone(definition), id, revealed: true, clues: definition.cluesPerInvestigator * state.numInvestigators }
      state.locations.push(location)
      return location
    },
    removeLocationFromGame: (id, options = {}) => {
      const index = state.locations.findIndex(location => location.id === id)
      if (index < 0) return null
      const [removed] = state.locations.splice(index, 1)
      calls.removedLocations.push(id)
      if (options.discardEnemies !== false) {
        for (const enemy of [...state.enemies]) {
          if (enemy.location === id) state.enemies.splice(state.enemies.indexOf(enemy), 1)
        }
      }
      return removed
    },
    moveInvestigator: (seat, locationId) => { state.investigators[seat].location = locationId; calls.moves.push({ seat, locationId }) },
    moveEnemy: (enemy, locationId) => { enemy.location = locationId },
    damage: (seat, amount) => { state.investigators[seat].damage += amount; calls.damage.push({ seat, amount }) },
    horror: (seat, amount) => { state.investigators[seat].horror += amount; calls.horror.push({ seat, amount }) },
    healDamage: () => {},
    healHorror: () => {},
    gainResources: () => {},
    drawCards: () => {},
    loseResources: () => {},
    addDoom: amount => { state.doom += amount; calls.doom.push(amount) },
    doomOn: (card, amount = 1) => { card.doom = (card.doom || 0) + amount },
    damageEnemy: (enemy, amount) => { enemy.damageTaken = (enemy.damageTaken || 0) + amount },
    healEnemy: (enemy, amount) => { enemy.damageTaken = Math.max(0, (enemy.damageTaken || 0) - amount) },
    exhaustEnemy: enemy => { enemy.exhausted = true },
    readyEnemy: enemy => { enemy.exhausted = false },
    discardEnemy: enemy => {
      const index = state.enemies.indexOf(enemy)
      if (index >= 0) state.enemies.splice(index, 1)
    },
    swarm: {
      place: (host, count) => {
        host.swarmCards = (host.swarmCards || 0) + count
        return Array.from({ length: count }, (_, index) => ({ id: `${host.id}-swarm-${index}` }))
      },
      countOf: host => swarmCountOf(host),
    },
    discoverClue: (seat, amount) => { calls.discoverClue.push({ seat, amount }); state.investigators[seat].clues += amount },
    drawEncounter: () => { calls.drawEncounter += 1 },
    finish: key => calls.finish.push(key),
    defeatAll: () => { calls.defeatedAll += 1; for (const inv of state.investigators) inv.defeated = true },
    advanceAct: () => { calls.advanceAct += 1 },
    flipLocation: (id) => { behavior.locationFlipped(state, state.locations.find(location => location.id === id), api, state.currentSeat) },
    setShroudMod: (location, amount) => { location.shroudMod = amount },
    spendClues: (seat, amount) => {
      const inv = state.investigators[seat]
      inv.clues = Math.max(0, (inv.clues || 0) - amount)
      return inv.clues
    },
    addLocationTrait: () => {},
    removeLocationTrait: () => {},
    given: { virgil: [] },
  }
  // setupEnemies 的 helper 里 spawn 签名不同（state, code, locationId）
  return Object.assign(api, overrides)
}

function discoveredLocation(state, id) {
  return state.locations.find(location => location.id === id) || null
}

function addLocation(state, id) {
  const definition = state.scenario.locations[id]
  const location = { ...clone(definition), id, revealed: true, clues: definition.cluesPerInvestigator * state.numInvestigators }
  state.locations.push(location)
  return location
}

// ---------------------------------------------------------------------------
// 第 1 层：章节钩子
// ---------------------------------------------------------------------------
test('manifest/身份：id、development、包与遭遇组、17 地点 / 5 幕 / 2 议程 / 3 结局', () => {
  assert.equal(chapter.manifest.id, 'theSearchForKadath')
  assert.equal(chapter.manifest.campaignId, 'theDreamEaters')
  assert.equal(chapter.manifest.status, 'development')
  assert.equal(chapter.manifest.referenceCode, '06119')
  assert.deepEqual(chapter.manifest.requiredPackIds, ['core', 'tdeCampaign']) // 印刷包由 tdeCampaign cardRanges 覆盖
  assert.ok(chapter.manifest.requiredEncounterGroupIds.includes('theSearchForKadath'))
  assert.ok(chapter.manifest.requiredEncounterGroupIds.includes('zoogs'))
  assert.equal(chapter.manifest.locations.length, 17)
  assert.equal(chapter.manifest.acts.length, 5)
  assert.equal(chapter.manifest.agendas.length, 2)
  assert.deepEqual(chapter.manifest.resolutionIds, ['noResolution', 'resolution1', 'resolution2'])
  assert.equal(chapter.scenario.startLocation, 'ulthar')
  assert.equal(chapter.scenario.textLanguage, 'en')
  assert.equal(chapter.scenario.textStatus, 'pending-self-translation')
})

test('掩藏地点与背面故事卡：15 张 Veiled 全部带故事卡，storyFaces 覆盖 17 张', () => {
  const report = normalizeVeiledScenario({ locations: Object.values(chapter.scenario.locations) })
  assert.equal(report.total, 15)
  assert.equal(report.withStory, 15)
  assert.deepEqual(report.missing, [])
  assert.equal(Object.keys(chapter.scenario.storyFaces).length, 17)
  // 斯凯河 / 禁闭之地不是 Veiled，但由自身能力翻面出故事卡。
  assert.ok(chapter.scenario.locations.skaiRiver.backCode)
  assert.ok(chapter.scenario.locations.forbiddenLands.backCode)
})

test('setup 区域守恒：3 处地点在场，12 张敌人 + 14 处地点放在一边', () => {
  const state = makeState()
  const api = makeApi(state)
  const placed = behavior.setupLocations(state, [], { info: api.info })
  assert.deepEqual(placed, ['ulthar', 'skaiRiver', 'dylathLeen'])
  assert.equal(state.scenarioZones.setAside.length, 26)
  assert.equal(state.scenarioZones.setAside.filter(code => code === '06150').length, 2)
  assert.equal(state.scenarioZones.setAside.filter(code => code === '06149').length, 3)
})

test('setup 敌人：斯凯河 1 张「一群乌尼斯」，3–4 人局在狄拉斯-利恩再加 1 张', () => {
  for (const count of [2, 3]) {
    const state = makeState({ numInvestigators: count })
    const spawned = []
    const helper = { spawnEnemy: (stateArg, code, locationId) => spawned.push({ code, locationId }) }
    behavior.setupEnemies(state, [], helper)
    assert.equal(spawned.length, count >= 3 ? 2 : 1)
    assert.deepEqual(spawned[0], { code: PACK_OF_VOONITHS, locationId: 'skaiRiver' })
    if (count >= 3) assert.deepEqual(spawned[1], { code: PACK_OF_VOONITHS, locationId: 'dylathLeen' })
  }
})

test('介绍记录：与祖格鼠谈判时卡达斯的证据 +2、额外 2 经验、队长获得维吉尔·格雷', () => {
  const state = makeState({ records: { theInvestigatorsParleyedWithTheZoogs: true } })
  const api = makeApi(state)
  const given = []
  api.giveAsset = (seat, code) => { given.push({ seat, code }) }
  behavior.preScenarioSetup(state, [], api)
  assert.equal(state.campaign.records.evidenceOfKadath, 2)
  assert.equal(state.scenarioFlags.introXpBonus, 2)
  assert.deepEqual(given, [{ seat: 0, code: VIRGIL_GRAY }])
  assert.equal(state.scenarioFlags.introResolved, true)
})

test('介绍分支：空手离开神庙时不会给出卡达斯的证据', () => {
  const state = makeState()
  const api = makeApi(state, { choose: () => 'leaveEmptyHanded' })
  api.giveAsset = () => {}
  behavior.preScenarioSetup(state, [], api)
  assert.equal(state.campaign.records.evidenceOfKadath, undefined)
  assert.equal(state.scenarioFlags.introResolved, true)
})

test('区域设置（奥瑞巴）：清线索、移除旧地点、放入 3 处新地点、调查员到港、写访问记录', () => {
  const state = makeState()
  const api = makeApi(state)
  behavior.setupLocations(state, [], { info: api.info })
  // 初始 3 处地点在场
  for (const id of ['ulthar', 'skaiRiver', 'dylathLeen']) addLocation(state, id)
  state.investigators.forEach(inv => { inv.clues = 2 })
  const act = { ...state.acts[0], originalCode: '06122', code: '06122' }
  behavior.actReveal(state, act, api)
  const inPlay = state.locations.map(location => location.id).sort()
  assert.deepEqual(inPlay, ['baharna', 'mtNgranek', 'namelessRuins'])
  assert.deepEqual(state.investigators.map(inv => inv.location), ['baharna', 'baharna'])
  assert.deepEqual(state.investigators.map(inv => inv.clues), [0, 0])
  assert.deepEqual(state.scenarioFlags.regionsVisited, ['oriab'])
  assert.equal(state.scenarioFlags.nextActIndex, 1)
  // 找到的夜骑：1 张在恩格拉尼克山脉（2 人局）。
  assert.deepEqual(api.calls.spawns, [{ code: '06152', locationId: 'mtNgranek' }])
})

test('区域设置（米纳尔/禁闭之地/永恒之国）：放在一边的敌人按 setup 生成', () => {
  for (const region of REGIONS) {
    const state = makeState({ numInvestigators: 3 })
    const api = makeApi(state)
    behavior.setupLocations(state, [], { info: api.info })
    for (const id of ['ulthar', 'skaiRiver', 'dylathLeen']) addLocation(state, id)
    const act = { ...state.acts[0], originalCode: '06122', code: '06122' }
    api.calls.spawns.length = 0
    // 「去哪里？」只留目标区域可选：把它它三个区域记为已造访，选择回退到唯一可选项。
    state.scenarioFlags.regionsVisited = REGIONS.filter(item => item.id !== region.id).map(item => item.id)
    behavior.actReveal(state, act, api)
    const expected = region.locations.slice().sort()
    assert.deepEqual(state.locations.map(location => location.id).sort(), expected)
    assert.ok(state.scenarioFlags.regionsVisited.includes(region.id))
    assert.equal(state.scenarioFlags.nextActIndex, region.actIndex)
    // 每个区域至少生成它自己的 set-aside 敌人（奥瑞巴/米纳尔在 3 人局是 2 张夜骑）。
    assert.ok(api.calls.spawns.length >= 1, `${region.id} 应生成敌人`)
    if (region.id === 'oriab') assert.equal(api.calls.spawns.length, 2)
  }
})

test('幕推进：actIndexAfterAdvance 读取并清除区域设置写下的 nextActIndex', () => {
  const state = makeState()
  const api = makeApi(state)
  state.scenarioFlags.nextActIndex = 3
  assert.equal(behavior.actIndexAfterAdvance(state, state.acts[0], api), 3)
  assert.equal(state.scenarioFlags.nextActIndex, null)
  assert.equal(behavior.actIndexAfterAdvance(state, state.acts[0], api), undefined)
})

test('议程背面：06120 把 2 张冷原海盗与遭遇弃牌堆一起洗入遭遇牌库', () => {
  const state = makeState()
  const api = makeApi(state)
  state.scenarioZones.setAside = ['06105', '06105']
  state.encounterDiscard = ['06106']
  entryOf('06120').agendaRule.onReveal(state, state.agendas[0], api)
  assert.equal(state.encounterDeck.filter(code => code === '06105').length, 2)
  assert.equal(state.encounterDiscard.length, 0)
})

test('10 个神迹：checkObjectives 进入结局 1', () => {
  const state = makeState()
  const api = makeApi(state)
  state.markerCounts.reference = 10
  behavior.checkObjectives(state, api)
  assert.deepEqual(api.calls.finish, ['resolution1'])
})

test('veiledFlipped：翻面读背面故事卡、神迹 +1、标记已读且不重复结算', () => {
  const state = makeState()
  const api = makeApi(state)
  addLocation(state, 'dylathLeen')
  const result = { changed: true, storyCode: '06129b' }
  behavior.veiledFlipped(state, state.investigators[0], 'dylathLeen', result, api)
  assert.equal(signsOfTheGods(state, api), 1)
  assert.equal(state.scenarioFlags['storyRead:dylathLeen'], true)
  assert.ok(api.calls.info.some(text => text.includes('无穷秘密')))
  behavior.veiledFlipped(state, state.investigators[0], 'dylathLeen', result, api)
  assert.equal(signsOfTheGods(state, api), 1)
})

test('veiledFlipped（凶星）：两个神迹 + 本地敌人弃掉 + 调查员移到神庙 + 地点进胜利区', () => {
  const state = makeState()
  const api = makeApi(state)
  addLocation(state, 'cityWhichAppearsOnNoMap')
  addLocation(state, 'templeOfUnattainableDesires')
  state.investigators[0].location = 'cityWhichAppearsOnNoMap'
  state.enemies.push({ id: 'e1', code: '06149', originalCode: '06149', location: 'cityWhichAppearsOnNoMap' })
  behavior.veiledFlipped(state, state.investigators[0], 'cityWhichAppearsOnNoMap', { changed: true, storyCode: '06143b' }, api)
  assert.equal(signsOfTheGods(state, api), 2)
  assert.equal(state.enemies.length, 0)
  assert.equal(state.investigators[0].location, 'templeOfUnattainableDesires')
  assert.ok(state.victoryDisplay.some(card => (card.originalCode || card.code) === '06143'))
  assert.ok(api.calls.removedLocations.includes('cityWhichAppearsOnNoMap'))
})

test('混乱标记：骷髅按神迹数取值、石板 -2/-3、旧印 +2/+1、异教徒再揭示', () => {
  const standard = makeState()
  standard.markerCounts.reference = 3
  assert.equal(behavior.resolveChaosToken(standard, standard.investigators[0], 'skull', makeApi(standard)).delta, -3)
  assert.equal(behavior.resolveChaosToken(standard, standard.investigators[0], 'tablet', makeApi(standard)).delta, -2)
  assert.equal(behavior.resolveChaosToken(standard, standard.investigators[0], 'elderthing', makeApi(standard)).delta, 2)
  assert.equal(behavior.resolveChaosToken(standard, standard.investigators[0], 'cultist', makeApi(standard)).drawAnother, true)
  const hard = makeState({ difficulty: 'hard' })
  hard.markerCounts.reference = 3
  assert.equal(behavior.resolveChaosToken(hard, hard.investigators[0], 'skull', makeApi(hard)).delta, -4)
  assert.equal(behavior.resolveChaosToken(hard, hard.investigators[0], 'tablet', makeApi(hard)).delta, -3)
  assert.equal(behavior.resolveChaosToken(hard, hard.investigators[0], 'elderthing', makeApi(hard)).delta, 1)
})

test('afterTest 后果：石板失败放毁灭 / 异教徒失败抬帷幕 / 旧印成功多发现线索', () => {
  const state = makeState()
  addLocation(state, 'ulthar')
  state.investigators[0].location = 'ulthar'
  const tabletApi = makeApi(state, { choose: () => 'doom' })
  behavior.afterTest(state, state.investigators[0], {
    success: false, token: 'tablet', drawn: ['tablet'], source: { label: '调查', code: '06127' },
    difficulty: 3, value: 1,
  }, tabletApi)
  assert.deepEqual(tabletApi.calls.doom, [1])

  const cultistApi = makeApi(state)
  behavior.afterTest(state, state.investigators[0], {
    success: false, token: 'cultist', drawn: ['cultist'], source: { label: '调查', code: '06127' },
    difficulty: 3, value: 1,
  }, cultistApi)
  assert.equal(discoveredLocation(state, 'ulthar').shroudMod, 1)

  const elderApi = makeApi(state)
  behavior.afterTest(state, state.investigators[0], {
    success: true, token: 'elderthing', drawn: ['elderthing'], source: { label: '调查', code: '06127' },
    difficulty: 3, value: 5, successBy: 2,
  }, elderApi)
  assert.deepEqual(elderApi.calls.discoverClue, [{ seat: 0, amount: 1 }])
})

test('敌人数值：千面祭司按神迹数加攻/避/生命，一群乌尼斯在无蜂拥卡时 +2/+2', () => {
  const state = makeState()
  state.markerCounts.reference = 6
  const priest = { id: 'p1', code: PRIEST_OF_A_THOUSAND_MASKS, originalCode: PRIEST_OF_A_THOUSAND_MASKS, location: 'ulthar' }
  assert.equal(behavior.enemyStatModifier(state, priest, 'fight'), 1)
  assert.equal(behavior.enemyStatModifier(state, priest, 'evade'), 1)
  assert.equal(behavior.enemyStatModifier(state, priest, 'health'), 2)
  assert.deepEqual(behavior.enemyAttackModifier(state, priest, state.investigators[0]), { damage: 1 })

  state.markerCounts.reference = 0
  const voonith = { id: 'v1', code: PACK_OF_VOONITHS, originalCode: PACK_OF_VOONITHS, location: 'ulthar' }
  assert.equal(behavior.enemyStatModifier(state, voonith, 'fight'), 2)
  assert.equal(behavior.enemyStatModifier(state, voonith, 'evade'), 2)
  void _CATS
})

test('轮末区域推进：全员在同一港口且选择推进时调用 advanceAct', () => {
  const state = makeState()
  const api = makeApi(state, { choose: () => 'advance' })
  addLocation(state, 'dylathLeen')
  state.actIndex = 1
  state.investigators.forEach(inv => { inv.location = 'dylathLeen' })
  behavior.roundEnded(state, api)
  assert.equal(api.calls.advanceAct, 1)
})

test('结局与记录：resolution1 写入卡达斯的证据/维吉尔与伦道夫记录/被俘调查员', () => {
  const state = makeState({ records: { evidenceOfKadath: 1 } })
  state.markerCounts.reference = 4
  state.investigators[0].defeated = true
  const api = makeApi(state)
  const result = behavior.resolution(state, 'resolution1', [], api)
  assert.equal(result.award, true)
  assert.equal(state.campaign.records.evidenceOfKadath, 5)
  assert.equal(state.campaign.records.virgilWasCaptured, true)
  assert.equal(state.campaign.records.randolphEludedCapture, true)
  assert.deepEqual(state.campaign.records.wasCaptured, ['调查员1'])
})

test('结局选择：noResolution 时有人撤退 → resolution1，全员败退 → resolution2', () => {
  const resigned = makeState()
  resigned.investigators[0].resigned = true
  assert.equal(behavior.storyResolutionKey(resigned, 'noResolution'), 'resolution1')
  const allDefeated = makeState()
  allDefeated.investigators.forEach(inv => { inv.defeated = true })
  assert.equal(behavior.storyResolutionKey(allDefeated, 'noResolution'), 'resolution2')
})

test('存档/回放/往返：setup+故事结算后的 state JSON 两次序列化全等', () => {
  const state = makeState()
  const api = makeApi(state)
  behavior.setupLocations(state, [], { info: api.info })
  for (const id of ['ulthar', 'skaiRiver', 'dylathLeen']) addLocation(state, id)
  addLocation(state, 'dylathLeen')
  behavior.veiledFlipped(state, state.investigators[0], 'dylathLeen', { changed: true, storyCode: '06129b' }, api)
  const first = JSON.stringify(state)
  const second = JSON.stringify(JSON.parse(first))
  assert.equal(first, second)
  assert.equal(JSON.parse(first).markerCounts.reference, 1)
})

// ---------------------------------------------------------------------------
// 第 2 层：单卡条目
// ---------------------------------------------------------------------------
test('06154 奇妙平原：本地无线索时弃掉并涌动，有线索时附属到地点', () => {
  const state = makeState()
  addLocation(state, 'ulthar')
  state.investigators[0].location = 'ulthar'
  const api = makeApi(state)
  api.attachEncounterToLocation = (code, locationId) => {
    const location = discoveredLocation(state, locationId)
    location.attachments = [...(location.attachments || []), { id: 'att1', code }]
    return { id: 'att1', code }
  }
  const entry = entryOf('06154')
  state.locations[0].clues = 0
  const surged = entry.encounterResolve(state, state.investigators[0], { code: '06154' }, api)
  assert.equal(surged, false)
  assert.equal(api.calls.drawEncounter, 1)
  state.locations[0].clues = 2
  const attached = entry.encounterResolve(state, state.investigators[0], { code: '06154' }, api)
  assert.equal(attached, true)
  assert.equal(state.locations[0].attachments[0].code, '06154')
  assert.equal(behavior.locationShroudModifier(state, state.locations[0], state.investigators[0]), -2)
})

test('06153 麦格鸟之歌：附属地点，离开后受 1 恐惧 + 1 毁灭并弃掉附属', () => {
  const state = makeState()
  const api = makeApi(state)
  addLocation(state, 'ulthar')
  state.investigators[0].location = 'ulthar'
  const location = state.locations[0]
  location.attachments = [{ id: 'att1', code: '06153' }]
  api.detachLocationAttachment = (locationId, attachmentId) => {
    const target = discoveredLocation(state, locationId)
    const index = (target.attachments || []).findIndex(item => item.id === attachmentId)
    return index >= 0 ? target.attachments.splice(index, 1)[0] : null
  }
  behavior.locationLeft(state, state.investigators[0], location, api)
  assert.deepEqual(api.calls.horror, [{ seat: 0, amount: 1 }])
  assert.deepEqual(api.calls.doom, [1])
  assert.equal(location.attachments.length, 0)
})

test('06145 乌撒之猫：首次被击败改为加 3 张蜂拥卡并记录打破乌撒的法则', () => {
  const state = makeState()
  const api = makeApi(state)
  const enemy = { id: 'cat1', code: '06145', originalCode: '06145', health: 1, damageTaken: 3, location: 'ulthar' }
  const handled = entryOf('06145').enemyScript.onDefeated(state, enemy, api)
  assert.equal(handled, true)
  assert.equal(enemy.swarmCards, 3)
  assert.equal(enemy.damageTaken, 0)
  assert.deepEqual(state.campaign.records.hasBrokenTheLawOfUlthar, ['调查员1'])
  assert.equal(state.scenarioFlags.catsOfUltharFirstDefeat, true)
})

test('06147 夜色怪群：头领被击败时改为横置（接管击败）', () => {
  const state = makeState()
  const api = makeApi(state)
  const enemy = { id: 'horde1', code: HORDE_OF_NIGHT, originalCode: HORDE_OF_NIGHT, health: 1, damageTaken: 1 }
  const handled = entryOf('06147').enemyScript.onDefeated(state, enemy, api)
  assert.equal(handled, true)
  assert.equal(enemy.exhausted, true)
})

test('06142 无以达愿之庙：没有「向王祈求帮助」时行为拒绝进入', () => {
  const state = makeState()
  addLocation(state, 'templeOfUnattainableDesires')
  const message = behavior.investigatorEntryError(state, discoveredLocation(state, 'templeOfUnattainableDesires'), state.investigators[0])
  assert.match(message, /向王祈求帮助/)
  state.scenarioFlags.beseechedTheKing = true
  assert.equal(behavior.investigatorEntryError(state, discoveredLocation(state, 'templeOfUnattainableDesires'), state.investigators[0]), undefined)
})

test('06131 萨尔纳斯：不知道伊伯的事情时不能翻面（actionBlocked）', () => {
  const state = makeState()
  addLocation(state, 'sarnath')
  const message = behavior.actionBlocked(state, state.investigators[0], { action: 'flipVeiled', locationId: 'sarnath' })
  assert.match(message, /伊伯/)
  state.scenarioFlags.knowWhatHappenedToIb = true
  assert.equal(behavior.actionBlocked(state, state.investigators[0], { action: 'flipVeiled', locationId: 'sarnath' }), undefined)
})

test('06128 斯凯河：未翻面时离开检定可用（意志/敏捷二选一），翻面后不再检定', () => {
  const state = makeState()
  const api = makeApi(state, { choose: () => 'agility' })
  addLocation(state, 'skaiRiver')
  state.investigators[0].location = 'skaiRiver'
  behavior.beforeMove(state, state.investigators[0], state.scenario.locations.ulthar, api, { reason: 'move' })
  assert.equal(state.scenarioFlags.skaiLeaveSkill, 'agility')
  assert.deepEqual(behavior.locationLeaveTest(state, state.investigators[0], discoveredLocation(state, 'skaiRiver')), { skill: 'agility', difficulty: 2 })
  state.scenarioFlags['storyRead:skaiRiver'] = true
  assert.equal(behavior.locationLeaveTest(state, state.investigators[0], discoveredLocation(state, 'skaiRiver')), null)
})

test('06130b 卡达瑟隆之柱 / 06134b 诸神庙宇：神迹 +1 并洗入 1 张黑暗夜魇', () => {
  for (const code of ['06130b', '06134b', '06137b']) {
    const state = makeState()
    const api = makeApi(state)
    api.takeFromSetAside = codeArg => {
      const list = state.scenarioZones.setAside = ['06150']
      const index = list.indexOf(String(codeArg))
      if (index < 0) return false
      list.splice(index, 1)
      return true
    }
    entryOf(code).assetRule.resolve(state, api, { inv: state.investigators[0] })
    assert.equal(signsOfTheGods(state, api), 1, code)
    assert.ok(state.encounterDeck.includes('06150'), code)
  }
})

test('06137 恩格拉尼克山脉：无补给时进入触发战斗/敏捷(3)检定，失败失去行动并结束回合', () => {
  const state = makeState()
  addLocation(state, 'mtNgranek')
  state.investigators[0].location = 'mtNgranek'
  state.investigators[0].actionsLeft = 2
  const calls = { tests: 0, ended: 0, lost: 0 }
  const api = makeApi(state, {
    choose: () => 'combat',
    test: (seat, skill, difficulty, resolve) => {
      calls.tests += 1
      assert.equal(skill, 'combat')
      assert.equal(difficulty, 3)
      resolve({ success: false })
    },
    loseActions: (seat, amount) => { calls.lost += amount },
    endTurn: () => { calls.ended += 1 },
  })
  entryOf('06137').locationRule.onEnter.effect(state, discoveredLocation(state, 'mtNgranek'), api, state.investigators[0])
  assert.equal(calls.tests, 1)
  assert.equal(calls.lost, 2)
  assert.equal(calls.ended, 1)
  // 已有补给后不再触发。
  state.scenarioFlags.obtainedSuppliesFromBaharna = true
  calls.tests = 0
  entryOf('06137').locationRule.onEnter.effect(state, discoveredLocation(state, 'mtNgranek'), api, state.investigators[0])
  assert.equal(calls.tests, 0)
})

test('06138 无名遗迹：回合结束时对[盟友]支援造成 1 点直接伤害', () => {
  const state = makeState()
  addLocation(state, 'namelessRuins')
  state.investigators[0].location = 'namelessRuins'
  state.investigators[0].assets = [{ id: 'ally1', code: '01020' }]
  const damaged = []
  const api = makeApi(state, {
    cardTraits: code => (String(code) === '01020' ? ['Ally'] : []),
    damageAsset: (seat, assetId, amount) => damaged.push({ seat, assetId, amount }),
  })
  entryOf('06138').locationRule.onTurnEnd(state, discoveredLocation(state, 'namelessRuins'), api, state.investigators[0])
  assert.deepEqual(damaged, [{ seat: 0, assetId: 'ally1', amount: 1 }])
})
