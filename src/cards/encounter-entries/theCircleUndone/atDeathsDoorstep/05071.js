// 05071 · 死亡门前（atDeathsDoorstep）
// 入口大厅：[action] 撤退（“我觉得在这儿查不到失踪事件的线索。”）。规则在章节目录 behavior.js 的 actions/performAction（resignEntryHall）。
//
// 一卡一文件：规则的唯一实现在章节目录 behavior.js（本章是流程型结算，跨卡顺序需要状态机）；
// 本条目只声明卡面身份与 implemented 读点，供 implementedFor/审计与 P9 资产页读取。

export default {
  code: '05071',
  scope: 'location',
  implemented: true,
}
