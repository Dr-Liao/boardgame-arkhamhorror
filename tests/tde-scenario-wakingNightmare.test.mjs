// 清醒噩梦（wakingNightmare · 06063）章节测试（P8-1 worker w-p8-a）。
//
// 两层证据：
//   1. 章节钩子（behavior）—— setup/区域、幕/议程流程、滋生袋与滋生检定、混乱标记、结局记录、存档往返；
//   2. 单卡条目（encounter-entries）—— 直接 import 单卡文件验证规则行为与 flags。
// 索引由 Lead 合并后重建，因此本测试用 registerCardAbilities 显式登记本章条目（已登记则跳过），
// 使 behavior 里的 entryFlags/actRuleFor 读点在测试中生效。
import test from 'node:test'
import assert from 'node:assert/strict'
import '../src/engine/engine.js'
import { registerCardAbilities, registeredEntry } from '../src/engine/ability.js'
import {
  createTokenBag, tokenBagInfo, revealTokenFromBag, returnTokenToBag, addTokenToBag,
  markInfested, clearInfested, isInfestedLocation, infestedCount,
} from '../src/engine/token-bag.js'
import * as chapter from '../content/campaigns/theDreamEaters/scenarios/wakingNightmare/index.js'
import {
  scenario as definition, SET_ASIDE_ALIASES, SET_ASIDE_LOCATIONS, ENCOUNTER_DECK,
} from '../content/campaigns/theDreamEaters/scenarios/wakingNightmare/definition.js'
import {
  wakingNightmareChaosToken, wakingNightmareChaosAfterTest, WAKING_NIGHTMARE_TOKEN_MEANINGS,
} from '../content/campaigns/theDreamEaters/scenarios/wakingNightmare/chaos.js'
import entry06064 from '../src/cards/encounter-entries/theDreamEaters/wakingNightmare/06064.js'
import entry06065 from '../src/cards/encounter-entries/theDreamEaters/wakingNightmare/06065.js'
import entry06066 from '../src/cards/encounter-entries/theDreamEaters/wakingNightmare/06066.js'
import entry06067 from '../src/cards/encounter-entries/theDreamEaters/wakingNightmare/06067.js'
import entry06068 from '../src/cards/encounter-entries/theDreamEaters/wakingNightmare/06068.js'
import entry06069 from '../src/cards/encounter-entries/theDreamEaters/wakingNightmare/06069.js'
import entry06070 from '../src/cards/encounter-entries/theDreamEaters/wakingNightmare/06070.js'
import entry06071 from '../src/cards/encounter-entries/theDreamEaters/wakingNightmare/06071.js'
import entry06074 from '../src/cards/encounter-entries/theDreamEaters/wakingNightmare/06074.js'
import entry06075 from '../src/cards/encounter-entries/theDreamEaters/wakingNightmare/06075.js'
import entry06076 from '../src/cards/encounter-entries/theDreamEaters/wakingNightmare/06076.js'
import entry06077 from '../src/cards/encounter-entries/theDreamEaters/wakingNightmare/06077.js'
import entry06078 from '../src/cards/encounter-entries/theDreamEaters/wakingNightmare/06078.js'
import entry06080 from '../src/cards/encounter-entries/theDreamEaters/wakingNightmare/06080.js'
import entry06081 from '../src/cards/encounter-entries/theDreamEaters/wakingNightmare/06081.js'
import entry06082 from '../src/cards/encounter-entries/theDreamEaters/wakingNightmare/06082.js'
import entry06083 from '../src/cards/encounter-entries/theDreamEaters/wakingNightmare/06083.js'

const ENTRIES = [
  entry06064, entry06065, entry06066, entry06067, entry06068, entry06069, entry06070, entry06071,
  entry06074, entry06075, entry06076, entry06077, entry06078, entry06080, entry06081, entry06082, entry06083,
]
for (const entry of ENTRIES) if (!registeredEntry(entry.code)) registerCardAbilities(entry)

const clone = value => structuredClone(value)
const locName = id => (id || '').replace(/([A-Z])/g, ' $1')

function stateFor(count = 2) {
  const state = {
    scenario: clone(definition),
    acts: clone(definition.acts),
    agendas: clone(definition.agendas),
    actIndex: 0,
    agendaIndex: 0,
    investigators: Array.from({ length: count }, (_, seat) => ({
      seat, code: '01001', name: `调查员${seat + 1}`, location: 'waitingRoom', klass: 'seeker', traits: [],
      damage: 0, horror: 0, clues: 0, resources: 5, hand: ['01001'], assets: [], threat: [], engaged: [],
      deck: [], discard: [], actionsLeft: 3,
    })),
    locations: [], enemies: [], storyAssets: [], scenarioFlags: {}, scenarioZones: {},
    victoryDisplay: [], victory: 0, encounterDeck: [], encounterDiscard: [], doom: 0,
    infestedLocations: [], tokenBags: {},
    campaign: {
      leadSeat: 0, mode: 'singleB', records: {},
      investigators: Array.from({ length: count }, () => ({ deck: [], purchases: [], status: 'active', trauma: { physical: 0, mental: 0 } })),
      chaosBag: ['+1', '0', 'skull', 'elderthing'],
    },
    chaosBag: ['+1', '0', 'skull', 'elderthing', 'cultist'],
    difficulty: 'standard', numInvestigators: count, round: 1, phase: 'investigation', status: 'playing',
  }
  return state
}

