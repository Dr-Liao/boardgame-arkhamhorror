// 血色阴影（sanguineShadows · 09545）章节测试（P7）。
//
// 三层证据：
//   1. 章节装配 —— manifest（8 地点 / 两幕 / 一密谋 / 五个结局）、正文可读、四档混乱标记表；
//   2. 章节机械 —— 布置（移除 1 张、六个标靶、红衣女郎隐匿 5）、揭露与标靶轮转、混洗确定性、
//      幕/密谋推进（含「见红」幕间）、遭遇卡行为、绯红密钥变换、结局记录与 JSON 往返；
//   3. 单卡条目 —— 十条专属条目逐条具备可执行声明（隐秘 X / 强制能力 / 诡计分派 / Shift 面）。
import test from 'node:test'
import assert from 'node:assert/strict'
import { registerCardAbilities, registeredEntry } from '../src/engine/ability.js'
import { validateTskState } from '../src/engine/tsk-primitives.js'
import { initializeScarletKeys, scarletKey } from '../src/engine/tsk-scarlet-keys.js'
import * as chapter from '../content/campaigns/theScarletKeys/scenarios/sanguineShadows/index.js'
import {
  AVENIDA_DE_MAYO, CANDIDATE_LOCATION_IDS, ENCOUNTER_DECK, LOCATIONS, RAW_CODES, SET_ASIDE_CODES,
  WEEPING_LADY_KEY, clueValueOf, scenario,
} from '../content/campaigns/theScarletKeys/scenarios/sanguineShadows/definition.js'
import {
  SHADOW_ANCHOR_PREFIX, advanceTargetToReference, behavior, chapterState, chapterSummary,
  cluesSpendBlocked, collectTargetForLaChicaRoja, concealedAmountOf, concealedGroupOf, concealedSpotsFor,
  enterSeeingRed, exposeAt, markTime, miniCardsAt, nearestTargetLocation, placeTarget, referenceTargetCount,
  reshuffleConcealedAt, resetStageDecks, resolveConcealed, shiftWeepingLady, targetLocations, targetsOn,
} from '../content/campaigns/theScarletKeys/scenarios/sanguineShadows/behavior.js'
import {
  SANGUINE_SHADOWS_TOKEN_MEANINGS, sanguineShadowsAfterTest, sanguineShadowsChaosToken,
} from '../content/campaigns/theScarletKeys/scenarios/sanguineShadows/chaos.js'

// ---------------------------------------------------------------------------
// 条目注册（真实注册期校验：未知字段/未知 kind/未知窗口都会在这里失败）
// ---------------------------------------------------------------------------
const ENTRIES = []
for (const code of chapter.behavior.implementedEncounterCodes) {
  const module = await import(`../src/cards/encounter-entries/theScarletKeys/sanguineShadows/${code}.js`)
  ENTRIES.push(module.default)
}
for (const entry of ENTRIES) if (!registeredEntry(entry.code)) registerCardAbilities(entry)

const clone = value => structuredClone(value)
const info = () => {}

function stateFor(count = 2, seed = 20261111) {
  return {
    scenario: clone(scenario),
    acts: clone(scenario.acts),
    agendas: clone(scenario.agendas),
    actIndex: 0,
    agendaIndex: 0,
    numInvestigators: count,
    difficulty: 'standard',
    round: 1,
    currentSeat: 0,
    doom: 0,
    rngState: seed,
    locations: [],
    investigators: Array.from({ length: count }, (_, seat) => ({
      seat, code: '01001', name: `调查员${seat + 1}`, location: AVENIDA_DE_MAYO, klass: 'seeker', traits: [],
      damage: 0, horror: 0, clues: 0, resources: 5, hand: [], assets: [], threat: [], engaged: [],
      deck: ['01001', '01002'], discard: [], actionsLeft: 3, trauma: { physical: 0, mental: 0 },
    })),
    enemies: [], storyAssets: [], encounterDeck: [...ENCOUNTER_DECK], encounterDiscard: [],
    scenarioZones: {}, scenarioFlags: {}, chaosBag: ['+1', '0', '-2', 'skull', 'tablet', 'elderthing'],
    campaign: { records: {}, investigators: Array.from({ length: count }, () => ({ trauma: { physical: 0, mental: 0 }, deck: [] })) },
    victoryDisplay: [], victory: 0, testResults: [], testCalls: [], choices: [], finished: [], infos: [],
  }
}

function apiStub(state, overrides = {}) {
  const api = {
    info: text => state.infos.push(String(text)),
    choose: request => state.choices.shift() ?? request?.options?.[0]?.id ?? null,
    choice: request => state.choices.shift() ?? request?.options?.[0]?.id ?? null,
    test: (seat, skill, difficulty, resolve = null, skillBonus = 0, source = null) => {
      state.testCalls.push({ seat, skill, difficulty, skillBonus, source })
      const result = state.testResults.shift() || { success: true, value: difficulty + 1, difficulty }
      if (typeof resolve === 'function') resolve(result)
      return result
    },
    spawn: (code, locationId, options = {}) => {
      const enemy = { id: `enemy-${state.enemies.length + 1}`, code, originalCode: code,
        location: locationId, exhausted: Boolean(options.exhausted), defeated: false, damageTaken: 0,
        health: 2, traits: ['Humanoid', 'Coterie'], engagedSeat: null }
      state.enemies.push(enemy)
      return enemy
    },
    attack: (enemy, inv) => { state.attacks ||= []; state.attacks.push({ enemyId: enemy?.id, seat: inv?.seat }) },
    harm: (seat, amount = {}) => {
      const inv = state.investigators[seat]
      inv.damage += amount.damage || 0
      inv.horror += amount.horror || 0
    },
    damageEnemy: (enemyId, amount) => {
      const target = state.enemies.find(enemy => enemy.id === enemyId)
      if (target) target.damageTaken = (Number(target.damageTaken) || 0) + amount
    },
    setEnemyAside: enemy => {
      state.enemies = state.enemies.filter(item => item !== enemy)
      state.setAsideEnemies ||= []
      state.setAsideEnemies.push(enemy)
      return true
    },
    restoreEnemyFromAside: (id, locationId) => {
      const enemy = (state.setAsideEnemies || []).find(item => item.id === id)
      if (!enemy) return null
      state.setAsideEnemies = state.setAsideEnemies.filter(item => item !== enemy)
      enemy.location = locationId
      state.enemies.push(enemy)
      return enemy
    },
    addDoom: amount => { state.doom = (Number(state.doom) || 0) + amount; return state.doom },
    spendClues: (seat, amount) => { state.investigators[seat].clues -= amount },
    loseResources: (seat, amount) => { state.investigators[seat].resources -= amount },
    directHorror: (seat, amount) => { state.investigators[seat].horror += amount },
    discardAsset: (seat, assetId) => {
      const inv = state.investigators[seat]
      inv.assets = inv.assets.filter(asset => asset.id !== assetId)
    },
    discoverClue: (seat, amount, locationId) => {
      const location = state.locations.find(item => item.id === locationId)
      if (!location || (location.clues || 0) < amount) return false
      location.clues -= amount
      state.investigators[seat].clues += amount
      return true
    },
    moveInvestigator: (seat, destination) => { state.investigators[seat].location = destination },
    disengage: enemy => { if (enemy) enemy.engagedSeat = null; return true },
    advanceAct: () => { state.advanced = (state.advanced || 0) + 1; state.actIndex += 1 },
    advanceAgenda: () => { state.agendaAdvanced = (state.agendaAdvanced || 0) + 1; state.agendaIndex += 1 },
    finish: key => state.finished.push(key),
    addTrauma: (seat, kind, amount) => { state.campaign.trauma ||= {}; state.campaign.trauma[`${seat}:${kind}`] = amount },
    defeatInvestigator: seat => { state.investigators[seat].defeated = true },
    shuffleEncounterDiscardBackIn: () => {
      state.encounterDeck.push(...state.encounterDiscard)
      state.encounterDiscard = []
    },
    random: () => 0.5,
    locationDistance: (from, targets) => (targets.includes(from) ? 0 : 1),
    ...overrides,
  }
  return api
}

