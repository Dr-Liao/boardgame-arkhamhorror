// 05165 · 恶罪报应（theWagesOfSin）
// 幕 2 追寻生者：[fast] 翻面（团队每轮每地点一次）、非幽灵地点不能发现线索、目标 4 张未了之事；背面记录玉米皮娃娃 Memento 并进入结局 1。规则在 behavior.actions/checkObjectives/advanceInPursuitOfTheLiving。
//
// 一卡一文件：规则的唯一实现在章节目录 behavior.js（本章大量跨卡顺序结算）；
// 本条目只声明卡面身份与 implemented 读点，供 implementedFor/审计与 P9 资产页读取。

export default {
  code: '05165',
  scope: 'act',
  implemented: true,
  flags: { advanceRule: 'inPursuitOfTheLiving' },
}
