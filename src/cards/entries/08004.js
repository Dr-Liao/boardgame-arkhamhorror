// 08004 诺曼·威瑟斯（Norman Withers）· 探求者 · 天文学家。
//
// 卡面（正面）：
//   你牌库顶的卡牌始终揭示。
//   每轮一次，你可以打出你牌库顶的卡牌（如同其是你的手牌），且其资源费用 -1。
//   强制 - 在你的牌库顶揭示一张弱点后：将其抽取。
//   [elder_sign] 效果：+X。你可以用一张手牌交换你牌库顶的卡牌。X 为你牌库顶卡牌的资源费用。
//
// 引擎读点（Lead 的 P5 支持项，描述子只声明数据）：
//   · `investigator.deckTop = { reveal, public, discount, drawWeakness }`：引擎在开局 / 轮开始 /
//     牌库顶变化后同步揭示（revealDeckTop），按 discount 让 play-channels 的 deckTop 通道开出
//     「每轮一次 -1 费打出」；揭示到弱点时强制抽取（跳过 flags.weaknessStaysOnDeckTop 的卡）。
//   · 旧印的换牌用现有 api.moveCard + api.deckTop.clear/reveal 组合完成，不新增状态。
const deckTopRecord = (state, seat) => state?.scenarioFlags?.mechanics?.eote?.deckTop?.seats?.[seat] || null

export default {
  code: '08004',
  kind: 'investigator',
  investigator: {
    elderSign: { bonus: 0 },
    deckTop: { reveal: true, public: false, discount: 1, drawWeakness: true },
  },
  elderSign: {
    label: '旧印：+X（牌库顶费用），可用手牌交换牌库顶',
    resolve: ({ inv, state, api }) => {
      const record = deckTopRecord(state, inv.seat) || api.deckTop.card(inv.seat)
      const x = record ? api.cardCost(record.code) : 0
      if (record && (inv.hand || []).length) {
        const codes = [...new Set(inv.hand)]
        const options = codes.map(code => ({ id: code, label: api.cardName(code) }))
        const answer = api.choice({
          kind: 'effect', source: '08004', seat: inv.seat, canSkip: true,
          prompt: '是否用一张手牌交换牌库顶的卡牌？',
          options: [{ id: 'skip', label: '不交换' }, ...options],
        })
        if (answer !== 'skip' && codes.includes(answer)) {
          // 座位：旧印是「你」的能力，即使本次检定不是在你的回合发生（神话/遭遇强制检定），
          // 换牌也必须落在你（inv.seat）的牌库/手牌上：spec.ownerSeat 限定来源/目的地归属，
          // options.seat 让 api.moveCard 的兜底行动者也是本人。
          const movedDown = api.moveCard({ code: record.code, from: 'deck', to: 'hand', ownerSeat: inv.seat }, { seat: inv.seat })
          const movedUp = movedDown && api.moveCard({ code: answer, from: 'hand', to: 'deckTop', ownerSeat: inv.seat }, { seat: inv.seat })
          if (movedUp) {
            api.deckTop.clear(inv.seat)
            api.deckTop.reveal(inv.seat, { public: false, discount: 1 })
          }
        }
      }
      return { delta: x }
    },
  },
  abilities: [],
}
