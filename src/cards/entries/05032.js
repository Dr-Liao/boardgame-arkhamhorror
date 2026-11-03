// 05032 否决存在
// 卡面：快速。在遭遇卡牌或敌人攻击将要导致你执行以下一项(选择一项)时打出：
//       弃掉手牌、失去资源、失去行动、受到伤害、受到恐惧。你忽略该效果的影响。(所有其他效果如常结算。)
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 05032 否决存在：通过伤害/恐惧及弃手牌、失资源、失行动的取消窗口结算；
// 来源限定为遭遇卡或敌人攻击。
function sourceAllowed(state, context) {
  const kind = context?.source?.kind
  if (kind) return kind === 'encounter' || kind === 'enemyAttack'
  return Boolean(state._treacheryResolving)
}

export default {
  code: '05032',
  abilities: [
    {
      kind: 'played',
      fast: true,
      trigger: 'harmDealt',
      // R7：与三面向同一来源判定——只对「遭遇卡或敌人攻击」造成的伤害/恐惧提供。
      criteria: [({ state, inv, context }) => context?.seat === inv.seat
        && sourceAllowed(state, context)
        && ((context.damage || 0) > 0 || (context.horror || 0) > 0)],
      label: '否决存在：忽略本次伤害/恐惧',
      resolve: ({ inv, api }) => {
        api.cancelHarm(inv.seat, {
          maximum: 20,
          source: '05032',
          prompt: '选择「否决存在」要取消的伤害与恐惧。',
        })
      },
    },
    // 「弃掉手牌 / 失去资源 / 失去行动」三个取消窗口（05280 同一写法）。
    {
      kind: 'reaction',
      trigger: ['wouldDiscardFromHand', 'wouldLoseResources', 'wouldLoseActions'],
      fromHand: true,
      label: '否决存在：忽略弃掉手牌/失去资源/失去行动',
      criteria: [({ state, inv, context }) => context?.seat === inv.seat
        && sourceAllowed(state, context) && !context?.cancelled],
      resolve: ({ context, api }) => {
        context.cancelled = true
        const what = context.what === 'discard' ? '弃掉手牌' : context.what === 'resources' ? '失去资源' : '失去行动'
        api.info(`🛡️ 「否决存在」忽略了这次${what}的效果。`)
      },
    },
  ],
  modifiers: [

  ],
}
