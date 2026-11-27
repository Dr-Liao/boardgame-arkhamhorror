// 验收 08-a 分片 5（《地球边缘》08546–08573）：章节分派、幻景映射及实际引擎结算。
import test from 'node:test'
import assert from 'node:assert/strict'

import { enemyFightValue, enemyHealth, getMaxHealth, scenarioRuntime } from '../src/engine/engine.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import { contentRegistry } from '../content/registered.js'
import { asset, fixture, enemy, move, settle, legalMoves } from './core-fixture.mjs'
import { registeredEntry } from '../src/engine/ability.js'
import { entryFlags, enemyRuleFor } from '../src/cards/card-rules.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import * as fm from '../content/campaigns/edgeOfTheEarth/scenarios/fatalMirage/behavior.js'
import * as fmDef from '../content/campaigns/edgeOfTheEarth/scenarios/fatalMirage/definition.js'
import { fatalMirageChaosToken } from '../content/campaigns/edgeOfTheEarth/scenarios/fatalMirage/chaos.js'
import * as p3 from '../content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart3/behavior.js'
import * as p3Def from '../content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart3/definition.js'

const INV = (seat = 0) => ({
  seat, name: `调查员${seat + 1}`, location: null, damage: 0, horror: 0, clues: 0, resources: 5,
  assets: [], engaged: [], deck: [], discard: [], threat: [], defeated: false, resigned: false,
})
const stateFor = (n = 1, flags = {}) => ({
  investigators: Array.from({ length: n }, (_, seat) => INV(seat)),
  locations: [], enemies: [], encounterDeck: [], encounterDiscard: [], scenarioFlags: { ...flags },
  scenarioZones: {}, campaign: { leadSeat: 0, records: {}, completedSteps: [], trauma: {}, investigators: {} },
  victoryDisplay: [], doom: 0, difficulty: 'standard', numInvestigators: n,
  phase: 'investigation', round: 1, status: 'playing',
})
const apiOf = (overrides = {}) => ({
  info: () => {}, choose: request => request?.options?.[0]?.id ?? 'tekelili',
  randomValue: () => 0.5, ...overrides,
})
const setupFatalMirage = (state, overrides = {}) => {
  fm.setupScenario(state, { ...apiOf(overrides), shuffle: items => items })
  return state
}
const codeToLocation = Object.fromEntries(Object.entries(fmDef.LOCATIONS).map(([id, data]) => [String(data.code), id]))
const codeToStory = Object.fromEntries(Object.entries(fmDef.LOCATIONS).map(([id, data]) => [String(data.code), data.storyCode]))

// ---------------------------------------------------------------------------
// 地点 08556–08573（18）：Mirage 关键词（层级 / 目标映射 / 线索总量）真实读点。
// 各地点独特印刷效果另有生产路径用例。
// ---------------------------------------------------------------------------
const LOCATION_CODES = ['08556', '08557', '08558', '08559', '08560', '08561', '08562', '08563', '08564',
  '08565', '08566', '08567', '08568', '08569', '08570', '08571', '08572', '08573']
for (const code of LOCATION_CODES) {
  test(`08-a5 ${code} ${ALL_CARDS[code].nameZh}：Mirage 层级/目标映射/入场线索与卡面一致`, () => {
    const state = setupFatalMirage(stateFor(1))
    const id = codeToLocation[code]
    assert.ok(id, `${code} 应在本章地点表内`)
    const printed = /幻景(\d)/.exec(ALL_CARDS[code].textZh || '') || /Mirage (\d)/.exec(ALL_CARDS[code].text || '')
    assert.ok(printed, '印刷应有 Mirage 层级')
    const tier = Number(printed[1])
    assert.equal(entryFlags(code).tier, tier, '条目 flags.tier 与印刷层级一致')
    // 目标映射来自地点剧情卡（storyFlip）——真实读点 behavior.mirageTargets。
    const storyCode = codeToStory[code]
    const flip = entryFlags(storyCode)?.storyFlip || {}
    const expected = flip.memoryEnemy
      ? [{ kind: 'enemy', code: String(flip.memoryEnemy) }]
      : (flip.choices || []).filter(choice => fmDef.LOCATIONS[choice]).map(choice => ({ kind: 'location', id: choice }))
    assert.deepEqual(fm.mirageTargets(id), expected, 'Mirage 目标 = 对应剧情卡声明的选项')
    // 入场线索 = max(0, 印刷基础线索 - 层级 × 已入场/已放逐目标数) × 人数；尚未有目标在场。
    const base = Number(fmDef.LOCATIONS[id].clues) || 0
    assert.equal(fm.mirageClueTotal(state, id), Math.max(0, base - tier * 0), '未翻开任何目标时线索总量')
  })
}

