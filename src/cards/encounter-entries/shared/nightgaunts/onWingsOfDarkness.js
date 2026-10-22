// onWingsOfDarkness 乘着黑暗之翼
// 归属：跨战役通用
// 遭遇组：nightgaunts
// 卡面：显现 - 敏捷（4）检定。失败受到 1 点伤害与 1 点恐惧，与每个非夜魇敌人解除交战，并被带到中心地点。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 乘着黑暗之翼（01169?）：失败惩罚的 kind 在卡面数据里是卡名，这里映射成通用 kind。
// 引擎的 applyPenalty 不再认识具体卡名。

export default {
  code: 'onWingsOfDarkness',
  name: '乘着黑暗之翼',
  scope: 'treachery',
  text: '显现 - 敏捷（4）检定。失败受到 1 点伤害与 1 点恐惧，与每个非夜魇敌人解除交战，并被带到中心地点。',
  penaltyKind: 'damageHorrorDisengageAndMoveCentral',
}
