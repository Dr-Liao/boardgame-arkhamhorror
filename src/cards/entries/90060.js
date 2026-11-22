// 90060 佐伊的十字架（Zoey's Cross <:> Symbol of Righteousness）· 中立 · 支援/道具/护符 · 费用 1 · 进阶。
// 卡面（cards-data 90060）：
//   佐伊·萨马拉斯牌库专用。进阶。
//   [reaction] 一个敌人与你交战后，横置佐伊的十字架并花费 1 资源：对该敌人造成 1 点伤害。
//   [fast] 从混乱袋中移除 2 个 [bless] 标记：与你所在地点的一个敌人交战。
//
// 引擎读点：
//   · 「敌人与你交战后」= enemyEngaged 窗口（enemies.js#engageEnemy 派发；context = { enemy, seat }）；
//     横置 + 花费资源 = cost { exhaust, resources }；伤害 = api.damageEnemy（唯一敌人伤害入口）。
//   · 「移除 2 个 [bless] 标记」= free 描述子的 additionalTokenCost { token:'bless', operation:'pay', count:2 }
//     （ability-rules.js#payAbilityCost 统一校验/支付混乱袋标记）。
//   · 「与一个敌人交战」= target { kind:'enemy' }（同地点候选）+ api.engage（engaging 的唯一写点）。
const code = '90060'

export default {
  code,
  abilities: [
    {
      kind: 'reaction',
      trigger: 'enemyEngaged',
      label: '敌人与你交战后，横置并花 1 资源：对该敌人造成 1 点伤害',
      cost: { exhaust: true, resources: 1 },
      criteria: [({ inv, context }) => context?.seat === inv.seat && Boolean(context?.enemy)],
      resolve: ({ state, context, api }) => {
        const enemy = context.enemy
        if (!enemy || !state.enemies.includes(enemy)) return
        api.damageEnemy(enemy, 1, enemy.engagedSeat ?? state.currentSeat)
        api.info(`✝️ 佐伊的十字架：对「${enemy.name}」造成 1 点伤害。`)
      },
    },
    {
      kind: 'free',
      label: '从混乱袋移除 2 个 [bless]：与你所在地点的一个敌人交战',
      additionalTokenCost: { token: 'bless', operation: 'pay', count: 2 },
      target: { kind: 'enemy' },
      resolve: ({ inv, target, api }) => {
        if (!target) return
        api.engage(target, inv.seat)
        api.info(`✝️ 佐伊的十字架：移除 2 个 [bless]，与「${target.name}」交战。`)
      },
    },
  ],
  modifiers: [],
}
