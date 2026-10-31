// 06202 命令真言
// 卡面：指定一张[[法术]]卡牌。查找你的牌库，找出并抽取 1 张指定的卡牌。混洗你的牌库。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 实现口径：「指定一张[[法术]]卡牌」落地为「按[[法术]]特性检索牌库」——玩家在实际可找出的
// 法术卡里选择（指定一张不在牌库里的法术卡没有收益，两者结果等价）。检索走引擎统一的
// api.searchDeck（会开「查找牌库」窗口、洗回牌库、处理曼蒂/神秘证据等被找到规则）。

export default {
  code: '06202',
  abilities: [
    {
      kind: 'played',
      label: '指定一张法术卡：检索牌库并抽取，然后洗回',
      resolve: ({ inv, api }) => {
        const taken = api.searchDeck(inv.seat, {
          trait: 'Spell',
          choose: 1,
          shuffle: true,
          source: '06202',
          prompt: '指定一张[[法术]]卡牌，并从你的牌库中找出它。',
        })
        if (taken && taken.length) {
          api.info(`${inv.name} 用「命令真言」找出了「${api.cardName(taken[0])}」。`)
        }
      },
    },
  ],
  modifiers: [],
}
