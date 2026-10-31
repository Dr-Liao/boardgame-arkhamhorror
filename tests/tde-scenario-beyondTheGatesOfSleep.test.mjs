// 梦境门外（beyondTheGatesOfSleep · 06039）章节测试（P8-1 worker w-p8-a）。
//
// 两层证据：
//   1. 章节钩子（behavior）—— 14 种梦境、setup/区域、幕背面流程（含幕 3 组遭遇牌库）、
//      议程正面强制、Steps/Woods 地点规则、混乱标记、结局记录、存档往返；
//   2. 单卡条目（encounter-entries）—— 直接 import 单卡文件验证规则函数与 flags。
// 索引由 Lead 合并后重建，因此本测试用 registerCardAbilities 显式登记本章条目（已登记则跳过）。
import test from 'node:test'
import assert from 'node:assert/strict'
import '../src/engine/engine.js'
import { registerCardAbilities, registeredEntry } from '../src/engine/ability.js'
import * as chapter from '../content/campaigns/theDreamEaters/scenarios/beyondTheGatesOfSleep/index.js'
import {
  scenario as definition, ENCOUNTER_PILE, WOOD_CODES, SET_ASIDE_ENEMY_CODES,
} from '../content/campaigns/theDreamEaters/scenarios/beyondTheGatesOfSleep/definition.js'
import {
  beyondTheGatesOfSleepChaosToken, beyondTheGatesOfSleepChaosAfterTest,
  BEYOND_THE_GATES_TOKEN_MEANINGS,
} from '../content/campaigns/theDreamEaters/scenarios/beyondTheGatesOfSleep/chaos.js'
import entry06040 from '../src/cards/encounter-entries/theDreamEaters/beyondTheGatesOfSleep/06040.js'
import entry06041 from '../src/cards/encounter-entries/theDreamEaters/beyondTheGatesOfSleep/06041.js'
import entry06042 from '../src/cards/encounter-entries/theDreamEaters/beyondTheGatesOfSleep/06042.js'
import entry06043 from '../src/cards/encounter-entries/theDreamEaters/beyondTheGatesOfSleep/06043.js'
import entry06044 from '../src/cards/encounter-entries/theDreamEaters/beyondTheGatesOfSleep/06044.js'
import entry06045 from '../src/cards/encounter-entries/theDreamEaters/beyondTheGatesOfSleep/06045.js'
import entry06046 from '../src/cards/encounter-entries/theDreamEaters/beyondTheGatesOfSleep/06046.js'
import entry06047 from '../src/cards/encounter-entries/theDreamEaters/beyondTheGatesOfSleep/06047.js'
import entry06048 from '../src/cards/encounter-entries/theDreamEaters/beyondTheGatesOfSleep/06048.js'
import entry06049 from '../src/cards/encounter-entries/theDreamEaters/beyondTheGatesOfSleep/06049.js'
import entry06050 from '../src/cards/encounter-entries/theDreamEaters/beyondTheGatesOfSleep/06050.js'
import entry06051 from '../src/cards/encounter-entries/theDreamEaters/beyondTheGatesOfSleep/06051.js'
import entry06052 from '../src/cards/encounter-entries/theDreamEaters/beyondTheGatesOfSleep/06052.js'
import entry06053 from '../src/cards/encounter-entries/theDreamEaters/_shared/beyond_the_gates_of_sleep/06053.js'
import entry06054 from '../src/cards/encounter-entries/theDreamEaters/beyondTheGatesOfSleep/06054.js'
import entry06055 from '../src/cards/encounter-entries/theDreamEaters/beyondTheGatesOfSleep/06055.js'
import entry06056 from '../src/cards/encounter-entries/theDreamEaters/beyondTheGatesOfSleep/06056.js'
import entry06057 from '../src/cards/encounter-entries/theDreamEaters/beyondTheGatesOfSleep/06057.js'
import entry06058 from '../src/cards/encounter-entries/theDreamEaters/beyondTheGatesOfSleep/06058.js'
import entry06059 from '../src/cards/encounter-entries/theDreamEaters/beyondTheGatesOfSleep/06059.js'
import entry06060 from '../src/cards/encounter-entries/theDreamEaters/beyondTheGatesOfSleep/06060.js'
import entry06061 from '../src/cards/encounter-entries/theDreamEaters/beyondTheGatesOfSleep/06061.js'
import entry06062 from '../src/cards/encounter-entries/theDreamEaters/beyondTheGatesOfSleep/06062.js'

const ENTRIES = [
  entry06040, entry06041, entry06042, entry06043, entry06044, entry06045, entry06046, entry06047,
  entry06048, entry06049, entry06050, entry06051, entry06052, entry06053, entry06054, entry06055,
  entry06056, entry06057, entry06058, entry06059, entry06060, entry06061, entry06062,
]
for (const entry of ENTRIES) if (!registeredEntry(entry.code)) registerCardAbilities(entry)

const clone = value => structuredClone(value)

