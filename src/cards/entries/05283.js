// 05283 安娜·卡斯洛
// 卡面：你拥有额外2个塔罗牌槽位。
// 卡面：[reaction]在游戏开始时，如果安娜·卡斯洛在你起始手牌中：将其放置入场。
// 卡面：[reaction]在安娜·卡斯洛入场后：查找你的牌库，找出一张[[塔罗]]支援，并将其放置入场。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 05283 安娜·卡斯洛：
// - 额外 2 塔罗槽位走修正管线 add:slot + value:'tarot'（读点 tarotSlotCapacity）；
// - 开局从起始手牌放置入场走 scenarioStarts 窗口（同 05023 宝剑王牌的口径，noPlayCost）；
// - 「入场后检索塔罗支援并放置入场」写在 entersPlay 钩子上（正常打出时触发；开局入场由第一条能力自己补一次，
//   因为 api.putIntoPlay 不经过 doPlay 的入场钩子）。

function searchTarotIntoPlay(inv, api) {
  const found = api.searchDeck(inv.seat, {
    trait: 'tarot', type: 'asset', choose: 1, shuffle: true, optional: true, source: '05283',
    prompt: '查找你的牌库，找出一张[[塔罗]]支援并放置入场。',
  })
  const code = (found || [])[0]
  if (code) api.putIntoPlay(inv.seat, code)
}

export default {
  code: '05283',
  modifiers: [
    { target: 'add:slot', value: 'tarot', amount: 2 },
  ],
  abilities: [
    {
      kind: 'reaction',
      trigger: 'scenarioStarts',
      fromHand: true,
      noPlayCost: true,
      label: '游戏开始时若在起始手牌中：放置入场并检索塔罗支援',
      criteria: ctx => (ctx.inv?.hand || []).includes('05283'),
      resolve: ({ inv, api }) => {
        if (!inv.hand.includes('05283')) return
        const placed = api.putIntoPlay(inv.seat, '05283')
        if (placed) searchTarotIntoPlay(inv, api)
      },
    },
    {
      kind: 'entersPlay',
      label: '入场后：检索牌库中的塔罗支援并放置入场',
      resolve: ({ inv, api }) => searchTarotIntoPlay(inv, api),
    },
  ],
}
