// 05068 · 死亡门前（atDeathsDoorstep）
// 幕 1 秘密阴谋：正面无目标（不主动推进）；背面由 behavior.actReveal 的 advanceHiddenAgendas 结算（换幽灵面/生成怪物/看守人/洗回两组）。
//
// 一卡一文件：规则的唯一实现在章节目录 behavior.js（本章是流程型结算，跨卡顺序需要状态机）；
// 本条目只声明卡面身份与 implemented 读点，供 implementedFor/审计与 P9 资产页读取。

export default {
  code: '05068',
  scope: 'act',
  implemented: true,
  flags: { advanceRule: 'hiddenAgendas' },
}
