// 05178i · 恶罪报应（theWagesOfSin）
// 异端者（I 面）：同 A 面规则；被击败后翻到 05178j：立即翻回敌人面并攻击，且本场不能以任何方式被击败（谈判受限）。规则在 behavior.enemyDefeated/resolveImmediateUnfinishedBusiness。
//
// 一卡一文件：规则的唯一实现在章节目录 behavior.js（本章大量跨卡顺序结算）；
// 本条目只声明卡面身份与 implemented 读点，供 implementedFor/审计与 P9 资产页读取。

export default {
  code: '05178i',
  scope: 'enemy',
  implemented: true,
  flags: { enemyRole: 'heretic' },
}
