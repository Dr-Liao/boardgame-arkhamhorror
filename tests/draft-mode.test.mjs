import test from 'node:test'
import assert from 'node:assert/strict'
import arkham from '../index.js'
import { createGameState, applyMove, validateMove, legalMoves } from '../src/engine/engine.js'
import { captureReplayLog, replayLog, stateHash } from '../src/engine/replay.js'
import { migrateState } from '../src/engine/save-migration.js'
import { viewState } from '../src/integration/observation.js'
import { ALL_CARDS, INVESTIGATORS } from '../src/cards/cards-data.js'
import { matchesDeckOptions } from '../src/deck/deckbuilding.js'
import { draftWeight, openDraftUpgrades, draftDeckStatus, draftDecksReady } from '../src/deck/draft-mode.js'
import { draftCardLimit, validateDeckRules } from '../src/deck/deck-rules.js'
import { replacementOptions } from '../src/campaign/campaign.js'
import { initializeChaosBag, changeChaosBag, beginChaosTest, drawChaosToken, endChaosTest } from '../src/engine/chaos-bag.js'
import { loadEoteWorld, settleChoices, finishScenario } from './eote-p8-fixture.mjs'

const play = (s, move, seat = 0) => {
  assert.equal(validateMove(s, seat, move), null, JSON.stringify(move))
  applyMove(s, seat, move)
}
function setup(players = [{ seat: 0, role: 'human' }]) {
  const s = createGameState({ campaignHub: true, deckMode: 'draft', seed: 'draft-acceptance' }, players)
  play(s, { action: 'hubGoSetup' })
  play(s, { action: 'hubSelectInvestigator', code: '01001' })
  return s
}
function complete(s) {
  for (let n = 0; n < 100 && !s.campaign.investigators[0].startingDeckReady; n++) {
    const move = legalMoves(s, 0).find(move => move.action === 'hubDraftPick')
    assert.ok(move, 'initial draft can finish')
    play(s, move)
  }
  assert.equal(s.campaign.investigators[0].startingDeckReady, true)
}
function interlude(s) {
  complete(s)
  s.uiState = s.phase = s.campaign.phase = 'interlude'
  s.campaign.scenarioResults.push({ scenarioId: 'theGathering', investigators: [] })
  s.campaign.upgradesAllowed = true
  openDraftUpgrades(s)
}

test('初始永久牌不占张数，奥术研究的创伤只在选入时结算一次', () => {
  const s = createGameState({ campaignHub: true, deckMode: 'draft', seed: 'draft-permanent' }, [{ seat: 0, role: 'human' }])
  play(s, { action: 'hubGoSetup' }); play(s, { action: 'hubSelectInvestigator', code: '01004' })
  s.campaign.investigators[0].draftMode.options = ['04109', null, null]
  play(s, { action: 'hubDraftPick', code: '04109' })
  assert.equal(draftDeckStatus(s.campaign.investigators[0]).count, 0)
  assert.equal(s.campaign.investigators[0].draftMode.phase, 'initial')
  assert.equal(s.campaign.investigators[0].trauma.mental, 1)
  assert.equal(s.campaign.trauma[0].mental, 1)
  play(s, { action: 'hubDraftRefresh' })
  const restored = migrateState(JSON.parse(JSON.stringify(s))).state
  assert.equal(restored.campaign.investigators[0].trauma.mental, 1)
  assert.equal(restored.campaign.investigators[0].deck.filter(code => code === '04109').length, 1)
})

test('初始扩容永久牌提高目标张数，不占普通牌位，达到新目标才结束选牌', () => {
  const s = setup()
  s.campaign.investigators[0].draftMode.options = ['08031', null, null]
  play(s, { action: 'hubDraftPick', code: '08031' })
  let record = s.campaign.investigators[0]
  assert.equal(draftDeckStatus(record).size, 45)
  assert.equal(draftDeckStatus(record).count, 0)
  record.deck.push(...Array(44).fill('01016'))
  assert.ok(validateMove(s, 0, { action: 'hubDoneSeat' }))
  record.draftMode.options = ['01016', null, null]
  play(s, { action: 'hubDraftPick', code: '01016' })
  record = s.campaign.investigators[0]
  assert.equal(record.startingDeckReady, true)
  assert.equal(draftDeckStatus(record).size, 45)
  assert.equal(draftDeckStatus(record).count, 45)
})

