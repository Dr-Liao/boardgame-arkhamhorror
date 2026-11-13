// P7 暗中交易（Dealings in the Dark · 09566）· 章节验收（真实引擎状态 + 章节行为 + 单卡条目）。
//
// 覆盖：setup 三选一记录/时间线索/放一边/艾婕与密钥、四地点连接、场景 2 图形布置与共边连接、
// 隐匿迷你卡的阴影/揭露、幕与密谋背面（日食重翻密谋）、异教徒抢夺线索、教派线索总数、
// 混乱标记动态值与失败后果、敌人/诡计条目行为、艾婕信任/敌对结局链、JSON 往返与读档校验、
// 剧情正文结构。
import test from 'node:test'
import assert from 'node:assert/strict'
import '../src/engine/engine.js'
import { registerCardAbilities, registeredEntry } from '../src/engine/ability.js'
import { registerCampaignScenarios, scenarioRuntime } from '../src/engine/engine.js'
import { registerContentBundle, contentRegistry } from '../content/registered.js'
import { manifest as tskCampaign } from '../content/campaigns/theScarletKeys/manifest.js'
import { fixture } from './core-fixture.mjs'
import * as chapter from '../content/campaigns/theScarletKeys/scenarios/dealingsInTheDark/index.js'
import { applyUnsealingKeywords } from '../content/campaigns/theScarletKeys/scenarios/dealingsInTheDark/behavior.js'
import {
  BAZAAR_LOCATION_CODES, CODES, INITIAL_LOCATIONS, KEY_ID, LOCATION_IDS, LOCATION_RULES,
  SET_ASIDE_ENEMY_CODES, SET_ASIDE_LOCATION_CODES,
} from '../content/campaigns/theScarletKeys/scenarios/dealingsInTheDark/definition.js'
import { bazaarDiagramFor, isSideAdjacent } from '../content/campaigns/theScarletKeys/scenarios/dealingsInTheDark/layout.js'
import {
  cluesUnveiled, cultCluesTotal, dealingsChaosAfterTest, dealingsChaosToken, skullValue,
} from '../content/campaigns/theScarletKeys/scenarios/dealingsInTheDark/chaos.js'
import { chapterStory, resolutionText, storyText } from '../content/campaigns/theScarletKeys/story-access.js'
import { validateTskState } from '../src/engine/tsk-primitives.js'
import entry09571 from '../src/cards/encounter-entries/theScarletKeys/dealingsInTheDark/09571.js'
import entry09571b from '../src/cards/encounter-entries/theScarletKeys/dealingsInTheDark/09571b.js'
import entry09584 from '../src/cards/encounter-entries/theScarletKeys/_shared/dealings_in_the_dark/09584.js'
import entry09585 from '../src/cards/encounter-entries/theScarletKeys/dealingsInTheDark/09585.js'
import entry09586a from '../src/cards/encounter-entries/theScarletKeys/dealingsInTheDark/09586a.js'
import entry09586b from '../src/cards/encounter-entries/theScarletKeys/dealingsInTheDark/09586b.js'
import entry09586c from '../src/cards/encounter-entries/theScarletKeys/dealingsInTheDark/09586c.js'
import entry09587 from '../src/cards/encounter-entries/theScarletKeys/dealingsInTheDark/09587.js'
import entry09588 from '../src/cards/encounter-entries/theScarletKeys/dealingsInTheDark/09588.js'
import entry09589 from '../src/cards/encounter-entries/theScarletKeys/dealingsInTheDark/09589.js'
import entry09590a from '../src/cards/encounter-entries/theScarletKeys/dealingsInTheDark/09590a.js'
import entry09590b from '../src/cards/encounter-entries/theScarletKeys/dealingsInTheDark/09590b.js'

const ENTRIES = [entry09571, entry09571b, entry09584, entry09585, entry09586a, entry09586b, entry09586c,
  entry09587, entry09588, entry09589, entry09590a, entry09590b]
for (const entry of ENTRIES) if (!registeredEntry(entry.code)) registerCardAbilities(entry)

// P7 章节状态 development：生产组合根不装本章；测试进程内用内容 API 注册（不写共享文件）。
const testCampaign = {
  ...tskCampaign,
  status: 'playable',
  scenarioIds: [chapter.manifest.id],
  unlock: { [chapter.manifest.id]: [] },
  recordSchema: {
    theCellIsWorkingWithEce: 'boolean',
    theCellIsDecievingEce: 'boolean',
    theCellRefusedEcesOffer: 'boolean',
    eceTrustsTheCell: 'boolean',
    eceDoesNotTrustTheCell: 'boolean',
    twistedAntiprismBearer: 'string',
    youHaventSeenTheLastOfTheRedGlovedMan: 'boolean',
    time: 'number',
  },
}
// 只注册本章场景：战役 flow 引用了其它章节点，测试夹具里移除（与 r&R/onThinIce 同口径）。
delete testCampaign.flow
delete testCampaign.flowPayload
if (!contentRegistry.getCampaign('theScarletKeys')) {
  registerContentBundle({ campaigns: [testCampaign], scenarios: [chapter] })
}
registerCampaignScenarios('theScarletKeys')

const json = value => JSON.parse(JSON.stringify(value))
const codeOf = card => card?.originalCode || card?.code
const locationOf = (state, id) => state.locations.find(location => location.id === id) || null
const cultistInPlay = state => state.enemies.find(enemy => (enemy.traits || [])
  .some(trait => String(trait).toLowerCase() === 'cultist')) || null

