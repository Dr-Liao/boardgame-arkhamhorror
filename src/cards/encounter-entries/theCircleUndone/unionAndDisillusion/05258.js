// 05258 加弗瑞拉·米兹拉克（《聚合幻灭》剧情支援）
// 卡面：你得到 +1[combat]。
// [reaction] 在敌人攻击你后（即便该次攻击被取消），横置加弗瑞拉·米兹拉克：发现你所在地点的 1 个线索。
//
// 由 UAD 的 resolveFate 把「放一边的剧情支援」交给调查员控制（api.giveAsset）；
// 受控后与玩家卡走同一套描述子通道：+1 技能走 modifiers，反应走 abilities（引擎
// descriptorSources 会枚举受控卡条目的 abilities）。
// 已知缺口（见 primitive-requests/fix-c7shared.json）：引擎对被取消的攻击仍在
// enemyAttacked 窗口前提前 return，因此「攻击被取消」这半句当前不可观察。

export default {
  code: '05258',
  scope: 'storyAsset',
  implemented: true,
  modifiers: [{ target: 'skill:combat', amount: 1 }],
  abilities: [{
    kind: 'reaction',
    trigger: 'enemyAttacked',
    label: '横置：敌人攻击你后（即便被取消）发现你所在地点的 1 个线索',
    cost: { exhaust: true },
    criteria: [({ inv, context }) => context?.seat === inv.seat && Boolean(context?.enemy)],
    resolve: ({ inv, api }) => {
      api.discoverClue(inv.seat, 1)
      api.info(`${inv.name} 遭敌袭击后（加弗瑞拉）发现了所在地点的 1 个线索。`)
    },
  }],
}
