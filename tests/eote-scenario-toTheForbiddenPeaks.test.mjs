// 失落之峰（toTheForbiddenPeaks · 08596）章节测试（P7）。
//
// 两层证据：
//   1. 章节钩子（behavior）—— 布置/放一边、地点 Level 与连接、攀登原语、幕/议程流程、
//      混乱标记与符号后果、代表遭遇卡、结局记录、JSON 存档往返；
//   2. 正文结构 —— story-text 生成物的章节正文可读（不锁具体译文，p2-flow 可重生成）。
//
// 索引由 Lead 合并后重建，因此本测试用动态 import + registerCardAbilities 显式登记本章条目
// （已登记则跳过），使 behavior 里的 actRule/agendaRule/locationRule/treacheryRule 读点生效。
import test from 'node:test'
import assert from 'node:assert/strict'
import { registerCardAbilities, registeredEntry } from '../src/engine/ability.js'
import { chapterStory, storyText, resolutionText } from '../content/campaigns/edgeOfTheEarth/story-access.js'
import * as chapter from '../content/campaigns/edgeOfTheEarth/scenarios/toTheForbiddenPeaks/index.js'
import {
  scenario as definition, LOCATIONS, MOUNTAINSIDE_IN_PLAY, SET_ASIDE_CODES, RAW_CODES,
  START_LOCATION, SUMMIT, TREACHERY_CODES,
} from '../content/campaigns/edgeOfTheEarth/scenarios/toTheForbiddenPeaks/definition.js'
import {
  TO_THE_FORBIDDEN_PEAKS_TOKEN_MEANINGS, toTheForbiddenPeaksAfterTest, toTheForbiddenPeaksChaosToken,
} from '../content/campaigns/edgeOfTheEarth/scenarios/toTheForbiddenPeaks/chaos.js'
import { climbState } from '../src/engine/eote-climb.js'
import { locationLevel } from '../src/engine/vertical-chain.js'
import { discoverClueAt, enemyEvadeValue, enemyFightValue, enemyHealth, legalMoves } from '../src/engine/engine.js'

const ENTRIES = []
for (const code of chapter.behavior.implementedEncounterCodes) {
  const module = await import(`../src/cards/encounter-entries/edgeOfTheEarth/toTheForbiddenPeaks/${code}.js`)
  ENTRIES.push(module.default)
}
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
    numInvestigators: count,
    difficulty: 'standard',
    round: 1,
    currentSeat: 0,
    locations: Object.values(LOCATIONS).map(item => ({ ...clone(item), revealed: false })),
    investigators: Array.from({ length: count }, (_, seat) => ({
      seat, code: '01001', name: `调查员${seat + 1}`, location: START_LOCATION, klass: 'survivor', traits: [],
      damage: 0, horror: 0, clues: 0, resources: 5, hand: [], assets: [], threat: [], engaged: [],
      deck: ['01001', '01002'], discard: [], actionsLeft: 3,
    })),
    enemies: [],
    storyAssets: [],
    encounterDeck: [...definition.encounterDeck],
    scenarioZones: {},
    scenarioFlags: {},
    chaosBag: [...chapter.manifest.chaosBags?.standard || []],
    campaign: { records: {}, investigators: Array.from({ length: count }, () => ({ trauma: { physical: 0, mental: 0 }, deck: [] })) },
    victoryDisplay: [],
    testResults: [],
    choices: [],
    finished: null,
    infos: [],
    log: [],
    tokenBags: {},
  }
  state.investigators.forEach(inv => { inv.deck = [...inv.deck] })
  return state
}

