// P7 theHeartOfMadnessPart2 · 疯狂之心 II 章节验收（真实引擎状态 + 章节行为 + 单卡条目）。
//
// 覆盖：setup 随机布置（10 设施 + 5 迷雾高塔，内环不得全高塔）、伊夸之门翻面、高塔可被攻击/坍塌
// （P2-D eote-facilities 原语）、幕 3 推进、坡道场景（幕 3/议程 5 背面）、议程背面生成无名的疯狂、
// 结局分流与记录、JSON 存档往返、story-text 正文断言。
import test from 'node:test'
import assert from 'node:assert/strict'
import '../src/engine/engine.js'
import { registerCardAbilities, registeredEntry } from '../src/engine/ability.js'
import { applyMove, checkAgenda, registerCampaignScenarios, scenarioRuntime, validateMove } from '../src/engine/engine.js'
import { registerContentBundle, contentRegistry } from '../content/registered.js'
import { manifest as campaign } from '../content/campaigns/edgeOfTheEarth/manifest.js'
import { fixture, settle } from './core-fixture.mjs'
import { sealsOf } from '../src/campaign/eote-seals.js'
import { collapsedTowers, damageTower, towerHealth, towerState } from '../src/engine/eote-facilities.js'
import * as chapter from '../content/campaigns/edgeOfTheEarth/scenarios/theHeartOfMadnessPart2/index.js'
import { INNER_RING_SLOTS, PYLON_SLOT_CODES, RAW_CODES } from '../content/campaigns/edgeOfTheEarth/scenarios/theHeartOfMadnessPart2/definition.js'
import { heartOfMadnessChaosToken } from '../content/campaigns/edgeOfTheEarth/scenarios/theHeartOfMadnessPart2/chaos.js'
import { chapterStory, storyText, resolutionText } from '../content/campaigns/edgeOfTheEarth/story-access.js'
import entry08671 from '../src/cards/encounter-entries/edgeOfTheEarth/theHeartOfMadnessPart2/08671.js'
import entry08672 from '../src/cards/encounter-entries/edgeOfTheEarth/theHeartOfMadnessPart2/08672.js'
import entry08673 from '../src/cards/encounter-entries/edgeOfTheEarth/theHeartOfMadnessPart2/08673.js'
import entry08674 from '../src/cards/encounter-entries/edgeOfTheEarth/theHeartOfMadnessPart2/08674.js'
import entry08675 from '../src/cards/encounter-entries/edgeOfTheEarth/theHeartOfMadnessPart2/08675.js'
import entry08676 from '../src/cards/encounter-entries/edgeOfTheEarth/theHeartOfMadnessPart2/08676.js'
import entry08677 from '../src/cards/encounter-entries/edgeOfTheEarth/theHeartOfMadnessPart2/08677.js'
import entry08678 from '../src/cards/encounter-entries/edgeOfTheEarth/theHeartOfMadnessPart2/08678.js'
import entry08679 from '../src/cards/encounter-entries/edgeOfTheEarth/theHeartOfMadnessPart2/08679.js'
import entry08680 from '../src/cards/encounter-entries/edgeOfTheEarth/theHeartOfMadnessPart2/08680.js'
import entry08681 from '../src/cards/encounter-entries/edgeOfTheEarth/theHeartOfMadnessPart2/08681.js'
import entry08682 from '../src/cards/encounter-entries/edgeOfTheEarth/theHeartOfMadnessPart2/08682.js'
import entry08683 from '../src/cards/encounter-entries/edgeOfTheEarth/theHeartOfMadnessPart2/08683.js'
import entry08684 from '../src/cards/encounter-entries/edgeOfTheEarth/theHeartOfMadnessPart2/08684.js'
import entry08685 from '../src/cards/encounter-entries/edgeOfTheEarth/theHeartOfMadnessPart2/08685.js'
import entry08686 from '../src/cards/encounter-entries/edgeOfTheEarth/theHeartOfMadnessPart2/08686.js'
import entry08716 from '../src/cards/encounter-entries/edgeOfTheEarth/_shared/expedition_team/08716.js'

