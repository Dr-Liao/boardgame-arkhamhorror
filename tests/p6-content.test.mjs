import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createGameState, legalMoves, applyMove, validateMove, decisionSeat } from '../src/engine/engine.js'
import { availablePurchases, purchaseCard, campaignCardChange } from '../src/campaign/campaign.js'
import { contentRegistry } from '../content/registered.js'
import { createContentRegistry, campaignListForUi } from '../content/registry.js'
import { expansionCardReady } from '../content/expansions.js'
import { manifest, effects } from '../content/packs/dunwichSupport/manifest.js'
import { getAvailability } from '../src/deck/availability.js'
import { buildDeck, buildDeckFromList } from '../src/deck/deckbuilding.js'
import { INVESTIGATORS } from '../src/cards/cards-data.js'
import { SCENARIOS } from '../src/cards/scenarios-data.js'
import * as gathering from '../content/campaigns/nightOfTheZealot/scenarios/theGathering/index.js'
import * as masks from '../content/campaigns/nightOfTheZealot/scenarios/theMidnightMasks/index.js'
import * as devourer from '../content/campaigns/nightOfTheZealot/scenarios/theDevourerBelow/index.js'
import { playthrough, settings } from '../tools/p6-playthrough.mjs'

function move(s, m) { assert.equal(validateMove(s, decisionSeat(s), m), null); applyMove(s, decisionSeat(s), m) }
function answer(s, id) { move(s, { action: 'choose', choiceId: s.pendingChoice.id, optionId: id }) }
function settle(s) { for (let i = 0; s.pendingChoice; i++) { assert.ok(i < 100); const opts = s.pendingChoice.options; answer(s, opts.find(o => ['done','skip','self'].includes(o.id))?.id || opts[0].id) } }
// Unit fixtures isolate effects. The trajectory tests below never edit state.
function fixture(code = '01001', count = 1) {
  const s = createGameState({ seed: 'p6-unit', playerInvestigator: code }, Array.from({ length: count }, (_, seat) => ({ seat })))
  settle(s)
  for (const inv of s.investigators) { inv.actionsLeft = 10; inv.hand = []; inv.deck = Array(20).fill('01088'); inv.resources = 10 }
  return s
}
test('P6 01019 急救治疗同地点队友、排除远处和未受伤者，恢复仅支付一次', () => {
  const s = fixture('01001', 3), inv = s.investigators[0]
  inv.assets = [{ id: 'aid', code: '01019', uses: 3 }]
  s.investigators[1].damage = 2; s.investigators[2].horror = 2
  move(s, { action: 'ability', assetId: 'aid', abilityIndex: 0 })
  assert.equal(s.pendingChoice.kind, 'investigator')
  assert.deepEqual(s.pendingChoice.options.map(o => o.id), ['1','2'])
  const copy = structuredClone(s)
  for (const target of [s, copy]) { answer(target, '1'); settle(target) }
  assert.deepEqual(s, copy); assert.equal(s.investigators[1].damage, 1); assert.equal(s.investigators[0].assets[0].uses, 2)
  s.investigators[1].damage = 0; s.investigators[2].location = 'remote'
  assert.ok(!legalMoves(s).some(m => m.assetId === 'aid'))
})
test('P6 01108 书房敌人被弃置而非击败，不产生胜利点和罗兰反应', () => {
  const s = fixture(), inv = s.investigators[0]
  inv.clues = 2; s.clues = 2
  s.enemies = [{ id: 'priest', code: 'ghoulPriest', originalCode: '01116', location: 'study', victory: 2, engagedSeat: 0 }]
  inv.engaged = ['priest']
  move(s, { action: 'advanceAct' }); settle(s)
  assert.equal(s.actIndex, 1); assert.equal(s.enemies.length, 0)
  assert.equal(s.victory, 0); assert.equal(s.victoryDisplay.length, 0)
  assert.deepEqual(s.encounterDiscard, ['ghoulPriest']); assert.equal(s.investigators[0].clues, 0)
  assert.ok(!s.log.some(t => t.includes('rolandClue')))
})
test('P6 01117 剧情丽塔不占普通卡尺寸、不阻断升级且随牌组保留', () => {
  const s = fixture(), cp = s.campaign; cp.phase = 'interlude'; cp.investigators[0].xp = 5
  campaignCardChange(cp, 0, '01117', 'add', 'theGathering')
  assert.ok(availablePurchases(cp.investigators[0]).includes('01095'))
  const before = cp.investigators[0].deck.length
  const removed = cp.investigators[0].deck.find(c => c === '01016') || cp.investigators[0].deck.find(c => c === '01087')
  purchaseCard(cp, 0, '01095', removed)
  assert.equal(cp.investigators[0].deck.length, before); assert.ok(cp.investigators[0].deck.includes('01117'))
})
test('P6 01155 静谧空地按调查员每回合独立限次', () => {
  const s = fixture('01001', 2)
  s.locations = [{ ...structuredClone(SCENARIOS.theDevourerBelow.locations.quietGlade), revealed: true }]
  for (const inv of s.investigators) { inv.location = 'quietGlade'; inv.damage = 2 }
  move(s, { action: 'locationAbility', locationId: 'quietGlade' }); settle(s)
  assert.equal(s.investigators[0].damage, 1)
  assert.ok(!legalMoves(s).some(m => m.action === 'locationAbility'))
  s.currentSeat = 1
  assert.ok(legalMoves(s).some(m => m.action === 'locationAbility'))
  move(s, { action: 'locationAbility', locationId: 'quietGlade' }); settle(s)
  assert.equal(s.investigators[1].damage, 1)
})
test('P6 01026 多余弹药可超过初始 uses，费用与增加量准确', () => {
  const s = fixture(), inv = s.investigators[0]
  inv.assets = [{ id: 'gun', code: '01016', uses: 4 }]; inv.hand = ['01026']
  move(s, { action: 'play', cardId: '01026' }); settle(s)
  assert.equal(s.investigators[0].assets[0].uses, 7)
})
test('P6 01013 黑暗回忆保留手中反复惩罚，可付费打出仅增加毁灭', () => {
  const s = fixture('01004'), inv = s.investigators[0]
  inv.hand = ['01013']; s.encounterDeck = Array(20).fill('dissonantVoices')
  move(s, { action: 'endTurn' }); settle(s)
  assert.ok(s.investigators[0].hand.includes('01013')); assert.equal(s.investigators[0].horror, 2)
  // Remove an independently tested card-type restriction to isolate the event.
  s.investigators[0].threat = []
  const doom = s.doom, resources = s.investigators[0].resources
  move(s, { action: 'play', cardId: '01013' }); settle(s)
  assert.equal(s.doom, doom + 1); assert.equal(s.investigators[0].resources, resources - 2)
  assert.equal(s.investigators[0].horror, 2); assert.ok(!s.investigators[0].hand.includes('01013'))
})
test('P6 02020 实验室助理入场可选抽两张，恢复不重复抽牌', () => {
  const s = fixture('01002'), inv = s.investigators[0]; inv.hand = ['02020']
  move(s, { action: 'play', cardId: '02020' })
  assert.equal(s.pendingChoice.kind, 'reaction'); const copy = structuredClone(s)
  const id = s.pendingChoice.options.find(o => o.id !== 'skip').id
  for (const target of [s, copy]) { answer(target, id); settle(target) }
  assert.deepEqual(s, copy); assert.equal(s.investigators[0].hand.length, 2)
  assert.equal(s.investigators[0].resources, 8)
})
test('P6 02020 实验室助理把维持手牌上限提升至10，移除后恢复8', () => {
  for (const present of [true, false]) {
    const s = fixture('01002'), inv = s.investigators[0]
    inv.hand = Array(9).fill('01088'); inv.assets = present ? [{ id: 'lab', code: '02020' }] : []
    s.encounterDeck = Array(20).fill('dissonantVoices')
    move(s, { action: 'endTurn' }); settle(s)
    assert.equal(s.investigators[0].hand.length, present ? 10 : 8)
  }
})
test('P6 02030 澄明心智消耗充能治疗队友，空充能留场但不可启动', () => {
  const s = fixture('01004', 2), inv = s.investigators[0]
  inv.assets = [{ id: 'clarity', code: '02030', uses: 1 }]; s.investigators[1].horror = 2
  move(s, { action: 'ability', assetId: 'clarity', abilityIndex: 0 }); settle(s)
  assert.equal(s.investigators[1].horror, 1); assert.equal(s.investigators[0].assets[0].uses, 0)
  assert.ok(!legalMoves(s).some(m => m.assetId === 'clarity'))
})
test('D10 support pack exposes researched solution base card while unknown mechanics remain gated', () => {
  const shown = campaignListForUi(contentRegistry)[0].contentPacks.find(p => p.id === manifest.id)
  assert.equal(shown.status, 'playable'); assert.equal(shown.cards.find(c => c.code === '02021').blockedReason, null)
  const registry = createContentRegistry({ packs: contentRegistry.listPacks().filter(p => p.id !== manifest.id), campaigns: [contentRegistry.getCampaign('nightOfTheZealot')], scenarios: [gathering, masks, devourer] })
  assert.equal(registry.assertLaunchable('nightOfTheZealot').id, 'nightOfTheZealot')
  assert.equal(getAvailability('02021').deckbuilding, true)
  const unimplemented = { ...manifest.cards.find(c => c.code === '02021'), requiredMechanicIds: ['missingMechanism'] }
  assert.equal(expansionCardReady(manifest, unimplemented, { '02021': {} }), false)
  const deck = buildDeck(INVESTIGATORS['01002'], { seed: 1 }).playerCards
  assert.deepEqual(buildDeckFromList(INVESTIGATORS['01002'], ['02021', ...deck.slice(1)]).errors, [])
  const unknown = { ...gathering, manifest: { ...gathering.manifest, requiredMechanicIds: ['missingMechanism'] } }
  const blocked = createContentRegistry({ packs: contentRegistry.listPacks(), campaigns: [contentRegistry.getCampaign('nightOfTheZealot')], scenarios: [unknown, masks, devourer] })
  assert.throws(() => blocked.assertLaunchable('nightOfTheZealot'), /缺少机制/)
})
for (const branch of ['r1', 'r2']) test(`P6 纯合法动作从局外完成集结胜利 ${branch}，逐步JSON恢复一致`, () => {
  const result = playthrough('p6-5', { branch, stopAfterFirst: true })
  assert.equal(result.state.resolution, branch)
  assert.equal(result.state.uiState, 'scenarioResult')
  let restored = createGameState({ ...settings, seed: result.seed }, [{ seat: 0 }])
  for (const entry of result.trace) { restored = JSON.parse(JSON.stringify(restored)); assert.equal(validateMove(restored, entry.seat, entry.move), null); applyMove(restored, entry.seat, entry.move) }
  assert.deepEqual(JSON.parse(JSON.stringify(result.state)), restored)
  assert.equal(restored.campaign.records.houseBurned, branch === 'r1')
  assert.equal(restored.campaign.records.ghoulPriestAlive, false)
})
test('P6 纯合法动作覆盖自然失败与撤退，保留存活祭司记录', () => {
  const failed = playthrough('p6-0', { mode: 'failure', stopAfterFirst: true })
  assert.equal(failed.state.uiState, 'scenarioResult'); assert.ok(failed.state.investigators[0].defeated)
  const resigned = playthrough('p6-0', { mode: 'resign', stopAfterFirst: true })
  assert.equal(resigned.state.uiState, 'scenarioResult'); assert.ok(resigned.trace.some(t => t.move.action === 'resign'))
  assert.equal(resigned.state.campaign.records.ghoulPriestAlive, true)
})
