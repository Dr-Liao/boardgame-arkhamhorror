// P7 死亡酷暑（deadHeat · 09520）章节测试。
//
// 覆盖：章节结构/manifest、gather 分区与放一边、绯红密钥配置、地点连接与废弃交换、
// 时间分支的幕/议程牌库、幕/议程推进与背面、敌人/诡计关键行为（阿玛兰斯、拉辛、哈立德、
// 古代劫掠者、奴仆、萨阿德王陵、饥荒、围困！）、平民救援与杀害计数、结局 1–5/无结局记录、
// 混乱标记与 JSON 存档往返。
//
// 本文件不 import engine.js：章节 behavior 只走内容层函数（真实引擎钩子由 P7 主进程合并后
// 用 contentRegistry 注册），因此单测可在并行 worker 尚未重建索引时独立运行。
import test from 'node:test'
import assert from 'node:assert/strict'
import { registerCardAbilities, registeredEntry } from '../src/engine/ability.js'
import * as chapter from '../content/campaigns/theScarletKeys/scenarios/deadHeat/index.js'
import {
  scenario, LOCATIONS, LOCATION_CONNECTIONS, LOCATION_COORDINATES, SITE_IDS, ABANDONED_BY_NORMAL,
  ABANDONED_LOCATION_IDS, ENCOUNTER_DECK, GATHER_GROUPS, GATHER_SET_ASIDE_GROUPS, SET_ASIDE_CARDS,
  ACT_CODES, AGENDA_CODES, ACT_STAGES, AGENDA_STAGES, KEY_SPEC, KEY_CARD_CODES, STORY_CODES,
  AMARANTH_FRONT_CODE, AMARANTH_BACK_CODE, RAZIN_CODE, KHALID_CODE, THRALL_CODE, ANCIENT_RAIDER_CODE,
  FAMINE_CODE, CORNERED_CODE, SAVE_THE_CIVILIANS_CODE, AFTERMATH_CODE, SCENARIO_TEXT,
} from '../content/campaigns/theScarletKeys/scenarios/deadHeat/definition.js'
import {
  deadHeatChaosToken, deadHeatChaosTokenValue, civiliansSlain, perPlayerCiviliansSlain,
  DEAD_HEAT_TOKEN_MEANINGS,
} from '../content/campaigns/theScarletKeys/scenarios/deadHeat/chaos.js'
import entryAmaranth from '../src/cards/encounter-entries/theScarletKeys/deadHeat/09537.js'
import entryAmaranthBack from '../src/cards/encounter-entries/theScarletKeys/deadHeat/09537b.js'
import entryRazin from '../src/cards/encounter-entries/theScarletKeys/deadHeat/09538.js'
import entryThrall from '../src/cards/encounter-entries/theScarletKeys/deadHeat/09539.js'
import entryRaider from '../src/cards/encounter-entries/theScarletKeys/deadHeat/09540.js'
import entryKhalid from '../src/cards/encounter-entries/theScarletKeys/deadHeat/09541.js'
import entryFamine from '../src/cards/encounter-entries/theScarletKeys/deadHeat/09542.js'
import entryCornered from '../src/cards/encounter-entries/theScarletKeys/deadHeat/09543.js'
import entryStory from '../src/cards/encounter-entries/theScarletKeys/deadHeat/09536.js'
import entryAftermath from '../src/cards/encounter-entries/theScarletKeys/deadHeat/09536b.js'
import entryKeyStable from '../src/cards/encounter-entries/theScarletKeys/deadHeat/09544a.js'
import entryKeyUnstable from '../src/cards/encounter-entries/theScarletKeys/deadHeat/09544b.js'

const ENTRIES = [entryAmaranth, entryAmaranthBack, entryRazin, entryThrall, entryRaider, entryKhalid,
  entryFamine, entryCornered, entryStory, entryAftermath, entryKeyStable, entryKeyUnstable]
for (const entry of ENTRIES) if (!registeredEntry(entry.code)) registerCardAbilities([entry])

const clone = value => JSON.parse(JSON.stringify(value))
const stateFor = (investigatorCount = 1, records = {}, flags = {}) => ({
  investigators: Array.from({ length: investigatorCount }, (_, seat) => ({
    seat, name: `调查员${seat + 1}`, location: null, damage: 0, horror: 0, clues: 0, resources: 5,
    assets: [], engaged: [], deck: [], discard: [], threat: [],
  })),
  locations: [], enemies: [], storyAssets: [], encounterDeck: [], encounterDiscard: [],
  scenarioFlags: { ...flags }, scenarioZones: {},
  campaign: { leadSeat: 0, records: { ...records }, completedSteps: [], trauma: {}, investigators: {} },
  victoryDisplay: [], doom: 0, difficulty: 'standard', numInvestigators: investigatorCount,
  phase: 'investigation', round: 1, status: 'playing',
})
const stateWithScenario = (count = 1, records = {}, flags = {}) => {
  const state = stateFor(count, records, flags)
  state.scenario = structuredClone(scenario)
  return state
}
const quietApi = () => ({ info: () => {} })
// 模拟引擎 advanceAct：结算当前幕背面，然后推进指针（actReveal 内 finish 时不推进）。
const engineishApi = () => {
  const api = { info: () => {}, finished: null, trauma: [] }
  api.advanceAct = () => {
    const state = api.state
    const act = state.acts[state.actIndex]
    chapter.behavior.actReveal(state, act, api)
    if (api.finished) return
    state.actIndex += 1
  }
  api.finish = key => { api.finished = key }
  api.addTrauma = (seat, kind, amount) => { api.trauma.push({ seat, kind, amount }) }
  return api
}
const setup = (count = 1, time = 0, api = quietApi()) => {
  const state = stateWithScenario(count, { time })
  const report = chapter.behavior.setupScenario(state, api)
  return { state, report }
}

