// 古老者之城（cityOfTheElderThings · 08621）章节测试（P7）。
//
// 三层证据：
//   1. 章节钩子（behavior）—— 16 张城市景观按版本上网格（eote-city/grid-map 原语）、16 把钥匙
//      （scenario-keys 数值钥匙）、议程自由行动、幕的钥匙研究/追踪目标、代表遭遇卡、混乱标记、
//      结局记录、JSON 存档往返；
//   2. 真实引擎路径（生产组合根 tests/eote-p8-fixture.mjs）—— setup→legalMoves→applyMove，
//      覆盖 P0-12（地点剧本行动不再抛 options.resolve is not a function）、P0-6（钥匙入口 /
//      幕 1 目标可达 / 议程 2 背面 R2）、P0-8（共享组并入遭遇牌库、专属诡计真实结算）；
//   3. 正文结构 —— story-text 生成物的章节正文可读（不锁具体译文）。
import test from 'node:test'
import assert from 'node:assert/strict'
import { registerCardAbilities, registeredEntry } from '../src/engine/ability.js'
import { chapterStory, storyText, resolutionText } from '../content/campaigns/edgeOfTheEarth/story-access.js'
import * as chapter from '../content/campaigns/edgeOfTheEarth/scenarios/cityOfTheElderThings/index.js'
import {
  scenario as definition, LOCATIONS, CITY_LOCATION_IDS, HIDDEN_TUNNEL, RAW_CODES,
  CITY_KEY_VALUES, START_LOCATION_BY_VERSION, REMOVED_BY_VERSION, TREACHERY_CODES,
  ENCOUNTER_DECK_BY_VERSION,
} from '../content/campaigns/edgeOfTheEarth/scenarios/cityOfTheElderThings/definition.js'
import {
  CITY_OF_THE_ELDER_THINGS_TOKEN_MEANINGS, cityOfTheElderThingsAfterTest,
  cityOfTheElderThingsChaosToken,
} from '../content/campaigns/edgeOfTheEarth/scenarios/cityOfTheElderThings/chaos.js'
import { loadEoteWorld, createHubGame, hubSetup, finishScenario, continueFromResult, beginChapter,
  legalFor, decisionSeat, playMove, transact, settleChoices } from './eote-p8-fixture.mjs'
import { valueKeysAt, spendValueKeys } from '../src/engine/scenario-keys.js'
import { cityscapes as readCityscapes } from '../src/engine/eote-city.js'
import { cityscapeOf } from '../src/engine/grid-map.js'

const ENTRIES = []
for (const code of chapter.behavior.implementedEncounterCodes) {
  const module = await import(`../src/cards/encounter-entries/edgeOfTheEarth/cityOfTheElderThings/${code}.js`)
  ENTRIES.push(module.default)
}
for (const entry of ENTRIES) if (!registeredEntry(entry.code)) registerCardAbilities(entry)

const clone = value => structuredClone(value)
const info = () => {}

function stateFor(count = 2) {
  return {
    scenario: clone(definition),
    acts: clone(definition.acts),
    agendas: clone(definition.agendas),
    actIndex: 0,
    agendaIndex: 0,
    numInvestigators: count,
    difficulty: 'standard',
    round: 1,
    currentSeat: 0,
    doom: 0,
    locations: [],
    investigators: Array.from({ length: count }, (_, seat) => ({
      seat, code: '01001', name: `调查员${seat + 1}`, location: START_LOCATION_BY_VERSION.v1, klass: 'seeker', traits: [],
      damage: 0, horror: 0, clues: 0, resources: 5, hand: [], assets: [], threat: [], engaged: [],
      deck: ['01001', '01002'], discard: [], actionsLeft: 3, trauma: { physical: 0, mental: 0 },
    })),
    enemies: [], storyAssets: [], encounterDeck: [...definition.encounterDeck],
    scenarioZones: {}, scenarioFlags: {}, chaosBag: ['0', 'frost', 'tablet'],
    campaign: { records: {}, investigators: Array.from({ length: count }, () => ({ trauma: { physical: 0, mental: 0 }, deck: [] })) },
    victoryDisplay: [], testResults: [], testCalls: [], choices: [], finished: null, infos: [], tokenBags: {},
  }
}

