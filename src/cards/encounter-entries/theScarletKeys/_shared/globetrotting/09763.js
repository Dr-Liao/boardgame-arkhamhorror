// 09763 阿丽·奎因特工（Agent Ari Quinn）· 剧情支援（盟友）· globetrotting
// 卡面：你所在地点有隐匿迷你卡牌时，你得到 +1[intellect]、+1[combat]、+1[agility]。
//   [reaction] 你揭露阴影中的卡牌后，横置阿丽·奎因特工：抽取 1 张卡牌。
// 读点：modifiers（condition.when 由 modifiers.js#evaluateCondition 读 state/inv/source）；
//   reaction 挂在 tskExposed 窗口；抽牌走 api.drawCards。
// 近似：无（条件只读 TSK 隐匿容器；容器不存在时视为无迷你卡）。
const CODE = '09763'

const concealedAt = (state, locationId) => Boolean(locationId)
  && (state?.scenarioFlags?.mechanics?.tsk?.concealed?.miniCards || [])
    .some(card => card.locationId === locationId && card.flipped !== true)

const concealBonus = target => ({
  target,
  amount: 1,
  condition: { when: ({ state, inv }) => concealedAt(state, inv?.location) },
})

export default {
  code: CODE,
  scope: 'storyAsset',
  implemented: true,
  flags: { ally: true, agency: true, detective: true },
  modifiers: [concealBonus('skill:intellect'), concealBonus('skill:combat'), concealBonus('skill:agility')],
  abilities: [{
    kind: 'reaction',
    trigger: 'tskExposed',
    label: '你揭露阴影中的卡牌后，横置阿丽·奎因特工：抽 1 张卡牌',
    cost: { exhaust: true },
    criteria: ({ inv, context }) => context?.seat === inv.seat && context?.decoy !== true
      && (context?.code ?? context?.kind) != null,
    resolve: ({ inv, api }) => {
      api.drawCards(inv.seat, 1)
      api.info?.('「阿丽·奎因特工」：横置并抽 1 张卡牌。')
      return true
    },
  }],
  note: 'approximation: 「阴影中的卡牌」按 tskExposed 的 kind/decoy 字段判定；+1 三技能用三条'
    + 'modifier 条件（不是单一多技能修正）。',
}