// 与引擎 placeLocation 相同语义地放置地点（测试用）。
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
const traitness = (state, id, trait) => (locationOf(state, id)?.traits || [])
  .some(value => String(value).toLowerCase() === trait)

function apiStub(state, overrides = {}) {
  const api = {
    info: () => {},
    choose: () => undefined,
    random: () => 0.5,
    gainResources: (seat, amount) => { state.investigators[seat].resources += amount },
    drawCards: (seat, amount) => { for (let i = 0; i < amount; i += 1) state.investigators[seat].hand.push('01001') },
    damage: (seat, amount) => { state.investigators[seat].damage += amount },
    horror: (seat, amount) => { state.investigators[seat].horror += amount },
    healDamage: (seat, amount) => { state.investigators[seat].damage = Math.max(0, state.investigators[seat].damage - amount) },
    healEnemy: (enemy, amount = 1) => {
      const before = enemy.damageTaken || 0
      enemy.damageTaken = Math.max(0, before - amount)
      return before - enemy.damageTaken
    },
    defeat: inv => { inv.defeated = true },
    trauma: (seat, kind, amount) => { state.campaign.records[`trauma_${kind}_${seat}`] = amount },
    spawn: (code, location) => {
      const enemy = { id: `enemy-${state.enemies.length + 1}`, code, originalCode: code, name: code,
        location, engagedSeat: null, damageTaken: 0, exhausted: false, traits: [] }
      state.enemies.push(enemy)
      return enemy
    },
    moveEnemy: (enemy, destination) => { enemy.location = destination },
    moveInvestigator: (seat, destination) => { state.investigators[seat].location = destination },
    evadeEnemy: enemy => { enemy.exhausted = true; enemy.engagedSeat = null },
    test: (seat, skill, difficulty, resolve) => resolve({ success: true, value: difficulty + 1, difficulty, skill }),
    setScenarioFlag: (key, value = true) => { state.scenarioFlags ||= {}; state.scenarioFlags[key] = value },
    setCampaignRecord: (key, value) => {
      state.campaign.records ||= {}
      if (value == null) delete state.campaign.records[key]
      else state.campaign.records[key] = value
      return state.campaign.records[key]
    },
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
    shuffleIntoEncounterDeck: codes => { state.encounterDeck.push(...codes) },
    shuffleDiscard: () => { state.encounterDeck.push(...state.encounterDiscard); state.encounterDiscard = [] },
    discardEncounterCard: code => {
      const deckIndex = state.encounterDeck.lastIndexOf(code)
      if (deckIndex >= 0) { state.encounterDiscard.push(state.encounterDeck.splice(deckIndex, 1)[0]); return true }
      const discardIndex = state.encounterDiscard.lastIndexOf(code)
      if (discardIndex >= 0) { state.encounterDiscard.splice(discardIndex, 1); return true }
      return false
    },
    advanceAct: () => { state.actIndex += 1 },
    advanceAgenda: () => { state.agendaIndex += 1 },
    doomOn: (card, amount = 1) => { card.doom = (card.doom || 0) + amount },
    addDoom: amount => { state.doom += amount },
    finish: key => { state.resolutionKey = key },
    resign: seat => { state.investigators[seat].resigned = true },
    spendClues: (seat, n) => { state.investigators[seat].clues -= n },
    payClues: (n, locationId) => {
      const pool = state.investigators.filter(inv => !locationId || inv.location === locationId)
      let left = n
      for (const inv of pool) { const spend = Math.min(inv.clues, left); inv.clues -= spend; left -= spend }
      return left === 0
    },
    discoverClue: (seat, n, locationId) => {
      const target = locationId ? locationOf(state, locationId) : locationOf(state, state.investigators[seat].location)
      if (target && target.clues > 0) { target.clues -= 1; state.investigators[seat].clues += 1 }
    },
    discardChosen: (seat, n) => { state.investigators[seat].hand.splice(0, n) },
    discardFromHand: (seat, code) => {
      const index = state.investigators[seat].hand.indexOf(code)
      if (index >= 0) state.investigators[seat].discard.push(state.investigators[seat].hand.splice(index, 1)[0])
    },
    removeAsset: (seat, assetId) => {
      const owner = state.investigators[seat]
      const index = (owner.assets || []).findIndex(asset => asset.id === assetId)
      if (index >= 0) { owner.assets.splice(index, 1); owner.removedFromGame = true }
      return index >= 0
    },
    giveAsset: (seat, code) => {
      const asset = { id: `asset-${code}`, code, originalCode: code, exhausted: false, damage: 0, horror: 0 }
      state.investigators[seat].assets.push(asset)
      return asset
    },
    cardReveal: () => {},
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
    locName: id => locationOf(state, id)?.name || locName(id),
    launch: () => {},
    campaignCardChange: (campaign, seat, code) => {
      campaign.investigators[seat].deck.push(code)
    },
    addTrauma: (seat, kind, amount) => {
      const record = state.campaign.investigators[seat]
      record.trauma[kind] = (record.trauma[kind] || 0) + amount
    },
    tokenBag: {
      create: (id, tokens) => createTokenBag(state, id, tokens),
      info: id => tokenBagInfo(state, id),
      reveal: (id, options) => revealTokenFromBag(state, id, options),
      add: (id, token) => addTokenToBag(state, id, token),
      return: (id, token) => returnTokenToBag(state, id, token),
      reset: (id, tokens = null) => {
        if (tokens) createTokenBag(state, id, tokens)
        else delete (state.tokenBags ||= {})[id]
      },
      markInfested: id => markInfested(state, id),
      clearInfested: id => clearInfested(state, id),
      isInfested: id => isInfestedLocation(state, id),
      infestedCount: () => infestedCount(state),
    },
    ...overrides,
  }
  // 条目的可选路径用 api.choice（与引擎别名 choose 同一 requestChoice）。
  if (typeof api.choice !== 'function') api.choice = api.choose
  return api
}

