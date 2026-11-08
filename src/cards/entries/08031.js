// 08031 强制学习
// 卡面：永久。每套牌库仅限 1 张。当构建牌库时购买。
//       你的牌库卡牌张数 +15。
//       补给阶段期间，不抽取一张卡牌，改为抽取两张并弃掉其中一张。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// approximation：
//   · 牌库 +15：条目 deckConstruction.sizeBonus（构筑层 read point，web/deck-rules + deckbuilding 已读）；
//   · 补给阶段抽牌替换：玩家支援没有 upkeepDraw 读点（请求 m2-1-08031.json）。这里用 upkeepEnd
//     强制能力「再抽 1 张并弃 1 张」表达替换：正常补给抽 1 后共抽 2 弃 1，最终手牌净变化与卡面
//     相同（都是 +1），差别是第二张在重整末尾才抽、弃牌时机晚于正常抽牌步骤。
export default {
  code: '08031',
  deckConstruction: {
    sizeBonus: 15,
  },
  abilities: [
    {
      kind: 'forced',
      trigger: 'upkeepEnd',
      label: '补给阶段：抽 2 弃 1（近似：重整结束再抽 1 弃 1；牌库 +15 由构筑层结算）',
      criteria: ({ inv }) => (inv.assets || []).some(card => card.code === '08031'),
      resolve: ({ inv, api }) => {
        if (!(inv.deck || []).length) return
        api.drawCards(inv.seat, 1)
        const hand = [...new Set(inv.hand || [])]
        if (!hand.length) return
        const answer = hand.length === 1 ? hand[0] : api.choice({
          kind: 'card', source: '08031', seat: inv.seat,
          prompt: '强制学习：弃掉一张手牌。',
          options: hand.map(code => ({ id: code, cardCode: code, label: api.cardName(code) })),
        })
        const code = hand.includes(answer) ? answer : hand[0]
        api.discardFromHand(inv.seat, code)
        api.info('强制学习：补给阶段额外抽 1 张并弃掉 1 张手牌。')
      },
    },
  ],
  modifiers: [],
}
