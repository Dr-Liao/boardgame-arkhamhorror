import test from 'node:test'
import assert from 'node:assert/strict'
import { contentRegistry } from '../content/registered.js'
import { campaignListForUi } from '../content/registry.js'
import { manifest } from '../content/campaigns/theForgottenAge/manifest.js'
import { PROLOGUE_SUPPLIES, RESUPPLY_SUPPLIES, SUPPLY_COSTS, supplyPoints } from '../content/campaigns/theForgottenAge/supplies.js'
import { createGameState, applyMove, legalMoves, validateMove, checkSupplies } from '../src/engine/engine.js'
import { applyCampaignEffect } from '../src/campaign/campaign-effects.js'
import { ChoicePause } from '../src/engine/resolution.js'

// M5 入口与补给链路：大厅可启动战役；序幕按补给品点数购买，幕间按卡面划掉补给。
// 这些用例走真实引擎（createGameState / applyMove）与真实的战役效果分发器，
// 不再给行为注入 api 桩，因此能发现「没有任何人发放补给」这类空转。
const poisoned = '04102'

test('M5 大厅列出失落的时代战役，战役可启动', () => {
  assert.equal(contentRegistry.getCampaign(manifest.id).status, 'playable')
  assert.equal(contentRegistry.assertLaunchable(manifest.id).id, manifest.id)
  const listed = campaignListForUi(contentRegistry).find(entry => entry.id === manifest.id)
  assert.ok(listed, '大厅的战役列表必须包含失落的时代')
  assert.equal(listed.status, 'playable')
  assert.equal(listed.scenarios.length, 10)
  assert.equal(contentRegistry.getScenario('theUntamedWilds').status, 'playable')
})

/** 从大厅走到第一关牌桌：选择调查员、自动构筑、开始关卡，并结算序幕的选择。 */
function launch({ purchases = [], picks } = {}, players = [{ seat: 0, role: 'human' }]) {
  const state = createGameState({ campaignId: manifest.id, campaignHub: true, seed: 'tfa-launch-supplies' }, players)
  const move = (seat, action) => applyMove(state, seat, action)
  move(0, { action: 'hubGoSetup' })
  // 多人局必须先确认队长（单人局的队长默认已确认）。
  if (players.length > 1) move(0, { action: 'hubSetLeader', leadSeat: 0 })
  for (const player of players) {
    move(player.seat, { action: 'hubSelectInvestigator', code: ['04001', '04002'][player.seat] || '04001' })
    move(player.seat, { action: 'hubAutoDeck' })
    move(player.seat, { action: 'hubDoneSeat' })
  }
  move(0, { action: 'hubBeginScenario' })
  const bought = [...purchases]
  for (let guard = 0; state.pendingChoice && guard < 200; guard++) {
    const pending = state.pendingChoice
    const wanted = picks ? picks(pending) : (pending.kind === 'pickSupplies' ? bought.shift() : null)
    const optionId = wanted && pending.options.some(option => option.id === wanted)
      ? wanted : pending.options[0].id
    applyMove(state, pending.seat, { action: 'choose', choiceId: pending.id, optionId })
  }
  return state
}

test('M5 序幕：每人 10 点补给品点数，按购买写入个人清单', () => {
  const state = launch({ purchases: ['medicine', 'provisions', 'provisions', 'rope', 'torches'] })
  assert.equal(state.scenario.id, 'theUntamedWilds')
  // 药品 2 + 配给 1 + 配给 1 + 绳索 3 + 火把 3 = 10，正好用完。
  assert.deepEqual(state.campaign.supplies[0], ['medicine', 'provisions', 'provisions', 'rope', 'torches'])
  assert.equal(state.campaign.supplyPoints[0], 0)
  assert.equal(state.log.some(line => line.includes('购买了补给「绳索」')), true)
  // 购买到的补给立刻参与「检查你们的补给品」。
  assert.equal(checkSupplies(state, state.investigators[0], 'rope'), true)
  assert.equal(checkSupplies(state, state.investigators[0], 'map'), false)
  // 剩余点数不会换来别的收益。
  const cheap = launch({ purchases: ['provisions'] })
  assert.deepEqual(cheap.campaign.supplies[0], ['provisions'])
  assert.equal(cheap.campaign.supplyPoints[0], 9)
  assert.equal(cheap.log.some(line => line.includes('未使用的补给品点数（9）作废')), true)
})