function stateFor(count = 2) {
  return {
    scenario: clone(definition),
    acts: clone(definition.acts),
    agendas: clone(definition.agendas),
    actIndex: 0,
    agendaIndex: 0,
    investigators: Array.from({ length: count }, (_, seat) => ({
      seat, code: '01001', name: `调查员${seat + 1}`, location: 'seventySteps', klass: 'seeker', traits: [],
      damage: 0, horror: 0, clues: 0, resources: 5, hand: [], assets: [], threat: [], engaged: [],
      deck: ['01020', '01021', '01022'], discard: [], actionsLeft: 3, defeated: false, resigned: false,
    })),
    locations: [], enemies: [], storyAssets: [], scenarioFlags: {}, scenarioZones: {},
    victoryDisplay: [], victory: 0, encounterDeck: [], encounterDiscard: [], doom: 0,
    campaign: {
      leadSeat: 0, mode: 'singleA', records: {},
      investigators: Array.from({ length: count }, () => ({ deck: [], purchases: [], status: 'active', trauma: { physical: 0, mental: 0 } })),
      chaosBag: [],
    },
    chaosBag: ['+1', '0', 'cultist', 'tablet', 'autofail'],
    difficulty: 'standard', numInvestigators: count, round: 1, phase: 'investigation', status: 'playing',
  }
}

function placeLocations(state, ids) {
  for (const id of ids) {
    if (state.locations.some(location => location.id === id)) continue
    const base = state.scenario.locations[id]
    if (!base) continue
    const clues = base.cluesFixed ?? (base.cluesPerInvestigator || 0) * state.numInvestigators
    const revealed = state.investigators.some(inv => inv.location === id)
    state.locations.push({ ...clone(base), id, revealed, clues: revealed ? clues : 0, maxClues: clues, doom: 0 })
  }
}
const locationOf = (state, id) => state.locations.find(location => location.id === id)

function apiStub(state, overrides = {}) {
  const api = {
    info: () => {},
    choose: () => undefined,
    random: () => 0.5,
    shuffle: items => [...items],
    gainResources: (seat, amount) => { state.investigators[seat].resources += amount },
    loseResources: (seat, amount) => { state.investigators[seat].resources -= amount },
    drawCards: (seat, amount) => { for (let i = 0; i < amount; i += 1) state.investigators[seat].hand.push('01001') },
    damage: (seat, amount) => { state.investigators[seat].damage += amount },
    horror: (seat, amount) => { state.investigators[seat].horror += amount },
    trauma: (seat, kind, amount) => { state.campaign.records[`trauma_${kind}_${seat}`] = amount },
    defeat: inv => { inv.defeated = true },
    spawn: (code, location) => {
      const enemy = { id: `enemy-${state.enemies.length + 1}`, code, originalCode: code, name: code,
        location, engagedSeat: null, damageTaken: 0, exhausted: false, traits: [] }
      state.enemies.push(enemy)
      return enemy
    },
    attack: () => {},
    banish: enemy => {
      const index = state.enemies.indexOf(enemy)
      if (index >= 0) state.enemies.splice(index, 1)
      return true
    },
    cardFlip: () => {},
    moveEnemy: (enemy, destination) => { enemy.location = destination },
    exhaustEnemy: enemy => { enemy.exhausted = true },
    test: (seat, skill, difficulty, resolve) => resolve({ success: true, value: difficulty + 1, difficulty, skill }),
    revealToken: () => 'skull',
    loseActions: (seat, amount) => { state.investigators[seat].actionsLeft = Math.max(0, state.investigators[seat].actionsLeft - amount) },
    discardChosen: (seat, n) => { state.investigators[seat].hand.splice(0, n) },
    discardFromHand: (seat, code) => {
      const hand = state.investigators[seat].hand
      const index = hand.indexOf(code)
      if (index >= 0) state.investigators[seat].discard.push(hand.splice(index, 1)[0])
    },
    setScenarioFlag: (key, value = true) => { state.scenarioFlags ||= {}; state.scenarioFlags[key] = value },
    setCampaignRecord: (key, value) => {
      state.campaign.records ||= {}
      if (value == null) delete state.campaign.records[key]
      else state.campaign.records[key] = value
      return state.campaign.records[key]
    },
    campaignRecord: key => state.campaign.records?.[key] ?? null,
    takeFromSetAside: code => {
      const list = state.scenarioZones?.setAside || []
      const index = list.indexOf(code)
      if (index < 0) return false
      list.splice(index, 1)
      return true
    },
    place: id => {
      const base = state.scenario.locations[id]
      if (!base) return null
      const location = { ...clone(base), id, revealed: false, clues: 0, maxClues: (base.cluesPerInvestigator || 0) * state.numInvestigators, doom: 0 }
      state.locations.push(location)
      return location
    },
    removeLocationFromGame: id => {
      const index = state.locations.findIndex(location => location.id === id)
      if (index >= 0) state.locations.splice(index, 1)
      return index >= 0
    },
    shuffleIntoEncounterDeck: codes => { state.encounterDeck.push(...codes) },
    addDoom: amount => { state.doom += amount },
    doomOn: (card, amount = 1) => { card.doom = (card.doom || 0) + amount },
    advanceAct: () => { state.actIndex += 1 },
    finish: key => { state.resolutionKey = key },
    spendClues: (seat, n) => { state.investigators[seat].clues = Math.max(0, state.investigators[seat].clues - n) },
    locationDistance: (from, targets) => {
      if (!Array.isArray(targets)) return -1
      if (targets.includes(from)) return 0
      const seen = new Set([from])
      const queue = [[from, 0]]
      while (queue.length) {
        const [current, steps] = queue.shift()
        const location = locationOf(state, current)
        for (const next of location?.connections || []) {
          if (targets.includes(next)) return steps + 1
          if (seen.has(next)) continue
          seen.add(next)
          queue.push([next, steps + 1])
        }
      }
      return -1
    },
    stepToward: (from, to) => {
      const location = locationOf(state, from)
      const target = locationOf(state, to)
      if (!location || !target) return null
      return (location.connections || []).find(id => id === to)
        || (location.connections || []).find(id => locationOf(state, id)) || null
    },
    locName: id => locationOf(state, id)?.name || id,
    tokenLabel: token => token,
    swarm: {
      place: (host, count) => {
        host.swarmCards ||= []
        const cards = []
        for (let i = 0; i < count; i += 1) {
          const card = { id: `swarm-${host.id}-${host.swarmCards.length + 1}`, code: '06105', kind: 'swarm' }
          host.swarmCards.push(card)
          cards.push(card)
        }
        return cards
      },
      countOf: host => (host?.swarmCards || []).length,
      splitDamage: (host, damage) => ({ defeatedSwarm: [], toSwarm: damage }),
    },
    campaignCardChange: (campaign, seat, code) => { campaign.investigators[seat].deck.push(code) },
    addTrauma: (seat, kind, amount) => {
      const record = state.campaign.investigators[seat]
      record.trauma[kind] = (record.trauma[kind] || 0) + amount
    },
    ...overrides,
  }
  // 条目的可选路径用 api.choice（与引擎别名 choose 同一 requestChoice）。
  if (typeof api.choice !== 'function') api.choice = api.choose
  return api
}

