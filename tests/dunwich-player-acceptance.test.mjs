import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture, move, settle, answer, asset, enemy, play, use, legalMoves, validateMove } from './core-fixture.mjs'
import { ALL_CARDS, INVESTIGATORS } from '../src/cards/cards-data.js'
import { EFFECTS, INVESTIGATOR_ABILITIES } from '../src/cards/card-effects.js'
import { getStat, performTest } from '../src/engine/engine.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import { getAvailability, canSelectInvestigator } from '../src/deck/availability.js'
import { effects as cycleEffects } from '../content/packs/dunwichPlayer/effects.js'
import { effects as supportEffects } from '../content/packs/dunwichSupport/manifest.js'

const constructible = Object.keys({ ...cycleEffects, ...supportEffects }).sort()
const investigators = ['02001', '02002', '02003', '02004', '02005']
const signatures = ['02006', '02007', '02008', '02009', '02010', '02011', '02012', '02013', '02014', '02015']
const weaknesses = ['02037', '02038', '02039']
const expectedCodes = [...constructible, ...investigators, ...signatures, ...weaknesses]

assert.equal(constructible.length, 94)
assert.equal(expectedCodes.length, 112)
assert.equal(new Set(expectedCodes).size, 112)

const contracts = {
  '02016': ['abilities.0.effect', { type: 'fight', combatBonus: 1, noFriendlyFire: true }],
  '02017': ['event', { type: 'engageEnemies' }],
  '02018': ['event', { type: 'teamwork' }],
  '02019': ['event', { type: 'engageEnemies', drawPerEnemy: 1 }],
  '02020': ['passive.handSizeBonus', 2, 'reactions.0.effect', { type: 'draw', amount: 2 }],
  '02021': ['abilities.0.effect.type', 'researchSolution'],
  '02022': ['event', { type: 'targetedEffect', target: 'location', effect: { type: 'moveTo' } }],
  '02023': ['event.type', 'investigateConnectingClue'],
  '02024': ['uses', 4, 'abilities.0.effect.type', 'liquidCourage'],
  '02025': ['reaction.when', 'enemySpawn', 'event.type', 'moveTo'],
  '02026': ['skill', { doubleDifficultyAndRewards: true, maxPerTest: 1 }],
  '02027': ['passive.stats.combat', 1, 'forcedUpkeepPayOrDiscard', 1],
  '02028': ['uses', 3, 'abilities.0.effect', { type: 'investigate', skill: 'willpower', clueBonus: 1, symbolEndsTurn: true }],
  '02029': ['reactions.0.when', 'symbolRevealed', 'reactions.0.effect', { type: 'addCurrentTest', amount: 1 }],
  '02030': ['uses', 3, 'abilities.0.effect.effect', { type: 'heal', amount: 1, what: 'horror' }],
  '02031': ['event.type', 'bindMonster'],
  '02032': ['abilities.0.effect', { type: 'fight', fireAxe: true }],
  '02033': ['passive.stats.agility', 1, 'healSelfHorrorAfterTurn', 1],
  '02034': ['event', { type: 'evade', moveEnemyOnSuccess: true }],
  '02035': ['passive.stats', { agility: 1, willpower: 1 }, 'healSelfHorrorAfterTurn', 1],
  '02036': ['abilities.0.effect', { type: 'fight', combatBonus: 1, maySpendActionForDamage: 1 }],
  '02105': ['event', { type: 'healDamageAtLocation', amount: 2 }],
  '02106': ['passive', { stats: { willpower: 1 }, assignHarmAtLocation: true }, 'defeatedDamage', 2],
  '02107': ['event', { type: 'fight', skill: 'intellect', damagePerClue: true, maxDamageBonus: 3 }],
  '02108': ['abilities.0.effect', { type: 'moveTo', requiresNoEnemies: true }],
  '02109': ['event', { type: 'doubleUses', usesTypes: ['ammo', 'supplies'], target: 'location' }],
  '02110': ['campaign.adaptable', 2, 'passive.permanent', true],
  '02111': ['event.type', 'drawEncounterAll', 'addToVictory', true],
  '02112': ['uses', 5, 'abilities.0.effect', { type: 'fight', skill: 'willpower', combatBonus: 1, skullDamageBonus: 2 }],
  '02113': ['reaction', { when: 'attackFail', failedByAtMost: 2 }, 'event.type', 'redirectFailedAttack'],
  '02114': ['abilities.1.cost.exileSelf', true, 'abilities.1.effect', { type: 'evade', bonus: 3, evadeOthersOnSuccess: true }],
  '02115': ['event.type', 'flare', 'exileAfterPlay', true],
  '02116': ['uses', 3, 'abilities.0.effect.effects', [{ type: 'takeDamage', amount: 1 }, { type: 'heal', amount: 1, what: 'horror' }]],
  '02117': ['uses', 3, 'abilities.0.effect.effects', [{ type: 'takeHorror', amount: 1 }, { type: 'heal', amount: 1, what: 'damage' }]],
  '02147': ['passive.extraSlots.handWeapon', 1],
  '02148': ['event.type', 'standTogether'],
  '02149': ['reactions.0', { when: 'assetEnteredPlay', assetCode: '02149', effect: { type: 'discoverClue', amount: 1 } }],
  '02150': ['skill', { onSuccess: { clueBonus: 1 }, successBy: { threshold: 2, clueBonus: 1 } }],
  '02151': ['event.type', 'resign', 'requiresResign', true],
  '02152': ['fast', true, 'abilities.0.effect', { type: 'fight', combatBonus: 2, damageBonus: 1, successBy: 2 }],
  '02153': ['reaction.when', 'enemyAttack', 'event.type', 'hypnoticGaze'],
  '02154': ['uses', 4, 'abilities.0.effect', { type: 'fight', skill: 'willpower', combatBonus: 2, damageBonus: 1, onChaosSymbolHorror: 1 }],
  '02155': ['passive.investigateBonusIfNoClues', 2],
  '02156': ['event.type', 'attachLure'],
  '02157': ['passive.extraSlots.accessory', 1],
  '02158': ['passive.extraSlots.ally', 1],
  '02184': ['event', { type: 'searchTop', amount: 9, trait: 'Weapon', choose: 1 }],
  '02185': ['abilities.0.effect', { type: 'addStatPhase', skill: 'intellect', amount: 1 }, 'abilities.1.effect', { type: 'addStatPhase', skill: 'combat', amount: 1 }],
  '02186': ['requiresClueAtLocation', true, 'event', { type: 'draw', amount: 3 }],
  '02187': ['minimumHandForBoost', 5, 'freeTriggers.0', { skill: 'willpower', cost: { resources: 1 }, bonus: 2 }],
  '02188': ['reactions.0', { when: 'turnBegins', requiresAlone: true, effect: { type: 'gainResource', amount: 1 } }],
  '02189': ['freeTriggers', [{ skill: 'intellect', cost: { resources: 2 }, bonus: 3 }, { skill: 'agility', cost: { resources: 2 }, bonus: 3 }]],
  '02190': ['skill.defiance', true],
  '02191': ['freeTriggers.0', { skill: 'willpower', cost: { doom: 1 }, bonus: 3 }],
  '02192': ['skill', { selfTestOnly: true, requireDifficultyAboveBase: 2 }],
  '02193': ['freeTriggers', [{ skill: 'combat', cost: { resources: 1 }, bonus: 1 }, { skill: 'agility', cost: { resources: 1 }, bonus: 1 }]],
  '02194': ['event.effects', [{ type: 'gainResource', amount: 3 }, { type: 'draw', amount: 1 }]],
  '02225': ['reaction.when', 'defeatEnemy', 'event.type', 'healHorrorAtLocationByEnemy'],
  '02226': ['uses', 3, 'abilities.0.effect', { type: 'fight', combatBonus: 3, damageBonus: 2, requireNotEngagedTarget: true }],
  '02227': ['skill.requireClueAtLocation', true],
  '02228': ['event.type', 'exposeWeakness'],
  '02229': ['skill.successBy', { threshold: 2, gainAction: 1 }],
  '02230': ['reactions.0', { when: 'chaosTokenRevealed', cost: { resources: 2 }, effect: { type: 'redrawChaos' } }],
  '02231': ['skill', { selfTestOnly: true, returnOnSuccessBy: 2 }],
  '02232': ['passive.stats.intellect', 1, 'abilities.0.effect.type', 'lookTopDeckAndDoom'],
  '02233': ['uses', 3, 'abilities.0.effect', { type: 'investigate', skill: 'willpower', bonus: 2, clueBonus: 2, symbolEndsTurn: true }],
  '02234': ['passive', { darkHorse: true, allStatsIfNoResources: 1 }],
  '02235': ['skill.onSuccess', { evadeDisengage: true, mayMoveAfterEvade: true }],
  '02260': ['skill.leadership', true],
  '02261': ['event', { type: 'cancelHarmGainResources', maximum: 5 }],
  '02262': ['uses', 4, 'abilities.0.effect.effect', { type: 'heal', amount: 2, what: 'damage' }],
  '02263': ['uses', 3, 'abilities.0.effect', { type: 'fight', baseValue: 6, damageBonus: 2 }],
  '02264': ['uses', 4, 'abilities.0.effect', { type: 'evade', baseValue: 6 }],
  '02265': ['abilities.0', { cost: { action: false, resources: 1 }, effect: { type: 'playItemFromHand' } }],
  '02266': ['event', { type: 'gainAction', amount: 3 }],
  '02267': ['event.type', 'removeDoomControlled'],
  '02268': ['skill', { onSuccess: { healHorror: 1 }, successBy: { threshold: 2, healHorror: 1 } }],
  '02269': ['reactions.0', { when: 'symbolRevealed', cost: { exhaust: true }, effect: { type: 'chooseOne' } }],
  '02270': ['event.type', 'temporaryAllyFromDiscard'],
  '02271': ['skill.selfTestOnly', true],
  '02272': ['passive.parleyDifficultyModifier', -2],
  '02273': ['requiresNoEnemies', true, 'event.effects', [{ type: 'heal', amount: 3, what: 'horror' }, { type: 'draw', amount: 1 }]],
  '02299': ['skill', { onSuccess: { damageBonus: 1 }, successBy: { threshold: 2, damageBonus: 1 } }],
  '02300': ['event', { type: 'fight', defeatNonEliteOnSuccess: true }],
  '02301': ['uses', 3, 'abilities.0.effect', { type: 'fight', combatBonus: 5, damageBonus: 2 }],
  '02302': ['reactions.0', { when: 'encounterDrawn', cost: { exhaust: true, clues: 1, returnClue: true }, effect: { type: 'redrawEncounter' } }],
  '02303': ['event.type', 'decipheredReality'],
  '02304': ['uses', 4, 'abilities.0.effect', { type: 'fight', damageBonus: 2, additionalActionCombatBonus: 2 }],
  '02305': ['phaseControl', true],
  '02306': ['uses', 4, 'abilities.0.effect', { type: 'fight', skill: 'willpower', combatBonus: 3, damageBonus: 2, onChaosSymbolHorror: 2 }],
  '02307': ['reaction', { when: 'encounterDrawn', nonWeaknessOnly: true }, 'event', { type: 'cancelTreachery', horror: 1 }],
  '02308': ['reactions.0', { when: 'enemyAttack', cost: { exhaust: true, horror: 1 }, effect: { type: 'aquinnahRedirect' } }],
  '02309': ['reactions.0', { when: 'skillTestFail', cost: { exhaust: true }, effect: { type: 'returnCommittedSkill' } }],
  '02310': ['fast', true, 'reactions.0.effect.type', 'redGlovedManSkills', 'forcedMythosEndDiscard', true],
}

