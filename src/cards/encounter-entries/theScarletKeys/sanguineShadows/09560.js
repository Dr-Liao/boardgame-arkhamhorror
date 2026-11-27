// 09560 来访名片（Calling Card）· treachery（附属在地点上）
//
// 归属：关卡专用 · theScarletKeys/sanguineShadows（P7）。
// 卡面：
//   显现 - 附属到没有标的且没有附属来访名片的地点。
//   来访名片在场上时，不能（在任何地点）花费线索。
//   [reaction] 在你成功调查所附属地点且超过难度至少 2 点后：弃掉来访名片。查看任意地点一张
//   隐匿迷你卡牌的已揭示面（不将其揭露）。
export default {
  code: '09560',
  scope: 'treachery',
  implemented: true,
  treacheryRule: {
    resolveKind: 'callingCard',
    attachment: true,
    blocksClueSpending: true,
    blocksClueSpendingEverywhere: true,
  },
  abilities: [{
    kind: 'reaction', trigger: 'investigateSuccess',
    label: '调查所附属地点成功且超过至少 2 点：弃掉来访名片，查看一张隐匿迷你卡',
    criteria: ({ state, inv, source, context }) => context.seat === inv.seat && context.successBy >= 2
      && state.locations.some(location => location.id === context.location
        && location.attachments?.some(card => card.id === source.id)),
    resolve: ({ inv, source, api }) => {
      if (!api.discardAttachment(source)) return false
      const cards = api.tsk.concealed.miniCards().filter(card => card.locationId && !card.flipped)
      if (!cards.length) return true
      const id = cards.length === 1 ? cards[0].id : api.choose({
        kind: 'card', source: '09560', seat: inv.seat,
        prompt: '来访名片：选择任意地点的一张隐匿迷你卡，查看其揭示面。',
        options: cards.map((card, index) => ({ id: card.id, label: `${card.locationId}：隐匿迷你卡 ${index + 1}` })),
      })
      if (cards.some(card => card.id === id)) api.tsk.concealed.markKnown(id, [inv.seat])
      return true
    },
  }],
}
