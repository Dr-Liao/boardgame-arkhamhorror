// 05085b · 死亡门前（atDeathsDoorstep）
// 约瑟夫的计划（05085 的背面）：移除毁灭、本局银暮秘社敌人不能放毁灭、Josef 获冷漠、翻回敌人面并解除交战。由 behavior.flipJosef 结算（storyAssets 声明于 definition.js）。
//
// 一卡一文件：规则的唯一实现在章节目录 behavior.js（本章是流程型结算，跨卡顺序需要状态机）；
// 本条目只声明卡面身份与 implemented 读点，供 implementedFor/审计与 P9 资产页读取。

export default {
  code: '05085b',
  scope: 'storyAsset',
  implemented: true,
}