// ---------------------------------------------------------------------------
// 剧情卡 08556b–08572b（17）：翻面后「放置指定地点 / 生成记忆敌人 / 放逐并进胜利区」
// 与卡面条目数据一致（真实读点 behavior.flipStoryFace ← 引擎 locationStory/enemyDefeated）。
// ---------------------------------------------------------------------------
const STORY_CODES = ['08556b', '08557b', '08558b', '08559b', '08560b', '08561b', '08562b', '08563b',
  '08564b', '08565b', '08566b', '08567b', '08568b', '08569b', '08570b', '08571b', '08572b']
for (const code of STORY_CODES) {
  test(`08-a5 ${code} ${ALL_CARDS[code].nameZh}：剧情卡翻面按卡面选项放置地点或生成记忆敌人`, () => {
    const parentCode = code.replace(/b$/, '')
    const parentId = codeToLocation[parentCode]
    const story = entryFlags(code)?.storyFlip
    assert.ok(story, '条目应声明 storyFlip 数据')
    const state = setupFatalMirage(stateFor(1))
    state.investigators[0].location = parentId
    if (story.memoryEnemy) {
      state.scenarioZones.setAside = [String(story.memoryEnemy)]
      const result = fm.flipStoryFace(state, code, apiOf(), { location: parentId })
      assert.equal(result.spawnEnemy, String(story.memoryEnemy), '伙伴活着 → 在本地生成记忆敌人')
      assert.ok(state.enemies.some(enemy => String(enemy.code) === String(story.memoryEnemy) && enemy.location === parentId))
      assert.equal(story.victoryOnBanish, true, '伙伴被划掉时本卡加入胜利区（victoryOnBanish）')
    } else {
      const choice = story.choices[0]
      assert.ok(fmDef.LOCATIONS[choice], '选项应是本章幻景地点')
      const result = fm.flipStoryFace(state, code, apiOf(), { location: parentId, choice })
      assert.deepEqual(result.placed, [choice], '按选项放置下一层记忆地点')
      const placed = state.locations.find(location => location.id === choice)
      assert.ok(placed, '地点已入场')
      assert.equal(placed.revealed, true, '剧情卡 placeRevealed：入场即揭示')
      assert.equal(story.placeRevealed, true)
    }
  })
}

// ---------------------------------------------------------------------------
// 议程 08550–08552：版本映射与背面结算（剩余调查员被击败/创伤/洗牌）。
// 正面快速移动在后面的真实行动用例覆盖。
// ---------------------------------------------------------------------------
test('08-a5 08550 虚灵纠缠（版本一）：背面击败剩余调查员并把忒咳哩-哩牌洗入牌库', () => {
  const state = setupFatalMirage(stateFor(2))
  assert.equal(fmDef.AGENDA_VERSION_CODES[1], '08550')
  assert.equal(registeredEntry('08550').flags.version, 1)
  assert.equal(fm.agendaReveal(state, { originalCode: '08550' }, apiOf()), true)
  assert.ok(state.investigators.every(inv => inv.defeated), '剩余调查员全部被击败')
  assert.equal(state.campaign.trauma?.[0]?.mental || 0, 0, '版本一不承受精神创伤')
})
test('08-a5 08551 虚灵纠缠（版本二）：背面可选精神创伤或洗入 2 张忒咳哩-哩牌', () => {
  const state = setupFatalMirage(stateFor(2))
  assert.equal(fmDef.AGENDA_VERSION_CODES[2], '08551')
  assert.equal(registeredEntry('08551').flags.version, 2)
  assert.equal(fm.agendaReveal(state, { originalCode: '08551' }, apiOf({ choose: () => 'trauma' })), true)
  assert.ok(state.investigators.every(inv => inv.defeated), '剩余调查员全部被击败')
  assert.equal(state.campaign.trauma[0].mental, 1, '选择承受 1 点精神创伤')
})
test('08-a5 08552 虚灵纠缠（版本三）：背面剩余调查员被击败并承受 1 点精神创伤', () => {
  const state = setupFatalMirage(stateFor(2))
  assert.equal(fmDef.AGENDA_VERSION_CODES[3], '08552')
  assert.equal(registeredEntry('08552').flags.version, 3)
  assert.equal(fm.agendaReveal(state, { originalCode: '08552' }, apiOf()), true)
  assert.ok(state.investigators.every(inv => inv.defeated), '剩余调查员全部被击败')
  assert.equal(state.campaign.trauma[1].mental, 1, '版本三承受 1 点精神创伤')
})

