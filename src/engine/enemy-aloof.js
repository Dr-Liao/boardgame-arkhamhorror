import { registeredEntry } from './ability.js'
import { entityRuleActive } from './modifiers.js'

// 冷漠（aloof）的有效读点。
//
// 实例上的 `enemy.aloof` 是**离散来源**的合成结果：印刷（printedAloof）、藏身处附属、
// 剧本授予（grantedAloof），在敌人入场时由 turn-flow 的 processPlayerEnemyEntry 重算。
// 但印刷正文里还有**连续条件**的冷漠——「洛依高尔所在地点有调查员没有手牌时，洛依高尔
// 失去冷漠」（07086）。这类条件随手牌/位置/横置状态随时变化，不能把结果写进 enemy.aloof：
// 那样每次手牌变化都要重算整场敌人，还会让存档出现「某回合的冷漠快照」。
//
// 因此规则读点统一走这里：先看实例布尔，再看两个「失去冷漠」的声明通道：
//   · 条目自己的连续条件 `enemyRule.losesAloofWhen(state, enemy)`（07086 洛依高尔）；
//   · 实体规则 `loses:aloof`（幕/议程/地点/敌人声明的「每个[[嫌犯]]敌人失去冷漠」，
//     07124–07127 写在议程上，由 entityRuleActive 读 scene 行）。
// 文本被涂白的敌人按既有口径整段失效（印刷条件与印刷冷漠一起消失）。
export function enemyIsAloof(state, enemy, { isBlanked = () => false, entryOf = registeredEntry } = {}) {
  if (!enemy?.aloof) return false
  if (isBlanked(state, enemy)) return false
  if (entityRuleActive(state, enemy, 'loses:aloof')) return false
  const rule = entryOf(enemy.originalCode || enemy.code)?.enemyRule
  if (typeof rule?.losesAloofWhen !== 'function') return true
  try {
    return rule.losesAloofWhen(state, enemy) !== true
  } catch {
    // 条件读不出来时按「仍然冷漠」处理：冷漠只限制攻击/自动交战，宁可保守。
    return true
  }
}