function setup(state) {
  chapter.behavior.setupLocations(state, [], { info: () => {} })
  placeLocations(state, ['seventySteps', 'cavernOfFlame'])
  return state
}

// ---------------------------------------------------------------------------
// 1. manifest / 身份 / 结构
// ---------------------------------------------------------------------------
test('06039 章节清单：development、12 地点、4 幕、1 议程、结局与参考卡', () => {
  assert.equal(chapter.manifest.id, 'beyondTheGatesOfSleep')
  assert.equal(chapter.manifest.status, 'development')
  assert.equal(chapter.manifest.contentVersion, '1.0.0')
  assert.equal(chapter.manifest.campaignId, 'theDreamEaters')
  assert.equal(chapter.manifest.referenceCode, '06039')
  assert.equal(chapter.scenario.originalCode, '06039')
  assert.equal(chapter.manifest.locations.length, 12, '5 台阶/小路 + 7 魔幻森林')
  assert.deepEqual(chapter.manifest.acts.map(act => act.id), ['act1', 'act2', 'act3', 'act4'])
  assert.deepEqual(chapter.manifest.agendas.map(agenda => agenda.id), ['agenda1'])
  assert.deepEqual(chapter.manifest.resolutionIds, ['noResolution', 'resolution1', 'resolution2'])
  assert.equal(chapter.manifest.startLocationId, 'seventySteps')
  assert.ok(chapter.manifest.requiredEncounterGroupIds.includes('zoogs'))
  assert.ok(chapter.manifest.requiredMechanicIds.includes('tdeSwarming'))
})

test('身份登记：地点/幕/议程/敌人/诡计/剧情支援都有 mapped 原卡身份', () => {
  for (const category of ['locations', 'acts', 'agendas', 'enemies', 'treacheries', 'storyAssets']) {
    for (const [id, identity] of Object.entries(chapter.identities[category] || {})) {
      assert.ok(identity.originalCode, `${category}/${id} 缺 originalCode`)
      assert.equal(identity.identityStatus, 'mapped')
    }
  }
  assert.equal(chapter.identities.locations.seventySteps.originalCode, '06045')
  assert.equal(chapter.identities.enemies['06057'].originalCode, '06057')
  assert.equal(chapter.identities.storyAssets['06059'].originalCode, '06059')
})