/** 让 chapter 的选择永远返回指定答案（intro 分支/选项 id）。 */
function chooseAnswer(value) {
  return spec => (spec.options || []).some(option => String(option.id) === String(value))
    ? value
    : (spec.options?.[0]?.id ?? null)
}

function buildState(count = 2, { time = 0 } = {}) {
  const state = fixture('01001', count)
  state.campaign.id = 'theScarletKeys'
  state.campaign.records = { time }
  delete state.campaign.tsk
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
  state.encounterDeck = [...state.scenario.encounterDeck]
  state.encounterDiscard = []
  state.chaosBag = ['-3', '0', '0', '0']
  state.difficulty = 'standard'
  state.numInvestigators = count
  state.status = 'playing'
  state.phase = 'investigation'
  state.round = 1
  for (const inv of state.investigators) {
    inv.location = chapter.scenario.startLocation
    inv.clues = 0
    inv.resources = 10
    inv.hand = ['01025']
    inv.engaged = []
  }
  return state
}

/** 布置：入口三选一 + 四地点入场 + 剧情卡/密钥/教派敌人抽牌。 */
function setup(state, { intro = 'giveToEce', answer = null } = {}) {
  const events = []
  const api = scenarioRuntime(state, events)
  const stub = {
    ...api,
    choose: spec => {
      if ((spec.source || '').includes('intro')) return intro
      return (answer || chooseAnswer(null))(spec)
    },
  }
  chapter.behavior.preScenarioSetup(state, events, stub)
  const ids = chapter.behavior.setupLocations(state, events, { info: () => {}, api: stub })
  for (const id of ids) api.place(id)
  chapter.behavior.afterDeckSetup(state, events, { info: () => {}, api: stub })
  return { api: stub, events }
}

function miniCards(state) {
  return state.scenarioFlags?.mechanics?.tsk?.concealed?.miniCards || []
}

test('P7 dealingsInTheDark setup：四起始地点、放一边、艾婕入场、密钥初始化、教派敌人抽牌', () => {
  const state = buildState(2, { time: 0 })
  setup(state)
  assert.equal(state.locations.length, 4)
  assert.deepEqual(state.locations.map(location => location.id).sort(), [...INITIAL_LOCATIONS].sort())
  assert.equal(locationOf(state, LOCATION_IDS.hagiaSophia).revealed, true, '有调查员的地点在入场时揭示')
  // 放一边：七张大巴扎 + 码头 + 两名敌人 + 密钥卡
  const setAside = state.scenarioZones.setAside
  for (const code of [...SET_ASIDE_LOCATION_CODES, ...SET_ASIDE_ENEMY_CODES, CODES.keyStable]) {
    assert.ok(setAside.includes(code), `${code} 在放一边区`)
  }
  assert.equal(setAside.length, SET_ASIDE_LOCATION_CODES.length + SET_ASIDE_ENEMY_CODES.length + 1)
  // 艾婕·萨辛（与艾婕合作）与「彰显」入场
  assert.ok(state.storyAssets.some(asset => codeOf(asset) === CODES.eceSahin), '艾婕·萨辛以剧情支援入场')
  assert.ok(state.storyAssets.some(asset => codeOf(asset) === CODES.storyTheUnveiling), '「彰显」入场')
  // 密钥实体初始化
  const key = state.campaign.tsk.keys.keys[KEY_ID]
  assert.equal(key.stable, true)
  assert.equal(key.bearer.type, 'none')
  // 两位调查员各抽到一张异教徒，并结算隐匿关键词（迷你卡 + 诱饵）
  assert.ok(state.enemies.length >= 2, '每位调查员各抽到一张[[异教徒]]敌人')
  assert.ok(miniCards(state).length >= state.enemies.length, '隐匿迷你卡已分配')
  assert.ok(miniCards(state).some(card => card.decoy === true), '包含诱饵迷你卡')
  assert.equal(state.campaign.records.theCellIsWorkingWithEce, true)
})

test('P7 dealingsInTheDark setup：时间 ≥18 时彰显的线索 = 人数，三种入口分支记录不同', () => {
  const state = buildState(3, { time: 18 })
  setup(state)
  assert.equal(cluesUnveiled(state), 3, '18–24 点时间：彰显上放「人数」个线索')
  const other = buildState(2)
  setup(other, { intro: 'takeForOurselves' })
  assert.equal(other.campaign.records.theCellRefusedEcesOffer, true)
  assert.ok(!other.storyAssets.some(asset => codeOf(asset) === CODES.eceSahin), '拒绝艾婕后她移出游戏')
  const liar = buildState(2)
  setup(liar, { intro: 'giveToEceLying' })
  assert.equal(liar.campaign.records.theCellIsDecievingEce, true)
})

test('P7 dealingsInTheDark 地点：印刷连接符号与加拉塔码头进入限制', () => {
  const state = buildState()
  const { api } = setup(state)
  assert.deepEqual([...locationOf(state, LOCATION_IDS.hagiaSophia).connections].sort(),
    [LOCATION_IDS.istanbulUniversity, LOCATION_IDS.obeliskOfTheodosius].sort())
  assert.deepEqual([...locationOf(state, LOCATION_IDS.galata).connections].sort(),
    [LOCATION_IDS.istanbulUniversity, LOCATION_IDS.obeliskOfTheodosius, LOCATION_IDS.galataDocks].sort())
  // 码头只能从加拉塔进入
  const inv = state.investigators[0]
  api.place(LOCATION_IDS.galataDocks)
  inv.location = LOCATION_IDS.hagiaSophia
  assert.match(chapter.behavior.moveError(state, inv, locationOf(state, LOCATION_IDS.galataDocks)), /只能从/)
  inv.location = LOCATION_IDS.galata
  assert.equal(chapter.behavior.moveError(state, inv, locationOf(state, LOCATION_IDS.galataDocks)), null)
  // 额外费用：弃 1 张手牌（近似）
  inv.hand = ['01025']
  const ok = chapter.behavior.beforeMove(state, inv, locationOf(state, LOCATION_IDS.galataDocks), api)
  assert.equal(ok, true)
  assert.equal(inv.hand.length, 0, '额外费用弃掉了 1 张手牌')
})

