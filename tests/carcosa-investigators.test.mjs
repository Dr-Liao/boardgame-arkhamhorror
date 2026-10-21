import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture, asset, enemy, move, settle, answer, legalMoves, validateMove } from './core-fixture.mjs'
import { createGameState, performTest, getStat } from '../src/engine/engine.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import { viewState } from '../src/integration/observation.js'
import { EFFECTS, INVESTIGATOR_ABILITIES } from '../src/cards/card-effects.js'
import { registeredEntry } from '../src/engine/ability.js'
import { commitProfile, weaknessProfile } from '../src/engine/lifecycle.js'
import { canSelectInvestigator } from '../src/deck/availability.js'
import { validateDeckRules } from '../src/deck/deck-rules.js'
import { matchesDeckOptions, signatureAndWeaknesses } from '../src/deck/deckbuilding.js'
import { ALL_CARDS, INVESTIGATORS } from '../src/cards/cards-data.js'
import { manifest as investigatorPack } from '../content/packs/carcosaInvestigators/manifest.js'

function markFixture() {
  const state = fixture()
  const investigator = state.investigators[0]
  Object.assign(investigator, {
    code: '03001',
    name: '马克·哈里根',
    willpower: 3,
    intellect: 2,
    combat: 5,
    agility: 3,
    health: 9,
    sanity: 5,
  })
  return state
}

function investigatorFixture(code, stats) {
  const state = fixture()
  Object.assign(state.investigators[0], { code, ...stats })
  return state
}

function resolveTest(state, execute, choose) {
  resolveTransaction(state, 0, { action: 'carcosaInvestigatorTest' }, execute)
  while (state.pendingChoice) {
    const pending = state.pendingChoice
    const optionId = choose?.(pending)
      ?? pending.options.find(option => ['done', 'skip'].includes(option.id))?.id
      ?? pending.options[0].id
    resolveTransaction(state, pending.seat, {
      action: 'choose',
      choiceId: pending.id,
      optionId,
    }, execute)
  }
}

function settleExecution(state, execute, choose) {
  while (state.pendingChoice) {
    const pending = state.pendingChoice
    const optionId = choose?.(pending, state)
      ?? pending.options.find(option => ['done', 'skip'].includes(option.id))?.id
      ?? pending.options[0].id
    resolveTransaction(state, pending.seat, {
      action: 'choose', choiceId: pending.id, optionId,
    }, execute)
  }
}

test('C1 Mark is implemented inside the verified Carcosa investigator boundary', () => {
  assert.equal(investigatorPack.status, 'verified')
  assert.equal(canSelectInvestigator('03001'), true)
  assert.deepEqual(INVESTIGATOR_ABILITIES['03001'].startsWith, ['03009'])
  assert.equal(INVESTIGATOR_ABILITIES['03001'].elderSign.kind, 'perDamage')
  assert.equal(INVESTIGATOR_ABILITIES['03001'].reactions[0].when, 'damagePlaced')
  // Phase 5：签名卡的行为数据已搬到能力层，断言改为读生命周期读点（描述子优先）。
  assert.equal(commitProfile('03007').homeFront, true)
  assert.equal(weaknessProfile('03008').type, 'shellShock')
  // Phase 6（6e-14）：03009 的主动能力与「不可离场」搬到能力层条目。
  assert.equal(registeredEntry('03009').cannotLeavePlay, true)
  assert.equal(registeredEntry('03009').abilities.length, 1)
  // Phase 5（5b-9）：03009b 的「不可离场」与被动搬到能力层条目。
  assert.equal(registeredEntry('03009b').cannotLeavePlay, true)
  assert.deepEqual(registeredEntry('03009b').passive.stats,
    { willpower: -1, intellect: -1, combat: -1, agility: -1 })
})

