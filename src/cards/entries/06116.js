// 06116 预言卷轴
// 卡面：使用(4秘密)。
// 卡面：[action]花费1秘密：选择你所在地点的一位调查员。该调查员抽取3张卡牌，然后弃掉其1张手牌。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点：使用次数是条目级 uses/usesType；行动费用消耗 1 秘密；目标用描述子 target.kind='investigator'；
// 抽牌走 api.drawCards，弃牌走 api.discardFromHand（只经 ctx.api 改状态）。

export default {
  code: '06116',
  uses: 4,
  usesType: 'secret',
  discardWhenEmpty: true,
  abilities: [
    {
      kind: 'action',
      label: '花费 1 秘密：目标调查员抽 3 张，然后弃 1 张手牌',
      cost: { action: true, uses: 1 },
      target: { kind: 'investigator' },
      resolve: ({ state, inv, target, api }) => {
        const other = target?.entity || (state.investigators.find(item => String(item.seat) === String(target?.id)))
        const seat = Number.isInteger(other?.seat) ? other.seat : inv.seat
        const owner = state.investigators[seat]
        if (!owner) return
        api.drawCards(seat, 3)
        const hand = owner.hand
        if (!hand.length) { api.info(`${owner.name} 没有手牌可弃。`); return }
        const options = hand.map((code, index) => ({ id: String(index), cardCode: code, label: api.cardName(code) }))
        const choice = options.length === 1 ? options[0].id : api.choice({
          kind: 'discard', source: '06116', seat,
          prompt: `${owner.name} 弃掉 1 张手牌。`, options,
        })
        const picked = hand[Number(choice)]
        if (picked == null) return
        api.discardFromHand(seat, picked)
        api.info(`🃏 ${owner.name} 弃掉了「${api.cardName(picked)}」。`)
      },
    },
  ],
  modifiers: [],
}