test('P7 dealingsInTheDark 幕 1 背面：四地点放一边、六张大巴扎按图形入场、调查员移到入口、共边连接', () => {
  const state = buildState(2)
  const { api } = setup(state)
  const result = chapter.behavior.actReveal(state, state.acts[state.actIndex], api)
  assert.ok(result)
  const flags = state.scenarioFlags
  assert.ok(flags.bazaarDiagram, '记录了图形')
  assert.ok(flags.bazaarEntrance && flags.bazaarEastGate, '记录入口与东门')
  assert.equal(flags.bazaarLocations.length, 6, '七张抽 6 张入场')
  assert.ok(flags.bazaarRemoved, '另一张被移出游戏')
  for (const id of flags.bazaarLocations) assert.ok(locationOf(state, id), `${id} 已入场`)
  for (const inv of state.investigators) assert.equal(inv.location, flags.bazaarEntrance)
  // 共边相邻 = 互相连接
  const placed = flags.bazaarLocations.map(id => locationOf(state, id))
  let edges = 0
  for (const left of placed) {
    for (const right of placed) {
      if (left.id >= right.id) continue
      const adjacent = isSideAdjacent(left, right)
      const connected = (left.connections || []).includes(right.id)
      assert.equal(connected, adjacent, `${left.id} 与 ${right.id} 的共边连接应等于相邻关系`)
      if (connected) edges += 1
    }
  }
  assert.ok(edges >= 0)
  // 场景 1 的四个地点放一边（snapshot 记录线索/揭示状态）
  assert.equal(flags.actOneLocations.length, 4)
  assert.equal(state.locations.filter(location => INITIAL_LOCATIONS.includes(location.id)).length, 0)
})

test('P7 dealingsInTheDark 幕 2 背面：密钥入场、地点回场、彰显翻解封、密谋推进到追逐', () => {
  const state = buildState(2)
  const { api } = setup(state)
  chapter.behavior.actReveal(state, state.acts[state.actIndex], api)
  const flags = state.scenarioFlags
  flags.talismanWinner = 'investigators'
  // 东门放一位调查员（调查员先达成阈值）
  const inv = state.investigators[0]
  api.moveInvestigator(inv.seat, flags.bazaarEastGate)
  chapter.behavior.actReveal(state, state.acts[1], api)
  assert.equal(state.agendaIndex, 1, '密谋直接推进到「追逐」')
  assert.equal(codeOf(state.agendas[state.agendaIndex]), CODES.agendaTheChase)
  const key = state.campaign.tsk.keys.keys[KEY_ID]
  assert.equal(key.bearer.type, 'investigator', '调查员先达成阈值：密钥交给东门调查员')
  assert.equal(key.bearer.seat, inv.seat)
  assert.ok(!state.storyAssets.some(asset => codeOf(asset) === CODES.storyTheUnveiling), '彰显离场')
  assert.ok(state.storyAssets.some(asset => codeOf(asset) === CODES.storyTheUnsealing), '解封入场')
  assert.equal(cluesUnveiled(state), 0, '彰显的线索全部移除')
  // 场景 1 的地点回场
  for (const id of INITIAL_LOCATIONS) assert.ok(locationOf(state, id), `${id} 回到场上`)
  assert.ok(locationOf(state, LOCATION_IDS.galataDocks), '加拉塔码头入场')
  assert.ok(locationOf(state, LOCATION_IDS.hagiaSophia).connections.includes(flags.bazaarEntrance),
    '圣索菲亚与入口彼此连接')
})

test('P7 dealingsInTheDark 隐匿：敌人进阴影 → 揭露真身回到地点；揭露诱饵触发商铺规则', () => {
  const state = buildState()
  const { api } = setup(state)
  const cultist = cultistInPlay(state)
  assert.ok(cultist, 'setup 抽到了异教徒')
  const mini = miniCards(state).find(card => !card.decoy && card.kind === `enemy${codeOf(cultist)}`)
  assert.ok(mini, '真身迷你卡存在')
  const locationId = mini.locationId
  // 章节事件的揭示/回阴影在真实引擎里由规则事务驱动；测试用同一份行为加固定选择桩。
  const eventsApi = { ...api, choose: spec => spec.options[0].id, choice: spec => spec.options[0].id }
  // 通过章节事件把敌人送回阴影（议程 1 的强制走同一入口）
  assert.equal(chapter.behavior.events.dealingsSendCultistToShadows(state, { enemyId: cultist.id }, eventsApi), true)
  assert.ok(!state.enemies.includes(cultist), '敌人移出场上')
  assert.ok((state.setAsideEnemies || []).some(enemy => enemy.id === cultist.id), '敌人进入放一边区（阴影）')
  const exposed = chapter.behavior.events.dealingsExpose(state, { seat: 0, locationId }, eventsApi)
  assert.equal(exposed.exposed, true)
  assert.equal(exposed.decoy, false)
  assert.ok(state.enemies.includes(cultist), '揭露真身：敌人回到地点')
  assert.equal(cultist.location, locationId)
  // 诱饵：在「拥挤商铺」揭露会把 1 个线索移到同地点的异教徒
  const shops = LOCATION_IDS.bazaarCrowdedShops
  api.place(shops)
  const shopsLocation = locationOf(state, shops)
  shopsLocation.clues = 2
  const decoy = miniCards(state).find(card => card.decoy)
  assert.ok(decoy)
  const concealed = state.scenarioFlags.mechanics.tsk.concealed
  concealed.miniCards.find(card => card.id === decoy.id).locationId = shops
  cultist.location = shops
  cultist.clues = 0
  const decoyResult = chapter.behavior.events.dealingsExpose(state, { seat: 0, locationId: shops }, eventsApi)
  assert.equal(decoyResult.decoy, true)
  assert.equal(shopsLocation.clues, 1, '揭露诱饵：本地点 1 个线索移到最近的异教徒')
  assert.equal(cultist.clues, 1)
})