test('关后购买扩容牌只能直接加入，0 XP时免费补齐，途中存读档保持结果', () => {
  const s = setup(); interlude(s)
  let record = s.campaign.investigators[0]
  const dependencies = record.deck.filter(code => ALL_CARDS[code].signatureFor || ALL_CARDS[code].subtype)
  record.deck = [...dependencies, ...Array(30).fill('01016')]
  record.xp = 2; s.campaign.xp = 2
  record.draftMode.options = ['06167', null, null]
  const buys = legalMoves(s, 0).filter(move => move.action === 'hubDraftBuy')
  assert.equal(buys.length, 1)
  assert.equal(buys[0].removed, null)
  play(s, buys[0])
  record = s.campaign.investigators[0]
  assert.equal(record.xp, 0)
  assert.equal(record.draftMode.phase, 'refill')
  assert.deepEqual(draftDeckStatus(record), { size: 35, count: 30, missing: 5, ready: false })
  assert.ok(validateMove(s, 0, { action: 'hubDoneSeat' }))
  assert.ok(validateMove(s, 0, { action: 'hubBeginScenario' }))
  assert.ok(validateMove(s, 0, { action: 'hubDraftRefresh' }))
  assert.equal(legalMoves(s, 0).some(move => move.action === 'hubDraftLock'), false)
  const restored = migrateState(JSON.parse(JSON.stringify(s))).state
  for (let count = 0; count < 5; count++) {
    record = s.campaign.investigators[0]
    for (const code of record.draftMode.options.filter(Boolean)) {
      assert.equal(ALL_CARDS[code].xp || 0, 0)
      assert.equal(!!ALL_CARDS[code].permanent, false)
      assert.equal(!!ALL_CARDS[code].ignoreDeckLimit, false)
    }
    const move = legalMoves(s, 0).find(move => move.action === 'hubDraftPick')
    play(s, move); play(restored, move)
    assert.equal(stateHash(s), stateHash(restored))
  }
  record = s.campaign.investigators[0]
  assert.equal(record.xp, 0)
  assert.equal(record.draftMode.phase, 'upgrade')
  assert.equal(record.startingDeckReady, true)
  assert.equal(draftDeckStatus(record).count, 35)
  assert.deepEqual(record.draftMode.options, [], '补齐后不额外赠送升级候选')
  assert.equal(validateMove(s, 0, { action: 'hubDoneSeat' }), null)
  assert.equal(viewState(s, 0).draftDeckStatus.missing, 0)
  const scoped = structuredClone(s)
  scoped.campaign.currentPart = 'A'
  scoped.campaign.parts = { A: { investigators: { 0: { ...scoped.campaign.investigators[0], startingDeckReady: false } } } }
  assert.equal(draftDecksReady(scoped), true, '活动线的旧快照不能覆盖当前记录的准备状态')
  play(s, { action: 'hubDoneSeat' })
  play(s, { action: 'hubBeginScenario' })
  assert.ok(s.investigators[0].assets.some(asset => asset.code === '06167'), '永久牌开局自动入场')
})

test('旧的扩容后未补齐存档不能直接出发，可重新进入免费补牌', () => {
  const s = setup(); interlude(s)
  const record = s.campaign.investigators[0]
  record.deck.push('06167')
  record.draftMode.options = []
  record.startingDeckReady = true
  s.hubSeatDone = { 0: true }; s.hubReady = true
  s.uiState = s.phase = s.campaign.phase = 'scenarioSetup'
  assert.ok(validateMove(s, 0, { action: 'hubBeginScenario' }))
  play(s, { action: 'hubResumeDraft' })
  assert.ok(validateMove(s, 0, { action: 'hubDoneSeat' }))
  play(s, { action: 'hubDraftRefill' })
  assert.equal(s.campaign.investigators[0].draftMode.phase, 'refill')
  assert.equal(draftDeckStatus(s.campaign.investigators[0]).missing, 5)
})

