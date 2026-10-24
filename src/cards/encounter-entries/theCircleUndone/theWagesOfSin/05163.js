// 05163 · 恶罪报应（theWagesOfSin）
// 议程 2 死亡来临：地点不能被翻到非幽灵面（behavior.canFlipHere 限制翻面方向）；背面 → 结局 2（behavior.agendaReveal 的 advanceDeathsApproach）。
//
// 一卡一文件：规则的唯一实现在章节目录 behavior.js（本章大量跨卡顺序结算）；
// 本条目只声明卡面身份与 implemented 读点，供 implementedFor/审计与 P9 资产页读取。

export default {
  code: '05163',
  scope: 'agenda',
  implemented: true,
  flags: { advanceRule: 'deathsApproach' },
}
