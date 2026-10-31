// 06323 摒绝杂念
// 卡面：多重。
//       [free]弃掉你手中的一张摒绝杂念：治愈本摒绝杂念的全部伤害和恐惧。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 06323 摒绝杂念（[[仪式]]支援）：多重（构筑期同名上限，主进程接线）。
//   · [free] 能力 = 不花行动（cost.action:false），费用「弃掉手牌里的一张同名卡」用
//     criteria 要求手牌里有 06323、resolve 里 api.discardFromHand 精确弃掉一张同名卡；
//   · 「治愈本拷贝的全部伤害与恐惧」→ api.healAsset(source, { damage:99, horror:99, owner:inv })
//     （支援上伤害/恐惧的统一写点，恐惧走 healHorrorFrom 的窗口）。

export default {
  code: '06323',
  abilities: [
    {
      kind: 'action',
      label: '[free] 弃掉手牌中一张「摒绝杂念」：治愈本拷贝的全部伤害与恐惧',
      cost: { action: false },
      criteria: [({ inv }) => (inv?.hand || []).includes('06323')],
      resolve: ({ inv, api, source }) => {
        if (!source) return
        if (!(inv.hand || []).includes('06323')) { api.info('手中没有另一张「摒绝杂念」。'); return }
        api.discardFromHand(inv.seat, '06323')
        api.healAsset(source, { damage: 99, horror: 99, owner: inv })
        api.info(`✨ ${inv.name} 弃掉一张「摒绝杂念」，治愈本拷贝的全部伤害与恐惧。`)
      },
    },
  ],
  modifiers: [],
}