// ---------------------------------------------------------------------------
// 幕 08553–08555：直面内心恶魔后出现「推进当前幕」行动，背面进入结局 1。
// ---------------------------------------------------------------------------
for (const [version, code] of Object.entries(fmDef.ACT_VERSION_CODES)) {
  test(`08-a5 ${code} 旧事阴影（版本${version}）：直面内心恶魔后可推进幕，背面进入结局 1`, () => {
    const state = setupFatalMirage(stateFor(1))
    assert.equal(fmDef.ACT_VERSION_CODES[Number(version)], code)
    assert.equal(registeredEntry(code).flags.actVersion, true)
    state.scenarioFlags.fatalMirageMayAdvance = true
    const inv = state.investigators[0]
    const advance = fm.actions(state, inv).find(move => move.rule === 'fatalMirageAdvanceAct')
    assert.ok(advance, '直面内心恶魔后 actions 应给出推进幕行动')
    let advanced = 0
    assert.equal(fm.performAction(state, inv, advance, apiOf({ advanceAct: () => { advanced += 1 } })), true)
    assert.equal(advanced, 1, '真实调用 advanceAct')
    let finishCalls = 0
    assert.equal(fm.actReveal(state, { originalCode: code }, apiOf({ finish: () => { finishCalls += 1 } })), true)
    assert.equal(finishCalls, 1, '背面通过引擎 finish 钩子进入结局')
  })
}

// ---------------------------------------------------------------------------
// 08549 致命幻景（scenario）：混乱标记数值与失败追加效果（真实读点 behavior.resolveChaosToken/afterTest）。
// ---------------------------------------------------------------------------
test('08-a5 08549 致命幻景：剧情卡计数/密谋编号修正 skull，cultist 失败放线索', () => {
  const state = stateFor(1)
  const inv = state.investigators[0]
  inv.location = 'prisonOfMemories'
  state.locations = [{ id: 'prisonOfMemories', clues: 0, maxClues: 3 }]
  state.victoryDisplay = [{ code: '08556b' }, { code: '08557b' }]
  assert.equal(registeredEntry('08549').flags.tokenMeanings.skull != null, true, '条目声明 tokenMeanings 数据')
  assert.equal(fm.resolveChaosToken(state, inv, 'skull').delta, -2, '简单/普通：skull = -胜利区剧情卡数')
  state.difficulty = 'hard'
  assert.equal(fm.resolveChaosToken(state, inv, 'skull').delta, -3, '困难/专家：skull = -(剧情卡数 + 当前密谋编号)')
  state.difficulty = 'standard'
  inv.clues = 1
  const result = { success: false, difficulty: 2, value: 0, drawn: ['cultist'] }
  assert.deepEqual(fm.afterTest(state, inv, result, apiOf()), [{ token: 'cultist', rider: 'clueOnLocation' }])
  assert.equal(inv.clues, 0, '失败后失去 1 个线索')
  assert.equal(state.locations[0].clues, 1, '把 1 个线索放到所在地点')
})

