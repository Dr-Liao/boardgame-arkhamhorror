// 05172 · 恶罪报应（theWagesOfSin）
// 异端者的墓地（172）：位于此地的女巫敌人被击败后弃基础遭遇牌库顶 2 张（behavior.enemyDefeated 的共享分派 + behavior 内实现）；幽灵面闹鬼治愈异端者/女巫 1 点伤害。
//
// 一卡一文件：规则的唯一实现在章节目录 behavior.js（本章大量跨卡顺序结算）；
// 本条目只声明卡面身份与 implemented 读点，供 implementedFor/审计与 P9 资产页读取。

export default {
  code: '05172',
  scope: 'location',
  implemented: true,
}