test('P7 dealingsInTheDark 密谋 1 背面：每位调查员选择并把线索放到彰显上，日食 +1 并翻回', () => {
  const state = buildState(2)
  const { api } = setup(state)
  const before = state.agendaIndex
  const eclipseBefore = Number(state.scenarioFlags.eclipse) || 0
  const unveiledBefore = cluesUnveiled(state)
  // 选择永远取第一项（「把 1 个线索放到彰显的线索上」）
  const stub = { ...api, choose: spec => spec.options[0].id }
  chapter.behavior.agendaReveal(state, state.agendas[state.agendaIndex], stub)
  assert.equal(state.agendaIndex, before, '翻回正面，不推进密谋')
  assert.equal(state.scenarioFlags.eclipse, eclipseBefore + 1, '日食 +1')
  assert.equal(cluesUnveiled(state), unveiledBefore + 2, '两位调查员各放 1 个线索')
  // 第二次推进：日食 1 → 额外结算 1 次（共 3 次）
  chapter.behavior.agendaReveal(state, state.agendas[state.agendaIndex], stub)
  assert.equal(cluesUnveiled(state), unveiledBefore + 5)
  assert.equal(state.scenarioFlags.eclipse, 2)
})

test('P7 dealingsInTheDark 幕目标：教派线索达到阈值推进幕 1；东门调查员线索推进幕 2', () => {
  const state = buildState(2)
  const { api } = setup(state)
  // 教派线索 = 异教徒线索 + 彰显的线索
  const cultist = cultistInPlay(state)
  cultist.clues = 6
  state.scenarioFlags.cluesUnveiled = 2
  assert.equal(cultCluesTotal(state), 8)
  assert.equal(cluesUnveiled(state), 2)
  chapter.behavior.checkObjectives(state, api)
  assert.equal(state.actIndex, 1, '教派 8 ≥ 4×2：推进幕 1')
  assert.equal(state.scenarioFlags.manuscriptWinner, 'cult')
  // 幕 2：东门调查员线索 ≥ 8×人数
  const eastGate = state.scenarioFlags.bazaarEastGate
  for (const inv of state.investigators) api.moveInvestigator(inv.seat, eastGate)
  state.investigators[0].clues = 7
  state.investigators[1].clues = 9
  chapter.behavior.checkObjectives(state, api)
  assert.equal(state.actIndex, 2, '幕牌库走完（追逐同时充当最终幕）')
  assert.equal(state.agendaIndex, 1)
})
test('P7 dealingsInTheDark 混乱标记：骷髅动态值、异教徒改值提示、石板/旧日支配者后果', () => {
  const state = buildState(2)
  setup(state)
  const inv = state.investigators[0]
  const cultist = cultistInPlay(state)
  cultist.clues = 2
  assert.equal(skullValue(state), 2)
  assert.deepEqual(dealingsChaosToken(state, inv, 'skull'), { delta: -2, skullX: 2 })
  cultist.clues = 5
  assert.equal(skullValue(state), 3, '简单/标准以 3 封顶')
  state.difficulty = 'hard'
  const hard = dealingsChaosToken(state, inv, 'skull')
  assert.equal(hard.skullX, 4, '困难/专家看总数，以 4 封顶')
  const cultistToken = dealingsChaosToken(state, inv, 'cultist')
  assert.equal(cultistToken.delta, -7)
  assert.deepEqual(cultistToken.cultistDoomSwap, { doom: 1, changedTo: -3 })
  assert.equal(dealingsChaosToken(state, inv, 'tablet').placeClueOnLocationOnFail, true)
  // 检定后的后果
  inv.clues = 2
  assert.deepEqual(dealingsChaosAfterTest(state, inv, { drawn: ['tablet'], success: false }),
    [{ type: 'clueToLocation', seat: inv.seat, amount: 1 }])
  state.difficulty = 'standard'
  assert.deepEqual(dealingsChaosAfterTest(state, inv, { drawn: ['elderthing'], success: true }), [])
  assert.deepEqual(dealingsChaosAfterTest(state, inv, { drawn: ['elderthing'], success: false }),
    [{ type: 'doomOnNearestCultist' }])
  // behavior.afterTest 结算：石板把线索放到地点、旧日支配者在异教徒上放毁灭
  const api = scenarioRuntime(state, [])
  const location = locationOf(state, inv.location)
  const cluesAtLocation = location.clues
  chapter.behavior.afterTest(state, inv, { drawn: ['tablet'], success: false }, api, { resolvedTokens: ['tablet'] })
  assert.equal(inv.clues, 1)
  assert.equal(location.clues, cluesAtLocation + 1)
  const cluesBefore = Number(cultist.clues) || 0
  chapter.behavior.afterTest(state, inv, { drawn: ['elderthing'], success: false }, api, { resolvedTokens: ['elderthing'] })
  assert.equal(Number(cultist.doom) || 0, 0, '「彰显」在场：放到异教徒上的毁灭立刻翻至线索面')
  assert.equal(Number(cultist.clues) || 0, cluesBefore + 1, '失败：最近的异教徒多 1 个线索')
})