// ---------------------------------------------------------------------------
// 1. 章节结构、分区、密钥配置
// ---------------------------------------------------------------------------

test('P7 deadHeat 章节结构：28 条卡、5 个 gather 组、5 个废弃地点与 12 个单卡条目', () => {
  assert.equal(chapter.scenario.id, 'deadHeat')
  assert.equal(chapter.scenario.originalCode, '09520')
  assert.equal(chapter.manifest.status, 'playable')
  assert.equal(chapter.manifest.campaignId, 'theScarletKeys')
  assert.deepEqual([...GATHER_GROUPS].sort(),
    ['deadHeat', 'ghouls', 'scarletSorcery', 'spreadingCorruption', 'strikingFear'].sort())
  assert.deepEqual([...GATHER_SET_ASIDE_GROUPS], [], '本章没有整组放一边的遭遇组')
  assert.equal(Object.keys(LOCATIONS).length, 10)
  assert.equal(SITE_IDS.length, 5)
  assert.equal(ABANDONED_LOCATION_IDS.length, 5)
  assert.equal(chapter.implementedEncounterCodes.length, 12)
  assert.deepEqual([...chapter.implementedEncounterCodes].sort(), [
    '09536', '09536b', '09537', '09537b', '09538', '09539', '09540', '09541',
    '09542', '09543', '09544a', '09544b',
  ].sort())
  assert.equal(chapter.implementedEntryFlags('09537').amaranth, true)
  assert.equal(chapter.implementedEntryFlags('09537b').amaranthFace, 'corruptionRevealed')
  assert.equal(chapter.implementedEntryFlags('09542').famine, true)
  assert.equal(chapter.implementedEntryFlags('09543').test.difficulty, 3)
  assert.equal(chapter.implementedEntryFlags(KEY_SPEC.stableFace).keyId, '09544')
  assert.equal(registeredEntry('09542').treacheryRule.discardAtRoundEnd, true)
  assert.equal(SCENARIO_TEXT.intro.length > 0, true)
  assert.equal(SCENARIO_TEXT.specialRules.length, 3)
  assert.ok(SCENARIO_TEXT.specialRules.some(rule => rule.title.includes('平民')))
  assert.equal(SCENARIO_TEXT.setup.length > 0, true)
  assert.equal(Object.keys(chapter.scenario.resolutions).length, 6)
})

test('P7 deadHeat 遭遇牌库与放一边：29 张牌、特殊敌人/钥匙/剧情卡不在牌库', () => {
  assert.equal(ENCOUNTER_DECK.length, 29)
  assert.equal(ENCOUNTER_DECK.filter(code => code === THRALL_CODE).length, 4, '奴仆 ×4')
  assert.equal(ENCOUNTER_DECK.filter(code => code === FAMINE_CODE).length, 2, '饥荒 ×2')
  assert.equal(ENCOUNTER_DECK.filter(code => code === CORNERED_CODE).length, 2, '围困！×2')
  assert.equal(ENCOUNTER_DECK.filter(code => code === '01160').length, 3, '食尸鬼爪牙 ×3')
  assert.equal(ENCOUNTER_DECK.includes('01164'), true)
  assert.equal(ENCOUNTER_DECK.includes('01165'), true)
  assert.equal(ENCOUNTER_DECK.includes('01163'), false, 'Striking Fear 只取子集 01164/01165')
  for (const code of [AMARANTH_FRONT_CODE, AMARANTH_BACK_CODE, RAZIN_CODE, KHALID_CODE, ANCIENT_RAIDER_CODE]) {
    assert.equal(ENCOUNTER_DECK.includes(code), false, `放一边的敌人不进牌库：${code}`)
  }
  assert.equal(SET_ASIDE_CARDS.includes(AMARANTH_FRONT_CODE), true)
  assert.equal(SET_ASIDE_CARDS.filter(code => code === ANCIENT_RAIDER_CODE).length, 2)
  assert.equal(SET_ASIDE_CARDS.includes(KEY_SPEC.stableFace), true)
  assert.equal(SET_ASIDE_CARDS.includes(SAVE_THE_CIVILIANS_CODE), true)
  const setAside = chapter.manifest.zones.setAside
  assert.equal(setAside.find(entry => entry.cardCode === ANCIENT_RAIDER_CODE)?.count, 2)
  assert.equal(setAside.find(entry => entry.cardCode === '09532')?.count, 1, '废弃地点在放一边区域')
})

test('P7 deadHeat 绯红密钥：末绽之花稳定/动荡面与初始持有者', () => {
  const { state } = setup(2)
  assert.equal(KEY_SPEC.id, '09544')
  assert.equal(KEY_SPEC.stableFace, '09544a')
  assert.equal(KEY_SPEC.unstableFace, '09544b')
  assert.deepEqual([...KEY_CARD_CODES], ['09544a', '09544b'])
  const record = chapter.behavior.lastBlossom(state)
  assert.equal(record.id, '09544')
  assert.equal(record.stable, true)
  assert.deepEqual(record.bearer, { type: 'none' })
  // 15+ 时间：阿玛兰斯生成并持有，敌人持有为动荡面。
  const { state: late } = setup(2, 15)
  const amaranth = chapter.behavior.amaranthInPlay(late)
  assert.ok(amaranth)
  const bound = chapter.behavior.lastBlossom(late)
  assert.equal(bound.bearer.type, 'enemy')
  assert.equal(bound.bearer.enemyId, amaranth.id)
  assert.equal(bound.stable, false)
})