test('C1 all six investigators expose exact deck sizes and signature quantities and are selectable', () => {
  const expected = {
    '03001': { size: 30, quantities: { '03007': 1, '03008': 1, '03009': 1 } },
    '03002': { size: 30, quantities: { '03010': 1, '03011': 1 } },
    '03003': { size: 33, quantities: { '03012': 3, '03013': 1 } },
    '03004': { size: 30, quantities: { '03014': 1, '03015': 1 } },
    '03005': { size: 30, quantities: { '03016': 1, '03017': 1 } },
    '03006': { size: 35, quantities: { '03018': 2, '03019': 2 } },
  }
  for (const [code, contract] of Object.entries(expected)) {
    const investigator = INVESTIGATORS[code]
    assert.equal(investigator.deckRequirements.size, contract.size)
    assert.equal(canSelectInvestigator(code), true)
    for (const [signatureCode, quantity] of Object.entries(contract.quantities)) {
      assert.equal(ALL_CARDS[signatureCode].quantity || 1, quantity)
    }
  }
  const mark = signatureAndWeaknesses(INVESTIGATORS['03001'], () => 0, { basicWeaknessPool: ['01096'] })
  assert.deepEqual(mark.signatureCards, ['03007', '03009'])
  assert.deepEqual(mark.signatureWeaknesses, ['03008'])
})

test('C1 all six real openings preserve exact signatures and replay setup choices from JSON', () => {
  const expected = {
    '03001': { '03007': 1, '03008': 1, '03009': 1 },
    '03002': { '03010': 1, '03011': 1 },
    '03003': { '03012': 3, '03013': 1 },
    '03004': { '03014': 1, '03015': 1 },
    '03005': { '03016': 1, '03017': 1 },
    '03006': { '03018': 2, '03019': 2 },
  }
  const chooseSetup = (pending, state) => {
    if (pending.source === 'sefinaBeneath' && (state.investigators[0].beneath?.length || 0) < 5) {
      return pending.options.find(option => option.id !== 'done')?.id
    }
    if (pending.source === 'lolaOpeningRole') return 'guardian'
    return pending.options.some(option => option.id === 'done') ? 'done' : null
  }
  for (const [code, signatures] of Object.entries(expected)) {
    const state = createGameState({ playerInvestigator: code, seed: `c1-opening-${code}` }, [{ seat: 0 }])
    if (code === '03003') {
      assert.equal(state.investigators[0].hand.length, 13)
      assert.ok(['sefinaBeneath', 'sefinaKeepEight'].includes(state.pendingChoice.source),
        '卡池扩张后开局分支可能先进入保留八张' )
    }
    const restored = JSON.parse(JSON.stringify(state))
    settle(state, chooseSetup)
    settle(restored, chooseSetup)
    assert.deepEqual(restored, state)
    const investigator = state.investigators[0]
    const zoneCodes = [
      ...investigator.hand,
      ...investigator.deck,
      ...investigator.discard,
      ...(investigator.beneath || []),
      ...investigator.assets.map(card => card.code),
      ...investigator.threat.map(card => card.code),
    ]
    for (const [signatureCode, quantity] of Object.entries(signatures)) {
      assert.equal(zoneCodes.filter(cardCode => cardCode === signatureCode).length, quantity)
    }
    if (code === '03001') assert.equal(investigator.assets.some(card => card.code === '03009'), true)
    if (code === '03003') {
      assert.ok(investigator.beneath.length > 0 && investigator.beneath.length <= 5)
      assert.equal(investigator.hand.length, 8)
    }
    if (code === '03006') assert.equal(investigator.role, 'guardian')
  }
})

test('C1 trait, charge-use and Lola class-distribution deck rules execute', () => {
  assert.equal(matchesDeckOptions(INVESTIGATORS['03001'], {
    code: 'tactic-probe', type: 'event', klass: 'survivor', xp: 0, traits: ['Tactic'],
  }), true)
  assert.equal(matchesDeckOptions(INVESTIGATORS['03004'], {
    code: 'charge-probe', type: 'asset', klass: 'guardian', xp: 4, text: 'Uses (3 charges).',
  }), true)
  const cards = {}
  const deck = []
  for (const [klass, count] of [['guardian', 7], ['seeker', 7], ['rogue', 7], ['neutral', 14]]) {
    for (let index = 0; index < count; index++) {
      const code = `${klass}-${index}`
      cards[code] = { code, name: code, type: 'event', klass, xp: 0 }
      deck.push(code)
    }
  }
  assert.deepEqual(validateDeckRules(INVESTIGATORS['03006'], deck.slice(0, 7), cards, { partial: true }).errors, [])
  assert.deepEqual(validateDeckRules(INVESTIGATORS['03006'], deck, cards).errors, [])
  cards['rogue-6'].klass = 'neutral'
  assert.ok(validateDeckRules(INVESTIGATORS['03006'], deck, cards).errors.some(error => error.includes('3 different factions')))
})