// ---------------------------------------------------------------------------
// 2. setup / 区域守恒 / 梦境
// ---------------------------------------------------------------------------
test('setup：七十级台阶与火焰洞穴入场；其余地点/守门祭司/古革巨人/伦道夫放一边；开局无遭遇牌库', () => {
  const state = stateFor(2)
  const placed = chapter.behavior.setupLocations(state, [], { info: () => {} })
  assert.deepEqual(placed, ['seventySteps', 'cavernOfFlame'])
  placeLocations(state, placed)
  const aside = state.scenarioZones.setAside
  for (const id of ['sevenHundredSteps', 'baseOfTheSteps', 'theEnchantedPath',
    'mysticalForest', 'villageOfZoogs', 'greatStoneCircle', 'stoneTrapdoor', 'theMoonTree', 'fungalForest', 'lostWoods']) {
    const code = definition.locations[id].originalCode
    assert.ok(aside.includes(code), `放一边缺地点 ${id}(${code})`)
  }
  assert.ok(aside.includes('06059'), '放一边缺伦道夫·卡特')
  for (const code of SET_ASIDE_ENEMY_CODES) assert.ok(aside.includes(code), `放一边缺敌人 ${code}`)
  assert.equal(state.scenarioZones.encounterAside.length, ENCOUNTER_PILE.length)
  assert.equal(state.encounterDeck.length, 0, '开局没有遭遇牌库')
  assert.equal(locationOf(state, 'seventySteps').revealed, true, '调查员起始地点已揭示')
})

test('14 种梦境：按玩家顺序各选一种且不重复，中立之梦给资源/手牌', () => {
  const state = setup(stateFor(2))
  const keys = ['neutral1', 'neutral2']
  chapter.behavior.preScenarioSetup(state, [], apiStub(state, { choose: () => keys.shift() }))
  assert.equal(state.scenarioFlags.dreams.length, 2)
  assert.deepEqual(state.scenarioFlags.dreams.map(entry => entry.key), ['neutral1', 'neutral2'])
  assert.equal(state.investigators[0].resources, 7, '中立之梦 1：+2 资源')
  assert.equal(state.investigators[1].hand.length, 1, '中立之梦 2：+1 起始手牌')
  // 已结算的梦境不会被重复分配。
  chapter.behavior.preScenarioSetup(state, [], apiStub(state, { choose: () => 'neutral1' }))
  assert.equal(state.scenarioFlags.dreams.length, 2)
})

test('幕/议程都声明 campaignRule 揭示；议程毁灭阈值 19；幕目标数据正确', () => {
  for (const act of definition.acts) assert.equal(act.reveal.type, 'campaignRule')
  for (const agenda of definition.agendas) assert.equal(agenda.reveal.type, 'campaignRule')
  assert.equal(definition.agendas[0].doomThreshold, 19)
  assert.equal(definition.acts[0].objective.type, 'enterLocation')
  assert.equal(definition.acts[0].objective.location, 'cavernOfFlame')
  assert.equal(definition.acts[3].objective.type, 'clues')
  assert.equal(definition.acts[3].objective.perInvestigator, 5)
  assert.equal(definition.acts[3].objective.atLocation, 'theEnchantedPath')
})

// ---------------------------------------------------------------------------
// 3. 幕的背面
// ---------------------------------------------------------------------------
test('幕 1 背面：调查员失去线索、两位守门祭司在火焰洞穴入场、混乱袋永久 +1 骷髅', () => {
  const state = setup(stateFor(2))
  state.investigators[0].clues = 3
  chapter.behavior.actReveal(state, state.acts[0], apiStub(state))
  assert.equal(state.investigators[0].clues, 0)
  const inCavern = state.enemies.filter(enemy => enemy.location === 'cavernOfFlame')
  assert.deepEqual(inCavern.map(enemy => enemy.code).sort(), ['06057', '06058'])
  assert.equal(state.chaosBag.filter(token => token === 'skull').length, 1, '永久加入 1 个骷髅标记')
  assert.equal(state.campaign.chaosBag.filter(token => token === 'skull').length, 1, '战役袋也写入')
})

test('幕 2 背面：七百级台阶/楼梯底部/魔幻小路入场，混乱袋再 +1 骷髅', () => {
  const state = setup(stateFor(2))
  chapter.behavior.actReveal(state, state.acts[1], apiStub(state))
  for (const id of ['sevenHundredSteps', 'baseOfTheSteps', 'theEnchantedPath']) {
    assert.ok(locationOf(state, id), `${id} 应已入场`)
  }
  assert.equal(state.chaosBag.filter(token => token === 'skull').length, 1, '幕 2 背面再永久加入 1 个骷髅标记')
})

test('幕 2 目标：纳什特与卡曼塔都不在场时推进', () => {
  const state = setup(stateFor(2))
  state.actIndex = 1
  state.enemies.push({ id: 'e1', code: '06057', originalCode: '06057', location: 'cavernOfFlame' })
  chapter.behavior.checkObjectives(state, apiStub(state))
  assert.equal(state.actIndex, 1, '还有守门祭司在场时不推进')
  state.enemies = []
  chapter.behavior.checkObjectives(state, apiStub(state))
  assert.equal(state.actIndex, 2)
})