function apiStub(state, overrides = {}) {
  const api = {
    info: text => state.infos.push(String(text)),
    // 场景 runtime 的签名是 (seat, skill, difficulty, resolve, skillBonus?, source?, options?)；
    // 兼容能力 API 的 (…, { resolve }) 写法，避免测试 stub 掩盖签名错误。
    test: (seat, skill, difficulty, resolve, skillBonus = 0, source = null, options = {}) => {
      let callback = resolve
      if (callback && typeof callback === 'object') {
        options = callback
        callback = callback.resolve
      }
      const result = state.testResults.shift() || { success: true, value: difficulty + 1, difficulty }
      if (typeof callback === 'function') callback(result)
      else options?.resolve?.(result)
      return result
    },
    choice: options => state.choices.shift() ?? options?.options?.[0]?.id ?? null,
    choose: options => api.choice(options),
    finish: key => { state.finished = key },
    resign: seat => { state.investigators[seat].resigned = true },
    takeFromSetAside: () => {},
    shuffleIntoEncounterDeck: codes => state.encounterDeck.push(...codes),
    shuffleDiscard: () => {},
    cardReveal: () => {},
    harm: (seat, amount = {}) => {
      const inv = state.investigators[seat]
      inv.damage = (inv.damage || 0) + (amount.damage || 0)
      inv.horror = (inv.horror || 0) + (amount.horror || 0)
    },
    damageEnemy: (enemy, amount = 1) => { if (enemy) enemy.damageTaken = (enemy.damageTaken || 0) + amount },
    gainResources: (seat, amount) => { state.investigators[seat].resources += amount },
    drawCards: (seat, amount = 1) => {
      const inv = state.investigators[seat]
      for (let i = 0; i < amount; i += 1) { const card = inv.deck.pop(); if (card) inv.hand.push(card) }
    },
    addChaosToken: token => state.chaosBag.push(token),
    spendUses: (source, amount = 1) => { source.uses = Math.max(0, (source.uses || 0) - amount) },
    surge: card => { state.scenarioFlags.surge = true },
    threat: () => {},
    ...overrides,
  }
  return api
}
const info = () => {}
const setup = state => { chapter.behavior.setupLocations(state, [], { info }); return state }
const findByCode = (state, code) => state.locations.find(item => item.originalCode === code)

// ---------------------------------------------------------------------------
// 1. manifest / 结构 / 正文
// ---------------------------------------------------------------------------
test('P7 toTheForbiddenPeaks 章节清单：development、地点/幕/议程/结局与正文可读', () => {
  assert.equal(chapter.manifest.id, 'toTheForbiddenPeaks')
  assert.equal(chapter.manifest.campaignId, 'edgeOfTheEarth')
  assert.equal(chapter.manifest.status, 'playable')
  assert.equal(chapter.manifest.referenceCode, '08596')
  assert.equal(chapter.scenario.originalCode, '08596')
  assert.equal(chapter.manifest.locations.length, 8)
  assert.deepEqual(chapter.manifest.acts.map(act => act.id), ['act1'])
  assert.deepEqual(chapter.manifest.agendas.map(agenda => agenda.id), ['agenda1', 'agenda2'])
  assert.deepEqual(chapter.manifest.resolutionIds, ['noResolution', 'resolution1', 'resolution2'])
  assert.equal(chapter.manifest.startLocationId, START_LOCATION)
  // p2-flow 生成物：章节正文可读（不锁译文）。
  const story = chapterStory('toTheForbiddenPeaks')
  assert.ok(story.sectionCount > 0, 'story-text 应包含本章 section')
  assert.equal(chapter.scenario.sectionCount, story.sectionCount)
  assert.ok(storyText('toTheForbiddenPeaks', 'setup').length > 20, 'setup 正文可读')
  assert.ok(resolutionText('toTheForbiddenPeaks', 'resolution1').length > 0, '结局 1 正文可读')
})

test('P7 toTheForbiddenPeaks 身份登记：地点/幕/议程/敌人/诡计都有原卡身份', () => {
  for (const category of ['locations', 'acts', 'agendas', 'enemies', 'treacheries', 'storyAssets']) {
    for (const [id, identity] of Object.entries(chapter.identities[category] || {})) {
      assert.ok(identity.originalCode, `${category}/${id} 缺少 originalCode`)
    }
  }
  assert.equal(chapter.identities.locations.deepDrifts.originalCode, '08600')
  assert.equal(chapter.identities.enemies['08608'].originalCode, '08608')
})