test('C1 Mark elder sign adds his current damage', () => {
  const state = markFixture()
  const investigator = state.investigators[0]
  investigator.damage = 3
  state.chaosBag = ['eldersign']
  const execute = current => performTest(current, 0, 'combat', 8, {
    resolve: result => { current.testResult = result },
  })
  resolveTest(state, execute)
  assert.equal(state.testResult.value, 8)
  assert.equal(state.testResult.success, true)
})

test('C1 Sophie takes direct damage, grants +2, flips at five damage and triggers Mark once per phase', () => {
  const state = markFixture()
  const investigator = state.investigators[0]
  investigator.damage = 4
  investigator.deck = ['01088', '01088']
  const sophie = asset(state, '03009')
  state.chaosBag = ['0']
  const execute = current => performTest(current, 0, 'combat', 6, {
    resolve: result => { current.testResult = result },
  })
  let usedSophie = false
  resolveTest(state, execute, pending => {
    const option = pending.options.find(item => item.assetId === sophie.id)
    if (option && !usedSophie) {
      usedSophie = true
      return option.id
    }
    if (pending.source === 'markDraw') return 'trigger'
    return null
  })
  assert.equal(usedSophie, true)
  const resolved = state.investigators[0]
  assert.equal(resolved.damage, 5)
  assert.equal(state.testResult.value, 6)
  assert.equal(state.testResult.success, true)
  assert.equal(getStat(state, resolved, 'combat'), 4)
  assert.equal(resolved.hand.length, 1)
  assert.equal(viewState(state, 0).investigators[0].assets.find(item => item.id === sophie.id).code, '03009b')
  resolved.damage = 4
  assert.equal(viewState(state, 0).investigators[0].assets.find(item => item.id === sophie.id).code, '03009')
})

test('C1 Home Front optionally moves one Mark damage to the attacked enemy', () => {
  const state = markFixture()
  const investigator = state.investigators[0]
  investigator.damage = 2
  investigator.hand = ['03007']
  state.chaosBag = ['0']
  const target = enemy(state, { id: 'home-front-target', fight: 1, health: 5 })
  move(state, { action: 'fight', enemyId: target.id })
  let committed = false
  settle(state, pending => {
    if (pending.kind === 'commit' && !committed && pending.options.some(option => option.id === '0')) {
      committed = true
      return '0'
    }
    if (pending.source === '03007') return 'move'
    return null
  })
  assert.equal(committed, true)
  assert.equal(state.investigators[0].damage, 1)
  assert.equal(state.enemies.find(item => item.id === target.id).damageTaken, 2)
})

test('C1 Shell Shock deals horror equal to half Mark damage rounded down', () => {
  const state = markFixture()
  const investigator = state.investigators[0]
  investigator.damage = 5
  investigator.deck = ['03008']
  move(state, { action: 'draw' })
  settle(state)
  assert.equal(state.investigators[0].horror, 2)
  assert.equal(state.investigators[0].discard.includes('03008'), true)
})

test('C1 Akachi gives charge assets one additional starting charge and her elder sign adds a charge', () => {
  const state = investigatorFixture('03004', {
    name: '阿卡契·奥涅勒', willpower: 5, intellect: 2, combat: 3, agility: 3, health: 6, sanity: 8,
  })
  const investigator = state.investigators[0]
  investigator.hand = ['01060']
  move(state, { action: 'play', cardId: '01060' })
  settle(state)
  const spell = state.investigators[0].assets.find(card => card.code === '01060')
  assert.equal(spell.uses, registeredEntry('01060').uses + 1)

  state.chaosBag = ['eldersign']
  const execute = current => performTest(current, 0, 'willpower', 6, {
    resolve: result => { current.testResult = result },
  })
  resolveTest(state, execute, pending => pending.source === 'akachiElderSign' ? spell.id : null)
  assert.equal(state.testResult.value, 6)
  assert.equal(state.investigators[0].assets.find(card => card.id === spell.id).uses, registeredEntry('01060').uses + 2)
})