function atPath(value, path) {
  return path.split('.').reduce((node, key) => node?.[Number.isInteger(Number(key)) ? Number(key) : key], value)
}

function assertSubset(actual, expected, label = '') {
  if (Array.isArray(expected)) {
    assert.ok(Array.isArray(actual), `${label} is not an array`)
    assert.ok(actual.length >= expected.length, `${label} array is too short`)
    expected.forEach((item, index) => assertSubset(actual[index], item, `${label}[${index}]`))
  } else if (expected && typeof expected === 'object') {
    assert.ok(actual && typeof actual === 'object', `${label} is not an object`)
    for (const [key, value] of Object.entries(expected)) assertSubset(actual[key], value, `${label}.${key}`)
  } else {
    assert.deepEqual(actual, expected, label)
  }
}

function assertContract(code) {
  const checks = contracts[code]
  assert.ok(checks, `${code} has no printed-effect contract`)
  for (let index = 0; index < checks.length; index += 2) {
    const path = checks[index]
    assertSubset(atPath(EFFECTS[code], path), checks[index + 1], `${code}.${path}`)
  }
}

function prep(s) {
  const inv = s.investigators[0]
  inv.damage = 3
  inv.horror = 3
  inv.clues = 3
  inv.intellect = inv.willpower = inv.combat = inv.agility = 8
  s.locations[0].clues = 6
  s.locations[0].shroud = 1
  s.locations[0].connections = ['next']
  s.locations.push({ id: 'next', name: '相邻地点', revealed: true, shroud: 1, clues: 3, maxClues: 3, connections: [s.locations[0].id] })
  enemy(s, { id: 'probe-enemy', health: 30, fight: 1, evade: 1, damage: 1, horror: 1, traits: ['Monster'] })
  return inv
}

