// 90059 佐伊·萨马拉斯（平行 / The Chef）· 守护者 · 独立发行平行调查员。
//
// 卡面：
//   [reaction] 在你对敌人造成 1 点或更多伤害时：在混乱袋中加入 1 个 [bless] 标记。（每阶段仅限一次。）
//   [fast] 在一次攻击中揭示混乱标记之前，从混乱袋中移除 3 个 [bless] 标记：本次攻击造成 +1 伤害。（每轮仅限一次。）
//   [elder_sign] 效果：混乱袋中每有 1 个 [bless] 标记，+1。
//
// 引擎读点：
//   · 「对敌人造成伤害后」= enemyDamaged 窗口（enemies.js#damageEnemy 派发，
//     context = { seat, enemy, amount, source, location }）；limit oncePerPhase + context.seat 限定本人。
//   · 加入祝福标记 = api.chaosTokens.add('bless', 1)（chaos-token-pool 唯一写点，上限 10）。
//   · 「攻击中揭示前移除 3 个 [bless]：本次攻击 +1 伤害」= free 描述子（test.beforeCommit/afterCommit +
//     duringOwnSkillTest + actionKind 'fight'）+ `additionalTokenCost: { token:'bless', operation:'pay', count:3 }`
//     （ability-rules.js#payAbilityCost 统一支付并在支付前校验袋中数量）+ api.playerTools.addAttackDamageBonus(1)
//     （写入 state.skillTest.attackDamageBonus，combat.js 在成功伤害公式里并入）。
//   · 旧印 = 混乱袋中 [bless] 数（读 state.chaosBag 公开数组）。
const code = '90059'

const blessInBag = state => (state.chaosBag || []).filter(token => token === 'bless').length

export default {
  code,
  kind: 'investigator',
  investigator: {
    elderSign: { bonus: 0 },
  },
  elderSign: {
    id: `${code}-eldersign`,
    label: '旧印：混乱袋中每有 1 个 [bless] 标记 +1',
    resolve: ({ state }) => ({ delta: blessInBag(state) }),
  },
  abilities: [
    {
      kind: 'reaction',
      trigger: 'enemyDamaged',
      limit: 'oncePerPhase',
      label: '你对敌人造成伤害后：加入 1 个 [bless] 标记',
      criteria: [({ inv, context }) => context?.seat === inv.seat && Number(context?.amount) > 0],
      resolve: ({ inv, api }) => {
        api.chaosTokens.add('bless', 1)
        api.info(`${inv.name} 对敌人造成伤害，在混乱袋中加入 1 个 [bless] 标记。`)
      },
    },
    {
      kind: 'free',
      trigger: ['test.beforeCommit', 'test.afterCommit'],
      duringOwnSkillTest: true,
      limit: 'oncePerRound',
      label: '攻击中揭示混乱标记前：移除 3 个 [bless]，本次攻击 +1 伤害',
      additionalTokenCost: { token: 'bless', operation: 'pay', count: 3 },
      criteria: [({ state }) => state.skillTest?.actionKind === 'fight'],
      resolve: ({ api }) => {
        api.playerTools.addAttackDamageBonus(1)
        api.info('🎯 佐伊（平行）：移除 3 个 [bless] 标记，本次攻击造成 +1 伤害。')
      },
    },
  ],
  modifiers: [],
}