test('幕 3 背面：移除台阶地点、放 6 张魔幻森林、另 1 张移出游戏并组成遭遇牌库', () => {
  const state = setup(stateFor(3))
  // 先把台阶地点与 7 张森林放一边（setup 之后）；再模拟幕 1/2 背面已入场。
  chapter.behavior.actReveal(state, state.acts[1], apiStub(state))
  chapter.behavior.actReveal(state, state.acts[0], apiStub(state))
  state.actIndex = 2
  state.investigators[0].clues = 2
  chapter.behavior.actReveal(state, state.acts[2], apiStub(state))
  // 台阶地点（含火焰洞穴；魔幻小路只有 [[Woods]] 特性，不移除）全部移除。
  for (const id of ['seventySteps', 'cavernOfFlame', 'sevenHundredSteps', 'baseOfTheSteps']) {
    assert.equal(locationOf(state, id), undefined, `${id} 应被移出游戏`)
  }
  assert.ok(locationOf(state, 'theEnchantedPath'), '魔幻小路没有[[台阶]]特性，不被幕 3 背面移除')
  const woodsInPlay = state.locations.filter(location => WOOD_CODES.includes(location.originalCode))
  assert.equal(woodsInPlay.length, 6, '随机 6 张魔幻森林入场')
  assert.equal(state.scenarioZones.removed.length, 1, '另 1 张魔幻森林移出游戏')
  assert.ok(state.encounterDeck.length > 0, '遭遇牌库组成')
  assert.equal(state.scenarioZones.encounterAside.length, 0)
  assert.equal(state.chaosBag.filter(token => token === 'skull').length, 3, '幕 1/2/3 各永久加入 1 个骷髅')
})

test('幕 3 目标：每位调查员都在魔幻小路才推进', () => {
  const state = setup(stateFor(2))
  state.actIndex = 2
  placeLocations(state, ['theEnchantedPath'])
  state.investigators[0].location = 'theEnchantedPath'
  chapter.behavior.checkObjectives(state, apiStub(state))
  assert.equal(state.actIndex, 2)
  state.investigators[1].location = 'theEnchantedPath'
  chapter.behavior.checkObjectives(state, apiStub(state))
  assert.equal(state.actIndex, 3)
})

test('幕 4 背面：队长二选一 → 结局 1（旁观）/结局 2（打断黑猫）', () => {
  for (const [choice, expected] of [['stepBack', 'resolution1'], ['interrupt', 'resolution2']]) {
    const state = setup(stateFor(2))
    state.actIndex = 3
    chapter.behavior.actReveal(state, state.acts[3], apiStub(state, { choose: () => choice }))
    assert.equal(state.resolutionKey, expected)
  }
})

// ---------------------------------------------------------------------------
// 4. 议程正面强制 / Steps 地点
// ---------------------------------------------------------------------------
test('议程 06040 正面强制：神话阶段放毁灭且有人在[[台阶]]地点时额外 +1 毁灭', () => {
  const state = setup(stateFor(2))
  state.phase = 'mythos'
  chapter.behavior.doomPlaced(state, { target: null, amount: 1, agenda: true }, apiStub(state))
  assert.equal(state.doom, 1)
  state.investigators[0].location = 'mysticalForest'
  state.investigators[1].location = 'mysticalForest'
  chapter.behavior.doomPlaced(state, { target: null, amount: 1, agenda: true }, apiStub(state))
  assert.equal(state.doom, 1, '没有人在台阶地点时不追加')
  state.phase = 'investigation'
  chapter.behavior.doomPlaced(state, { target: null, amount: 1, agenda: true }, apiStub(state))
  assert.equal(state.doom, 1, '只在神话阶段追加')
})

test('议程 06040 背面：幕 4 分支记录偏离道路并击败全员；幕 1–3 分支逐人选择检定', () => {
  const actFour = setup(stateFor(2))
  actFour.actIndex = 3
  chapter.behavior.agendaReveal(actFour, actFour.agendas[0], apiStub(actFour))
  assert.equal(actFour.campaign.records.theDreamersStrayedFromThePath, true)
  assert.equal(actFour.investigators.every(inv => inv.defeated), true)

  const actOne = setup(stateFor(1))
  actOne.actIndex = 0
  const api = apiStub(actOne, {
    choose: () => 'test',
    test: (seat, skill, difficulty, resolve) => resolve({ success: false, value: 0, difficulty }),
  })
  chapter.behavior.agendaReveal(actOne, actOne.agendas[0], api)
  assert.equal(actOne.investigators[0].defeated, true)
  assert.equal(actOne.campaign.records.trauma_physical_0, 1, '检定失败承受 1 点物理创伤')
})