test('C1 Spirit-Speaker choice survives JSON save/replay without duplicating resources or movement', () => {
  const state = investigatorFixture('03004', {
    name: '阿卡契·奥涅勒', willpower: 5, intellect: 2, combat: 3, agility: 3, health: 6, sanity: 8,
  })
  const investigator = state.investigators[0]
  const speaker = asset(state, '03014')
  const spell = asset(state, '01060', { uses: 3, usesType: 'charges' })
  const beforeResources = investigator.resources
  move(state, { action: 'ability', assetId: speaker.id, abilityIndex: 0 })
  const restored = JSON.parse(JSON.stringify(state))
  const choose = pending => pending.kind === 'target' ? spell.id : pending.source === '03014' ? 'resources' : null
  settle(state, choose)
  settle(restored, choose)
  assert.deepEqual(restored, state)
  assert.equal(state.investigators[0].resources, beforeResources + 3)
  assert.equal(state.investigators[0].discard.includes('01060'), true)
  assert.equal(state.investigators[0].assets.some(card => card.id === spell.id), false)
})

test('C1 Angered Spirits moves charges from an exhausted Spell and persists across JSON restore', () => {
  const state = investigatorFixture('03004', {
    name: '阿卡契·奥涅勒', willpower: 5, intellect: 2, combat: 3, agility: 3, health: 6, sanity: 8,
  })
  const spell = asset(state, '01060', { uses: 2, usesType: 'charges' })
  const angered = { id: 'angered', code: '03015', uses: 0, usesType: 'charges', exhausted: false }
  state.investigators[0].threat.push(angered)
  move(state, { action: 'ability', assetId: angered.id, abilityIndex: 0 })
  const restored = JSON.parse(JSON.stringify(state))
  settle(state, pending => pending.kind === 'target' ? spell.id : null)
  settle(restored, pending => pending.kind === 'target' ? spell.id : null)
  assert.deepEqual(restored, state)
  const currentSpell = state.investigators[0].assets.find(card => card.id === spell.id)
  assert.equal(currentSpell.exhausted, true)
  assert.equal(currentSpell.uses, 1)
  assert.equal(state.investigators[0].threat.find(card => card.id === angered.id).uses, 1)
})

test('C1 Angered Spirits applies physical trauma exactly when fewer than four charges remain at scenario end', () => {
  for (const [uses, expected] of [[3, 1], [4, 0]]) {
    const state = investigatorFixture('03004', {
      name: '阿卡契·奥涅勒', willpower: 5, intellect: 2, combat: 3, agility: 3, health: 6, sanity: 8,
    })
    state.investigators[0].threat.push({ id: `angered-${uses}`, code: '03015', uses, usesType: 'charges' })
    state.locations.find(location => location.id === state.investigators[0].location).resign = true
    const before = state.campaign.investigators[0].trauma.physical
    move(state, { action: 'resign' })
    if (state.pendingChoice?.source === '01117') answer(state, 'skip')
    assert.equal(state.campaign.investigators[0].trauma.physical, before + expected)
  }
})

test('C1 Yorick plays an asset from discard after defeating an enemy and the choice survives save/replay', () => {
  const state = investigatorFixture('03005', {
    name: '威廉·约里克', willpower: 4, intellect: 2, combat: 4, agility: 3, health: 8, sanity: 6,
  })
  const investigator = state.investigators[0]
  investigator.combat = 8
  investigator.discard = ['01016']
  state.chaosBag = ['0']
  const target = enemy(state, { id: 'yorick-target', fight: 1, health: 1 })
  move(state, { action: 'fight', enemyId: target.id })
  const restored = JSON.parse(JSON.stringify(state))
  const choose = pending => pending.source === 'yorickAsset'
    ? (pending.kind === 'reaction' ? 'trigger' : '0') : null
  settle(state, choose)
  settle(restored, choose)
  assert.deepEqual(restored, state)
  assert.equal(state.investigators[0].assets.some(card => card.code === '01016'), true)
  assert.equal(state.investigators[0].discard.includes('01016'), false)
})

test('C1 Yorick elder sign returns any discard card only on success', () => {
  const state = investigatorFixture('03005', {
    name: '威廉·约里克', willpower: 4, intellect: 2, combat: 4, agility: 3, health: 8, sanity: 6,
  })
  state.investigators[0].discard = ['01088']
  state.chaosBag = ['eldersign']
  const execute = current => performTest(current, 0, 'combat', 6, {
    resolve: result => { current.testResult = result },
  })
  resolveTest(state, execute, pending => pending.source === 'yorickElderSign' ? '0' : null)
  assert.equal(state.testResult.success, true)
  assert.equal(state.testResult.value, 6)
  assert.equal(state.investigators[0].hand.includes('01088'), true)
})