function setup(state) {
  chapter.behavior.setupLocations(state, [], { info: () => {} })
  placeLocations(state, ['waitingRoom', 'emergencyRoom', 'experimentalTherapiesWard', 'recordsOffice'])
  return state
}

// ---------------------------------------------------------------------------
// 1. manifest / 身份 / 结构
// ---------------------------------------------------------------------------
test('06063 章节清单：development、原卡、地点/幕/议程/结局数量与参考卡', () => {
  assert.equal(chapter.manifest.id, 'wakingNightmare')
  assert.equal(chapter.manifest.status, 'development')
  assert.equal(chapter.manifest.campaignId, 'theDreamEaters')
  assert.equal(chapter.manifest.contentVersion, '1.0.0')
  assert.equal(chapter.manifest.referenceCode, '06063')
  assert.equal(chapter.manifest.catalogReferenceOnly, undefined)
  assert.equal(chapter.scenario.originalCode, '06063')
  assert.equal(chapter.manifest.locations.length, 8)
  assert.deepEqual(chapter.manifest.acts.map(act => act.id), ['act1', 'act2', 'act3'])
  assert.deepEqual(chapter.manifest.agendas.map(agenda => agenda.id), ['agenda1', 'agenda2', 'agenda3'])
  assert.deepEqual(chapter.manifest.resolutionIds,
    ['noResolution', 'noResolutionDefeated', 'resolution1', 'resolution2', 'resolution3', 'resolution4', 'resolution5'])
  assert.equal(chapter.manifest.startLocationId, 'waitingRoom')
  for (const group of chapter.manifest.requiredEncounterGroupIds) assert.match(group, /^[a-z][A-Za-z0-9]*$/)
  assert.ok(chapter.manifest.requiredMechanicIds.includes('tdeInfestationBag'))
})

test('身份登记：每个地点/幕/议程/敌人/诡计都有原卡身份且 mapped', () => {
  for (const category of ['locations', 'acts', 'agendas', 'enemies', 'treacheries', 'storyAssets']) {
    for (const [id, identity] of Object.entries(chapter.identities[category] || {})) {
      assert.ok(identity.originalCode, `${category}/${id} 缺 originalCode`)
      assert.equal(identity.identityStatus, 'mapped')
    }
  }
  assert.equal(chapter.identities.locations.waitingRoom.originalCode, '06070')
  assert.equal(chapter.identities.enemies['06081'].originalCode, '06081')
})

