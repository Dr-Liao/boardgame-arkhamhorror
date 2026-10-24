// 05080 · 死亡门前（atDeathsDoorstep）
// 纪念品陈列室（幽灵面）：闹鬼 - 失去 2 资源，每有 1 个无法失去的资源改为受 1 点恐惧。数据面在 05073 的 back 上。
//
// 一卡一文件：规则的唯一实现在章节目录 behavior.js（本章是流程型结算，跨卡顺序需要状态机）；
// 本条目只声明卡面身份与 implemented 读点，供 implementedFor/审计与 P9 资产页读取。

export default {
  code: '05080',
  scope: 'location',
  implemented: true,
}