const ENTRIES = [entry08671, entry08672, entry08673, entry08674, entry08675, entry08676, entry08677,
  entry08678, entry08679, entry08680, entry08681, entry08682, entry08683, entry08684, entry08685, entry08686]
for (const entry of ENTRIES) if (!registeredEntry(entry.code)) registerCardAbilities(entry)
// 08716 是战役共用伙伴（expedition_team）：本文件只验证其能力真实路径，需要显式登记。
if (!registeredEntry(entry08716.code)) registerCardAbilities(entry08716)

const testCampaign = {
  ...campaign,
  status: 'playable',
  scenarioIds: [chapter.manifest.id],
  unlock: { [chapter.manifest.id]: [] },
  recordSchema: {
    drKenslerHasAPlan: 'boolean',
    theTruthOfTheMirageEludesYou: 'boolean',
    drKenslerUnderstandsTheTrueNatureOfTheMiasma: 'boolean',
    theNamelessMadnessIsContainedSafelyWithinItsHostForNow: 'boolean',
    theFacilityWasDestroyed: 'boolean',
    theTeamEscapedTheFacility: 'boolean',
    theSurvivorsOfTheExpeditionWere: 'string[]',
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
const pylonSlotsOf = state => (state.scenario.facilitySlots || [])
  .filter(slot => PYLON_SLOT_CODES.includes(codeOf(locationOf(state, slot))))

test('P7 theHeartOfMadnessPart2 setup：随机布置 10 设施 + 5 高塔，门翻面，内环不全是高塔', () => {
  const state = buildState()
  setup(state)
  assert.equal(state.locations.length, 16, '门 + 十五个槽位')
  assert.equal(locationOf(state, 'theGateOfYquaa').revealed, false, '伊夸之门以未揭示面进场')
  const pylons = pylonSlotsOf(state)
  assert.equal(pylons.length, 5, '恰好五座迷雾高塔')
  assert.ok(pylons.every(slot => towerHealth(state, slot) > 0), '高塔生命 = 线索值')
  assert.ok(!INNER_RING_SLOTS.every(slot => PYLON_SLOT_CODES.includes(codeOf(locationOf(state, slot)))),
    '内环五格不能全是迷雾高塔')
  assert.equal(sealsOf(state).length, 5, '封印从战役状态继承（测试默认五枚休眠分配）')
  assert.equal(state.encounterDeck.length, 14, '四个遭遇组按 setup 限制后的牌数')
})

test('P7 theHeartOfMadnessPart2 高塔：幕 3 期间可被当作敌人攻击并坍塌', () => {
  const state = buildState()
  const api = setup(state)
  const slot = pylonSlotsOf(state)[0]
  const inv = state.investigators[0]
  inv.location = slot
  const moves = chapter.behavior.actions(state, inv)
  const attack = moves.find(item => item.rule === `heartOfMadnessAttackPylon:${slot}`)
  assert.ok(attack, '已揭示高塔提供攻击行动')
  const stub = { ...api, test: (seat, skill, difficulty, resolve) => resolve() }
  let guard = 0
  while (!towerState(state, slot).collapsed && guard < 20) {
    guard += 1
    chapter.behavior.performAction(state, inv, attack, stub)
  }
  assert.equal(towerState(state, slot).collapsed, true, '生命归零后坍塌')
  assert.ok(collapsedTowers(state).includes(slot))
})

test('P7 theHeartOfMadnessPart2 幕 3 目标：全部高塔坍塌 → 推进到第 4 幕', () => {
  const state = buildState()
  const api = setup(state)
  assert.equal(codeOf(state.acts[state.actIndex]), '08673')
  const stub = { ...api, test: (seat, skill, difficulty, resolve) => resolve() }
  const inv = state.investigators[0]
  for (const slot of pylonSlotsOf(state)) {
    inv.location = slot
    const attack = chapter.behavior.actions(state, inv).find(item => item.rule === `heartOfMadnessAttackPylon:${slot}`)
    let guard = 0
    while (!towerState(state, slot).collapsed && guard < 20) {
      guard += 1
      chapter.behavior.performAction(state, inv, attack, stub)
    }
  }
  chapter.behavior.checkObjectives(state, stub)
  assert.equal(state.actIndex, 1, '推进到最终幻景')
  assert.equal(codeOf(state.acts[state.actIndex]), '08681')
})

test('P7 theHeartOfMadnessPart2 坡道场景：幕 3 背面清场并铺设泰坦坡道 + 隐藏隧道', () => {
  const state = buildState()
  const api = setup(state)
  chapter.behavior.actLeftPlay(state, { originalCode: '08673' }, api)
  const ids = state.locations.map(location => location.id).sort()
  assert.deepEqual(ids, ['hiddenTunnel', 'theGateOfYquaa', 'titanicRamp1', 'titanicRamp2', 'titanicRamp3',
    'titanicRamp4'])
  const ramp1 = locationOf(state, 'titanicRamp1')
  assert.ok(state.investigators.every(inv => inv.location === ramp1.id), '调查员移动到坡道 1')
  assert.ok(ramp1.connections.includes('titanicRamp2') && locationOf(state, 'hiddenTunnel').connections.includes('titanicRamp4'),
    '坡道从左到右依次连接')
  assert.equal(locationOf(state, 'theGateOfYquaa').revealed, false, '门保持未揭示面')
})

test('P7 theHeartOfMadnessPart2 议程背面：封印渐弱 → 在最近迷雾高塔生成无名的疯狂', () => {
  const state = buildState()
  const api = setup(state)
  chapter.behavior.agendaLeftPlay(state, { originalCode: '08671' }, api)
  assert.ok(state.enemies.some(enemy => codeOf(enemy) === RAW_CODES.namelessMadness),
    '生成了无名的疯狂')
  const nameless = state.enemies.find(enemy => codeOf(enemy) === RAW_CODES.namelessMadness)
  assert.ok(pylonSlotsOf(state).includes(nameless.location), '生成在迷雾高塔')
})

test('P7 theHeartOfMadnessPart2 结局：全高塔坍塌 + 肯斯勒计划 → R1（+10 经验）与记录', () => {
  const state = buildState()
  const api = setup(state)
  // 直接把五座高塔打到坍塌（原语级，行为已在上一用例覆盖攻击路径）。
  for (const slot of pylonSlotsOf(state)) damageTower(state, { towerId: slot, amount: 99 })
  assert.equal(collapsedTowers(state).length, 5)
  state.campaign.records.drKenslerHasAPlan = true
  const result = chapter.behavior.resolution(state, 'resolution1', [], api)
  assert.equal(result.bonus, 10)
  assert.ok(state.campaign.records.theNamelessMadnessIsContainedSafelyWithinItsHostForNow)
  assert.equal(state.campaign.records.theSurvivorsOfTheExpeditionWere.length, 2)
  const clone = json(state)
  assert.equal(clone.scenario.id, 'theHeartOfMadnessPart2')
  assert.equal(collapsedTowers(clone).length, 5, 'JSON 往返后高塔状态保留')
})

test('P0-7 08672 无印刷毁灭阈值：doom=0/99 都不会让下一神话阶段推进并清场', () => {
  const state = buildState()
  setup(state)
  assert.equal(state.agendas[1].doomThreshold, null,
    '08672 印刷没有毁灭阈值：应为 null（引擎 checkAgenda 的「不靠毁灭推进」读点），不得是 0')
  const before = state.locations.map(location => location.id).sort()
  state.agendaIndex = 1
  state.doom = 0
  checkAgenda(state, [])
  assert.equal(state.agendaIndex, 1, 'doom=0 不应推进议程')
  assert.equal(state.status, 'playing', '局面应仍在进行')
  assert.deepEqual(state.locations.map(location => location.id).sort(), before, '不应执行坡道清场')
  state.doom = 99
  checkAgenda(state, [])
  assert.equal(state.agendaIndex, 1, '目标型议程即使毁灭很多也不靠阈值推进')
  assert.ok(!state.locations.some(location => location.id === 'titanicRamp1'), '坡道场景不得被提前触发')
})

test('P0-7 开场战役日志：无计划 → R2 门槛；肯斯勒存活且已明真相 → R1 门槛', () => {
  const fallback = buildState()
  setup(fallback)
  assert.equal(fallback.campaign.records.theTruthOfTheMirageEludesYou, true, '默认应写「幻景的真相仍未明了」')
  assert.equal(fallback.campaign.records.drKenslerHasAPlan, false)

  const planned = buildState()
  planned.campaign.eote = { partners: { roster: [{ code: '08720', damage: 0, horror: 0, status: 'safe' }] } }
  planned.campaign.records.drKenslerUnderstandsTheTrueNatureOfTheMiasma = true
  setup(planned)
  assert.equal(planned.campaign.records.drKenslerHasAPlan, true, '肯斯勒存活且已明真相时应写「已有计划」')
  assert.equal(planned.campaign.records.theTruthOfTheMirageEludesYou, false)
})

test('P0-7 08716 成功躲避：引擎能力路径结算（不再 ReferenceError），花费秘密并可移动', () => {
  const state = buildState(1)
  setup(state)
  const inv = state.investigators[0]
  inv.location = 'facility8'
  const here = locationOf(state, inv.location)
  const target = locationOf(state, 'facility7')
  assert.ok(here && target, '需要两个设施地点')
  if (!here.connections.includes(target.id)) here.connections.push(target.id)
  if (!target.connections.includes(here.id)) target.connections.push(here.id)
  state.enemies.push({
    id: 'evade-target', code: '99999', name: '测试敌人', location: here.id,
    fight: 0, evade: 0, health: 3, damage: 0, horror: 0, exhausted: false, engagedSeat: null,
  })
  inv.assets.push({ id: 'asset-08716', code: '08716', originalCode: '08716', uses: 3, usesType: 'secrets', exhausted: false })
  state.chaosBag = ['0']
  inv.actionsLeft = 5
  state.currentSeat = 0
  const command = { action: 'ability', assetId: 'asset-08716', abilityIndex: 0 }
  assert.equal(validateMove(state, 0, command), null, '08716 能力应是合法动作')
  applyMove(state, 0, command)  // 成功躲避 → 若 `here` 未定义，这里抛 ReferenceError
  settle(state, choice => (choice.options.some(option => option.id === target.id) ? target.id : null))
  const current = state.investigators[0]
  const asset = current.assets.find(item => item.id === 'asset-08716')
  assert.equal(state.enemies[0].exhausted, true, '躲避成功后敌人横置')
  assert.equal(asset.uses, 2, '应花费 1 秘密（3→2）')
  assert.equal(current.location, target.id, '成功后应移动到连接地点')
})

test('P7 theHeartOfMadnessPart2 混乱标记与 story：共用 08648 参考卡、结构可读', () => {
  const state = buildState()
  const inv = state.investigators[0]
  assert.deepEqual(heartOfMadnessChaosToken(state, inv, 'tablet'), { delta: -3, drawTekeliOnFail: true })
  assert.deepEqual(heartOfMadnessChaosToken(state, inv, 'elderthing'), { delta: -4, doomOnFailBy: 3 })
  const story = chapterStory('theHeartOfMadnessPart2')
  assert.equal(story.sectionCount, 53)
  assert.ok(story.intro.length > 100)
  assert.match(storyText('theHeartOfMadnessPart2', 'setup'), /深海涌动/)
  assert.match(resolutionText('theHeartOfMadnessPart2', 'resolution1'), /结局 1/)
  for (const entry of ENTRIES) {
    assert.ok(chapter.implementedEncounterCodes.includes(entry.code), `${entry.code} 在清单`)
    assert.equal(registeredEntry(entry.code).implemented, true)
  }
  assert.equal(chapter.manifest.status, 'playable')
  assert.equal(chapter.manifest.campaignId, 'edgeOfTheEarth')
})
