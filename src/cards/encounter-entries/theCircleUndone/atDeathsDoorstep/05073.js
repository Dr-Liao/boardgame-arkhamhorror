// 05073 · 死亡门前（atDeathsDoorstep）
// 纪念品陈列室：[action] 每轮一次，获得 2 资源或花费 2 资源获得 1 个线索。规则在 behavior.js（trophyRoomAction）。
//
// 一卡一文件：规则的唯一实现在章节目录 behavior.js（本章是流程型结算，跨卡顺序需要状态机）；
// 本条目只声明卡面身份与 implemented 读点，供 implementedFor/审计与 P9 资产页读取。

export default {
  code: '05073',
  scope: 'location',
  implemented: true,
}
