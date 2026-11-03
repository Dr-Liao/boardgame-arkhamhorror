import { t } from './i18n.js'
import { SKILL_ICONS, SYMBOL_ALIASES } from './game-symbols.js'
const skillLabelKeys = Object.freeze({ willpower: 'symbol.willpower', intellect: 'symbol.intellect', combat: 'symbol.combat', agility: 'symbol.agility', wild: 'symbol.wild' })

// Runtime skill keys are data, never player-facing labels. Accept single,
// combined and older bracketed/aliased values without leaking unknown keys.
export function skillIds(value) {
  return (Array.isArray(value) ? value.flat(Infinity) : [value]).flatMap(item =>
    String(item ?? '').split(/[,+/]/).map(part => {
      const key = part.trim().replace(/^\[|\]$/g, '').toLowerCase()
      return SYMBOL_ALIASES[key] || key
    })).filter(key => Object.hasOwn(SKILL_ICONS, key))
}
export function skillLabel(value) {
  const ids = skillIds(value)
  return ids.length ? ids.map(id => t(skillLabelKeys[id])).join('+') : t('table.skill.generic')
}
export function skillSymbols(value) {
  const ids = skillIds(value)
  return ids.length ? ids.map(id => `[${id}]`).join('+') : t('table.skill.generic')
}

// Only opt into this for generated prompts/logs. Printed card prose and traits
// retain their text; an existing [skill] must never become [[skill]].
export function skillText(text, { symbols = true } = {}) {
  return String(text ?? '').replace(/(\[\[[^\]]+\]\]|\[[a-z_]+\])|\b(combat|agility|intellect|willpower|wild|knowledge)\b/gi,
    (match, token, bare) => {
      if (token?.startsWith('[[')) return token
      const ids = skillIds(bare || token)
      return ids.length ? symbols ? skillSymbols(ids) : skillLabel(ids) : match
    })
}
