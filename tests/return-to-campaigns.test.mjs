// 批次 2：「重返」战役与独立支线的生产注册、大厅路径与关间插入验收。
//
// 覆盖：
//   1) 重返战役可启动、章节/流程引用完整（flow 中不得残留基础战役关卡 id）、每章有中英指南；
//   2) 默认弱点池：返回包 requiredPackIds 引入 rt*Player 后，自动构筑弱点池包含
//      51011 / 52011–52013（对应战役），rtnotz 盒没有基础弱点则池保持核心基础弱点；
//   3) 开局配置：campaign.opening.experience 进入观察投影，难度/混乱袋来自战役清单；
//   4) 真实大厅路径：选人 → 自动构筑 → 确认 → 开始首章 → 结局 → 关间 → 开始第二章；
//   5) 独立支线单开（opening 经验、Standard/Hard 难度档）与主战役关间插入
//      （每人扣经验、记录写回、回到原定下一章、已游玩不再出现）。
import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { contentRegistry } from '../content/registered.js'
import { createGameState, basicWeaknessPool } from '../src/engine/engine.js'
import { viewState } from '../src/integration/observation.js'
import { legalMoves, move, settle } from './core-fixture.mjs'

const ROOT = fileURLToPath(new URL('../', import.meta.url))
const players = [{ seat: 0, role: 'human' }]
const send = (state, action) => { move(state, { action }); settle(state) }
const endScenario = (state, resolutionKey = 'noResolution') => {
  move(state, { action: 'debug', kind: 'endScenario', resolutionKey })
  settle(state)
}

// 大厅进入调查准备：开局的流程图起点是 choice（如敦威治序章）时先选首关，再进入准备。
function enterSetup(state, scenarioId = null) {
  if (!legalMoves(state).some(row => row.action === 'hubGoSetup')) {
    const select = legalMoves(state).filter(row => row.action === 'hubSelectScenario')
    const target = select.find(row => row.scenarioId === scenarioId) || select[0]
    if (target) { move(state, { action: 'hubSelectScenario', scenarioId: target.scenarioId }); settle(state) }
  }
  send(state, 'hubGoSetup')
}

const CAMPAIGNS = Object.freeze([
  {
    id: 'returnToNightOfTheZealot',
    baseCampaign: 'nightOfTheZealot',
    scenarioIds: ['returnToTheGathering', 'returnToTheMidnightMasks', 'returnToTheDevourerBelow'],
    baseIds: ['theGathering', 'theMidnightMasks', 'theDevourerBelow'],
    weaknesses: [],
  },
  {
    id: 'returnToTheDunwichLegacy',
    baseCampaign: 'theDunwichLegacy',
    scenarioIds: ['returnToExtracurricularActivities', 'returnToTheHouseAlwaysWins', 'returnToTheMiskatonicMuseum',
      'returnToTheEssexCountyExpress', 'returnToBloodOnTheAltar', 'returnToUndimensionedAndUnseen',
      'returnToWhereDoomAwaits', 'returnToLostInTimeAndSpace'],
    baseIds: ['extracurricularActivity', 'theHouseAlwaysWins', 'theMiskatonicMuseum', 'theEssexCountyExpress',
      'bloodOnTheAltar', 'undimensionedAndUnseen', 'whereDoomAwaits', 'lostInTimeAndSpace'],
    weaknesses: ['51011'],
  },
  {
    id: 'returnToThePathToCarcosa',
    baseCampaign: 'thePathToCarcosa',
    scenarioIds: ['returnToCurtainCall', 'returnToTheLastKing', 'returnToEchoesOfThePast',
      'returnToTheUnspeakableOath', 'returnToAPhantomOfTruth', 'returnToThePallidMask',
      'returnToBlackStarsRise', 'returnToDimCarcosa'],
    baseIds: ['curtainCall', 'theLastKing', 'echoesOfThePast', 'theUnspeakableOath',
      'aPhantomOfTruth', 'thePallidMask', 'blackStarsRise', 'dimCarcosa'],
    weaknesses: ['52011', '52012', '52013'],
  },
])

// 战役 50 的第三章（RtDB）落地前，只对已注册战役跑逐战役断言；注册后自动覆盖。
const activeCampaigns = () => CAMPAIGNS.filter(definition => contentRegistry.getCampaign(definition.id))

const flowStrings = flow => {
  const out = []
  const walk = value => {
    if (typeof value === 'string') out.push(value)
    else if (Array.isArray(value)) value.forEach(walk)
    else if (value && typeof value === 'object') Object.values(value).forEach(walk)
  }
  walk(flow)
  return out
}