test('M5 序幕：远征求领队在可选的调查员中产生', () => {
  const solo = launch({})
  assert.equal(solo.expeditionLeaderSeat, 0)
  assert.equal(solo.campaign.expeditionLeader, 0)
  // 两名玩家分别是里奥（04001）与厄休拉（04002），两人都在候选名单里。
  const pair = launch({}, [{ seat: 0, role: 'human' }, { seat: 1, role: 'human' }])
  assert.ok([0, 1].includes(pair.campaign.expeditionLeader))
  assert.equal(pair.expeditionLeaderSeat, pair.campaign.expeditionLeader)
  // 队伍里没有候选调查员时不会询问，也不会写入领队座位。
  const other = createGameState({ campaignId: manifest.id, campaignHub: true, seed: 'tfa-no-leader' }, [{ seat: 0, role: 'human' }])
  const otherStep = move => applyMove(other, 0, move)
  otherStep({ action: 'hubGoSetup' })
  otherStep({ action: 'hubSelectInvestigator', code: '01001' })
  otherStep({ action: 'hubAutoDeck' })
  otherStep({ action: 'hubDoneSeat' })
  otherStep({ action: 'hubBeginScenario' })
  for (let guard = 0; other.pendingChoice && guard < 100; guard++) {
    const pending = other.pendingChoice
    assert.notEqual(pending.kind, 'expeditionLeader', '没有候选调查员时不应询问领队')
    applyMove(other, pending.seat, { action: 'choose', choiceId: pending.id, optionId: pending.options[0].id })
  }
  assert.equal(other.campaign.expeditionLeader, undefined)
})

test('M5 补给品点数按人数取值，与卡面一致', () => {
  assert.deepEqual([1, 2, 3, 4].map(count => supplyPoints('prologue', count)), [10, 7, 5, 4])
  assert.deepEqual([1, 2, 3, 4].map(count => supplyPoints('resupplyPoint', count)), [8, 5, 4, 3])
  assert.equal(SUPPLY_COSTS.rope, 3)
  assert.equal(SUPPLY_COSTS.provisions, 1)
  assert.equal(PROLOGUE_SUPPLIES.includes('gasoline'), false, '汽油只能在补给点购买')
  assert.equal(RESUPPLY_SUPPLIES.includes('gasoline'), true)
  assert.deepEqual(manifest.flow.nodes.prologue.effects.map(effect => effect.type),
    ['expeditionLeader', 'pickSupplies'])
  // 补给点：先处理中毒/创伤，再买补给。
  assert.deepEqual(manifest.flow.nodes.resupplyPoint.effects.map(effect => effect.type),
    ['resupplyServices', 'pickSupplies'])
})

/** 用与 resolveTransaction 相同的重放模型执行一个战役效果。 */
function runEffect(base, effect, pick = choice => choice.options[0].id) {
  const answers = []
  for (let guard = 0; guard < 64; guard++) {
    const state = structuredClone(base)
    state._resolution = { id: 'tfa-supply-test', answers, cursor: 0, events: [] }
    const logged = []
    try {
      applyCampaignEffect(state, effect, text => logged.push(text))
      state.testLog = logged
      return state
    } catch (error) {
      if (!(error instanceof ChoicePause)) throw error
      const choice = error.choice
      answers.push({ choiceId: choice.id, kind: choice.kind, source: choice.source, seat: choice.seat,
        optionId: pick(choice, answers.length) })
    }
  }
  throw new Error('选择循环超过安全上限')
}

const interludeOne = manifest.flow.nodes.interludeOne.effects
const interludeThree = manifest.flow.nodes.interludeThree.effects
const effectOf = (list, type) => list.find(item => item.type === type)