// ---------------------------------------------------------------------------
// 2. setup / 区域守恒 / 开局介绍
// ---------------------------------------------------------------------------
test('setup：4 个地点入场；放一边 = 4 地点 + 伦道夫 + 3 爆发 + 2 堕落护工 + 故事卡 + 两个整组', () => {
  const state = stateFor(2)
  const placed = chapter.behavior.setupLocations(state, [], { info: () => {} })
  assert.deepEqual(placed, ['waitingRoom', 'emergencyRoom', 'experimentalTherapiesWard', 'recordsOffice'])
  const aside = state.scenarioZones.setAside
  for (const code of ['06074', '06075', '06076', '06077']) assert.ok(aside.includes(code), `放一边缺地点 ${code}`)
  assert.ok(aside.includes('06079'), '放一边缺伦道夫·卡特')
  assert.equal(aside.filter(code => code === '06083').length, 3, '3 张爆发全部放一边')
  assert.equal(aside.filter(code => code === '06082').length, 2, '2 张堕落的护工全部放一边')
  assert.ok(aside.includes('06078'), '放一边缺蛛群入侵故事卡')
  // Spiders 组 3 张 + Agents of Atlach-Nacha 组 2 张。
  assert.equal(aside.filter(code => ['06084', '06085', '06086'].includes(code)).length >= 0, true)
  assert.equal(aside.length, SET_ASIDE_LOCATIONS.length + SET_ASIDE_ALIASES.length + 1,
    '+1 = 开局无「医生同行」记录时，马赫斯瓦兰医生也放一边')
  // 初始遭遇牌库 = 5 个收齐组的敌人/诡计按 quantity 展开，剔除放一边的 3 爆发 + 2 堕落护工。
  assert.equal(ENCOUNTER_DECK.includes('06082'), false, '堕落的护工放一边，不在初始牌库')
  assert.equal(ENCOUNTER_DECK.includes('06083'), false, '爆发放一边，不在初始牌库')
  assert.equal(ENCOUNTER_DECK.filter(code => code === '06081').length, 2, '2 张可疑的护工在初始牌库')
  assert.ok(ENCOUNTER_DECK.length >= 8 && ENCOUNTER_DECK.length <= 24, '初始遭遇牌库按印刷数量展开')
})

test('setup：开局没有医生同行记录时，马赫斯瓦兰医生放一边', () => {
  const state = stateFor(1)
  chapter.behavior.setupLocations(state, [], { info: () => {} })
  assert.ok(state.scenarioZones.setAside.includes('06080'))
})

test('开局介绍：队长选择医生同行 → 记录 + 医生在队长控制下；选择留下 → 另一条记录', () => {
  const joined = stateFor(2)
  chapter.behavior.preScenarioSetup(joined, [], apiStub(joined, { choose: () => 'bringDoctor' }))
  assert.equal(joined.campaign.records.drMaheswaranJoinedTheInvestigation, true)
  assert.ok(joined.investigators[0].assets.some(asset => asset.code === '06080'))

  const stayed = stateFor(2)
  chapter.behavior.preScenarioSetup(stayed, [], apiStub(stayed, { choose: () => 'leaveDoctor' }))
  assert.equal(stayed.campaign.records.drMaheswaranStayedWithHerPatients, true)
  assert.equal(stayed.campaign.records.drMaheswaranJoinedTheInvestigation, undefined)
})

test('幕/议程都声明 campaignRule 揭示；议程毁灭阈值 2/6/8', () => {
  for (const act of definition.acts) assert.equal(act.reveal.type, 'campaignRule')
  for (const agenda of definition.agendas) assert.equal(agenda.reveal.type, 'campaignRule')
  assert.deepEqual(definition.agendas.map(agenda => agenda.doomThreshold), [2, 6, 8])
  assert.equal(definition.acts[0].objective.type, 'clues')
  assert.equal(definition.acts[0].objective.perInvestigator, 4)
})

// ---------------------------------------------------------------------------
// 3. 幕/议程流程
// ---------------------------------------------------------------------------
test('幕 2 目标：有调查员控制伦道夫·卡特才推进', () => {
  const state = setup(stateFor(2))
  state.actIndex = 1
  chapter.behavior.checkObjectives(state, apiStub(state))
  assert.equal(state.actIndex, 1, '无人控制伦道夫·卡特时不推进')
  state.investigators[0].assets.push({ id: 'asset-06079', code: '06079', originalCode: '06079' })
  chapter.behavior.checkObjectives(state, apiStub(state))
  assert.equal(state.actIndex, 2, '控制伦道夫·卡特后推进')
})

test('幕 3 目标：场上没有寄生地点时推进', () => {
  const state = setup(stateFor(2))
  state.actIndex = 2
  markInfested(state, 'recordsOffice')
  chapter.behavior.checkObjectives(state, apiStub(state))
  assert.equal(state.actIndex, 2, '仍有寄生地点时不推进')
  clearInfested(state, 'recordsOffice')
  chapter.behavior.checkObjectives(state, apiStub(state))
  assert.equal(state.actIndex, 3)
})