function engineSurfaceProbe(code) {
  const card = ALL_CARDS[code]
  const effect = EFFECTS[code]
  assert.equal(getAvailability(code).deckbuilding, true)
  assert.ok(card && effect)
  if (card.type === 'asset') {
    const s = fixture('01001', 2)
    const inv = prep(s)
    const a = asset(s, code)
    if (code === '02226') {
      s.enemies[0].engagedSeat = null
      inv.engaged = []
    }
    if (effect.uses != null) assert.equal(a.uses, effect.uses)
    if (effect.passive?.stats) {
      for (const [skill, amount] of Object.entries(effect.passive.stats)) {
        inv.assets.pop()
        const without = getStat(s, inv, skill)
        inv.assets.push(a)
        assert.equal(getStat(s, inv, skill), without + amount)
      }
    }
    if (effect.abilities?.length) {
      const offered = legalMoves(s).filter(command => command.assetId === a.id)
      assert.ok(offered.length > 0, `${code} ability was not offered by the engine`)
      if (effect.abilities[0].cost?.uses) {
        a.uses = 0
        assert.ok(!legalMoves(s).some(command => command.assetId === a.id && command.abilityIndex === 0), `${code} ignored its use cost`)
      }
    }
  } else if (card.type === 'skill') {
    const investigator = { guardian: '01001', seeker: '01002', rogue: '01003', mystic: '01004', survivor: '01005' }[card.klass] || '01001'
    const s = fixture(investigator, 2)
    const inv = prep(s)
    inv.hand = [code]
    const skill = Object.entries(card.icons || {}).find(([name, amount]) => name !== 'wild' && amount > 0)?.[0] || 'intellect'
    const execute = state => performTest(state, 0, skill, 10, { resolve: result => { state.probeResult = result } })
    resolveTransaction(s, 0, { action: 'dunwichPlayerProbe' }, execute)
    const commit = s.pendingChoice
    assert.equal(commit?.kind, 'commit')
    assert.ok(commit.options.some(option => option.id === '0' && option.label.includes(card.nameZh || card.name)),
      `${code} was not offered for a legal matching test`)
  } else if (card.type === 'event') {
    const s = fixture('01001', 2)
    const inv = prep(s)
    if (code === '02273') s.enemies = []
    inv.hand = [code]
    const reactionOnly = effect.reaction || effect.reactions
    const error = validateMove(s, 0, { action: 'play', cardId: code })
    if (reactionOnly) assert.ok(error, `${code} reaction event was playable outside its timing window`)
    else if (!['02151'].includes(code)) assert.equal(error, null, `${code} should be playable in the prepared legal state`)
  }
}

