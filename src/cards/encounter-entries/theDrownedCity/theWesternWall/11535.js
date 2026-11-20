// 11535 猎食寄生虫 · 弱点敌人（西墙，放一边；结局由 Do No Harm 加入牌库）
// 归属：关卡专用 · theDrownedCity/theWesternWall。
// 卡面：冷漠。猎手。猎物 - 仅限持有者。
//       生成 - 一处连接地点（尽可能为空地点）。
//       强制 - 敌军阶段结束时：在本敌人所在地点的一张玩家卡牌上放置 1 个毁灭标记。然后，弃掉猎食寄生虫。
// 印刷：战斗 2 / 躲避 2 / 生命 1 / 伤害 1 / 恐惧 0 / 特性 [[Monster]][[Stowaway]]；弱点（unique）。
// 读点：冷漠/猎手由 definition 解析；「加入牌库」在 behavior.resolveDoNoHarm（结局结算）。
export default {
  code: '11535',
  scope: 'enemy',
  implemented: false,
  note: '部分实现：作为弱点由 behavior.resolveDoNoHarm 永久加入调查员牌库；'
    + '「敌军阶段结束时放毁灭后弃掉」的强制能力没有阶段末读点，暂未实现（不标 implemented）。',
  abilities: [],
}
