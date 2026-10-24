// 万象无终（TCU）P8 新增引擎读点验收：`behavior.encounterDeckFor(state, inv)`。
//
// 背景：《恶罪报应》等章节要求「神话阶段抽遭遇时，如果调查员在幽灵地点，就从幽灵遭遇牌堆抽」。
// P2.2 原语只提供显式 `drawExtra`，自动抽牌（神话阶段 / drawEncounter 效果）没有切换点；
// P8 在 src/engine/encounter.js 的 drawEncounter 增加一次性读点：
//   options.deck（显式指定）→ behavior.encounterDeckFor?.(state, inv) → 默认 'encounter'
// 本测试用合成战役注册一个最小关卡，验证：钩子切到 spectral / 钩子不切时默认牌库 /
// 显式 options.deck 始终优先（P2.2 契约不变）。
import test from 'node:test'
import assert from 'node:assert/strict'

import { contentRegistry, registerContentBundle } from '../content/registered.js'
import { manifest as carcosaPack } from '../content/packs/carcosaCampaign/manifest.js'
import * as phantom from '../content/campaigns/thePathToCarcosa/scenarios/aPhantomOfTruth/index.js'

const packId = 'tcuP8HooksPack'
const campaignId = 'tcuP8HooksCampaign'
const scenarioId = 'tcuP8HooksScenario'

// 用《卡尔克萨》的合成包做宿主：卡号归属沿用 carcosaCampaign，避免伪造卡池。
registerContentBundle({ packs: [{ ...carcosaPack, id: packId, status: 'playable' }] })
registerContentBundle({
  campaigns: [{
    ...contentRegistry.getCampaign('thePathToCarcosa'),
    id: campaignId,
    status: 'playable',
    scenarioIds: [scenarioId],
    unlock: { [scenarioId]: [] },
    requiredPackIds: ['core', 'notz', packId],
    flow: { start: scenarioId, nodes: { [scenarioId]: { type: 'scenario', scenarioId, next: 'end' }, end: { type: 'end' } } },
  }],
  scenarios: [{
    scenario: { ...phantom.scenario, id: scenarioId },
    behavior: {
      ...phantom.behavior,
      id: scenarioId,
      // 真实章节会读 isSpectral(inv.location)；测试用 scenarioFlags 驱动同一读点。
      encounterDeckFor(state) {
        return state.scenarioFlags?.spectralDraw === true ? 'spectral' : undefined
      },
    },
    manifest: {
      ...phantom.manifest,
      id: scenarioId,
      campaignId,
      status: 'playable',
      requiredEncounterGroupIds: [],
      requiredMechanicIds: [],
      requiredPackIds: ['core', 'notz', packId],
      behaviorIds: [scenarioId],
    },
  }],
})

const engine = await import('../src/engine/engine.js')
const { createGameState, applyMove, drawEncounter } = engine
const { setExtraEncounterDeck, extraEncounterDeckInfo } = await import('../src/engine/alt-decks.js')

function settle(state) {
  for (let guard = 0; state.pendingChoice; guard++) {
    assert.ok(guard < 200, 'choice loop')
    const pending = state.pendingChoice
    const optionId = pending.options.find(option => ['done', 'skip'].includes(option.id))?.id
      || pending.options[0].id
    applyMove(state, pending.seat, { action: 'choose', choiceId: pending.id, optionId })
  }
  return state
}

function fixture({ spectralDraw }) {
  const state = settle(createGameState({
    campaignId, seed: 'tcu-p8-hooks', playerInvestigator: '01001',
  }, [{ seat: 0 }]))
  state.phase = 'investigation'
  state.currentSeat = 0
  state.pendingChoice = null
  state.encounterDeck = ['02058', '02078']
  state.encounterDiscard = []
  setExtraEncounterDeck(state, 'spectral', ['02086', '02087'], { shuffle: list => [...list] })
  state.scenarioFlags = { ...(state.scenarioFlags || {}), spectralDraw }
  return state
}

test('P8 encounterDeckFor：钩子返回 spectral 时，自动抽牌走第二遭遇牌堆', () => {
  const state = fixture({ spectralDraw: true })
  const spectralBefore = extraEncounterDeckInfo(state, 'spectral').deck
  const regularBefore = state.encounterDeck.length
  drawEncounter(state, state.investigators[0], [])
  assert.equal(extraEncounterDeckInfo(state, 'spectral').deck, spectralBefore - 1, '从幽灵牌堆抽走 1 张')
  assert.equal(state.encounterDeck.length, regularBefore, '普通遭遇牌堆没有变化')
})