// ---------------------------------------------------------------------------
// 2. 地点连接与废弃交换
// ---------------------------------------------------------------------------

test('P7 deadHeat 地点连接：5 个地点 8 条边、双向对称、坐标两行网格', () => {
  assert.deepEqual(LOCATION_CONNECTIONS.saadiansTombs.sort(), ['jemaaElFnaaSquare', 'marrakeshRailwayStation'].sort())
  assert.deepEqual(LOCATION_CONNECTIONS.marrakeshRailwayStation.sort(),
    ['bahiaPalaceGardens', 'jemaaElFnaaSquare', 'saadiansTombs'].sort())
  assert.deepEqual(LOCATION_CONNECTIONS.tanneries.sort(), ['bahiaPalaceGardens', 'jemaaElFnaaSquare'].sort())
  for (const siteId of SITE_IDS) {
    for (const neighbor of LOCATION_CONNECTIONS[siteId]) {
      assert.equal(LOCATION_CONNECTIONS[neighbor].includes(siteId), true, `${siteId} ↔ ${neighbor} 对称`)
    }
  }
  assert.deepEqual(LOCATION_COORDINATES.saadiansTombs, { x: 0, y: 0 })
  assert.deepEqual(LOCATION_COORDINATES.tanneries, { x: 4, y: 2 })
  assert.deepEqual(chapter.layout.locations.saadiansTombs, { x: 0, y: 0 })
  assert.equal(chapter.layout.edges.length, 12)
  const { state } = setup(1)
  assert.equal(state.locations.length, 5)
  assert.equal(state.locations.every(location => location.revealed === true), true, '开局全部揭示')
  assert.equal(chapter.behavior.civiliansAt(state, 'bahiaPalaceGardens'), 2, '1 人局每处 2 名平民')
})

test('P7 deadHeat 地点废弃：平民归零后与放一边的废弃版本交换并重算连接', () => {
  const { state } = setup(1)
  state.investigators[0].location = 'tanneries'
  for (let index = 0; index < 2; index++) chapter.behavior.slayCivilian(state, 'tanneries', quietApi())
  assert.equal(state.locations.some(location => location.id === 'tanneries'), false)
  const abandoned = state.locations.find(location => location.id === 'tanneriesAbandoned')
  assert.ok(abandoned, '鞣革厂换成废弃版本')
  assert.equal(abandoned.revealed, true)
  assert.deepEqual(abandoned.connections.sort(), ['bahiaPalaceGardens', 'jemaaElFnaaSquare'].sort(),
    '连接指向当前在场的相邻地点（普通 id）')
  assert.equal(state.investigators[0].location, 'tanneriesAbandoned', '占位者随交换迁移')
  // 相邻地点再废弃时，连接仍指向当前实例 id。
  state.investigators[0].location = 'bahiaPalaceGardens'
  for (let index = 0; index < 2; index++) chapter.behavior.slayCivilian(state, 'bahiaPalaceGardens', quietApi())
  assert.equal(state.locations.some(location => location.id === 'bahiaPalaceGardensAbandoned'), true)
  assert.equal(abandoned.connections.includes('bahiaPalaceGardensAbandoned'), true)
})

// ---------------------------------------------------------------------------
// 3. 时间分支、幕/议程推进
// ---------------------------------------------------------------------------

test('P7 deadHeat 时间分支：<15 三幕、15–24 从幕 2 开始并放毁灭、25+ 跳结局 5', () => {
  const early = setup(2, 0)
  assert.deepEqual(early.state.acts.map(act => act.stage), ['1a', '2a', '3a'])
  assert.deepEqual(early.state.agendas.map(agenda => agenda.stage), ['1a', '2a'])
  assert.equal(early.state.doom, 0)
  assert.equal(early.state.acts[0].objective.atLocation, 'bahiaPalaceGardens')
  assert.equal(early.state.acts[0].objective.perInvestigator, 2)
  assert.equal(chapter.behavior.roundEndActIndex, 0, '幕 1 只在轮末支付线索')

  const middle = setup(2, 15)
  assert.deepEqual(middle.state.acts.map(act => act.stage), ['2a', '3a'])
  assert.equal(middle.state.doom, 2, '在议程 1 上放置等于玩家人数的毁灭')
  assert.equal(middle.state.enemies.some(enemy => enemy.code === AMARANTH_FRONT_CODE), true)
  assert.equal(middle.state.storyAssets.some(asset => asset.code === SAVE_THE_CIVILIANS_CODE), true)
  assert.equal(middle.state.encounterDeck.includes(KHALID_CODE), true, '哈立德洗入遭遇牌库')

  const late = setup(2, 26)
  assert.equal(late.report.skip, true)
  assert.deepEqual(late.state.scenarioFlags.deadHeatIntro, 'moreThan24')
  const ok = chapter.behavior.skipToResolution5(late.state, engineishApi())
  assert.equal(ok, true)
})

test('P7 deadHeat 幕 1 背面：阿玛兰斯 + 末绽之花 + 拯救平民 + 哈立德', () => {
  const api = quietApi()
  const { state } = setup(2, 0, api)
  const report = chapter.behavior.actReveal(state, state.acts[0], api)
  assert.equal(report, true)
  const amaranth = chapter.behavior.amaranthInPlay(state)
  assert.ok(amaranth)
  assert.equal(amaranth.location, 'bahiaPalaceGardens')
  assert.equal(amaranth.code, AMARANTH_FRONT_CODE)
  assert.equal(chapter.behavior.lastBlossom(state).bearer.enemyId, amaranth.id)
  assert.equal(state.storyAssets.some(asset => asset.code === SAVE_THE_CIVILIANS_CODE), true)
  assert.equal(state.encounterDeck.includes(KHALID_CODE), true)
  assert.equal(state.scenarioZones.setAside.includes(KHALID_CODE), false, '取走放一边的哈立德')
})