// ---------------------------------------------------------------------------
// 08546 陷入围攻！（act）：幕目标 / 营地撤退行动 / 背面结局 1、2。
// 胜利区去向和计分在后面的真实战斗用例覆盖。
// ---------------------------------------------------------------------------
test('08-a5 08546 陷入围攻！：幕目标/营地撤退行动/背面结局 1 与结局 2', () => {
  const state = stateFor(2)
  state.acts = [{ originalCode: '08546' }]
  state.actIndex = 0
  state.scenarioFlags.camp = 'crashSite'
  state.locations = [{ id: 'crashSite', revealed: true }]
  state.investigators.forEach(inv => { inv.location = 'crashSite'; inv.clues = 2 })
  // 营地全组支付线索，只有发起行动的调查员撤退。
  const resign = p3.actions(state, state.investigators[0]).find(move => move.rule === 'campResign')
  assert.ok(resign, '营地应提供共同花 4 线索的撤退行动')
  assert.equal(p3.performAction(state, state.investigators[0], resign, apiOf()), true)
  assert.equal(state.investigators.reduce((sum, inv) => sum + inv.clues, 0), 0, '共同支付 4 线索')
  assert.equal(state.investigators[0].resigned, true)
  assert.equal(state.investigators[1].resigned, false)
  state.enemies = [{ code: p3Def.EIDOLON_ENEMY_CODES[0], defeated: false }]
  assert.equal(p3.checkObjectives(state, apiOf()), false, '仍有未撤退的调查员时目标未达成')
  // 幕目标：场上没有幻灵敌人 → 达标并推进。
  const noEnemy = stateFor(1)
  noEnemy.acts = [{ originalCode: '08546' }]
  let advanced = 0
  assert.equal(p3.checkObjectives(noEnemy, apiOf({ advanceAct: () => { advanced += 1 } })), true)
  assert.equal(advanced, 1, '无幻灵敌人时推进幕')
  // 背面结局 1（无幻灵敌人）/结局 2（通过撤退推进）。
  let first = null
  assert.equal(p3.actReveal(stateFor(1), { originalCode: '08546' }, apiOf({ finish: key => { first = key } })), true)
  assert.equal(first, 'resolution1')
  const resignedState = stateFor(1)
  resignedState.investigators[0].resigned = true
  resignedState.enemies = [{ code: p3Def.EIDOLON_ENEMY_CODES[0], originalCode: p3Def.EIDOLON_ENEMY_CODES[0], defeated: false }]
  let second = null
  assert.equal(p3.actReveal(resignedState, { originalCode: '08546' }, apiOf({ finish: key => { second = key } })), true)
  assert.equal(second, 'resolution2')
})

// ---------------------------------------------------------------------------
// 08547 渗出梦魇（enemy）：击败时移除底下所有面朝下卡（真实引擎读点
// enemies.js#defeatEnemy → behavior.enemyDefeated）；猎手和连接在后面的生产检验覆盖。
// ---------------------------------------------------------------------------
test('08-a5 08547 渗出梦魇：被击败时底下所有正面朝下的卡移出游戏', () => {
  const state = stateFor(1)
  const nightmare = { id: 'sn-1', code: '08547', originalCode: '08547', location: 'crashSite',
    beneath: ['08515', '08522'], beneathFaceDown: [true, true], defeated: false }
  state.enemies = [nightmare]
  assert.equal(enemyRuleFor('08547').removeBeneathOnDefeat, true, '条目 enemyRule 读点')
  assert.equal(p3.enemyDefeated(state, nightmare, apiOf()), false, '保留正常弃置流程')
  assert.deepEqual(nightmare.beneath, [], '底下卡全部移除')
  assert.deepEqual(state.scenarioZones.removed, ['08515', '08522'], '移出游戏（不是弃置）')
})


const STARTER = '01001'
const TEKELI_FACES = ['08723', '08724', '08725', '08726', '08727', '08728', '08729']

function productionState(id) {
  const scenario = contentRegistry.getScenarioData(id)
  assert.ok(scenario, '章节必须通过生产内容注册表可达')
  const state = fixture(STARTER)
  state.scenario = structuredClone(scenario)
  state.acts = structuredClone(scenario.acts)
  state.agendas = structuredClone(scenario.agendas)
  state.actIndex = 0
  state.agendaIndex = 0
  state.scenarioFlags = {}
  state.scenarioZones = {}
  state.victoryDisplay = []
  state.locations = []
  state.encounterDeck = []
  state.campaign.id = 'edgeOfTheEarth'
  return state
}

function mirageState(code, { shroud = 2, clues = 3 } = {}) {
  const state = productionState('fatalMirage')
  const location = fm.placeLocation(state, codeToLocation[code])
  Object.assign(location, { shroud, clues, maxClues: clues })
  state.investigators[0].location = location.id
  return { state, location: location.id }
}

function icyState() {
  const state = productionState('iceAndDeathPart3')
  state.scenarioFlags.camp = 'crashSite'
  state.locations = [
    { id: 'crashSite', name: '坠机点', revealed: true, connections: [], clues: 0, shroud: 2 },
    { id: 'frozenShore', name: '冰冻海岸', revealed: true, connections: [], clues: 0, shroud: 2 },
  ]
  state.investigators[0].location = 'crashSite'
  return state
}