test('C1 Bury Them Deep places the defeated non-Elite enemy and event in the victory display', () => {
  const state = investigatorFixture('03005', {
    name: '威廉·约里克', willpower: 4, intellect: 2, combat: 8, agility: 3, health: 8, sanity: 6,
  })
  state.investigators[0].hand = ['03016']
  state.chaosBag = ['0']
  const target = enemy(state, { id: 'bury-target', code: 'ghoulMinion', fight: 1, health: 1 })
  move(state, { action: 'fight', enemyId: target.id })
  settle(state, pending => pending.options.find(option => option.cardCode === '03016')?.id ?? null)
  assert.equal(state.victoryDisplay.some(card => card.id === target.id), true)
  assert.equal(state.victoryDisplay.some(card => card.code === '03016' && card.victory === 1), true)
  assert.equal(state.encounterDiscard.includes('ghoulMinion'), false)
  assert.equal(state.investigators[0].discard.includes('03016'), false)
})

test('C1 Graveyard Ghouls locks every discard exit while engaged', () => {
  const state = investigatorFixture('03005', {
    name: '威廉·约里克', willpower: 4, intellect: 2, combat: 4, agility: 3, health: 8, sanity: 6,
  })
  const investigator = state.investigators[0]
  investigator.discard = ['01088']
  const ghouls = enemy(state, { id: 'graveyard-ghouls', code: '03017', name: '墓地食尸鬼',
    fight: 3, health: 3, evade: 2, hunter: true, prey: 'bearer', bearerSeat: 0 })
  investigator.deck = []
  state.chaosBag = ['eldersign']
  const execute = current => performTest(current, 0, 'combat', 1, {
    resolve: result => { current.testResult = result },
  })
  resolveTest(state, execute)
  assert.equal(state.investigators[0].discard.includes('01088'), true)
  assert.equal(state.investigators[0].hand.includes('01088'), false)
  move(state, { action: 'draw' })
  settle(state)
  assert.equal(state.investigators[0].discard.includes('01088'), true)
  assert.equal(state.investigators[0].hand.includes('01088'), false)
  assert.equal(state.enemies.some(card => card.id === ghouls.id), true)
})

test('C1 Lola role gates play, commit and triggered abilities on the server', () => {
  const state = investigatorFixture('03006', {
    name: '罗拉·海斯', willpower: 3, intellect: 3, combat: 3, agility: 3, health: 6, sanity: 6, role: 'guardian',
  })
  const investigator = state.investigators[0]
  investigator.hand = ['01016', '01039']
  assert.equal(legalMoves(state).some(move => move.action === 'play' && move.cardId === '01016'), true)
  assert.match(validateMove(state, 0, { action: 'play', cardId: '01039' }), /罗拉/)
  const spell = asset(state, '01060', { uses: 4, usesType: 'charges' })
  const target = enemy(state)
  assert.match(validateMove(state, 0, { action: 'ability', assetId: spell.id, abilityIndex: 0, targetId: target.id }), /罗拉/)

  investigator.hand = ['01039']
  const execute = current => performTest(current, 0, 'intellect', 1, {
    resolve: result => { current.testResult = result },
  })
  resolveTransaction(state, 0, { action: 'lolaCommitProbe' }, execute)
  assert.equal(state.pendingChoice.kind, 'commit')
  assert.equal(state.pendingChoice.options.some(option => option.label.includes('推理')), false)
  resolveTransaction(state, 0, {
    action: 'choose', choiceId: state.pendingChoice.id, optionId: 'done',
  }, execute)
})

test('C1 Lola free role switch and elder-sign switch survive deterministic choices', () => {
  const state = investigatorFixture('03006', {
    name: '罗拉·海斯', willpower: 3, intellect: 3, combat: 3, agility: 3, health: 6, sanity: 6, role: 'guardian',
  })
  move(state, { action: 'freeAction' })
  const restored = JSON.parse(JSON.stringify(state))
  settle(state, pending => pending.kind === 'role' ? 'mystic' : null)
  settle(restored, pending => pending.kind === 'role' ? 'mystic' : null)
  assert.deepEqual(restored, state)
  assert.equal(state.investigators[0].role, 'mystic')
  assert.ok(validateMove(state, 0, { action: 'freeAction' }))

  state.chaosBag = ['eldersign']
  const execute = current => performTest(current, 0, 'willpower', 5, {
    resolve: result => { current.testResult = result },
  })
  resolveTest(state, execute, pending => pending.source === 'lolaSwitchRole' ? 'rogue' : null)
  assert.equal(state.testResult.success, true)
  assert.equal(state.investigators[0].role, 'rogue')
})

