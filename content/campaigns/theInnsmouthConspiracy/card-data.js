import { ALL_CARDS } from '../../../src/cards/cards-data.js'

// Printed facts only. Card behavior belongs to encounter-entries.
export function printed(code) {
  const c = ALL_CARDS[code]
  if (!c) throw new RangeError(`Unknown Innsmouth card: ${code}`)
  return { code, originalCode: code, name: c.nameZh || c.name, nameEn: c.name,
    subname: c.subnameZh || c.subname || '', text: c.textZh || c.text || '', textEn: c.text || '',
    traits: [...(c.traits || [])], ...(c.backText ? { backText: c.backTextZh || c.backText } : {}) }
}

export function location(data) {
  const { id, code, cluesFixed, hasVictory, victory, ...rest } = data
  const c = ALL_CARDS[code]
  return { ...printed(code), id, connections: [], ...rest,
    ...(cluesFixed ? { cluesFixed: data.clues } : { cluesPerInvestigator: data.clues }),
    ...(hasVictory ? { victory: victory ?? 0 } : {}),
    unrevealedName: c.backNameZh || c.backName || c.nameZh || c.name,
    unrevealedNameEn: c.backName || c.name }
}

export function stage(code, extra = {}) {
  const c = ALL_CARDS[code]
  const { doom, stage: number, ...rest } = extra
  return { ...printed(code), id: `${c.type}${code}`, type: c.type, stage: `${number ?? c.stage}a`,
    reveal: { type: 'campaignRule' }, ...rest,
    ...(c.type === 'agenda' ? { doomThreshold: doom ?? c.doom } : {}) }
}

export function encounterDefinitions(codes) {
  const enemies = {}, treacheries = {}, storyAssets = {}
  for (const code of new Set(codes)) {
    const c = ALL_CARDS[code]
    if (!c) throw new RangeError(`Unknown encounter definition: ${code}`)
    const base = printed(code)
    if (c.type === 'enemy') {
      const keywords = String(c.text || '').split('\n').filter(line => !/\b(?:gains?|loses?|while|if|forced|reaction)\b/i.test(line)).join('\n')
      const prey = /Prey - ([^.]+)/.exec(c.text || '')?.[1]
      const preyRules = { 'Fewest cards in hand': 'fewestCardsInHand', 'Lowest [agility]': 'lowestAgility', 'Lowest [willpower]': 'lowestWillpower' }
      enemies[code] = { ...base, surge: /^Surge\./m.test(c.text || ''), fight: c.fight ?? null, evade: c.evade ?? null, health: c.health ?? null,
        ...(preyRules[prey] ? { prey: preyRules[prey] } : {}),
        ...(c.healthPerInvestigator ? { healthPerInvestigator: c.health } : {}), damage: c.damage || 0, horror: c.horror || 0,
        ...(Object.hasOwn(c, 'victory') ? { victory: c.victory } : {}),
        ...Object.fromEntries(['Hunter', 'Aloof', 'Massive', 'Retaliate', 'Alert'].filter(k => new RegExp(`\\b${k}\\.`).test(keywords)).map(k => [k.toLowerCase(), true])),
        elite: c.traits?.includes('Elite') || false }
    } else if (c.type === 'treachery') treacheries[code] = { ...base, entryRevelation: true, surge: /^Surge\./m.test(c.text || ''), peril: /(?:^|\n|\. )Peril\./.test(c.text || '') }
    else if (c.type === 'story') storyAssets[code] = { ...base, global: true }
    else if (c.type === 'asset') storyAssets[code] = { ...base,
      slots: [...(c.slots || [])], ...(c.health != null ? { health: c.health } : {}), ...(c.sanity != null ? { sanity: c.sanity } : {}) }
  }
  return { enemies, treacheries, storyAssets }
}

export function identitiesFor(scenario) {
  const identity = value => ({ originalCode: value.originalCode, artCode: value.originalCode })
  return Object.fromEntries(['locations', 'enemies', 'treacheries', 'storyAssets', 'acts', 'agendas'].map(category => [category,
    Object.fromEntries(Object.values(scenario[category] || {}).map(value => [value.id || value.code, identity(value)]))]))
}
