import test from 'node:test'
import assert from 'node:assert/strict'
import { asset, enemy, fixture, move, settle } from './core-fixture.mjs'
import { registeredEntry } from '../src/engine/ability.js'
import { ALL_CARDS, INVESTIGATORS } from '../src/cards/cards-data.js'
import { deckBuilderData, drawBasicWeaknesses } from '../src/deck/deckbuilding.js'
import { getAvailability } from '../src/deck/availability.js'
import { returnPlayerCards, returnResearchUpgrades, returnWeaknesses } from '../src/deck/return-packs.js'
import { canonicalCode } from '../src/integration/arkhamdb.js'
import { purchaseCard, replacementOptions } from '../src/campaign/campaign.js'
import { viewState } from '../src/integration/observation.js'
import { contentRegistry } from '../content/registered.js'
import { basicWeaknessPool, performTest } from '../src/engine/engine.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import { concealedById, placeMiniCard } from '../src/engine/tsk-concealed.js'

test('前三套重返玩家牌登记构筑与弱点依赖，修订核心印刷归并升级原版', () => {
  const pool = new Map(deckBuilderData().cardPool.map(card => [card.code, card]))
  for (const code of returnPlayerCards) {
    const upgradeOnly = returnResearchUpgrades.includes(code)
    assert.ok(registeredEntry(code), code)
    assert.equal(getAvailability(code).deckbuilding, !upgradeOnly, code)
    assert.equal(Boolean(pool.get(code)?.upgradeOnly), upgradeOnly, code)
    assert.ok(pool.has(code), code)
  }
  for (const code of returnWeaknesses) {
    assert.ok(registeredEntry(code), code)
    const availability = getAvailability(code)
    assert.ok(availability.strictAccepted && availability.dependencyOnly && !availability.deckbuilding, code)
    assert.deepEqual(drawBasicWeaknesses(INVESTIGATORS['01001'], () => 0, [code]), [code])
  }
  assert.equal(canonicalCode('01689'), '51007')
  assert.deepEqual(registeredEntry('01689').abilities.map(ability => ability.kind),
    registeredEntry('51007').abilities.map(ability => ability.kind))
})

test('前三套重返玩家包可由战役声明为依赖，并沿用原版战役的基础弱点池', () => {
  const packs = ['rtnotzPlayer', 'rtdwlPlayer', 'rtptcPlayer'].map(id => contentRegistry.getPack(id))
  assert.deepEqual(packs.map(pack => pack.basicWeaknessCodes), [[], ['51011'], ['52011', '52012', '52013']])
  assert.deepEqual(packs.flatMap(pack => pack.cards.map(card => card.code)).sort(), [...returnPlayerCards, ...returnWeaknesses].sort())
  const originalCampaigns = ['nightOfTheZealot', 'theDunwichLegacy', 'thePathToCarcosa']
  for (const id of originalCampaigns) {
    const manifest = contentRegistry.getCampaign(id)
    assert.ok(!packs.some(pack => manifest.requiredPackIds.includes(pack.id)))
    assert.ok(!basicWeaknessPool({ campaign: { id } }).some(code => returnWeaknesses.includes(code)))
  }
})

test('51010 以本次检定指定的基础值决定能否投入与万能图标数量', () => {
  for (const [baseValue, canCommit] of [[3, true], [5, false]]) {
    const state = fixture('01002')
    state.investigators[0].willpower = 9
    state.investigators[0].hand = ['51010']
    let outcome
    let offered = false
    const execute = draft => { outcome = performTest(draft, 0, 'willpower', 5, { baseValue }) }
    resolveTransaction(state, 0, { action: 'fixed-base-fixture' }, execute)
    for (let step = 0; state.pendingChoice; step++) {
      const choice = state.pendingChoice
      assert.ok(step < 20)
      const commit = choice.kind === 'commit' && choice.options.some(option => option.id === '0')
      if (commit) offered = true
      const optionId = commit ? '0' : choice.options.find(option => ['done', 'skip'].includes(option.id))?.id || choice.options[0].id
      resolveTransaction(state, choice.seat, { action: 'choose', choiceId: choice.id, optionId }, execute)
    }
    assert.equal(offered, canCommit)
    assert.equal(outcome.value, canCommit ? 7 : 5)
    assert.equal(state.investigators[0].discard.includes('51010'), canCommit)
  }
})

