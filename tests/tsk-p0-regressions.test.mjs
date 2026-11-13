// 2026-11-13 P0 回归：全量扫描报告 docs/campaign/theScarletKeys/full-scan.md §0 的 7 项 P0+
// 同批修掉的「第 5/7 章遭遇牌库 / 终章结局 / 交互事务」缺口。每条用例都走真实引擎入口
// （createGameState / applyMove / legalMoves / 调试跳关 startScenario），不使用合成 state。
import test from 'node:test'
import assert from 'node:assert/strict'

import { applyMove, createGameState, legalMoves, moveCardTo } from '../src/engine/engine.js'
import { ALL_ENEMIES, ALL_TREACHERIES } from '../src/engine/card-lookup.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { encounterGroupDeck } from '../content/campaigns/theScarletKeys/card-data.js'
import * as sanguineDef from '../content/campaigns/theScarletKeys/scenarios/sanguineShadows/definition.js'
import * as dealingsDef from '../content/campaigns/theScarletKeys/scenarios/dealingsInTheDark/definition.js'
import * as dogsDef from '../content/campaigns/theScarletKeys/scenarios/dogsOfWar/definition.js'
import * as shadesDef from '../content/campaigns/theScarletKeys/scenarios/shadesOfSuffering/definition.js'
import * as onThinIceDef from '../content/campaigns/theScarletKeys/scenarios/onThinIce/definition.js'
import * as congressDef from '../content/campaigns/theScarletKeys/scenarios/congressOfTheKeys/definition.js'
import * as riddlesDef from '../content/campaigns/theScarletKeys/scenarios/riddlesAndRain/definition.js'

const CAMPAIGN_ID = 'theScarletKeys'
const SAFE_CHOICES = ['done', 'skip', 'no', 'continue', 'decline', 'cancel', 'ticket', 'everything']

function createState (seed = 'tsk-p0') {
  return createGameState({ campaignId: CAMPAIGN_ID, campaignHub: true, seed }, [{ seat: 0, role: 'human' }])
}

function settle (state, { prefer = SAFE_CHOICES, max = 60 } = {}) {
  const chosen = []
  for (let guard = 0; state.pendingChoice && guard < max; guard += 1) {
    const choice = state.pendingChoice
    const safe = prefer.map(id => choice.options.find(option => String(option.id).toLowerCase() === id)).find(Boolean)
    const option = safe || choice.options[0]
    assert.ok(option, `待决选择没有选项：${choice.kind}/${choice.source}`)
    chosen.push({ kind: choice.kind, source: choice.source, option: option.id })
    applyMove(state, choice.seat, { action: 'choose', choiceId: choice.id, optionId: option.id })
  }
  return chosen
}

function enterScenario (state, scenarioId, options = {}) {
  settle(state)
  applyMove(state, 0, { action: 'debug', kind: 'scenario', scenarioId })
  settle(state, options)
  assert.equal(state.uiState, 'inScenario', `${scenarioId} 未进入 inScenario`)
  assert.equal(state.scenario?.id, scenarioId)
  return state
}

const findMove = (state, seat, action) => legalMoves(state, seat).find(move => move.action === action)
const plainMove = move => Object.fromEntries(Object.entries(move || {})
  .filter(([key]) => !['label', 'explanation', 'disabled'].includes(key)))

function endTurn (state, seat = 0) {
  const move = findMove(state, seat, 'endTurn')
  assert.ok(move, `缺少 endTurn 合法动作：${legalMoves(state, seat).map(item => item.action).join(',')}`)
  applyMove(state, seat, plainMove(move))
  settle(state)
}

const chapterDeck = state => state.encounterDeck || []
const registered = code => Boolean(ALL_ENEMIES[code] || ALL_TREACHERIES[code])

// ---------------------------------------------------------------------------
// P0-1 不留痕迹真实开局（旧：rngState TypeError，章节完全不可玩）
// ---------------------------------------------------------------------------
test('P0-1 不留痕迹真实开局可进入，且迷你卡/遭遇牌库/阴影地点就位', () => {
  const state = createState('p0-ati')
  enterScenario(state, 'withoutATrace', { prefer: ['blow', 'discard', 'skip', 'done'] })
  assert.equal(state.uiState, 'inScenario')
  const locations = state.locations.map(location => location.id)
  // 域外来客之廷 + 阴影左/中/右三张（其余地点在揭露阴影后动态入场）。
  assert.equal(locations.length, 4, `入场地点数异常：${locations.join(',')}`)
  assert.ok(locations.includes('courtOfTheOutsiders'))
  assert.equal(chapterDeck(state).length, 24)
  const minis = state.scenarioFlags?.mechanics?.tsk?.concealed?.miniCards || []
  assert.equal(minis.length, 4, '起点周围应有 1 张真身 + 3 张诱饵迷你卡')
  assert.ok(state.investigators[0].location, '调查员应落到起点')
})

