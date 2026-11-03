// 06277 食愿项链
// 卡面：绑定(空虚项链)。
//       [reaction]在你进行技能检定期间揭示[skull]、[cultist]、[tablet]或[elder_thing]混乱标记时，
//       花费1充能：取消该混乱标记。治愈1点伤害和1点恐惧。
//       强制 - 如果食愿项链没有充能：查找你的绑定卡牌。找出空虚项链，将其与食愿项链交换。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 06277 食愿项链（绑定副本，主卡 06276 空虚项链）：充能由 06276 交换时写入（uses/usesType 同 charges）。
//   · 取消符号标记：可选反应在符号结算前调用 api.cancelCurrentSymbol，再治疗伤害与恐惧。
//   · 没有充能时由 onUsesEmptied 立即交换回空虚项链。

const SYMBOLS = ['skull', 'cultist', 'tablet', 'elderthing']

function swapBack({ inv, api }) {
  // 食愿项链收回场外绑定集合，空虚项链回到场上（0 充能，见 06276 的 uses:0）。
  api.bonded.return(inv.seat, '06276')
  api.moveCard({ code: '06276', from: 'setAside', to: 'play' })
  api.info(`🔄 ${inv.name} 的「食愿项链」充能耗尽：交换回「空虚项链」。`)
}

export default {
  code: '06277',
  onUsesEmptied: ({ inv, api }) => swapBack({ inv, api }),
  abilities: [
    {
      kind: 'reaction',
      trigger: 'symbolRevealed',
      id: 'wishEaterCancel',
      label: '揭示符号标记时，花费 1 充能：取消该混乱标记，治愈 1 点伤害和 1 点恐惧',
      criteria: [({ state, inv, context }) => context?.seat === inv.seat && SYMBOLS.includes(context?.token)
        && state.skillTest?.cancelledSymbol !== context.token],
      cost: { uses: 1 },
      resolve: ({ inv, context, api }) => {
        if (!api.cancelCurrentSymbol(context, { sourceCode: '06277' })) return
        api.healDamage(inv.seat, 1)
        api.healHorror(inv.seat, 1)
      },
    },
  ],
  modifiers: [],
}