test('51009 可改用失败攻击的伤害揭露隐匿牌并避免误伤队友', () => {
  const state = fixture('01001', 2)
  const [inv, teammate] = state.investigators
  inv.hand = ['51009']
  const target = enemy(state, { fight: inv.combat + 1, engagedSeat: teammate.seat })
  const mini = placeMiniCard(state, { kind: 'Decoy', decoy: true, locationId: inv.location })
  move(state, { action: 'fight', enemyId: target.id })
  settle(state, choice => choice.options.find(option => option.cardCode === '51009' || option.id === mini.id)?.id)
  assert.equal(concealedById(state, mini.id), null)
  assert.equal(state.investigators[1].damage, 0)
  assert.equal(state.enemies.find(item => item.id === target.id).damageTaken, 0)
  assert.ok(state.investigators[0].discard.includes('51009'))
})

test('隐私玩家弱点保留在手中并对旁观座位隐藏，满足条件后进入玩家弃牌堆', () => {
  const state = fixture('01002', 2)
  let inv = state.investigators[0]
  const code = '52012'
  inv.deck.push(code)
  move(state, { action: 'draw' })
  settle(state)
  inv = state.investigators[0]
  assert.ok(inv.hiddenCards.includes(code))
  assert.ok(viewState(state, 0).investigators[0].hand.includes(code))
  assert.ok(!viewState(state, 1).investigators[0].hand.includes(code))
  assert.ok(!inv.discard.includes(code))

  const here = state.locations.find(location => location.id === inv.location)
  here.shroud = 0
  here.clues = 0
  move(state, { action: 'investigate' })
  settle(state, choice => choice.options.find(option => option.cardCode === code)?.id)
  inv = state.investigators[0]
  assert.ok(!inv.hiddenCards.includes(code))
  assert.ok(inv.discard.includes(code))
  assert.ok(!state.encounterDiscard.includes(code))
})

test('重返研究形态只有在记录对应研究后才可购买', () => {
  for (const [base, upgrade, unlock] of [
    ['02021', '51004', 'identifiedStrangeSolution'],
    ['03025', '52004', 'translatedGlyphs'],
  ]) {
    const { campaign } = fixture('01002')
    const record = campaign.investigators[0]
    if (!record.deck.includes(base)) {
      const index = record.deck.findIndex(code => ALL_CARDS[code]?.type === 'asset' && !ALL_CARDS[code]?.signatureFor)
      assert.ok(index >= 0)
      record.deck[index] = base
    }
    record.xp = 4
    campaign.phase = 'interlude'
    assert.deepEqual(replacementOptions(record, upgrade, campaign.records), [])
    campaign.records[unlock] = true
    assert.ok(replacementOptions(record, upgrade, campaign.records).some(row => row.code === base))
    const purchase = purchaseCard(campaign, 0, upgrade, base)
    assert.equal(purchase.cost, ALL_CARDS[upgrade].xp)
    assert.ok(record.deck.includes(upgrade))
  }
})

test('移出同编号副本按所有者结算，保留同名升级和其他调查员的卡', () => {
  const state = fixture('01001', 2)
  let [owner, other] = state.investigators
  const code = '50001'
  const sameName = '01017'
  assert.equal(ALL_CARDS[code].name, ALL_CARDS[sameName].name)
  owner.deck = ['51011', code, '51011']
  owner.hand = [code, sameName]
  owner.discard = [code]
  other.hand = [code]
  const borrowed = asset(state, code, { ownerSeat: owner.seat }, other.seat)
  const foreign = asset(state, code, {}, other.seat)
  move(state, { action: 'draw' })
  settle(state)
  ;[owner, other] = state.investigators
  assert.deepEqual(owner.deck, ['51011'])
  assert.deepEqual(owner.hand, [sameName])
  assert.deepEqual(owner.discard, ['51011'])
  assert.deepEqual(other.hand, [code])
  assert.deepEqual(other.assets.map(card => card.id), [foreign.id])
  assert.ok(!other.assets.some(card => card.id === borrowed.id))
  assert.equal(state.removedFromGame.filter(card => card === code).length, 4)
})
