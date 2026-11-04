// 07086 洛依高尔 · 许德拉的代理人
//
// 印刷（中文）：
//   猎物 - 手牌最少。
//   冷漠。猎手。
//   洛依高尔所在地点有调查员没有手牌时，洛依高尔失去冷漠。
//   强制 - 当敌军阶段结束时：洛依高尔所在地点和连接地点的每位调查员随机弃掉1张手牌。
//
// 引擎读点：
//   · 「冷漠/猎手/猎物」是印刷关键词，由关卡遭遇定义按印刷文本提供（不入状态快照）。
//   · 「有调查员没有手牌时失去冷漠」是**连续条件**：读点是 enemy-aloof 的 enemyIsAloof，
//     在攻击/自动交战的判定发生时求值，不写进 enemy.aloof（手牌随时变化）。
//   · 敌军阶段结束窗口 enemyPhaseEnds 只在真有监听者时开（本卡就是监听者）；
//     随机弃手牌走 api.discardRandomFromHand，与其它「随机弃牌」同一写入口。

const inReachOf = (state, enemy) => {
  const here = (state.locations || []).find(location => location.id === enemy.location)
  const ids = new Set([enemy.location, ...(here?.connections || [])])
  return (state.investigators || []).filter(inv => !inv.defeated && !inv.resigned && ids.has(inv.location))
}

export default {
  code: '07086', scope: 'enemy', implemented: true,
  enemyRule: {
    losesAloofWhen: (state, enemy) => (state.investigators || []).some(inv =>
      !inv.defeated && !inv.resigned && inv.location === enemy.location && (inv.hand || []).length === 0),
  },
  abilities: [{
    kind: 'forced', trigger: 'enemyPhaseEnds',
    label: '敌军阶段结束时：此地与连接地点的每位调查员随机弃 1 张手牌',
    criteria: ({ state, source }) => inReachOf(state, source).some(inv => (inv.hand || []).length > 0),
    resolve: ({ state, source, api }) => {
      for (const inv of inReachOf(state, source)) {
        if ((inv.hand || []).length) api.discardRandomFromHand(inv.seat, 1)
      }
    },
  }],
}