test('C1 Improvisation switches role, draws and discounts only the next matching card with save/replay', () => {
  const state = investigatorFixture('03006', {
    name: '罗拉·海斯', willpower: 3, intellect: 3, combat: 3, agility: 3, health: 6, sanity: 6, role: 'guardian',
  })
  const investigator = state.investigators[0]
  investigator.hand = ['03018']
  investigator.deck = ['01088']
  move(state, { action: 'play', cardId: '03018' })
  const restored = JSON.parse(JSON.stringify(state))
  settle(state, pending => pending.kind === 'role' ? 'mystic' : null)
  settle(restored, pending => pending.kind === 'role' ? 'mystic' : null)
  assert.deepEqual(restored, state)
  assert.equal(state.investigators[0].role, 'mystic')
  assert.equal(state.investigators[0].hand.includes('01088'), true)

  const current = state.investigators[0]
  current.hand.push('01060')
  const before = current.resources
  move(state, { action: 'play', cardId: '01060' })
  settle(state)
  assert.equal(state.investigators[0].resources, before)
  assert.equal(state.investigators[0].lolaDiscount, undefined)
})

test('C1 Crisis of Identity discards current-role assets and switches to the top card class', () => {
  const state = investigatorFixture('03006', {
    name: '罗拉·海斯', willpower: 3, intellect: 3, combat: 3, agility: 3, health: 6, sanity: 6, role: 'guardian',
  })
  const guardian = asset(state, '01016')
  const neutral = asset(state, '01059')
  state.investigators[0].deck = ['01044', '03019']
  move(state, { action: 'draw' })
  settle(state)
  const resolved = state.investigators[0]
  assert.equal(resolved.assets.some(card => card.id === guardian.id), false)
  assert.equal(resolved.assets.some(card => card.id === neutral.id), true)
  assert.equal(resolved.discard.includes('01016'), true)
  assert.equal(resolved.discard.includes('01044'), true)
  assert.equal(resolved.role, 'rogue')
})

test('C1 Minh adds one wild icon once per committing investigator each round', () => {
  const state = fixture('01001', 2)
  Object.assign(state.investigators[0], {
    code: '03002', name: '明·蒂·潘', willpower: 4, intellect: 4, combat: 2, agility: 2, health: 7, sanity: 7,
  })
  const committer = state.investigators[1]
  committer.hand = ['01093']
  committer.combat = 1
  state.chaosBag = ['0']
  const execute = current => performTest(current, 1, 'combat', 3, {
    resolve: result => { current.testResult = result },
  })
  resolveTransaction(state, 1, { action: 'minhWildProbe' }, execute)
  let committed = false
  settleExecution(state, execute, pending => {
    if (pending.kind === 'commit' && !committed && pending.options.some(option => option.id === '0')) {
      committed = true
      return '0'
    }
    if (pending.source === 'minhWild') return 'trigger'
    return null
  })
  assert.equal(state.testResult.value, 4)
  assert.equal(state.testResult.success, true)
  assert.equal(state.investigators[0].usedReactions[`minhWild:1:${state.round}`], true)
})

test('C1 Analytical Mind commits remotely, exhausts to draw, and replays identically from JSON', () => {
  const state = fixture('01001', 2)
  Object.assign(state.investigators[0], {
    code: '03002', name: '明·蒂·潘', willpower: 4, intellect: 4, combat: 2, agility: 2, health: 7, sanity: 7,
  })
  state.locations.push({ id: 'remote', name: '远处', revealed: true, shroud: 1, clues: 0, connections: [] })
  state.investigators[1].location = 'remote'
  const mind = asset(state, '03010')
  state.investigators[0].hand = ['01093']
  state.investigators[0].deck = ['01088']
  state.investigators[1].combat = 1
  state.chaosBag = ['0']
  const execute = current => performTest(current, 1, 'combat', 2, {
    resolve: result => { current.testResult = result },
  })
  resolveTransaction(state, 1, { action: 'analyticalMindProbe' }, execute)
  const restored = JSON.parse(JSON.stringify(state))
  const makeChooser = () => {
    let remoteCommitted = false
    return pending => {
      if (pending.kind === 'commit' && pending.seat === 0 && !remoteCommitted
        && pending.options.some(option => option.id === '0')) {
        remoteCommitted = true
        return '0'
      }
      if (pending.source === '03010') return 'trigger'
      if (pending.source === 'minhWild') return 'skip'
      return null
    }
  }
  settleExecution(state, execute, makeChooser())
  settleExecution(restored, execute, makeChooser())
  assert.deepEqual(restored, state)
  assert.equal(state.investigators[0].assets.find(card => card.id === mind.id).exhausted, true)
  assert.equal(state.investigators[0].hand.includes('01088'), true)
})

