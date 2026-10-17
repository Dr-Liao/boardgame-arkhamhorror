import { ALL_CARDS } from './cards-data.js'
import { SCENARIO_CARD_IDENTITIES } from './scenarios-data.js'

export const CARD_IDENTITY_FIELDS = Object.freeze(['ruleId', 'originalCode', 'identityStatus', 'approximation', 'identityReason', 'variant', 'linkedOriginalCode', 'haskellCardCode', 'artId'])

export function cardIdentityFields(definition) {
  if (!definition) return {}
  const identity = { ...resolveCardIdentity(definition) }
  for (const field of CARD_IDENTITY_FIELDS) {
    if (Object.hasOwn(definition, field)) identity[field] = definition[field]
  }
  return Object.fromEntries(CARD_IDENTITY_FIELDS.filter(field => Object.hasOwn(identity, field)).map(field => [field, identity[field]]))
}

export function getScenarioCardIdentity(scenarioId, category, ruleId) {
  if (!Object.hasOwn(SCENARIO_CARD_IDENTITIES, scenarioId)) return null
  const categories = SCENARIO_CARD_IDENTITIES[scenarioId]
  if (!Object.hasOwn(categories, category) || !Object.hasOwn(categories[category], ruleId)) return null
  return { scenarioId, category, ...structuredClone(categories[category][ruleId]) }
}

export function resolveCardIdentity(value, { scenarioId, category } = {}) {
  const object = value && typeof value === 'object' ? value : null
  const ruleId = typeof value === 'string' ? value : object?.ruleId || object?.code || object?.id
  if (typeof ruleId !== 'string') return null
  const candidates = []
  for (const [scenario, categories] of Object.entries(SCENARIO_CARD_IDENTITIES)) {
    if (scenarioId && scenarioId !== scenario) continue
    for (const [group, entries] of Object.entries(categories)) {
      if (category && category !== group) continue
      if (Object.hasOwn(entries, ruleId)) candidates.push({ scenarioId: scenario, category: group, ...entries[ruleId] })
    }
  }
  const codes = new Set(candidates.map(entry => entry.originalCode))
  if (codes.size > 1) return null
  const identity = candidates[0] || (Object.hasOwn(ALL_CARDS, ruleId) ? { originalCode: ruleId, ruleId, identityStatus: 'mapped' } : null)
  if (!identity || !Object.hasOwn(ALL_CARDS, identity.originalCode)) return null
  if (object?.originalCode && object.originalCode !== identity.originalCode) return null
  const card = ALL_CARDS[identity.originalCode]
  return {
    ...structuredClone(identity),
    instanceId: object?.id && object.id !== ruleId ? object.id : null,
    artId: object?.artId ?? object?.art ?? null,
    linkedOriginalCode: identity.linkedOriginalCode || card.linkedToCode || card.linkedCardCode || null,
    approximation: !!identity.approximation,
  }
}