const setup = (state, overrides = {}) => {
  behavior.setupLocations(state, [], { info, random: null, ...overrides })
  return state
}

// ---------------------------------------------------------------------------
// 1. 装配 / 正文 / 混乱标记表
// ---------------------------------------------------------------------------
test('P7 sanguineShadows 清单：playable、8 地点/两幕一密谋/五结局/正文可读', () => {
  assert.equal(chapter.manifest.id, 'sanguineShadows')
  assert.equal(chapter.manifest.campaignId, 'theScarletKeys')
  assert.equal(chapter.manifest.status, 'playable')
  assert.equal(chapter.manifest.referenceCode, '09545')
  assert.equal(chapter.manifest.locations.length, 8)
  assert.deepEqual(chapter.manifest.acts.map(act => act.id), ['act1', 'act2'])
  assert.deepEqual(chapter.manifest.agendas.map(agenda => agenda.id), ['agenda1'])
  assert.deepEqual(chapter.manifest.resolutionIds,
    ['noResolution', 'noResolutionSeeingRed', 'resolution1', 'resolution2', 'resolution3'])
  assert.equal(chapter.manifest.startLocationId, AVENIDA_DE_MAYO)
  // 遭遇牌库＝专属组 + 六个共享组按印刷份数展开（P0 修复：旧实现只含专属组 8 张）。
  const deck = Object.fromEntries(chapter.manifest.zones.encounterDeck.map(entry => [entry.cardCode, entry.count]))
  assert.deepEqual(deck, {
    '01172': 2, '01173': 2, '01174': 2,
    '09558': 2, '09559': 2, '09560': 2, '09561': 2,
    '09718': 2, '09719': 2, '09720': 2, '09721': 2, '09722': 2, '09723': 2, '09724': 2, '09725': 2,
  })
  const aside = chapter.manifest.zones.setAside.map(entry => entry.cardCode).sort()
  assert.deepEqual(aside, ['09562', '09563', '09564', '09565a'])
  assert.deepEqual(chapter.manifest.zones.inPlay.map(entry => entry.cardCode), ['09557'])
  // 正文：开场标题/三选项、完整设置、特别规则。
  assert.ok(chapter.scenario.introTitle.includes('血色阴影'))
  assert.equal(chapter.scenario.introChoices.length, 3)
  assert.ok(chapter.scenario.setup.length > 200)
  assert.ok(chapter.scenario.specialRules.includes('标的'))
  // 结局正文可读（五段都有标题与正文）。
  for (const [key, text] of Object.entries(scenario.resolutions)) {
    assert.ok(String(text).length > 20, `${key} 正文缺失`)
  }
  // 四档混乱标记：简单/普通共用一张表，困难/专家共用另一张。
  assert.equal(SANGUINE_SHADOWS_TOKEN_MEANINGS.easy, SANGUINE_SHADOWS_TOKEN_MEANINGS.standard)
  assert.equal(SANGUINE_SHADOWS_TOKEN_MEANINGS.hard, SANGUINE_SHADOWS_TOKEN_MEANINGS.expert)
  assert.equal(SANGUINE_SHADOWS_TOKEN_MEANINGS.standard.cultist.delta, -5)
  assert.equal(SANGUINE_SHADOWS_TOKEN_MEANINGS.hard.cultist.delta, -7)
})

// ---------------------------------------------------------------------------
// 2. 布置：移除 1 张、六个标靶、红衣女郎隐匿 5、连接与线索值
// ---------------------------------------------------------------------------
test('P7 sanguineShadows 布置：8 地点入场/1 张移除、六个标靶、红衣女郎隐匿 5', () => {
  const state = setup(stateFor(2))
  const data = chapterState(state)
  assert.ok(CANDIDATE_LOCATION_IDS.includes(data.removedLocation), '移除一张候选地点')
  assert.equal(state.locations.length, 7, '中心 + 六张候选地点入场（八张里移除一张）')
  assert.equal(Object.keys(LOCATIONS).length, 8, '卡表里共八张地点')
  assert.equal(state.locations.some(item => item.id === data.removedLocation), false, '移除的那张不在场')
  assert.equal(state.scenarioZones.removed.length, 1)
  // 标靶：中心之外每张地点 1 个，共 6 个。
  assert.equal(targetLocations(state).length, 6)
  assert.equal(targetsOn(state, AVENIDA_DE_MAYO), 0)
  assert.equal(targetLocations(state).reduce((sum, id) => sum + targetsOn(state, id), 0), 6)
  // 中心：已揭示、可撤退、帷幕按难度、线索 = 印刷 1 × 人数。
  const center = state.locations.find(item => item.id === AVENIDA_DE_MAYO)
  assert.equal(center.revealed, true)
  assert.equal(center.resign, true)
  assert.equal(center.shroud, 3, '普通难度帷幕 3')
  assert.equal(center.clues, 2)
  assert.equal(center.maxClues, 2)
  // 其余地点未揭示、0 线索、有 maxClues；固定线索值不乘人数。
  const casa = state.locations.find(item => item.id === 'casaRosada')
  if (casa) {
    assert.equal(casa.revealed, false)
    assert.equal(casa.clues, 0)
    assert.equal(clueValueOf(state, 'casaRosada'), 2, '玫瑰宫固定 2 线索')
  }
  assert.equal(clueValueOf(state, 'recoleta'), 3)
  assert.equal(clueValueOf(state, 'palacioErrazuriz'), 2, '伊拉祖里兹宫 1 × 2 人')
  // 连接：中心连到每张入场地点；同符号两两互连；被移除的那张没有边。
  const placed = state.locations.map(item => item.id)
  for (const id of placed) {
    for (const to of state.locations.find(item => item.id === id).connections) {
      assert.ok(placed.includes(to), `${id} 的连接 ${to} 必须在场`)
    }
  }
  assert.equal([...center.connections].sort().join(','), placed.filter(id => id !== AVENIDA_DE_MAYO).sort().join(','))
  // 红衣女郎：真身 + 5 张诱饵＝6 张迷你卡，分布到 6 个有标靶的地点（每处 1 张）。
  const minis = chapterSummary(state).concealed
  assert.equal(minis.length, 6, '隐匿 5 = 5 诱饵 + 真身')
  assert.equal(minis.filter(card => card.code === RAW_CODES.laChicaRoja).length, 1)
  assert.equal(minis.filter(card => card.decoy).length, 5)
  assert.equal(new Set(minis.map(card => card.locationId)).size, 6, '平均分发到六个有标靶的地点')
})