function transact(state, execute, pick = () => null) {
  const invoke = draft => execute(draft, scenarioRuntime(draft, []))
  resolveTransaction(state, 0, { action: '08-a5-evidence' }, invoke)
  for (let count = 0; state.pendingChoice; count++) {
    assert.ok(count < 40, '验收选择必须在有限步数内完成')
    const choice = state.pendingChoice
    const optionId = pick(choice)
      ?? ['done', 'skip', 'self'].find(id => choice.options.some(option => option.id === id))
      ?? choice.options[0].id
    resolveTransaction(state, choice.seat, { action: 'choose', choiceId: choice.id, optionId }, invoke)
  }
}

function initTekeli(state) {
  scenarioRuntime(state, []).mechanics.tekeli.initialize({ cards: TEKELI_FACES })
}

function locationOf(state, id) {
  return state.locations.find(candidate => candidate.id === id)
}

test('08-a5 08546 陷入围攻：无胜利字样的幻灵以胜利 0 入区，原有胜利 1 仍计 1', () => {
  for (const code of ['08515', '08522']) {
    const state = icyState()
    initTekeli(state)
    state.acts = [{ id: 'act-08546', code: '08546', originalCode: '08546' }]
    const printed = ALL_CARDS[code].victory || 0
    const defeated = enemy(state, { code, originalCode: code, traits: ['Eidolon'], victory: printed, health: 1 })
    defeated.damageTaken = enemyHealth(state, defeated) - 1
    enemy(state, { code: '08547', originalCode: '08547', traits: ['Eidolon'], engagedSeat: null })
    const attack = legalMoves(state, 0).find(candidate => candidate.action === 'fight' && candidate.enemyId === defeated.id)
    assert.ok(attack, '可在场上攻击幻灵敌人')
    move(state, attack)
    settle(state)
    const trophy = state.victoryDisplay.find(card => (card.originalCode || card.code) === code)
    assert.ok(trophy, '获得胜利 0 的幻灵进入胜利区')
    assert.equal(trophy.victory, printed)
    assert.equal(state.victory, printed)
  }
})

test('08-a5 08547 渗出梦魇：无面朝下卡才猎手移动，同地点的幻灵也能走营地连接', () => {
  const state = icyState()
  locationOf(state, 'frozenShore').connections = ['crashSite']
  const nightmare = enemy(state, { code: '08547', originalCode: '08547', location: 'frozenShore',
    engagedSeat: null, traits: ['Eidolon'], beneath: ['08515'], beneathFaceDown: [true], hunter: false })
  transact(state, (draft, api) => api.resolveEnemyPhaseOf(draft.enemies.find(card => card.id === nightmare.id)))
  assert.equal(state.enemies.find(card => card.id === nightmare.id).location, 'frozenShore')
  state.enemies.find(card => card.id === nightmare.id).beneath = []
  state.enemies.find(card => card.id === nightmare.id).beneathFaceDown = []
  transact(state, (draft, api) => api.resolveEnemyPhaseOf(draft.enemies.find(card => card.id === nightmare.id)))
  assert.equal(state.enemies.find(card => card.id === nightmare.id).location, 'crashSite')
  state.enemies.find(card => card.id === nightmare.id).location = 'frozenShore'
  locationOf(state, 'frozenShore').connections = []
  const eidolon = enemy(state, { code: '08522', originalCode: '08522', traits: ['Eidolon'],
    location: 'frozenShore', hunter: true, engagedSeat: null })
  transact(state, (draft, api) => api.resolveEnemyPhaseOf(draft.enemies.find(card => card.id === eidolon.id)))
  assert.equal(state.enemies.find(card => card.id === eidolon.id).location, 'crashSite')
})

test('08-a5 08548 千变幻景：无梦魇涌动，且真实显现能从梦魇下生成一张敌人', () => {
  {
    const state = icyState()
    state.encounterDeck = ['dissonantVoices', '08548']
    transact(state, (draft, api) => api.drawEncounter(0))
    assert.deepEqual(state.encounterDeck, [], '涌动确实抽出下一张遭遇卡')
    assert.ok(state.investigators[0].threat.some(card => card.code === 'dissonantVoices'))
  }
  {
    const state = icyState()
    const nightmare = enemy(state, { code: '08547', originalCode: '08547', location: 'frozenShore',
      engagedSeat: null, beneath: ['08522'], beneathFaceDown: [true] })
    state.encounterDeck = ['08548']
    transact(state, (draft, api) => api.drawEncounter(0))
    assert.deepEqual(state.enemies.find(card => card.id === nightmare.id).beneath, [])
    assert.ok(state.enemies.some(card => (card.originalCode || card.code) === '08522' && card.location === 'frozenShore'))
  }
})

