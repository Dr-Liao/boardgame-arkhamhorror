// 05236 指路鬼魂（幸存者 · 1 经验）
// 卡面：你得到+1[intellect]。
// 卡面：非直接恐惧在分配到你的调查员卡牌之前，必须先分配给指路鬼魂。
// 卡面：强制 - 在指路鬼魂因为恐惧而被击败时：将其放逐。
// 卡面数据：3 神智（盟友）。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 05236 指路鬼魂：+1 智慧；「沉静」（非直接恐惧必须先分给它）；因恐惧被击败时放逐。
//
// 离场钩子读取击败上下文，恐惧达到理智上限才改变本次离场的去向。

export default {
  code: '05236',
  composure: true,
  modifiers: [
    { target: 'skill:intellect', amount: 1 },
  ],
  abilities: [
    {
      kind: 'leavesPlay',
      label: '因恐惧被击败：将其放逐',
      resolve: ({ inv, source, api, context }) => {
        const sanity = Number(api.cardSanity?.(source.code)) || 3
        if (!context?.defeated || (source.horror || 0) < sanity) return
        if (!api.exileDepartingAsset(inv.seat, source)) return
        api.info(`${inv.name} 的「指路鬼魂」因恐惧被击败，被放逐（本关结束后从战役牌组移除）。`)
      },
    },
  ],
}