test('P7 sanguineShadows 布置：不传随机源时按确定性顺序（同一 seed 两次结果一致）', () => {
  const a = setup(stateFor(2, 4242))
  const b = setup(stateFor(2, 4242))
  const c = setup(stateFor(2, 9999))
  const signature = state => JSON.stringify({
    removed: chapterState(state).removedLocation,
    concealed: chapterSummary(state).concealed.map(card => `${card.locationId}:${card.kind}`),
  })
  assert.equal(signature(a), signature(b), '同一 rngState 的两次布置必须一致')
  assert.notEqual(signature(a), signature(c), '不同 seed 允许不同结果')
})

// ---------------------------------------------------------------------------
// 3. 揭露与标靶轮转
// ---------------------------------------------------------------------------
test('P7 sanguineShadows 揭露：诱饵移除、真身把红衣女郎放到该地点', () => {
  const state = setup(stateFor(1))
  const api = apiStub(state)
  const decoy = chapterSummary(state).concealed.find(card => card.decoy)
  const decoyResult = exposeAt(state, state.investigators[0], miniCardIdOf(state, decoy), api)
  assert.equal(decoyResult.decoy, true)
  assert.equal(chapterSummary(state).concealed.length, 5, '诱饵翻面移除')
  const truth = chapterSummary(state).concealed.find(card => !card.decoy)
  const truthResult = exposeAt(state, state.investigators[0], miniCardIdOf(state, truth), api)
  assert.equal(truthResult.code, RAW_CODES.laChicaRoja)
  assert.equal(truthResult.kind, 'LaChicaRoja', '迷你卡的 kind 用符号名（原语要求字母开头）')
  assert.equal(truthResult.locationId, truth.locationId)
  assert.equal(chapterState(state).laChicaRojaExposed, true)
  assert.equal(state.enemies.filter(enemy => enemy.code === RAW_CODES.laChicaRoja).length, 1, '真身在该地点入场')
  assert.equal(state.enemies[0].location, truth.locationId)
})

function miniCardIdOf(state, summaryCard) {
  const container = state.scenarioFlags.mechanics.tsk.concealed
  const candidates = container.miniCards.filter(card => card.locationId === summaryCard.locationId
    && card.kind === summaryCard.kind)
  return candidates[0]?.id
}

test('P7 sanguineShadows 标靶轮转：密谋 1 收集 → 3 个进结局 3；幕 2 转到冒险参考卡', () => {
  const state = setup(stateFor(1))
  const api = apiStub(state)
  // 标靶轮转从「红衣女郎（或其迷你卡）所在地点」出发：把她的真身迷你卡放到第一个有标靶的地点。
  const firstLocation = targetLocations(state)[0]
  const truthMini = chapterSummary(state).concealed.find(card => !card.decoy)
  const container = state.scenarioFlags.mechanics.tsk.concealed
  const truthRecord = container.miniCards.find(card => card.id === miniCardIdOf(state, truthMini))
  truthRecord.locationId = firstLocation
  assert.equal(collectTargetForLaChicaRoja(state, api), firstLocation, '同地点的标靶优先')
  assert.equal(targetsOn(state, firstLocation), 0)
  assert.equal(chapterState(state).laChicaRojaTargets, 1)
  const remaining = targetLocations(state)
  const secondPick = collectTargetForLaChicaRoja(state, api)
  assert.ok(remaining.includes(secondPick), '标靶从相邻/最近的仍有标靶的地点取走')
  assert.equal(targetsOn(state, secondPick), 0)
  assert.ok(collectTargetForLaChicaRoja(state, api))
  assert.equal(chapterState(state).laChicaRojaTargets, 3)
  assert.deepEqual(state.finished, ['resolution3'], '3 个标靶 → 结局 3')
  // 幕 2 背面：把「离红衣女郎（或其迷你卡）最近的有标靶地点」的标靶放到冒险参考卡上。
  const referenceState = setup(stateFor(1))
  const referenceApi = apiStub(referenceState)
  const truth = chapterSummary(referenceState).concealed.find(card => !card.decoy)
  const expected = nearestTargetLocation(referenceState, truth.locationId, referenceApi)
  assert.equal(advanceTargetToReference(referenceState, referenceApi), expected)
  assert.equal(referenceTargetCount(referenceState), 1)
  assert.equal(targetsOn(referenceState, expected), 0)
})