test('P7 dealingsInTheDark 敌人与诡计条目：野心家放毁灭、阴影笼罩/纠缠不休/虚空幽光', () => {
  const state = buildState(2)
  const { api } = setup(state)
  const cultist = cultistInPlay(state)
  // 野心家：敌军阶段结束时若重整则放 1 毁灭
  const aspirant = {
    id: 'aspirant-test', originalCode: CODES.sinisterAspirantA, code: CODES.sinisterAspirantA,
    name: '邪恶野心家(A)', location: state.investigators[0].location, engagedSeat: null,
    exhausted: false, doom: 0, traits: ['Humanoid', 'Cultist'],
  }
  state.enemies.push(aspirant)
  chapter.behavior.enemyPhaseEnd(state, api)
  // 彰显（09571）在场：异教徒敌人上的毁灭放置后立即翻至线索面。
  assert.equal(Number(aspirant.doom) || 0, 0, '重整的野心家放 1 毁灭，但彰显把它翻至线索面')
  assert.equal(Number(aspirant.clues) || 0, 1, '野心家的 1 毁灭被彰显翻成 1 线索')
  aspirant.exhausted = true
  chapter.behavior.enemyPhaseEnd(state, api)
  assert.equal(Number(aspirant.clues) || 0, 1, '横置（已消耗）时不放毁灭')
  // 阴影笼罩：场上有异教徒 → 在最近的异教徒放 1 毁灭并检定意志
  const inv = state.investigators[0]
  const doomBefore = Number(cultist.doom) || 0
  const failingTest = (seat, skill, difficulty, resolve) => resolve({ success: false, value: 0 })
  const shadowed = entry09587.encounterResolve(state, inv, { code: '09587' }, { ...api, test: failingTest })
  assert.deepEqual({ resolved: shadowed.resolved }, { resolved: true })
  assert.equal(Number(cultist.doom) || 0, doomBefore + 1)
  const horrorAfterFail = inv.horror
  assert.equal(horrorAfterFail, 2, '意志检定失败：受到 2 点恐惧（0 → 2）')
  // 纠缠不休：同样在最近的异教徒上放 1 毁灭（敏捷检定失败 → 2 伤害）
  const accosted = entry09588.encounterResolve(state, inv, { code: '09588' }, { ...api, test: failingTest })
  assert.equal(accosted.resolved, true)
  assert.equal(Number(cultist.doom) || 0, doomBefore + 2)
  assert.equal(inv.damage, 2, '敏捷检定失败：受到 2 点伤害（0 → 2）')
  // 虚空幽光：调查员线索多于教派 → 结算两次（选择第二项：1 伤害 1 恐惧）
  const stub = {
    ...api,
    choose: spec => spec.options[spec.options.length - 1].id,
    choice: spec => spec.options[spec.options.length - 1].id,
    test: (seat, skill, difficulty, resolve) => resolve({ success: true }),
  }
  state.investigators[0].clues = 9
  state.investigators[1].clues = 9
  cultist.clues = 0
  state.scenarioFlags.cluesUnveiled = 0
  const damageBefore = state.investigators[0].damage
  const horrorBefore = state.investigators[0].horror
  entry09589.encounterResolve(state, inv, { code: '09589' }, stub)
  assert.equal(state.investigators[0].damage, damageBefore + 2, '线索多于教派：显现结算两次')
  assert.equal(state.investigators[0].horror, horrorBefore + 2)
  // 场上没有异教徒：获得涌动 / 受到伤害
  state.enemies = state.enemies.filter(enemy => !(enemy.traits || []).some(trait => String(trait).toLowerCase() === 'cultist'))
  assert.equal(entry09587.encounterResolve(state, inv, { code: '09587' }, api).gainSurge, true)
  assert.equal(entry09588.encounterResolve(state, inv, { code: '09588' }, api).gainSurge, true)
})