function apiStub(state, overrides = {}) {
  return {
    info: text => state.infos.push(String(text)),
    // 引擎签名：test(seat, skill, difficulty, resolve, skillBonus?, source?, options?)。
    test: (seat, skill, difficulty, resolve = null, skillBonus = 0, source = null) => {
      state.testCalls.push({ seat, skill, difficulty, skillBonus, source })
      const result = state.testResults.shift() || { success: true, value: difficulty + 1, difficulty }
      if (typeof resolve === 'function') resolve(result)
      return result
    },
    choice: options => state.choices.shift() ?? options?.options?.[0]?.id ?? null,
    choose: options => apiStub(state).choice(options),
    finish: key => { state.finished = key },
    resign: seat => { state.investigators[seat].resigned = true },
    takeFromSetAside: code => {
      const pile = state.scenarioZones?.setAside
      if (!Array.isArray(pile)) return false
      const index = pile.indexOf(code)
      if (index < 0) return false
      pile.splice(index, 1)
      return true
    },
    shuffleIntoEncounterDeck: codes => {
      state.encounterDeck.push(...(Array.isArray(codes) ? codes : [codes]))
      return state.encounterDeck.length
    },
    reveal: locationId => {
      const location = state.locations.find(item => item.id === locationId)
      if (location && !location.revealed) {
        location.revealed = true
        location.clues = location.maxClues || 0
      }
    },
    spawn: (code, locationId) => {
      state.enemies.push({ id: `enemy-${state.enemies.length + 1}`, code, originalCode: code, location: locationId, exhausted: true, defeated: false })
      return state.enemies.at(-1)
    },
    shuffleDiscard: () => {}, cardReveal: () => {},
    harm: (seat, amount = {}) => {
      const inv = state.investigators[seat]
      inv.damage += amount.damage || 0
      inv.horror += amount.horror || 0
    },
    damageEnemy: (enemy, amount = 1) => { if (enemy) enemy.damageTaken = (enemy.damageTaken || 0) + amount },
    gainResources: (seat, amount) => { state.investigators[seat].resources += amount },
    drawCards: (seat, amount = 1) => {
      const inv = state.investigators[seat]
      for (let i = 0; i < amount; i += 1) { const card = inv.deck.pop(); if (card) inv.hand.push(card) }
    },
    drawEncounter: () => {},
    addChaosToken: token => state.chaosBag.push(token),
    spendUses: (source, amount = 1) => { source.uses = Math.max(0, (source.uses || 0) - amount) },
    threat: (seat, code) => {
      const inv = state.investigators[seat]
      inv.threat ||= []
      const existing = inv.threat.find(item => item.code === code)
      if (existing) existing.counters = (existing.counters || 0) + 1
      else inv.threat.push({ id: `threat-${code}`, code, originalCode: code, counters: 1 })
    },
    addLocationTrait: () => {}, removeLocationTrait: () => {},
    ...overrides,
  }
}
const setup = state => {
  chapter.behavior.setupLocations(state, [], { info })
  // 引擎建局顺序：地点/敌人 → setupScenarioDecks（behavior.modifyDeck 按版本收窄遭遇牌库）。
  const modified = chapter.behavior.modifyDeck?.(state, state.encounterDeck, [], { info })
  if (Array.isArray(modified)) state.encounterDeck = modified
  return state
}

// ---------------------------------------------------------------------------
// 1. manifest / 结构 / 正文
// ---------------------------------------------------------------------------
test('P7 cityOfTheElderThings 章节清单：development、17 地点/两幕两密谋/正文可读', () => {
  assert.equal(chapter.manifest.id, 'cityOfTheElderThings')
  assert.equal(chapter.manifest.campaignId, 'edgeOfTheEarth')
  assert.equal(chapter.manifest.status, 'playable')
  assert.equal(chapter.manifest.referenceCode, '08621')
  assert.equal(chapter.manifest.locations.length, 17)
  assert.deepEqual(chapter.manifest.acts.map(act => act.id), ['act1', 'act2'])
  assert.deepEqual(chapter.manifest.agendas.map(agenda => agenda.id), ['agenda1', 'agenda2'])
  assert.deepEqual(chapter.manifest.resolutionIds, ['noResolution', 'resolution1', 'resolution2'])
  const story = chapterStory('cityOfTheElderThings')
  assert.ok(story.sectionCount > 0)
  assert.equal(chapter.scenario.sectionCount, story.sectionCount)
  assert.ok(storyText('cityOfTheElderThings', 'setup').length > 20)
  assert.ok(resolutionText('cityOfTheElderThings', 'resolution1').length > 0)
})