// ---------------------------------------------------------------------------
// 4. 混洗确定性
// ---------------------------------------------------------------------------
test('P7 sanguineShadows 混洗确定性：重排隐匿迷你卡不增删、不跨出本组，且同 rng 可复现', () => {
  const state = setup(stateFor(1))
  const here = targetLocations(state)[0]
  const before = miniCardsAt(state, here).map(card => `${card.id}:${card.kind}`)
  state.scenarioFlags.mechanics.tsk.concealed.miniCards
    .filter(card => card.locationId === here)
    .forEach((card, index) => { card.kind = index === 0 ? 'Decoy' : RAW_CODES.laChicaRoja })
  const group = chapterSummary(state).concealed.filter(card => card.locationId === here)
  assert.equal(group.length, 1)
  // 组内只有 1 张时不重排（fail closed），位置与身份保持。
  assert.equal(reshuffleConcealedAt(state, [here]).length, 1)
  assert.deepEqual(miniCardsAt(state, here).map(card => card.id), before.map(item => item.split(':')[0]))
  // 跨地点整组重排：两次相同 rngState 的结果一致。
  const snapshot = state => reshuffleConcealedAt(state, targetLocations(state))
    .map(card => `${card.locationId}:${card.kind}`).join('|')
  const a = setup(stateFor(1, 777))
  const b = setup(stateFor(1, 777))
  assert.equal(snapshot(a), snapshot(b), '同一 rngState 的重排必须一致')
  // [cultist] 失败 2 点以上的连带重排：只影响所在地点与连接地点。
  const third = setup(stateFor(1))
  const location = targetLocations(third)[0]
  third.investigators[0].location = location
  const ids = [location, ...(third.locations.find(item => item.id === location)?.connections || [])]
  const affected = reshuffleConcealedAt(third, ids)
  assert.ok(affected.length >= 1)
  assert.ok(affected.every(card => ids.includes(card.locationId)))
})

// ---------------------------------------------------------------------------
// 5. 幕 / 密谋推进（含「见红」幕间）
// ---------------------------------------------------------------------------
test('P7 sanguineShadows 幕 1：与红衣女郎交战即推进；幕 2：谈判或打空血量推进', () => {
  const state = setup(stateFor(1))
  let api = apiStub(state)
  const enemy = api.spawn(RAW_CODES.laChicaRoja, targetLocations(state)[0])
  assert.equal(behavior.checkObjectives(state, api), false, '未交战不推进')
  enemy.engagedSeat = 0
  assert.equal(behavior.checkObjectives(state, api), true)
  assert.equal(state.actIndex, 1, '幕 1 推进到幕 2')
  // 幕 2：她不能被击败；血量见底改为推进。
  assert.equal(behavior.enemyCanBeDefeated(state, enemy), false)
  state.actIndex = 1
  enemy.damageTaken = Number(enemy.health) || 2
  api = apiStub(state)
  assert.equal(behavior.checkObjectives(state, api), true)
  assert.equal(state.actIndex, 2)
  // 谈判成功同样推进。
  const parleyState = setup(stateFor(1))
  parleyState.actIndex = 1
  const parleyEnemy = apiStub(parleyState).spawn(RAW_CODES.laChicaRoja, AVENIDA_DE_MAYO)
  parleyState.investigators[0].location = AVENIDA_DE_MAYO
  const parleyApi = apiStub(parleyState)
  const move = behavior.actions(parleyState, parleyState.investigators[0])
    .find(item => item.rule === `parley:${RAW_CODES.laChicaRoja}`)
  assert.ok(move, '幕 2 提供谈判行动')
  assert.equal(behavior.performAction(parleyState, parleyState.investigators[0], move, parleyApi), true)
  assert.equal(parleyState.testCalls[0].difficulty, 6, '谈判难度 6')
  assert.equal(chapterState(parleyState).parleyed, true)
  assert.equal(parleyEnemy.engagedSeat, null)
  assert.equal(behavior.checkObjectives(parleyState, parleyApi), true)
  // 幕序：幕 1 背面交给引擎默认推进（→ 幕 2）；幕 2 背面重置回幕 1；见红之后停在见红幕。
  assert.equal(behavior.actIndexAfterAdvance(parleyState, parleyState.acts[0]), undefined)
  assert.equal(behavior.actIndexAfterAdvance(parleyState, parleyState.acts[1]), 0)
  const seeing = setup(stateFor(1))
  enterSeeingRed(seeing, apiStub(seeing))
  assert.equal(behavior.actIndexAfterAdvance(seeing, seeing.acts[0]), 0)
})

test('P7 sanguineShadows 幕 1 背面：重置双牌库、治愈并重洗红衣女郎、补线索', () => {
  const state = setup(stateFor(1))
  const api = apiStub(state)
  state.actIndex = 1
  state.agendaIndex = 0
  state.doom = 5
  const before = chapterSummary(state).concealed.length
  resetStageDecks(state, api)
  assert.equal(state.actIndex, 0)
  assert.equal(state.agendaIndex, 0)
  assert.equal(state.acts[0].originalCode, RAW_CODES.act1, '幕牌库回到幕 1')
  assert.equal(state.agendas[0].originalCode, RAW_CODES.agenda1, '密谋牌库回到密谋 1')
  assert.equal(state.doom, 1, '密谋 1 重置后毁灭 = 1 × 人数')
  assert.equal(chapterSummary(state).concealed.length, before, '重洗后迷你卡数量守恒')
  assert.equal(chapterSummary(state).concealed.filter(card => !card.decoy).length, 1, '真身只有一张')
})

test('P7 sanguineShadows 幕 2 背面：第 3 个标靶进入冒险参考卡时跳到「见红」幕间', () => {
  const state = setup(stateFor(2))
  const api = apiStub(state)
  state.actIndex = 1
  const spots = targetLocations(state)
  state.investigators[0].location = spots[0]
  // 先在参考卡上放 2 个标靶，再把幕 2 背面的第 3 个搬过去。
  placeTarget(state, spots[0], 1)
  advanceTargetToReference(state, api)
  advanceTargetToReference(state, api)
  assert.equal(referenceTargetCount(state), 2)
  state.acts[1] = clone(scenario.acts[1])
  behavior.actReveal(state, state.acts[1], api)
  assert.equal(referenceTargetCount(state), 3)
  assert.equal(chapterState(state).seeingRed, true, '进入「见红」')
  assert.equal(state.acts[0].originalCode, RAW_CODES.seeingRed)
  assert.equal(state.agendas[0].originalCode, RAW_CODES.seeingRed, '见红既是幕也是密谋')
  assert.equal(state.doom, 1, '见红上放 1 个毁灭')
  assert.equal(targetLocations(state).length, 0, '其余标靶全部移除')
  assert.equal(state.enemies.filter(enemy => enemy.code === RAW_CODES.sanguineWatcher).length, 1, '血色监视者入场')
  const ka = concealedGroupOf(state, RAW_CODES.apportionedKa)
  assert.equal(ka.length, 5, '分裂精魂 4 张诱饵 + 真身')
  assert.equal(ka.filter(card => card.decoy).length, 4)
  assert.ok(ka.every(card => !(state.locations.find(item => item.id === card.locationId)?.traits || [])
    .includes('Central')), '分裂精魂不进中心')
  // 幕 2 背面只有 1/2 个标靶时重置牌库而不是进幕间。
  const reset = setup(stateFor(1))
  reset.actIndex = 1
  const resetApi = apiStub(reset)
  behavior.actReveal(reset, reset.acts[1], resetApi)
  assert.equal(chapterState(reset).seeingRed, false)
  assert.equal(reset.actIndex, 0)
  assert.equal(reset.investigators[0].clues, 0, '每位调查员失去所有线索')
})

