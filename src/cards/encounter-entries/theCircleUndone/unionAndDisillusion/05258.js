// 05258 加弗瑞拉·米兹拉克（《聚合幻灭》剧情支援）
// 卡面：你得到 +1[combat]。
// [reaction] 在敌人攻击你后（即便该次攻击被取消），横置加弗瑞拉·米兹拉克：发现你所在地点的 1 个线索。
//
// 由 UAD 的 resolveFate 把「放一边的剧情支援」交给调查员控制（api.giveAsset）；
// 受控后与玩家卡走同一套描述子通道：+1 技能走 modifiers，反应走 abilities（引擎
// descriptorSources 会枚举受控卡条目的 abilities）。
// 「即便该次攻击被取消」由引擎修复（src/engine/enemies.js:137-146：取消分支也开一次
// enemyAttacked 窗口，context.cancelled=true），条目本身无需额外判据。

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
