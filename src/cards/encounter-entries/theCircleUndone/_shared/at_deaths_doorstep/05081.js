// 05081 · 死亡门前（atDeathsDoorstep）
// 台球室（幽灵面，胜利 1）：闹鬼 - 弃掉一个支援或受 1 点伤害。数据面在 05074 的 back 上。
//
// 一卡一文件：规则的唯一实现在章节目录 behavior.js（本章是流程型结算，跨卡顺序需要状态机）；
// 本条目只声明卡面身份与 implemented 读点，供 implementedFor/审计与 P9 资产页读取。

export default {
  code: '05081',
  scope: 'location',
  implemented: true,
}
