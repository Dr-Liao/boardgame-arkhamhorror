// 11692 北区（废墟） · 地点（[[废墟]]面）
// 归属：关卡专属 · theDrownedCity/theDoomOfArkhamPartII（P7 终章下篇）。

// 卡面：北区（废墟） 的[[废墟]]版本；由议程 11689 背面在完全淹没时与正面地点交换入场（未揭示面朝上）。
// 印刷：shroud 从卡表读取；每调查员 1 条线索；特性 [[Arkham]][[Ruined]]。
// 印刷限制：不能完全淹没（水位上限 1，locationRule.floodBounds 引擎读点）。
// 读点：behavior.swapToRuined（交换）；behavior.isRuined / flood.js（flags.ruined 与 floodBounds）。
const CODE = '11692'
const CTHULHU_DECK = 'cthulhu'

function arrangeCthulhuCards(inv, api) {
  const deck = api.mechanics.scenarioDecks
  const cards = deck.take(CTHULHU_DECK, 3).map((code, index) => ({
    id: String(index), cardCode: code, label: api.cardName(code),
  }))
  if (!cards.length) return
  const select = (prompt, options, canSkip = false) => api.choice({
    kind: 'card', source: CODE, seat: inv.seat, prompt, options, canSkip,
  })
  const discarded = select('查看克苏鲁牌库顶牌。可以弃掉其中 1 张。', [
    { id: 'skip', label: '不弃牌' }, ...cards,
  ], true)
  const discardedCard = cards.find(card => card.id === discarded)
  const remaining = cards.filter(card => card !== discardedCard)
  const ordered = []
  while (remaining.length > 1) {
    const chosen = select('选择下一张放到克苏鲁牌库顶的牌（从顶往下）。', remaining)
    const index = remaining.findIndex(card => card.id === chosen)
    ordered.push(remaining.splice(index, 1)[0].cardCode)
  }
  if (remaining.length) ordered.push(remaining[0].cardCode)
  deck.put(CTHULHU_DECK, ordered)
  if (discardedCard) deck.discard(CTHULHU_DECK, discardedCard.cardCode, { recycleWhenEmpty: true })
}

export default {
  code: CODE,
  scope: 'location',
  implemented: true,
  locationRule: { floodBounds: { max: 1 } },
  flags: { ruined: true },
  abilities: [{
    kind: 'action', actionKind: 'activate', cost: { action: 1 },
    label: '检定意志（3）：查看克苏鲁牌库顶 3 张，可弃 1 张并重排其余',
    limit: { scope: 'perRound', owner: 'group' },
    criteria: ({ state }) => Boolean(state.scenarioFlags?.mechanics?.scenarioDecks?.[CTHULHU_DECK]?.deck?.length),
    resolve: ({ inv, api }) => api.test(inv.seat, 'willpower', 3, {
      source: { type: 'location', code: CODE },
      resolve: result => { if (result.success) arrangeCthulhuCards(inv, api) },
    }),
  }],
}
