// 05032 否决存在
// 卡面：快速。在遭遇卡牌或敌人攻击将要导致你执行以下一项(选择一项)时打出：
//       弃掉手牌、失去资源、失去行动、受到伤害、受到恐惧。你忽略该效果的影响。(所有其他效果如常结算。)
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 05032 否决存在：harmDealt 窗口的快速事件——取消刚受到的伤害/恐惧（api.cancelHarm，
// 与 03157 吉人天相同一套通用取消原语）。
// 显式简化：卡面还可取消「弃手牌 / 失资源 / 失行动」三项，引擎没有这三类效果的通用取消读点；
// 且触发范围放宽为任意伤害/恐惧（不限于遭遇卡或敌人攻击）。

// R6 准备：would* 窗口带 context.source={kind} 后按卡面限定「遭遇卡或敌人攻击」；
// 原语未落地时回退旧近似（state._treacheryResolving）。
function sourceAllowed(state, context) {
  const kind = context?.source?.kind
  if (kind) return kind === 'encounter' || kind === 'enemyAttack'
  return Boolean(state._treacheryResolving)
}

export default {
  code: '05032',
  simplified: true,
  note: 'R7：五类可选项均按 context.source（enemyAttack/encounter/other）限定来源，伤害/恐惧面（harmDealt）也已接；「你忽略该效果（其他效果如常）」按取消当次窗口实现（其余窗口独立结算）。',
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
    // 审计 R4：补挂「弃掉手牌 / 失去资源 / 失去行动」三个取消窗口（05280 同一写法）。
    // 来源仍按「遭遇卡结算期间」近似（state._treacheryResolving）；敌人攻击造成这三类效果较少见。
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