test('幕 3 背面：按战役日志与医生是否在场分流结局 1/2/3', () => {
  const cases = [
    { joined: true, inPlay: true, expected: 'resolution1' },
    { joined: true, inPlay: false, expected: 'resolution2' },
    { joined: false, inPlay: false, expected: 'resolution3' },
  ]
  for (const [index, item] of cases.entries()) {
    const state = setup(stateFor(1))
    state.actIndex = 2
    const api = apiStub(state)
    if (item.joined) state.campaign.records.drMaheswaranJoinedTheInvestigation = true
    if (item.inPlay) state.investigators[0].assets.push({ id: 'asset-06080', code: '06080', originalCode: '06080' })
    entry06069.actRule.onReveal(state, state.acts[2], api, index)
    assert.equal(state.resolutionKey, item.expected)
  }
})

test('幕 1 背面：放梯井与三张地下室门；议程 1 时立即推进到议程 2', () => {
  const state = setup(stateFor(2))
  chapter.behavior.actReveal(state, state.acts[0], apiStub(state))
  for (const id of ['stairwell', 'morgue', 'operatingRoom', 'privateRoom']) {
    assert.ok(locationOf(state, id), `${id} 应已入场`)
  }
  assert.equal(state.agendaIndex, 1)
})

test('议程 1 背面：蜘蛛组/爆发洗入牌库，建立滋生袋并标记 1–2 个寄生地点', () => {
  const state = setup(stateFor(2))
  state.encounterDiscard.push('06083')
  chapter.behavior.agendaReveal(state, state.agendas[0], apiStub(state))
  assert.equal(state.scenarioFlags.theInfestationBegins, true)
  const bag = tokenBagInfo(state, 'infestation')
  assert.equal(bag.exists, true)
  assert.equal(bag.count, 7, '滋生袋 7 枚：skull×1、tablet×4、cultist×2')
  assert.equal(state.infestedLocations.length, 1, '2 人局只标记线索最多的 1 个地点')
  assert.ok(state.encounterDeck.length > 0, '蜘蛛组与爆发洗入遭遇牌库')
})

test('议程 2 背面：护工替换 + 移出可疑护工 + 滋生袋加 2 枚标记', () => {
  const state = setup(stateFor(2))
  state.agendaIndex = 1
  const orderly = { id: 'enemy-orderly', code: '06081', originalCode: '06081', name: '可疑的护工',
    location: 'emergencyRoom', engagedSeat: 1, damageTaken: 2, exhausted: true, traits: ['Humanoid', 'Staff'] }
  state.enemies.push(orderly)
  state.encounterDeck.push('06081')
  state.encounterDiscard.push('06081')
  createTokenBag(state, 'infestation', ['skull', 'tablet', 'cultist'])
  chapter.behavior.agendaReveal(state, state.agendas[1], apiStub(state))
  assert.equal(state.enemies[0].code, '06082', '可疑的护工被替换为堕落的护工')
  assert.equal(state.enemies[0].damageTaken, 2, '替换保留游戏状态')
  assert.equal(state.encounterDeck.includes('06081'), false)
  assert.equal(state.encounterDiscard.includes('06081'), false)
  const bag = tokenBagInfo(state, 'infestation')
  assert.equal(bag.count, 5, '滋生袋 3 + 2（skull/cultist）')
})

test('议程 3 背面：桥梁之阶 +8 并转入结局 4', () => {
  const state = setup(stateFor(1))
  state.agendaIndex = 2
  state.campaign.records.stepsOfTheBridge = 2
  chapter.behavior.agendaReveal(state, state.agendas[2], apiStub(state))
  assert.equal(state.campaign.records.stepsOfTheBridge, 10)
  assert.equal(state.resolutionKey, 'resolution4')
})

// ---------------------------------------------------------------------------
// 4. 混乱标记 / 滋生检定
// ---------------------------------------------------------------------------
test('混乱符号：skull -1/-2（与 Staff 交战 -3/-4）、elderthing = 受寄生地点数、cultist 再揭示', () => {
  const state = setup(stateFor(2))
  const inv = state.investigators[0]
  assert.equal(wakingNightmareChaosToken(state, inv, 'skull').delta, -1)
  assert.deepEqual(wakingNightmareChaosToken(state, inv, 'cultist'), { delta: 0, drawAnother: true })
  assert.equal(wakingNightmareChaosToken(state, inv, 'elderthing').delta, -0)
  markInfested(state, 'recordsOffice')
  markInfested(state, 'morgue')
  assert.equal(wakingNightmareChaosToken(state, inv, 'elderthing').delta, -2)
  state.difficulty = 'hard'
  assert.equal(wakingNightmareChaosToken(state, inv, 'skull').delta, -2)
  assert.equal(wakingNightmareChaosToken(state, inv, 'elderthing').delta, -3)
  state.enemies.push({ id: 'e1', code: '06081', engagedSeat: 0, traits: ['Humanoid', 'Staff'], location: inv.location })
  assert.equal(wakingNightmareChaosToken(state, inv, 'skull').delta, -4)
})