test('08-a5 08548 千变幻景：无垫牌梦魇立即移动攻击，结算后保持重整', () => {
  const state = icyState()
  locationOf(state, 'frozenShore').connections = ['crashSite']
  const nightmare = enemy(state, { code: '08547', originalCode: '08547', location: 'frozenShore',
    engagedSeat: null, beneath: [], beneathFaceDown: [], hunter: false, exhausted: false, damage: 1, horror: 1 })
  state.encounterDeck = ['08548']
  transact(state, (draft, api) => api.drawEncounter(0))
  const current = state.enemies.find(card => card.id === nightmare.id)
  assert.equal(current.location, 'crashSite')
  assert.equal(state.investigators[0].damage, 1)
  assert.equal(state.investigators[0].horror, 1)
  assert.equal(current.exhausted, false)
})

test('08-a5 08549 致命幻景：邪教徒标记失败后将调查员一个线索放到所在地', () => {
  const { state, location } = mirageState('08557', { shroud: 3, clues: 2 })
  state.investigators[0].clues = 1
  state.chaosBag = ['cultist']
  move(state, { action: 'investigate' })
  settle(state)
  assert.equal(state.lastTestResult.success, false)
  assert.equal(state.investigators[0].clues, 0)
  assert.equal(locationOf(state, location).clues, 3)
})

for (const code of ['08550', '08551', '08552']) {
  test('08-a5 ' + code + ' 虚灵纠缠：真实合法的免费能力支付恐惧并移动到记忆囚笼', () => {
    const { state } = mirageState('08557')
    assert.ok(fm.placeLocation(state, 'prisonOfMemories'))
    state.agendas = [{ id: 'agenda-' + code, code, originalCode: code, doomThreshold: 15 }]
    const actions = state.investigators[0].actionsLeft
    const action = legalMoves(state, 0).find(candidate => candidate.rule === 'fatalMirageReturnToPrison')
    assert.ok(action, '实际合法动作包含密谋提供的免费移动')
    move(state, action)
    settle(state)
    assert.equal(state.investigators[0].location, 'prisonOfMemories')
    assert.equal(state.investigators[0].horror, 1)
    assert.equal(state.investigators[0].actionsLeft, actions)
  })
}

test('08-a5 08557 大本营：调查恰好失败 1 点时付 1 恐惧使检定成功', () => {
  const { state, location } = mirageState('08557', { shroud: 4 })
  state.investigators[0].intellect = 3
  const reaction = choice => choice.options.find(option => option.label.includes('技能值 +1'))?.id
  move(state, { action: 'investigate' })
  settle(state, reaction)
  assert.equal(state.investigators[0].horror, 1)
  assert.equal(state.lastTestResult.success, true)
  assert.equal(locationOf(state, location).clues, 2)
})

test('08-a5 08558 菲奥多西亚号甲板：调查实际选择帷幕 +2 或再付 1 行动', () => {
  for (const mode of ['shroud', 'action']) {
    const { state } = mirageState('08558', { shroud: 2 })
    const before = state.investigators[0].actionsLeft
    move(state, { action: 'investigate' })
    settle(state, choice => choice.options.find(option => option.id === mode)?.id)
    assert.equal(state.lastTestResult.difficulty, mode === 'shroud' ? 4 : 2)
    assert.equal(state.investigators[0].actionsLeft, before - (mode === 'action' ? 2 : 1))
  }
})

test('08-a5 08559 大学礼堂：真实翻面按支付的线索弃顶牌、处理忒咳哩与其他弱点', () => {
  const { state, location } = mirageState('08559')
  initTekeli(state)
  state.investigators[0].clues = 6
  const archive = ['01088', '01088', '01007', '08724', '01088']
  state.investigators[0].deck = [...archive]
  const action = legalMoves(state, 0).find(candidate => candidate.rule === 'mirageFlip:' + location)
  assert.ok(action, '大学礼堂玩家可执行真实幻景翻面')
  move(state, action)
  settle(state)
  assert.equal(state.investigators[0].damage, 1, '弃顶的忒咳哩弱点立即结算')
  assert.ok(state.investigators[0].deck.includes('01007'), '弃顶的其他弱点洗回自己的牌库')
  assert.ok(!state.investigators[0].discard.includes('08724'))
  assert.ok(state.investigators[0].discard.includes('01088'), '非弱点留下在弃牌堆')
})

