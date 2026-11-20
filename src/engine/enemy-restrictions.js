// 敌人卡面的「不可变」限制读点（P7 TDC 11702–11704 克苏鲁部位非[[狂怒]]面）：
//   印刷「不能受到伤害、被击败或横置」——按当前面条目动态读取，换面后立即失效；
//   文本被清空（enemyTextBlanked）时按规则限制也失效。
// 击败限制沿用既有 enemyCannotBeDefeated（src/engine/enemy-faces.js）。
import { registeredEntry } from './ability.js'

const entryOf = enemy => registeredEntry(enemy?.originalCode || enemy?.code)

export function enemyCannotBeDamaged(state, enemy, isBlanked = () => false) {
  if (!enemy || isBlanked(enemy)) return false
  return entryOf(enemy)?.enemyRule?.cannotBeDamaged === true
}

export function enemyCannotBeExhausted(state, enemy, isBlanked = () => false) {
  if (!enemy || isBlanked(enemy)) return false
  return entryOf(enemy)?.enemyRule?.cannotBeExhausted === true
}