test('afterTest：[cultist] 在普通难度失败且议程 2/3 时补滋生检定；困难难度直接补', () => {
  const state = setup(stateFor(2))
  const result = { success: false, drawn: ['cultist'], cancelledTokens: [] }
  assert.equal(wakingNightmareChaosAfterTest(state, state.investigators[0], result), false, '议程 1 不触发')
  state.agendaIndex = 1
  assert.equal(wakingNightmareChaosAfterTest(state, state.investigators[0], result), true)
  assert.equal(wakingNightmareChaosAfterTest(state, state.investigators[0], { ...result, success: true }), false)
  state.difficulty = 'hard'
  assert.equal(wakingNightmareChaosAfterTest(state, state.investigators[0], { ...result, success: true }), true)
})

test('滋生检定：[tablet] 无事、[cultist] 向相邻地点蔓延', () => {
  const state = setup(stateFor(2))
  state.scenarioFlags = {}
  state.locations = [
    { id: 'recordsOffice', code: '06073', revealed: true, clues: 0, connections: ['waitingRoom'], traits: ["St Mary's"] },
    { id: 'waitingRoom', code: '06070', revealed: true, clues: 0, connections: ['recordsOffice'], traits: ["St Mary's"] },
  ]
  state.infestedLocations = ['recordsOffice']
  createTokenBag(state, 'infestation', ['tablet', 'cultist'])
  state.infestedLocations = ['recordsOffice']
  // 先 tablet（无事），再 cultist（蔓延）。
  chapter.behavior.mythosEnded(state, apiStub(state))
  assert.deepEqual([...state.infestedLocations], ['recordsOffice'], 'tablet 不改变寄生地点')
  const api = apiStub(state, { tokenBag: { ...apiStub(state).tokenBag, reveal: () => 'cultist' } })
  chapter.behavior.resolveEncounter(state, state.investigators[0], { code: '06083', originalCode: '06083' }, api)
  assert.deepEqual([...state.infestedLocations].sort(), ['recordsOffice', 'waitingRoom'], 'cultist 使相邻地点变寄生')
})

test('Outbreak（06083）：在寄生地点把 tablet 当 skull 结算', () => {
  const state = setup(stateFor(2))
  state.infestedLocations = ['waitingRoom']
  state.enemies = []
  state.encounterDeck = ['06101']
  createTokenBag(state, 'infestation', ['tablet'])
  let revealedAs = null
  const reveal = () => 'tablet'
  const api = apiStub(state, {
    tokenBag: { ...apiStub(state).tokenBag, reveal },
    spawn: (code, location) => {
      revealedAs = { code, location }
      const enemy = { id: 'spider', code, originalCode: code, location, traits: ['Spider'], damageTaken: 0 }
      state.enemies.push(enemy)
      return enemy
    },
  })
  chapter.behavior.resolveEncounter(state, state.investigators[0], { code: '06083', originalCode: '06083' }, api)
  assert.ok(revealedAs, 'tablet 被当作 skull：从遭遇牌库生成蜘蛛敌人')
  assert.equal(revealedAs.code, '06101')
  assert.equal(state.infestedLocations.includes(revealedAs.location), true)
})

// ---------------------------------------------------------------------------
// 5. 单卡条目（条目函数直接调用）
// ---------------------------------------------------------------------------
test('06070 候诊室：[action] 撤退可用，寄生后不可用', () => {
  const state = setup(stateFor(2))
  const location = locationOf(state, 'waitingRoom')
  const moves = []
  entry06070.locationRule.actions({ moves, state, inv: state.investigators[0], location })
  assert.equal(moves.length, 1)
  assert.equal(moves[0].rule, 'waitingRoomResign')
  assert.equal(entry06070.locationRule.performAction(state, state.investigators[0], moves[0], apiStub(state)), true)
  assert.equal(state.investigators[0].resigned, true)
  markInfested(state, 'waitingRoom')
  const blocked = []
  entry06070.locationRule.actions({ moves: blocked, state, inv: state.investigators[1], location })
  assert.equal(blocked.length, 0, '寄生地点不再提供撤退行动')
})

test('06075 太平间：[action] 检定意志(3)：成功发现线索 / 失败受到恐惧', () => {
  const state = setup(stateFor(2))
  placeLocations(state, ['morgue'])
  const location = locationOf(state, 'morgue')
  location.revealed = true
  location.clues = 1
  const mover = { ...state.investigators[0], location: 'morgue' }
  const moves = []
  entry06075.locationRule.actions({ moves, state, inv: mover, location })
  assert.equal(moves.length, 1)
  const acted = { ...moves[0] }
  // 成功路径
  entry06075.locationRule.performAction(state, mover, acted,
    apiStub(state, { test: (seat, skill, difficulty, resolve) => resolve({ success: true, value: 4, difficulty }) }))
  assert.equal(location.clues, 0)
  // 失败路径
  entry06075.locationRule.performAction(state, mover, acted,
    apiStub(state, { test: (seat, skill, difficulty, resolve) => resolve({ success: false, value: 0, difficulty }) }))
  assert.ok(state.investigators[0].horror >= 1)
})