for (const definition of CAMPAIGNS) {
  test(`${definition.id} 注册完整：可启动、章节归属、流程无基础关卡残留`, t => {
    if (!contentRegistry.getCampaign(definition.id)) { t.skip('尚未注册'); return }
    const campaign = contentRegistry.assertLaunchable(definition.id)
    assert.deepEqual(campaign.scenarioIds, definition.scenarioIds)
    assert.equal(campaign.opening?.experience, 0)
    for (const scenarioId of definition.scenarioIds) {
      const scenario = contentRegistry.getScenario(scenarioId)
      assert.equal(scenario.campaignId, definition.id, `${scenarioId} 归属战役错误`)
      const guideFile = `${ROOT}web/scenario-guides/${scenarioId}.json`
      assert.ok(existsSync(guideFile), `${scenarioId} 缺少生成后的指南`)
      const guide = JSON.parse(readFileSync(guideFile, 'utf8'))
      for (const language of ['zh', 'en']) {
        const locale = guide.locales[language]
        assert.ok(locale.intro.length && locale.setup.length && locale.resolutions.length,
          `${scenarioId} ${language} 指南缺必要分节`)
      }
    }
    const strings = flowStrings(campaign.flow)
    for (const baseId of definition.baseIds) {
      assert.equal(strings.includes(baseId), false, `${definition.id} 的 flow 仍引用基础关卡 ${baseId}`)
    }
    assert.equal(strings.includes(definition.baseCampaign), false, `${definition.id} 的 flow 仍引用基础战役 id`)
    for (const node of Object.values(campaign.flow.nodes)) {
      if (node.type === 'scenario') assert.ok(definition.scenarioIds.includes(node.scenarioId), `未知关卡 ${node.scenarioId}`)
    }
  })
}

test('重返战役默认弱点池包含对应重返玩家包的基础弱点', () => {
  for (const definition of activeCampaigns()) {
    const state = createGameState({ campaignId: definition.id, campaignHub: true, seed: `weakness-${definition.id}` }, players)
    enterSetup(state)
    const investigator = legalMoves(state).find(row => row.action === 'hubSelectInvestigator').code
    move(state, { action: 'hubSelectInvestigator', code: investigator })
    const pool = basicWeaknessPool(state, investigator, { automatic: true })
    assert.ok(Array.isArray(pool), `${definition.id} 没有自动弱点池`)
    for (const code of definition.weaknesses) {
      assert.ok(pool.includes(code), `${definition.id} 自动弱点池缺少 ${code}（pool=${pool.join(',')}）`)
    }
  }
})

test('重返战役开局配置进入观察投影并沿用基础混乱袋', () => {
  for (const definition of activeCampaigns()) {
    const state = createGameState({ campaignId: definition.id, campaignHub: true, difficulty: 'hard', seed: `opening-${definition.id}` }, players)
    const view = viewState(state, 0)
    assert.equal(view.campaign.opening?.experience, 0, `${definition.id} 观察投影缺少 opening.experience`)
    enterSetup(state)
    const investigator = legalMoves(state).find(row => row.action === 'hubSelectInvestigator').code
    move(state, { action: 'hubSelectInvestigator', code: investigator })
    send(state, 'hubAutoDeck')
    send(state, 'hubConfirmDeck')
    for (const action of ['hubDoneSeat', 'hubBeginScenario']) send(state, action)
    assert.equal(state.uiState, 'inScenario', `${definition.id} 无法开始首章`)
    assert.equal(state.difficulty, 'hard')
    assert.ok(Array.isArray(state.chaosBag) && state.chaosBag.length > 0)
  }
})

test('重返战役大厅可连续推进两章（首章结算 → 关间 → 第二章）', () => {
  for (const definition of activeCampaigns()) {
    const state = createGameState({ campaignId: definition.id, campaignHub: true, seed: `flow-${definition.id}` }, players)
    enterSetup(state)
    const investigator = legalMoves(state).find(row => row.action === 'hubSelectInvestigator').code
    move(state, { action: 'hubSelectInvestigator', code: investigator })
    send(state, 'hubAutoDeck')
    send(state, 'hubConfirmDeck')
    for (const action of ['hubDoneSeat', 'hubBeginScenario']) send(state, action)
    assert.equal(state.scenario.id, definition.scenarioIds[0])
    endScenario(state)
    assert.equal(state.uiState, 'scenarioResult')
    send(state, 'hubContinue')
    // 部分战役在关间之间有幕间/选择节点；一直推进到下一关准备。
    for (let step = 0; step < 12 && state.uiState !== 'scenarioSetup'; step++) {
      if (state.uiState === 'scenarioResult') send(state, 'hubContinue')
      else if (state.pendingChoice) settle(state, () => state.pendingChoice.options.at(-1).id)
      else send(state, 'hubDoneSeat')
    }
    assert.equal(state.uiState, 'scenarioSetup', `${definition.id} 未回到下一关准备`)
    if (!legalMoves(state).some(row => row.action === 'hubBeginScenario')) send(state, 'hubDoneSeat')
    send(state, 'hubBeginScenario')
    assert.equal(state.scenario.id, definition.scenarioIds[1])
  }
})