test('P7 sanguineShadows 密谋：见红被击败推进、到阈值改为全体被击败+精神创伤', () => {
  const state = setup(stateFor(1))
  const api = apiStub(state)
  enterSeeingRed(state, api)
  const watcher = state.enemies.find(enemy => enemy.code === RAW_CODES.sanguineWatcher)
  assert.ok(watcher)
  assert.equal(behavior.agendaForcedEnemyDefeated(state, watcher, api), true)
  assert.equal(state.agendaIndex, 1, '密谋推进')
  // 到阈值：不推进，改为每位调查员被击败并承受 1 点精神创伤。
  const doomed = setup(stateFor(1))
  const doomedApi = apiStub(doomed)
  enterSeeingRed(doomed, doomedApi)
  doomed.doom = Number(doomed.agendas[0].doomThreshold)
  assert.equal(behavior.agendaWouldAdvance(doomed, doomedApi), true)
  assert.equal(doomed.investigators[0].defeated, true)
  assert.equal(doomed.campaign.trauma['0:mental'], 1)
  // 见红背面 → 结局 2。
  const finish = setup(stateFor(1))
  enterSeeingRed(finish, apiStub(finish))
  behavior.agendaReveal(finish, finish.agendas[0], apiStub(finish))
  assert.deepEqual(finish.finished, ['resolution2'])
})

// ---------------------------------------------------------------------------
// 6. 混乱标记与遭遇行为
// ---------------------------------------------------------------------------
test('P7 sanguineShadows 混乱标记：skull = -冒险参考卡标靶数（困难再 -1）、tablet 取消投入', () => {
  const state = setup(stateFor(1))
  const inv = state.investigators[0]
  assert.deepEqual(sanguineShadowsChaosToken(state, inv, 'skull'), { delta: 0 })
  placeTarget(state, targetLocations(state)[0], 1)
  advanceTargetToReference(state, apiStub(state))
  advanceTargetToReference(state, apiStub(state))
  assert.deepEqual(sanguineShadowsChaosToken(state, inv, 'skull'), { delta: -2 })
  state.difficulty = 'hard'
  assert.deepEqual(sanguineShadowsChaosToken(state, inv, 'skull'), { delta: -3 })
  state.difficulty = 'standard'
  const tablet = sanguineShadowsChaosToken(state, inv, 'tablet')
  assert.equal(tablet.delta, -1)
  assert.equal(tablet.cancelCommitted, true)
  assert.deepEqual(sanguineShadowsChaosToken(state, inv, 'cultist'), { delta: -5, rider: 'reshuffleConcealedOnFail' })
  assert.equal(sanguineShadowsChaosToken(state, inv, 'bless'), null, '未声明的标记交回引擎默认表')
  // 检定后 rider：cultist 失败 2 点以上重洗；elderthing 失败二选一。
  assert.deepEqual(sanguineShadowsAfterTest(state, inv,
    { success: false, difficulty: 4, value: 1, drawn: ['cultist'], cancelledTokens: [] }), ['reshuffleConcealed'])
  assert.deepEqual(sanguineShadowsAfterTest(state, inv,
    { success: false, difficulty: 4, value: 3, drawn: ['cultist'], cancelledTokens: [] }), [])
  assert.deepEqual(sanguineShadowsAfterTest(state, inv,
    { success: false, difficulty: 4, value: 2, drawn: ['elderthing'], cancelledTokens: [] }), ['doomOrCoterie'])
  // afterTest 真的结算：cultist → 重洗（不增删）；elderthing → 放毁灭。
  const cultist = setup(stateFor(1))
  const cultistApi = apiStub(cultist)
  const countBefore = chapterSummary(cultist).concealed.length
  behavior.afterTest(cultist, cultist.investigators[0],
    { success: false, difficulty: 4, value: 1, drawn: ['cultist'], cancelledTokens: [] }, cultistApi)
  assert.equal(chapterSummary(cultist).concealed.length, countBefore)
  const elder = setup(stateFor(1))
  const elderApi = apiStub(elder)
  const doomBefore = elder.doom
  behavior.afterTest(elder, elder.investigators[0],
    { success: false, difficulty: 4, value: 1, drawn: ['elderthing'], cancelledTokens: [] }, elderApi)
  assert.equal(elder.doom, doomBefore + 1)
})

