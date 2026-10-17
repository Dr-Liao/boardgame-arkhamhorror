import { ALL_CARDS } from '../../../src/cards/cards-data.js'

const CARCOSA_PACKS = new Set(['ptc', 'eotp', 'tuo', 'apot', 'tpm', 'bsr', 'dca'])
const DOOM_PER_INVESTIGATOR = new Set(['03121', '03122', '03123'])
const HIDDEN_RULES = {
  '03084a': { cannotCommitTypes: ['skill'], discard: { actions: 2 } },
  '03084b': { maxMovesPerTurn: 1, discard: { actions: 2 } },
  '03084c': { cannotTriggerFree: true, discard: { actions: 2 } },
  '03084d': { cannotPlayTypes: ['event'], discard: { actions: 2 } },
  '03186': { cannotFightTraits: ['Lunatic'] },
  '03187': { cannotTriggerLocationAbilities: true },
  '03340': { allowCommit: true, autoFailOnCommit: true, killAtHorrorOverSanityMultiplier: 2 },
  '03341': { killAtHorrorOverSanityMultiplier: 2, discard: { actions: 1, resources: 5 } },
  '03342': { killAtHorrorOverSanityMultiplier: 2, discard: { actions: 1, damageInvestigator: 2 } },
}

const THREAT_EFFECTS = {
  '03225': { playCostIncrease: 1, consumeResourceAfterPlay: true },
  '03226': { extraActionCost: ['move', 'fight', 'evade'], endTurnTest: { skill: 'willpower', difficulty: 3 } },
}

const ENEMY_RULES = {
  '03086': { prey: 'lowestSanity' },
  '03089': { prey: 'mostHorror' },
  '03099': { prey: 'mostClues' },
}

export function printed(code) {
  const card = ALL_CARDS[code]
  if (!card) throw new Error(`卡尔克萨原卡不存在：${code}`)
  return {
    code,
    originalCode: code,
    name: card.nameZh || card.name,
    text: card.textZh || card.text || '',
    traits: [...(card.traits || [])],
    flavor: card.flavorZh || card.flavor || '',
  }
}

export function location(id, code, connections, extra = {}) {
  const card = ALL_CARDS[code]
  if (!card) throw new Error(`卡尔克萨地点不存在：${code}`)
  return {
    ...printed(code),
    id,
    shroud: card.shroud,
    cluesPerInvestigator: card.clues || 0,
    ...(card.cluesFixed ? { cluesFixed: card.clues } : {}),
    victory: card.victory || 0,
    connections: [...connections],
    ...extra,
  }
}

export function stages(codes, type) {
  return codes.map((code, index) => {
    const card = ALL_CARDS[code]
    if (!card) throw new Error(`卡尔克萨${type === 'act' ? '幕' : '议程'}不存在：${code}`)
    return {
      ...printed(code),
      id: `${type}${index + 1}`,
      stage: `${index + 1}a`,
      ...(type === 'agenda' ? { doomThreshold: card.doom } : {}),
      ...(type === 'agenda' && DOOM_PER_INVESTIGATOR.has(code)
        ? { doomThresholdPerInvestigator: card.doom } : {}),
      advanceText: card.backTextZh || card.backText || '',
    }
  })
}

export function encounterCards(groups) {
  const aliases = { the_stranger: 'stranger' }
  const normalized = groups.map(group => aliases[group] || group)
  const missing = normalized.filter(group => !Object.values(ALL_CARDS).some(card =>
    card.encounterCode === group && ['enemy', 'treachery'].includes(card.type)))
  if (missing.length) throw new Error(`缺少卡尔克萨遭遇组：${missing.join(', ')}`)
  return Object.values(ALL_CARDS).filter(card =>
    normalized.includes(card.encounterCode) && ['enemy', 'treachery'].includes(card.type))
}

function hasPrintedSurge(text = '') {
  const keywords = text.split(/\b(?:Revelation|Forced|Spawn)\s*-/i, 1)[0]
  return /\bSurge\./i.test(keywords)
}

export function encounterDefinitions(cards) {
  const enemies = {}
  const treacheries = {}
  for (const card of cards) {
    const definition = {
      ...printed(card.code),
      rulesPending: false,
      ...(card.type === 'enemy' ? {
        fight: card.fight ?? 0,
        evade: card.evade ?? 0,
        health: card.health ?? 1,
        damage: card.damage ?? 0,
        horror: card.horror ?? 0,
        ...(card.healthPerInvestigator ? { healthPerInvestigator: card.health } : {}),
        hunter: /\bHunter\./i.test(card.text || ''),
        aloof: /\bAloof[. ]/i.test(card.text || ''),
        massive: /\bMassive\./i.test(card.text || ''),
        retaliate: /\bRetaliate\./i.test(card.text || ''),
        alert: /\bAlert\./i.test(card.text || ''),
        ...(ENEMY_RULES[card.code] || {}),
        victory: card.victory || 0,
        elite: (card.traits || []).includes('Elite'),
      } : {
        surge: hasPrintedSurge(card.text),
        peril: /\bPeril\./i.test(card.text || ''),
        hidden: /\bHidden\./i.test(card.text || ''),
        ...(HIDDEN_RULES[card.code] ? { hiddenRule: structuredClone(HIDDEN_RULES[card.code]) } : {}),
        ...(THREAT_EFFECTS[card.code] ? { threatEffect: structuredClone(THREAT_EFFECTS[card.code]) } : {}),
        effect: { kind: 'campaignRule' },
      }),
    }
    ;(card.type === 'enemy' ? enemies : treacheries)[definition.code] = definition
  }
  return { enemies, treacheries }
}

export function encounterDeck(cards) {
  return cards.flatMap(card => Array(card.quantity || 1).fill(card.code))
}

export function storyCards(codes) {
  return Object.fromEntries(codes.map(code => [code, printed(code)]))
}

export function identitiesFor(scenario) {
  const categories = { scenario: { [scenario.id]: { originalCode: scenario.originalCode } } }
  for (const category of ['locations', 'acts', 'agendas', 'enemies', 'treacheries', 'storyAssets']) {
    categories[category] = Object.fromEntries(Object.values(scenario[category] || {}).map(card =>
      [card.id || card.code, { originalCode: card.originalCode }]))
  }
  return categories
}

export function carcosaCards() {
  return Object.values(ALL_CARDS).filter(card => CARCOSA_PACKS.has(card.pack))
}
