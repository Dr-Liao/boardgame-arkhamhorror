// P7 theHeartOfMadnessPart1 · 疯狂之心 I 章节验收（真实引擎状态 + 章节行为 + 单卡条目）。
//
// 覆盖：setup 随机布置/放一边/随机槽位、地点揭示放休眠封印、取得封印控制权（条目 actions +
// behavior 机械）、封印放置到门、幕推进、结局记录与经验、混乱标记取值/后果、JSON 存档往返、
// story-text 正文断言（setup / resolutions / sectionCount）。
import test from 'node:test'
import assert from 'node:assert/strict'
import '../src/engine/engine.js'
import { registerCardAbilities, registeredEntry } from '../src/engine/ability.js'
import { registerCampaignScenarios, scenarioRuntime } from '../src/engine/engine.js'
import { registerContentBundle, contentRegistry } from '../content/registered.js'
import { manifest as campaign } from '../content/campaigns/edgeOfTheEarth/manifest.js'
import { fixture } from './core-fixture.mjs'
import { activateSeal, placeSeal, sealsOf, sealsAt } from '../src/campaign/eote-seals.js'
import * as chapter from '../content/campaigns/edgeOfTheEarth/scenarios/theHeartOfMadnessPart1/index.js'
import { FACILITY_SLOT_CODES, SEAL_LOCATION_CODES } from '../content/campaigns/edgeOfTheEarth/scenarios/theHeartOfMadnessPart1/definition.js'
import { heartOfMadnessChaosToken, heartOfMadnessChaosAfterTest } from '../content/campaigns/edgeOfTheEarth/scenarios/theHeartOfMadnessPart1/chaos.js'
import { chapterStory, storyText, storyParagraphsOf, resolutionText } from '../content/campaigns/edgeOfTheEarth/story-access.js'
import entry08659 from '../src/cards/encounter-entries/edgeOfTheEarth/theHeartOfMadnessPart1/08659.js'
import entry08660 from '../src/cards/encounter-entries/edgeOfTheEarth/theHeartOfMadnessPart1/08660.js'
import entry08661 from '../src/cards/encounter-entries/edgeOfTheEarth/theHeartOfMadnessPart1/08661.js'
import entry08662 from '../src/cards/encounter-entries/edgeOfTheEarth/theHeartOfMadnessPart1/08662.js'
import entry08663 from '../src/cards/encounter-entries/edgeOfTheEarth/theHeartOfMadnessPart1/08663.js'
import entry08664 from '../src/cards/encounter-entries/edgeOfTheEarth/theHeartOfMadnessPart1/08664.js'
import entry08665 from '../src/cards/encounter-entries/edgeOfTheEarth/theHeartOfMadnessPart1/08665.js'
import entry08666 from '../src/cards/encounter-entries/edgeOfTheEarth/theHeartOfMadnessPart1/08666.js'
import entry08667 from '../src/cards/encounter-entries/edgeOfTheEarth/theHeartOfMadnessPart1/08667.js'
import entry08668 from '../src/cards/encounter-entries/edgeOfTheEarth/theHeartOfMadnessPart1/08668.js'
import entry08669 from '../src/cards/encounter-entries/edgeOfTheEarth/theHeartOfMadnessPart1/08669.js'
import entry08670 from '../src/cards/encounter-entries/edgeOfTheEarth/theHeartOfMadnessPart1/08670.js'

const ENTRIES = [entry08659, entry08660, entry08661, entry08662, entry08663, entry08664, entry08665,
  entry08666, entry08667, entry08668, entry08669, entry08670]
for (const entry of ENTRIES) if (!registeredEntry(entry.code)) registerCardAbilities(entry)

// P7 章节状态 development：生产组合根不装本章；测试进程内用内容 API 注册（不写共享文件）。
const testCampaign = {
  ...campaign,
  status: 'playable',
  scenarioIds: [chapter.manifest.id],
  unlock: { [chapter.manifest.id]: [] },
  recordSchema: {
    sealsPlaced: 'string[]',
    sealsRecovered: 'string[]',
    theSealWasUsedImproperly: 'boolean',
  },
}
if (!contentRegistry.getCampaign('edgeOfTheEarth')) registerContentBundle({ campaigns: [testCampaign], scenarios: [chapter] })
registerCampaignScenarios('edgeOfTheEarth')

const json = value => JSON.parse(JSON.stringify(value))
const codeOf = card => card?.originalCode || card?.code

function buildState(count = 2) {
  const state = fixture('01001', count)
  state.campaign.id = 'edgeOfTheEarth'
  state.campaign.records = {}
  state.campaign.eote = {}
  state.scenario = json(chapter.scenario)
  state.acts = json(state.scenario.acts)
  state.agendas = json(state.scenario.agendas)
  state.actIndex = 0
  state.agendaIndex = 0
  state.scenarioFlags = {}
  state.scenarioZones = {}
  state.locations = []
  state.enemies = []
  state.storyAssets = []
  state.victoryDisplay = []
  state.tokenBags = {}
  state.infestedLocations = []
  state.encounterDeck = [...state.scenario.encounterDeck]
  state.difficulty = 'standard'
  state.numInvestigators = count
  state.status = 'playing'
  state.phase = 'investigation'
  for (const inv of state.investigators) inv.location = 'theGateOfYquaa'
  return state
}

