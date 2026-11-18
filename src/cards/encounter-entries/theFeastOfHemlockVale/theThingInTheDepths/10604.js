// 10604 泥泞下沉 · 诡计（theThingInTheDepths）
// 归属：关卡专用 · theFeastOfHemlockVale/theThingInTheDepths（P7 深沼之物）。
// 卡面：[[危险]]。显现 - 如果你位于……
//   -……[[沉没]]地点，受到 1 点直接伤害，并对你控制的每个[[盟友]]支援造成 1 点直接伤害。
//   -……[[沼地]]地点，在你的地点放置 1 个伤害标记，作为渗坑。
//
// 象征交给章节 behavior.events.depthsSinkingSludge（按地点特性结算两种分支），本条目只留标记。
export default {
  code: '10604',
  scope: 'treachery',
  implemented: true,
  flags: {
    traits: ['Hazard'],
    sunkenBranch: { directDamage: 1, directDamageToEachAlly: 1 },
    bogBranch: { sinkholes: 1 },
  },
  encounterResolve(state, inv, card, api) {
    void state
    void card
    api.resolveScenarioEvent('depthsSinkingSludge', { seat: inv.seat })
    return false
  },
  note: '显现的执行在 behavior.sinkingSludgeResolve（按地点 traits 的 [[沉没]]/[[沼地]] 分支）。',
}
