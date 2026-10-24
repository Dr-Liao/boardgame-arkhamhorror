// 05066 · 死亡门前（atDeathsDoorstep）
// 议程 1 正义·XI：银暮秘社敌人不能受伤/被击败（behavior.enemyDamageAllowed/enemyCanBeDefeated）；强制抽到怪物敌人放一边并放毁灭（behavior.spawnLocation/spawnFailed）；背面幕间故事 I 在 behavior.agendaReveal 的 advanceJusticeXI。
//
// 一卡一文件：规则的唯一实现在章节目录 behavior.js（本章是流程型结算，跨卡顺序需要状态机）；
// 本条目只声明卡面身份与 implemented 读点，供 implementedFor/审计与 P9 资产页读取。

export default {
  code: '05066',
  scope: 'agenda',
  implemented: true,
  flags: { advanceRule: 'justiceXI' },
}
