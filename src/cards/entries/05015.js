// 05015 可怕的秘密
// 卡面：显现 - 如果黛安娜·史丹利底下没有卡牌，将可怕的秘密洗回你的牌库。否则，黛安娜·史丹利
//       底下每有一张卡牌，你必须弃掉该卡牌或受到1点恐惧。不能取消。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '05015',
  abilities: [
    {
      kind: 'weakness',
      label: '可怕的秘密：每张底下的卡牌弃掉或承受 1 点恐惧',
      weakness: { type: 'terribleSecret' },
      resolve: ({ inv, api }) => {
        const beneath = inv.beneath || []
        if (!beneath.length) {
          api.scheduleWeaknessShuffle(inv.seat, '05015')
          api.info('黛安娜底下没有卡牌：「可怕的秘密」洗回牌库。')
          return
        }
        for (const code of [...beneath]) {
          const answer = api.choice({
            kind: 'discard', source: '05015', seat: inv.seat,
            prompt: `「可怕的秘密」：弃掉底下的「${api.cardName(code)}」，或承受 1 点恐惧。`,
            options: [{ id: 'discard', label: '弃掉这张卡牌' }, { id: 'horror', label: '承受 1 点恐惧' }],
          })
          if (answer === 'horror') {
            api.harm(inv.seat, { horror: 1, strategy: 'self' })
          } else {
            const index = inv.beneath.indexOf(code)
            if (index >= 0) inv.beneath.splice(index, 1)
            inv.discard.push(code)
            api.info(`${inv.name} 弃掉了底下的「${api.cardName(code)}」。`)
          }
        }
      },
    },
  ],
  modifiers: [],
}
