// 05085 · 死亡门前（atDeathsDoorstep）
// 约瑟夫·梅吉尔：反击；谈判（智识 4）成功翻面结算 05085b、失败他攻击你。面表/翻面与谈判规则在 behavior.js 的 flipJosef/actions/performAction；反击由 definition 的印刷关键词提供。
//
// 一卡一文件：规则的唯一实现在章节目录 behavior.js（本章是流程型结算，跨卡顺序需要状态机）；
// 本条目只声明卡面身份与 implemented 读点，供 implementedFor/审计与 P9 资产页读取。

export default {
  code: '05085',
  scope: 'enemy',
  implemented: true,
}