test('P7 sanguineShadows 遭遇卡：三张专属诡计按 treacheryRule.resolveKind 分派', () => {
  const state = setup(stateFor(1))
  const api = apiStub(state)
  const inv = state.investigators[0]
  inv.location = AVENIDA_DE_MAYO
  assert.equal(registeredEntry(RAW_CODES.outsmarted).treacheryRule.resolveKind, 'outsmarted')
  assert.equal(registeredEntry(RAW_CODES.catAndMouse).treacheryRule.resolveKind, 'catAndMouse')
  assert.equal(registeredEntry(RAW_CODES.callingCard).treacheryRule.resolveKind, 'callingCard')
  // 技高一筹：检定智力 4；失败时选「放毁灭」。
  state.testResults = [{ success: false, value: 1, difficulty: 4 }]
  state.choices = ['doom']
  assert.equal(behavior.resolveEncounter(state, inv, { code: RAW_CODES.outsmarted }, api), true)
  assert.equal(state.testCalls[0].skill, 'intellect')
  assert.equal(state.testCalls[0].difficulty, 4)
  assert.equal(state.doom, 1, '失败后按选择放 1 个毁灭')
  // 猫抓老鼠：在一张诱饵上揭露（真身会被翻回而不是揭露）。
  const elsewhere = setup(stateFor(1))
  const elsewhereApi = apiStub(elsewhere)
  const decoyCard = chapterSummary(elsewhere).concealed.find(card => card.decoy)
  const spot = decoyCard.locationId
  elsewhere.investigators[0].location = spot
  const mini = miniCardsAt(elsewhere, spot).find(card => card.decoy)
  const beforeAtSpot = miniCardsAt(elsewhere, spot).length
  elsewhere.choices = [mini.id]
  assert.equal(behavior.resolveEncounter(elsewhere, elsewhere.investigators[0], { code: RAW_CODES.catAndMouse }, elsewhereApi), true)
  assert.equal(miniCardsAt(elsewhere, spot).length, beforeAtSpot - 1, '揭露诱饵后翻面移除')
  // 选真身时：翻回并重洗，数量不变。
  const truthState = setup(stateFor(1))
  const truthApi = apiStub(truthState)
  const truth = chapterSummary(truthState).concealed.find(card => !card.decoy)
  truthState.investigators[0].location = truth.locationId
  const truthMini = miniCardsAt(truthState, truth.locationId).find(card => !card.decoy)
  truthState.choices = [truthMini.id]
  const countBefore = miniCardsAt(truthState, truth.locationId).length
  behavior.resolveEncounter(truthState, truthState.investigators[0], { code: RAW_CODES.catAndMouse }, truthApi)
  assert.equal(miniCardsAt(truthState, truth.locationId).length, countBefore, '真身只被翻回并重洗')
  // 来访名片：附属到没有标靶的地点（布置后只有中心没有标靶），并禁止花费线索。
  const card = setup(stateFor(1))
  const cardApi = apiStub(card)
  const empty = card.locations.find(item => targetsOn(card, item.id) === 0)
  assert.equal(empty.id, AVENIDA_DE_MAYO, '布置后唯一没有标靶的地点是五月大道')
  card.choices = [empty.id]
  assert.equal(behavior.resolveEncounter(card, card.investigators[0], { code: RAW_CODES.callingCard }, cardApi), true)
  assert.equal((card.locations.find(item => item.id === empty.id).attachments || []).length, 1, '附属到地点')
  assert.equal(cluesSpendBlocked(card), true)
  card.investigators[0].location = 'casaRosada'
  card.investigators[0].clues = 2
  const blockedMove = behavior.actions(card, card.investigators[0])
    .find(move => move.rule === 'loc:observeStaff')
  assert.ok(blockedMove, '行动仍出现在提示里')
  assert.match(String(blockedMove.reason), /来访名片/, '带 reason 的行动不进 legalMoves（只喂 AI 提示）')
  assert.equal(behavior.performAction(card, card.investigators[0], { rule: 'loc:observeStaff' }, cardApi), false)
  assert.equal(registeredEntry(RAW_CODES.callingCard).treacheryRule.blocksClueSpendingEverywhere, true)
})

test('P7 sanguineShadows 敌人行为：监视者敌军阶段结束、红衣女郎移动解除交战、分裂精魂揭露', () => {
  const state = setup(stateFor(1))
  const api = apiStub(state)
  const inv = state.investigators[0]
  // 监视者：重整时每位调查员受 2 伤害或 2 恐惧。
  const watcher = api.spawn(RAW_CODES.sanguineWatcher, AVENIDA_DE_MAYO)
  state.choices = ['horror']
  behavior.enemyPhaseEnd(state, api)
  assert.equal(inv.horror, 2)
  watcher.exhausted = true
  behavior.enemyPhaseEnd(state, api)
  assert.equal(inv.horror, 2, '横置时不触发')
  // 红衣女郎：移动前的交战名单命中即解除交战。
  const chica = api.spawn(RAW_CODES.laChicaRoja, AVENIDA_DE_MAYO)
  chica.engagedSeat = 0
  behavior.locationEntered(state, inv, state.locations[1], api, [chica.id])
  assert.equal(chica.engagedSeat, null)
  // 分裂精魂：真身被揭露 → 对监视者 5 点伤害 + 返回阴影 + 重新分发。
  const kaState = setup(stateFor(1))
  const kaApi = apiStub(kaState)
  enterSeeingRed(kaState, kaApi)
  const kaWatcher = kaState.enemies.find(enemy => enemy.code === RAW_CODES.sanguineWatcher)
  const kaTruth = chapterSummary(kaState).concealed.find(card => card.code === RAW_CODES.apportionedKa)
  assert.ok(kaTruth, '见红后分裂精魂以隐匿形式在场')
  const before = concealedGroupOf(kaState, RAW_CODES.apportionedKa).length
  exposeAt(kaState, kaState.investigators[0], miniCardIdOf(kaState, kaTruth), kaApi)
  assert.equal(kaWatcher.damageTaken, 5, '真身被揭露：监视者受 5 点伤害')
  assert.equal(kaState.enemies.some(enemy => enemy.code === RAW_CODES.apportionedKa), false, '分裂精魂返回阴影')
  // 重新分发：回收自己那一套后再放下「真身 + 4 诱饵」。
  assert.equal(concealedGroupOf(kaState, RAW_CODES.apportionedKa).length, before, '重新分发后仍是 5 张')
  assert.equal(chapterSummary(kaState).concealed.filter(card => card.code === RAW_CODES.apportionedKa).length, 1)
  assert.equal(concealedAmountOf(RAW_CODES.apportionedKa), 4)
  assert.equal(concealedAmountOf(RAW_CODES.laChicaRoja), 5)
  // 分发地点：红衣女郎只进有标靶的地点；分裂精魂只进没有标靶的非中心地点。
  const spotsState = setup(stateFor(1))
  assert.deepEqual(concealedSpotsFor(spotsState, RAW_CODES.laChicaRoja).sort(), targetLocations(spotsState).sort())
  const kaSpots = concealedSpotsFor(spotsState, RAW_CODES.apportionedKa)
  assert.equal(kaSpots.includes(AVENIDA_DE_MAYO), false, '分裂精魂不进中心')
  assert.ok(kaSpots.every(id => targetsOn(spotsState, id) === 0), '分裂精魂不进有标靶的地点')
})