test('P7 deadHeat 幕 2：平民杀害计数推进 → 拉辛 + 古代劫掠者；「将击败」→ 阿玛兰斯翻面移走', () => {
  // 平民计数路径
  {
    const api = engineishApi()
    const { state } = setup(2, 0, api)
    api.state = state
    chapter.behavior.actReveal(state, state.acts[0], api)
    state.actIndex = 1
    state.scenarioFlags.deadHeatCiviliansSlain = 8
    assert.equal(chapter.behavior.checkObjectives(state, api), true)
    assert.equal(state.scenarioFlags.deadHeatAct2Reason, 'civilians')
    assert.equal(state.actIndex, 2)
    assert.equal(state.enemies.some(enemy => enemy.code === RAZIN_CODE), true, '拉辛在巴希尔宫花园生成')
    assert.equal(state.encounterDeck.filter(code => code === ANCIENT_RAIDER_CODE).length, 2)
  }
  // 「将击败」路径
  {
    const api = engineishApi()
    const { state } = setup(2, 0, api)
    api.state = state
    chapter.behavior.actReveal(state, state.acts[0], api)
    state.actIndex = 1
    const amaranth = chapter.behavior.amaranthInPlay(state)
    const taken = chapter.behavior.enemyDefeated(state, amaranth, api)
    assert.equal(taken, true, '幕 2 期间不真正击败阿玛兰斯')
    assert.equal(state.scenarioFlags.deadHeatAct2Reason, 'defeat')
    assert.equal(state.actIndex, 2)
    const flipped = chapter.behavior.amaranthInPlay(state)
    assert.equal(flipped.code, AMARANTH_BACK_CODE)
    assert.equal(state.locations.some(location => location.id === flipped.location), true)
    assert.notEqual(flipped.location, 'bahiaPalaceGardens', '移到没有调查员的地点')
    assert.equal(state.encounterDeck.filter(code => code === ANCIENT_RAIDER_CODE).length, 2)
    assert.equal(chapter.behavior.lastBlossom(state).bearer.enemyId, flipped.id, '翻面保留密钥')
  }
})

test('P7 deadHeat 幕 3：阿玛兰斯与拉辛都不在场时推进，并按真名记录进入结局 3/4', () => {
  const api = engineishApi()
  const { state } = setup(2, 0, api)
  api.state = state
  state.acts = [structuredClone(ACT_STAGES[3])]
  state.actIndex = 0
  assert.equal(chapter.behavior.checkAct3Objective(state, api), true)
  assert.equal(api.finished, 'resolution4', '不知道真名 → 结局 4')
  // 知道真名 → 结局 3
  const known = engineishApi()
  const second = setup(2, 0, known)
  known.state = second.state
  second.state.campaign.records.theCellKnowsAmaranthsRealName = true
  second.state.acts = [structuredClone(ACT_STAGES[3])]
  second.state.actIndex = 0
  chapter.behavior.actReveal(second.state, second.state.acts[0], known)
  assert.equal(known.finished, 'resolution3')
})

test('P7 deadHeat 议程 1 背面：按每玩家杀害数生成苏生/食尸鬼并洗回遭遇弃牌堆', () => {
  const { state } = setup(2, 0)
  state.scenarioFlags.deadHeatCiviliansSlain = 4
  state.encounterDeck = [THRALL_CODE, THRALL_CODE]
  state.encounterDiscard = ['01160']
  const api = { info: () => {}, choose: () => 'heal' }
  assert.equal(chapter.behavior.agendaReveal(state, state.agendas[0], api), true)
  assert.equal(state.enemies.filter(enemy => ['09539', '01160'].includes(enemy.code)).length, 2,
    '2 名[per_investigator]被杀 → 生成 2 个[[苏生]]/[[食尸鬼]]')
  assert.equal(state.encounterDiscard.length, 0, '遭遇弃牌堆洗回牌库')
})

test('P7 deadHeat 议程 2 背面：全员 1 点肉体创伤，按拉辛在场与否进入结局 1/2', () => {
  for (const [razin, expected] of [[true, 'resolution1'], [false, 'resolution2']]) {
    const api = engineishApi()
    const { state } = setup(2, 0, api)
    if (razin) chapter.behavior.spawnDeadHeatEnemy(state, RAZIN_CODE, 'bahiaPalaceGardens', api, { unique: true })
    chapter.behavior.agendaReveal(state, state.agendas[1], api)
    assert.equal(api.finished, expected)
    assert.equal(api.trauma.length, 2)
    assert.equal(api.trauma.every(row => row.kind === 'physical' && row.amount === 1), true)
  }
})

// ---------------------------------------------------------------------------
// 4. 敌人 / 诡计关键行为
// ---------------------------------------------------------------------------

test('P7 deadHeat 阿玛兰斯：攻击分配给支援时击败支援并变换末绽之花', () => {
  const api = quietApi()
  api.attack = () => {}
  api.discardAsset = (seat, assetId) => {
    const inv = state.investigators[seat]
    const asset = inv.assets.find(item => item.id === assetId)
    if (!asset) return null
    inv.assets.splice(inv.assets.indexOf(asset), 1)
    inv.discard.push(asset.code)
    return asset.code
  }
  const { state } = setup(2, 15, api)
  const amaranth = chapter.behavior.amaranthInPlay(state)
  state.investigators[0].location = amaranth.location
  state.investigators[0].assets = [{ id: 'asset-1', code: '01001', damage: 0, horror: 0 }]
  chapter.behavior.enemyAttackStarted(state, amaranth, state.investigators[0], api)
  state.investigators[0].assets[0].damage = 1
  const before = chapter.behavior.lastBlossom(state).stable
  chapter.behavior.enemyAttackResolved(state, amaranth, state.investigators[0], api)
  assert.equal(state.investigators[0].assets.length, 0, '伤害分配给支援 → 击败该支援')
  assert.equal(state.investigators[0].discard.includes('01001'), true)
  assert.notEqual(chapter.behavior.lastBlossom(state).stable, before, '阿玛兰斯变换其附属密钥')
})

