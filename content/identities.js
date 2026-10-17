// Keep rule aliases, printed card numbers and art identities separate.
export function bindScenarioIdentities(scenario, categories) {
  for (const [category, entries] of Object.entries(categories)) {
    for (const [ruleId, identity] of Object.entries(entries)) {
      const definitions = scenario[category]
      const definition = category === 'scenario'
        ? scenario
        : Array.isArray(definitions)
          ? definitions.find(entry => entry.id === ruleId)
          : definitions?.[ruleId]
      if (!definition) throw new Error(`身份映射缺少规则定义：${scenario.id}/${category}/${ruleId}`)
      Object.assign(identity, { ruleId, identityStatus: identity.approximation ? 'approximation' : 'mapped' })
      Object.freeze(identity)
      Object.assign(definition, identity)
    }
    Object.freeze(entries)
  }
  Object.freeze(categories)
  return scenario
}
