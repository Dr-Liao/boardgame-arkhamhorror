// 05070 · 死亡门前（atDeathsDoorstep）
// 幕 3 逃出牢笼：目标 = 所有未被击败的调查员撤退（behavior.checkObjectives/allResigned）；轮末强制与背面结局 1 在 behavior.roundEnded/escapeTheCage。
//
// 一卡一文件：规则的唯一实现在章节目录 behavior.js（本章是流程型结算，跨卡顺序需要状态机）；
// 本条目只声明卡面身份与 implemented 读点，供 implementedFor/审计与 P9 资产页读取。

export default {
  code: '05070',
  scope: 'act',
  implemented: true,
  flags: { advanceRule: 'escapeTheCage' },
}