test('P7 deadHeat 拉辛：密钥变换后横置则重整，否则即时攻击', () => {
  const api = quietApi()
  api.attack = () => { api.attacks = (api.attacks || 0) + 1 }
  const { state } = setup(2, 15, api)
  const razin = chapter.behavior.spawnDeadHeatEnemy(state, RAZIN_CODE, 'bahiaPalaceGardens', api, { unique: true })
  razin.exhausted = true
  razin.engagedSeat = 0
  chapter.behavior.shiftLastBlossom(state, api, { by: 'enemy' })
  assert.equal(razin.exhausted, false, '横置的拉辛被重整')
  state.round = 2
  chapter.behavior.shiftLastBlossom(state, api, { by: 'enemy' })
  assert.equal(api.attacks, 1, '未横置 → 立即攻击交战调查员')
})

test('P7 deadHeat 古代劫掠者攻击后杀害 1 名平民；哈立德入场搬走相邻敌人/平民', () => {
  const api = quietApi()
  const { state } = setup(2, 0, api)
  state.investigators[0].location = 'jemaaElFnaaSquare'
  const raider = chapter.behavior.spawnDeadHeatEnemy(state, ANCIENT_RAIDER_CODE, 'jemaaElFnaaSquare', api)
  const before = chapter.behavior.civiliansAt(state, 'jemaaElFnaaSquare')
  chapter.behavior.enemyAttackResolved(state, raider, state.investigators[0], api)
  assert.equal(chapter.behavior.civiliansAt(state, 'jemaaElFnaaSquare'), before - 1)

  const khalid = chapter.behavior.spawnDeadHeatEnemy(state, KHALID_CODE, 'jemaaElFnaaSquare', api, { unique: true })
  state.enemies.push({ id: 'other-enemy', code: '09539', name: '奴仆', location: 'jemaaElFnaaSquare', traits: ['Risen'] })
  const civilians = chapter.behavior.civiliansAt(state, 'jemaaElFnaaSquare')
  const neighborBefore = LOCATIONS.jemaaElFnaaSquare.connections
    .reduce((sum, id) => sum + chapter.behavior.civiliansAt(state, id), 0)
  chapter.behavior.khalidEnteredPlay(state, khalid, api)
  assert.equal(state.enemies.find(enemy => enemy.id === 'other-enemy').location !== 'jemaaElFnaaSquare', true)
  assert.equal(chapter.behavior.civiliansAt(state, 'jemaaElFnaaSquare'), 0)
  const neighborAfter = LOCATIONS.jemaaElFnaaSquare.connections
    .reduce((sum, id) => sum + chapter.behavior.civiliansAt(state, id), 0)
  assert.equal(neighborAfter, neighborBefore + civilians, '平民被移到相邻地点')
})

test('P7 deadHeat 萨阿德王陵正反面与鞣革厂/巴希尔宫花园废弃规则', () => {
  const api = quietApi()
  const { state } = setup(2, 0, api)
  assert.equal(chapter.behavior.locationShroudModifier(state, state.locations.find(location => location.id === 'saadiansTombs')), 3,
    '王陵上 3 名平民 → +3 帷幕')
  const enemy = chapter.behavior.spawnDeadHeatEnemy(state, THRALL_CODE, 'saadiansTombs', api)
  chapter.behavior.enemySpawned(state, enemy, api)
  assert.equal(enemy.exhausted, true, '非精英敌人进入王陵后横置')
  // 废弃王陵：进入时治愈全部伤害
  for (let index = 0; index < 3; index++) chapter.behavior.slayCivilian(state, 'saadiansTombs', api)
  assert.equal(state.locations.some(location => location.id === 'saadiansTombsAbandoned'), true)
  const healed = chapter.behavior.spawnDeadHeatEnemy(state, THRALL_CODE, 'saadiansTombsAbandoned', api)
  healed.damageTaken = 2
  chapter.behavior.enemySpawned(state, healed, api)
  assert.equal(healed.damageTaken, 0, '废弃王陵治愈全部伤害')
  // 鞣革厂废弃：此处的苏生敌人 +1 战斗/躲避
  const risen = chapter.behavior.spawnDeadHeatEnemy(state, THRALL_CODE, 'tanneries', api)
  assert.equal(chapter.behavior.enemyStatModifier(state, risen, 'fight'), 0)
  state.locations = state.locations.filter(location => location.id !== 'tanneries')
  state.locations.push({ ...structuredClone(LOCATIONS.tanneriesAbandoned), id: 'tanneriesAbandoned', revealed: true })
  risen.location = 'tanneriesAbandoned'
  assert.equal(chapter.behavior.enemyStatModifier(state, risen, 'fight'), 1)
  assert.equal(chapter.behavior.enemyStatModifier(state, risen, 'evade'), 1)
  // 巴希尔宫花园废弃：回合结束 1 伤害或 1 恐惧
  state.investigators[0].location = 'bahiaPalaceGardensAbandoned'
  const damageBefore = state.investigators[0].damage
  chapter.behavior.turnEnded(state, state.investigators[0], { ...api, choose: () => 'damage' })
  assert.equal(state.investigators[0].damage, damageBefore + 1)
})

