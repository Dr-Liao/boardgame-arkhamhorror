// Public presentation style of an investigator's attack. Resolution order:
// card override → trait category → 'default'. The browser falls back to the
// default strike for any style it does not know.
export const ATTACK_STYLES = Object.freeze(['default', 'firearm', 'blade', 'lightning'])

// Melee covers blunt tools too (bats, crowbars, hammers), so blades are the
// Melee cards whose English name names an edged weapon.
const BLADE_NAME = /knife|blade|machete|sword|athame|dagger|kukri|cleaver|katana|khopesh|sickle|axe\b/i

const hasTrait = (card, trait) => (card?.traits || []).some(item => String(item).toLowerCase() === trait)

const CATEGORIES = Object.freeze([
  { style: 'firearm', match: card => hasTrait(card, 'firearm') },
  { style: 'blade', match: card => hasTrait(card, 'melee') && BLADE_NAME.test(card.name || '') },
])

const CARD_OVERRIDES = Object.freeze({
  '02301': 'lightning', // Lightning Gun
  '04305': 'default', // Flamethrower
  '09119': 'default', // Hyperphysical Shotcaster
  '04276': 'blade', // Timeworn Brand
  '11115': 'blade', // Storm Ruler
  '12086': 'blade', // Broken Bottle
  '09005': 'blade', // Bonesaw
})

export function attackStyle(card) {
  if (!card) return 'default'
  for (const code of [card.code, card.originalCode]) {
    if (code && Object.hasOwn(CARD_OVERRIDES, code)) return CARD_OVERRIDES[code]
  }
  return CATEGORIES.find(category => category.match(card))?.style || 'default'
}