test('M5 幕间一：共同从补给品中划掉等于人数的配给', () => {
  const base = launch({ purchases: ['provisions', 'provisions'] })
  const rationed = runEffect(base, effectOf(interludeOne, 'crossOffSupply'))
  assert.deepEqual(rationed.campaign.supplies[0], ['provisions'])
  assert.ok(rationed.testLog.some(text => text.includes('划掉了 1 个配给')))

  // 没有任何配给时不再询问，直接把「配给不足」写进日志。
  const dry = runEffect(launch({}), effectOf(interludeOne, 'crossOffSupply'))
  assert.ok(dry.testLog.some(text => text.includes('配给不足')))
})

test('M5 幕间一：药品可划掉，移除牌库里的中毒弱点', () => {
  const base = launch({ purchases: ['medicine'] })
  base.campaign.investigators[0].deck.push(poisoned)
  const cured = runEffect(base, effectOf(interludeOne, 'curePoisonedWithMedicine'), choice =>
    (choice.options.find(option => option.id === '0') || choice.options[0]).id)
  assert.deepEqual(cured.campaign.supplies[0], [], '药品被划掉')
  assert.equal(cured.campaign.investigators[0].deck.includes(poisoned), false, '中毒弱点已从牌库移除')
  assert.ok(cured.testLog.some(text => text.includes('移除')))

  // 不划掉药品时，中毒的正文照样必须出现。
  const kept = runEffect(base, effectOf(interludeOne, 'curePoisonedWithMedicine'), () => 'skip')
  assert.deepEqual(kept.campaign.supplies[0], ['medicine'])
  assert.equal(kept.campaign.investigators[0].deck.includes(poisoned), true)
  assert.ok(kept.testLog.some(text => text.includes('毒性扩散')))
})

test('M5 幕间三：汽油只能划掉 1 个，没有汽油时写出燃料耗尽', () => {
  const withGas = launch({})
  withGas.campaign.supplies[0].push('gasoline')
  const crossed = runEffect(withGas, effectOf(interludeThree, 'crossOffSupply'))
  assert.deepEqual(crossed.campaign.supplies[0], [])

  const dry = runEffect(launch({}), effectOf(interludeThree, 'crossOffSupply'))
  assert.ok(dry.testLog.some(text => text.includes('燃料耗尽')))
})

test('M5 补给点：第二位调查员也能用补给品点数购买补给', () => {
  const state = launch({ purchases: [] }, [{ seat: 0, role: 'human' }, { seat: 1, role: 'human' }])
  // 两人各 5 点：鹤嘴锄每把 2 点，各买两把后剩 1 点买不动别的。
  const bought = runEffect(state, effectOf(manifest.flow.nodes.resupplyPoint.effects, 'pickSupplies'),
    choice => (choice.options.find(option => option.id === 'pickaxe') || choice.options[0]).id)
  assert.deepEqual(bought.campaign.supplies[0], ['pickaxe', 'pickaxe'])
  assert.deepEqual(bought.campaign.supplies[1], ['pickaxe', 'pickaxe'])
  assert.equal(bought.campaign.supplyPoints[0], 1)
  assert.equal(bought.campaign.supplyPoints[1], 1)
})

test('M5 牌桌状态：补给品是公开信息，标签随观察投影下发', async () => {
  const { viewState } = await import('../src/integration/observation.js')
  const state = launch({ purchases: ['rope'] })
  const view = viewState(state, 0)
  assert.deepEqual(view.campaign.supplies[0], ['rope'])
  assert.equal(view.campaign.supplyLabels.rope, '绳索')
  assert.equal(view.campaign.supplyLabels.provisions, '配给')
})

test('M5 引擎路径：购买后的补给仍随存档恢复', () => {
  const state = launch({ purchases: ['rope', 'map'] })
  const restored = JSON.parse(JSON.stringify(state))
  assert.deepEqual(restored.campaign.supplies, state.campaign.supplies)
  assert.deepEqual(restored.campaign.supplyPoints, state.campaign.supplyPoints)
  assert.equal(checkSupplies(restored, restored.investigators[0], 'map'), true)
  assert.ok(legalMoves(restored).length > 0)
  assert.equal(validateMove(restored, 0, { action: 'explore' }), null)
})
