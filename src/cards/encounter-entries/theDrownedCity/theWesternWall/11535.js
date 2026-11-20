// 11535 猎食寄生虫 · 弱点敌人（西墙，放一边；结局由 Do No Harm 加入牌库）
// 归属：关卡专用 · theDrownedCity/theWesternWall。
// 卡面：冷漠。猎手。猎物 - 仅限持有者。
//       生成 - 一处连接地点（尽可能为空地点）。
//       强制 - 敌军阶段结束时：在本敌人所在地点的一张玩家卡牌上放置 1 个毁灭标记。然后，弃掉猎食寄生虫。
// 印刷：战斗 2 / 躲避 2 / 生命 1 / 伤害 1 / 恐惧 0 / 特性 [[Monster]][[Stowaway]]；弱点（unique）。
// 读点（全部为引擎既有钩子）：
//   · 冷漠/猎手/猎物（持有者）由 definition.encounterDefinitions 从卡文解析（aloof/hunter/prey=bearer）；
//   · 「生成 - 一处连接地点（尽可能为空地点）」：behavior.spawnLocation 按持有者所在地点的连接找空地点；
//   · 「敌军阶段结束时放 1 毁灭再弃掉」：behavior.enemyPhaseEnd（turn.js#enemyPhaseEnd 既有读点）；
//   · 「加入牌库」：behavior.resolveDoNoHarm（Do No Harm 结局结算）。
export default {
  code: '11535',
  scope: 'enemy',
  implemented: true,
  note: '印刷行为已接到既有钩子（behavior.spawnLocation / enemyPhaseEnd / resolveDoNoHarm）；'
    + '「在一张玩家卡上放置 1 个毁灭」由领队用 api.choose 从所在地点玩家卡中选择（无玩家卡时只弃掉自身）。',
  abilities: [],
}
