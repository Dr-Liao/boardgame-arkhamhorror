// 05153 “老千”先生
// 卡面：使用(3秘密)。
// 卡面：[free]横置“老千”先生并花费1秘密：查找你牌库顶3张、6张或9张卡牌，
// 找出任意一张卡牌并将其抽取。如果查找的卡牌中有至少1张弱点，也抽取其中1张弱点。混洗你的牌库。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// P7：牌库顶 N 张用 api.topDeckCodes 读、api.shuffleDeck 洗回；
// 弱点判定用 api.isNonWeakness。
// 审计 R2：「找出任意一张卡牌并将其抽取」必须是真实抽牌（会触发抽牌窗口、弱点按显现结算），
// 因此选中的牌先移到牌库顶再 api.drawCards(1)（与下方额外弱点的通道一致），不再直接 moveCard 进手牌。
// 若选中的正是弱点，它就是「抽取的弱点」，不再额外抽 1 张（参考实现同一口径）。

export default {
  code: '05153',
  uses: 3,
  usesType: 'secrets',
  abilities: [
    {
      kind: 'free', label: '横置并花费 1 秘密：从牌库顶 3/6/9 张找 1 张并抽，弱点也抽 1 张',
      cost: { action: false, exhaust: true, uses: 1 },
      resolve: ({ inv, api }) => {
        const deckSize = (inv.deck || []).length
        if (!deckSize) { api.info('牌库是空的。'); return }
        const picked = api.choice({ kind: 'search', source: '05153', seat: inv.seat,
          prompt: '“老千”先生：选择查找牌库顶几张。',
          options: [3, 6, 9].map(count => ({ id: String(count), label: `牌库顶 ${Math.min(count, deckSize)} 张` })) })
        const count = Math.min(Number(picked) || 3, deckSize)
        // topDeckCodes 返回从牌库底方向到顶（最后一个是最上面）；编号不暴露顺序之外的信息。
        const top = api.topDeckCodes(inv.seat, count)
        const chosenIndex = top.length === 1 ? 0
          : Number(api.choice({ kind: 'search', source: '05153', seat: inv.seat,
            prompt: `“老千”先生：从牌库顶 ${count} 张中找出任意 1 张并抽取。`,
            options: top.map((code, index) => ({ id: String(index), cardCode: code, label: api.cardName(code) })) }))
        const chosenCode = top[chosenIndex] || top[0]
        // 「抽取」走真实抽牌通道：先移到牌库顶，再 api.drawCards(1)。
        api.moveCard({ code: chosenCode, from: 'deck', to: 'deckTop', ownerSeat: inv.seat })
        api.drawCards(inv.seat, 1)
        api.info(`“老千”先生：抽取「${api.cardName(chosenCode)}」。`)
        // 选中的是弱点时它就是「抽取的弱点」，不再额外抽 1 张。
        const chosenIsWeakness = !api.isNonWeakness(chosenCode)
        // 审计 R4：查找结果里有多张弱点时，由玩家选择抽其中 1 张（此前 top.find 自动取第一张）。
        const weaknessCandidates = chosenIsWeakness ? [] : top.filter(code => !api.isNonWeakness(code))
        const weakness = weaknessCandidates.length <= 1 ? weaknessCandidates[0]
          : (() => {
            const index = Number(api.choice({ kind: 'search', source: '05153', seat: inv.seat,
              prompt: '“老千”先生：查找结果中有多张弱点，选择抽其中 1 张。',
              options: weaknessCandidates.map((code, i) => ({ id: String(i), cardCode: code, label: api.cardName(code) })) }))
            return weaknessCandidates[index] || weaknessCandidates[0]
          })()
        if (weakness) {
          // 「抽取 1 张弱点」走真实抽牌通道：先把它移到牌库顶，再用 api.drawCards 抽 1 张，
          // 这样弱点按引擎的抽牌/弱点结算路径处理（而不是只塞进手牌）。
          api.moveCard({ code: weakness, from: 'deck', to: 'deckTop', ownerSeat: inv.seat })
          api.drawCards(inv.seat, 1)
          api.info(`“老千”先生：查找的卡牌中有弱点，额外抽取「${api.cardName(weakness)}」。`)
        }
        api.shuffleDeck(inv.seat)
      },
    },
  ],
  modifiers: [],
}
