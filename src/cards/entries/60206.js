// 60206 昴宿星团残章
// 卡面：你有……
// 卡面：- ……至少5张手牌时，得到+1[intellect]。
// 卡面：- ……至少10张手牌时，得到+1[willpower]。
// 卡面：- ……至少15张手牌时，得到+1[intellect]。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '60206',
  modifiers: [
    { target: 'skill:intellect', amount: 1, condition: { when: ({ inv }) => inv.hand.length >= 5 } },
    { target: 'skill:willpower', amount: 1, condition: { when: ({ inv }) => inv.hand.length >= 10 } },
    { target: 'skill:intellect', amount: 1, condition: { when: ({ inv }) => inv.hand.length >= 15 } },
  ],
}
