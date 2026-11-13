// 09655b 深红斗篷的恶兽（The Beast in a Cowl of Crimson · Wolf in Sheep's Clothing / 披着羊皮的狼）· 敌人 · dogs_of_war
//
// 归属：关卡专用 · theScarletKeys/dogsOfWar（P7）。同一张物理卡的另一面是 09655a（「红衣毁灭者」）。
// 卡面（中）：强制 - 你在深红斗篷的恶兽所在地点时，技能检定失败后，如果它处于重整状态：
//   它变换身上附属的每个钥匙。
//
// 读点（全部在章节 behavior）：
//   · 5×人数生命、3 攻击值、4 躲避值 → definition 的 `enemies` 表；
//   · 「检定失败后变换身上的钥匙」→ behavior.afterTest 读 `enemyRule.shiftsKeysOnFailedTestAtLocation`
//     并调 behavior.resolveKeyShift（`by: 'enemy'`：只结算动荡面效果，不翻回稳定面）；
//   · 被击败 → behavior.enemyDefeated 记 `beastDefeated`（版本三的幕目标）。
export default {
  code: '09655b',
  name: '深红斗篷的恶兽',
  scope: 'enemy',
  implemented: true,
  enemyRule: {
    shiftsKeysOnFailedTestAtLocation: true,
    elite: true,
    hiddenSide: true,
  },
  note: 'approximation: 与 09654a 同一套「失败后换钥」读点；版本三它带着法罗斯之光（动荡面）出场，'
    + '被击败后密钥回到未持有态（引擎不允许密钥指向已离场敌人）。',
}