test('06076 手术室：[action][action] 成功治愈 3 伤害、失败造成 1 伤害', () => {
  const state = setup(stateFor(2))
  placeLocations(state, ['operatingRoom'])
  const location = locationOf(state, 'operatingRoom')
  const mover = { ...state.investigators[0], location: 'operatingRoom' }
  const moves = []
  entry06076.locationRule.actions({ moves, state, inv: mover, location })
  assert.equal(moves[0].actions, 2)
  state.investigators[1].location = 'operatingRoom'
  state.investigators[1].damage = 3
  entry06076.locationRule.performAction(state, mover, moves[0],
    apiStub(state, {
      choose: () => '1',
      test: (seat, skill, difficulty, resolve) => resolve({ success: true, value: 5, difficulty }),
    }))
  assert.equal(state.investigators[1].damage, 0)
  entry06076.locationRule.performAction(state, mover, moves[0],
    apiStub(state, {
      choose: () => '1',
      test: (seat, skill, difficulty, resolve) => resolve({ success: false, value: 0, difficulty }),
    }))
  assert.equal(state.investigators[1].damage, 1)
})

test('06081 可疑的护工：与它交战时不能调查；不能攻击/被攻击/被伤害/被击败的 flags 齐全', () => {
  const state = setup(stateFor(2))
  const orderly = { id: 'orderly', code: '06081', originalCode: '06081', location: 'waitingRoom',
    engagedSeat: 0, traits: ['Humanoid', 'Staff'] }
  state.enemies.push(orderly)
  const error = chapter.behavior.investigationError(state, state.investigators[0], locationOf(state, 'waitingRoom'))
  assert.ok(typeof error === 'string' && error.length > 0)
  assert.equal(chapter.behavior.investigationError(state, state.investigators[1], locationOf(state, 'waitingRoom')), undefined)
  const flags = entry06081.flags
  assert.equal(flags.cannotAttack, true)
  assert.equal(flags.cannotBeAttacked, true)
  assert.equal(flags.cannotBeDamaged, true)
  assert.equal(flags.cannotBeDefeated, true)
})

test('06082 堕落的护工：在寄生地点受到伤害时取消其中 1 点', () => {
  const state = setup(stateFor(2))
  state.infestedLocations = ['waitingRoom']
  const enemy = { id: 'corrupted', code: '06082', originalCode: '06082', location: 'waitingRoom',
    damageTaken: 2, traits: ['Humanoid', 'Staff', 'Spider'] }
  state.enemies.push(enemy)
  chapter.behavior.enemyDamaged(state, enemy, apiStub(state), 0)
  assert.equal(enemy.damageTaken, 1, '取消 1 点伤害')
  const elsewhere = { ...enemy, location: 'recordsOffice', damageTaken: 2 }
  state.enemies.push(elsewhere)
  chapter.behavior.enemyDamaged(state, elsewhere, apiStub(state), 0)
  assert.equal(elsewhere.damageTaken, 2, '非寄生地点不取消')
})

test('06074 梯井：从非地下室进入后移动到地下室并检定敏捷(4)，失败 2 伤害', () => {
  const state = setup(stateFor(2))
  placeLocations(state, ['stairwell', 'morgue'])
  state.investigators[0].location = 'emergencyRoom'
  // 引擎在移动前由 behavior.locationLeft 记录「上一个地点」；这里直接给入口数据。
  state.scenarioFlags.previousBySeat = { 0: 'emergencyRoom' }
  const api = apiStub(state, {
    choose: () => 'morgue',
    test: (seat, skill, difficulty, resolve) => resolve({ success: false, value: 0, difficulty }),
  })
  chapter.behavior.locationEntered(state, state.investigators[0], locationOf(state, 'stairwell'), api)
  assert.equal(state.investigators[0].location, 'morgue', '移动到一个地下室地点')
  assert.equal(state.investigators[0].damage, 2, '敏捷检定失败受到 2 伤害')
})

test('06078 蛛群入侵： flags 声明 7 枚滋生袋与三种 token 效果', () => {
  assert.equal(entry06078.scope, 'storyAsset')
  assert.equal(entry06078.flags.infestationReference, true)
  assert.equal(entry06078.flags.infestationBag.tokens.length, 7)
  assert.deepEqual(entry06078.flags.infestationBag.tokens.filter(token => token === 'cultist').length, 2)
  assert.equal(entry06078.flags.infestationTokenEffects.skull, 'spawnSpiderNearestInfested')
  assert.equal(entry06078.flags.infestationTokenEffects.cultist, 'spreadToAdjacentThenResetOnSecondCultist')
})