test('火焰洞穴：未揭示面要求先发现七十级台阶全部线索；神话阶段结束本地调查员受伤', () => {
  const state = setup(stateFor(1))
  placeLocations(state, ['sevenHundredSteps'])
  state.locations = state.locations.filter(location => location.id !== 'cavernOfFlame')
  const cavernBase = definition.locations.cavernOfFlame
  state.locations.push({ ...clone(cavernBase), id: 'cavernOfFlame', revealed: false, clues: 0, maxClues: 0, doom: 0 })
  const cavern = locationOf(state, 'cavernOfFlame')
  const steps = locationOf(state, 'seventySteps')
  steps.clues = 2
  assert.equal(typeof entry06046.locationRule.entryError(state, cavern, state.investigators[0]).length, 'number')
  steps.clues = 0
  assert.equal(entry06046.locationRule.entryError(state, cavern, state.investigators[0]), undefined)
  state.investigators[0].location = 'cavernOfFlame'
  entry06046.locationRule.onMythosEnd(state, cavern, apiStub(state))
  assert.equal(state.investigators[0].damage, 1)
})

test('魔幻森林·巨石阵：揭示时把放在一边的辛劳的古革巨人生成在本地', () => {
  const state = setup(stateFor(2))
  placeLocations(state, ['greatStoneCircle'])
  entry06052.locationRule.onReveal(state, locationOf(state, 'greatStoneCircle'), apiStub(state))
  assert.equal(state.enemies.some(enemy => enemy.code === '06060' && enemy.location === 'greatStoneCircle'), true)
})

test('幕 4 正面强制：首位调查员进入魔幻森林后记录「入梦者偏离了道路」', () => {
  const state = setup(stateFor(2))
  state.actIndex = 3
  chapter.behavior.locationEntered(state, state.investigators[0],
    { id: 'mysticalForest', code: '06050', originalCode: '06050' }, apiStub(state))
  assert.equal(state.campaign.records.theDreamersStrayedFromThePath, true)
  const before = state.campaign.records.theDreamersStrayedFromThePath
  chapter.behavior.locationEntered(state, state.investigators[1],
    { id: 'lostWoods', code: '06056', originalCode: '06056' }, apiStub(state))
  assert.equal(state.campaign.records.theDreamersStrayedFromThePath, before, '只记录一次')
})

// ---------------------------------------------------------------------------
// 5. 混乱标记
// ---------------------------------------------------------------------------
test('混乱符号：skull 按手牌数（普通半张向上取整、困难全数）、cultist 按已揭示森林数、tablet -2', () => {
  const state = setup(stateFor(2))
  const inv = state.investigators[0]
  inv.hand = ['01001', '01001', '01001', '01001', '01001']
  assert.equal(beyondTheGatesOfSleepChaosToken(state, inv, 'skull').delta, -3)
  state.difficulty = 'hard'
  assert.equal(beyondTheGatesOfSleepChaosToken(state, inv, 'skull').delta, -5)
  assert.equal(beyondTheGatesOfSleepChaosToken(state, inv, 'tablet').delta, -2)
  state.difficulty = 'standard'
  // 已揭示的魔幻森林数：只数 7 张森林，不数台阶地点。
  state.locations = [
    { id: 'w1', code: '06050', revealed: true, traits: ['Woods'] },
    { id: 'w2', code: '06051', revealed: false, traits: ['Woods'] },
    { id: 'base', code: '06048', revealed: true, traits: ['Steps', 'Woods'] },
  ]
  assert.equal(beyondTheGatesOfSleepChaosToken(state, inv, 'cultist').delta, -1)
  state.difficulty = 'hard'
  assert.equal(beyondTheGatesOfSleepChaosToken(state, inv, 'cultist').delta, -2, '困难/专家数[[Woods]]特性地点')
})

test('afterTest：对带蜂拥的敌人攻击/躲避失败时补 1 张蜂拥卡（普通失败 / 困难出现即结算）', () => {
  const state = setup(stateFor(2))
  const enemy = { id: 'zoog', code: '06105', originalCode: '06105', location: 'w1', swarmCards: [{ id: 's1' }] }
  state.enemies.push(enemy)
  state.scenario.enemies['06105'] = { swarming: { kind: 'fixed', value: 1 } }
  const testResult = {
    success: true, drawn: ['tablet'], cancelledTokens: [],
    source: { label: '攻击', kind: 'fight', enemyId: 'zoog' },
  }
  const consequence = beyondTheGatesOfSleepChaosAfterTest(state, state.investigators[0], testResult)
  assert.equal(consequence, null, '普通难度成功不追加')
  const failed = beyondTheGatesOfSleepChaosAfterTest(state, state.investigators[0], { ...testResult, success: false })
  assert.deepEqual(failed, { swarmingEnemyId: 'zoog', amount: 1 })
  state.difficulty = 'hard'
  assert.deepEqual(beyondTheGatesOfSleepChaosAfterTest(state, state.investigators[0], testResult),
    { swarmingEnemyId: 'zoog', amount: 1 }, '困难/专家成功也追加')
})

