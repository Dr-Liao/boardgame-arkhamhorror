// 08123 技艺精湛（Crafty，生存者 3 级天赋）
// 卡面：使用(2资源)。每轮开始时补满这些资源。
//        技艺精湛上的资源可以花费来支付 [[Insight]]、[[Tool]] 或 [[Trick]] 卡牌。
//        [fast] 在一次 [[Insight]]、[[Tool]] 或 [[Trick]] 卡的技能检定期间：从技艺精湛上花费 1 资源：
//        你本次检定得到 +1 技能值。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点：轮初补满 api.playerTools.replenishResources；[fast] +1 用 api.spendUses + api.addPendingTestBonus；
//       「资源可支付指定特性卡」用 beforePlayCost 窗口减费近似。
// approximation: 引擎费用管线没有「支援资源作为支付来源」的读点；本卡用 beforePlayCost 减费近似
//   （资源池本身足以支付时可少用池内资源；池不足时仍无法打出）。
const code = '08123'
const TRAITS = ['insight', 'tool', 'trick']

function onTraits(state, helpers, cardCode) {
  const target = cardCode ?? state?.skillTest?.source?.code
  if (!target || typeof helpers?.cardTraits !== 'function') return false
  const traits = helpers.cardTraits(target).map(trait => String(trait).toLowerCase())
  return TRAITS.some(trait => traits.includes(trait))
}

export default {
  code,
  uses: 2,
  usesType: 'resources',
  note: 'approximation: 「本卡资源可支付指定特性卡」用 beforePlayCost 窗口减费近似（费用枚举仍要求资源池可支付）。',
  abilities: [
    {
      kind: 'forced',
      trigger: 'roundStarts',
      label: '轮初补满至 2 资源',
      resolve: ({ source, api }) => api.playerTools.replenishResources(source.id, 2),
    },
    {
      kind: 'free',
      label: '本卡上的资源：指定特性检定 +1 技能值',
      cost: { action: false },
      duringOwnSkillTest: true,
      criteria: [({ state, source, helpers }) => (source?.uses || 0) > 0 && onTraits(state, helpers)],
      resolve: ({ inv, source, api }) => {
        api.spendUses(source, 1)
        api.addPendingTestBonus(1)
        api.info(`🛠️ 「技艺精湛」：${inv.name} 花费 1 资源，本次检定 +1 技能值。`)
      },
    },
    {
      kind: 'reaction',
      trigger: 'beforePlayCost',
      label: '近似-支付：从本卡花费资源降低费用',
      criteria: [({ state, inv, source, context, helpers }) => context?.seat === inv.seat
        && (source?.uses || 0) > 0 && onTraits(state, helpers, context?.cardCode)
        && (context?.costReduction || 0) < (context?.cost || 0)],
      resolve: ({ inv, source, context, api }) => {
        const maximum = Math.min(2, source?.uses || 0, Math.max(0, context?.cost || 0))
        if (maximum < 1) return
        const spend = maximum === 1 ? 1 : Number(api.choice({
          kind: 'effect', source: code, seat: inv.seat,
          prompt: `「技艺精湛」：从本卡花费几点资源来支付此卡费用？（最多 ${maximum}）`,
          options: Array.from({ length: maximum + 1 }, (_, index) => ({
            id: String(index), label: index === 0 ? '不花费' : `花费 ${index} 资源`,
          })),
        }))
        if (!spend) return
        api.spendUses(source, spend)
        context.costReduction = (context.costReduction || 0) + spend
        api.info(`💰 「技艺精湛」：从卡上花费 ${spend} 资源，降低此卡费用。`)
      },
    },
  ],
  modifiers: [],
}