test('08-a5 08560 树篱迷宫：调查后本回合帷幕 +1，离开原先可达的连接地点被禁止', () => {
  const { state, location } = mirageState('08560')
  const adjacent = fm.placeLocation(state, 'desertedStation')
  assert.ok(adjacent)
  locationOf(state, location).connections = [adjacent.id]
  const canLeave = () => legalMoves(state, 0).some(candidate => candidate.action === 'move' && candidate.locationId === adjacent.id)
  assert.equal(canLeave(), true)
  move(state, { action: 'investigate' })
  settle(state)
  assert.equal(scenarioRuntime(state, []).locationShroud(location, 0, { includeLocationState: true }), 3)
  assert.equal(canLeave(), false)
})

test('08-a5 08561 荒废车站：附属诡计后真实地点帷幕增加 3', () => {
  const { state, location } = mirageState('08561')
  const api = scenarioRuntime(state, [])
  assert.equal(api.locationShroud(location), 2)
  assert.ok(api.attachEncounterToLocation('08585', location))
  assert.equal(api.locationShroud(location), 5)
})

for (const [code, harm] of [['08562', 'horror'], ['08565', 'damage']]) {
  test('08-a5 ' + code + ' 调查揭示寒霜：实战承受伤害或恐惧，成功才额外发现一个线索', () => {
    for (const shroud of [2, 8]) {
      const { state, location } = mirageState(code, { shroud })
      state.investigators[0].intellect = 6
      const tokens = shroud === 2 ? ['frost', '0'] : ['frost', 'frost', '0']
      state.chaosBag = [...tokens]
      state.debugNextTokens = [...tokens]
      move(state, { action: 'investigate' })
      settle(state)
      assert.equal(state.investigators[0][harm], 1)
      assert.equal(state.lastTestResult.success, shroud === 2)
      assert.equal(locationOf(state, location).clues, shroud === 2 ? 1 : 3)
    }
  })
}

test('08-a5 08563 古老者厅室：一次实际获得 2 线索才洗入一张忒咳哩', () => {
  const { state, location } = mirageState('08563')
  initTekeli(state)
  transact(state, (draft, api) => api.discoverClue(0, 1, location))
  assert.equal(scenarioRuntime(state, []).mechanics.tekeli.size(), 16)
  transact(state, (draft, api) => api.discoverClue(0, 2, location))
  assert.equal(scenarioRuntime(state, []).mechanics.tekeli.size(), 15)
  assert.ok(state.investigators[0].deck.some(code => TEKELI_FACES.includes(code)))
})

test('08-a5 08564 河景剧院：实际抽到忒咳哩后效果结算两次，获得 1 线索', () => {
  const { state, location } = mirageState('08564')
  initTekeli(state)
  state.investigators[0].deck.push('08723')
  move(state, { action: 'draw' })
  settle(state)
  assert.equal(state.investigators[0].horror, 2)
  assert.equal(state.investigators[0].clues, 1)
  assert.equal(locationOf(state, location).clues, 2)
})

test('08-a5 08566 飞机场：高田在场降低帷幕，调查必须有 1 资源且实际扣除', () => {
  const { state, location } = mirageState('08566', { shroud: 4 })
  const readShroud = () => scenarioRuntime(state, []).locationShroud(location, 0, { includeLocationState: true })
  assert.equal(readShroud(), 4)
  asset(state, '08722')
  assert.equal(readShroud(), 2)
  const canInvestigate = () => legalMoves(state, 0).some(candidate => candidate.action === 'investigate')
  state.investigators[0].resources = 0
  assert.equal(canInvestigate(), false)
  state.investigators[0].resources = 1
  assert.equal(canInvestigate(), true)
  move(state, { action: 'investigate' })
  settle(state)
  assert.equal(state.investigators[0].resources, 0)
})

function connectFromPrison(state, destination) {
  const start = fm.placeLocation(state, 'prisonOfMemories')
  start.connections = [destination]
  locationOf(state, destination).connections = [start.id]
  state.investigators[0].location = start.id
  return start.id
}