// ---------------------------------------------------------------------------
// 2. 布置：5 个山腰斜线 + 山顶；放一边 2 地点 + 星之恐怖；Expedition 支援按战役记录入场
// ---------------------------------------------------------------------------
test('P7 toTheForbiddenPeaks setup：斜线地点 Level 0–5、连接、线索/胜利点与放一边', () => {
  const state = setup(stateFor(2))
  // setup 返回 6 个入场地点（5 山腰 + 山顶）。
  const placed = chapter.behavior.setupLocations(state, [], { info })
  assert.equal(placed.length, 6)
  const levels = MOUNTAINSIDE_IN_PLAY.map(id => locationLevel(state.locations.find(item => item.id === id)))
  assert.deepEqual(levels, [0, 1, 2, 3, 4], '斜线 Level 从 0 到 4')
  assert.equal(locationLevel(state.locations.find(item => item.id === SUMMIT)), 5, '山顶 Level 5')
  const deep = findByCode(state, RAW_CODES.deepDrifts)
  const steep = findByCode(state, RAW_CODES.steepIncline)
  assert.equal(deep.clues, 3)
  assert.equal(deep.shroud, 1)
  assert.equal(deep.victory, 1)
  assert.ok(deep.connections.includes(steep.id), '上下相邻地点连接')
  assert.equal(deep.revealed, true, 'Level 0 开局揭示')
  // 放一边：2 个山腰地点 + 星之恐怖（P0-8：7 件探险支援不再永远躺在放一边区）。
  for (const code of [RAW_CODES.whiteBluff, RAW_CODES.windsweptPath, RAW_CODES.terrorOfTheStars]) {
    assert.ok(state.scenarioZones.setAside.includes(code), `放一边缺少 ${code}`)
  }
  for (const code of [RAW_CODES.greenSoapstone, RAW_CODES.dynamite, RAW_CODES.spareParts]) {
    assert.ok(!state.scenarioZones.setAside.includes(code), `Expedition 支援不应固定放一边：${code}`)
  }
  assert.equal(state.scenarioZones.setAside.filter(code => SET_ASIDE_CODES.includes(code)).length, SET_ASIDE_CODES.length)
})

test('P0-8 遭遇牌库：按 gather 组展开（本章 14 + 4 共享组 23 = 37 张），星之恐怖/忒咳哩-哩不入普通牌库', () => {
  const deck = chapter.scenario.encounterDeck
  const codes = new Set(deck)
  for (const code of ['08692', '08693', '08694', '08695', '08696', '08697', '08698', '08699', '08703', '08704', '08705']) {
    assert.ok(codes.has(code), `遭遇牌库缺少共享组卡 ${code}`)
  }
  assert.equal(deck.length, 37, '按印刷份数展开后的总张数')
  assert.ok(!codes.has(RAW_CODES.terrorOfTheStars), '星之恐怖是放一边剧情敌人')
  assert.ok(!codes.has('08723'), '忒咳哩-哩走独立牌库')
})

test('P0-8 遭遇定义：专属诡计补齐 entryRevelation/surge 与 campaignRule 结算接线', () => {
  for (const code of TREACHERY_CODES) {
    const definition = chapter.scenario.treacheries[code]
    assert.equal(definition.entryRevelation, true, `${code} 缺 entryRevelation（真实遭遇零结算）`)
    assert.deepEqual(definition.effect, { kind: 'campaignRule' }, `${code} 未接 behavior.resolveEncounter`)
  }
  for (const code of ['08692', '08693', '08694', '08697', '08703', '08704', '08705']) {
    assert.equal(chapter.scenario.treacheries[code]?.entryRevelation, true, `共享诡计 ${code} 缺 entryRevelation`)
  }
  // 敌人关键词由印刷文本派生（不再手抄 hunter/massive）。
  assert.equal(chapter.scenario.enemies[RAW_CODES.terrorOfTheStars].hunter, true)
  assert.equal(chapter.scenario.enemies[RAW_CODES.terrorOfTheStars].massive, true)
})

