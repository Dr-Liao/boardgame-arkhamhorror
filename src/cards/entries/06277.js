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
//   · 取消符号标记：符号揭示窗口由引擎在「取消判定之前」开能力层窗口，因此取消必须写成
//     强制描述子 + 旧式 effect 数据体（{type:'cancelSymbolToken'} 写 skillTest.cancelledSymbol，
//     引擎随后跳过该标记的修正与效果）；heal 1 damage / 1 horror 由同一 sequence 结算。
//   · 显式简化（noted）：卡面是 [reaction]（可选），引擎里能在取消判定之前拿到 effect 数据体的
//     唯一通道是 forced 描述子 + legacyReaction 数据体，因此充能足够时会自动取消（不问询）。
//   · 没有充能时强制交换回空虚项链：另一个 forced 描述子（uses<=0）走 bonded.return +
//     moveCard(setAside→play) 把空虚项链放回场上。

const SYMBOLS = ['skull', 'cultist', 'tablet', 'elderthing']

function swapBack({ inv, api }) {
  // 食愿项链收回场外绑定集合，空虚项链回到场上（0 充能，见 06276 的 uses:0）。
  api.bonded.return(inv.seat, '06276')
  api.moveCard({ code: '06276', from: 'setAside', to: 'play' })
  api.info(`🔄 ${inv.name} 的「食愿项链」充能耗尽：交换回「空虚项链」。`)
}

export default {
  code: '06277',
  simplified: true,
  note: '简化：卡面为 [reaction]（可选），但引擎里能在「取消判定之前」拿到 effect 数据体（cancelSymbolToken）'
    + '的唯一通道是 forced 描述子 + legacyReaction，因此有充能时揭示符号标记会自动取消（不问询）。'
    + '取消标记、治愈 1 伤害/1 恐惧、无充能时强制交换回空虚项链均已实现。',
  abilities: [
    {
      kind: 'forced',
      trigger: 'symbolRevealed',
      id: 'wishEaterCancel',
      // 旧式数据体：cancelSymbolToken 的读点（skillTest.cancelledSymbol）只在「取消判定之前」的
      // 能力层窗口里有效，因此用 legacyReaction 数据体 + forced 描述子（resolve 型描述子拿不到
      // 取消标记的写入入口）。
      legacyReaction: true,
      label: '揭示符号标记时，花费 1 充能：取消该混乱标记，治愈 1 点伤害和 1 点恐惧',
      criteria: [({ context }) => SYMBOLS.includes(context?.token)],
      cost: { uses: 1 },
      effect: {
        type: 'sequence',
        effects: [
          { type: 'cancelSymbolToken', code: '06277' },
          { type: 'heal', what: 'damage', amount: 1 },
          { type: 'heal', what: 'horror', amount: 1 },
        ],
      },
    },
    {
      kind: 'forced',
      trigger: 'symbolRevealed',
      id: 'wishEaterSwapBack',
      label: '如果食愿项链没有充能：交换回空虚项链',
      criteria: [({ source }) => (source?.uses ?? 0) <= 0],
      resolve: ctx => swapBack(ctx),
    },
  ],
  modifiers: [],
}