test('P8 encounterDeckFor：钩子不返回时回落普通遭遇牌堆（P2.2 默认行为不变）', () => {
  const state = fixture({ spectralDraw: false })
  const spectralBefore = extraEncounterDeckInfo(state, 'spectral').deck
  const regularBefore = state.encounterDeck.length
  drawEncounter(state, state.investigators[0], [])
  assert.equal(state.encounterDeck.length, regularBefore - 1, '从普通遭遇牌堆抽走 1 张')
  assert.equal(extraEncounterDeckInfo(state, 'spectral').deck, spectralBefore, '幽灵牌堆没有变化')
})

test('P8 drawEncounter 的显式 options.deck 优先于 behavior 钩子', () => {
  const state = fixture({ spectralDraw: true })
  // 显式普通牌堆：即使钩子指向 spectral，也按显式值抽。
  const spectralBefore = extraEncounterDeckInfo(state, 'spectral').deck
  drawEncounter(state, state.investigators[0], [], { deck: 'encounter' })
  assert.equal(extraEncounterDeckInfo(state, 'spectral').deck, spectralBefore)
  // 显式幽灵牌堆：即使钩子不返回，也按显式值抽。
  const noHook = fixture({ spectralDraw: false })
  const spectralBefore2 = extraEncounterDeckInfo(noHook, 'spectral').deck
  drawEncounter(noHook, noHook.investigators[0], [], { deck: 'spectral' })
  assert.equal(extraEncounterDeckInfo(noHook, 'spectral').deck, spectralBefore2 - 1)
})

test('P8 战役基础弱点池：资产型 05042《高塔·XVI》可作为随机基础弱点构筑', async () => {
  // P7 把 TCU 的 05041/05042 标为基础弱点依赖；P8 发现 05042 是**资产**型基础弱点（占塔罗槽），
  // 旧 deckbuilding 校验只认 treachery/enemy，会把 TCU 战役的合法弱点池判成非法并让开局建牌组直接抛错。
  const { buildDeck } = await import('../src/deck/deckbuilding.js')
  const { INVESTIGATORS } = await import('../src/cards/cards-data.js')
  assert.doesNotThrow(() => {
    const built = buildDeck(INVESTIGATORS['01001'], {
      seat: 0, seed: 'tcu-p8-basic-weakness', basicWeaknessPool: ['05041', '05042'],
    })
    assert.equal(built.basicWeaknesses.length, 1, '应抽到 1 张随机基础弱点')
    assert.ok(['05041', '05042'].includes(built.basicWeaknesses[0]))
  })
})

// ===========================================================================
// c7shared 修复回归：05258–05261 剧情支援卡面能力（+1 技能 / reaction / [fast]）
// 条目在 UAD 的 resolveFate 里由 api.giveAsset 交给调查员控制；受控后走与玩家卡同一套
// 描述子通道（modifiers 进 stat 管线、abilities 进相应窗口）。
// ===========================================================================
test('c7shared：05258–05261 剧情支援条目声明 +1 技能与卡面能力', async () => {
  const entries = await Promise.all(['05258', '05259', '05260', '05261'].map(async code =>
    (await import(`../src/cards/encounter-entries/theCircleUndone/unionAndDisillusion/${code}.js`)).default))
  const expected = {
    '05258': { skill: 'combat', trigger: 'enemyAttacked' },
    '05259': { skill: 'intellect', trigger: 'encounterDrawn' },
    '05260': { skill: 'willpower', trigger: 'skillTestSuccess' },
    '05261': { skill: 'agility', trigger: 'testBegins' },
  }
  for (const entry of entries) {
    const spec = expected[entry.code]
    assert.ok(spec, `${entry.code} 未知`)
    assert.equal(entry.scope, 'storyAsset')
    assert.equal(entry.implemented, true)
    assert.deepEqual(entry.modifiers, [{ target: `skill:${spec.skill}`, amount: 1 }],
      `${entry.code} 应声明 +1 ${spec.skill}`)
    assert.equal(entry.abilities.length, 1, `${entry.code} 应有一条卡面能力`)
    assert.equal(entry.abilities[0].kind, 'reaction')
    assert.equal(entry.abilities[0].trigger, spec.trigger)
    assert.equal(typeof entry.abilities[0].resolve, 'function')
  }
  // 05261 的费用：花费 2 资源 + 横置；05259 的弃牌条件只统计非弱点手牌图标。
  assert.deepEqual(entries.find(entry => entry.code === '05261').abilities[0].cost, { resources: 2, exhaust: true })
  assert.deepEqual(entries.find(entry => entry.code === '05258').abilities[0].cost, { exhaust: true })
})