test('08-a5 08567 阿拉斯加荒野：合法移动可付额外行动或洗入 1 张忒咳哩', () => {
  for (const mode of ['action', 'tekeli']) {
    const { state, location } = mirageState('08567')
    connectFromPrison(state, location)
    initTekeli(state)
    const remaining = state.investigators[0].actionsLeft
    move(state, { action: 'move', locationId: location })
    settle(state, choice => choice.options.find(option => option.id === mode)?.id)
    assert.equal(state.investigators[0].location, location)
    assert.equal(state.investigators[0].actionsLeft, remaining - (mode === 'action' ? 2 : 1))
    assert.equal(scenarioRuntime(state, []).mechanics.tekeli.size(), mode === 'tekeli' ? 15 : 16)
  }
})

test('08-a5 08568 凌乱宿舍：实际抽到忒咳哩并结算后洗回自己的牌库', () => {
  const { state } = mirageState('08568')
  initTekeli(state)
  state.investigators[0].deck.push('08723')
  move(state, { action: 'draw' })
  settle(state)
  assert.equal(state.investigators[0].horror, 1)
  assert.ok(state.investigators[0].deck.includes('08723'))
  assert.equal(scenarioRuntime(state, []).mechanics.tekeli.size(), 16)
})

test('08-a5 08569 戴尔的教室：实际行动洗入 1 张忒咳哩并治愈同地点调查员', () => {
  const { state, location } = mirageState('08569')
  initTekeli(state)
  state.investigators[0].horror = 1
  const action = legalMoves(state, 0).find(candidate => candidate.action === 'entityAbility' && candidate.entityId === location)
  assert.ok(action)
  move(state, action)
  settle(state)
  assert.equal(state.investigators[0].horror, 0)
  assert.equal(scenarioRuntime(state, []).mechanics.tekeli.size(), 15)
})

test('08-a5 08570 医务室：第一次实际进入降至剩余 6 生命，再次进入不受伤', () => {
  const { state, location } = mirageState('08570')
  const start = connectFromPrison(state, location)
  move(state, { action: 'move', locationId: location })
  settle(state)
  const inv = state.investigators[0]
  const damage = inv.damage
  assert.ok(damage > 0)
  assert.equal(getMaxHealth(inv) - damage, 6)
  move(state, { action: 'move', locationId: start })
  settle(state)
  move(state, { action: 'move', locationId: location })
  settle(state)
  assert.equal(state.investigators[0].damage, damage, '每位调查员每场只结算一次')
})

test('08-a5 08571 肯斯勒博士的办公室：成功调查可耗 1 秘密替代恐惧', () => {
  for (const takeHorror of [true, false]) {
    const { state } = mirageState('08571')
    const partner = asset(state, '08715')
    const before = partner.uses
    move(state, { action: 'investigate' })
    settle(state, choice => choice.options.find(option => option.id === (takeHorror ? 'horror' : partner.id))?.id)
    assert.equal(state.lastTestResult.success, true)
    assert.equal(state.investigators[0].horror, takeHorror ? 1 : 0)
    assert.equal(state.investigators[0].assets.find(card => card.id === partner.id).uses, before - (takeHorror ? 0 : 1))
  }
})

test('08-a5 08572 摩艾石像：同一阶段第一次显现附属产生涌动，第二张附属不会继续涌动', () => {
  const { state, location } = mirageState('08572')
  state.encounterDeck = ['dissonantVoices', '08585', '08585']
  transact(state, (draft, api) => api.drawEncounter(0))
  assert.deepEqual(state.encounterDeck, ['dissonantVoices'])
  assert.equal(locationOf(state, location).attachments.filter(card => card.code === '08585').length, 2)
})

test('08-a5 08573 奥斯曼前线：非精英敌人战斗 +2 且失去反击，精英不受影响', () => {
  for (const elite of [false, true]) {
    const { state } = mirageState('08573')
    const target = enemy(state, { elite, retaliate: true, fight: 4, damage: 1 })
    assert.equal(enemyFightValue(state, target, state.investigators[0]), elite ? 4 : 6)
    state.chaosBag = ['-2']
    move(state, { action: 'fight', enemyId: target.id })
    settle(state)
    assert.equal(state.lastTestResult.success, false)
    assert.equal(state.investigators[0].damage, elite ? 1 : 0)
  }
})