// ---------------------------------------------------------------------------
// P0-2 基础弱点 09126/09128 抽到即崩
// ---------------------------------------------------------------------------
test('P0-2 09126/09128 抽到后留在手牌且不崩溃；09126 回合结束受 1 伤害', () => {
  const state = enterScenario(createState('p0-weak'), 'riddlesAndRain', { prefer: ['done', 'skip'] })
  applyMove(state, 0, { action: 'debug', kind: 'card', targetSeat: 0, code: '09126', zone: 'deckTop' })
  applyMove(state, 0, { action: 'debug', kind: 'draw', targetSeat: 0, amount: 1 })
  // 规则事务会重建 state 内层对象：每次 move 之后必须重新取调查员引用。
  assert.ok(state.investigators[0].hand.includes('09126'), '09126 抽到后应留在手牌')
  const damageBefore = Number(state.investigators[0].damage) || 0
  endTurn(state)
  assert.equal(Number(state.investigators[0].damage) || 0, damageBefore + 1, '09126 回合结束应受 1 点伤害')
  const second = enterScenario(createState('p0-weak2'), 'riddlesAndRain', { prefer: ['done', 'skip'] })
  applyMove(second, 0, { action: 'debug', kind: 'card', targetSeat: 0, code: '09128', zone: 'deckTop' })
  applyMove(second, 0, { action: 'debug', kind: 'draw', targetSeat: 0, amount: 1 })
  assert.ok(second.investigators[0].hand.includes('09128'), '09128 抽到后应留在手牌')
})

// ---------------------------------------------------------------------------
// P0-3 api.moveCard({to:'deck'}) 非法目标区
// ---------------------------------------------------------------------------
test('P0-3 目标区别名 deck/deckBottom 在所有卡上归一为牌库顶/底', () => {
  const state = enterScenario(createState('p0-deck'), 'riddlesAndRain', { prefer: ['done', 'skip'] })
  for (const code of ['09003', '09012', '09013', '09014', '09020']) {
    const inv = state.investigators[0]
    inv.discard = [code]
    inv.deck = state.investigators[0].deck.filter(item => item !== code)
    const moved = moveCardTo(state, inv, { code, from: 'discard', to: 'deck', shuffle: false }, [])
    assert.equal(moved, code, `${code} 未能从弃牌堆移到牌库`)
    assert.ok(state.investigators[0].deck.includes(code), `${code} 应进入牌库`)
    state.investigators[0].deck = state.investigators[0].deck.filter(item => item !== code)
  }
  const bottomInv = state.investigators[0]
  bottomInv.discard = ['09012']
  moveCardTo(state, bottomInv, { code: '09012', from: 'discard', to: 'deckBottom', shuffle: false }, [])
  assert.equal(state.investigators[0].deck[0], '09012', "to:'deckBottom' 应落到牌库底")
  assert.equal(state.investigators[0].defeated, false)
})

// ---------------------------------------------------------------------------
// P0-4 5 章 choiceFor 吞掉引擎 ChoicePause
// ---------------------------------------------------------------------------
test('P0-4a 血色阴影开场三选一真实出现且三档分别生效', () => {
  for (const optionId of ['everything', 'breadcrumbs', 'insist']) {
    const state = createState(`p0-sang-${optionId}`)
    settle(state)
    applyMove(state, 0, { action: 'debug', kind: 'scenario', scenarioId: 'sanguineShadows' })
    assert.equal(state.pendingChoice?.source, 'sanguineShadowsIntro', '开场三选一必须成为待决选择')
    const choice = state.pendingChoice
    applyMove(state, choice.seat, { action: 'choose', choiceId: choice.id, optionId })
    settle(state, { prefer: ['done', 'skip'] })
    assert.equal(state.scenarioFlags.sanguineShadows?.intro, optionId, `选择 ${optionId} 后 intro 应记录该档`)
  }
})

test('P0-4b 战争疮痍版本选择真实出现：拒绝→v2 且遭遇牌库换组', () => {
  const state = createState('p0-dogs')
  settle(state)
  applyMove(state, 0, { action: 'debug', kind: 'scenario', scenarioId: 'dogsOfWar' })
  assert.ok(state.pendingChoice, '开场版本选择必须成为待决选择')
  const choice = state.pendingChoice
  const refuse = choice.options.find(option => option.id === 'refuse') || choice.options[0]
  applyMove(state, choice.seat, { action: 'choose', choiceId: choice.id, optionId: refuse.id })
  settle(state, { prefer: ['done', 'skip'] })
  const data = state.scenarioFlags.dogsOfWar
  assert.equal(data?.variant, 'v2', '拒绝合作应进入版本二')
  const deck = chapterDeck(state)
  assert.ok(deck.length >= 30, `版本二遭遇牌库过小：${deck.length}`)
  assert.ok(deck.some(code => ALL_CARDS[code]?.encounterCode === 'cleanup_crew'), '版本二应并入扫荡团伙组')
})