function playAndSettle(code, configure = () => {}, choose = () => null, count = 1) {
  const s = fixture('01001', count)
  configure(s)
  play(s, code)
  settle(s, choose)
  return s
}

const runtime = {
  '02016': () => {
    const s = fixture('01001', 2), inv = s.investigators[0]
    const a = asset(s, '02016')
    const target = enemy(s, { engagedSeat: 1, fight: 20 })
    s.investigators[1].engaged = [target.id]
    s.chaosBag = ['autofail']
    use(s, a, { targetId: target.id }); settle(s)
    assert.equal(s.investigators[1].damage, 0)
  },
  '02017': () => {
    const s = fixture(), inv = s.investigators[0]
    const first = enemy(s, { engagedSeat: null }), second = enemy(s, { engagedSeat: null })
    play(s, '02017'); settle(s)
    assert.deepEqual(new Set(s.investigators[0].engaged), new Set([first.id, second.id]))
  },
  '02018': () => {
    const s = fixture('01001', 2), first = s.investigators[0], second = s.investigators[1]
    first.resources = 5
    play(s, '02018'); settle(s, p => p.source === '02018' && p.options.some(o => o.id === 'resource') ? 'resource' : null)
    assert.equal(s.investigators[0].resources, 4)
    assert.equal(s.investigators[1].resources, 31)
  },
  '02019': () => {
    const s = fixture(), inv = s.investigators[0]
    enemy(s, { engagedSeat: null }); enemy(s, { engagedSeat: null })
    play(s, '02019'); settle(s)
    assert.equal(s.investigators[0].engaged.length, 2)
    assert.equal(s.investigators[0].hand.length, 2)
  },
  '02020': () => {
    const s = playAndSettle('02020', () => {}, p => p.source === 'laboratoryAssistant' ? 'trigger' : null)
    assert.equal(s.investigators[0].hand.length, 2)
    assert.equal(s.investigators[0].assets[0].code, '02020')
  },
  '02021': () => {
    const s = fixture(), inv = s.investigators[0]
    inv.assets = [{ id: 'solution', code: '02021', exhausted: false }]
    inv.deck = ['01088', '01089']; inv.intellect = 8
    move(s, { action: 'ability', assetId: 'solution', abilityIndex: 0 })
    const saved = structuredClone(s)
    settle(s); settle(saved)
    assert.deepEqual(s, saved)
    assert.equal(s.campaign.records.identifiedStrangeSolution, true)
    assert.equal(s.investigators[0].hand.length, 2)
  },
  '02022': () => {
    const s = fixture('01001', 2)
    s.locations[0].connections = ['next']; s.locations.push({ id: 'next', name: '相邻', revealed: true, clues: 0, connections: [s.locations[0].id] })
    play(s, '02022'); settle(s, p => p.kind === 'investigator' ? '1' : null)
    assert.equal(s.investigators[1].location, 'next')
    assert.equal(s.investigators[1].actionsLeft, 20)
  },
  '02023': () => {
    const s = fixture(), inv = s.investigators[0]
    inv.intellect = 8; s.locations[0].shroud = 1; s.locations[0].connections = ['next']
    s.locations.push({ id: 'next', name: '相邻', revealed: true, shroud: 1, clues: 1, maxClues: 1, connections: [s.locations[0].id] })
    play(s, '02023'); settle(s)
    assert.equal(s.investigators[0].clues, 1)
    assert.equal(s.locations[1].clues, 0)
  },
  '02024': () => {
    const s = fixture(), inv = s.investigators[0]
    inv.horror = 2; inv.willpower = 8
    const a = asset(s, '02024')
    use(s, a); settle(s)
    // Heal 1 + successful willpower test heals 1 more.
    assert.equal(s.investigators[0].horror, 0)
    assert.equal(s.investigators[0].assets.find(item => item.id === a.id).uses, 3)
    const f = fixture(), failInv = f.investigators[0]
    failInv.horror = 2; failInv.willpower = 1; failInv.hand = ['01088', '01089']
    f.chaosBag = ['autofail']
    const failAsset = asset(f, '02024')
    use(f, failAsset); settle(f)
    // Failure: no extra heal, discard 1 card at random from hand.
    assert.equal(f.investigators[0].horror, 1)
    assert.equal(f.investigators[0].hand.length, 1)
    assert.equal(f.investigators[0].discard.length, 1)
  },
  '02026': () => {
    const s = fixture('01003'), inv = s.investigators[0]
    inv.hand = ['02026']; inv.intellect = 8; s.locations[0].shroud = 1; s.locations[0].clues = 3
    move(s, { action: 'investigate' })
    settle(s, p => p.kind === 'commit' && p.options.some(o => o.id === '0' && o.label.includes('赌一把')) ? '0' : null)
    assert.equal(s.investigators[0].clues, 2)
  },
  '02027': () => {
    const s = fixture(), inv = s.investigators[0]
    const a = asset(s, '02027')
    assert.equal(getStat(s, inv, 'combat'), 5)
    inv.resources = 0
    move(s, { action: 'endTurn' }); settle(s)
    assert.ok(!s.investigators[0].assets.some(item => item.id === a.id))
  },
  '02030': () => {
    const s = fixture(), inv = s.investigators[0]
    inv.horror = 2
    const a = asset(s, '02030')
    use(s, a); settle(s)
    assert.equal(s.investigators[0].horror, 1)
    assert.equal(s.investigators[0].assets.find(item => item.id === a.id).uses, 2)
  },
  '02031': () => {
    const s = fixture(), inv = s.investigators[0]
    inv.willpower = 8
    const target = enemy(s, { traits: ['Monster'], exhausted: true })
    play(s, '02031'); settle(s)
    assert.deepEqual(s.enemies.find(item => item.id === target.id).bindMonster, { ownerSeat: 0, code: '02031' })
    assert.ok(!s.investigators[0].discard.includes('02031'))
  },
  '02033': () => {
    const s = fixture(), a = asset(s, '02033', { horror: 2 })
    move(s, { action: 'endTurn' }); settle(s)
    assert.equal(s.investigators[0].assets.find(item => item.id === a.id).horror, 1)
  },
  '02034': () => {
    const s = fixture(), inv = s.investigators[0]
    s.locations[0].connections = ['next']; s.locations.push({ id: 'next', name: '相邻', revealed: true, clues: 0, connections: [s.locations[0].id] })
    inv.agility = 8
    const target = enemy(s)
    play(s, '02034'); settle(s, p => p.source === '02034' ? 'next' : null)
    assert.equal(s.enemies.find(item => item.id === target.id).location, 'next')
    assert.equal(s.enemies.find(item => item.id === target.id).exhausted, true)
  },
  '02035': () => {
    const s = fixture(), inv = s.investigators[0], a = asset(s, '02035', { horror: 2 })
    assert.equal(getStat(s, inv, 'agility'), 3)
    assert.equal(getStat(s, inv, 'willpower'), 4)
    move(s, { action: 'endTurn' }); settle(s)
    assert.equal(s.investigators[0].assets.find(item => item.id === a.id).horror, 1)
  },
  '02105': () => {
    const s = fixture(), inv = s.investigators[0]
    inv.damage = 3
    play(s, '02105'); settle(s)
    assert.equal(s.investigators[0].damage, 1)
  },
  '02109': () => {
    const s = fixture(), gun = asset(s, '01016', { uses: 2 })
    play(s, '02109'); settle(s, p => p.source === '02109' ? gun.id : null)
    assert.equal(s.investigators[0].assets.find(item => item.id === gun.id).uses, 4)
  },
  '02116': () => {
    const s = fixture(), inv = s.investigators[0], a = asset(s, '02116')
    inv.horror = 2
    use(s, a); settle(s)
    const updated = s.investigators[0], pipe = updated.assets.find(item => item.id === a.id)
    assert.equal(updated.damage, 1); assert.equal(updated.horror, 1); assert.equal(pipe.uses, 2); assert.equal(pipe.exhausted, true)
  },
  '02117': () => {
    const s = fixture(), inv = s.investigators[0], a = asset(s, '02117')
    inv.damage = 2
    use(s, a); settle(s)
    const updated = s.investigators[0], pills = updated.assets.find(item => item.id === a.id)
    assert.equal(updated.horror, 1); assert.equal(updated.damage, 1); assert.equal(pills.uses, 2); assert.equal(pills.exhausted, true)
  },
  '02148': () => {
    const s = playAndSettle('02148', () => {}, () => null, 2)
    assert.deepEqual(s.investigators.map(inv => inv.resources), [32, 32])
    assert.deepEqual(s.investigators.map(inv => inv.hand.length), [2, 2])
  },
  '02149': () => {
    const s = fixture(), before = s.locations[0].clues
    play(s, '02149'); settle(s, p => p.source === 'artStudent' ? 'trigger' : null)
    assert.equal(s.investigators[0].clues, 1)
    assert.equal(s.locations[0].clues, before - 1)
  },
  '02152': () => {
    const s = fixture(), inv = s.investigators[0]
    inv.combat = 5
    const a = asset(s, '02152'), target = enemy(s, { fight: 1 })
    use(s, a, { targetId: target.id }); settle(s)
    assert.equal(s.enemies.find(item => item.id === target.id).damageTaken, 2)
  },
  '02154': () => {
    const s = fixture(), inv = s.investigators[0]
    inv.willpower = 8
    const a = asset(s, '02154'), target = enemy(s)
    use(s, a, { targetId: target.id }); settle(s)
    assert.equal(s.enemies.find(item => item.id === target.id).damageTaken, 2)
    assert.equal(s.investigators[0].assets.find(item => item.id === a.id).uses, 3)
  },
  '02155': () => {
    const s = fixture(), inv = s.investigators[0]
    asset(s, '02155'); s.locations[0].shroud = 4; s.locations[0].clues = 2
    move(s, { action: 'investigate' }); settle(s)
    assert.equal(s.investigators[0].clues, 1)
    move(s, { action: 'investigate' }); settle(s)
    assert.equal(s.investigators[0].clues, 1)
  },
  '02184': () => {
    const s = fixture(), inv = s.investigators[0]
    inv.deck = ['01016', ...Array(8).fill('01088'), '01086']
    play(s, '02184')
    assert.ok(!JSON.stringify(s.pendingChoice).includes('01016'))
    settle(s, p => p.options.find(o => o.cardCode === '01086')?.id)
    assert.ok(s.investigators[0].hand.includes('01086'))
  },
  '02186': () => {
    const s = fixture(), inv = s.investigators[0]
    inv.hand = ['02186']; s.locations[0].clues = 0
    assert.match(validateMove(s, 0, { action: 'play', cardId: '02186' }), /线索/)
    s.locations[0].clues = 1
    move(s, { action: 'play', cardId: '02186' }); settle(s)
    assert.equal(s.investigators[0].hand.length, 3)
  },
  '02194': () => {
    const s = playAndSettle('02194')
    assert.equal(s.investigators[0].resources, 33)
    assert.equal(s.investigators[0].hand.length, 1)
  },
  '02230': () => {
    const s = fixture(), inv = s.investigators[0]
    inv.assets = [{ id: 'dice', code: '02230', exhausted: false }]; s.chaosBag = ['-1']
    const execute = state => performTest(state, 0, 'intellect', 2, { resolve: result => { state.result = result } })
    resolveTransaction(s, 0, { action: 'diceProbe' }, execute)
    let used = false
    while (s.pendingChoice) {
      const p = s.pendingChoice
      const optionId = p.source === 'dice' && !used ? (used = true, 'trigger') : p.options.find(o => ['done', 'skip'].includes(o.id))?.id || p.options[0].id
      resolveTransaction(s, p.seat, { action: 'choose', choiceId: p.id, optionId }, execute)
    }
    assert.equal(s.investigators[0].resources, 28)
    assert.deepEqual(s.result.cancelledTokens, ['-1'])
  },
  '02234': () => {
    const s = fixture(), inv = s.investigators[0]
    inv.resources = 0
    const before = getStat(s, inv, 'intellect')
    asset(s, '02234')
    assert.equal(getStat(s, inv, 'intellect'), before + 1)
    inv.resources = 1
    assert.equal(getStat(s, inv, 'intellect'), before)
  },
  '02261': () => {
    const s = fixture(), inv = s.investigators[0]
    inv.hand = ['02261']; inv.resources = 5
    const target = enemy(s, { damage: 3 })
    move(s, { action: 'endTurn' }); settle(s, p => p.options.find(o => o.cardCode === '02261')?.id || (p.source === '02261' ? '3:0' : null))
    assert.ok(target)
    assert.equal(s.investigators[0].damage, 0)
    assert.equal(s.investigators[0].resources, 9)
  },
  '02262': () => {
    const s = fixture(), inv = s.investigators[0], a = asset(s, '02262')
    inv.damage = 3
    use(s, a); settle(s)
    assert.equal(s.investigators[0].damage, 1)
    assert.equal(s.investigators[0].assets.find(item => item.id === a.id).uses, 3)
  },
  '02263': () => {
    const s = fixture('01002'), a = asset(s, '02263')
    const target = enemy(s, { code: '02094', name: '鸟之奴仆', fight: 5, health: 4 })
    use(s, a, { targetId: target.id })
    assert.equal(s.pendingChoice?.kind, 'commit')
    assert.equal(s.skillTest.printedValue, 6)
    assert.equal(s.skillTest.value, 6)
    assert.equal(s.skillTest.difficulty, 5)
    settle(s)
    assert.equal(s.enemies.find(item => item.id === target.id).damageTaken, 3)
    assert.equal(s.investigators[0].assets.find(item => item.id === a.id).uses, 2)
  },
  '02264': () => {
    const s = fixture(), a = asset(s, '02264'), target = enemy(s, { evade: 5 })
    use(s, a, { targetId: target.id }); settle(s)
    assert.equal(s.enemies.find(item => item.id === target.id).exhausted, true)
    assert.equal(s.investigators[0].assets.find(item => item.id === a.id).uses, 3)
  },
  '02266': () => {
    const s = fixture(), inv = s.investigators[0]
    play(s, '02266'); settle(s)
    assert.equal(s.investigators[0].actionsLeft, 23)
  },
  '02267': () => {
    const s = fixture(), target = asset(s, '02191', { doom: 3 })
    play(s, '02267'); settle(s)
    assert.equal(s.investigators[0].assets.find(item => item.id === target.id).doom, 0)
  },
  '02273': () => {
    const s = fixture(), inv = s.investigators[0]
    inv.hand = ['02273']; inv.horror = 4
    enemy(s, { engagedSeat: null })
    assert.match(validateMove(s, 0, { action: 'play', cardId: '02273' }), /敌人/)
    s.enemies = []
    move(s, { action: 'play', cardId: '02273' }); settle(s)
    assert.equal(s.investigators[0].horror, 1); assert.equal(s.investigators[0].hand.length, 1)
  },
  '02301': () => {
    const s = fixture(), a = asset(s, '02301'), target = enemy(s)
    use(s, a, { targetId: target.id }); settle(s)
    assert.equal(s.enemies.find(item => item.id === target.id).damageTaken, 3)
    assert.equal(s.investigators[0].assets.find(item => item.id === a.id).uses, 2)
  },
  '02303': () => {
    const s = fixture(), inv = s.investigators[0]
    inv.intellect = 8; s.locations[0].shroud = 1; s.locations[0].clues = 2
    s.locations.push({ id: 'other', name: '另一地点', revealed: true, shroud: 3, clues: 2, maxClues: 2, connections: [] })
    play(s, '02303'); settle(s)
    assert.equal(s.investigators[0].clues, 2)
    assert.deepEqual(s.locations.map(loc => loc.clues), [1, 1])
  },
  '02304': () => {
    const s = fixture(), inv = s.investigators[0], a = asset(s, '02304'), target = enemy(s, { fight: 8 })
    use(s, a, { targetId: target.id }); settle(s, p => p.source === a.id && p.kind === 'action' ? '2' : null)
    assert.equal(s.investigators[0].actionsLeft, 17)
    assert.equal(s.enemies.find(item => item.id === target.id).damageTaken, 3)
    assert.equal(s.investigators[0].assets.find(item => item.id === a.id).uses, 3)
  },
  '02305': () => {
    const s = fixture(), inv = s.investigators[0]
    s.enemies = []; s.acts[0].objective = null
    inv.assets = [{ id: 'gold-watch', code: '02305', exhausted: false }]
    const round = s.round
    move(s, { action: 'endTurn' }); settle(s, p => p.source === 'gold-watch' ? 'trigger' : null)
    assert.equal(s.phase, 'investigation'); assert.equal(s.round, round)
    assert.ok(s.removedFromGame.includes('02305'))
  },
  '02306': () => {
    const s = fixture(), inv = s.investigators[0], a = asset(s, '02306'), target = enemy(s)
    inv.willpower = 8
    use(s, a, { targetId: target.id }); settle(s)
    assert.equal(s.enemies.find(item => item.id === target.id).damageTaken, 3)
    assert.equal(s.investigators[0].assets.find(item => item.id === a.id).uses, 3)
  },
  '02310': () => {
    const s = playAndSettle('02310', () => {}, p => p.source === 'redGlovedMan' ? 'trigger' : null)
    const updated = s.investigators[0]
    const chosen = ['willpower', 'intellect', 'combat', 'agility']
    assert.equal(chosen.filter(skill => getStat(s, updated, skill) === 6).length, 2)
    // The player chooses the two skills (first offered options here).
    assert.equal(getStat(s, updated, 'willpower'), 6)
    assert.equal(getStat(s, updated, 'intellect'), 6)
    move(s, { action: 'endTurn' })
    settle(s)
    assert.ok(!s.investigators[0].assets.some(item => item.code === '02310'))
  },
}