test('P0-8 Expedition 支援：按「Supplies Recovered」入场、其余放一边，且能力可被枚举', () => {
  const state = setup(stateFor(2))
  const assets = []
  const api = apiStub(state, {
    storyAsset: (code, location) => {
      const asset = { id: `story-${code}`, code, originalCode: code, location, exhausted: false }
      state.storyAssets.push(asset)
      assets.push(asset)
      return asset
    },
  })
  state.campaign.records.suppliesRecovered = ['08614', '08616', '08618', '08620']
  chapter.behavior.afterDeckSetup(state, [], { api })
  assert.deepEqual(state.storyAssets.map(asset => asset.code).sort(), ['08614', '08616', '08618', '08620'])
  for (const code of ['08615', '08617', '08619']) {
    assert.ok(state.scenarioZones.setAside.includes(code), `未回收支援 ${code} 应在放一边区`)
  }
  // afterDeckSetup 会照抄条目 uses（引擎 api.storyAsset 本身不带 uses）。
  const dynamite = state.storyAssets.find(asset => asset.code === '08616')
  assert.equal(dynamite.uses, 2)
  assert.equal(dynamite.usesType, 'supplies')
  // 七件支援条目都有可执行能力（046… 不再零能力）。
  const kinds = []
  for (const code of ['08614', '08615', '08616', '08617', '08618', '08619', '08620']) {
    const entry = registeredEntry(code)
    assert.ok(entry?.abilities?.length, `${code} 没有能力描述子`)
    kinds.push(`${code}:${entry.abilities[0].kind}`)
  }
  assert.equal(kinds.length, 7)
})

test('P0-8 真实移动语义：beforeMove→locationEntered 使「从下方进入」强制生效（无需 climb 原语标记）', () => {
  const state = setup(stateFor(1))
  const api = apiStub(state)
  const inv = state.investigators[0]
  findByCode(state, RAW_CODES.deepDrifts).clues = 0
  // 引擎 movement.js 的真实顺序：beforeMove（记录 from/to Level）→ 位移 → locationEntered。
  chapter.behavior.beforeMove(state, inv, 'steepIncline', api, { reason: 'move' })
  inv.location = 'steepIncline'
  const returned = chapter.behavior.locationEntered(state, inv, 'steepIncline', api)
  assert.equal(inv.damage, 1, '08602：从下方进入受到 1 点伤害（真实移动顺序）')
  assert.ok(returned?.enterFromBelow, '应返回从下方进入的强制效果结果')
  // 下行（Level 2 → 1）不应触发「从下方进入」。
  inv.location = 'narrowRidge'
  chapter.behavior.beforeMove(state, inv, 'steepIncline', api, { reason: 'move' })
  inv.location = 'steepIncline'
  const before = inv.damage
  chapter.behavior.locationEntered(state, inv, 'steepIncline', api)
  assert.equal(inv.damage, before, '下行不触发从下方进入')
})

test('P0-8 08607：cluesOnlyByInvestigation 位于 locationRule 顶层（引擎 locations.js 读点）', () => {
  const state = setup(stateFor(1))
  const inv = state.investigators[0]
  inv.location = SUMMIT
  const summit = state.locations.find(item => item.id === SUMMIT)
  summit.clues = 2
  const entry = registeredEntry('08607')
  assert.equal(entry.locationRule.cluesOnlyByInvestigation, true, '引擎读点是 locationRule 顶层字段')
  assert.equal(entry.locationRule.flags?.cluesOnlyByInvestigation, undefined, '不得再嵌在 flags 下')
  assert.equal(discoverClueAt(state, inv, 1, [], {}), false, '非调查发现被阻止')
  const allowed = discoverClueAt(state, state.investigators[0], 1, [], { investigation: true })
  assert.ok(allowed === 1 || allowed === true, '调查发现允许')
  assert.equal(state.locations.find(item => item.id === SUMMIT).clues, 1)
})

