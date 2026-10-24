// 05171 · 恶罪报应（theWagesOfSin）
// 异端者的墓地（171）：调查此地时把意志值加入技能值（behavior.beforeInvestigate + statModifier）；幽灵面闹鬼基础意志减至 1 直到你下个回合结束。
//
// 一卡一文件：规则的唯一实现在章节目录 behavior.js（本章大量跨卡顺序结算）；
// 本条目只声明卡面身份与 implemented 读点，供 implementedFor/审计与 P9 资产页读取。

export default {
  code: '05171',
  scope: 'location',
  implemented: true,
}
