// 05260 佩妮·怀特（《聚合幻灭》剧情支援）
// 卡面：你得到 +1[willpower]。
// [reaction] 当你在显现效果期间成功进行技能检定时，横置佩妮·怀特：发现你所在地点的 1 个线索。
//
// 受控剧情支援与玩家卡同通道：+1 技能走 modifiers，反应走 abilities。
// 「显现效果期间」由引擎的 state._treacheryResolving 标记（诡计结算期间为真），
// 检定成功的反应窗口是 skillTestSuccess（与序章 05049 同口径）。

export default {
  code: '05260',
  scope: 'storyAsset',
  implemented: true,
  modifiers: [{ target: 'skill:willpower', amount: 1 }],
  abilities: [{
    kind: 'reaction',
    trigger: 'skillTestSuccess',
    label: '横置：显现效果期间检定成功 → 发现你所在地点的 1 个线索',
    cost: { exhaust: true },
    criteria: [({ inv, state, context }) => Boolean(state._treacheryResolving)
      && (context?.seat == null || context.seat === inv.seat)
      && state.skillTest?.seat === inv.seat],
    resolve: ({ inv, api }) => {
      api.discoverClue(inv.seat, 1)
      api.info(`${inv.name} 在显现效果期间检定成功（佩妮），发现了所在地点的 1 个线索。`)
    },
  }],
}