// ---------------------------------------------------------------------------
// 2. 城市地图：16 城市景观上网格（行列/相邻连接）+ 隐秘隧道孤立
// ---------------------------------------------------------------------------
test('P7 cityOfTheElderThings setup：16 城市景观按版本上网格、相邻连接、隐秘隧道孤立', () => {
  const state = setup(stateFor(2))
  const cells = readCityscapes(state)
  assert.equal(cells.length, 16, '16 张城市景观全部上格')
  assert.equal(new Set(cells.map(cell => cell.locationId)).size, 16, '每个地点只用一次')
  assert.deepEqual(chapter.behavior.mapRows(state), [0, 1, 2, 3, 4])
  assert.deepEqual(chapter.behavior.mapColumns(state), [0, 1, 2, 3, 4])
  const bridge = state.locations.find(item => item.id === START_LOCATION_BY_VERSION.v1)
  assert.ok((bridge.connections || []).length > 0, '城市景观按相邻格连接')
  assert.equal(cityscapeOf(state, HIDDEN_TUNNEL), null, '隐秘隧道不在地图格上')
  assert.equal(chapter.behavior.moveError(state, state.investigators[0], HIDDEN_TUNNEL), '隐秘隧道尚未揭示，不能进入')
  state.scenarioFlags.hiddenTunnelRevealed = true
  assert.equal(chapter.behavior.moveError(state, state.investigators[0], HIDDEN_TUNNEL), null)
  // 放一边/移出游戏：v1 移出和蔼的古老者（整组全部印刷份数），星之恐怖放一边。
  assert.deepEqual(REMOVED_BY_VERSION.v1, [RAW_CODES.benignElderThing])
  assert.ok(REMOVED_BY_VERSION.v2.includes(RAW_CODES.terrorOfTheStars), 'v2 移出星之恐怖')
  assert.ok(REMOVED_BY_VERSION.v3.includes(RAW_CODES.reawakenedElderThing), 'v3 移出复苏的古老者')
  // setup 后地点实例必须是可揭示的真实地点：起始地点已揭示且带线索，其余未揭示、线索 0、有 maxClues。
  const start = state.locations.find(item => item.id === START_LOCATION_BY_VERSION.v1)
  assert.equal(start.revealed, true, '起始地点在 setup 阶段揭示')
  assert.equal(start.clues, start.maxClues, '起始地点线索 = 印刷值 × 人数')
  assert.ok(Number.isFinite(start.shroud), '地点带印刷帷幕（调查难度不能是 NaN）')
  assert.ok(Number.isFinite(start.maxClues) && start.maxClues > 0, '地点带 maxClues（揭示后恢复线索）')
  const unrevealed = state.locations.filter(item => item.id !== HIDDEN_TUNNEL && item.id !== start.id)
  assert.equal(unrevealed.length, 15)
  assert.ok(unrevealed.every(item => item.revealed === false && (item.clues || 0) === 0 && item.maxClues > 0),
    '其余城市景观未揭示、0 线索、有 maxClues')
  assert.ok(Number.isFinite(state.locations.find(item => item.id === HIDDEN_TUNNEL)?.maxClues),
    '隐秘隧道有 maxClues')
})

// ---------------------------------------------------------------------------
// 3. 钥匙：16 把数值钥匙随机放在城市景观上；快速取得 / 行动交出（行为派发层）
// ---------------------------------------------------------------------------
test('P7 cityOfTheElderThings 钥匙：16 把（skull×2…）×2、取得与交出', () => {
  const state = setup(stateFor(2))
  const api = apiStub(state)
  const all = CITY_LOCATION_IDS.flatMap(id => valueKeysAt(state, `location:${id}`))
  assert.equal(all.length, 16, '16 把钥匙全部在城市景观上')
  assert.equal(all.filter(key => key.value === 'skull').length, 2)
  assert.equal(all.filter(key => key.value === 'elderthing').length, 2)
  const location = state.locations.find(item => item.id === CITY_LOCATION_IDS[0])
  // 钥匙取得是 [fast] 能力：只有地点无线索时才出现在 actions()。
  state.investigators.forEach(inv => { inv.location = location.id })
  location.clues = 1
  assert.equal(chapter.behavior.actions(state, state.investigators[0], api)
    .some(move => move.rule === 'key:claim'), false, '地点还有线索时不能取得钥匙')
  location.clues = 0
  const claimMove = chapter.behavior.actions(state, state.investigators[0], api)
    .find(move => move.rule === 'key:claim')
  assert.ok(claimMove, '地点无线索时 actions 提供 claim')
  assert.equal(claimMove.actions, 0, '取得钥匙是快速行动（0 行动点）')
  assert.equal(chapter.behavior.performAction(state, state.investigators[0], claimMove, api), true)
  assert.equal(valueKeysAt(state, 'investigator:0').length, 1)
  // 交出钥匙给同地点另一位调查员：actions 提供 give，performAction 经选择事务转交。
  const giveMove = chapter.behavior.actions(state, state.investigators[0], api)
    .find(move => move.rule === 'key:give')
  assert.ok(giveMove, '持有钥匙且同地点有另一位调查员时 actions 提供 give')
  assert.equal(chapter.behavior.performAction(state, state.investigators[0], giveMove, api), true)
  assert.equal(valueKeysAt(state, 'investigator:0').length, 0)
  assert.equal(valueKeysAt(state, 'investigator:1').length, 1)
})

// ---------------------------------------------------------------------------
// 4. 议程自由行动 + 幕 1 钥匙研究目标
// ---------------------------------------------------------------------------
test('P7 cityOfTheElderThings 议程自由行动：花线索查看/移动（每轮一次）', () => {
  const state = setup(stateFor(1))
  const api = apiStub(state)
  const inv = state.investigators[0]
  inv.clues = 4
  const moves = chapter.behavior.actions(state, inv, api)
  assert.ok(moves.some(move => move.rule === 'cityLookRowOrColumn'), '1 线索查看行列')
  assert.ok(moves.some(move => move.rule === 'cityMoveAlongRowOrColumn'), '3 线索移动行列')
  chapter.behavior.performAction(state, inv, { rule: 'cityLookRowOrColumn' }, api)
  assert.equal(state.investigators[0].clues, 3, '查看花费 1 线索')
  assert.equal(chapter.behavior.actions(state, state.investigators[0], api).some(move => move.rule === 'cityLookRowOrColumn'), false, '每轮一次标记')
  assert.equal(chapter.behavior.actions(state, state.investigators[0], api)
    .some(move => move.rule === 'cityLookRowOrColumn'), false, '同轮不再提供')
})

