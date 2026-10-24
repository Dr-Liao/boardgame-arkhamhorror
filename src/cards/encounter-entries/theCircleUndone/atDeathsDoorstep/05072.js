// 05072 · 死亡门前（atDeathsDoorstep）
// 维多利亚式宴会厅：[action] 团队每场一次，从遭遇牌库顶弃牌直到弃出一个银暮秘社敌人，将其生成在这里，然后获得 2 个线索。规则在 behavior.js（victorianHallsAction）。
//
// 一卡一文件：规则的唯一实现在章节目录 behavior.js（本章是流程型结算，跨卡顺序需要状态机）；
// 本条目只声明卡面身份与 implemented 读点，供 implementedFor/审计与 P9 资产页读取。

export default {
  code: '05072',
  scope: 'location',
  implemented: true,
}