test('C1 King in Yellow requires zero or at least three commitments and leaves after six matching icons', () => {
  const state = investigatorFixture('03002', {
    name: '明·蒂·潘', willpower: 4, intellect: 4, combat: 2, agility: 2, health: 7, sanity: 7,
  })
  state.investigators[0].threat.push({ id: 'king', code: '03011' })
  state.investigators[0].hand = ['01022', '01037', '01079']
  state.chaosBag = ['0']
  const execute = current => performTest(current, 0, 'intellect', 5, {
    resolve: result => { current.testResult = result },
  })
  resolveTransaction(state, 0, { action: 'kingProbe' }, execute)
  let commits = 0
  settleExecution(state, execute, pending => {
    if (pending.kind === 'commit' && commits < 3 && pending.options.some(option => option.id === '0')) {
      commits++
      return '0'
    }
    if (pending.source === 'minhWild') return 'trigger'
    return null
  })
  assert.equal(commits, 3)
  assert.equal(state.testResult.success, true)
  assert.equal(state.investigators[0].threat.some(card => card.code === '03011'), false)
  assert.equal(state.investigators[0].discard.includes('03011'), true)
})

test('C1 Minh elder sign returns a committed skill card to its owner', () => {
  const state = investigatorFixture('03002', {
    name: '明·蒂·潘', willpower: 4, intellect: 4, combat: 2, agility: 2, health: 7, sanity: 7,
  })
  state.investigators[0].hand = ['01093']
  state.chaosBag = ['eldersign']
  const execute = current => performTest(current, 0, 'willpower', 5, {
    resolve: result => { current.testResult = result },
  })
  resolveTransaction(state, 0, { action: 'minhElderProbe' }, execute)
  let committed = false
  settleExecution(state, execute, pending => {
    if (pending.kind === 'commit' && !committed && pending.options.some(option => option.id === '0')) {
      committed = true
      return '0'
    }
    if (pending.source === 'minhWild') return 'skip'
    if (pending.source === 'minhElderSign') return '0'
    return null
  })
  assert.equal(state.testResult.success, true)
  assert.equal(state.investigators[0].hand.includes('01093'), true)
  assert.equal(state.investigators[0].discard.includes('01093'), false)
})

test('C1 Sefina draws an event beneath her as a no-AOO action with save/replay and private observation', () => {
  const state = investigatorFixture('03003', {
    name: '赛菲娜·卢梭', willpower: 4, intellect: 2, combat: 2, agility: 4, health: 5, sanity: 9,
  })
  state.investigators[0].beneath = ['01088']
  const beforeActions = state.investigators[0].actionsLeft
  move(state, { action: 'freeAction' })
  const restored = JSON.parse(JSON.stringify(state))
  settle(state, pending => pending.source === 'sefinaBeneath' ? '0' : null)
  settle(restored, pending => pending.source === 'sefinaBeneath' ? '0' : null)
  assert.deepEqual(restored, state)
  assert.equal(state.investigators[0].actionsLeft, beforeActions - 1)
  assert.equal(state.investigators[0].hand.includes('01088'), true)

  state.investigators[0].beneath = ['01037']
  assert.deepEqual(viewState(state, 0).investigators[0].beneath, ['01037'])
  assert.deepEqual(viewState(state, null).investigators[0].beneath, [])
  assert.equal(viewState(state, null).investigators[0].beneathCount, 1)
})