test('P7 cityOfTheElderThings 幕 1 与背面：花费钥匙研究 → 目标达成 → 揭示隐秘隧道', () => {
  const state = setup(stateFor(1))
  const api = apiStub(state)
  const inv = state.investigators[0]
  // 直接从地点取得两把 [elder_thing] 钥匙（v1 幕 1：elderthing×2 → 研究历史）。
  const holders = CITY_LOCATION_IDS.filter(id => valueKeysAt(state, `location:${id}`).some(key => key.value === 'elderthing'))
  assert.equal(holders.length, 2)
  for (const holder of holders) {
    const key = valueKeysAt(state, `location:${holder}`).find(item => item.value === 'elderthing')
    spendValueKeys(state, `location:${holder}`, { values: [key.value], destination: 'investigator:0' })
  }
  assert.equal(valueKeysAt(state, 'investigator:0').length, 2)
  // legalMoves 同源的 actions() 清单：能支付哪把钥匙就只列出哪把。
  const rules = chapter.behavior.actions(state, inv, api).map(move => move.rule)
  assert.ok(rules.includes('actKey:studyHistory'), '凑齐 2 个 [elder_thing] 后列出 studyHistory')
  assert.equal(rules.includes('actKey:discernShoggoths'), false, '没有 2 个 [tablet] 钥匙时不列出 discernShoggoths')
  assert.equal(chapter.behavior.performAction(state, inv, { rule: 'actKey:studyHistory' }, api), true)
  assert.equal(state.campaign.records.theTeamStudiedTheHistoryOfTheElderThings, true, '记录研究历史')
  state.campaign.records.theTeamDiscernedTheOriginOfTheShoggoths = true
  // 目标达成 → 剧本用 runtime 的真实 advanceAct() 推进（引擎 checkLinearAct 不读返回值）。
  let advanced = 0
  assert.equal(chapter.behavior.checkObjectives(state, { advanceAct: () => { advanced += 1 } }), true,
    '两个钥匙行动都完成 → 目标达成')
  assert.equal(advanced, 1, '目标达成后调用 advanceAct 推进')
  // 幕 1 背面：揭示隐秘隧道 + 把放一边的修格斯组洗回遭遇牌库。
  const deckBefore = state.encounterDeck.length
  assert.equal(chapter.behavior.actReveal(state, state.acts[0], api), true)
  assert.equal(state.scenarioFlags.hiddenTunnelRevealed, true, '背面揭示隐秘隧道')
  assert.equal(state.locations.find(item => item.id === HIDDEN_TUNNEL).revealed, true, '隐秘隧道地点被真实揭示')
  assert.ok(state.encounterDeck.length > deckBefore, '放一边的修格斯组洗回遭遇牌库')
})

// ---------------------------------------------------------------------------
// 5. 代表遭遇卡 + 混乱标记
// ---------------------------------------------------------------------------
test('P7 cityOfTheElderThings 代表遭遇卡：真相开端/崩塌废墟/冻伤/附身', () => {
  const state = setup(stateFor(1))
  const api = apiStub(state)
  const inv = state.investigators[0]
  // 真相开端（08644）：难度 = 2 + 所在地点上的钥匙数 + 你控制的钥匙数。
  inv.location = CITY_LOCATION_IDS[0]
  const hereKeys = valueKeysAt(state, `location:${inv.location}`).length
  chapter.behavior.resolveEncounter(state, inv, { code: RAW_CODES.dawningOfTheTruth }, api)
  assert.equal(state.testCalls[0].difficulty, 2 + hereKeys + chapter.behavior.keyCount(state, 0),
    '真相开端难度 = 2 + 地点钥匙数 + 控制钥匙数')
  assert.equal(state.testCalls[0].source?.type, 'scenario', '检定来源以引擎第 6 参传入（不是 options.resolve）')
  // 崩塌废墟：失败按差值受伤害（至少 1）。
  state.testResults = [{ success: false, value: 0, difficulty: 3 }]
  chapter.behavior.resolveEncounter(state, inv, { code: RAW_CODES.crumblingRuins }, api)
  assert.equal(state.investigators[0].damage, 3)
  // 冻伤/附身：进入威胁区（1 计数器）。
  chapter.behavior.resolveEncounter(state, inv, { code: RAW_CODES.frostbitten }, api)
  assert.equal(state.investigators[0].threat.find(item => item.code === RAW_CODES.frostbitten).counters, 1)
  chapter.behavior.resolveEncounter(state, inv, { code: RAW_CODES.possessed }, api)
  assert.ok(state.investigators[0].threat.some(item => item.code === RAW_CODES.possessed))
  assert.equal(registeredEntry(RAW_CODES.possessed).flags.threatHorrorSink, true)
})

