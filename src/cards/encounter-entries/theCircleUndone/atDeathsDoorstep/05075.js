// 05075 · 死亡门前（atDeathsDoorstep）
// 主卧：强制 - 一轮结束时若主卧有调查员，在最近的银暮秘社敌人上放 1 毁灭。规则在 behavior.js 的 roundEnded（按地点卡号结算）。
//
// 一卡一文件：规则的唯一实现在章节目录 behavior.js（本章是流程型结算，跨卡顺序需要状态机）；
// 本条目只声明卡面身份与 implemented 读点，供 implementedFor/审计与 P9 资产页读取。

export default {
  code: '05075',
  scope: 'location',
  implemented: true,
}
