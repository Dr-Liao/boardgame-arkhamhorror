// 08086 迈克尔·李
// 卡面：你得到+1[intellect]和+1[combat]。
//       [reaction]在你成功调查后：在迈克尔·李上放置1资源(从供应堆拿取)作为证据(最多3个证据)。
//       [reaction]在你发动一次攻击时，横置迈克尔·李并花费1证据：你在本次攻击中造成+1伤害。
//
// 读点：
//   · 属性修正走 modifiers（skill:intellect / skill:combat）。
//   · 证据用支援的 uses 表示（引擎卡牌计数器只登记了 bounty，没有通用的「证据」计数器读点；
//     uses 与费用支付/上限语义一致，不新造状态字段）。
//   · 「发动攻击时横置并花 1 证据：本次攻击 +1 伤害」用 testInitiated 窗口（发起检定时）+
//     api.addExtraOnSuccess({type:'dealDamage',target:'engaged'}) 近似。
//
// approximation: 攻击加成以「成功后对交战敌人追加 1 点伤害」结算，而不是并入本次攻击伤害
//   （引擎没有在攻击发起窗口写本次攻击 damageBonus 的通用读点；已提交请求 m2-3-08086）。
//
// 一张卡一个文件：这张卡的行为只在这里维护。

export default {
  code: '08086',
  uses: 0,
  usesType: 'evidence',
  abilities: [
    { kind: 'reaction', trigger: 'investigateSuccess', label: '调查成功：放置 1 证据（最多 3）',
      criteria: ({ inv, source, context }) => Boolean(source) && context?.seat === inv.seat,
      resolve: ({ source, api }) => {
        if (source && (source.uses || 0) < 3) api.addUses(source, 1)
      } },
    { kind: 'reaction', trigger: 'testInitiated', label: '发起攻击检定：横置并花 1 证据，本次攻击 +1 伤害',
      cost: { exhaust: true, uses: 1 },
      criteria: ({ inv, state, source, context }) => Boolean(source) && (context?.seat == null || context.seat === inv.seat)
        && (context?.actionKind === 'fight' || context?.kind === 'fight' || state.skillTest?.actionKind === 'fight'),
      resolve: ({ api }) => api.addExtraOnSuccess({ type: 'dealDamage', amount: 1, target: 'engaged' }) },
  ],
  modifiers: [
    { target: 'skill:intellect', amount: 1 },
    { target: 'skill:combat', amount: 1 },
  ],
}