function setup(state) {
  const events = []
  const api = scenarioRuntime(state, events)
  chapter.behavior.preScenarioSetup(state, events, api)
  const ids = chapter.behavior.setupLocations(state, events, { info: () => {} })
  for (const id of ids) api.place(id)
  return api
}

const locationOf = (state, id) => state.locations.find(location => location.id === id)

/** 用真实条目 actions + behavior 机械取得某地点封印控制权（团队线索）。 */
function takeSealControl(state, api, locationCode, kind) {
  const slot = state.locations.find(location => location.originalCode === locationCode)
  if (!slot.revealed) api.reveal(slot.id)
  const inv = state.investigators[0]
  inv.location = slot.id
  inv.clues = 12
  const moves = chapter.behavior.actions(state, inv)
  const move = moves.find(item => item.rule === `heartOfMadnessSeal:${kind}`)
  assert.ok(move, `${locationCode} 提供取得 ${kind} 封印的行动`)
  const stub = {
    ...api,
    test: (seat, skill, difficulty, resolve) => resolve(),
    payGroupClues: (amount, { atLocation }) => {
      const payers = state.investigators.filter(who => who.location === atLocation)
      const total = payers.reduce((sum, who) => sum + (who.clues || 0), 0)
      if (total < amount) return false
      let remaining = amount
      for (const who of payers) {
        const paid = Math.min(remaining, who.clues || 0)
        who.clues -= paid
        remaining -= paid
      }
      return true
    },
  }
  assert.equal(chapter.behavior.performAction(state, inv, move, stub), true)
  return inv
}

test('P7 theHeartOfMadnessPart1 setup：十六个地点、随机槽位、封印放在一边', () => {
  const state = buildState()
  setup(state)
  assert.equal(state.locations.length, 16)
  assert.equal(locationOf(state, 'theGateOfYquaa').revealed, true, '伊夸之门已揭示')
  assert.deepEqual([...state.locations.filter(location => /^facility/.test(location.id)).map(location => location.originalCode)].sort(),
    [...FACILITY_SLOT_CODES].sort(), '十五座设施卡面各一张（含重印份数）')
  assert.equal(sealsOf(state).length, 5, '五枚封印已初始化')
  assert.ok(sealsOf(state).every(entry => entry.active === false && entry.locationId == null),
    '五枚封印初始休眠、无控制者、未放置')
  assert.equal(state.encounterDeck.length, state.scenario.encounterDeck.length)
})

test('P7 theHeartOfMadnessPart1 地点揭示：Great Seal 地点放上对应休眠封印', () => {
  const state = buildState()
  const api = setup(state)
  const sealSlots = state.locations.filter(location => Object.values(SEAL_LOCATION_CODES).includes(location.originalCode))
  assert.equal(sealSlots.length, 5)
  for (const location of sealSlots) api.reveal(location.id)
  for (const location of sealSlots) {
    const kind = Object.keys(SEAL_LOCATION_CODES).find(key => SEAL_LOCATION_CODES[key] === location.originalCode)
    const atLocation = sealsAt(state, location.id)
    assert.equal(atLocation.length, 1, `${location.id} 有一枚封印`)
    assert.equal(atLocation[0].kind, kind)
    assert.equal(atLocation[0].active, false, '休眠')
  }
})

test('P7 theHeartOfMadnessPart1 取得封印：条目 actions + behavior 机械 + 团队线索', () => {
  const state = buildState()
  const api = setup(state)
  const slot = state.locations.find(location => location.originalCode === '08664')
  api.reveal(slot.id)
  const inv = state.investigators[0]
  inv.location = slot.id
  inv.clues = 6
  const moves = chapter.behavior.actions(state, inv)
  const move = moves.find(item => item.rule === 'heartOfMadnessSeal:A')
  assert.ok(move, '冰川石窟提供取得 seal_a 的行动')
  const stub = {
    ...api,
    test: (seat, skill, difficulty, resolve) => resolve(),
    payGroupClues: (amount, { atLocation }) => {
      const payers = state.investigators.filter(who => who.location === atLocation)
      const total = payers.reduce((sum, who) => sum + (who.clues || 0), 0)
      if (total < amount) return false
      let remaining = amount
      for (const who of payers) {
        const paid = Math.min(remaining, who.clues || 0)
        who.clues -= paid
        remaining -= paid
      }
      return true
    },
  }
  assert.equal(chapter.behavior.performAction(state, inv, move, stub), true)
  const seal = sealsOf(state).find(entry => entry.kind === 'A')
  assert.equal(seal.placedBySeat, inv.seat, '封印 A 由调查员控制')
  assert.equal(seal.locationId, null, '取得控制权后离开地点')
  assert.ok(inv.clues < 6, '团队支付了线索')
})