test('P7 dealingsInTheDark 追溯键：彰显把毁灭翻成线索；解封授予猎手/巡逻并在毁灭时改为移动攻击', () => {
  const state = buildState(2)
  const { api } = setup(state)
  const cultist = cultistInPlay(state)
  cultist.doom = 2
  cultist.clues = 0
  entry09571.abilities[0].resolve({
    state, context: { card: cultist, amount: 2 }, api: { ...api, scenario: api, info: () => {} },
  })
  assert.equal(cultist.doom, 0, '毁灭翻至线索面')
  assert.equal(cultist.clues, 2)
  // 超过 3 个线索：多余的移到彰显的线索
  cultist.clues = 5
  chapter.behavior.checkObjectives(state, api)
  assert.equal(cultist.clues, 3)
  assert.equal(cluesUnveiled(state), 2)
  // 解封：非弱点敌人获得猎手/猎物；持钥敌人改为巡逻
  const inv = state.investigators[0]
  state.storyAssets = state.storyAssets.filter(asset => codeOf(asset) !== CODES.storyTheUnveiling)
  api.storyAsset(CODES.storyTheUnsealing, null)
  const bearerSeat = inv.seat
  chapter.behavior.events.dealingsKeyStolenByEnemy(state, { enemyId: cultist.id }, api)
  assert.equal(state.campaign.tsk.keys.keys[KEY_ID].bearer.type, 'enemy')
  applyUnsealingKeywords(state, api)
  assert.equal(cultist.patrol?.locationId, LOCATION_IDS.galataDocks, '持钥敌人获得巡逻（加拉塔码头）')
  assert.equal(cultist.hunter, false)
  const other = state.enemies.find(enemy => enemy.id !== cultist.id)
  if (other) assert.equal(other.hunter, true, '其他非弱点敌人获得猎手')
  // 毁灭改为移动+攻击：doomPlaced 清掉刚放的毁灭并结算敌军阶段
  let resolvedPhase = 0
  const stub = { ...api, resolveEnemyPhaseOf: () => { resolvedPhase += 1 } }
  cultist.doom = 0
  cultist.doom = 1
  chapter.behavior.doomPlaced(state, { card: cultist, amount: 1, agenda: false }, stub)
  assert.equal(cultist.doom, 0, '刚放的毁灭被移除')
  assert.equal(resolvedPhase, 1, '改为移动并攻击')
})

test('P7 dealingsInTheDark 武器/暗处小巷：地点规则表与 describe 提示（读点缺口披露）', () => {
  const state = buildState()
  const { api } = setup(state)
  api.place(LOCATION_IDS.bazaarDarkenedAlley)
  api.place(LOCATION_IDS.bazaarPublicBaths)
  assert.equal(LOCATION_RULES[LOCATION_IDS.bazaarDarkenedAlley].concealedFightEvadeBonus, 2)
  assert.equal(LOCATION_RULES[LOCATION_IDS.bazaarPublicBaths].blankAssetsWithTrait, 'Weapon')
  const lines = chapter.behavior.describe(state)
  assert.ok(lines.some(line => line.includes('隐匿迷你卡的攻击/躲避难度 +2')))
  assert.ok(lines.some(line => line.includes('文本框视为空白')))
  assert.ok(chapter.behavior.scenarioApproximations.length >= 10)
  assert.ok(chapter.behavior.scenarioGaps.some(gap => gap.includes('武器文本空白')))
})

test('P7 dealingsInTheDark 屋顶通道：进入时反应检定、敌人经猎手/巡逻进入后再次结算（每轮一次）', () => {
  const state = buildState()
  const { api } = setup(state)
  // 先用幕 1 背面布置拿到大巴扎
  chapter.behavior.actReveal(state, state.acts[state.actIndex], api)
  const rooftop = LOCATION_IDS.bazaarRooftopAccess
  if (!locationOf(state, rooftop)) api.place(rooftop)
  const cultist = cultistInPlay(state)
  let tests = 0
  const stub = {
    ...api,
    test: (seat, skill, difficulty, resolve) => { tests += 1; resolve({ success: true, value: difficulty + 1 }) },
    moveInvestigator: (seat, id) => { state.investigators[seat].location = id },
  }
  const inv = state.investigators[0]
  inv.location = rooftop
  chapter.behavior.locationEntered(state, inv, locationOf(state, rooftop), stub)
  assert.equal(tests, 1, '进入屋顶通道后提出敏捷检定')
  // 敌人移动到屋顶通道：再次结算猎手（每轮一次）
  cultist.hunter = true
  cultist.location = (locationOf(state, rooftop).connections[0]) || rooftop
  let hunter = 0
  const stub2 = { ...api, resolveHunterMove: () => { hunter += 1 } }
  state.round = 1
  cultist.location = rooftop
  chapter.behavior.enemyMoved(state, cultist, null, stub2)
  assert.equal(hunter, 1)
  chapter.behavior.enemyMoved(state, cultist, null, stub2)
  assert.equal(hunter, 1, '同一轮同一敌人只再次结算一次')
})

test('P7 dealingsInTheDark 结局链：R1→R3→R4 记录艾婕信任，R3→R5 记录不信任，R6 记录红手套男子', () => {
  const state = buildState(2)
  const { api } = setup(state)
  // 与艾婕合作：R1 → R3 → R4
  const r1 = chapter.behavior.resolution(state, 'resolution1', [], api)
  assert.equal(r1.award, true)
  assert.equal(state.campaign.records.eceTrustsTheCell, true)
  assert.equal(state.campaign.records.twistedAntiprismBearer, 'eceSahin')
  assert.equal(state.campaign.records.time, 3, '结局 4 记录 3 点时间')
  // 欺骗艾婕：R1 → R3 → R5
  const liar = buildState(2)
  setup(liar, { intro: 'giveToEceLying' })
  const liarApi = scenarioRuntime(liar, [])
  chapter.behavior.resolution(liar, 'resolution1', [], { ...liarApi, choose: spec => spec.options[0].id })
  assert.equal(liar.campaign.records.eceDoesNotTrustTheCell, true)
  assert.equal(liar.campaign.records.twistedAntiprismBearer, 'investigator:0')
  assert.equal(liar.campaign.records.time, 3)
  // 拒绝艾婕：R1 → R2
  const refuser = buildState(2)
  setup(refuser, { intro: 'takeForOurselves' })
  const refuserApi = scenarioRuntime(refuser, [])
  chapter.behavior.resolution(refuser, 'resolution1', [], { ...refuserApi, choose: spec => spec.options[0].id })
  assert.equal(refuser.campaign.records.time, 2, '结局 2 记录 2 点时间')
  // R6
  const chased = buildState(2)
  const chasedApi = scenarioRuntime(chased, [])
  chapter.behavior.resolution(chased, 'resolution6', [], chasedApi)
  assert.equal(chased.campaign.records.twistedAntiprismBearer, 'redGlovedMan')
  assert.equal(chased.campaign.records.youHaventSeenTheLastOfTheRedGlovedMan, true)
  assert.equal(chased.campaign.records.time, 2)
})

