import { registeredEntry } from './ability.js'

export function enemyCanEnterLocation(state, enemy, destination) {
  const rule = registeredEntry(enemy?.originalCode || enemy?.code)?.enemyRule
  const required = rule?.enterOnlyTraits
  if (!required?.length) return true
  const location = state.locations.find(item => item.id === destination)
  return !!location && required.some(trait => location.traits?.some(value =>
    value.toLowerCase() === trait.toLowerCase()))
}

export function enemyHasLocationKeyword(state, enemy, keyword) {
  const location = state.locations.find(item => item.id === enemy.location)
  return (location?.attachments || []).some(source => {
    const aura = registeredEntry(source.originalCode || source.code)?.treacheryRule?.enemyKeywordAura
    return aura?.keywords?.includes(keyword) && (!aura.trait || enemy.traits?.some(trait =>
      trait.toLowerCase() === aura.trait.toLowerCase()))
  })
}