test('P7 deadHeat 奴仆：每轮第一张获得涌动；快速躲避失败时警戒攻击', () => {
  const { state } = setup(2, 0)
  assert.equal(chapter.behavior.encounterGainsSurge(state, THRALL_CODE), true)
  assert.equal(chapter.behavior.encounterGainsSurge(state, THRALL_CODE), false, '同一轮第二张没有涌动')
  state.round = 2
  assert.equal(chapter.behavior.encounterGainsSurge(state, THRALL_CODE), true)
  assert.equal(chapter.behavior.encounterGainsSurge(state, '09542'), false)

  const api = quietApi()
  api.attack = () => { api.attacked = true }
  const inv = state.investigators[0]
  const thrall = chapter.behavior.spawnDeadHeatEnemy(state, THRALL_CODE, inv.location, api, { engagedSeat: 0 })
  const move = chapter.behavior.actions(state, inv).find(item => item.rule === `deadHeatThrallEvade:${thrall.id}`)
  assert.ok(move, '奴仆的快速躲避行动存在')
  api.test = (seat, skill, difficulty, resolve) => resolve({ success: false, difficulty, value: difficulty - 1 })
  chapter.behavior.performAction(state, inv, move, api)
  assert.equal(api.attacked, true, '躲避失败 → 奴仆攻击')
  assert.equal(chapter.behavior.actions(state, inv).some(item => item.rule === `deadHeatThrallEvade:${thrall.id}`), false,
    '每回合一次')
})

test('P7 deadHeat 饥荒：放在议程旁 +1 费用，轮末弃置并恢复；围困！失败二选一', () => {
  const api = quietApi()
  const { state } = setup(2, 0, api)
  // 条目 encounterResolve → api.resolveScenarioEvent → behavior.events（与引擎读点同一条桥）。
  const bridge = extra => ({
    ...extra,
    resolveScenarioEvent: (id, payload) => chapter.behavior.events[id](state, payload, { ...api, ...extra }),
  })
  assert.equal(entryFamine.encounterResolve(state, state.investigators[0], {}, bridge({})), true)
  assert.equal(state.agendaAside.length, 1)
  assert.equal(state.locations.every(location => location.playCostIncrease === 1), true)
  chapter.behavior.roundEnded(state, api)
  assert.equal(state.agendaAside.length, 0)
  assert.equal(state.locations.every(location => !location.playCostIncrease), true)
  assert.equal(state.encounterDiscard.includes(FAMINE_CODE), true)

  const inv = state.investigators[0]
  inv.location = 'jemaaElFnaaSquare'
  const civilians = chapter.behavior.civiliansAt(state, inv.location)
  const corneredApi = bridge({
    test: (seat, skill, difficulty, resolve) => resolve({ success: false, difficulty, value: 1 }),
    choose: () => 'slain',
  })
  assert.equal(entryCornered.encounterResolve(state, inv, {}, corneredApi), false)
  assert.equal(chapter.behavior.civiliansAt(state, inv.location), civilians - 1, '选择平民被杀害')

  const damageApi = bridge({
    test: (seat, skill, difficulty, resolve) => resolve({ success: false, difficulty, value: 1 }),
    choose: () => 'damage',
    damage: (seat, amount) => { state.investigators[seat].damage += amount; damageApi.amount = amount },
  })
  entryCornered.encounterResolve(state, inv, {}, damageApi)
  assert.equal(damageApi.amount, 2, '失败 2 点 → 承受 2 点伤害')
})

// ---------------------------------------------------------------------------
// 5. 平民救援、杀害计数与地点行动
// ---------------------------------------------------------------------------

test('P7 deadHeat 平民：每处 N+1、时间 11–17 预杀害 N、18–24 预杀害 2N', () => {
  const early = setup(2, 0)
  assert.equal(early.state.locations.every(location => location.resources === 3), true)
  assert.equal(civiliansSlain(early.state), 0)
  const middle = setup(2, 12)
  assert.equal(civiliansSlain(middle.state), 2, '1[per_investigator] × 2 人')
  const late = setup(2, 20)
  assert.equal(civiliansSlain(late.state), 4, '2[per_investigator] × 2 人')
  assert.deepEqual(late.state.locations.map(location => location.resources).sort(), [2, 2, 2, 2, 3],
    '尽可能均匀地分配预杀害平民')
})

test('P7 deadHeat 拯救平民：需要剧情卡与线索，计入获救；巴希尔宫花园治愈', () => {
  const api = quietApi()
  const { state } = setup(2, 0, api)
  state.investigators[0].location = 'bahiaPalaceGardens'
  state.investigators[0].clues = 1
  state.investigators[0].damage = 2
  assert.equal(chapter.behavior.actions(state, state.investigators[0])
    .some(move => move.rule === 'deadHeatRescueCivilian'), false, '剧情卡未入场时没有拯救行动')
  chapter.behavior.actReveal(state, state.acts[0], api)
  const move = chapter.behavior.actions(state, state.investigators[0])
    .find(item => item.rule === 'deadHeatRescueCivilian')
  assert.ok(move)
  api.choose = () => 'damage'
  assert.equal(chapter.behavior.performAction(state, state.investigators[0], move, api), true)
  assert.equal(state.investigators[0].clues, 0)
  assert.equal(state.investigators[0].damage, 1, '巴希尔宫花园：救出后治愈 1 点伤害')
  assert.equal(state.scenarioFlags.deadHeatRescued, 1)
  assert.equal(chapter.behavior.civiliansAt(state, 'bahiaPalaceGardens'), 2)
})

