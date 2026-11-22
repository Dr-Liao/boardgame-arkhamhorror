import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { contentRegistry, registerContentBundle } from '../content/registered.js'
import { createContentRegistry } from '../content/registry.js'
import { basicWeaknessPool, createGameState } from '../src/engine/engine.js'
import { randomValue } from '../src/engine/rules-state.js'
import { buildDeck } from '../src/deck/deckbuilding.js'
import { INVESTIGATORS } from '../src/cards/cards-data.js'
import { applyCampaignEffect } from '../src/campaign/campaign-effects.js'
import { flowCondition } from '../src/campaign/campaign-flow.js'
import { viewState } from '../src/integration/observation.js'
import { legalMoves, move, settle, validateMove } from './core-fixture.mjs'
import { batchTwoFixture } from './batch-two-content.fixture.mjs'

const players = [{ seat: 0, role: 'human' }]
const name = '原创支线与独立剧本通过大厅、XP 入场结算、存档和回主线'
const registerFixture = (id, standalone) => registerContentBundle(batchTwoFixture(id, standalone))
const send = (state, action) => { move(state, { action }); settle(state) }

test(name, () => {
  if (process.env.ARKHAM_BATCH_TWO_CHILD !== '1') {
    const env = { ...process.env, ARKHAM_BATCH_TWO_CHILD: '1' }
    delete env.NODE_TEST_CONTEXT
    const result = spawnSync(process.execPath, ['--test', '--test-name-pattern', name, fileURLToPath(import.meta.url)], {
      env, encoding: 'utf8',
    })
    assert.ifError(result.error)
    assert.equal(result.status, 0, result.stdout + result.stderr)
    return
  }
  registerFixture('standaloneWorkshop', true)
  assert.throws(() => createGameState({ campaignId: 'standaloneWorkshop', playerInvestigator: '01001' }, players), /不能使用/)
  assert.throws(() => createGameState({ campaignId: 'standaloneWorkshop' }, [...players, { seat: 1 }]), /不足/)
  const standalone = createGameState({ campaignId: 'standaloneWorkshop', campaignHub: true, difficulty: 'hard', seed: 'workshop' }, players)
  send(standalone, 'hubGoSetup')
  assert.deepEqual(legalMoves(standalone).filter(row => row.action === 'hubSelectInvestigator').map(row => row.code), ['90017'])
  assert.ok(validateMove(standalone, 0, { action: 'hubSelectInvestigator', code: '01001' }))
  move(standalone, { action: 'hubSelectInvestigator', code: '90017' })
  const { playerCards } = buildDeck(INVESTIGATORS['90017'])
  assert.ok(playerCards.includes('01066'))
  playerCards[playerCards.indexOf('01066')] = '10102'
  move(standalone, { action: 'hubSetDeck', codes: playerCards })
  assert.equal(standalone.campaign.investigators[0].spentXp, 2)
  assert.equal(standalone.campaign.investigators[0].xp, 2)
  assert.equal(viewState(standalone, 0).campaign.opening.experience, 4)
  for (const action of ['hubConfirmDeck', 'hubDoneSeat', 'hubBeginScenario']) send(standalone, action)
  assert.deepEqual(standalone.chaosBag, ['-4', '-3'])
  send(standalone, 'resign')
  if (standalone.uiState === 'scenarioResult') send(standalone, 'hubContinue')
  assert.equal(standalone.uiState, 'campaignResult')

  registerFixture('sideWorkshop', false)
  let campaign = createGameState({ campaignId: 'sideWorkshop', campaignHub: true, seed: 'side-workshop' }, players)
  send(campaign, 'hubGoSetup')
  move(campaign, { action: 'hubSelectInvestigator', code: '90017' })
  send(campaign, 'hubAutoDeck')
  const pool = basicWeaknessPool(campaign, '90017', { automatic: true })
  const target = pool.indexOf('51011')
  assert.ok(target >= 0)
  for (let rngState = 0; ; rngState++) {
    assert.ok(rngState < 100)
    if (Math.floor(randomValue({ rngState }) * pool.length) !== target) continue
    campaign.rngState = rngState
    break
  }
  send(campaign, 'hubConfirmDeck')
  assert.ok(campaign.campaign.investigators[0].deck.includes('51011'))
  for (const action of ['hubDoneSeat', 'hubBeginScenario', 'resign']) send(campaign, action)
  const beforeFee = campaign.campaign.investigators[0].xp
  assert.ok(beforeFee >= 2)
  move(campaign, { action: 'hubContinue' })
  assert.deepEqual(campaign.pendingChoice.options.map(row => row.id), ['repair', 'continue'])
  campaign = JSON.parse(JSON.stringify(campaign))
  settle(campaign, () => 'repair')
  assert.equal(campaign.hubSelectedScenarioId, 'sideWorkshopRepair')
  assert.equal(campaign.campaign.investigators[0].xp, beforeFee - 2)
  for (const action of ['hubBeginScenario', 'resign', 'hubContinue']) send(campaign, action)
  assert.equal(campaign.hubSelectedScenarioId, 'sideWorkshopSignoff')
  assert.deepEqual(campaign.campaign.scenarioResults.map(result => result.scenarioId), ['sideWorkshopSurvey', 'sideWorkshopRepair'])
  assert.equal(campaign.campaign.investigators[0].xp, beforeFee - 2 + 3)
  assert.equal(campaign.campaign.investigators[0].trauma.mental, 1)
  assert.equal(campaign.campaign.records.instrumentRepaired, true)
})

test('支线全队费用原子扣减，注册拒绝无效开局和费用', () => {
  const state = { campaign: { xp: 6, investigators: {
    0: { seat: 0, name: '甲', status: 'active', xp: 5, spentXp: 0 },
    1: { seat: 1, name: '乙', status: 'active', xp: 1, spentXp: 0 },
  } } }
  assert.equal(flowCondition({ eachInvestigatorXp: 2 }, state.campaign), false)
  assert.throws(() => applyCampaignEffect(state, { type: 'spendExperience', amount: 2 }, () => {}), /无法支付/)
  assert.equal(state.campaign.investigators[0].xp, 5)
  assert.equal(state.campaign.investigators[0].spentXp, 0)
  assert.equal(flowCondition({ eachInvestigatorXp: 1 }, state.campaign), true)
  applyCampaignEffect(state, { type: 'spendExperience', amount: 1 }, () => {})
  assert.equal(state.campaign.xp, 4)
  assert.equal(state.campaign.investigators[1].spentXp, 1)

  for (const [modify, pattern] of [
    [manifest => { manifest.opening.experience = -1 }, /非负整数/],
    [manifest => { manifest.opening.investigators = ['99999'] }, /未开放/],
    [manifest => { manifest.flow.nodes.choice.options[0].effects[0].amount = 0 }, /费用必须是正整数/],
  ]) {
    const fixture = batchTwoFixture('invalidWorkshop')
    modify(fixture.campaigns[0])
    assert.throws(() => createContentRegistry({ ...fixture, packs: contentRegistry.listPacks() }), pattern)
  }
})
