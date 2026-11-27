// 08120 先知先觉（Prophetic，守卫者 3 级天赋）
// 卡面：使用(2资源)。每轮开始时补满这些资源。
//        先知先觉上的资源可以花费来支付 [[Fortune]]、[[Spell]] 或 [[Spirit]] 卡牌。
//        [fast] 在一次 [[Fortune]]、[[Spell]] 或 [[Spirit]] 卡的技能检定期间：从先知先觉上花费 1 资源：
//        你本次检定得到 +1 技能值。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 轮初补满 2 个资源；支付使用 playCostUses，技能检定使用实际资源标记。
import { currentEffectSource } from '../../engine/effect-provenance.js'

const code = '08120'
const TRAITS = ['fortune', 'spell', 'spirit']

function onTraits(state, helpers) {
  const target = currentEffectSource(state)?.code ?? state.skillTest?.source?.code
  if (!target) return false
  return helpers.cardTraits(target).some(trait => TRAITS.includes(String(trait).toLowerCase()))
}

export default {
  code,
  uses: 2,
  usesType: 'resources',
  assetRule: { playCostUses: { scope: 'self', traitsAny: TRAITS } },
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
        api.info(`🎯 「先知先觉」：${inv.name} 花费 1 资源，本次检定 +1 技能值。`)
      },
    },
  ],
  modifiers: [],
}