// ---------------------------------------------------------------------------
// 3. 攀登原语与「从下方进入」强制效果
// ---------------------------------------------------------------------------
test('P7 toTheForbiddenPeaks 攀登：Level ±1 校验、enterFromBelow 标记、从下方进入的地点强制效果', () => {
  const state = setup(stateFor(1))
  const api = apiStub(state)
  // 跨两层非法；逐层合法。
  assert.equal(chapter.behavior.ascend(state, state.investigators[0], 'narrowRidge'), false, '不能跨层攀登')
  const transition = chapter.behavior.ascend(state, state.investigators[0], 'steepIncline')
  assert.deepEqual({ from: transition.from, to: transition.to, direction: transition.direction, enterFromBelow: transition.enterFromBelow },
    { from: 'deepDrifts', to: 'steepIncline', direction: 'up', enterFromBelow: true })
  assert.equal(climbState(state).seats['0'].enterFromBelow, true)
  // 陡峭斜坡（08602）：从下方进入受到 1 点伤害。
  const inv = state.investigators[0]
  const before = inv.damage
  chapter.behavior.locationEntered(state, inv, 'steepIncline', api)
  assert.equal(state.investigators[0].damage, before + 1, '陡峭斜坡：从下方进入受到 1 点伤害')
  // 迷宫/失控类：下行不触发「从下方进入」。
  chapter.behavior.descend(state, state.investigators[0], 'deepDrifts')
  const damaged = state.investigators[0].damage
  chapter.behavior.locationEntered(state, state.investigators[0], 'deepDrifts', api)
  assert.equal(state.investigators[0].damage, damaged, '下行不触发从下方进入')
})

test('P7 toTheForbiddenPeaks 山腰背面：下方地点有线索时不能进入（moveError）', () => {
  const state = setup(stateFor(1))
  // 山腰背面：下方地点还有线索 → 不能进入；清空后可以进入。
  assert.match(chapter.behavior.moveError(state, state.investigators[0], 'steepIncline'), /线索/)
  findByCode(state, RAW_CODES.deepDrifts).clues = 0
  assert.equal(chapter.behavior.moveError(state, state.investigators[0], 'steepIncline'), null)
})

// ---------------------------------------------------------------------------
// 4. 议程/幕：移动归还线索、星之恐怖背面、结局
// ---------------------------------------------------------------------------
test('P7 toTheForbiddenPeaks 议程 1：移动后归还线索（locationEntered 真实读点）；背面放置星之恐怖到最高地点', () => {
  const state = setup(stateFor(2))
  const api = apiStub(state)
  state.investigators[0].clues = 3
  // 08597/08598 的强制效果读点是引擎 locationEntered（旧 afterMove 无调用点）。
  assert.equal(typeof chapter.behavior.afterMove, 'undefined', 'artifact：死钩子 afterMove 已删除')
  chapter.behavior.locationEntered(state, state.investigators[0], state.investigators[0].location, api)
  assert.equal(state.investigators[0].clues, 0, '移动后所有线索放回供应堆')
  // 让一位调查员位于最高处，背面在其地点放置星之恐怖。
  state.investigators[0].location = 'snowCoveredCrag'
  state.investigators[1].location = 'deepDrifts'
  chapter.behavior.agendaReveal(state, state.agendas[0], api)
  const terror = state.enemies.find(enemy => enemy.code === RAW_CODES.terrorOfTheStars)
  assert.ok(terror, '星之恐怖入场')
  assert.equal(terror.location, 'snowCoveredCrag', '位于最高且有调查员的地点')
  // 议程 2 背面：有调查员撤退 → 结局 1，否则结局 2。
  assert.equal(chapter.behavior.finalResolution(state), 'resolution2')
  state.investigators[1].resigned = true
  assert.equal(chapter.behavior.finalResolution(state), 'resolution1')
  chapter.behavior.agendaReveal(state, state.agendas[1], api)
  assert.equal(state.finished, 'resolution1')
})