test('P7 deadHeat 地点行动：火车站快速移动（团队每回合一次）与废弃地点的离开费用', () => {
  const api = quietApi()
  const { state } = setup(2, 0, api)
  const inv = state.investigators[0]
  const move = chapter.behavior.actions(state, inv).find(item => item.rule === 'deadHeatStationMove')
  assert.ok(move)
  assert.equal(chapter.behavior.performAction(state, inv, move, api), true)
  assert.notEqual(inv.location, 'marrakeshRailwayStation')
  assert.equal(chapter.behavior.actions(state, state.investigators[1])
    .some(item => item.rule === 'deadHeatStationMove' && !item.reason), false, '团队本回合已使用')
  // 废弃火车站：离开需要 1 资源
  state.locations = state.locations.filter(location => location.id !== 'marrakeshRailwayStation')
  state.locations.push({ ...structuredClone(LOCATIONS.marrakeshRailwayStationAbandoned), id: 'marrakeshRailwayStationAbandoned', revealed: true })
  state.investigators[0].location = 'marrakeshRailwayStationAbandoned'
  state.investigators[0].resources = 0
  assert.equal(chapter.behavior.moveError(state, state.investigators[0], null, 'jemaaElFnaaSquare'),
    '离开废弃的马拉喀什火车站需要支付 1 资源')
  state.investigators[0].resources = 2
  assert.equal(chapter.behavior.beforeMove(state, state.investigators[0], { id: 'jemaaElFnaaSquare' }, api, { reason: 'move' }), true)
  assert.equal(state.investigators[0].resources, 1, '离开支付 1 资源')
})

// ---------------------------------------------------------------------------
// 6. 混乱标记
// ---------------------------------------------------------------------------

test('P7 deadHeat 混乱标记：[skull] 按每玩家杀害数、其余符号的失败追加效果', () => {
  const { state } = setup(2, 12)
  assert.equal(civiliansSlain(state), 2)
  assert.equal(perPlayerCiviliansSlain(state), 1)
  state.difficulty = 'standard'
  assert.equal(deadHeatChaosTokenValue(state, 'skull'), -1)
  state.difficulty = 'hard'
  assert.equal(deadHeatChaosTokenValue(state, 'skull'), -2)
  state.scenarioFlags.deadHeatCiviliansSlain = 5
  state.difficulty = 'standard'
  assert.equal(perPlayerCiviliansSlain(state), 2, '向下取整')
  assert.equal(deadHeatChaosTokenValue(state, 'skull'), -2)
  assert.equal(deadHeatChaosTokenValue(state, 'cultist'), -4)
  assert.equal(deadHeatChaosTokenValue(state, 'tablet'), -1)
  assert.equal(deadHeatChaosTokenValue(state, 'elderthing'), -3)
  assert.equal(deadHeatChaosTokenValue(state, 'frost'), null, '未知标记交回引擎默认表')
  state.difficulty = 'expert'
  assert.equal(deadHeatChaosTokenValue(state, 'cultist'), -6)
  assert.equal(deadHeatChaosTokenValue(state, 'tablet'), -2)
  assert.equal(deadHeatChaosTokenValue(state, 'elderthing'), -4)
  const faces = deadHeatChaosToken(state, state.investigators[0], 'tablet')
  assert.deepEqual(faces.onDraw, [{ type: 'scenarioToken', token: 'tablet', mode: 'hard' }])
  const standard = deadHeatChaosToken({ ...state, difficulty: 'standard' }, state.investigators[0], 'cultist')
  assert.deepEqual(standard.onFail, [{ type: 'scenarioToken', token: 'cultist', mode: 'fail' }])
  assert.equal(DEAD_HEAT_TOKEN_MEANINGS.standard.cultist.delta, -4)
})

test('P7 deadHeat 混乱标记追加效果：cultist 重整并攻击、tablet 伤害/平民、elder_thing 弃牌', () => {
  const api = quietApi()
  const { state } = setup(2, 0, api)
  const inv = state.investigators[0]
  inv.location = 'jemaaElFnaaSquare'
  const enemy = chapter.behavior.spawnDeadHeatEnemy(state, THRALL_CODE, 'jemaaElFnaaSquare', api)
  enemy.exhausted = true
  api.attack = (target, targetInv) => { api.attackPair = [target.id, targetInv.seat] }
  chapter.behavior.applyTokenEffect(state, inv, { token: 'cultist', mode: 'fail' }, api)
  assert.equal(enemy.exhausted, false, '[cultist] 重整敌人')
  assert.deepEqual(api.attackPair, [enemy.id, 0])
  const civilians = chapter.behavior.civiliansAt(state, 'jemaaElFnaaSquare')
  api.damage = (seat, amount) => { state.investigators[seat].damage += amount }
  api.choose = () => 'slain'
  chapter.behavior.applyTokenEffect(state, inv, { token: 'tablet', mode: 'easy' }, api)
  assert.equal(chapter.behavior.civiliansAt(state, 'jemaaElFnaaSquare'), civilians - 1)
  api.choose = () => 'damage'
  chapter.behavior.applyTokenEffect(state, inv, { token: 'tablet', mode: 'easy' }, api)
  assert.equal(inv.damage, 1)
  inv.hand = ['01001', '01002']
  api.choose = () => '1'
  chapter.behavior.applyTokenEffect(state, inv, { token: 'elderthing', mode: 'choose' }, api)
  assert.equal(inv.hand.length, 1)
  assert.equal(inv.discard.includes('01002'), true)
})

// ---------------------------------------------------------------------------
// 7. 结局可达与 JSON 往返
// ---------------------------------------------------------------------------