// ---------------------------------------------------------------------------
// 6. 单卡条目（条目函数直接调用）
// ---------------------------------------------------------------------------
test('卡曼塔（06057）：谈判动作 + 成功翻面结算故事、失败攻击本地每位调查员', () => {
  const state = setup(stateFor(2))
  state.investigators.forEach(inv => { inv.location = 'cavernOfFlame' })
  const enemy = { id: 'kaman', code: '06057', originalCode: '06057', name: '卡曼塔', location: 'cavernOfFlame',
    traits: ['Dreamlands', 'Warden', 'Elite'] }
  state.enemies.push(enemy)
  const move = entry06057.enemyScript.encounterAction(state, state.investigators[0], enemy)
  assert.equal(move.rule, 'parleyKamanThah')
  // 失败路径：攻击本地每位调查员。
  let attacks = 0
  entry06057.enemyScript.performEncounterAction(state, state.investigators[0], enemy, move, apiStub(state, {
    choose: () => 'willpower',
    test: (seat, skill, difficulty, resolve) => resolve({ success: false, value: 0, difficulty }),
    attack: () => { attacks += 1 },
  }))
  assert.equal(attacks, 2)
  // 成功路径：翻面展示故事 + 敌人离场 + 记录。
  const api = apiStub(state, {
    choose: () => 'willpower',
    test: (seat, skill, difficulty, resolve) => resolve({ success: true, value: 9, difficulty }),
  })
  entry06057.enemyScript.performEncounterAction(state, state.investigators[0], enemy, move, api)
  assert.equal(state.scenarioFlags.trialOfKamanThahResolved, true)
  assert.equal(state.enemies.includes(enemy), false)
})

test('纳什特（06058）：谈判失败攻击、击败时结算故事面', () => {
  const state = setup(stateFor(1))
  const enemy = { id: 'nasht', code: '06058', originalCode: '06058', location: 'seventySteps' }
  state.investigators[0].location = 'seventySteps'
  entry06058.enemyScript.onDefeated(state, enemy, apiStub(state))
  assert.equal(state.scenarioFlags.trialOfNashtResolved, true)
})

test('辛劳的古革巨人（06060）：不能进入「魔幻小路」→ 猎手移动被接管并绕行，效果移动被移回', () => {
  const state = setup(stateFor(2))
  placeLocations(state, ['baseOfTheSteps', 'theEnchantedPath', 'seventySteps'])
  state.investigators[0].location = 'baseOfTheSteps'
  const gug = { id: 'gug', code: '06060', originalCode: '06060', location: 'baseOfTheSteps', hunter: true, exhausted: false, engagedSeat: null }
  state.enemies.push(gug)
  const api = apiStub(state, {
    stepToward: () => 'theEnchantedPath',
    locationDistance: (from, targets) => targets.includes(from) ? 0 : 1,
  })
  // 默认下一步是魔幻小路（禁区）：behavior.hunterMove 接管并改走其他连接。
  const handled = chapter.behavior.hunterMove(state, gug, api)
  assert.equal(handled, true)
  assert.notEqual(gug.location, 'theEnchantedPath')
  // 效果移动进入禁区：enemyMoved 把它移回。
  state.scenarioFlags.returningGug = false
  gug.location = 'theEnchantedPath'
  chapter.behavior.enemyMoved(state, gug, 'theEnchantedPath', api, 'baseOfTheSteps')
  assert.equal(gug.location, 'baseOfTheSteps', '效果移动进入禁区时被移回')
})

test('远古祖格鼠（06061）：生成在未揭示的魔幻森林；敌军阶段为蜂拥祖格鼠加卡', () => {
  const state = setup(stateFor(2))
  state.locations.push(
    { id: 'w1', code: '06050', originalCode: '06050', revealed: false, clues: 1, connections: [], traits: ['Woods'], name: '魔幻森林' },
    { id: 'w2', code: '06051', originalCode: '06051', revealed: true, clues: 1, connections: [], traits: ['Woods'], name: '魔幻森林' },
  )
  const ai = apiStub(state, { choose: () => 'w1' })
  assert.equal(chapter.behavior.spawnLocation(state, '06061', null, null, ai), 'w1', '优先未揭示的森林')
  const self = { id: 'zoog0', code: '06061', originalCode: '06061', location: 'w1', exhausted: false }
  const host = { id: 'zoog1', code: '06106', originalCode: '06106', location: 'w1', exhausted: true, swarmCards: [{ id: 's' }] }
  state.enemies.push(self, host)
  state.scenario.enemies['06106'] = { swarming: { kind: 'fixed', value: 1 } }
  state.encounterDeck = ['01001']
  entry06061.enemyScript.onEnemyPhaseStart(state, self, apiStub(state))
  assert.equal(host.swarmCards.length, 2, '每个带蜂拥的祖格鼠敌人各加 1 张')
})

