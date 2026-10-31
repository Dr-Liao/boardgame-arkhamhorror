// 06091 追猎噩妖（Hunting Ghast，敌人，3 张）
// 归属：战役共用 · theDreamEaters/_shared。遭遇组：creatures_of_the_underworld（ATSOH / PONR）。
// 卡面：猎手。猎物 - 伤害最多。
//       强制 - 追猎噩妖进入一个带有[[古革巨人]]敌人的地点后：重整其地点的每个[[古革巨人]]敌人，
//       并对追猎噩妖造成 1 点伤害。
// 实现：enemyScript.onSpawn / onMoved 共同覆盖「进入地点」（含生成与移动；引擎的 enemyMoved
//   在移动完成后派发，enemy.location 已是新地点）。猎物「伤害最多」不在引擎 PREY_RANK 里，
//   已登记 coordinator request（mostDamage key）。
import { hasTrait } from '../../../_shared.js'

function gugEnter(state, enemy, api) {
  const location = (state.locations || []).find(item => item.id === enemy.location)
  if (!location) return
  const gugs = (state.enemies || []).filter(other =>
    other.id !== enemy.id && other.location === enemy.location && hasTrait(other, 'Gug'))
  if (!gugs.length) return
  for (const gug of gugs) api.readyEnemy?.(gug)
  api.damageEnemy?.(enemy, 1)
  api.info?.(`🦇 「追猎噩妖」进入「${location.name}」：重整 ${gugs.length} 个[[古革巨人]]敌人，并对自身造成 1 点伤害。`)
}

export default {
  code: '06091',
  scope: 'enemy',
  implemented: true,
  // 猎物「伤害最多」由引擎 PREY_RANK 的 mostDamage 求值。
  enemyRule: { prey: 'mostDamage' },
  enemyScript: {
    onSpawn(state, enemy, api) { gugEnter(state, enemy, api) },
    onMoved(state, enemy, previousLocation, api) { gugEnter(state, enemy, api) },
  },
}