test('P7 theHeartOfMadnessPart1 幕推进：激活封印放上伊夸之门 → 幕 1 推进', () => {
  const state = buildState()
  const api = setup(state)
  assert.equal(codeOf(state.acts[state.actIndex]), '08662')
  assert.equal(activateSeal(state, 'A'), false, '未控制的封印不能直接激活')
  const inv = takeSealControl(state, api, '08664', 'A')
  assert.equal(activateSeal(state, 'A'), true, '控制者可激活休眠封印')
  assert.equal(placeSeal(state, 'A', { seat: inv.seat, locationId: 'theGateOfYquaa' }), true)
  let advanced = false
  try {
    chapter.behavior.checkObjectives(state, api)
    advanced = state.actIndex === 1
  } catch (error) {
    if (error.constructor?.name !== 'ScenarioEnded') throw error
  }
  assert.ok(advanced || state.actIndex === 1, '目标达成后推进到幕 2')
  assert.equal(codeOf(state.acts[state.actIndex]), '08663')
})

test('P7 theHeartOfMadnessPart1 结局：记录放上门/取回的封印与经验，JSON 往返保持', () => {
  const state = buildState()
  const api = setup(state)
  const inv = takeSealControl(state, api, '08664', 'A')
  takeSealControl(state, api, '08665', 'B')
  activateSeal(state, 'A')
  activateSeal(state, 'B')
  placeSeal(state, 'A', { seat: inv.seat, locationId: 'theGateOfYquaa' })
  placeSeal(state, 'B', { seat: inv.seat, locationId: 'theGateOfYquaa' })
  const result = chapter.behavior.resolution(state, 'resolution1', [], api)
  assert.equal(result.award, true)
  assert.equal(result.bonus, 2, '两枚激活封印 = 2 经验')
  assert.deepEqual([...state.campaign.records.sealsPlaced].sort(), ['A', 'B'])
  const clone = json(state)
  assert.equal(clone.scenario.id, 'theHeartOfMadnessPart1')
  assert.equal(clone.campaign.records.sealsPlaced.length, 2)
  assert.equal(sealsOf(clone).filter(entry => entry.locationId === 'theGateOfYquaa').length, 2,
    'JSON 往返后封印放置仍在')
})

test('P7 theHeartOfMadnessPart1 混乱标记：骷髅动态值 / 石板抽牌 / 旧日支配者放毁灭', () => {
  const state = buildState()
  setup(state)
  const inv = state.investigators[0]
  assert.deepEqual(heartOfMadnessChaosToken(state, inv, 'skull'), { delta: -1 })
  state.enemies.push({ name: 'Ancient One', location: inv.location, traits: ['Ancient One'] })
  assert.deepEqual(heartOfMadnessChaosToken(state, inv, 'skull'), { delta: -3 })
  assert.deepEqual(heartOfMadnessChaosAfterTest(state, inv, { drawn: ['tablet'], success: false, failedBy: 1 }),
    [{ type: 'drawTekeli' }])
  assert.deepEqual(heartOfMadnessChaosAfterTest(state, inv, { drawn: ['elderthing'], success: false, failedBy: 3 }),
    [{ type: 'addDoom', amount: 1 }])
  assert.deepEqual(heartOfMadnessChaosAfterTest(state, inv, { drawn: ['elderthing'], success: true, failedBy: 0 }), [])
})

test('P7 theHeartOfMadnessPart1 story：正文结构可读且不写死', () => {
  const story = chapterStory('theHeartOfMadnessPart1')
  assert.equal(story.sectionCount, 79)
  assert.ok(story.intro.length > 100)
  assert.match(storyText('theHeartOfMadnessPart1', 'setup'), /收集以下遭遇组/)
  assert.ok(storyParagraphsOf('theHeartOfMadnessPart1', 'setup').length >= 1)
  assert.deepEqual(Object.keys(chapter.scenario.resolutions).sort(),
    ['noResolution', 'resolution1', 'resolution2', 'resolution3'])
  assert.match(chapter.scenario.resolutions.resolution1, /结局 1/)
  assert.match(resolutionText('theHeartOfMadnessPart1', 'resolution1'), /结局 1/)
  assert.match(storyText('theHeartOfMadnessPart1', 'resolutions.resolution2'), /结局 2/)
  assert.ok(storyText('theHeartOfMadnessPart1', 'resolutions.resolution2').length > 0)
  for (const code of ENTRIES.map(entry => entry.code)) {
    assert.ok(chapter.implementedEncounterCodes.includes(code), `${code} 在 implementedEncounterCodes`)
    assert.equal(registeredEntry(code).implemented, true)
  }
})