function runInvestigator(code) {
  assert.equal(canSelectInvestigator(code), true)
  assert.ok(INVESTIGATOR_ABILITIES[code])
  const s = fixture(), inv = s.investigators[0]
  inv.code = code
  if (code === '02001') {
    const before = inv.resources
    const target = enemy(s, { engagedSeat: null })
    move(s, { action: 'engage', enemyId: target.id }); settle(s, p => p.source === 'zoeyResource' ? 'trigger' : null)
    assert.equal(s.investigators[0].resources, before + 1)
  } else if (code === '02002') {
    inv.intellect = 5; s.locations[0].shroud = 1; s.locations[0].clues = 3
    move(s, { action: 'investigate' }); settle(s, p => p.source === 'rexClue' ? 'trigger' : null)
    assert.equal(s.investigators[0].clues, 2)
  } else if (code === '02003') {
    assert.equal(INVESTIGATOR_ABILITIES[code].upkeepResources, 2)
    assert.equal(INVESTIGATOR_ABILITIES[code].elderSign.kind, 'resources')
  } else if (code === '02004') {
    inv.combat = 4; s.chaosBag = ['skull']
    const execute = state => performTest(state, 0, 'combat', 1, { resolve: result => { state.result = result } })
    resolveTransaction(s, 0, { action: 'jimProbe' }, execute)
    while (s.pendingChoice) resolveTransaction(s, s.pendingChoice.seat,
      { action: 'choose', choiceId: s.pendingChoice.id, optionId: s.pendingChoice.options.find(o => ['done', 'skip'].includes(o.id))?.id || s.pendingChoice.options[0].id }, execute)
    assert.equal(s.result.value, 4)
  } else {
    inv.hand = ['01088']; inv.assets = [{ id: 'duke', code: '02014', exhausted: true }]
    move(s, { action: 'freeAction' }); const saved = structuredClone(s)
    settle(s); settle(saved)
    assert.deepEqual(s, saved)
    assert.equal(s.investigators[0].assets[0].exhausted, false)
    assert.ok(validateMove(s, 0, { action: 'freeAction' }))
  }
}

