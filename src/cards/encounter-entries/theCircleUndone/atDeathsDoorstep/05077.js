// 05077 · 死亡门前（atDeathsDoorstep）
// 办公室：位于办公室的银暮秘社敌人失去冷漠；强制 - 调查办公室揭示负面符号时，最近的银暮秘社敌人 +1 毁灭。前者由 behavior.syncOfficeAloof 同步，后者由 behavior.afterTest/chaos.js 结算。
//
// 一卡一文件：规则的唯一实现在章节目录 behavior.js（本章是流程型结算，跨卡顺序需要状态机）；
// 本条目只声明卡面身份与 implemented 读点，供 implementedFor/审计与 P9 资产页读取。

export default {
  code: '05077',
  scope: 'location',
  implemented: true,
}