test('P7 dealingsInTheDark 密钥变换：稳定面抽牌洗回、动荡面放毁灭、敌人变换不翻面、艾婕底下抽回', () => {
  const state = buildState(2)
  const { api } = setup(state)
  const inv = state.investigators[0]
  state.campaign.tsk.keys.keys[KEY_ID].bearer = { type: 'investigator', seat: inv.seat }
  state.scenarioFlags.twistedAntiprismBearer = { type: 'investigator', seat: inv.seat }
  let looked = 0
  const stub = { ...api, lookAt: (seat, options) => { looked += 1; assert.equal(options.count, 3) } }
  const stable = chapter.behavior.events.dealingsShiftKey(state, { by: 'investigator' }, stub)
  assert.equal(looked, 1, '稳定面：查看牌库顶 3 张')
  assert.equal(stable.flipped, true)
  assert.equal(state.campaign.tsk.keys.keys[KEY_ID].stable, false, '翻至动荡面')
  // 动荡面：最近的调查员把 1 个毁灭放在密谋上（选择第一项）
  const stub2 = { ...api, choose: spec => spec.options[0].id, lookAt: () => {} }
  const doomBefore = Number(state.doom) || 0
  const unstable = chapter.behavior.events.dealingsShiftKey(state, { by: 'investigator' }, stub2)
  assert.equal(unstable.flipped, true)
  assert.equal(state.campaign.tsk.keys.keys[KEY_ID].stable, true, '调查员变换：翻回稳定面')
  assert.equal(Number(state.doom) || 0, doomBefore + 1, '动荡面：在密谋上放 1 毁灭')
  // 敌人变换动荡面：不翻面
  state.campaign.tsk.keys.keys[KEY_ID].stable = false
  state.scenarioFlags.twistedAntiprismFace = CODES.keyUnstable
  const enemyShift = chapter.behavior.events.dealingsShiftKey(state, { by: 'enemy', enemyId: cultistInPlay(state)?.id || null }, stub2)
  assert.equal(enemyShift.flipped, false, '敌人变换动荡面：不翻面')
  // 艾婕底下：钥匙变换后所有者抽回
  state.scenarioFlags.eceBeneath = [{ code: '01025', seat: inv.seat }]
  const moved = []
  const stub3 = { ...api, moveCard: (spec, options) => { moved.push({ spec, options }); return spec.code }, cardName: code => code }
  chapter.behavior.events.dealingsShiftKey(state, { by: 'investigator' }, stub3)
  assert.equal(moved.length, 1, '钥匙变换后抽回艾婕底下的牌')
  assert.equal(moved[0].spec.from, 'setAside')
  assert.equal(moved[0].spec.to, 'hand')
  assert.deepEqual(state.scenarioFlags.eceBeneath, [])
})

test('P7 dealingsInTheDark 条目：艾婕·萨辛的 [free] 行动与全部单卡条目已注册', () => {
  for (const entry of ENTRIES) {
    assert.equal(registeredEntry(entry.code)?.implemented, true, `${entry.code} 已注册且 implemented`)
    assert.ok(chapter.implementedEncounterCodes.includes(entry.code), `${entry.code} 在 implementedEncounterCodes`)
  }
  const state = buildState()
  const { api } = setup(state)
  assert.ok(state.storyAssets.some(asset => codeOf(asset) === CODES.eceSahin))
  const ece = state.storyAssets.find(asset => codeOf(asset) === CODES.eceSahin)
  const inv = state.investigators[0]
  const moved = []
  const stub = {
    ...api,
    // 选调查员时取 0 号；其余选择取最后一项（放下）。
    choice: spec => (spec.kind === 'investigator' ? '0' : spec.options[spec.options.length - 1].id),
    cardName: code => code,
    scenario: api,
    moveCard: spec => { moved.push(spec); return spec.code },
  }
  for (const other of state.investigators) other.deck = ['01025', '01026', '01027']
  entry09584.abilities[0].resolve({ state, inv, api: stub, source: ece })
  assert.equal(moved.length, 1, '艾婕把牌库顶的牌压到自己底下')
  assert.equal(moved[0].from, 'deck')
  assert.equal(moved[0].to, 'setAside')
  assert.deepEqual(state.scenarioFlags.eceBeneath, [{ code: '01027', seat: inv.seat }])
})