test('C1 Sefina elder sign is +3 and may draw one event beneath her', () => {
  const state = investigatorFixture('03003', {
    name: '赛菲娜·卢梭', willpower: 4, intellect: 2, combat: 2, agility: 4, health: 5, sanity: 9,
  })
  state.investigators[0].beneath = ['01088']
  state.chaosBag = ['eldersign']
  const execute = current => performTest(current, 0, 'agility', 7, {
    resolve: result => { current.testResult = result },
  })
  resolveTest(state, execute, pending => pending.source === 'sefinaElderSign' ? '0' : null)
  assert.equal(state.testResult.success, true)
  assert.equal(state.testResult.value, 7)
  assert.equal(state.investigators[0].hand.includes('01088'), true)
})

test('C1 Painted World copies action and fast events, removes itself, and rejects Exceptional events', () => {
  const actionState = investigatorFixture('03003', {
    name: '赛菲娜·卢梭', willpower: 4, intellect: 2, combat: 2, agility: 4, health: 5, sanity: 9,
  })
  actionState.investigators[0].hand = ['03012']
  actionState.investigators[0].beneath = ['01088', '02266']
  const actionMove = legalMoves(actionState).find(command => command.cardId === '03012' && command.copyCode === '01088')
  assert.ok(actionMove)
  assert.equal(legalMoves(actionState).some(command => command.copyCode === '02266'), false)
  assert.match(validateMove(actionState, 0, { action: 'play', cardId: '03012', copyCode: '02266' }), /合法/)
  const beforeResources = actionState.investigators[0].resources
  move(actionState, actionMove)
  settle(actionState)
  assert.equal(actionState.investigators[0].resources, beforeResources + 3)
  assert.equal(actionState.removedFromGame.includes('03012'), true)
  assert.equal(actionState.investigators[0].discard.includes('03012'), false)

  const fastState = investigatorFixture('03003', {
    name: '赛菲娜·卢梭', willpower: 4, intellect: 2, combat: 2, agility: 4, health: 5, sanity: 9,
  })
  fastState.investigators[0].hand = ['03012']
  fastState.investigators[0].beneath = ['01037']
  fastState.locations[0].clues = 1
  const beforeActions = fastState.investigators[0].actionsLeft
  const fastMove = legalMoves(fastState).find(command => command.copyCode === '01037')
  move(fastState, fastMove)
  settle(fastState)
  assert.equal(fastState.investigators[0].actionsLeft, beforeActions)
  assert.equal(fastState.investigators[0].clues, 1)
})

test('C1 Painted World can copy a reaction event during its exact window', () => {
  const state = investigatorFixture('03003', {
    name: '赛菲娜·卢梭', willpower: 4, intellect: 1, combat: 2, agility: 4, health: 5, sanity: 9,
  })
  state.investigators[0].hand = ['03012']
  state.investigators[0].beneath = ['01080']
  state.chaosBag = ['0']
  const execute = current => performTest(current, 0, 'intellect', 3, {
    resolve: result => { current.testResult = result },
  })
  resolveTransaction(state, 0, { action: 'paintedReactionProbe' }, execute)
  settleExecution(state, execute, pending =>
    pending.options.find(option => option.cardCode === '03012')?.id ?? null)
  assert.equal(state.testResult.success, true)
  assert.equal(state.removedFromGame.includes('03012'), true)
})

test('C1 Stars of Hyades removes a random beneath event, reshuffles at five cards, and harms when empty', () => {
  const state = investigatorFixture('03003', {
    name: '赛菲娜·卢梭', willpower: 4, intellect: 2, combat: 2, agility: 4, health: 5, sanity: 9,
  })
  state.investigators[0].beneath = ['01088']
  state.investigators[0].deck = ['01089', '01090', '01091', '01092', '01093', '03013']
  const restored = JSON.parse(JSON.stringify(state))
  move(state, { action: 'draw' })
  settle(state)
  move(restored, { action: 'draw' })
  settle(restored)
  assert.deepEqual(restored, state)
  assert.equal(state.removedFromGame.includes('01088'), true)
  assert.equal(state.investigators[0].deck.includes('03013'), true)
  assert.equal(state.investigators[0].discard.includes('03013'), false)

  const empty = investigatorFixture('03003', {
    name: '赛菲娜·卢梭', willpower: 4, intellect: 2, combat: 2, agility: 4, health: 5, sanity: 9,
  })
  empty.investigators[0].beneath = []
  empty.investigators[0].deck = ['03013']
  move(empty, { action: 'draw' })
  settle(empty)
  assert.equal(empty.investigators[0].damage, 1)
  assert.equal(empty.investigators[0].horror, 1)
  assert.equal(empty.investigators[0].discard.includes('03013'), true)
})