test('P7 cityOfTheElderThings 专属诡计已接线：entryRevelation + campaignRule 才有真实遭遇结算', () => {
  for (const code of TREACHERY_CODES) {
    const treachery = definition.treacheries[code]
    assert.equal(treachery.entryRevelation, true, `${code} 必须声明 entryRevelation（引擎遭遇揭示读点）`)
    assert.equal(treachery.effect?.kind, 'campaignRule', `${code} 必须声明 effect.campaignRule 才会交给 behavior.resolveEncounter`)
    assert.equal(typeof registeredEntry(code).treacheryRule?.resolveKind, 'string', `${code} 的行为分派键`)
  }
})

// ---------------------------------------------------------------------------
// 6. 版本选择 / 遭遇牌库按版本 gather
// ---------------------------------------------------------------------------
test('P7 cityOfTheElderThings 版本选择：记录/投票决定 v2/v3 并同步幕牌库与遭遇牌库', () => {
  // v2：侦察过城市外围 → preScenarioSetup 选 v2、换幕牌库 08625/08628。
  const v2 = stateFor(2)
  v2.campaign.records.theInvestigatorsScoutedTheCityOutskirts = true
  chapter.behavior.preScenarioSetup(v2, [], apiStub(v2))
  assert.equal(v2.scenarioFlags.cityVersion, 'v2', '战役记录决定 v2')
  assert.deepEqual(v2.acts.map(act => act.originalCode), ['08625', '08628'], 'v2 幕牌库')
  setup(v2)
  assert.equal(v2.encounterDeck.length, ENCOUNTER_DECK_BY_VERSION.v2.length, 'v2 遭遇牌库按版本收窄')
  assert.ok(v2.scenarioZones.setAside.includes('08689'), 'v2 放一边冰中生物组')
  assert.equal(v2.encounterDeck.includes(RAW_CODES.benignElderThing), false, 'v2 移出和蔼的古老者')
  assert.ok(v2.encounterDeck.includes(RAW_CODES.reawakenedElderThing), 'v2 保留复苏的古老者')
  // v3：flags 投票（伙伴投票未迁移，调试/测试注入）→ 幕牌库 08626/08629。
  const v3 = stateFor(2)
  v3.scenarioFlags.cityVersionVote = 'v3'
  chapter.behavior.preScenarioSetup(v3, [], apiStub(v3))
  assert.equal(v3.scenarioFlags.cityVersion, 'v3', 'flags 投票决定 v3')
  assert.deepEqual(v3.acts.map(act => act.originalCode), ['08626', '08629'], 'v3 幕牌库')
  setup(v3)
  assert.equal(v3.encounterDeck.length, ENCOUNTER_DECK_BY_VERSION.v3.length, 'v3 遭遇牌库按版本收窄')
  assert.ok(v3.encounterDeck.includes('08689'), 'v3 冰中生物组在遭遇牌库（v3 gather 而非放一边）')
  assert.ok(v3.encounterDeck.includes(RAW_CODES.benignElderThing), 'v3 保留和蔼的古老者')
  assert.equal(v3.encounterDeck.includes(RAW_CODES.reawakenedElderThing), false, 'v3 移出复苏的古老者')
  assert.ok(v3.scenarioZones.setAside.includes('08710'), 'v3 放一边修格斯组')
})

test('P7 cityOfTheElderThings 遭遇牌库按版本 gather：共享组并入、移除/放一边有读点', () => {
  for (const version of ['v1', 'v2', 'v3']) {
    const state = stateFor(2)
    // 版本必须在 setup 前决定（preScenarioSetup 的语义），setup 内的 modifyDeck 会按它收窄牌库。
    state.scenarioFlags.cityVersion = version
    setup(state)
    const deck = state.encounterDeck
    assert.ok(Array.isArray(deck) && deck.length > 20, `${version} 的牌库应并入共享组（>20 张）`)
    const codes = new Set(deck)
    assert.ok(codes.has('08695') || codes.has('08706') || codes.has('08703'), `${version} 牌库含共享组敌人/诡计`)
    // 三个版本的版本差异：和蔼的古老者只在 v3 牌库，复苏的古老者不在 v3。
    assert.equal(codes.has(RAW_CODES.benignElderThing), version === 'v3', `${version} 的和蔼的古老者去向`)
    assert.equal(codes.has(RAW_CODES.reawakenedElderThing), version !== 'v3', `${version} 的复苏的古老者去向`)
    // removeUnearnedWeaknesses：冻伤/附身永不进遭遇牌库（由序幕按伙伴生死加入调查员牌组）。
    assert.equal(codes.has(RAW_CODES.frostbitten), false, `${version} 冻伤不在遭遇牌库`)
    assert.equal(codes.has(RAW_CODES.possessed), false, `${version} 附身不在遭遇牌库`)
    // 放一边的遭遇组进入场景区，背面会洗回；放一边/移出互不重叠。
    const aside = state.scenarioZones.setAside
    assert.ok(Array.isArray(aside) && aside.length > 0, `${version} 有放一边的遭遇组`)
    for (const code of REMOVED_BY_VERSION[version]) {
      assert.equal(codes.has(code), false, `${version} 的移出卡 ${code} 不在牌库`)
      assert.equal(aside.includes(code), false, `${version} 的移出卡 ${code} 不放在一边`)
    }
    // 专属诡计总在牌库里（印刷份数，剔除被移出游戏的冻伤/附身）。
    assert.ok(codes.has(RAW_CODES.dawningOfTheTruth) && codes.has(RAW_CODES.crumblingRuins), `${version} 含专属诡计`)
  }
})