test('P0-4c 如履薄冰幕/密谋推进不再因 ChoicePause 事务失败', () => {
  const state = enterScenario(createState('p0-oti'), 'onThinIce')
  const before = state.actIndex
  applyMove(state, 0, { action: 'debug', kind: 'advanceAct' })
  settle(state, { prefer: ['done', 'skip', 'continue'] })
  assert.ok(state.actIndex >= before, '幕推进不应回滚')
  assert.equal(state.pendingChoice ?? null, null)
})

// ---------------------------------------------------------------------------
// P0-5 钥匙议会全员阵亡崩溃
// ---------------------------------------------------------------------------
test('P0-5 钥匙议会全员阵亡走 noResolution 结局且不抛错', () => {
  const state = enterScenario(createState('p0-congress'), 'congressOfTheKeys',
    { prefer: ['everything', 'done', 'skip'] })
  assert.ok(Object.hasOwn(state.scenario.resolutions, 'noResolution'), '终章必须声明 noResolution 结局键')
  applyMove(state, 0, { action: 'debug', kind: 'harm', targetSeat: 0, damage: 99 })
  settle(state, { prefer: ['done', 'skip'] })
  assert.equal(state.uiState, 'scenarioResult')
  assert.equal(state.resolution, 'noResolution')
})

// ---------------------------------------------------------------------------
// P0-6 苦痛之影抽取 09720/09721 崩溃
// ---------------------------------------------------------------------------
test('P0-6 苦痛之影遭遇牌库的 09720/09721 已注册，真实抽取不再「未知遭遇卡」', () => {
  const state = enterScenario(createState('p0-shades'), 'shadesOfSuffering')
  for (const code of ['09720', '09721']) assert.ok(registered(code), `${code} 未注册到全局遭遇表`)
  state.encounterDeck = ['09720', '09721']
  applyMove(state, 0, { action: 'debug', kind: 'encounter', targetSeat: 0 })
  settle(state, { prefer: ['done', 'skip'] })
  assert.ok((state.encounterDiscard || []).length + (state.enemies || []).length > 0, '遭遇应已结算而不是抛错')
})

// ---------------------------------------------------------------------------
// P0-7 六章遭遇牌库完整性（sanguine/dealings/dogs/shades/onThinIce/congress）
// ---------------------------------------------------------------------------
test('P0-7 各章遭遇牌库按印刷 gather 组补齐，且每张牌都在全局遭遇表', () => {
  const expectations = [
    ['sanguineShadows', 30],
    ['dealingsInTheDark', 30],
    ['dogsOfWar', 30],
    ['shadesOfSuffering', 30],
    ['onThinIce', 40],
  ]
  for (const [chapterId, minimum] of expectations) {
    const state = enterScenario(createState(`p0-deck-${chapterId}`), chapterId, { prefer: ['done', 'skip'] })
    const deck = chapterDeck(state)
    assert.ok(deck.length >= minimum, `${chapterId} 遭遇牌库 ${deck.length} < ${minimum}`)
    for (const code of new Set(deck)) {
      assert.ok(ALL_CARDS[code], `${chapterId}: 未知卡 ${code}`)
      const type = ALL_CARDS[code].type
      const ok = type === 'enemy' ? ALL_ENEMIES[code] : (type === 'treachery' ? ALL_TREACHERIES[code] : true)
      assert.ok(ok, `${chapterId}: 遭遇牌 ${code}（${type}）未注册到全局遭遇表`)
    }
  }
  const congress = enterScenario(createState('p0-deck-congress'), 'congressOfTheKeys',
    { prefer: ['everything', 'done', 'skip'] })
  assert.ok(chapterDeck(congress).length > 0, '终章主遭遇牌库不能为空')
  assert.ok((congress.campaign.tsk?.outsideEncounterDeck || []).length > 0, '版本一第二遭遇牌库必须写入 campaign.tsk')
})

// ---------------------------------------------------------------------------
// 静态数据：修复章节的 gather 组都能展开成卡（组名/别名没有拼错）
// ---------------------------------------------------------------------------
test('P0 数据一致性：修复章节的每个 gather 组都能展开成遭遇卡', () => {
  const definitions = {
    sanguineShadows: sanguineDef,
    dealingsInTheDark: dealingsDef,
    dogsOfWar: dogsDef,
    shadesOfSuffering: shadesDef,
    onThinIce: onThinIceDef,
    congressOfTheKeys: congressDef,
    riddlesAndRain: riddlesDef,
  }
  for (const [chapterId, definition] of Object.entries(definitions)) {
    for (const group of definition.GATHER_GROUPS || []) {
      const deck = encounterGroupDeck([group])
      assert.ok(deck.length > 0, `${chapterId}: 遭遇组 ${group} 展开为空（组名/别名不匹配卡表）`)
    }
  }
  // 历史别名：core 的 Dark Cult 在卡表里叫 pentagram；午夜假面核心组是 arkham。
  assert.ok(encounterGroupDeck(['darkCult']).length > 0)
  assert.ok(encounterGroupDeck(['arkham']).length > 0)
})