test('P7 toTheForbiddenPeaks 幕 1：目标为所有未被击败的调查员撤退；背面进入结局 1', () => {
  const state = setup(stateFor(2))
  const api = apiStub(state)
  assert.equal(chapter.behavior.checkObjectives(state), false)
  state.investigators[0].resigned = true
  assert.equal(chapter.behavior.checkObjectives(state), false, '还有未撤退的调查员')
  state.investigators[1].resigned = true
  assert.equal(chapter.behavior.checkObjectives(state), true)
  chapter.behavior.actReveal(state, state.acts[0], api)
  assert.equal(state.finished, 'resolution1')
})

test('P7 toTheForbiddenPeaks 山顶撤退行动：探险支援加入胜利区、线索归零', () => {
  const state = setup(stateFor(1))
  const api = apiStub(state)
  const inv = state.investigators[0]
  inv.location = SUMMIT
  inv.clues = 2
  inv.assets = [{ id: 'a1', code: RAW_CODES.greenSoapstone, originalCode: RAW_CODES.greenSoapstone, uses: 4, usesType: 'charges' }]
  const moves = chapter.behavior.actions(state, inv, api)
  assert.ok(moves.some(move => move.rule === 'summitResign'), '山顶提供撤退行动')
  chapter.behavior.performAction(state, inv, { rule: 'summitResign' }, api)
  assert.equal(state.victoryDisplay.length, 1, '探险支援加入胜利区')
  assert.equal(state.investigators[0].clues, 0)
  assert.equal(state.investigators[0].resigned, true)
})

// ---------------------------------------------------------------------------
// 5. 代表遭遇卡（treacheryRule.resolveKind 数据驱动）
// ---------------------------------------------------------------------------
test('P7 toTheForbiddenPeaks 代表遭遇卡：降雪/雪崩/悬于边缘/低温症', () => {
  const state = setup(stateFor(1))
  const api = apiStub(state)
  // 08610 降雪：所在地点放 2 线索。
  const startClues = findByCode(state, RAW_CODES.deepDrifts).clues
  chapter.behavior.resolveEncounter(state, state.investigators[0], { code: RAW_CODES.snowfall }, api)
  assert.equal(findByCode(state, RAW_CODES.deepDrifts).clues, startClues + 2)
  // 08612 悬于边缘：失败 2 伤害并移动到下方。
  state.investigators[0].location = 'narrowRidge'
  state.testResults = [{ success: false, value: 1, difficulty: 3 }]
  chapter.behavior.resolveEncounter(state, state.investigators[0], { code: RAW_CODES.hangingOnTheEdge }, api)
  assert.equal(state.investigators[0].damage, 2)
  assert.equal(state.investigators[0].location, 'steepIncline', '失败后移动到下方')
  // 08613 低温症：失败选择加入 frost 标记。
  state.choices = ['frost']
  state.testResults = [{ success: false, value: 1, difficulty: 3 }]
  chapter.behavior.resolveEncounter(state, state.investigators[0], { code: RAW_CODES.hypothermia }, api)
  assert.ok(state.chaosBag.includes('frost'), '低温症失败加入 frost')
  // 08611 雪崩：失败时逐层向下移动（每层一次检定）。
  const avalancheState = setup(stateFor(1))
  avalancheState.investigators[0].location = 'narrowRidge'
  avalancheState.testResults = [{ success: false, value: 0, difficulty: 2 }, { success: true, value: 2, difficulty: 1 }]
  chapter.behavior.resolveEncounter(avalancheState, avalancheState.investigators[0], { code: RAW_CODES.avalanche }, apiStub(avalancheState))
  assert.equal(avalancheState.investigators[0].location, 'deepDrifts')
})

