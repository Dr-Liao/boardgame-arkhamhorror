// 11635 巨型暴君 · 敌人（庞大；+3[per_investigator] 生命且不能移动；敌军阶段结束强制直接恐惧）。
// 归属：关卡专用 · theDrownedCity/courtOfTheAncients（TDC P7）。
// 读点：
//   · behavior.enemyStatModifier（+3[per] 生命）；
//   · 不能移动 = enemyRule.immobile（引擎 enemy-keyword-movement#enemyIsImmobile：
//     relocateEnemy 任何移动来源 / 巡逻 / 猎手移动都拦；也可被 api.scenario.setEnemyKeywords 动态改写）；
//   · behavior.enemyPhaseEnd（敌军阶段结束对相邻地点直接恐惧）。
export default {
  code: '11635',
  scope: 'enemy',
  implemented: true,
  enemyRule: { immobile: true },
  flags: {"massive":true,"enemyPhaseEndDirectHorror":true},
  note: "+生命与敌军阶段结束直接恐惧在 behavior.enemyStatModifier / enemyPhaseEnd；「不能移动」由 enemyRule.immobile 声明（immobile 标为可被 setEnemyKeywords 动态改写的关键词）。",
  abilities: [],
}
