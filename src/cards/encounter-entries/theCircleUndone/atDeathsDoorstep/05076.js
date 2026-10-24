// 05076 · 死亡门前（atDeathsDoorstep）
// 露台：[action] 弃掉合计至少 3 个智识图标的手牌：谈判，获得 2 个线索（团队每场一次）。规则在 behavior.js（balconyParley）。
//
// 一卡一文件：规则的唯一实现在章节目录 behavior.js（本章是流程型结算，跨卡顺序需要状态机）；
// 本条目只声明卡面身份与 implemented 读点，供 implementedFor/审计与 P9 资产页读取。

export default {
  code: '05076',
  scope: 'location',
  implemented: true,
}
