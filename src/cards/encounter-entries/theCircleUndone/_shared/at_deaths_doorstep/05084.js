// 05084 · 死亡门前（atDeathsDoorstep）
// 办公室（幽灵面，胜利 2）：闹鬼 - 选择并弃掉你一张手牌。数据面在 05077 的 back 上。
//
// 一卡一文件：规则的唯一实现在章节目录 behavior.js（本章是流程型结算，跨卡顺序需要状态机）；
// 本条目只声明卡面身份与 implemented 读点，供 implementedFor/审计与 P9 资产页读取。

export default {
  code: '05084',
  scope: 'location',
  implemented: true,
}
