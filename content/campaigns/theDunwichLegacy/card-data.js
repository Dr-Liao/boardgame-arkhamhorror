import { ALL_CARDS } from '../../../src/cards/cards-data.js'
import { enemyRuleFor, implementedFor, threatEffectFor } from '../../../src/cards/card-rules.js'
import { scenario as gathering } from '../nightOfTheZealot/scenarios/theGathering/definition.js'
import { scenario as masks } from '../nightOfTheZealot/scenarios/theMidnightMasks/definition.js'
import { scenario as devourer } from '../nightOfTheZealot/scenarios/theDevourerBelow/definition.js'

const coreDefinitions = new Map([gathering, masks, devourer].flatMap(scenario =>
  ['enemies', 'treacheries'].flatMap(category => Object.values(scenario[category] || {})))
  .map(card => [card.originalCode, card]))
const packs = new Set(['core', 'dwl', 'tmm', 'tece', 'bota', 'uau', 'wda', 'litas'])

function hasPrintedSurge(text = '') {
  const keywords = text.split(/\b(?:Revelation|Forced|Spawn)\s*-/i, 1)[0]
  return /\bSurge\./i.test(keywords)
}

export function printed(code) {
  const card = ALL_CARDS[code]
  if (!card) throw new Error(`敦威治原卡不存在：${code}`)
  return { code, originalCode: code, name: card.nameZh || card.name,
    text: card.textZh || card.text || '', traits: [...card.traits],
    flavor: card.flavorZh || card.flavor || '' }
}

export function location(id, code, connections, extra = {}) {
  const card = ALL_CARDS[code]
  return { ...printed(code), id, shroud: card.shroud, cluesPerInvestigator: card.clues || 0,
    ...(card.cluesFixed ? { cluesFixed: card.clues } : {}),
    victory: card.victory || 0, connections, ...extra }
}

export function stages(codes, type) {
  return codes.map((code, i) => ({ ...printed(code), id: `${type}${i + 1}`, stage: `${i + 1}a`,
    ...(type === 'agenda' ? { doomThreshold: ALL_CARDS[code].doom } : {}),
    advanceText: ALL_CARDS[code].backTextZh || ALL_CARDS[code].backText || '',
  }))
}

export function encounterCards(groups) {
  for (const group of groups) {
    if (!Object.values(ALL_CARDS).some(card => packs.has(card.pack) && card.encounterCode === group)) {
      throw new Error(`缺少敦威治遭遇组：${group}`)
    }
  }
  return Object.values(ALL_CARDS).filter(card => packs.has(card.pack)
    && groups.includes(card.encounterCode) && ['enemy', 'treachery'].includes(card.type))
}

export function encounterDefinitions(cards) {
  const enemies = {}, treacheries = {}
  for (const card of cards) {
    // Reuse existing Core rules and their engine aliases, without overwriting
    // those definitions or claiming that newly cataloged effects are implemented.
    const definition = coreDefinitions.get(card.code)
    const result = definition ? structuredClone(definition) : { ...printed(card.code),
      rulesPending: true,
      ...(card.type === 'enemy' ? { fight: card.fight, evade: card.evade,
        health: card.health, damage: card.damage, horror: card.horror,
        ...(card.healthPerInvestigator ? { healthPerInvestigator: card.health } : {}),
        hunter: /\bHunter\./.test(card.text), aloof: /\bAloof[. ]/.test(card.text),
        massive: /\bMassive\./.test(card.text), retaliate: /\bRetaliate\./.test(card.text),
        victory: card.victory || 0, elite: card.traits.includes('Elite') } : {}),
    }
    if (implementedFor(card.code) && card.pack !== 'core') {
      result.rulesPending = false
      result.surge = hasPrintedSurge(card.text)
      result.peril = /\bPeril\./.test(card.text)
      result.effect = { kind: 'campaignRule' }
      const threat = threatEffectFor(card.code)
      if (threat) result.threatEffect = threat
    }
    if (card.type === 'enemy' && !definition) {
      result.rulesPending = false
      Object.assign(result, enemyRuleFor(card.code) || {})
    }
    ;(card.type === 'enemy' ? enemies : treacheries)[result.code] = result
  }
  return { enemies, treacheries }
}

export function encounterDeck(cards) {
  return cards.flatMap(card => Array(card.quantity || 1).fill(coreDefinitions.get(card.code)?.code || card.code))
}

export function identitiesFor(scenario) {
  const categories = { scenario: { [scenario.id]: { originalCode: scenario.originalCode } } }
  for (const category of ['locations', 'acts', 'agendas', 'enemies', 'treacheries', 'storyAssets']) {
    categories[category] = Object.fromEntries(Object.values(scenario[category] || {}).map(card =>
      [card.id || card.code, { originalCode: card.originalCode }]))
  }
  return categories
}