test('扩容伴随最低类型要求时，拒绝无法补齐的购买，并为合法扩容提供所需类型', () => {
  const s = createGameState({ campaignHub: true, deckMode: 'draft', seed: 'draft-minimum-types' }, [{ seat: 0, role: 'human' }])
  play(s, { action: 'hubGoSetup' }); play(s, { action: 'hubSelectInvestigator', code: '01002' })
  interlude(s)
  const record = s.campaign.investigators[0]
  const dependencies = record.deck.filter(code => ALL_CARDS[code].signatureFor || ALL_CARDS[code].subtype)
  record.xp = 99; s.campaign.xp = 99
  record.deck = [...dependencies, ...Array(30).fill('01088')]
  record.draftMode.options = ['07303', null, null]
  assert.equal(replacementOptions(record, '07303').length, 0, '新增5个牌位无法从零补出10张技能')
  record.deck = [...dependencies, ...Array(25).fill('01088'), ...Array(5).fill('01089')]
  const buy = legalMoves(s, 0).find(move => move.action === 'hubDraftBuy' && move.removed === null)
  assert.ok(buy)
  play(s, buy)
  for (let picked = 0; picked < 5; picked++) {
    for (const code of s.campaign.investigators[0].draftMode.options.filter(Boolean)) assert.equal(ALL_CARDS[code].type, 'skill')
    play(s, legalMoves(s, 0).find(move => move.action === 'hubDraftPick'))
  }
  assert.equal(draftDeckStatus(s.campaign.investigators[0]).ready, true)
})

test('模式入口、三次初始刷新、服务端拒绝绕过选牌和伪造候选', () => {
  assert.equal(arkham.settingsSpec.find(spec => spec.key === 'deckMode').default, 'standard')
  const s = setup()
  let r = s.campaign.investigators[0]
  assert.equal(r.deck.length, 3, 'only signatures and weaknesses, no starter cards')
  for (let n = 0; n < 3; n++) play(s, { action: 'hubDraftRefresh' })
  r = s.campaign.investigators[0]
  assert.equal(r.draftMode.freeRerolls, 0)
  assert.ok(validateMove(s, 0, { action: 'hubDraftRefresh' }))
  assert.ok(validateMove(s, 0, { action: 'hubAutoDeck' }))
  assert.ok(validateMove(s, 0, { action: 'hubSetDeck', codes: Array(30).fill('01016') }))
  assert.ok(validateMove(s, 0, { action: 'hubDraftPick', code: 'garbage' }))
  for (const code of r.draftMode.options) assert.equal(matchesDeckOptions(INVESTIGATORS[r.code], ALL_CARDS[code]), true)
  complete(s)
  assert.equal(stateHash(replayLog(captureReplayLog(s))), stateHash(s))
  assert.equal(stateHash(migrateState(JSON.parse(JSON.stringify(s))).state), stateHash(s))
})

test('普通卡不限重复，卓越和明确限一仍受限，同名升级权重翻倍', () => {
  assert.equal(draftCardLimit(ALL_CARDS['01016']), Infinity)
  assert.equal(draftCardLimit({ ...ALL_CARDS['01016'], exceptional: true }), 1)
  assert.equal(draftCardLimit({ ...ALL_CARDS['01016'], text: 'Limit 1 per investigator.' }), 1)
  const codes = Array(30).fill('01016')
  assert.equal(validateDeckRules(INVESTIGATORS['01001'], codes, ALL_CARDS, { draftMode: true }).errors.length, 0)
  assert.ok(validateDeckRules(INVESTIGATORS['01001'], codes, ALL_CARDS).errors.length)
  const record = { deck: ['01016'] }
  assert.equal(draftWeight(record, { ...ALL_CARDS['01016'], xp: 2 }), 2)
  assert.equal(draftWeight(record, { name: 'Different name', xp: 2 }), 1)
})

