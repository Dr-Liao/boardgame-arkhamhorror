import { ENCOUNTER_REPRINT_ALIASES } from '../cards/entries/_reprint-aliases.js'

export const ALL_ENEMIES = {}
export const ALL_TREACHERIES = {}
export const ALL_STORY_ASSETS = {}

export function registerScenarioCards(scenario) {
  Object.assign(ALL_ENEMIES, scenario.enemies || {})
  Object.assign(ALL_TREACHERIES, scenario.treacheries || {})
  Object.assign(ALL_STORY_ASSETS, scenario.storyAssets || {})
  for (const definitions of [ALL_ENEMIES, ALL_TREACHERIES]) {
    for (const [code, aliases] of Object.entries(ENCOUNTER_REPRINT_ALIASES)) {
      const canonical = definitions[code] || Object.values(definitions).find(def => def.originalCode === code)
      if (!canonical) continue
      for (const alias of aliases) {
        if (Object.hasOwn(definitions, alias)) continue
        definitions[alias] = {
          ...canonical, code: alias, originalCode: alias, ruleId: alias, artCode: alias, encounterReprintOf: code,
          ...(canonical.type === 'enemy' && canonical.aloof == null && /(?:^|\n)Aloof\./.test(canonical.textEn || '')
            ? { aloof: true } : {}),
        }
      }
    }
  }
}