test('P7 cityOfTheElderThings 混乱标记：skull=-钥匙数、tablet+frost 自动失败', () => {
  const state = setup(stateFor(1))
  const inv = state.investigators[0]
  // 取得两把钥匙 → skull -2。
  const holders = CITY_LOCATION_IDS.filter(id => valueKeysAt(state, `location:${id}`).length === 1).slice(0, 2)
  for (const holder of holders) {
    const key = valueKeysAt(state, `location:${holder}`)[0]
    spendValueKeys(state, `location:${holder}`, { values: [key.value], destination: 'investigator:0' })
  }
  assert.equal(chapter.behavior.keyCount(state, 0), 2)
  assert.deepEqual(cityOfTheElderThingsChaosToken(state, inv, 'skull'), { delta: -2 })
  state.difficulty = 'hard'
  assert.deepEqual(cityOfTheElderThingsChaosToken(state, inv, 'skull'), { delta: -4 })
  state.difficulty = 'standard'
  assert.equal(CITY_OF_THE_ELDER_THINGS_TOKEN_MEANINGS.standard.tablet.delta, -3)
  assert.equal(chapter.behavior.testAutoFail(state, inv, { success: false, drawn: ['tablet', 'frost'], cancelledTokens: [] }), true)
  assert.equal(chapter.behavior.testAutoFail(state, inv, { success: false, drawn: ['tablet'], cancelledTokens: [] }), false)
  assert.ok(cityOfTheElderThingsAfterTest(state, inv, { success: false, drawn: ['frost', 'tablet'], cancelledTokens: [] }).includes('autoFail'))
})

// ---------------------------------------------------------------------------
// 7. 幕 2 目标 / 结局 / JSON 往返
// ---------------------------------------------------------------------------
test('P7 cityOfTheElderThings 幕 2 目标：所有未被击败调查员在隐秘隧道且隧道无线索', () => {
  const state = setup(stateFor(2))
  state.acts = clone(definition.acts)
  state.actIndex = 1
  const tunnel = state.locations.find(item => item.id === HIDDEN_TUNNEL)
  tunnel.clues = 1
  state.investigators.forEach(inv => { inv.location = HIDDEN_TUNNEL })
  assert.equal(chapter.behavior.checkObjectives(state), false, '隧道还有线索')
  tunnel.clues = 0
  assert.equal(chapter.behavior.checkObjectives(state), true)
  state.investigators[1].defeated = true
  assert.equal(chapter.behavior.checkObjectives(state), true, '被击败的调查员不计')
  state.scenarioFlags.hiddenTunnelRevealed = false
  assert.equal(chapter.behavior.finalResolution(state), 'resolution2')
  chapter.behavior.resolution(state, 'noResolution')
  assert.equal(state.campaign.records.theTeamFoundTheHiddenTunnel, false)
  // 参考 CityOfTheElderThings.hs：R1 记录 Found、R2 记录 Guided，互不混写。
  chapter.behavior.resolution(state, 'resolution2')
  assert.equal(state.campaign.records.theTeamWasGuidedToTheHiddenTunnel, true, 'R2 记录被引导至隐秘隧道')
  assert.equal(state.campaign.records.theTeamFoundTheHiddenTunnel, false, 'R2 不写 Found')
  chapter.behavior.resolution(state, 'resolution1')
  assert.equal(state.campaign.records.theTeamFoundTheHiddenTunnel, true, 'R1 记录找到隐秘隧道')
  assert.equal(state.campaign.records.theTeamWasGuidedToTheHiddenTunnel, false, 'R1 不写 Guided')
})

test('P7 cityOfTheElderThings JSON 存档往返：网格/钥匙/幕记录可序列化复原', () => {
  const state = setup(stateFor(2))
  state.scenarioFlags.hiddenTunnelRevealed = true
  state.campaign.records.theTeamStudiedTheHistoryOfTheElderThings = true
  const restored = JSON.parse(JSON.stringify(state))
  assert.equal(readCityscapes(restored).length, 16)
  assert.equal(CITY_LOCATION_IDS.flatMap(id => valueKeysAt(restored, `location:${id}`)).length, 16)
  assert.equal(restored.scenarioFlags.hiddenTunnelRevealed, true)
  assert.equal(restored.campaign.records.theTeamStudiedTheHistoryOfTheElderThings, true)
  assert.equal(restored.locations.length, 17)
})