function runSignature(code) {
  assert.equal(getAvailability(code).deckbuilding, false)
  const owner = { '02006': '02001', '02007': '02001', '02008': '02002', '02009': '02002', '02010': '02003',
    '02011': '02003', '02012': '02004', '02013': '02004', '02014': '02005', '02015': '02005' }[code]
  assert.ok(INVESTIGATORS[owner].deckRequirements.signatureCards.includes(code))
  const s = fixture(owner), inv = s.investigators[0]
  if (code === '02006') {
    inv.assets = [{ id: 'cross', code, exhausted: false }]
    const target = enemy(s, { engagedSeat: null, health: 3 })
    move(s, { action: 'engage', enemyId: target.id }); settle(s, p => ['cross', 'zoeysCross'].includes(p.source) ? 'trigger' : null)
    assert.equal(s.enemies.find(item => item.id === target.id).damageTaken, 1)
    assert.equal(s.investigators[0].resources, 30)
    assert.equal(s.investigators[0].assets[0].exhausted, true)
  } else if (code === '02007') {
    inv.deck = ['01088', code]; s.encounterDeck = ['ghoulMinion']
    move(s, { action: 'draw' }); settle(s)
    assert.ok(s.enemies.some(item => item.smiteTheWickedSeat === 0))
  } else if (code === '02008') {
    inv.hand = [code]; inv.clues = 6
    move(s, { action: 'play', cardId: code }); settle(s)
    assert.equal(s.investigators[0].hand.length, 5)
  } else if (code === '02009') {
    inv.threat = [{ id: 'curse', code }]; inv.intellect = 3; s.chaosBag = ['0']
    const execute = state => performTest(state, 0, 'intellect', 1, { resolve: result => { state.result = result } })
    resolveTransaction(s, 0, { action: 'curseProbe' }, execute)
    while (s.pendingChoice) resolveTransaction(s, s.pendingChoice.seat,
      { action: 'choose', choiceId: s.pendingChoice.id, optionId: s.pendingChoice.options.find(o => ['done', 'skip'].includes(o.id))?.id || s.pendingChoice.options[0].id }, execute)
    assert.equal(s.result.success, true)
    assert.ok(s.investigators[0].threat.some(item => item.code === code))
    assert.ok(s.log.some(line => String(line?.text ?? line).includes('雷克斯的诅咒')))
  } else if (code === '02010') {
    inv.hand = [code]; inv.resources = 6
    move(s, { action: 'play', cardId: code }); settle(s, p => p.source === code ? '4' : null)
    const gun = s.investigators[0].assets.find(item => item.code === code)
    assert.equal(gun.uses, 4); assert.equal(s.investigators[0].resources, 2)
  } else if (code === '02011') {
    inv.deck = ['01088', code]
    move(s, { action: 'draw' }); settle(s)
    assert.ok(s.locations.some(loc => loc.searchingForIzzieSeat === 0))
  } else if (code === '02012') {
    inv.assets = [{ id: 'trumpet', code, exhausted: false }]; inv.horror = 2; s.chaosBag = ['skull']
    const execute = state => performTest(state, 0, 'willpower', 1, { resolve: result => { state.result = result } })
    resolveTransaction(s, 0, { action: 'trumpetProbe' }, execute)
    while (s.pendingChoice) resolveTransaction(s, s.pendingChoice.seat,
      { action: 'choose', choiceId: s.pendingChoice.id, optionId: s.pendingChoice.source === 'jimsTrumpet' ? 'trigger' : s.pendingChoice.options.find(o => ['done', 'skip'].includes(o.id))?.id || s.pendingChoice.options[0].id }, execute)
    assert.equal(s.investigators[0].horror, 1); assert.equal(s.investigators[0].assets[0].exhausted, true)
  } else if (code === '02013') {
    inv.deck = ['01088', code]; s.chaosBag = ['skull', 'skull', 'autofail', '0', '0']
    move(s, { action: 'draw' }); settle(s)
    assert.equal(s.investigators[0].damage, 3); assert.equal(s.investigators[0].horror, 3)
  } else if (code === '02014') {
    inv.assets = [{ id: 'duke', code, exhausted: false }]
    inv.combat = 0
    const target = enemy(s, { fight: 3 })
    move(s, { action: 'ability', assetId: 'duke', abilityIndex: 0, targetId: target.id }); settle(s)
    assert.equal(s.enemies.find(item => item.id === target.id).damageTaken, 2)
    assert.equal(s.investigators[0].assets[0].exhausted, true)
  } else {
    inv.assets = [{ id: 'duke', code: '02014', exhausted: false }]; inv.deck = ['01088', code]
    move(s, { action: 'draw' }); settle(s)
    assert.equal(s.investigators[0].assets[0].exhausted, true)
    move(s, { action: 'endTurn' }); settle(s)
    assert.equal(s.investigators[0].assets[0].exhausted, true)
  }
}