// ---------------------------------------------------------------------------
// 独立支线：独立开局与插入主战役的生产入口
// ---------------------------------------------------------------------------

const SIDE_STORIES = Object.freeze([
  { id: 'curseOfTheRougarou', cost: 1, openingExperience: 1 },
  { id: 'carnevaleOfHorrors', cost: 3, openingExperience: 3 },
  { id: 'murderAtTheExcelsiorHotel', cost: 3, openingExperience: 3 },
])

test('独立支线可单开：opening 经验、Standard/Hard 难度档、真实引擎进入关卡', () => {
  for (const side of SIDE_STORIES) {
    const campaign = contentRegistry.assertLaunchable(side.id)
    assert.equal(campaign.opening.experience, side.openingExperience, `${side.id} 起始构筑经验`)
    assert.deepEqual(Object.keys(campaign.chaosBags).sort(), ['hard', 'standard'], `${side.id} 只开放 Standard/Hard`)
    assert.equal(campaign.scenarioIds.length, 1, `${side.id} 应为单章战役`)
    const state = createGameState({ campaignId: side.id, campaignHub: true, seed: `side-${side.id}` }, players)
    const difficulties = legalMoves(state).filter(row => row.action === 'hubSetDifficulty').map(row => row.difficulty)
    assert.deepEqual(difficulties.sort(), ['hard', 'standard'], `${side.id} 大厅难度档不符：${difficulties.join(',')}`)
    enterSetup(state)
    const investigator = legalMoves(state).find(row => row.action === 'hubSelectInvestigator').code
    move(state, { action: 'hubSelectInvestigator', code: investigator })
    send(state, 'hubAutoDeck')
    send(state, 'hubConfirmDeck')
    for (const action of ['hubDoneSeat', 'hubBeginScenario']) send(state, action)
    assert.equal(state.uiState, 'inScenario', `${side.id} 无法单开`)
    assert.equal(state.scenario.id, side.id)
  }
})

test('主战役关间插入生产支线：扣每位调查员经验、写回记录、回到原定下一章', () => {
  // 首批生产插入点：基础《夜之狂热》首章后的关间（manifest.sideStories 声明三条支线）。
  const state = createGameState({ campaignId: 'nightOfTheZealot', campaignHub: true, seed: 'prod-insert' }, players)
  enterSetup(state)
  move(state, { action: 'hubSelectInvestigator', code: '01001' })
  send(state, 'hubAutoDeck')
  send(state, 'hubConfirmDeck')
  for (const action of ['hubDoneSeat', 'hubBeginScenario']) send(state, action)
  assert.equal(state.scenario.id, 'theGathering')
  state.campaign.investigators[0].xp = 4
  endScenario(state)
  assert.equal(state.uiState, 'scenarioResult')
  send(state, 'hubContinue')
  assert.equal(state.uiState, 'interlude')
  const options = legalMoves(state).filter(row => row.action === 'hubStartSideStory')
  assert.deepEqual(options.map(row => row.campaignId).sort(), SIDE_STORIES.map(side => side.id).sort())
  const rougarou = options.find(row => row.campaignId === 'curseOfTheRougarou')
  const beforeXp = state.campaign.investigators[0].xp
  move(state, { action: 'hubStartSideStory', campaignId: rougarou.campaignId, scenarioId: rougarou.scenarioId, cost: rougarou.cost })
  settle(state)
  assert.equal(state.scenario.id, 'curseOfTheRougarou', '插入后应直接进入支线关卡')
  assert.equal(state.campaign.investigators[0].xp, beforeXp - 1, '每人支付 1 XP')
  endScenario(state)
  assert.equal(state.uiState, 'scenarioResult')
  assert.deepEqual(state.campaign.scenarioResults.map(result => result.scenarioId),
    ['theGathering', 'curseOfTheRougarou'])
  assert.equal(typeof state.campaign.records.theRougarouContinuesToHauntTheBayou, 'boolean')
  const restored = JSON.parse(JSON.stringify(state))
  assert.deepEqual(restored.campaign.sideStoriesPlayed, ['curseOfTheRougarou'])
  send(state, 'hubContinue')
  assert.equal(state.uiState, 'interlude', '支线结算后回到同一关间')
  assert.deepEqual(legalMoves(state).filter(row => row.action === 'hubStartSideStory')
    .map(row => row.campaignId), ['carnevaleOfHorrors', 'murderAtTheExcelsiorHotel'])
  // 继续推进到原定下一章。
  send(state, 'hubDoneSeat')
  send(state, 'hubBeginScenario')
  assert.equal(state.uiState, 'inScenario')
  assert.equal(state.scenario.id, 'theMidnightMasks')
})
