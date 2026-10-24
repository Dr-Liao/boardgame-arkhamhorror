// 05176 · 恶罪报应（theWagesOfSin）
// 教堂阁楼（176）：调查此地时把手牌张数加入技能值（behavior.beforeInvestigate + statModifier）；幽灵面闹鬼随机弃 1 张手牌（≥5 张时弃 2 张）。
//
// 一卡一文件：规则的唯一实现在章节目录 behavior.js（本章大量跨卡顺序结算）；
// 本条目只声明卡面身份与 implemented 读点，供 implementedFor/审计与 P9 资产页读取。

export default {
  code: '05176',
  scope: 'location',
  implemented: true,
}
