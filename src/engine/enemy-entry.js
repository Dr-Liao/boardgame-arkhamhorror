import { registeredEntry } from './ability.js'

export function enemyCanEnterLocation(state, enemy, destination) {
  const rule = registeredEntry(enemy?.originalCode || enemy?.code)?.enemyRule
  const location = state.locations.find(item => item.id === destination)
  // 梦境之门（06015a/b）：「敌人和除卢克·罗宾逊以外的调查员不能进入梦境之门」。
  // FAQ v2.1（2023-08）：敌人不能在梦境之门生成；若有敌人会在卢克位于梦境之门时生成在
  // 他的地点，改为弃掉该敌人。移动/猎人/追逐/生成校验共用本函数，所以这一处同时覆盖
  // 「进入」与「生成」两条路径（生成失败由 enemies.js#spawnEnemy 的 spawnFailed 分支弃牌）。
  if (location?.dreamGate === true) return false
  // 「敌人不能进入本地点」（TIC 07252b 拘禁室）：地点侧的声明。移动/猎人/追逐/生成校验
  // 共用本函数，所以一处声明覆盖「进入」与「生成」两条路径；生成落点的改换由
  // enemies.js#spawnEnemy 读取 locationRule.enemySpawnRedirect 处理。
  if (registeredEntry(location?.originalCode || location?.code)?.locationRule?.enemiesCannotEnter === true) return false
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
