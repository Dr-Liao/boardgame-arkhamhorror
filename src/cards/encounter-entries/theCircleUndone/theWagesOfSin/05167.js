// 05167 · 恶罪报应（theWagesOfSin）
// 闹鬼农田：位于此地的幽灵敌人 +1 恐惧值；幽灵面闹鬼把最近的幽灵敌人向这里移动一次。规则在 behavior.enemyAttackModifier/hauntedScript。
//
// 一卡一文件：规则的唯一实现在章节目录 behavior.js（本章大量跨卡顺序结算）；
// 本条目只声明卡面身份与 implemented 读点，供 implementedFor/审计与 P9 资产页读取。

export default {
  code: '05167',
  scope: 'location',
  implemented: true,
}
