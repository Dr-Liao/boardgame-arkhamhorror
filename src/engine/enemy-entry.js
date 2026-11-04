import { registeredEntry } from './ability.js'

export function enemyCanEnterLocation(state, enemy, destination) {
  const rule = registeredEntry(enemy?.originalCode || enemy?.code)?.enemyRule
  const location = state.locations.find(item => item.id === destination)
  // 「不能进入[[洞穴]]地点」（07164b/07165b 魔鬼礁石的骇物）：禁止类特性。
  const banned = rule?.cannotEnterTraits
  if (banned?.length && location && banned.some(trait => location.traits?.some(value =>
    String(value).toLowerCase() === String(trait).toLowerCase()))) return false
  const required = rule?.enterOnlyTraits
  if (!required?.length) return true
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

// 「与你交战期间你不能做 X」的敌方持续限制（07183「追猎的深潜者与你交战时，你不能进入载具
// 或获得资源」）。声明：`enemyRule.engagedRestrictions: ['enterVehicle', 'gainResources']`。
// 读点：vehicles.js 的 vehicleAccessError（进入载具）与 resource-bank.js 的 gainResource（获得资源）。
export const ENGAGED_RESTRICTIONS = Object.freeze(['enterVehicle', 'gainResources'])

export function enemyEngagedRestricts(state, inv, restriction) {
  if (!inv || !restriction) return false
  return (state?.enemies || []).some(enemy => !enemy.defeated && !enemy.removedFromGame
    && enemy.engagedSeat === inv.seat
    && registeredEntry(enemy.originalCode || enemy.code)?.enemyRule?.engagedRestrictions?.includes(restriction))
}