// ---------------------------------------------------------------------------
// 6. 混乱标记与轮末
// ---------------------------------------------------------------------------
test('P7 toTheForbiddenPeaks 混乱标记：skull=-Level、困难 -Level-2、符号后果与轮末强制', () => {
  const state = setup(stateFor(2))
  state.investigators[0].location = 'rockyLedge' // Level 3
  assert.deepEqual(toTheForbiddenPeaksChaosToken(state, state.investigators[0], 'skull'), { delta: -3 })
  state.difficulty = 'hard'
  assert.deepEqual(toTheForbiddenPeaksChaosToken(state, state.investigators[0], 'skull'), { delta: -5 })
  state.difficulty = 'standard'
  assert.equal(TO_THE_FORBIDDEN_PEAKS_TOKEN_MEANINGS.standard.cultist.rider, 'moveBelowOnFail')
  assert.deepEqual(toTheForbiddenPeaksAfterTest(state, state.investigators[0],
    { success: false, drawn: ['cultist'], cancelledTokens: [] }), ['moveBelow'])
  // 星之恐怖轮末：同地点调查员下移到下方。
  state.enemies = [{ id: 't', code: RAW_CODES.terrorOfTheStars, location: 'narrowRidge', exhausted: false }]
  state.investigators[0].location = 'narrowRidge'
  state.investigators[1].location = 'deepDrifts'
  chapter.behavior.roundEnded(state, apiStub(state))
  assert.equal(state.investigators[0].location, 'steepIncline')
  assert.equal(state.investigators[1].location, 'deepDrifts', '不同地点不受影响')
  // 敌人 X 值：印刷表 -2 是「X=所在地点高度（至少 1）」占位；引擎读数是「印刷值 + behavior 修正」。
  // 08609 在 Level 3：生命 X=3；战斗值保持印刷 3（X 只作用于生命）。
  const elder = {
    id: 'elder-x', code: RAW_CODES.constrictingElderThing, originalCode: RAW_CODES.constrictingElderThing,
    fight: 3, evade: 2, health: -2, damage: 0, horror: 0, exhausted: false, location: 'rockyLedge', traits: ['Monster', 'Elder Thing'],
  }
  state.investigators[0].location = 'rockyLedge'
  assert.equal(enemyHealth(state, elder), 3, '拘束型古老者生命 X=Level=3')
  assert.equal(enemyFightValue(state, elder, state.investigators[0]), 3, '战斗值不随 X 变化')
  const terror = {
    id: 'terror-x', code: RAW_CODES.terrorOfTheStars, originalCode: RAW_CODES.terrorOfTheStars,
    fight: -2, evade: -2, health: 3, damage: 0, horror: 0, exhausted: false, location: 'rockyLedge', traits: ['Monster', 'Eidolon', 'Elite'],
  }
  assert.equal(enemyFightValue(state, terror, state.investigators[0]), 3, '星之恐怖战斗 X=Level=3')
  assert.equal(enemyEvadeValue(state, terror, state.investigators[0]), 3, '星之恐怖躲避 X=Level=3')
  assert.equal(enemyHealth(state, terror), 3 + 3 * 2, '星之恐怖 +3[per_investigator] 生命')
})

// ---------------------------------------------------------------------------
// 7. JSON 存档往返
// ---------------------------------------------------------------------------
test('P7 toTheForbiddenPeaks JSON 存档往返：布置/攀登/线索状态可序列化复原', () => {
  const state = setup(stateFor(2))
  chapter.behavior.ascend(state, state.investigators[0], 'steepIncline')
  state.investigators[0].clues = 1
  state.scenarioFlags.hiddenTunnelRevealed = true
  const restored = JSON.parse(JSON.stringify(state))
  assert.deepEqual(restored.scenarioZones, state.scenarioZones)
  assert.deepEqual(restored.investigators[0].location, 'steepIncline')
  assert.deepEqual(climbState(restored).seats['0'].to, 'steepIncline')
  assert.deepEqual(restored.locations.map(item => item.level).filter(Number.isSafeInteger), [0, 1, 2, 3, 4, 5])
})
