// 05178g · 恶罪报应（theWagesOfSin）
// 异端者（G 面）：同 A 面规则；被击败后翻到 05178h（在异端者墓地驱除）。规则在 behavior.enemyDefeated。
//
// 一卡一文件：规则的唯一实现在章节目录 behavior.js（本章大量跨卡顺序结算）；
// 本条目只声明卡面身份与 implemented 读点，供 implementedFor/审计与 P9 资产页读取。

export default {
  code: '05178g',
  scope: 'enemy',
  implemented: true,
  flags: { enemyRole: 'heretic' },
}
