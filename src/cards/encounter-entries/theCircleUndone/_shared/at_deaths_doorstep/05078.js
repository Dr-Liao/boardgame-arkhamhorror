// 05078 · 死亡门前（atDeathsDoorstep）
// 入口大厅（幽灵面）：迷雾屏障封锁入口（behavior.investigatorEntryError），银暮秘社敌人不能生成在这里（behavior.spawnLocation），[action] 撤退（resignSpectralEntryHall）。数据面在 05071 的 back 上，本条目登记该印刷卡身份。
//
// 一卡一文件：规则的唯一实现在章节目录 behavior.js（本章是流程型结算，跨卡顺序需要状态机）；
// 本条目只声明卡面身份与 implemented 读点，供 implementedFor/审计与 P9 资产页读取。

export default {
  code: '05078',
  scope: 'location',
  implemented: true,
}