test('关后候选固定等级分布、免费0级替换、购后不补牌、付费刷新和整组锁定', () => {
  const s = setup()
  interlude(s)
  let r = s.campaign.investigators[0]
  const offers = r.draftMode.options
  assert.equal(ALL_CARDS[offers[0]].xp || 0, 0)
  assert.ok(ALL_CARDS[offers[1]].xp > 0)
  assert.ok(ALL_CARDS[offers[2]].xp > 0)
  r.xp = 40; s.campaign.xp = 40
  const free = legalMoves(s, 0).find(move => move.action === 'hubDraftBuy' && move.added === offers[0])
  assert.equal(free.cost, 0)
  play(s, free)
  r = s.campaign.investigators[0]
  assert.deepEqual(r.draftMode.options, [])
  assert.equal(legalMoves(s, 0).some(move => move.action === 'hubDraftBuy'), false)
  play(s, { action: 'hubDraftRefresh' })
  r = s.campaign.investigators[0]
  assert.equal(r.xp, 39)
  play(s, { action: 'hubDraftLock', locked: true })
  r = s.campaign.investigators[0]
  const locked = [...r.draftMode.options]
  s.campaign.scenarioResults.push({ scenarioId: 'theMidnightMasks' })
  openDraftUpgrades(s)
  assert.deepEqual(r.draftMode.options, locked)
  assert.equal(r.xp, 39, 'no refresh cost on return')
  play(s, { action: 'hubDraftRefresh' })
  r = s.campaign.investigators[0]
  assert.equal(r.xp, 38)
  assert.equal(r.draftMode.locked, false)
  r.xp = 0
  assert.ok(validateMove(s, 0, { action: 'hubDraftRefresh' }))
})

test('模式购买复用实际升级差价，候选生成不按可负担经验过滤', () => {
  const s = setup(); interlude(s)
  let r = s.campaign.investigators[0]
  r.deck = [...Array(29).fill('01016'), '01016']
  r.xp = 99
  const options = replacementOptions(r, '03190')
  assert.ok(options.some(option => option.code === '01016' && option.cost === 2), 'same title .45 Automatic: 0 to 2 costs 2')
  r.xp = 0
  r.draftMode.round = -1
  openDraftUpgrades(s)
  assert.ok(r.draftMode.options.slice(1).every(code => code && ALL_CARDS[code].xp > 0))
})

test('多人候选与刷新独立，观察者拿不到他人的候选', () => {
  const s = setup([{ seat: 0, role: 'human' }, { seat: 1, role: 'human' }])
  play(s, { action: 'hubSelectInvestigator', code: '01002' }, 1)
  const other = structuredClone(s.campaign.investigators[1].draftMode)
  play(s, { action: 'hubDraftRefresh' })
  assert.deepEqual(s.campaign.investigators[1].draftMode, other)
  assert.equal(viewState(s, 0).campaign.investigators[1].draftMode, undefined)
  assert.ok(viewState(s, 1).campaign.investigators[1].draftMode)
})

test('双线战役的非活动线也能独立选人、选牌与保存候选', () => {
  const s = createGameState({ campaignHub: true, deckMode: 'draft', campaignId: 'theDreamEaters', seed: 'draft-lanes' },
    [{ seat: 0, role: 'human' }, { seat: 1, role: 'human' }])
  play(s, { action: 'hubSetMode', mode: 'parallel' })
  play(s, legalMoves(s, 0).find(move => move.action === 'hubSelectScenario'))
  play(s, { action: 'hubGoSetup' })
  for (const seat of [0, 1]) {
    play(s, legalMoves(s, seat).find(move => move.action === 'hubSelectInvestigator'), seat)
    play(s, legalMoves(s, seat).find(move => move.action === 'hubDraftPick'), seat)
  }
  const a = s.campaign.parts.A.investigators[0]
  const b = s.campaign.parts.B.investigators[1]
  assert.ok(a.draftMode.options.length && b.draftMode.options.length)
  assert.notEqual(a.code, b.code)
  assert.equal(viewState(s, 0).campaign.parts.B.investigators[1]?.draftMode, undefined)
})