test('P7 dealingsInTheDark 幽影预示者/解封条目：受伤放毁灭、攻击持钥者夺取密钥、躲避后夺回', () => {
  const state = buildState(2)
  const { api } = setup(state)
  const cultist = cultistInPlay(state)
  const inv = state.investigators[0]
  const harbinger = {
    id: 'umbral-test', originalCode: CODES.umbralHarbinger, code: CODES.umbralHarbinger,
    name: '幽影预示者', location: inv.location, traits: ['Monster', 'Yuggoth'], doom: 0, clues: 0,
    exhausted: false, health: 5, damageTaken: 0,
  }
  state.enemies.push(harbinger)
  const clueStub = { ...api, scenario: api, info: () => {}, choose: spec => spec.options[0].id }
  assert.equal(entry09585.abilities[0].criteria({ state, source: harbinger, context: { enemy: harbinger } }), true)
  const cluesBefore = Number(cultist.clues) || 0
  entry09585.abilities[0].resolve({ state, source: harbinger, context: { enemy: harbinger }, api: clueStub })
  assert.equal(Number(cultist.clues) || 0, cluesBefore + 1,
    '幽影预示者受伤 → 最近的异教徒获得 1 个线索（彰显把毁灭翻成线索）')
  // 解封：敌人攻击持钥者 → 密钥被夺走（动荡面）并变换
  api.storyAsset(CODES.storyTheUnsealing, null)
  state.campaign.tsk.keys.keys[KEY_ID].bearer = { type: 'investigator', seat: inv.seat }
  state.scenarioFlags.twistedAntiprismBearer = { type: 'investigator', seat: inv.seat }
  const shiftStub = { ...api, scenario: api, info: () => {}, choose: spec => spec.options[0].id, lookAt: () => {} }
  const forced = entry09571b.abilities[0]
  assert.equal(forced.criteria({ state, context: { enemy: cultist, seat: inv.seat } }), true,
    '持钥者被攻击时强制生效')
  forced.resolve({ state, context: { enemy: cultist, seat: inv.seat }, api: shiftStub })
  const key = state.campaign.tsk.keys.keys[KEY_ID]
  assert.equal(key.bearer.type, 'enemy')
  assert.equal(key.bearer.enemyId, cultist.id)
  assert.equal(key.stable, false, '被夺走后为动荡面')
  // 反应：躲避/击败持钥敌人后夺回
  const reaction = entry09571b.abilities[1]
  assert.equal(reaction.criteria({ state, context: { enemy: cultist } }), true)
  reaction.resolve({ state, inv, context: { enemy: cultist, seat: inv.seat }, api: shiftStub })
  assert.equal(key.bearer.type, 'investigator')
  assert.equal(key.bearer.seat, inv.seat)
  assert.equal(key.stable, true, '夺回后回到稳定面')
})

test('P7 dealingsInTheDark 黑暗使徒：躲避异教徒后返回阴影并控制它的 1 个线索', () => {
  const state = buildState(2)
  const { api } = setup(state)
  const culte = cultistInPlay(state)
  const inv = state.investigators[0]
  culte.clues = 2
  inv.clues = 0
  const minisBefore = miniCards(state).filter(card => !card.decoy && card.kind === `enemy${codeOf(culte)}`).length
  chapter.behavior.afterEvade(state, inv, culte, { success: true }, api)
  assert.ok(!state.enemies.includes(culte), '躲避后返回阴影（移出场上）')
  assert.ok((state.setAsideEnemies || []).some(enemy => enemy.id === culte.id), '进入放一边区')
  assert.equal(inv.clues, 1, '控制它的 1 个线索')
  assert.equal(culte.clues, 1, '敌人失去 1 个线索')
  const minisAfter = miniCards(state).filter(card => !card.decoy && card.kind === `enemy${codeOf(culte)}`).length
  assert.equal(minisAfter, minisBefore + 1, '结算隐匿关键词：重新放置真身迷你卡')
  // 密谋不是「黑暗使徒」时不再强制
  state.agendaIndex = 1
  const other = cultistInPlay(state)
  if (other) {
    chapter.behavior.afterEvade(state, inv, other, { success: true }, api)
    assert.ok(state.enemies.includes(other), '其它密谋下不触发')
  }
})

test('P7 dealingsInTheDark JSON 往返：剧本标记/战役记录/密钥/隐匿迷你卡读档校验通过', () => {
  const state = buildState(2)
  const { api } = setup(state)
  chapter.behavior.actReveal(state, state.acts[state.actIndex], api)
  chapter.behavior.actReveal(state, state.acts[1], api)
  chapter.behavior.resolution(state, 'resolution1', [], api)
  const clone = json(state)
  assert.equal(clone.scenario.id, 'dealingsInTheDark')
  assert.equal(clone.agendaIndex, 1)
  assert.ok(clone.campaign.tsk.keys.keys[KEY_ID])
  assert.equal(clone.campaign.records.eceTrustsTheCell, true)
  assert.equal(clone.scenarioFlags.cluesUnveiled, 0)
  assert.doesNotThrow(() => validateTskState(clone))
  // 迷你卡容器：全部迷你卡都在场地点上（放一边的地点已被移除）
  for (const card of clone.scenarioFlags.mechanics?.tsk?.concealed?.miniCards || []) {
    assert.ok(clone.locations.some(location => location.id === card.locationId), `${card.id} 的地点仍在场`)
  }
})

test('P7 dealingsInTheDark story：指南/结局正文可读且不写死', () => {
  const story = chapterStory('dealingsInTheDark')
  assert.ok(story.sections)
  assert.ok((story.sections.specialRules || []).length >= 2, '两条特别规则')
  assert.ok(storyText('dealingsInTheDark', 'setup').length > 100)
  const resolutions = chapter.scenario.resolutions
  assert.deepEqual(Object.keys(resolutions).sort(),
    ['noResolution', 'noResolutionAct3', 'resolution1', 'resolution2', 'resolution3', 'resolution4',
      'resolution5', 'resolution6'])
  assert.match(resolutions.resolution1, /结局1/)
  assert.match(resolutions.resolution6, /结局6/)
  assert.match(resolutions.resolution4, /结局4/)
  assert.match(chapter.scenario.specialRules[0].title, /大巴扎|Grand Bazaar/)
})
