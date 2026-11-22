// 98008 劈分时空之角（Split the Angle）· 中立 · 支援/法术 · 费用 2 · 替换（诺曼·威瑟斯）。
// 卡面（cards-data 98008）：
//   诺曼·威瑟斯牌库专用。替换。
//   [action]：揭示遭遇牌库顶的 1 张牌。
//   [fast] 横置劈分时空之角并弃掉你牌库顶的 1 张牌：弃掉遭遇牌库顶的 1 张牌。
//
// 引擎读点：
//   · [action] 揭示遭遇牌库顶 = action 描述子 + api.lookAt({
//     zone:'encounterDeck', count:1, choose:0, showCards:true, returnStrategy:'top' })（与 11014 同一读点：
//     查看/揭示遭遇牌库顶，结算后放回）。
//   · [fast] 横置 + 弃牌库顶 = free 描述子 cost { exhaust:true } + api.discardTopOfDeck
//     （玩家牌库顶弃牌的唯一写点）；弃遭遇牌库顶 = api.discardEncounterTop（encounter 弃牌统一入口）。
const code = '98008'

export default {
  code,
  abilities: [
    {
      kind: 'action',
      label: '揭示遭遇牌库顶的 1 张牌',
      resolve: ({ inv, state, api }) => {
        if (!state.encounterDeck?.length) { api.info('遭遇牌库为空。'); return }
        api.lookAt(inv.seat, {
          zone: 'encounterDeck', count: 1, choose: 0, showCards: true, returnStrategy: 'top', source: code,
          prompt: '劈分时空之角：揭示遭遇牌库顶的 1 张牌。',
        })
      },
    },
    {
      kind: 'free',
      cost: { exhaust: true },
      label: '横置并弃牌库顶 1 张：弃掉遭遇牌库顶 1 张',
      criteria: [({ inv, state }) => (inv.deck || []).length > 0 && (state.encounterDeck || []).length > 0],
      resolve: ({ inv, api }) => {
        const discarded = api.discardTopOfDeck(inv.seat, 1)
        if (!discarded?.length) return
        api.discardEncounterTop(1)
        api.info('劈分时空之角：弃掉牌库顶 1 张，并弃掉遭遇牌库顶 1 张。')
      },
    },
  ],
  modifiers: [],
}