function runWeakness(code) {
  assert.equal(getAvailability(code).deckbuilding, false)
  assert.ok(EFFECTS[code])
  if (code === '02037') {
    assert.equal(ALL_CARDS[code].permanent, true)
    assert.equal(ALL_CARDS[code].subtype, 'basicweakness')
    assert.equal(EFFECTS[code].startingResources, -2)
  } else {
    const s = fixture(), inv = s.investigators[0]
    inv.threat = [{ id: 'weakness', code }]
    const before = code === '02038' ? inv.damage : inv.horror
    inv.actionsLeft = 1
    assert.ok(validateMove(s, 0, { action: 'discardWeakness', threatId: 'weakness' }))
    inv.actionsLeft = 20
    move(s, { action: 'endTurn' }); settle(s)
    assert.equal(s.investigators[0][code === '02038' ? 'damage' : 'horror'], before + 1)
  }
}

for (const code of expectedCodes) {
  const card = ALL_CARDS[code] || INVESTIGATORS[code]
  const name = card.nameZh || card.name
  test(`Dunwich ${code} ${name} 严格验收主要印刷效果`, () => {
    if (constructible.includes(code)) {
      assertContract(code)
      engineSurfaceProbe(code)
      runtime[code]?.()
    } else if (investigators.includes(code)) {
      runInvestigator(code)
    } else if (signatures.includes(code)) {
      runSignature(code)
    } else {
      runWeakness(code)
    }
  })
}