test('模式赠与标记只加一次，剧本移除不能移走赠与标记，揭示后正常归还', () => {
  const s = setup()
  initializeChaosBag(s, ['+1', '0', '-1'])
  assert.deepEqual(s.chaosBag, ['+1', '0', '-1', '+1', '0'])
  changeChaosBag(s, '+1', -2, { permanent: true })
  changeChaosBag(s, '0', -2, { permanent: true })
  assert.equal(s.chaosBag.filter(token => token === '+1').length, 1)
  assert.equal(s.chaosBag.filter(token => token === '0').length, 1)
  initializeChaosBag(s, ['-4'])
  assert.equal(s.chaosBag.length, 3)
  s.debugNextTokens = ['+1']
  beginChaosTest(s); assert.equal(drawChaosToken(s), '+1'); endChaosTest(s, ['+1'])
  assert.equal(s.chaosBag.filter(token => token === '+1').length, 1)
  s.campaign.chaosBag = []
  initializeChaosBag(s, ['-4'])
  assert.deepEqual(s.chaosBag, ['-4', '+1', '0'])
})

test('真实关卡结算按最终收益加1翻倍，旧经验不翻倍，完成准备后可返回且不重发候选', () => {
  const s = setup(); complete(s)
  play(s, { action: 'hubDoneSeat' }); play(s, { action: 'hubBeginScenario' })
  for (let guard = 0; guard < 20 && s.pendingChoice; guard++) {
    play(s, legalMoves(s, 0).find(move => move.optionId === 'done') || legalMoves(s, 0)[0])
  }
  s.campaign.investigators[0].xp = 7
  s.campaign.investigators[0].earnedXp = 7
  s.campaign.xp = 7
  const normal = structuredClone(s); delete normal.deckMode
  for (const state of [normal, s]) {
    play(state, { action: 'debug', kind: 'endScenario', resolutionKey: 'noResolution' })
    for (let guard = 0; guard < 20 && state.pendingChoice; guard++) play(state, legalMoves(state, 0)[0])
  }
  const base = normal.campaign.scenarioResults[0].investigators[0].xpAwarded
  assert.equal(s.campaign.scenarioResults[0].investigators[0].xpAwarded, (base + 1) * 2)
  assert.equal(s.campaign.investigators[0].xp, 7 + (base + 1) * 2)
  play(s, { action: 'hubContinue' })
  const offers = [...s.campaign.investigators[0].draftMode.options]
  play(s, { action: 'hubDoneSeat' })
  assert.equal(s.hubReady, true)
  play(s, { action: 'hubResumeDraft' })
  assert.deepEqual(s.campaign.investigators[0].draftMode.options, offers)
  assert.equal(s.hubReady, false)
  assert.equal(s.uiState, 'interlude')
})

test('地球边缘检查点在普通与选牌模式均禁止升级，不生成候选', async () => {
  const world = await loadEoteWorld()
  const s = createGameState({ campaignHub: true, deckMode: 'draft', campaignId: 'edgeOfTheEarth', seed: 'draft-checkpoint-window' }, [{ seat: 0, role: 'human' }])
  settleChoices(world, s)
  const leader = legalMoves(s, 0).find(move => move.action === 'hubSetLeader')
  if (leader) play(s, leader)
  const scenario = legalMoves(s, 0).find(move => move.action === 'hubSelectScenario')
  if (scenario) play(s, scenario)
  play(s, { action: 'hubGoSetup' }); settleChoices(world, s)
  play(s, { action: 'hubSelectInvestigator', code: '01001' }); complete(s)
  play(s, { action: 'hubDoneSeat' }); play(s, { action: 'hubBeginScenario' })
  settleChoices(world, s)
  finishScenario(world, s, 'resolution1')
  const normal = structuredClone(s)
  delete normal.deckMode
  delete normal.campaign.investigators[0].draftMode
  for (const state of [normal, s]) { play(state, { action: 'hubContinue' }); settleChoices(world, state) }
  assert.equal(normal.campaign.upgradesAllowed, false)
  assert.equal(s.campaign.flow.nodeId, 'checkpoint1')
  assert.equal(s.uiState, 'interlude')
  assert.equal(s.campaign.upgradesAllowed, false)
  assert.equal(s.campaign.investigators[0].draftMode.phase, 'ready')
  assert.deepEqual(s.campaign.investigators[0].draftMode.options, [])
  assert.equal(legalMoves(s, 0).some(move => ['hubDraftBuy', 'hubDraftRefresh'].includes(move.action)), false)
})
