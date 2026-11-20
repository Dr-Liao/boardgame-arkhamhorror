// 巡逻目标（patrolTarget）的纯声明校验：不依赖 ability.js / card-rules，供能力注册表与
// enemy-keyword-movement 共用，避免 ability.js 顶层 import 敌人模块造成的循环初始化。
const PATROL_FIELDS = {
  named: ['locationId'],
  trait: ['trait', 'minClues'],
  nearestEmpty: ['trait'],
  nearestEmptyTrait: ['trait'],
  resident: ['assetCode'],
  flood: ['below', 'canIncrease'],
  enemy: ['maxDoom'],
}

export function normalizePatrolTarget(spec) {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) throw new TypeError('巡逻目标需要对象')
  const fields = PATROL_FIELDS
  if (!Object.hasOwn(fields, spec.kind) || Object.keys(spec).some(key => !['kind', ...fields[spec.kind]].includes(key))) {
    throw new TypeError('未知巡逻目标')
  }
  const required = { named: ['locationId'], trait: ['trait'], nearestEmptyTrait: ['trait'], resident: ['assetCode'] }
  for (const key of required[spec.kind] || []) {
    if (typeof spec[key] !== 'string' || !spec[key].trim()) throw new TypeError(`巡逻目标缺少 ${key}`)
  }
  if (spec.minClues != null && (!Number.isSafeInteger(spec.minClues) || spec.minClues < 0)) throw new TypeError('巡逻线索门槛无效')
  if (spec.trait != null && (typeof spec.trait !== 'string' || !spec.trait.trim())) throw new TypeError('巡逻特性无效')
  if (spec.below != null && ![1, 2].includes(spec.below)) throw new TypeError('巡逻淹没门槛无效')
  if (spec.canIncrease != null && typeof spec.canIncrease !== 'boolean') throw new TypeError('巡逻淹没条件无效')
  if (spec.maxDoom != null && (!Number.isSafeInteger(spec.maxDoom) || spec.maxDoom < 0)) throw new TypeError('巡逻毁灭门槛无效')
  return { ...spec }
}
