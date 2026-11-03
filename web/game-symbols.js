// Shared by card text and table UI. Glyphs match the bundled reference's
// styles/icons.css; health/sanity masks are its original heart/brain artwork.
export const TDC_RUNES = Array.from({ length: 26 }, (_, index) => `tdc_rune_${String.fromCharCode(97 + index)}`)
export const CARD_GLYPHS = Object.freeze({
  action: 'I', reaction: 'y', free: 'u', fast: 'u',
  willpower: 'A', intellect: 'F', combat: 'D', agility: 'S', wild: 'G',
  guardian: 'Q', seeker: 'E', rogue: 'T', mystic: 'W', survivor: 'R', neutral: 'F',
  elder_sign: 'X', auto_fail: 'Z',
  skull: '\ue910', cultist: '\ue911', tablet: '\ue912', elder_thing: '\ue913',
  curse: '\ue929', bless: '\ue92a', per_investigator: '\ue915',
  frost: 'b', seal_a: 'g', seal_b: 'f', seal_c: 'e', seal_d: 'c', seal_e: 'd',
  codex: 'h', day: 'i', night: 'j',
  ...Object.fromEntries(TDC_RUNES.map((name, index) => [name, String.fromCharCode(0xe900 + index)])),
})
export const ICON_GLYPHS = new Set(['skull', 'cultist', 'tablet', 'elder_thing', 'curse', 'bless', 'per_investigator'])
export const SLIM_GLYPHS = new Set(['neutral', 'frost', 'seal_a', 'seal_b', 'seal_c', 'seal_d', 'seal_e', 'codex', 'day', 'night', ...TDC_RUNES])
export const SKILL_ICONS = Object.freeze(Object.fromEntries(['willpower', 'intellect', 'combat', 'agility', 'wild'].map(name => [name, name])))
export const SYMBOL_ALIASES = Object.freeze({ eldersign: 'elder_sign', elderthing: 'elder_thing', autofail: 'auto_fail', knowledge: 'intellect', damage: 'health', horror: 'sanity' })
export const symbolFont = name => ICON_GLYPHS.has(name) ? 'AHCardSymbolIcons' : SLIM_GLYPHS.has(name) ? 'AHCardSymbolSlim' : 'AHCardSymbols'