// ---------------------------------------------------------------------------
// 8. 真实引擎路径（生产组合根 tests/eote-p8-fixture.mjs）——验收口径：真实 legalMoves/applyMove
// ---------------------------------------------------------------------------
let worldPromise = null
const worldOf = () => (worldPromise ||= loadEoteWorld())

async function openRealCity(seed) {
  const world = await worldOf()
  // 不用 fixture.openChapter 的固定章节表：其它章节的检查点/跳过修复会改变真实顺序，
  // 这里按 uiState 一直推进到「古者之城 inScenario」为止（每章用首个合法结局正常结算）。
  const state = createHubGame(world, {
    seats: 2, humans: [0, 1], seed, investigatorCodes: ['08001', '08004'],
  })
  hubSetup(world, state, { investigatorCodes: ['08001', '08004'] })
  for (let guard = 0; guard < 16 && state.scenario?.id !== 'cityOfTheElderThings'; guard += 1) {
    if (state.uiState === 'inScenario') finishScenario(world, state, Object.keys(state.scenario.resolutions)[0])
    else if (state.uiState === 'scenarioResult') continueFromResult(world, state, { upgrades: false })
    else if (state.uiState === 'scenarioSetup') beginChapter(world, state)
    else assert.fail(`推进古者之城时遇到未知 uiState=${state.uiState}`)
  }
  assert.equal(state.scenario?.id, 'cityOfTheElderThings', `应推进到古者之城（当前 ${state.scenario?.id}）`)
  assert.equal(state.uiState, 'inScenario')
  // 单标记混乱袋：+5 保证调查/检定成功；需要失败的用例再单独注入 autofail。
  state.chaosBag = ['+5']
  return { world, state, seat: decisionSeat(world, state) }
}

test('P7 cityOfTheElderThings 真实引擎：setup→legalMoves→石桥剧本行动无 TypeError（P0-12）', async () => {
  const { world, state, seat } = await openRealCity('city-real-bridge')
  const moves = legalFor(world, state, seat)
  const actionRules = [...new Set(moves.filter(move => move.action === 'scenarioAction').map(move => move.rule))]
  assert.ok(actionRules.length > 0, `真实 legalMoves 应含剧本行动：${moves.map(move => move.action).join(',')}`)
  const bridge = moves.find(move => move.action === 'scenarioAction' && move.rule === 'loc:bridgeDiscover')
  assert.ok(bridge, `起始石桥应提供「发现线索」行动：${actionRules.join(',')}`)
  // 修复前这里抛 "options.resolve is not a function"（api.test 第 4 参传成 options 对象）。
  playMove(world, state, bridge, seat)
  settleChoices(world, state)
  assert.ok(state.lastTestResult, '石桥检定在真实引擎里结算完成')
  assert.notEqual(state.lastTestResult.success, undefined, '检定结果含 success（不是被吞掉的异常）')
})

test('P7 cityOfTheElderThings 真实引擎：legalMoves 含 claim/give 且 applyMove 成功（P0-6 钥匙入口）', async () => {
  const { world, state, seat } = await openRealCity('city-real-keys')
  const target = state.locations.find(loc => loc.id !== HIDDEN_TUNNEL
    && valueKeysAt(state, `location:${loc.id}`).length > 0)
  assert.ok(target, 'setup 后城市景观上有钥匙')
  const targetId = target.id
  const runtime = world.engine.scenarioRuntime(state, [])
  runtime.moveInvestigator(seat, targetId)
  runtime.reveal(targetId, seat)
  state.investigators[seat].actionsLeft = Math.max(state.investigators[seat].actionsLeft || 0, 3)
  // 真实调查行动清空线索（+5 混乱袋保证成功）；每步都从最新 state 读地点（事务会重建对象）。
  for (let guard = 0; guard < 4; guard += 1) {
    const loc = state.locations.find(item => item.id === targetId)
    if (!loc || (loc.clues || 0) <= 0) break
    const investigate = legalFor(world, state, seat).find(move => move.action === 'investigate')
    assert.ok(investigate, '真实 legalMoves 含调查')
    playMove(world, state, investigate, seat)
    settleChoices(world, state)
  }
  assert.equal(state.locations.find(item => item.id === targetId)?.clues, 0, '真实调查清空地点线索')
  const claim = legalFor(world, state, seat).find(move => move.action === 'scenarioAction' && move.rule === 'key:claim')
  assert.ok(claim, '真实 legalMoves 含钥匙取得（claim）')
  assert.equal(claim.actions, 0, 'claim 是快速行动')
  playMove(world, state, claim, seat)
  settleChoices(world, state)
  assert.equal(valueKeysAt(state, `investigator:${seat}`).length, 1, 'applyMove claim 后钥匙由调查员控制')
  // 同地点另一位调查员 → give 进入 legalMoves，applyMove 经选择事务转交。
  const other = state.investigators.find(item => item.seat !== seat)
  runtime.moveInvestigator(other.seat, targetId)
  const give = legalFor(world, state, seat).find(move => move.action === 'scenarioAction' && move.rule === 'key:give')
  assert.ok(give, '真实 legalMoves 含钥匙交出（give）')
  playMove(world, state, give, seat)
  settleChoices(world, state)
  assert.ok(valueKeysAt(state, `investigator:${other.seat}`).length >= 1, 'applyMove give 后钥匙转交同地点调查员')
})

