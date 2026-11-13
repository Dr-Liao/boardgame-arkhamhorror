// 反应窗口的来源判定（进程内瞬态，不写 state）。
//
// 「否定存在」（05032/05280）这类卡只对「遭遇卡或敌人攻击」造成的效果生效：
//   · 敌人攻击 —— 引擎在 enemyAttack 结算期间写 state._enemyAttackResolving；
//   · 遭遇卡   —— 规则书 FAQ 把幕/密谋/地点/敌人/诡计/弱点/场景卡都算遭遇卡
//                （arkhamdb 02312 官方 FAQ）。以下三种读点任一成立即算：
//                  - state._treacheryResolving：诡计显现结算期间；
//                  - currentRevelation()：诡计/弱点显现作用域（resolution-scope.js）；
//                  - encounterEffectResolving()：剧本内容（scenarioRuntime 的 api 方法）
//                    正在结算的进程内帧。
//
// 同一次结算里两层来源可能同时成立；敌人攻击优先（卡面把它单列），其次是遭遇卡。
// 读点只用于窗口 context.source，不进存档/重放指纹；新增读点请同时补窗口调用点与测试。
import { currentRevelation, encounterEffectResolving } from './resolution-scope.js'

export function reactionSourceKind(state) {
  if (state?._enemyAttackResolving) return 'enemyAttack'
  if (state?._treacheryResolving || currentRevelation() != null || encounterEffectResolving()) return 'encounter'
  return 'other'
}

// 窗口 context 的 `source` 字段（与既有调用点保持 `{ kind }` 形状）。
export function reactionSource(state) {
  return { kind: reactionSourceKind(state) }
}