test('P7 deadHeat 结局 1–5：剧本日志、密钥归属、时间与创伤', () => {
  const expectations = [
    ['resolution1', { record: 'theLoversAreReunited', time: 1, bearer: 'amaranth' }],
    ['resolution2', { record: 'youHaventSeenTheLastOfAmaranth', time: 1, bearer: 'amaranth' }],
    ['resolution3', { record: 'amaranthHasLeftTheCoterie', time: 2, bearer: 0 }],
    ['resolution4', { record: 'youHaventSeenTheLastOfAmaranth', time: 1, bearer: 0 }],
    ['resolution5', { record: 'youHaventSeenTheLastOfAmaranth', time: 1, bearer: 'amaranth', bonus: 3 }],
  ]
  for (const [key, expected] of expectations) {
    const api = engineishApi()
    const { state } = setup(2, 3, api)
    const result = chapter.behavior.resolution(state, key, [], api)
    const records = state.campaign.records
    assert.equal(records.deadHeatResolution, key)
    assert.equal(records[expected.record], true)
    assert.equal(records.time, 3 + expected.time)
    assert.equal(records.theLastBlossomBearer, expected.bearer)
    assert.equal(records.deadHeatTimes, 1)
    assert.ok(Object.hasOwn(records, 'deadHeatCiviliansRescued'))
    assert.ok(Object.hasOwn(records, 'deadHeatCiviliansSlain'))
    if (key === 'resolution5') {
      assert.equal(result.bonus, 3)
      assert.equal(api.trauma.every(row => row.kind === 'mental' && row.amount === 1), true)
      assert.equal(api.trauma.length, 2)
    } else {
      assert.equal(result.bonus, 0)
    }
    if (key === 'resolution1' || key === 'resolution2') {
      assert.equal(chapter.behavior.lastBlossom(state).bearer.type, 'none')
    } else if (expected.bearer === 0) {
      assert.deepEqual(chapter.behavior.lastBlossom(state).bearer, { type: 'investigator', seat: 0 })
    }
  }
})

test('P7 deadHeat 后果：获救 > 被杀 +2/+4 经验，被杀 > 获救 1/2 点精神创伤', () => {
  {
    const api = engineishApi()
    const { state } = setup(2, 0, api)
    state.scenarioFlags.deadHeatCiviliansSlain = 2
    chapter.behavior.actReveal(state, state.acts[0], api)
    state.storyAssets.find(asset => asset.code === SAVE_THE_CIVILIANS_CODE).tokens = 5
    state.scenarioFlags.deadHeatRescued = 5
    const result = chapter.behavior.resolution(state, 'resolution3', [], api)
    assert.equal(result.bonus, 4, '5 > 2×2 → 2 + 2 点奖励经验')
    assert.equal(api.trauma.length, 0)
  }
  {
    const api = engineishApi()
    const { state } = setup(2, 0, api)
    state.scenarioFlags.deadHeatCiviliansSlain = 10
    state.scenarioFlags.deadHeatRescued = 2
    chapter.behavior.resolution(state, 'resolution1', [], api)
    assert.equal(state.campaign.records.deadHeatCiviliansSlain, 10)
    assert.equal(api.trauma.length, 2)
    assert.equal(api.trauma.every(row => row.amount === 2), true, '被杀 > 2×获救 → 每位调查员 2 点精神创伤')
  }
})

test('P7 deadHeat 无结局：场上平民全部被杀害，幕 1 时翻出「后果」并进入结局 1/2', () => {
  const api = engineishApi()
  const { state } = setup(2, 0, api)
  state.investigators[0].location = 'jemaaElFnaaSquare'
  chapter.behavior.slayCivilian(state, 'jemaaElFnaaSquare', api)
  const result = chapter.behavior.resolution(state, 'noResolution', [], api)
  assert.equal(result.award, true)
  assert.equal(state.campaign.records.deadHeatResolution, 'resolution2')
  assert.equal(state.campaign.records.deadHeatCiviliansSlain, 15, '5 地点 × 3 平民全部被杀')
  assert.equal(state.campaign.records.deadHeatCiviliansRescued, 0)
  assert.equal(state.storyAssets.some(asset => asset.code === AFTERMATH_CODE), true, '剧情卡翻到后果面')
  assert.equal(state.storyAssets.some(asset => asset.code === SAVE_THE_CIVILIANS_CODE), false)
})

test('P7 deadHeat JSON 往返：存储后继续推进幕与结局', () => {
  const api = engineishApi()
  const { state } = setup(2, 12, api)
  state.locationAbilityTeamUsed = {}
  chapter.behavior.actReveal(state, state.acts[0], api)
  const restored = clone(state)
  assert.equal(restored.scenario.id, 'deadHeat')
  assert.equal(chapter.behavior.lastBlossom(restored).bearer.type, 'enemy')
  assert.equal(chapter.behavior.civiliansAt(restored, 'bahiaPalaceGardens'), 3)
  restored.actIndex = 1
  restored.scenarioFlags.deadHeatCiviliansSlain = 8
  const restoreApi = engineishApi()
  restoreApi.state = restored
  chapter.behavior.checkObjectives(restored, restoreApi)
  assert.equal(restored.actIndex, 2)
  assert.equal(restored.enemies.some(enemy => enemy.code === RAZIN_CODE), true)
  const again = clone(restored)
  assert.equal(again.enemies.some(enemy => enemy.code === RAZIN_CODE), true)
  const resolutionApi = engineishApi()
  chapter.behavior.resolution(again, 'resolution1', [], resolutionApi)
  assert.equal(again.campaign.records.theLoversAreReunited, true)
  assert.equal(typeof again.campaign.records.time, 'number')
})