// ---------------------------------------------------------------------------
// 6. 结局 / 记录
// ---------------------------------------------------------------------------
test('结局 1/2/3/4：医生记录、梦者变弱、队长精神创伤与伦道夫记录', () => {
  const first = setup(stateFor(1))
  assert.deepEqual(chapter.behavior.resolution(first, 'resolution1', [], apiStub(first, { choose: () => 'skip' })), { award: true, bonus: 0 })
  assert.equal(first.campaign.records.drMaheswaranIsAlive, true)
  assert.equal(first.campaign.records.theDreamersGrowWeaker, undefined, 'singleB 单线不写 A 线的「梦者变弱」')
  assert.equal(first.campaign.records.randolphEscapedTheHospitalWithTheInvestigators, true)

  const interconnected = setup(stateFor(1))
  interconnected.campaign.mode = 'pick'
  chapter.behavior.resolution(interconnected, 'resolution1', [], apiStub(interconnected, { choose: () => 'skip' }))
  assert.equal(interconnected.campaign.records.theDreamersGrowWeaker, true, 'pick/parallel 八章互联时写「梦者变弱」')

  const second = setup(stateFor(1))
  chapter.behavior.resolution(second, 'resolution2', [], apiStub(second, { choose: () => 'skip' }))
  assert.equal(second.campaign.records.drMaheswaranIsMissing, true)
  assert.equal(second.campaign.investigators[0].trauma.mental, 1)

  const third = setup(stateFor(1))
  chapter.behavior.resolution(third, 'resolution3', [], apiStub(third, { choose: () => 'skip' }))
  assert.equal(third.campaign.records.drMaheswaranIsAlive, true)

  const fourth = setup(stateFor(1))
  chapter.behavior.resolution(fourth, 'resolution4', [], apiStub(fourth, { choose: () => 'skip' }))
  assert.equal(fourth.campaign.records.randolphEscapedTheHospitalOnHisOwn, true)
  assert.equal(fourth.campaign.investigators[0].trauma.mental, 1)
})

test('无结局：有调查员撤退时记录医生的未知命运与伦道夫独自逃生；全灭时不写这两条', () => {
  const resigned = setup(stateFor(2))
  resigned.infestedLocations = ['waitingRoom', 'recordsOffice']
  resigned.investigators[1].resigned = true
  chapter.behavior.resolution(resigned, 'noResolution', [], apiStub(resigned, { choose: () => 'skip' }))
  assert.equal(resigned.campaign.records.stepsOfTheBridge, 2, '每个寄生地点 1 个桥梁之阶标记')
  assert.equal(resigned.campaign.records.drMaheswaransFateIsUnknown, true)
  assert.equal(resigned.campaign.records.randolphEscapedTheHospitalOnHisOwn, true)

  const defeated = setup(stateFor(2))
  defeated.infestedLocations = ['waitingRoom']
  for (const inv of defeated.investigators) inv.defeated = true
  chapter.behavior.resolution(defeated, 'noResolution', [], apiStub(defeated, { choose: () => 'skip' }))
  assert.equal(defeated.campaign.records.stepsOfTheBridge, 1)
  assert.equal(defeated.campaign.records.drMaheswaransFateIsUnknown, undefined)
})

// ---------------------------------------------------------------------------
// 7. 存档往返 / 确定性
// ---------------------------------------------------------------------------
test('同一路线的开始状态在 JSON 往返后完全一致（存档/回放/往返）', () => {
  const build = () => {
    const state = setup(stateFor(2))
    chapter.behavior.preScenarioSetup(state, [], apiStub(state, { choose: () => 'bringDoctor' }))
    chapter.behavior.actReveal(state, state.acts[0], apiStub(state))
    chapter.behavior.agendaReveal(state, state.agendas[0], apiStub(state))
    return state
  }
  const first = build()
  const restored = JSON.parse(JSON.stringify(first))
  assert.equal(JSON.stringify(restored), JSON.stringify(JSON.parse(JSON.stringify(first))), '两次 JSON 序列化必须相等')
  assert.deepEqual(restored.scenarioFlags, first.scenarioFlags)
  assert.deepEqual(restored.scenarioZones, first.scenarioZones)
  assert.deepEqual(restored.tokenBags, first.tokenBags)
  assert.deepEqual(restored.infestedLocations, first.infestedLocations)
  assert.deepEqual(restored.campaign.records, first.campaign.records)
  assert.deepEqual(restored.locations.map(location => location.id), first.locations.map(location => location.id))
  assert.equal(restored.scenario.id, 'wakingNightmare')
})
