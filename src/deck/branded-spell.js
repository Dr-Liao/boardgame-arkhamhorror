import { ALL_CARDS } from '../cards/cards-data.js'

export function brandedSpellOptions(deck) {
  const copies = new Map()
  for (const code of deck) {
    const name = ALL_CARDS[code]?.name
    if (name) copies.set(name, (copies.get(name) || 0) + 1)
  }
  return [...new Set(deck)].flatMap(code => {
    const card = ALL_CARDS[code]
    return card?.type === 'asset' && !card.signatureFor && card.traits?.includes('Spell') && copies.get(card.name) === 1
      ? [{ id: card.name, label: card.nameZh || card.name, cardCode: code }] : []
  })
}
