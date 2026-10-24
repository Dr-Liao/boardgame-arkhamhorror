// 05067 · 死亡门前（atDeathsDoorstep）
// 议程 2 横跨界限：银暮秘社敌人视作调查员（behavior.hunterMove）、猎手移动后的幽灵伤害（behavior.enemyPhaseEnd）；背面按幕结算结局 3/击败+创伤（behavior.agendaReveal 的 advanceOverTheThreshold）。
//
// 一卡一文件：规则的唯一实现在章节目录 behavior.js（本章是流程型结算，跨卡顺序需要状态机）；
// 本条目只声明卡面身份与 implemented 读点，供 implementedFor/审计与 P9 资产页读取。

export default {
  code: '05067',
  scope: 'agenda',
  implemented: true,
  flags: { advanceRule: 'overTheThreshold' },
}
