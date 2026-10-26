// Public presentation style of an investigator's attack. Resolution order:
// card override → trait category → 'default'. The browser falls back to the
// default strike for any style it does not know.
// 第 125 轮（第 8 批）：卡号 → 风格的覆盖表搬进内容层 `content/presentation/attack-styles.js`。
import { ATTACK_STYLE_OVERRIDES } from '../../content/presentation/attack-styles.js'

export const ATTACK_STYLES = Object.freeze(['default', 'firearm', 'blade', 'lightning', 'spell', 'spiritStorm'])

// Melee covers blunt tools too (bats, crowbars, hammers), so blades are the
// Melee cards whose English name names an edged weapon.
const BLADE_NAME = /knife|blade|machete|sword|athame|dagger|kukri|cleaver|katana|khopesh|sickle|axe\b/i

const hasTrait = (card, trait) => (card?.traits || []).some(item => String(item).toLowerCase() === trait)

const CATEGORIES = Object.freeze([
  { style: 'spell', match: card => hasTrait(card, 'spell') },
  { style: 'firearm', match: card => hasTrait(card, 'firearm') },
  { style: 'blade', match: card => hasTrait(card, 'melee') && BLADE_NAME.test(card.name || '') },
])

export function attackStyle(card) {
  if (!card) return 'default'
  for (const code of [card.code, card.originalCode]) {
    if (code && Object.hasOwn(ATTACK_STYLE_OVERRIDES, code)) return ATTACK_STYLE_OVERRIDES[code]
  }
  return CATEGORIES.find(category => category.match(card))?.style || 'default'
}
