// 05153 “老千”先生
// 卡面：使用(3秘密)。
// 卡面：[free]横置“老千”先生并花费1秘密：查找你牌库顶3张、6张或9张卡牌，
// 找出任意一张卡牌并将其抽取。如果查找的卡牌中有至少1张弱点，也抽取其中1张弱点。混洗你的牌库。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 查找统一走引擎的公共原语 api.searchTop（与智慧古书 01031 / 新晋术士 03271 等同一句卡文）：
//   · 查找开始后由 deck-ops 的 searchedCardsWindow 结算「被查找到的牌自身规则」——
//     06023 骇人真相 / 06008 神秘证据 / 06009 惊人的发现。此前的自实现（api.topDeckCodes）
//     绕过了这个读点，所以「老千」先生翻到骇人真相时不会触发它的反应。
//   · 「找出任意 1 张并将其抽取」与「查找的牌中有弱点也抽 1 张」都由 searchTop 走真实抽牌通道
//     （选中牌移牌库顶 + drawCards）：选中的是弱点时按显现结算；drawWeakness 选项负责额外弱点。
//   · 3/6/9 的张数选择是这张卡自己的一步，仍留在本文件。

export default {
  code: '05153',
  uses: 3,
  usesType: 'secrets',
  abilities: [
    {
      kind: 'free',
      label: '横置并花费 1 秘密：查找牌库顶 3/6/9 张，找出 1 张并抽取；有弱点也抽 1 张',
      cost: { action: false, exhaust: true, uses: 1 },
      resolve: ({ inv, api }) => {
        const deckSize = (inv.deck || []).length
        if (!deckSize) { api.info('牌库是空的。'); return }
        const picked = api.choice({ kind: 'search', source: '05153', seat: inv.seat,
          prompt: '“老千”先生：选择查找牌库顶几张。',
          options: [3, 6, 9].map(count => ({ id: String(count), label: `牌库顶 ${Math.min(count, deckSize)} 张` })) })
        const count = Math.min(Number(picked) || 3, deckSize)
        api.searchTop(inv.seat, {
          amount: count,
          choose: 1,
          drawWeakness: true,
          source: '05153',
          prompt: `“老千”先生：从牌库顶 ${count} 张中找出任意 1 张并抽取。`,
        })
      },
    },
  ],
  modifiers: [],
}