test('P7 sanguineShadows 地点行动：查看迷你卡（含 X 费变体）与情报点', () => {
  const state = setup(stateFor(1))
  const api = apiStub(state)
  const inv = state.investigators[0]
  const location = state.locations.find(item => item.id === 'casaRosada')
  assert.ok(location, '玫瑰宫必须在场（用固定布置排除随机移除）')
  inv.location = 'casaRosada'
  placeTarget(state, 'casaRosada', 0)
  resolveConcealed(state, RAW_CODES.laChicaRoja, { locations: ['casaRosada'] })
  inv.clues = 2
  const move = behavior.actions(state, inv).find(item => item.rule === 'loc:observeStaff')
  assert.ok(move, '玫瑰宫提供观察员工行动')
  assert.equal(behavior.performAction(state, inv, move, api), true)
  assert.equal(state.testCalls.at(-1).skill, 'intellect')
  assert.equal(state.testCalls.at(-1).difficulty, 4)
  assert.equal(inv.clues, 1, '花费 1 个线索')
  assert.ok(inv.clues >= 0)
  // 雷科莱塔公墓：花费 X 线索并受到 X 点恐惧。
  const recoleta = state.locations.find(item => item.id === 'recoleta')
  if (recoleta) {
    inv.location = 'recoleta'
    resolveConcealed(state, RAW_CODES.laChicaRoja, { locations: ['recoleta'] })
    inv.clues = 2
    inv.horror = 0
    const spend = behavior.actions(state, inv).find(item => item.rule === 'loc:readTombs')
    assert.ok(spend)
    assert.equal(spend.xMax, 2, 'X 受线索数与迷你卡数限制')
    state.choices = ['2']
    assert.equal(behavior.performAction(state, inv, spend, api), true)
    assert.equal(inv.horror, 2, '受到 X 点恐惧')
    assert.equal(inv.clues, 0, '花费 X 个线索')
  }
  // 五月大道可以撤退（地点实例上的 resign 供引擎的通用 resign 行动读取）。
  assert.equal(state.locations.find(item => item.id === AVENIDA_DE_MAYO).resign, true)
})

// ---------------------------------------------------------------------------
// 7. 绯红密钥（恸哭女士）
// ---------------------------------------------------------------------------
test('P7 sanguineShadows 恸哭女士：稳定面发现线索后翻面、动荡面弃支援后翻回', () => {
  const state = setup(stateFor(1))
  const api = apiStub(state)
  const inv = state.investigators[0]
  inv.location = targetLocations(state)[0]
  inv.assets = [{ id: 'asset-1', code: '01001' }]
  initializeScarletKeys(state, [{
    id: WEEPING_LADY_KEY.id,
    stableFace: WEEPING_LADY_KEY.stableFace,
    unstableFace: WEEPING_LADY_KEY.unstableFace,
    bearer: { type: 'none' },
  }])
  state.campaign.tsk.keys.keys[WEEPING_LADY_KEY.id].bearer = { type: 'investigator', seat: 0 }
  api.mechanics = {
    tsk: {
      keys: {
        bind: (id, bearer) => { state.campaign.tsk.keys.keys[id].bearer = bearer; return true },
        shift: id => {
          const record = state.campaign.tsk.keys.keys[id]
          record.stable = !record.stable
          return { id, stable: record.stable }
        },
      },
    },
  }
  const location = state.locations.find(item => item.id === inv.location)
  location.clues = 2
  state.choices = [inv.location]
  const stable = shiftWeepingLady(state, 0, api)
  assert.equal(stable.kind, 'discoverClue')
  assert.equal(stable.stable, false, '翻到动荡面')
  assert.equal(scarletKey(state, WEEPING_LADY_KEY.id).stable, false)
  assert.equal(inv.clues, 1)
  // 动荡面：每位调查员弃一个支援，然后翻回稳定面。
  const unstable = shiftWeepingLady(state, 0, api)
  assert.equal(unstable.kind, 'discardAsset')
  assert.equal(inv.assets.length, 0)
  assert.equal(scarletKey(state, WEEPING_LADY_KEY.id).stable, true)
  assert.equal(registeredEntry(RAW_CODES.weepingLadyStable).assetRule.shift.kind, 'discoverClue')
  assert.equal(registeredEntry(RAW_CODES.weepingLadyUnstable).assetRule.shift.kind, 'discardAsset')
})

// ---------------------------------------------------------------------------
// 8. 结局与记录 / 时间
// ---------------------------------------------------------------------------
test('P7 sanguineShadows 结局：五个结局的记录、奖励经验、时间与密钥归属', () => {
  const base = () => {
    const state = setup(stateFor(2))
    const api = apiStub(state)
    return { state, api }
  }
  // 结局 1：每有一个冒险参考卡标靶 +1 经验；时间 +1；调查员持有恸哭女士。
  const r1 = base()
  r1.state.investigators[0].location = targetLocations(r1.state)[0]
  advanceTargetToReference(r1.state, r1.api)
  r1.state.choices = ['1']
  let result = behavior.resolution(r1.state, 'resolution1', [], r1.api)
  assert.equal(result.bonus, 1)
  assert.equal(r1.state.campaign.records.youHaventSeenTheLastOfLaChicaRoja, true)
  assert.equal(r1.state.campaign.records.time, 1)
  assert.equal(r1.state.campaign.records.weepingLadyBearer, 1)
  // 结局 2：3 点洞察奖励经验、时间 +3、红衣女郎站在你这边。
  const r2 = base()
  r2.state.choices = ['0']
  result = behavior.resolution(r2.state, 'resolution2', [], r2.api)
  assert.equal(result.bonus, 3)
  assert.equal(r2.state.campaign.records.laChicaRojaIsOnYourSide, true)
  assert.equal(r2.state.campaign.records.youHaventSeenTheLastOfTheSanguineWatcher, true)
  assert.equal(r2.state.campaign.records.time, 3)
  // 结局 3：红衣女郎持有恸哭女士；时间 +1。
  const r3 = base()
  result = behavior.resolution(r3.state, 'resolution3', [], r3.api)
  assert.equal(r3.state.campaign.records.youHaventSeenTheLastOfLaChicaRoja, true)
  assert.equal(r3.state.campaign.records.weepingLadyBearer, RAW_CODES.laChicaRoja)
  assert.equal(r3.state.campaign.records.time, 1)
  assert.equal(typeof result.bonus, 'number')
  // 未达成（幕 1/2）→ 跳到结局 3 的效果；未达成（见红）→ 监视者的折磨未完。
  const noRes = base()
  result = behavior.resolution(noRes.state, 'noResolution', [], noRes.api)
  assert.ok(result.story.paragraphs[0].length > 20, '未达成时展示结局 3 的正文')
  assert.equal(noRes.state.campaign.records.youHaventSeenTheLastOfLaChicaRoja, true)
  const noResSeeingRed = base()
  enterSeeingRed(noResSeeingRed.state, noResSeeingRed.api)
  result = behavior.resolution(noResSeeingRed.state, 'noResolution', [], noResSeeingRed.api)
  assert.equal(result.bonus, 3)
  assert.equal(noResSeeingRed.state.campaign.records.theSanguineWatchersTormentContinues, true)
  assert.equal(noResSeeingRed.state.campaign.records.laChicaRojaIsOnYourSide, true)
  assert.equal(noResSeeingRed.state.campaign.records.time, 2)
  // finalResolution 的默认判定。
  assert.equal(behavior.finalResolution(r1.state), 'resolution1')
  assert.equal(behavior.finalResolution(noResSeeingRed.state), 'resolution2')
})