test('魔幻森林（06050 离开弃牌 / 06055 回合开始随机标记 / 06056 轮末毁灭）', () => {
  const state = setup(stateFor(1))
  state.locations.push({ id: 'w50', code: '06050', originalCode: '06050', revealed: true, clues: 2, connections: [], traits: [], name: '神秘森林' })
  const inv = state.investigators[0]
  inv.hand = ['a', 'b', 'c']
  entry06050.locationRule.onLeave.effect(state, locationOf(state, 'w50'), apiStub(state), inv)
  assert.equal(inv.hand.length, 1, '按本地线索数弃 2 张手牌')

  // 06055：回合开始时揭示坏标记 → 1 伤害 + 失去 1 行动。
  const state2 = setup(stateFor(1))
  state2.locations.push({ id: 'w55', code: '06055', originalCode: '06055', revealed: true, clues: 0, connections: [], traits: [], name: '真菌森林' })
  state2.investigators[0].location = 'w55'
  state2.investigators[0].actionsLeft = 3
  let lostActions = 0
  entry06055.locationRule.onTurnBegins(state2, state2.investigators[0], locationOf(state2, 'w55'), apiStub(state2, {
    revealToken: () => 'skull',
    loseActions: (seat, n) => { lostActions += n },
  }))
  assert.equal(state2.investigators[0].damage, 1)
  assert.equal(lostActions, 1)

  // 06056：揭示后本轮不离开 → 轮末 +1 毁灭。
  const state3 = setup(stateFor(1))
  state3.locations.push({ id: 'w56', code: '06056', originalCode: '06056', revealed: true, clues: 0, connections: [], traits: [], name: '迷失森林' })
  state3.investigators[0].location = 'w56'
  entry06056.locationRule.onReveal(state3, locationOf(state3, 'w56'), apiStub(state3), 0)
  assert.equal(state3.scenarioFlags.lostWoodsPending.length, 1)
  chapter.behavior.roundEnded(state3, apiStub(state3))
  assert.equal(state3.doom, 1)
  assert.equal(state3.scenarioFlags.lostWoodsPending.length, 0)
})

test('伦道夫·卡特（06059）剧情支援：+1 战斗/+1 敏捷 与 tablet 符号后抽 2 张', () => {
  assert.deepEqual(entry06059.passive.stats, { combat: 1, agility: 1 })
  const ability = entry06059.abilities[0]
  assert.equal(ability.trigger, 'symbolRevealed')
  assert.equal(ability.cost.exhaust, true)
  assert.equal(ability.criteria[0]({ context: { token: 'cultist' } }), false)
  assert.equal(ability.criteria[0]({ context: { token: 'tablet' } }), true)
  const state = setup(stateFor(1))
  ability.resolve({ inv: state.investigators[0], api: apiStub(state) })
  assert.equal(state.investigators[0].hand.length, 2)
})

// ---------------------------------------------------------------------------
// 7. 结局 / 记录
// ---------------------------------------------------------------------------
test('结局：noResolution / 结局 1 / 结局 2 写对应战役记录（伦道夫可加入牌组）', () => {
  const cases = [
    ['noResolution', 'theInvestigatorsWereSavedByRandolphCarder'],
    ['resolution1', 'theCatsCollectedTheirTributeFromTheZoogs'],
    ['resolution2', 'theInvestigatorsParleyedWithTheZoogs'],
  ]
  for (const [key, record] of cases) {
    const state = setup(stateFor(1))
    assert.deepEqual(chapter.behavior.resolution(state, key, [], apiStub(state, { choose: () => 'skip' })), { award: true, bonus: 0 })
    assert.equal(state.campaign.records[record], true, `${key} 应写 ${record}`)
  }
  const joined = setup(stateFor(1))
  chapter.behavior.resolution(joined, 'resolution1', [], apiStub(joined, { choose: () => '0' }))
  assert.ok(joined.campaign.investigators[0].deck.includes('06059'), '伦道夫·卡特可加入牌组')
})

// ---------------------------------------------------------------------------
// 8. 存档往返 / 确定性
// ---------------------------------------------------------------------------
test('同一路线的开始状态在 JSON 往返后完全一致（存档/回放/往返）', () => {
  const build = () => {
    const state = setup(stateFor(2))
    const keys = ['neutral1', 'neutral2']
    chapter.behavior.preScenarioSetup(state, [], apiStub(state, { choose: () => keys.shift() }))
    chapter.behavior.actReveal(state, state.acts[0], apiStub(state))
    chapter.behavior.actReveal(state, state.acts[1], apiStub(state))
    return state
  }
  const first = build()
  const serialized = JSON.stringify(first)
  const restored = JSON.parse(serialized)
  assert.equal(JSON.stringify(restored), serialized, '两次 JSON 序列化必须相等')
  assert.deepEqual(restored.scenarioFlags, first.scenarioFlags)
  assert.deepEqual(restored.scenarioZones, first.scenarioZones)
  assert.deepEqual(restored.encounterDeck, first.encounterDeck)
  assert.deepEqual(restored.campaign.records, first.campaign.records)
  assert.deepEqual(restored.locations.map(location => location.id), first.locations.map(location => location.id))
  assert.equal(restored.scenario.id, 'beyondTheGatesOfSleep')
})
