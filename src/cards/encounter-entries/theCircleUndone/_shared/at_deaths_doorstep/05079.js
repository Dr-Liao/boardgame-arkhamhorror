// 05079 · 死亡门前（atDeathsDoorstep）
// 维多利亚式宴会厅（幽灵面）：闹鬼 - 失去 1 个行动。数据面在 05072 的 back 上；haunted 由 behavior.locationFlipped 授权（SPECTRAL_HAUNTED）。
//
// 一卡一文件：规则的唯一实现在章节目录 behavior.js（本章是流程型结算，跨卡顺序需要状态机）；
// 本条目只声明卡面身份与 implemented 读点，供 implementedFor/审计与 P9 资产页读取。

export default {
  code: '05079',
  scope: 'location',
  implemented: true,
}