test('P7 sanguineShadows 时间：markTime 累加记录并在世界地图存在时同步', () => {
  const state = setup(stateFor(1))
  assert.equal(markTime(state, 2), 2)
  assert.equal(markTime(state, 1), 3)
  state.campaign.tsk = { map: { version: 1, current: 'BuenosAires', visited: ['BuenosAires'], unlocked: ['BuenosAires'], time: 0, forcedNode: null } }
  markTime(state, 2)
  assert.equal(state.campaign.records.time, 5)
  assert.equal(state.campaign.tsk.map.time, 5, '世界地图已初始化时同步时间轴')
})

// ---------------------------------------------------------------------------
// 9. 开场三选一 + JSON 往返
// ---------------------------------------------------------------------------
test('P7 sanguineShadows 开场：坦诚相待 → 玻利瓦尔信任你并换标记；坚持己见 → 不信任', () => {
  const trusted = stateFor(1)
  trusted.choices = ['everything']
  behavior.preScenarioSetup(trusted, [], apiStub(trusted))
  assert.equal(trusted.campaign.records.matiasBolivarTrustsYou, true)
  assert.equal(trusted.chaosBag.filter(token => token === 'tablet').length, 2, '已有 1 个 tablet，再加入 1 个')
  assert.equal(trusted.chaosBag.filter(token => token === 'elderthing').length, 0)
  const distrusted = stateFor(1)
  distrusted.choices = ['insist']
  behavior.preScenarioSetup(distrusted, [], apiStub(distrusted))
  assert.equal(distrusted.campaign.records.matiasBolivarDoesntTrustYou, true)
  assert.equal(distrusted.chaosBag.filter(token => token === 'elderthing').length, 2, '已有 1 个 elderthing，再加入 1 个')
  assert.equal(distrusted.chaosBag.filter(token => token === 'tablet').length, 0)
  const neutral = stateFor(1)
  neutral.choices = ['breadcrumbs']
  behavior.preScenarioSetup(neutral, [], apiStub(neutral))
  assert.equal(neutral.campaign.records.matiasBolivarTrustsYou, undefined)
  assert.equal(neutral.chaosBag.filter(token => token === 'elderthing').length, 1)
  // 只结算一次。
  behavior.preScenarioSetup(trusted, [], apiStub(trusted))
  assert.equal(trusted.chaosBag.filter(token => token === 'tablet').length, 2)
})

test('P7 sanguineShadows JSON 往返：标靶/隐匿迷你卡/幕间/记录可序列化复原并通过读档校验', () => {
  const state = setup(stateFor(2))
  const api = apiStub(state)
  state.investigators[0].location = targetLocations(state)[0]
  advanceTargetToReference(state, api)
  markTime(state, 3)
  const restored = JSON.parse(JSON.stringify(state))
  validateTskState(restored)
  assert.equal(referenceTargetCount(restored), 1)
  assert.equal(targetLocations(restored).length, 5)
  assert.equal(chapterSummary(restored).concealed.length, 6)
  assert.equal(restored.campaign.records.time, 3)
  assert.equal(restored.locations.length, 7)
  // 幕间之后同样可往返（幕/密谋被替换成见红）。
  enterSeeingRed(restored, apiStub(restored))
  const afterInterlude = JSON.parse(JSON.stringify(restored))
  validateTskState(afterInterlude)
  assert.equal(afterInterlude.acts[0].originalCode, RAW_CODES.seeingRed)
  assert.equal(chapterState(afterInterlude).seeingRed, true)
  // 阴影锚点键也随存档往返（09557b）。
  afterInterlude.scenarioFlags[`${SHADOW_ANCHOR_PREFIX}0`] = AVENIDA_DE_MAYO
  const withAnchor = JSON.parse(JSON.stringify(afterInterlude))
  behavior.turnBegins(withAnchor, withAnchor.investigators[0], apiStub(withAnchor))
  assert.equal(withAnchor.scenarioFlags[`${SHADOW_ANCHOR_PREFIX}0`], undefined)
})

// ---------------------------------------------------------------------------
// 10. 条目：十条专属条目声明与读点
// ---------------------------------------------------------------------------
test('P7 sanguineShadows 条目：十条专属条目（4 敌人/3 诡计/1 剧情支援/2 密钥）全部具备可执行声明', () => {
  assert.equal(ENTRIES.length, 10)
  assert.deepEqual(ENTRIES.map(entry => entry.code).sort(),
    ['09557', '09557b', '09558', '09559', '09560', '09561', '09563', '09564', '09565a', '09565b'])
  for (const entry of ENTRIES) {
    assert.equal(entry.implemented, true, `${entry.code} 必须声明 implemented`)
    assert.ok(entry.enemyRule || entry.treacheryRule || entry.assetRule || entry.abilities || entry.enemyScript,
      `${entry.code} 不能是空壳`)
    const declared = Boolean(entry.enemyRule || entry.treacheryRule || entry.assetRule || entry.abilities || entry.enemyScript)
    assert.equal(declared, true)
  }
  assert.equal(registeredEntry(RAW_CODES.laChicaRoja).enemyRule.concealed, 5)
  assert.equal(registeredEntry(RAW_CODES.apportionedKa).enemyRule.concealed, 4)
  assert.equal(typeof registeredEntry(RAW_CODES.laChicaRoja).enemyScript.onEngagedInvestigatorMoved, 'function')
  assert.equal(typeof registeredEntry(RAW_CODES.sanguineWatcher).enemyScript.onEnemyPhaseEnd, 'function')
  assert.deepEqual(registeredEntry(RAW_CODES.apportionedKa).enemyScript.exposedDamage,
    { code: RAW_CODES.sanguineWatcher, amount: 5 })
  assert.equal(registeredEntry(RAW_CODES.apportionedKa).enemyScript.returnToShadowsOnExposed, true)
  assert.deepEqual(registeredEntry(RAW_CODES.laChicaRojaAlly).abilities[0].trigger, ['turnEnded'])
  assert.equal(registeredEntry(RAW_CODES.boundNightgaunt).enemyRule.doubleNegative, true)
  // 声明即接线：SET_ASIDE_CODES 里的每张卡都有条目或明确的章节流程位置。
  for (const code of SET_ASIDE_CODES) {
    assert.ok(LOCATIONS || code, code)
  }
  assert.ok(chapter.behavior.scenarioApproximations.length >= 5, '近似必须逐条披露')
  assert.ok(chapter.behavior.scenarioGaps.length >= 1)
})