test('P7 cityOfTheElderThings 真实引擎：幕 1 目标可达 → 真实推进并揭示隐秘隧道（P0-6）', async () => {
  const { world, state, seat } = await openRealCity('city-real-act1')
  // 钥匙用引擎的 scenario-keys 写入口交到当前调查员（真实 claim 路径由上一条用例覆盖）。
  for (const value of ['elderthing', 'elderthing', 'tablet', 'tablet']) {
    const holder = state.locations.find(loc => loc.id !== HIDDEN_TUNNEL
      && valueKeysAt(state, `location:${loc.id}`).some(key => String(key.value) === value))
    assert.ok(holder, `城市景观上应有 ${value} 钥匙`)
    assert.equal(spendValueKeys(state, `location:${holder.id}`,
      { values: [value], destination: `investigator:${seat}` }), true)
  }
  const moves = legalFor(world, state, seat)
  const study = moves.find(move => move.action === 'scenarioAction' && move.rule === 'actKey:studyHistory')
  const discern = moves.find(move => move.action === 'scenarioAction' && move.rule === 'actKey:discernShoggoths')
  assert.ok(study && discern, '真实 legalMoves 含两把幕 1 钥匙研究行动')
  playMove(world, state, study, seat)
  settleChoices(world, state)
  playMove(world, state, discern, seat)
  settleChoices(world, state)
  assert.equal(state.actIndex, 1, '幕 1 目标达成后真实推进到幕 2')
  assert.equal(state.scenarioFlags.hiddenTunnelRevealed, true, '幕 1 背面揭示隐秘隧道')
  assert.equal(state.locations.find(loc => loc.id === HIDDEN_TUNNEL)?.revealed, true, '隐秘隧道地点被真实揭示')
  assert.equal(state.campaign.records.theTeamStudiedTheHistoryOfTheElderThings, true)
  assert.equal(state.campaign.records.theTeamDiscernedTheOriginOfTheShoggoths, true)
})

test('P7 cityOfTheElderThings 真实引擎：议程 2 背面推进到结局 2 并写记录（P0-6 R2）', async () => {
  const { world, state } = await openRealCity('city-real-r2')
  // 真实密谋推进入口（advanceAgenda）走两遍：密谋 1 → 密谋 2 → 背面 R2。
  transact(world, state, draft => world.engine.advanceAgenda(draft, []))
  assert.equal(state.agendaIndex, 1, '第一次推进后进入密谋 2')
  transact(world, state, draft => world.engine.advanceAgenda(draft, []))
  const result = state.campaign.scenarioResults.at(-1)
  assert.equal(result?.resolution, 'resolution2', '议程 2 背面 → 结局 2（R2）')
  assert.equal(state.campaign.records.theTeamWasGuidedToTheHiddenTunnel, true, 'R2 记录「被引导至隐秘隧道」')
})

test('P7 cityOfTheElderThings 真实引擎：共享组并入遭遇牌库 + 专属诡计真实结算（P0-8）', async () => {
  const { world, state } = await openRealCity('city-real-treachery')
  const counts = new Map()
  for (const code of state.encounterDeck) counts.set(code, (counts.get(code) || 0) + 1)
  assert.ok(state.encounterDeck.length > 20,
    `真实遭遇牌库应并入共享组（实际 ${state.encounterDeck.length} 张）`)
  assert.ok(state.encounterDeck.includes('08695') || state.encounterDeck.includes('08706')
    || state.encounterDeck.includes('08703'), '真实牌库含共享组卡')
  assert.equal(counts.get(RAW_CODES.dawningOfTheTruth), 3, '真相开端 3 张在真实牌库')
  assert.equal(counts.get(RAW_CODES.crumblingRuins), 3, '崩塌废墟 3 张在真实牌库')
  for (const code of [RAW_CODES.dawningOfTheTruth, RAW_CODES.crumblingRuins]) {
    state.encounterDeck.push(code)
    state.chaosBag = ['autofail']
    const before = { horror: state.investigators[0].horror, damage: state.investigators[0].damage }
    transact(world, state, draft => { world.engine.drawEncounter(draft, draft.investigators[0], []) })
    const after = { horror: state.investigators[0].horror, damage: state.investigators[0].damage }
    assert.ok(after.horror > before.horror || after.damage > before.damage,
      `${code} 从真实遭遇牌库结算后应有落地效果（修复前为零结算）`)
  }
})
